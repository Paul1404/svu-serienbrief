#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/d1-import.config.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Error: Config file not found at $CONFIG_FILE"
    exit 1
fi

read_config() {
    python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['$1'])"
}

read_list() {
    python3 -c "import json; print(','.join(json.load(open('$CONFIG_FILE'))['$1']))"
}

build_converter_args() {
    local input output_dir chunk_size table_name
    input=$(read_config "input")
    output_dir=$(read_config "output_dir")
    chunk_size=$(read_config "chunk_size")
    table_name=$(read_config "table_name")
    
    local args="--input $input --out-dir $output_dir --chunk-size $chunk_size --table-name $table_name"
    
    # Add column allowlist
    local allowlist
    allowlist=$(read_list "column_allowlist" 2>/dev/null || echo "")
    if [[ -n "$allowlist" ]]; then
        args="$args --column-allowlist $allowlist"
    fi
    
    echo "$args"
}

convert() {
    echo "🔄 Converting CSV to D1 format..."
    local args
    args=$(build_converter_args)
    uv run python tools/csv_to_d1.py $args
    echo "✅ Conversion complete"
}

load_local() {
    local output_dir db_name
    output_dir=$(read_config "output_dir")
    db_name=$(read_config "database_name")
    
    echo "📦 Loading schema into local D1..."
    npx wrangler d1 execute "$db_name" --local --file="$output_dir/schema.sql"
    
    echo "📦 Loading data chunks into local D1..."
    local chunk_count=0
    shopt -s nullglob
    for chunk in "$SCRIPT_DIR/$output_dir"/data/chunk-*.sql; do
        chunk_count=$((chunk_count + 1))
        echo "  Loading $(basename "$chunk")..."
        npx wrangler d1 execute "$db_name" --local --file="$chunk"
    done
    shopt -u nullglob
    echo "✅ Loaded $chunk_count chunks to local database"
}

load_remote() {
    local output_dir db_name
    output_dir=$(read_config "output_dir")
    db_name=$(read_config "database_name")
    
    echo "🌐 Loading schema into remote D1..."
    npx wrangler d1 execute "$db_name" --remote --yes --file="$output_dir/schema.sql"
    
    echo "🌐 Loading data chunks into remote D1..."
    local chunk_count=0
    shopt -s nullglob
    for chunk in "$SCRIPT_DIR/$output_dir"/data/chunk-*.sql; do
        chunk_count=$((chunk_count + 1))
        echo "  Loading $(basename "$chunk")..."
        npx wrangler d1 execute "$db_name" --remote --yes --file="$chunk"
    done
    shopt -u nullglob
    echo "✅ Loaded $chunk_count chunks to remote database"
}

verify() {
    local db_name location="${1:-local}"
    db_name=$(read_config "database_name")
    table_name=$(read_config "table_name")
    local flag=""
    [[ "$location" == "remote" ]] && flag="--remote"
    
    echo "🔍 Verifying $location database..."
    echo ""
    echo "Tables:"
    npx wrangler d1 execute "$db_name" $flag --command="SELECT name FROM sqlite_master WHERE type='table';"
    echo ""
    echo "Row count:"
    npx wrangler d1 execute "$db_name" $flag --command="SELECT COUNT(*) as total FROM \`$table_name\`;"
    echo ""
    echo "Sample records:"
    npx wrangler d1 execute "$db_name" $flag --command="SELECT * FROM \`$table_name\` LIMIT 3;"
}

import_local() {
    convert
    load_local
    echo ""
    echo "🎉 Local import complete!"
    verify local
}

import_remote() {
    convert
    load_remote
    echo ""
    echo "🎉 Remote import complete!"
    verify remote
}

show_help() {
    cat << EOF
D1 CSV Import Tool - Convert and load CSV data to Cloudflare D1

Usage: ./d1-import.sh <command>

Commands:
  convert         Convert CSV to D1 format
  load-local      Load to local D1 database
  load-remote     Load to remote D1 database
  import-local    Convert + load to local (recommended first)
  import-remote   Convert + load to remote
  verify [local|remote]  Verify database contents
  help            Show this help message

Configuration:
  Edit d1-import.config.json to adjust settings
EOF
}

case "${1:-help}" in
    convert)
        convert
        ;;
    load-local)
        load_local
        ;;
    load-remote)
        load_remote
        ;;
    import-local)
        import_local
        ;;
    import-remote)
        import_remote
        ;;
    verify)
        verify "${2:-local}"
        ;;
    help)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
