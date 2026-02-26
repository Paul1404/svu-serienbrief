-- Core schema for Neon Postgres
-- Migrated from Cloudflare D1 / SQLite definitions

-- Admin sessions (authentication)
CREATE TABLE IF NOT EXISTS admin_sessions (
    session_id TEXT PRIMARY KEY,
    expires BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    last_activity BIGINT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_activity ON admin_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_ip ON admin_sessions(ip_address);


-- Member tokens (update links)
CREATE TABLE IF NOT EXISTS member_tokens (
    member_id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    generated_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    regenerated_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_member_tokens_expires ON member_tokens(expires_at);


-- Main member table (auswertung)
-- Column set based on fields used in the application.
CREATE TABLE IF NOT EXISTS auswertung (
    AdrNr TEXT PRIMARY KEY,
    MitglNr TEXT,
    Anrede TEXT,
    Vorname TEXT,
    Nachname TEXT,
    Strasse TEXT,
    PLZ TEXT,
    Ort TEXT,
    Telefon TEXT,
    Mobil TEXT,
    EMail TEXT,
    IBAN TEXT,
    BIC TEXT,
    Bankbezeichnung TEXT,
    Abteilung TEXT,
    Eintritt TEXT,
    Geburtsdatum TEXT,
    funktion_rolle TEXT,
    funktion_beginn TEXT,
    funktion_ende TEXT,
    eintrittsdatum TEXT,
    aenderungskommentar TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auswertung_mitglnr ON auswertung(MitglNr);
CREATE INDEX IF NOT EXISTS idx_auswertung_funktion ON auswertung(funktion_rolle);
CREATE INDEX IF NOT EXISTS idx_auswertung_eintrittsdatum ON auswertung(eintrittsdatum);


-- Member access log (audit trail)
CREATE TABLE IF NOT EXISTS member_access_log (
    id BIGSERIAL PRIMARY KEY,
    member_id TEXT NOT NULL,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_access_member_id ON member_access_log(member_id);
CREATE INDEX IF NOT EXISTS idx_member_access_accessed_at ON member_access_log(accessed_at);


-- Member changes log (data lineage)
CREATE TABLE IF NOT EXISTS member_changes_log (
    id BIGSERIAL PRIMARY KEY,
    member_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_changes_member_id ON member_changes_log(member_id);
CREATE INDEX IF NOT EXISTS idx_member_changes_changed_at ON member_changes_log(changed_at);

