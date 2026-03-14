import { Pool, PoolClient, QueryResult } from 'pg';
import type { QueryResultRow } from 'pg';

let pool: Pool | null = null;

export interface DbConfig {
	connectionString: string;
	ssl?: boolean;
}

function withSslMode(url: string): string {
	// Use 'require' (encryption) not 'verify-full' - allows Railway/self-signed certs
	// verify-full overrides ssl.rejectUnauthorized and causes SELF_SIGNED_CERT_IN_CHAIN
	const param = 'sslmode=require';
	if (url.includes('sslmode=')) {
		return url.replace(/sslmode=[^&]+/, param);
	}
	return url.includes('?') ? `${url}&${param}` : `${url}?${param}`;
}

export function initDb(config: DbConfig): Pool {
	if (!pool) {
		const connStr = config.ssl ? withSslMode(config.connectionString) : config.connectionString;
		pool = new Pool({
			connectionString: connStr,
			ssl: config.ssl ? { rejectUnauthorized: false } : undefined
		});
	}
	return pool;
}

export function getDb(): Pool {
	if (!pool) {
		throw new Error('Database pool has not been initialized. Call initDb() first.');
	}
	return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params: any[] = []
): Promise<QueryResult<T>> {
	const db = getDb();
	return db.query<T>(text, params);
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params: any[] = []
): Promise<T | null> {
	const result = await query<T>(text, params);
	return result.rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
	const db = getDb();
	const client = await db.connect();
	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}

// Ensure that core tables used by the app exist in the database.
export async function ensureCoreTables(): Promise<void> {
	// Admin sessions
	await query(`
		CREATE TABLE IF NOT EXISTS admin_sessions (
			session_id TEXT PRIMARY KEY,
			expires BIGINT NOT NULL,
			created_at BIGINT NOT NULL,
			last_activity BIGINT NOT NULL,
			ip_address TEXT NOT NULL,
			user_agent TEXT NOT NULL
		)
	`);

	await query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires)`);
	await query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_activity ON admin_sessions(last_activity)`);
	await query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_ip ON admin_sessions(ip_address)`);

	// Member tokens
	await query(`
		CREATE TABLE IF NOT EXISTS member_tokens (
			member_id TEXT PRIMARY KEY,
			token TEXT NOT NULL,
			generated_at BIGINT NOT NULL,
			expires_at BIGINT NOT NULL,
			regenerated_count INTEGER NOT NULL DEFAULT 0
		)
	`);

	await query(`CREATE INDEX IF NOT EXISTS idx_member_tokens_expires ON member_tokens(expires_at)`);

	// Member access log
	await query(`
		CREATE TABLE IF NOT EXISTS member_access_log (
			id BIGSERIAL PRIMARY KEY,
			member_id TEXT NOT NULL,
			accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			ip_address TEXT,
			user_agent TEXT
		)
	`);

	await query(`CREATE INDEX IF NOT EXISTS idx_member_access_member_id ON member_access_log(member_id)`);
	await query(`CREATE INDEX IF NOT EXISTS idx_member_access_accessed_at ON member_access_log(accessed_at)`);

	// Member changes log
	await query(`
		CREATE TABLE IF NOT EXISTS member_changes_log (
			id BIGSERIAL PRIMARY KEY,
			member_id TEXT NOT NULL,
			field_name TEXT NOT NULL,
			old_value TEXT,
			new_value TEXT,
			changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			ip_address TEXT,
			user_agent TEXT
		)
	`);

	await query(`CREATE INDEX IF NOT EXISTS idx_member_changes_member_id ON member_changes_log(member_id)`);
	await query(`CREATE INDEX IF NOT EXISTS idx_member_changes_changed_at ON member_changes_log(changed_at)`);

	// Add funktionen JSONB column to auswertung if it doesn't exist (for multiple functions per member)
	try {
		await query(`
			ALTER TABLE auswertung ADD COLUMN IF NOT EXISTS funktionen JSONB DEFAULT '[]'::jsonb
		`);
	} catch {
		// auswertung may not exist yet if migrations haven't been run
	}
}


