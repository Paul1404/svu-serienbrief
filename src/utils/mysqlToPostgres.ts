/**
 * Convert MySQL dump to Postgres-compatible SQL.
 * Port of D1-Import-SQL/tools/mysql_to_d1.py logic, outputting directly for Postgres.
 * No chunking - executes all statements in sequence.
 */

// Config from d1-import.config.json (adresse -> auswertung mapping)
const COLUMN_ALLOWLISTS: Record<string, string[]> = {
	adresse: [
		'AdrNr', 'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort', 'Telefon1', 'Telefon3',
		'Geburtsdatum', 'Eintritt', 'Austritt', 'mandatsrefenz', 'IBAN1', 'BIC1', 'Bank1',
		'Anrede', 'Firma1', 'LKZ', 'Aktiv', 'Mitglied'
	]
};

// Map source table adresse -> target table auswertung with column mapping
// Only columns that exist in auswertung (migrations/001_init_core_tables.sql)
const TARGET_TABLE = 'auswertung';
const COLUMN_MAPPING: Record<string, string> = {
	AdrNr: 'AdrNr',
	Mitglied: 'MitglNr',
	Anrede: 'Anrede',
	Vorname: 'Vorname',
	Nachname: 'Nachname',
	Strasse: 'Strasse',
	PLZ: 'PLZ',
	Ort: 'Ort',
	Telefon1: 'Telefon',
	Telefon3: 'Mobil',
	Geburtsdatum: 'Geburtsdatum',
	Eintritt: 'Eintritt',
	IBAN1: 'IBAN',
	BIC1: 'BIC',
	Bank1: 'Bankbezeichnung'
};

const SKIP_TABLES = new Set(['einst', 'f5bew4', 'f5bw4sa', 'f5bw4sga', 'f5kont', 'f6kost', 'rechn']);

const CREATE_TABLE_RE = /CREATE\s+TABLE\s+`?([^`\s]+)`?\s*\(/gi;
const DROP_TABLE_RE = /DROP\s+TABLE\s+IF\s+EXISTS\s+`?([^`\s]+)`?/gi;
const INSERT_RE = /INSERT\s+INTO\s+`?([^`\s]+)`?/gi;
const KEY_USING_RE = /USING\s+\w+/gi;
const BINARY_ZERO_RE = /_binary\s+'\\0'/gi;
const BINARY_ONE_RE = /_binary\s+'\\1'/gi;
const BIT_LITERAL_RE = /\bb'([01])'/gi;

export interface ConvertResult {
	schemaStatements: string[];
	dataStatements: string[];
}

export function convertMysqlDumpToPostgres(content: string): ConvertResult {
	const lines = content.split(/\r?\n/);
	const schemaStatements: string[] = [];
	const dataStatements: string[] = [];

	let i = 0;
	let inBlockComment = false;

	const originalColumns: Record<string, string[]> = {};
	const originalColumnLookup: Record<string, Record<string, string>> = {};
	const keptColumns: Record<string, string[]> = {};

	while (i < lines.length) {
		const rawLine = lines[i];
		if (!shouldProcessLine(rawLine, { inBlockComment: () => inBlockComment, set: (v) => { inBlockComment = v; } })) {
			i++;
			continue;
		}

		const strippedUpper = rawLine.trimStart().toUpperCase();

		if (strippedUpper.startsWith('DROP TABLE')) {
			const statement = collectStatement(lines, i);
			i += statement.lineCount;
			const table = matchTableName(DROP_TABLE_RE, statement.text);
			if (table && !tableInScope(table)) continue;
			// Postgres uses double quotes; MySQL uses backticks
			schemaStatements.push(statement.text.trim().replace(/`/g, '"'));
			continue;
		}

		if (strippedUpper.startsWith('CREATE TABLE')) {
			const statement = collectStatement(lines, i);
			i += statement.lineCount;
			const table = matchTableName(CREATE_TABLE_RE, statement.text);
			if (table && !tableInScope(table)) continue;

			const result = transformCreate(statement.text, table!, originalColumns, originalColumnLookup, keptColumns);
			if (result.createStmt) schemaStatements.push(result.createStmt);
			schemaStatements.push(...result.indexStmts);
			continue;
		}

		if (strippedUpper.startsWith('INSERT INTO')) {
			const statement = collectStatement(lines, i);
			i += statement.lineCount;
			const table = matchTableName(INSERT_RE, statement.text);
			if (table && !tableInScope(table)) continue;

			const normalized = normalizeInsert(table!, statement.text, originalColumns, originalColumnLookup, keptColumns);
			if (normalized) dataStatements.push(...normalized);
			continue;
		}

		i++;
	}

	if (dataStatements.length > 0) {
		dataStatements.unshift(`TRUNCATE TABLE "${TARGET_TABLE}";`);
	}

	return { schemaStatements, dataStatements };
}

