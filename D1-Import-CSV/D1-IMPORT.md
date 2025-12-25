# D1 CSV Import Tool

Streamlined CSV → Cloudflare D1 migration for SVU member data.

## Quick Start

**One-command import to local D1:**
```bash
make import-local
```

**One-command import to remote D1:**
```bash
make import-remote
```

## Configuration

Edit `d1-import.config.json` to adjust:
- Input CSV file path
- Table name for the data
- Column allowlist (which fields to keep)
- Chunk sizes for large imports
- Database name

## Available Commands

```bash
make help            # Show all commands
make convert         # Only convert CSV to SQL
make load-local      # Only load to local D1
make load-remote     # Only load to remote D1
make verify          # Check local database
make verify-remote   # Check remote database
make clean           # Remove generated files
```

## Manual Usage

If you prefer the script directly:
```bash
./d1-import.sh import-local   # Full local import
./d1-import.sh verify remote  # Check remote DB
./d1-import.sh help           # Show all options
```

## What It Does

1. **Convert**: Transforms CSV to D1-compatible SQL
   - Reads CSV with semicolon delimiters
   - Normalizes column names for SQL compatibility
   - Infers column types from data (INTEGER, REAL, TEXT)
   - Filters to allowlisted columns (optional)
   - Splits into small chunks to avoid statement size limits
   - Handles special characters and escaping

2. **Load**: Executes schema + data chunks via Wrangler
   - Schema first (CREATE TABLE statement)
   - Then all data chunks sequentially
   - Automatic retry on failure

3. **Verify**: Runs sample queries to confirm import success

## CSV Format

The tool handles:
- Semicolon (`;`) or comma (`,`) delimiters (auto-detected)
- Headers in first row
- Special characters in data (ä, ö, ü, ß, etc.)
- Empty values (converted to NULL)
- Boolean values (True/False, Ja/Nein)
- Dates in various formats
- Numbers with comma decimal separators

## Column Types

The converter automatically infers types:
- **INTEGER**: For whole numbers and booleans
- **REAL**: For decimal numbers
- **TEXT**: For text, dates, and mixed content

## Refreshing Data

When you get a new CSV export:
```bash
# Place it in linear-in/Auswertungsgenerator.CSV (or update config)
make clean
make import-local     # Test locally first
make import-remote    # Promote to production
```

## Files

- `d1-import.config.json` - Configuration (columns, table name, settings)
- `d1-import.sh` - Orchestration script
- `Makefile` - Convenience shortcuts
- `tools/csv_to_d1.py` - Core CSV converter
- `d1-output/` - Generated SQL artifacts (gitignored)
  - `schema.sql` - CREATE TABLE statement
  - `data/chunk-*.sql` - INSERT statements in chunks

## Example Output Structure

```
d1-output/
├── schema.sql              # CREATE TABLE statement
└── data/
    ├── chunk-001.sql       # First 50 records
    ├── chunk-002.sql       # Next 50 records
    └── ...                 # More chunks as needed
```

## Troubleshooting

**Error: "Input file not found"**
- Check that `linear-in/Auswertungsgenerator.CSV` exists
- Verify the path in `d1-import.config.json`

**Error: "Column not found"**
- Check column names in CSV header
- Update `column_allowlist` in config to match actual CSV columns

**Error: "No columns to keep"**
- Ensure column names in allowlist match CSV headers (case-insensitive)
- Or remove `column_allowlist` to import all columns

**Large files**
- Adjust `chunk_size` in config (default: 50 rows per chunk)
- Smaller chunks = more files, but safer for large datasets
