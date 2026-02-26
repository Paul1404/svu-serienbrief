import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

export interface DbConfig {
	connectionString: string;
	ssl?: boolean;
}

export function initDb(config: DbConfig): Pool {
	if (!pool) {
		pool = new Pool({
			connectionString: config.connectionString,
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

export async function query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
	const db = getDb();
	return db.query<T>(text, params);
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
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

