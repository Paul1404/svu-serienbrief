-- Member tokens table for tracking generated update links
CREATE TABLE IF NOT EXISTS member_tokens (
    member_id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    regenerated_count INTEGER DEFAULT 0
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_member_tokens_expires ON member_tokens(expires_at);