function tableInScope(table: string): boolean {
	const name = table.toLowerCase();
	if (SKIP_TABLES.has(name)) return false;
	if (!COLUMN_ALLOWLISTS.adresse) return true;
	return name === 'adresse';
}

function shouldProcessLine(
	line: string,
	ctx: { inBlockComment: () => boolean; set: (v: boolean) => void }
): boolean {
	const stripped = line.trim();
	if (!stripped) return false;
	if (ctx.inBlockComment()) {
		if (stripped.includes('*/')) ctx.set(false);
		return false;
	}
	if (stripped.startsWith('/*')) {
		if (!stripped.endsWith('*/')) ctx.set(true);
		return false;
	}
	if (stripped.startsWith('--') || stripped.startsWith('#')) return false;
	if (stripped.startsWith('/*!')) {
		if (!stripped.includes('*/')) ctx.set(true);
		return false;
	}
	const upper = stripped.toUpperCase();
	const skip = ['LOCK TABLES', 'UNLOCK TABLES', 'ALTER TABLE', 'SET ', 'CREATE DATABASE', 'USE ', 'DELIMITER'];
	return !skip.some(p => upper.startsWith(p));
}

function collectStatement(lines: string[], start: number): { text: string; lineCount: number } {
	const parts: string[] = [];
	let i = start;
	while (i < lines.length) {
		parts.push(lines[i]);
		if (lines[i].trimEnd().endsWith(';')) break;
		i++;
	}
	return { text: parts.join('\n'), lineCount: i - start + 1 };
}

function matchTableName(re: RegExp, statement: string): string | null {
	re.lastIndex = 0;
	const m = re.exec(statement);
	return m ? m[1] : null;
}

function splitDefinitions(section: string): string[] {
	const definitions: string[] = [];
	let current: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let escapeNext = false;

	for (let j = 0; j < section.length; j++) {
		const c = section[j];
		if (quote) {
			current.push(c);
			if (escapeNext) escapeNext = false;
			else if (c === '\\') escapeNext = true;
			else if (c === quote) quote = null;
			continue;
		}
		if (['"', "'", '`'].includes(c)) {
			quote = c;
			current.push(c);
			continue;
		}
		if (c === '(') { depth++; current.push(c); continue; }
		if (c === ')') { depth = Math.max(depth - 1, 0); current.push(c); continue; }
		if (c === ',' && depth === 0) {
			definitions.push(current.join('').trim());
			current = [];
			continue;
		}
		current.push(c);
	}
	const tail = current.join('').trim();
	if (tail) definitions.push(tail);
	return definitions;
}

function extractConstraintColumns(def: string): string[] {
	const m = def.match(/\((.+)\)/);
	if (!m) return [];
	return m[1].split(',').map(t => t.trim().replace(/^`|`$/g, '')).filter(Boolean);
}

function transformCreate(
	statement: string,
	table: string,
	originalColumns: Record<string, string[]>,
	originalColumnLookup: Record<string, Record<string, string>>,
	keptColumns: Record<string, string[]>
): { createStmt: string | null; indexStmts: string[] } {
	const tableLower = table.toLowerCase();
	const allowlist = tableLower === 'adresse' ? COLUMN_ALLOWLISTS.adresse : null;

	const openParen = statement.indexOf('(');
	const closeParen = statement.lastIndexOf(')');
	if (closeParen <= openParen) return { createStmt: statement.trim(), indexStmts: [] };

	const inner = statement.slice(openParen + 1, closeParen);
	const definitions = splitDefinitions(inner);

	const columnDefs: Record<string, { stmt: string; isAutoInc: boolean }> = {};
	const columnOrder: string[] = [];
	const constraintDefs: string[] = [];
	const indexDefs: string[] = [];

	for (const def of definitions) {
		if (!def) continue;
		const cleaned = def.trim().replace(/,$/, '');
		const upper = cleaned.toUpperCase();

		if (upper.startsWith('PRIMARY KEY') || upper.startsWith('CONSTRAINT')) {
			constraintDefs.push(cleaned);
			continue;
		}
		if (upper.startsWith('UNIQUE KEY') || upper.startsWith('KEY') || upper.startsWith('FULLTEXT KEY')) {
			indexDefs.push(cleaned);
			continue;
		}

		const { columnName, columnStmt, isAutoInc } = convertColumnDef(cleaned);
		columnDefs[columnName.toLowerCase()] = { stmt: columnStmt, isAutoInc };
		columnOrder.push(columnName);
	}

	originalColumns[tableLower] = columnOrder;
	originalColumnLookup[tableLower] = Object.fromEntries(columnOrder.map(n => [n.toLowerCase(), n]));

	const selectedColumns: string[] = [];
	const autoIncColumns = new Set<string>();

	if (allowlist) {
		for (const req of allowlist) {
			const key = req.toLowerCase();
			if (!(key in columnDefs)) continue;
			const { isAutoInc } = columnDefs[key];
			const targetCol = COLUMN_MAPPING[req] || req;
			// auswertung uses TEXT for all columns (per migration schema)
			selectedColumns.push(`  "${targetCol}" TEXT`);
			if (isAutoInc) autoIncColumns.add(req);
		}
		keptColumns[tableLower] = allowlist.map(c => COLUMN_MAPPING[c] || c);
	} else {
		for (const col of columnOrder) {
			const { stmt } = columnDefs[col.toLowerCase()];
			selectedColumns.push('  ' + stmt.replace(/`/g, '"'));
		}
		keptColumns[tableLower] = columnOrder;
	}

	const keptSet = new Set(keptColumns[tableLower].map(c => c.toLowerCase()));
	const constraintLines: string[] = [];
	if (tableLower === 'adresse') {
		// auswertung: AdrNr is primary key
		constraintLines.push('  PRIMARY KEY ("AdrNr")');
	} else {
		for (const c of constraintDefs) {
			const refs = extractConstraintColumns(c);
			if (refs.length === 1 && autoIncColumns.has(refs[0]) && c.toUpperCase().startsWith('PRIMARY KEY')) continue;
			if (allowlist && refs.some(r => !keptSet.has(r.toLowerCase()))) continue;
			constraintLines.push('  ' + c.replace(/`/g, '"'));
		}
	}

	const body = [...selectedColumns, ...constraintLines].join(',\n');
	const targetTable = tableLower === 'adresse' ? TARGET_TABLE : table;
	const createStmt = `CREATE TABLE IF NOT EXISTS "${targetTable}" (\n${body}\n);`;

	return { createStmt, indexStmts: [] };
}

