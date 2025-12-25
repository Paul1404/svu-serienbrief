.PHONY: help convert load-local load-remote import-local import-remote verify clean

help:
	@echo "D1 CSV Import - Streamlined CSV to Cloudflare D1 migration"
	@echo ""
	@echo "Quick commands:"
	@echo "  make import-local   - Convert CSV and load to local D1"
	@echo "  make import-remote  - Convert CSV and load to remote D1"
	@echo "  make verify         - Check local database contents"
	@echo "  make verify-remote  - Check remote database contents"
	@echo ""
	@echo "Step-by-step:"
	@echo "  make convert        - Only convert CSV to D1 format"
	@echo "  make load-local     - Only load to local database"
	@echo "  make load-remote    - Only load to remote database"
	@echo "  make clean          - Remove generated d1-output files"

convert:
	@./d1-import.sh convert

load-local:
	@./d1-import.sh load-local

load-remote:
	@./d1-import.sh load-remote

import-local:
	@./d1-import.sh import-local

import-remote:
	@./d1-import.sh import-remote

verify:
	@./d1-import.sh verify local

verify-remote:
	@./d1-import.sh verify remote

clean:
	rm -rf d1-output
	@echo "✅ Cleaned d1-output directory"
