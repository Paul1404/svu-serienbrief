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
    python3 -c "import json; print(' '.join(json.load(open('$CONFIG_FILE'))['$1']))"
}

build_converter_args() {
    local input output_dir chunk_size
    input=$(read_config "input")
    output_dir=$(read_config "output_dir")
    chunk_size=$(read_config "chunk_size")
    
    local args="--input $input --out-dir $output_dir --chunk-size $chunk_size"
    
    # Add column allowlists
    local allowlists
    allowlists=$(python3 -c "
import json
config = json.load(open('$CONFIG_FILE'))
for table, cols in config.get('column_allowlists', {}).items():
    print(f'--column-allowlist {table}:{chr(44).join(cols)}')
" | tr '\n' ' ')
    args="$args $allowlists"
    
    # Add skip tables
    local skip_tables
    skip_tables=$(read_list "skip_tables" 2>/dev/null || echo "")
    for table in $skip_tables; do
        args="$args --skip-table $table"
    done
    
    echo "$args"
}

convert() {
    echo "🔄 Converting MySQL dump to D1 format..."
    local args
    args=$(build_converter_args)
    uv run python tools/mysql_to_d1.py $args
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
    local flag=""
    [[ "$location" == "remote" ]] && flag="--remote"
    
    echo "🔍 Verifying $location database..."
    npx wrangler d1 execute "$db_name" $flag --command="SELECT COUNT(*) as member_count FROM adresse"
    npx wrangler d1 execute "$db_name" $flag --command="SELECT AdrNr, Vorname, Nachname, Ort FROM adresse LIMIT 3"
}

show_help() {
    cat << EOF
D1 Import Tool - Streamlined MySQL to Cloudflare D1 migration

Usage: $0 <command> [options]

Commands:
    convert         Convert MySQL dump to D1 format
    load-local      Load schema and data into local D1 database
    load-remote     Load schema and data into remote D1 database
    verify [local|remote]  Verify data in database (default: local)
    
    import-local    Convert + load to local (one-step)
    import-remote   Convert + load to remote (one-step)
    
    help            Show this help message

Examples:
    $0 import-local          # Convert and load to local D1 in one command
    $0 import-remote         # Convert and load to remote D1
    $0 verify remote         # Check remote database contents

Configuration is read from: $CONFIG_FILE
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
        convert
        load_local
        verify local
        ;;
    import-remote)
        convert
        load_remote
        verify remote
        ;;
    verify)
        verify "${2:-local}"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac
