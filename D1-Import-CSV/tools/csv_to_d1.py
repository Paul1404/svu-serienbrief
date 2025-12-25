#!/usr/bin/env python3
"""Convert a CSV file into Cloudflare D1-friendly SQL artifacts.

Usage (with uv):
    uv run python tools/csv_to_d1.py \
        --input linear-in/Auswertungsgenerator.CSV \
        --out-dir d1-output

The script creates schema and data statements that can be loaded via
`wrangler d1 execute --file`. It infers column types from CSV data,
handles semicolon delimiters, and splits INSERT batches into chunks.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


class CSVConverter:
    """Convert CSV file to D1-compatible SQL schema and data."""

    def __init__(
        self,
        input_path: Path,
        table_name: str = "auswertung",
        chunk_size: int = 50,
        column_allowlist: Optional[Sequence[str]] = None,
    ) -> None:
        self.input_path = input_path
        self.table_name = table_name
        self.chunk_size = chunk_size
        self.column_allowlist = [c.lower() for c in column_allowlist] if column_allowlist else None
        self.all_columns: List[str] = []
        self.column_types: Dict[str, str] = {}
        self.kept_columns: List[str] = []

    def convert(self) -> Tuple[List[str], List[str]]:
        """Convert CSV to schema and data statements."""
        rows = self._read_csv()
        
        if not rows:
            return [], []

        # Determine which columns to keep
        if self.column_allowlist:
            allowlist_set = set(self.column_allowlist)
            self.kept_columns = [col for col in self.all_columns if col.lower() in allowlist_set]
        else:
            self.kept_columns = self.all_columns.copy()

        if not self.kept_columns:
            raise ValueError("No columns to keep after applying allowlist")

        # Infer column types from data
        self._infer_types(rows)

        # Generate schema
        schema_statements = self._create_schema()

        # Generate data inserts
        data_statements = self._create_inserts(rows)

        return schema_statements, data_statements

    def _read_csv(self) -> List[Dict[str, str]]:
        """Read CSV file with semicolon delimiter and return rows."""
        rows: List[Dict[str, str]] = []
        
        # Try to detect encoding, common for German text files
        encoding = self._detect_encoding()
        
        with self.input_path.open("r", encoding=encoding) as f:
            # Try to detect delimiter
            first_line = f.readline()
            f.seek(0)
            
            delimiter = ";" if ";" in first_line else ","
            
            reader = csv.DictReader(f, delimiter=delimiter)
            raw_fieldnames = [col for col in (reader.fieldnames or []) if col and col.strip()]
            
            # Normalize column names and handle duplicates
            normalized_columns: List[str] = []
            seen_columns: Dict[str, int] = {}
            
            for col in raw_fieldnames:
                normalized = self._normalize_column_name(col)
                if normalized in seen_columns:
                    seen_columns[normalized] += 1
                    normalized = f"{normalized}_{seen_columns[normalized]}"
                else:
                    seen_columns[normalized] = 0
                normalized_columns.append(normalized)
            
            self.all_columns = normalized_columns
            
            # Create mapping from original to normalized names
            column_mapping = {raw_fieldnames[i]: normalized_columns[i] for i in range(len(raw_fieldnames))}
            
            for row in reader:
                # Normalize column names in row data, skip empty columns
                normalized_row = {
                    column_mapping[k]: v.strip() if v else ""
                    for k, v in row.items()
                    if k in column_mapping
                }
                rows.append(normalized_row)

        return rows

    def _detect_encoding(self) -> str:
        """Detect file encoding, defaulting to common encodings for German text."""
        # Try different encodings in order of likelihood for German text
        encodings = ['utf-8', 'iso-8859-1', 'cp1252', 'latin-1']
        
        for encoding in encodings:
            try:
                with self.input_path.open("r", encoding=encoding) as f:
                    f.read(1024)  # Try to read first 1KB
                return encoding
            except (UnicodeDecodeError, LookupError):
                continue
        
        # Fallback to ISO-8859-1 which is most common for German CSV exports
        return 'iso-8859-1'

    def _normalize_column_name(self, name: str) -> str:
        """Normalize column name for SQL compatibility, converting umlauts to ASCII."""
        # Replace German umlauts with ASCII equivalents
        umlaut_map = {
            'ä': 'ae', 'ö': 'oe', 'ü': 'ue',
            'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
            'ß': 'ss'
        }
        normalized = name
        for umlaut, replacement in umlaut_map.items():
            normalized = normalized.replace(umlaut, replacement)
        
        # Replace parentheses with nothing
        normalized = normalized.replace('(', '').replace(')', '')
        # Remove any remaining special characters except word chars and spaces
        normalized = re.sub(r'[^\w\s]', '', normalized)
        # Replace spaces with underscores
        normalized = re.sub(r'\s+', '_', normalized.strip())
        # Remove trailing/leading underscores
        normalized = normalized.strip('_')
        # Ensure it starts with a letter or underscore
        if normalized and not (normalized[0].isalpha() or normalized[0] == '_'):
            normalized = 'col_' + normalized
        return normalized or 'column'

    def _infer_types(self, rows: List[Dict[str, str]]) -> None:
        """Infer SQL types for each column based on data."""
        for column in self.kept_columns:
            # Sample values from the column
            values = [row.get(column, "") for row in rows[:100]]
            self.column_types[column] = self._infer_column_type(values)

    def _infer_column_type(self, values: List[str]) -> str:
        """Infer SQL type from sample values."""
        non_empty = [v for v in values if v]
        
        if not non_empty:
            return "TEXT"

        # Check if all are integers
        if all(self._is_integer(v) for v in non_empty):
            return "INTEGER"

        # Check if all are numbers (including floats)
        if all(self._is_number(v) for v in non_empty):
            return "REAL"

        # Check if all are dates
        if all(self._is_date(v) for v in non_empty):
            return "TEXT"  # Store dates as TEXT in SQLite

        # Check if all are booleans
        if all(self._is_boolean(v) for v in non_empty):
            return "INTEGER"  # Store as 0/1

        return "TEXT"

    def _is_integer(self, value: str) -> bool:
        """Check if value is an integer."""
        try:
            int(value)
            return '.' not in value
        except (ValueError, AttributeError):
            return False

    def _is_number(self, value: str) -> bool:
        """Check if value is a number."""
        try:
            float(value.replace(',', '.'))
            return True
        except (ValueError, AttributeError):
            return False

    def _is_date(self, value: str) -> bool:
        """Check if value looks like a date."""
        # Simple date pattern check (DD.MM.YYYY or similar)
        date_pattern = r'^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$'
        return bool(re.match(date_pattern, value))

    def _is_boolean(self, value: str) -> bool:
        """Check if value is boolean-like."""
        return value.lower() in ('true', 'false', '1', '0', 'yes', 'no', 'ja', 'nein')

    def _create_schema(self) -> List[str]:
        """Generate CREATE TABLE statement."""
        column_defs = []
        
        for column in self.kept_columns:
            col_type = self.column_types.get(column, "TEXT")
            column_defs.append(f"  `{column}` {col_type}")

        columns_sql = ",\n".join(column_defs)
        drop_stmt = f"DROP TABLE IF EXISTS `{self.table_name}`;"
        create_stmt = f"CREATE TABLE IF NOT EXISTS `{self.table_name}` (\n{columns_sql}\n);"

        return [drop_stmt, create_stmt]

    def _create_inserts(self, rows: List[Dict[str, str]]) -> List[str]:
        """Generate INSERT statements."""
        statements: List[str] = []
        
        column_clause = ", ".join(f"`{col}`" for col in self.kept_columns)

        for row in rows:
            values = []
            for column in self.kept_columns:
                value = row.get(column, "")
                col_type = self.column_types.get(column, "TEXT")
                
                if not value:
                    values.append("NULL")
                elif col_type == "INTEGER":
                    # Handle boolean conversion
                    if value.lower() in ('true', 'ja', 'yes'):
                        values.append("1")
                    elif value.lower() in ('false', 'nein', 'no'):
                        values.append("0")
                    else:
                        values.append(value)
                elif col_type == "REAL":
                    values.append(value.replace(',', '.'))
                else:
                    # Escape single quotes for SQL
                    escaped = value.replace("'", "''")
                    values.append(f"'{escaped}'")

            values_sql = ", ".join(values)
            statements.append(f"INSERT INTO `{self.table_name}` ({column_clause}) VALUES ({values_sql});")

        return statements


def chunk_statements(statements: List[str], chunk_size: int) -> List[List[str]]:
    """Split statements into chunks."""
    chunks: List[List[str]] = []
    for i in range(0, len(statements), chunk_size):
        chunks.append(statements[i:i + chunk_size])
    return chunks


def write_output(
    schema_statements: List[str],
    data_statements: List[str],
    output_dir: Path,
    chunk_size: int,
) -> None:
    """Write schema and data to output files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write schema
    schema_file = output_dir / "schema.sql"
    with schema_file.open("w", encoding="utf-8") as f:
        f.write("\n".join(schema_statements))
        if schema_statements and not schema_statements[-1].endswith("\n"):
            f.write("\n")
    
    print(f"✅ Schema written to {schema_file}")

    # Write data chunks
    data_dir = output_dir / "data"
    data_dir.mkdir(exist_ok=True)
    
    chunks = chunk_statements(data_statements, chunk_size)
    
    for idx, chunk in enumerate(chunks, start=1):
        chunk_file = data_dir / f"chunk-{idx:03d}.sql"
        with chunk_file.open("w", encoding="utf-8") as f:
            f.write("\n".join(chunk))
            if chunk and not chunk[-1].endswith("\n"):
                f.write("\n")
        print(f"  Chunk {idx}/{len(chunks)}: {len(chunk)} statements → {chunk_file.name}")

    print(f"✅ {len(data_statements)} data statements written in {len(chunks)} chunks")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert CSV to Cloudflare D1 SQL format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input CSV file path",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("d1-output"),
        help="Output directory for SQL files (default: d1-output)",
    )
    parser.add_argument(
        "--table-name",
        type=str,
        default="auswertung",
        help="Name of the table to create (default: auswertung)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=50,
        help="Number of INSERT statements per chunk (default: 50)",
    )
    parser.add_argument(
        "--column-allowlist",
        type=str,
        help="Comma-separated list of columns to keep (default: all columns)",
    )

    args = parser.parse_args()

    if not args.input.exists():
        print(f"❌ Input file not found: {args.input}")
        return

    allowlist = None
    if args.column_allowlist:
        allowlist = [col.strip() for col in args.column_allowlist.split(",")]

    print(f"🔄 Converting {args.input} to D1 format...")
    
    converter = CSVConverter(
        input_path=args.input,
        table_name=args.table_name,
        chunk_size=args.chunk_size,
        column_allowlist=allowlist,
    )

    schema_statements, data_statements = converter.convert()

    if not schema_statements and not data_statements:
        print("❌ No data to convert")
        return

    write_output(schema_statements, data_statements, args.out_dir, args.chunk_size)
    print(f"✅ Conversion complete! Output in {args.out_dir}")


if __name__ == "__main__":
    main()
