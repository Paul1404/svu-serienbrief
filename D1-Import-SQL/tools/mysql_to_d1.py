#!/usr/bin/env python3
"""Convert a MySQL dump into Cloudflare D1-friendly SQL artifacts.

Usage (with uv):
    uv run python tools/mysql_to_d1.py \
        --input linear-in/datesicherung.sql \
        --out-dir d1-output

The script splits schema and data statements so they can be loaded via
`wrangler d1 execute --file`.  It performs a minimal normalization of MySQL
constructs (AUTO_INCREMENT, ENGINE hints, MySQL-specific comments), optionally
chunks INSERT batches, and can whitelist column subsets (with optional JSON
payload columns for trimmed data) for Cloudflare D1's column limits.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, Iterator, List, Mapping, Optional, Sequence, Tuple

CREATE_TABLE_PATTERN = re.compile(r"CREATE\s+TABLE\s+`?([^`\s]+)`?\s*\(", re.IGNORECASE)
DROP_TABLE_PATTERN = re.compile(r"DROP\s+TABLE\s+IF\s+EXISTS\s+`?([^`\s]+)`?", re.IGNORECASE)
INSERT_PATTERN = re.compile(r"INSERT\s+INTO\s+`?([^`\s]+)`?", re.IGNORECASE)
KEY_USING_PATTERN = re.compile(r"USING\s+\w+", re.IGNORECASE)
BINARY_ZERO_PATTERN = re.compile(r"_binary\s+'\\0'", re.IGNORECASE)
BINARY_ONE_PATTERN = re.compile(r"_binary\s+'\\1'", re.IGNORECASE)
BIT_LITERAL_PATTERN = re.compile(r"\bb'([01])'", re.IGNORECASE)


class DumpConverter:
    """Stream a MySQL dump file and emit schema & data statements."""

    def __init__(
        self,
        input_path: Path,
        only_tables: Optional[Sequence[str]] = None,
        skip_tables: Optional[Sequence[str]] = None,
        column_allowlists: Optional[Mapping[str, Sequence[str]]] = None,
        extras_column: Optional[str] = None,
    ) -> None:
        self.input_path = input_path
        self.only_tables = {t.lower() for t in only_tables} if only_tables else None
        self.skip_tables = {t.lower() for t in skip_tables} if skip_tables else set()
        self.column_allowlists = {k.lower(): list(v) for k, v in (column_allowlists or {}).items()}
        self.extras_column = extras_column
        self._in_block_comment = False
        self.original_columns: Dict[str, List[str]] = {}
        self.original_column_lookup: Dict[str, Dict[str, str]] = {}
        self.kept_columns: Dict[str, List[str]] = {}
        self.tables_with_extras: set[str] = set()

    def convert(self) -> Tuple[List[str], List[str]]:
        schema_statements: List[str] = []
        data_statements: List[str] = []

        with self.input_path.open("r", encoding="utf-8") as handle:
            iterator = iter(handle)
            for raw_line in iterator:
                if not self._should_process_line(raw_line):
                    continue

                stripped_upper = raw_line.lstrip().upper()

                if stripped_upper.startswith("DROP TABLE"):
                    statement = self._collect_statement(raw_line, iterator)
                    table = self._match_table_name(DROP_TABLE_PATTERN, statement)
                    if table and not self._table_in_scope(table):
                        continue
                    schema_statements.append(statement.strip())
                    continue

                if stripped_upper.startswith("CREATE TABLE"):
                    statement = self._collect_statement(raw_line, iterator)
                    table = self._match_table_name(CREATE_TABLE_PATTERN, statement)
                    if table and not self._table_in_scope(table):
                        continue
                    create_stmt, index_statements = self._transform_create(statement)
                    if create_stmt:
                        schema_statements.append(create_stmt)
                    schema_statements.extend(index_statements)
                    continue

                if stripped_upper.startswith("INSERT INTO"):
                    statement = self._collect_statement(raw_line, iterator)
                    table = self._match_table_name(INSERT_PATTERN, statement)
                    if table and not self._table_in_scope(table):
                        continue
                    normalized = self._normalize_insert(table, statement) if table else None
                    if normalized:
                        if isinstance(normalized, list):
                            data_statements.extend(normalized)
                        else:
                            data_statements.append(normalized)
                    continue

                # Everything else (LOCK TABLES, SET, etc.) is intentionally skipped.

        return schema_statements, data_statements

    def _table_in_scope(self, table: str) -> bool:
        name = table.lower()
        if self.only_tables is not None and name not in self.only_tables:
            return False
        if name in self.skip_tables:
            return False
        return True

    def _match_table_name(self, pattern: re.Pattern[str], statement: str) -> Optional[str]:
        match = pattern.search(statement)
        return match.group(1) if match else None

    def _canonical_column_name(self, table_lower: str, column: str) -> str:
        lookup = self.original_column_lookup.get(table_lower, {})
        return lookup.get(column.lower(), column)

    def _should_process_line(self, line: str) -> bool:
        stripped = line.strip()
        if not stripped:
            return False
        if self._in_block_comment:
            if "*/" in stripped:
                self._in_block_comment = False
            return False
        if stripped.startswith("/*"):
            if not stripped.endswith("*/"):
                self._in_block_comment = True
            return False
        if stripped.startswith("--") or stripped.startswith("#"):
            return False
        if stripped.startswith("/*!"):
            if "*/" not in stripped:
                self._in_block_comment = True
            return False

        upper = stripped.upper()
        skip_prefixes = (
            "LOCK TABLES",
            "UNLOCK TABLES",
            "ALTER TABLE",
            "SET ",
            "CREATE DATABASE",
            "USE ",
            "DELIMITER",
        )
        return not any(upper.startswith(prefix) for prefix in skip_prefixes)

    def _collect_statement(self, first_line: str, iterator: Iterator[str]) -> str:
        parts = [first_line]
        while not parts[-1].rstrip().endswith(";"):
            try:
                parts.append(next(iterator))
            except StopIteration:
                break
        return "".join(parts)

    def _transform_create(self, statement: str) -> Tuple[Optional[str], List[str]]:
        match = CREATE_TABLE_PATTERN.search(statement)
        if not match:
            return statement.strip(), []

        table = match.group(1)
        table_lower = table.lower()
        allowlist = self.column_allowlists.get(table_lower)
        open_paren = match.end() - 1
        close_paren = statement.rfind(")")
        if close_paren <= open_paren:
            return statement.strip(), []

        inner_section = statement[open_paren + 1 : close_paren]
        definitions = _split_definitions(inner_section)

        column_defs: Dict[str, Tuple[str, str, bool]] = {}
        column_order: List[str] = []
        constraint_defs: List[str] = []
        index_defs: List[str] = []

        for definition in definitions:
            if not definition:
                continue
            cleaned = definition.strip().rstrip(",")
            upper = cleaned.upper()

            if upper.startswith("PRIMARY KEY") or upper.startswith("CONSTRAINT"):
                constraint_defs.append(cleaned)
                continue

            if upper.startswith("UNIQUE KEY") or upper.startswith("KEY") or upper.startswith("FULLTEXT KEY"):
                index_defs.append(cleaned)
                continue

            column_name, column_stmt, is_autoinc = self._convert_column_definition(cleaned)
            key = column_name.lower()
            column_defs[key] = (column_name, column_stmt, is_autoinc)
            column_order.append(column_name)

        self.original_columns[table_lower] = column_order
        self.original_column_lookup[table_lower] = {name.lower(): name for name in column_order}

        if not column_defs:
            return None, []

        selected_columns: List[str] = []
        autoinc_columns: set[str] = set()

        if allowlist:
            kept_names: List[str] = []
            for requested in allowlist:
                key = requested.lower()
                if key not in column_defs:
                    raise ValueError(f"Column '{requested}' not found in table '{table}'")
                column_name, column_stmt, is_autoinc = column_defs[key]
                selected_columns.append(f"  {column_stmt}")
                kept_names.append(column_name)
                if is_autoinc:
                    autoinc_columns.add(column_name)
        else:
            for column_name in column_order:
                _, column_stmt, is_autoinc = column_defs[column_name.lower()]
                selected_columns.append(f"  {column_stmt}")
                if is_autoinc:
                    autoinc_columns.add(column_name)
            kept_names = column_order.copy()

        if allowlist and self.extras_column:
            if self.extras_column.lower() in {name.lower() for name in kept_names}:
                raise ValueError("Extras column name conflicts with existing column")
            selected_columns.append(f"  `{self.extras_column}` TEXT")
            self.tables_with_extras.add(table_lower)

        constraint_lines: List[str] = []
        kept_set = {name.lower() for name in kept_names}
        for constraint in constraint_defs:
            referenced = _extract_constraint_columns(constraint)
            if referenced and len(referenced) == 1 and referenced[0] in autoinc_columns and constraint.upper().startswith("PRIMARY KEY"):
                continue
            if allowlist and not all(col.lower() in kept_set for col in referenced):
                continue
            constraint_lines.append(f"  {constraint}")

        body_parts = selected_columns + constraint_lines
        if not body_parts:
            return None, []

        body = ",\n".join(body_parts)
        create_stmt = f"CREATE TABLE IF NOT EXISTS `{table}` (\n{body}\n);"

        indexes: List[str] = []
        if not allowlist:
            for index_def in index_defs:
                index_stmt = self._convert_index_definition(table, index_def)
                if index_stmt:
                    indexes.append(index_stmt)

        self.kept_columns[table_lower] = kept_names
        return create_stmt, indexes

    def _convert_index_definition(self, table: str, definition: str) -> Optional[str]:
        without_using = KEY_USING_PATTERN.sub("", definition)
        match = re.match(
            r"(UNIQUE|FULLTEXT)?\s*KEY\s+`?([^`]+)`?\s*\((.+)\)",
            without_using,
            re.IGNORECASE,
        )
        if not match:
            return None

        kind, raw_name, columns = match.groups()
        is_unique = bool(kind and kind.upper() == "UNIQUE")
        index_name = raw_name
        if not raw_name.lower().startswith(table.lower()):
            index_name = f"{table}_{raw_name}"
        prefix = "UNIQUE " if is_unique else ""
        return f"CREATE {prefix}INDEX IF NOT EXISTS `{index_name}` ON `{table}` ({columns});"

    def _convert_column_definition(self, definition: str) -> Tuple[str, str, bool]:
        match = re.match(r"`?([^`\s]+)`?\s+(.*)", definition, re.DOTALL)
        if not match:
            return definition, definition, False

        column, remainder = match.groups()
        upper = remainder.upper()
        if "AUTO_INCREMENT" in upper:
            return column, f"`{column}` INTEGER PRIMARY KEY AUTOINCREMENT", True

        normalized = re.sub(r"\bAUTO_INCREMENT\b", "", remainder, flags=re.IGNORECASE)
        normalized = re.sub(r"\s+UNSIGNED\b", "", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\s+CHARACTER\s+SET\s+\w+", "", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\s+COLLATE\s+\w+", "", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\s+COMMENT\s+'[^']*'", "", normalized, flags=re.IGNORECASE)
        normalized = " ".join(normalized.split())
        return column, f"`{column}` {normalized}", False

    def _normalize_insert(self, table: str, statement: str) -> Optional[str | List[str]]:
        sanitized = BINARY_ZERO_PATTERN.sub("0", statement)
        sanitized = BINARY_ONE_PATTERN.sub("1", sanitized)
        sanitized = BIT_LITERAL_PATTERN.sub(lambda match: match.group(1), sanitized)
        sanitized = sanitized.replace("\\'", "''")
        table_lower = table.lower()
        if table_lower in self.column_allowlists:
            return self._rewrite_insert_with_allowlist(table, sanitized.strip())
        return sanitized.strip()

    def _rewrite_insert_with_allowlist(self, table: str, statement: str) -> Optional[List[str]]:
        parsed = _parse_insert_components(statement)
        if not parsed:
            return [statement]

        parsed_table, column_names, rows = parsed
        table_lower = table.lower()
        if parsed_table.lower() != table_lower:
            return [statement]

        if not rows:
            return None

        original_columns = self.original_columns.get(table_lower)
        kept_columns = self.kept_columns.get(table_lower)
        if not original_columns or not kept_columns:
            return [statement]

        columns_for_insert = column_names or original_columns
        canonical_columns = [self._canonical_column_name(table_lower, name) for name in columns_for_insert]
        extras_enabled = table_lower in self.tables_with_extras and self.extras_column is not None
        kept_set = {name.lower() for name in kept_columns}

        column_clause = ", ".join(f"`{name}`" for name in kept_columns)
        if extras_enabled:
            column_clause = f"{column_clause}, `{self.extras_column}`"

        insert_statements: List[str] = []
        for row in rows:
            row_map: Dict[str, str] = {}
            for idx, column in enumerate(canonical_columns):
                value = row[idx] if idx < len(row) else "NULL"
                row_map[column] = value if value else "NULL"

            ordered_values = [row_map.get(name, "NULL") for name in kept_columns]

            if extras_enabled:
                extras_payload = {
                    column: _sql_literal_to_python(value)
                    for column, value in row_map.items()
                    if column.lower() not in kept_set
                }
                extras_literal = _json_to_sql_literal(extras_payload) if extras_payload else "NULL"
                ordered_values.append(extras_literal)

            values_sql = ", ".join(ordered_values)
            insert_statements.append(f"INSERT INTO `{table}` ({column_clause}) VALUES ({values_sql})")

        return insert_statements


def _split_definitions(section: str) -> List[str]:
    definitions: List[str] = []
    current: List[str] = []
    depth = 0
    quote: Optional[str] = None
    escape_next = False

    for char in section:
        if quote:
            current.append(char)
            if escape_next:
                escape_next = False
            elif char == "\\":
                escape_next = True
            elif char == quote:
                quote = None
            continue

        if char in {'"', "'", "`"}:
            quote = char
            current.append(char)
            continue

        if char == "(":
            depth += 1
            current.append(char)
            continue

        if char == ")":
            depth = max(depth - 1, 0)
            current.append(char)
            continue

        if char == "," and depth == 0:
            definitions.append("".join(current).strip())
            current = []
            continue

        current.append(char)

    tail = "".join(current).strip()
    if tail:
        definitions.append(tail)
    return definitions


def _extract_constraint_columns(definition: str) -> List[str]:
    match = re.search(r"\((.+)\)", definition)
    if not match:
        return []
    columns = []
    raw = match.group(1)
    for token in raw.split(","):
        cleaned = token.strip().strip("`")
        if cleaned:
            columns.append(cleaned)
    return columns


def _parse_insert_components(statement: str) -> Optional[Tuple[str, Optional[List[str]], List[List[str]]]]:
    stripped = statement.strip().rstrip(";")
    match = re.match(r"INSERT\s+INTO\s+`?([^`\s]+)`?\s*(.*)", stripped, re.IGNORECASE | re.DOTALL)
    if not match:
        return None

    table = match.group(1)
    remainder = match.group(2)
    values_match = re.search(r"\bVALUES\b", remainder, re.IGNORECASE)
    if not values_match:
        return None

    columns_segment = remainder[: values_match.start()].strip()
    values_segment = remainder[values_match.end():].strip()

    columns: Optional[List[str]] = None
    if columns_segment:
        if not columns_segment.startswith("(") or not columns_segment.endswith(")"):
            return None
        inner = columns_segment[1:-1]
        columns = _split_identifier_list(inner)

    rows = _parse_values_section(values_segment.rstrip(";"))
    return table, columns, rows


def _split_identifier_list(section: str) -> List[str]:
    identifiers: List[str] = []
    current: List[str] = []
    quote: Optional[str] = None
    escape_next = False

    for char in section:
        if quote:
            current.append(char)
            if escape_next:
                escape_next = False
            elif char == "\\":
                escape_next = True
            elif char == quote:
                quote = None
            continue

        if char in {'"', "'", '`'}:
            quote = char
            current.append(char)
            continue

        if char == ",":
            token = _strip_identifier("".join(current))
            if token:
                identifiers.append(token)
            current = []
            continue

        current.append(char)

    token = _strip_identifier("".join(current))
    if token:
        identifiers.append(token)
    return identifiers


def _strip_identifier(token: str) -> str:
    token = token.strip()
    if token.startswith("`") and token.endswith("`"):
        return token[1:-1]
    if token.startswith("\"") and token.endswith("\""):
        return token[1:-1]
    return token


def _parse_values_section(section: str) -> List[List[str]]:
    rows: List[List[str]] = []
    length = len(section)
    i = 0

    while i < length:
        char = section[i]
        if char.isspace() or char == ",":
            i += 1
            continue
        if char != "(":
            i += 1
            continue

        i += 1
        depth = 1
        value_chars: List[str] = []
        row: List[str] = []
        quote: Optional[str] = None
        escape_next = False

        while i < length and depth > 0:
            char = section[i]
            if quote:
                value_chars.append(char)
                if escape_next:
                    escape_next = False
                elif char == "\\":
                    escape_next = True
                elif char == quote:
                    quote = None
                i += 1
                continue

            if char in {'"', "'"}:
                quote = char
                value_chars.append(char)
                i += 1
                continue

            if char == "(":
                depth += 1
                value_chars.append(char)
                i += 1
                continue

            if char == ")":
                depth -= 1
                if depth == 0:
                    row.append("".join(value_chars).strip())
                    value_chars = []
                    i += 1
                    break
                value_chars.append(char)
                i += 1
                continue

            if char == "," and depth == 1:
                row.append("".join(value_chars).strip())
                value_chars = []
                i += 1
                continue

            value_chars.append(char)
            i += 1

        if value_chars:
            row.append("".join(value_chars).strip())
        rows.append(row)

    return rows


def _sql_literal_to_python(token: str):
    stripped = token.strip()
    if not stripped or stripped.upper() == "NULL":
        return None
    if stripped.startswith("'") and stripped.endswith("'"):
        inner = stripped[1:-1]
        return inner.replace("''", "'")
    if stripped.startswith('"') and stripped.endswith('"'):
        inner = stripped[1:-1]
        return inner.replace('""', '"')
    if stripped.upper() in {"TRUE", "FALSE"}:
        return stripped.upper() == "TRUE"
    try:
        if "." in stripped:
            return float(stripped)
        return int(stripped)
    except ValueError:
        return stripped


def _json_to_sql_literal(value) -> str:
    if value is None:
        return "NULL"
    json_text = json.dumps(value, ensure_ascii=False)
    escaped = json_text.replace("'", "''")
    return f"'{escaped}'"


def chunked(iterable: Sequence[str], size: int) -> Iterator[Sequence[str]]:
    for index in range(0, len(iterable), size):
        yield iterable[index : index + size]


def write_schema(statements: Sequence[str], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n\n".join(stmt.rstrip(";") + ";" for stmt in statements)
    path.write_text(content + "\n", encoding="utf-8")


def write_data(statements: Sequence[str], directory: Path, chunk_size: int) -> List[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    files: List[Path] = []
    for index, chunk in enumerate(chunked(statements, max(chunk_size, 1)), start=1):
        target = directory / f"chunk-{index:03}.sql"
        with target.open("w", encoding="utf-8") as handle:
            for stmt in chunk:
                handle.write(stmt.rstrip(";") + ";\n")
        files.append(target)
    return files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", "-i", type=Path, required=True, help="Path to the MySQL dump file")
    parser.add_argument(
        "--out-dir",
        "-o",
        type=Path,
        default=Path("d1-output"),
        help="Directory that will receive schema.sql and data chunks",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=250,
        help="Number of INSERT statements per chunk file (default: 250)",
    )
    parser.add_argument(
        "--table",
        dest="only_tables",
        action="append",
        help="Restrict conversion to specific tables (repeatable)",
    )
    parser.add_argument(
        "--skip-table",
        dest="skip_tables",
        action="append",
        help="Tables to drop during conversion (repeatable)",
    )
    parser.add_argument(
        "--schema-name",
        default="schema.sql",
        help="File name for the schema output (default: schema.sql)",
    )
    parser.add_argument(
        "--column-allowlist",
        action="append",
        dest="column_allowlists",
        help="Limit columns for a table and rewrite INSERTs. Format: table:col1,col2",
    )
    parser.add_argument(
        "--extras-column",
        help="Optional column name to store trimmed values as JSON when using allowlists",
    )
    return parser.parse_args()


def build_allowlist_mapping(raw_values: Optional[Sequence[str]]) -> Dict[str, List[str]]:
    mapping: Dict[str, List[str]] = {}
    if not raw_values:
        return mapping

    for raw in raw_values:
        if ":" not in raw:
            raise ValueError("Allowlist entries must use the format table:col1,col2")
        table, columns = raw.split(":", 1)
        table = table.strip()
        if not table:
            raise ValueError("Table name in allowlist cannot be empty")
        column_list = [col.strip() for col in columns.split(",") if col.strip()]
        if not column_list:
            raise ValueError(f"No columns specified for allowlist table '{table}'")
        table_key = table.lower()
        if table_key in mapping:
            raise ValueError(f"Allowlist already defined for table '{table}'")
        mapping[table_key] = column_list

    return mapping


def main() -> None:
    args = parse_args()
    try:
        column_allowlists = build_allowlist_mapping(args.column_allowlists)
    except ValueError as error:
        raise SystemExit(str(error))

    converter = DumpConverter(
        args.input,
        args.only_tables,
        args.skip_tables,
        column_allowlists=column_allowlists,
        extras_column=args.extras_column,
    )
    schema_statements, data_statements = converter.convert()

    schema_path = args.out_dir / args.schema_name
    write_schema(schema_statements, schema_path)
    data_dir = args.out_dir / "data"
    chunk_files = write_data(data_statements, data_dir, args.chunk_size)

    print(f"Wrote schema to {schema_path}")
    if chunk_files:
        print(f"Created {len(chunk_files)} data chunk(s) under {data_dir}")
    else:
        print("No INSERT statements were found; skipping data chunks.")


if __name__ == "__main__":
    main()