function convertColumnDef(definition: string): { columnName: string; columnStmt: string; isAutoInc: boolean } {
	const m = definition.match(/`?([^`\s]+)`?\s+(.*)/s);
	if (!m) return { columnName: definition, columnStmt: definition, isAutoInc: false };

	const column = m[1];
	const remainder = m[2];
	const upper = remainder.toUpperCase();

	if (upper.includes('AUTO_INCREMENT')) {
		return { columnName: column, columnStmt: `"${column}" BIGSERIAL PRIMARY KEY`, isAutoInc: true };
	}

	let norm = remainder.replace(/\bAUTO_INCREMENT\b/gi, '');
	norm = norm.replace(/\s+UNSIGNED\b/gi, '');
	norm = norm.replace(/\s+CHARACTER\s+SET\s+\w+/gi, '');
	norm = norm.replace(/\s+COLLATE\s+\w+/gi, '');
	norm = norm.replace(/\s+COMMENT\s+'[^']*'/gi, '');
	norm = norm.replace(/\s+/g, ' ').trim();

	return { columnName: column, columnStmt: `"${column}" ${norm}`, isAutoInc: false };
}

function normalizeInsert(
	table: string,
	statement: string,
	originalColumns: Record<string, string[]>,
	originalColumnLookup: Record<string, Record<string, string>>,
	keptColumns: Record<string, string[]>
): string[] | null {
	let s = statement.replace(BINARY_ZERO_RE, '0').replace(BINARY_ONE_RE, '1');
	s = s.replace(BIT_LITERAL_RE, '$1');
	s = s.replace(/\\'/g, "''");
	s = s.trim();

	const tableLower = table.toLowerCase();
	if (tableLower !== 'adresse') return [s];

	const parsed = parseInsertComponents(s);
	if (!parsed) return [s];

	const [, columnNames, rows] = parsed;
	if (!rows.length) return null;

	const origCols = originalColumns[tableLower];
	const kept = keptColumns[tableLower];
	const lookup = originalColumnLookup[tableLower];
	if (!origCols || !kept || !lookup) return [s];

	const columnsForInsert = columnNames || origCols;
	const canonicalCols = columnsForInsert.map((c: string) => lookup[c.toLowerCase()] || c);

	// Target column -> source column (for mapping adresse -> auswertung)
	const targetToSource: Record<string, string> = {};
	for (const [src, tgt] of Object.entries(COLUMN_MAPPING)) {
		targetToSource[tgt] = src;
	}

	const targetCols = kept.map(c => `"${c}"`);
	const inserts: string[] = [];

	for (const row of rows) {
		const rowMap: Record<string, string> = {};
		canonicalCols.forEach((col: string, idx: number) => {
			const val = row[idx] ?? 'NULL';
			rowMap[col] = val || 'NULL';
		});

		const orderedValues: string[] = [];
		for (const targetCol of kept) {
			const sourceCol = targetToSource[targetCol] || targetCol;
			orderedValues.push(rowMap[sourceCol] ?? 'NULL');
		}

		inserts.push(`INSERT INTO "${TARGET_TABLE}" (${targetCols.join(', ')}) VALUES (${orderedValues.join(', ')})`);
	}

	return inserts;
}

function parseInsertComponents(statement: string): [string, string[] | null, string[][]] | null {
	const stripped = statement.trim().replace(/;\s*$/, '');
	const m = stripped.match(/INSERT\s+INTO\s+`?([^`\s]+)`?\s*(.*)/is);
	if (!m) return null;

	const table = m[1];
	const remainder = m[2];
	const valuesIdx = remainder.search(/\bVALUES\b/i);
	if (valuesIdx < 0) return null;

	const columnsSegment = remainder.slice(0, valuesIdx).trim();
	const valuesSegment = remainder.slice(valuesIdx + 6).trim();

	let columns: string[] | null = null;
	if (columnsSegment && columnsSegment.startsWith('(') && columnsSegment.endsWith(')')) {
		columns = splitIdentifierList(columnsSegment.slice(1, -1));
	}

	const rows = parseValuesSection(valuesSegment.replace(/;\s*$/, ''));
	return [table, columns, rows];
}

function splitIdentifierList(section: string): string[] {
	return splitByComma(section).map(t => t.replace(/^`|`$/g, '').replace(/^"|"$/g, ''));
}

function splitByComma(section: string): string[] {
	const result: string[] = [];
	let current: string[] = [];
	let quote: string | null = null;
	let depth = 0;

	for (let i = 0; i < section.length; i++) {
		const c = section[i];
		if (quote) {
			current.push(c);
			if (c === quote) quote = null;
			continue;
		}
		if (['"', "'", '`'].includes(c)) {
			quote = c;
			current.push(c);
			continue;
		}
		if (c === '(') { depth++; current.push(c); continue; }
		if (c === ')') { depth--; current.push(c); continue; }
		if (c === ',' && depth === 0) {
			result.push(current.join('').trim());
			current = [];
			continue;
		}
		current.push(c);
	}
	const tail = current.join('').trim();
	if (tail) result.push(tail);
	return result;
}

function parseValuesSection(section: string): string[][] {
	const rows: string[][] = [];
	let i = 0;

	while (i < section.length) {
		while (i < section.length && (/\s/.test(section[i]) || section[i] === ',')) i++;
		if (i >= section.length) break;
		if (section[i] !== '(') {
			i++;
			continue;
		}

		i++;
		let depth = 1;
		let valueChars: string[] = [];
		const row: string[] = [];
		let quote: string | null = null;

		while (i < section.length && depth > 0) {
			const c = section[i];
			if (quote) {
				valueChars.push(c);
				// Escaped quote: '' or ""
				if (c === quote && section[i + 1] === quote) {
					i++;
					continue;
				}
				if (c === quote) quote = null;
				i++;
				continue;
			}
			if (c === '"' || c === "'") {
				quote = c;
				valueChars.push(c);
				i++;
				continue;
			}
			if (c === '(') {
				depth++;
				valueChars.push(c);
				i++;
				continue;
			}
			if (c === ')') {
				depth--;
				if (depth === 0) {
					row.push(valueChars.join('').trim());
					i++;
					break;
				}
				valueChars.push(c);
				i++;
				continue;
			}
			if (c === ',' && depth === 1) {
				row.push(valueChars.join('').trim());
				valueChars = [];
				i++;
				continue;
			}
			valueChars.push(c);
			i++;
		}
		if (valueChars.length) row.push(valueChars.join('').trim());
		rows.push(row);
	}

	return rows;
}