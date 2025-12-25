# D1 Import Tool

Streamlined MySQL → Cloudflare D1 migration for SVU member data.

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
- Column allowlists per table (which fields to keep)
- Skip tables (e.g., financial/accounting tables)
- Chunk sizes for large imports
- Database name

## Available Commands

```bash
make help            # Show all commands
make convert         # Only convert MySQL dump
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

1. **Convert**: Transforms MySQL dump to D1-compatible SQL
   - Filters to allowlisted columns (stays under D1's 200-column limit)
   - Drops specified tables (financial data, etc.)
   - Splits into small chunks to avoid statement size limits
   - Normalizes MySQL-specific syntax (AUTO_INCREMENT, binary literals, etc.)

2. **Load**: Executes schema + data chunks via Wrangler
   - Schema first (CREATE TABLE statements)
   - Then all data chunks sequentially
   - Automatic retry on failure

3. **Verify**: Runs sample queries to confirm import success

## Refreshing Data

When you get a new MySQL dump:
```bash
# Place it in linear-in/datesicherung.sql (or update config)
make clean
make import-local     # Test locally first
make import-remote    # Promote to production
```

## Files

- `d1-import.config.json` - Configuration (columns, tables, settings)
- `d1-import.sh` - Orchestration script
- `Makefile` - Convenience shortcuts
- `tools/mysql_to_d1.py` - Core converter
- `d1-output/` - Generated SQL artifacts (gitignored)
