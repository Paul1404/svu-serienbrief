import { Pool, PoolClient, QueryResult } from 'pg';
import type { QueryResultRow } from 'pg';

let pool: Pool | null = null;

export interface DbConfig {
	connectionString: string;
	ssl?: boolean;
}

// ---------- Retry helpers for serverless cold-start resilience ----------

/** Maximum number of automatic retries for transient DB errors. */
const MAX_RETRIES = 3;

/** Base delay (ms) for exponential back-off between retries. */
const BASE_DELAY_MS = 300;

/**
 * PostgreSQL error codes (and Node-level codes) that indicate a transient /
 * cold-start failure worth retrying.
 */
const TRANSIENT_ERROR_CODES = new Set([
	// Connection exceptions (class 08)
	'08000', // connection_exception
	'08003', // connection_does_not_exist
	'08006', // connection_failure
	'08001', // sqlclient_unable_to_establish_sqlconnection
	'08004', // sqlserver_rejected_establishment_of_sqlconnection
	// Insufficient resources (class 53)
	'53300', // too_many_connections
	// Operator intervention (class 57)
	'57P01', // admin_shutdown
	'57P03', // cannot_connect_now  (Neon cold-start)
]);

/** Node / network-level error codes that are transient. */
const TRANSIENT_NODE_CODES = new Set([
	'ECONNRESET',
	'ECONNREFUSED',
	'EPIPE',
	'ETIMEDOUT',
	'EAI_AGAIN',
]);

function isTransientError(err: any): boolean {
	if (!err) return false;
	// PG error code
	if (err.code && TRANSIENT_ERROR_CODES.has(err.code)) return true;
	// Node network code
	if (err.code && TRANSIENT_NODE_CODES.has(err.code)) return true;
	// Nested cause (e.g. pool.connect wrapping a network error)
	if (err.cause && isTransientError(err.cause)) return true;
	// Message heuristics for Neon cold-start messages
	const msg: string = (err.message || '').toLowerCase();
	if (msg.includes('connection terminated unexpectedly') ||
		msg.includes('could not connect to server') ||
		msg.includes('the database system is starting up') ||
		msg.includes('connection timed out') ||
		msg.includes('cannot connect now')) {
		return true;
	}
	return false;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an async operation with exponential back-off retries for transient DB
 * errors (such as Neon serverless cold-start timeouts).
 */
async function withRetry<T>(operation: () => Promise<T>, label = 'db'): Promise<T> {
	let lastError: any;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await operation();
		} catch (err: any) {
			lastError = err;
			if (attempt < MAX_RETRIES && isTransientError(err)) {
				const delay = BASE_DELAY_MS * Math.pow(2, attempt);
				console.log({
					event: 'db_retry',
					label,
					attempt: attempt + 1,
					max: MAX_RETRIES,
					delay_ms: delay,
					error_code: err.code,
					error_message: (err.message || '').substring(0, 120),
				});
				await sleep(delay);
				continue;
			}
			throw err;
		}
	}
	throw lastError; // unreachable, but satisfies TS
}

// ---------- Pool setup ----------

function withSslMode(url: string): string {
	// no-verify = SSL encryption without cert verification (Railway/self-signed certs)
	// require/verify-full override ssl.rejectUnauthorized and cause SELF_SIGNED_CERT_IN_CHAIN
	const param = 'sslmode=no-verify';
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
			ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
			// Serverless-friendly pool settings
			max: 5,                        // keep small – Neon free tier allows few connections
			idleTimeoutMillis: 30_000,     // release idle connections after 30 s
			connectionTimeoutMillis: 10_000, // give cold-starts up to 10 s to connect
		});

		// Log unexpected pool errors instead of crashing
		pool.on('error', (err) => {
			console.log({
				event: 'pool_background_error',
				error_code: (err as any).code,
				error_message: (err.message || '').substring(0, 200),
			});
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

// ---------- Query helpers (with automatic retry) ----------

export async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params: any[] = []
): Promise<QueryResult<T>> {
	const db = getDb();
	return withRetry(() => db.query<T>(text, params), 'query');
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

	// Acquiring the client is the most likely cold-start failure point
	const client = await withRetry(() => db.connect(), 'tx_connect');

	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

/**
 * Warm up the connection pool by executing a lightweight query.
 * Useful at startup to absorb the serverless cold-start latency before real
 * requests arrive.
 */
export async function warmPool(): Promise<void> {
	await withRetry(async () => {
		const db = getDb();
		await db.query('SELECT 1');
	}, 'warm_pool');
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


