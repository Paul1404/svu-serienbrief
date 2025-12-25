-- Member verification database schema for SV 1945 Untereuerheim e.V.
-- This table stores member data and tracks verification status

CREATE TABLE IF NOT EXISTS members (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Security token (32-byte URL-safe string)
    -- Used for passwordless verification via QR code
    token TEXT UNIQUE NOT NULL,
    
    -- Member identification
    mitgl_nr TEXT,  -- Can be NULL for payers who are not members
    
    -- Personal information (from CSV export)
    vorname TEXT NOT NULL,
    nachname TEXT NOT NULL,
    strasse TEXT NOT NULL,
    plz TEXT NOT NULL,
    ort TEXT NOT NULL,
    email TEXT,
    telefon TEXT,
    geschlecht TEXT,
    
    -- Verification tracking
    verified_at TIMESTAMP,  -- NULL if not yet verified
    updated_data JSONB,     -- Stores any changes submitted by member
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast token lookups (primary use case)
CREATE INDEX IF NOT EXISTS idx_members_token ON members(token);

-- Index for admin panel searches
CREATE INDEX IF NOT EXISTS idx_members_nachname ON members(nachname);
CREATE INDEX IF NOT EXISTS idx_members_verified_at ON members(verified_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
