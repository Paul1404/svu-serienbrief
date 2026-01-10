-- Schema extensions for auswertung table
-- New fields for member data management
-- Note: Run each ALTER TABLE statement separately if any fail due to existing columns

-- Date of birth already exists as 'Geburtsdatum' (capital G) - no action needed

-- Function/role in the club (e.g., Trainer, Vorstand, Abteilungsleiter)
-- ALTER TABLE auswertung ADD COLUMN funktion_rolle TEXT NULL;

-- Start date of function (YYYY-MM format)
-- ALTER TABLE auswertung ADD COLUMN funktion_beginn TEXT NULL;

-- End date of function (YYYY-MM format or NULL for "until now")
-- ALTER TABLE auswertung ADD COLUMN funktion_ende TEXT NULL;

-- Entry date to the club (read-only in frontend)
-- ALTER TABLE auswertung ADD COLUMN eintrittsdatum TEXT NULL;

-- Comment field for change requests on locked fields
-- ALTER TABLE auswertung ADD COLUMN aenderungskommentar TEXT NULL;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_auswertung_funktion ON auswertung(funktion_rolle);
CREATE INDEX IF NOT EXISTS idx_auswertung_eintrittsdatum ON auswertung(eintrittsdatum);

-- Note: All columns have been added to the production database.
-- This file is kept for documentation purposes.
-- Columns added:
--   - funktion_rolle TEXT NULL
--   - funktion_beginn TEXT NULL
--   - funktion_ende TEXT NULL
--   - eintrittsdatum TEXT NULL
--   - aenderungskommentar TEXT NULL
-- Existing column used:
--   - Geburtsdatum (already present)
