/**
 * API routes (JSON responses) for Node/Neon (Postgres).
 * This is a Postgres-native port of the original Cloudflare D1 implementation.
 */

import { Hono } from 'hono';
import { sanitizeIdentifier, jsonResponse, jsonError } from '../utils/helpers';
import { query, queryOne, withTransaction } from '../db';
import { convertMysqlDumpToPostgres } from '../utils/mysqlToPostgres';

const api = new Hono();

function normalizeMemberId(id: any): string {
	if (id === null || id === undefined) return '';
	const str = String(id);
	return str.endsWith('.0') ? str.slice(0, -2) : str;
}

// Get paginated data
api.get('/data', async (c) => {
	const page = parseInt(c.req.query('page') || '1');
	const limit = parseInt(c.req.query('limit') || '50');
	const offset = (page - 1) * limit;

	try {

		const startTime = Date.now();
		const result = await query<any>(
			'SELECT * FROM auswertung LIMIT $1 OFFSET $2',
			[limit, offset]
		);
		const duration = Date.now() - startTime;

		console.log({
			event: 'api_data_query',
			page,
			limit,
			offset,
			rows_returned: result.rows.length,
			duration_ms: duration
		});

		return jsonResponse({
			data: result.rows,
			page,
			limit,
		});
	} catch (error: any) {
		if (error.code === '42P01') {
			// auswertung table missing - treat as empty dataset for graceful bootstrapping
			console.log({
				event: 'api_data_table_missing',
				table: 'auswertung'
			});
			return jsonResponse({
				data: [],
				page,
				limit,
			});
		}

		console.log({
			event: 'api_data_error',
			error: error.message,
			stack: error.stack
		});
		return jsonError(error.message);
	}
});

// Search by column
api.get('/search', async (c) => {
	try {
		const column = c.req.query('column');
		const q = c.req.query('q');

		if (!column || !q) {
			console.log({
				event: 'api_search_error',
				reason: 'missing_parameters',
				column: column || 'undefined',
				query: q || 'undefined'
			});
			return jsonError('Missing required parameters', 400);
		}

		const startTime = Date.now();
		const sql = `SELECT * FROM auswertung WHERE ${sanitizeIdentifier(column)} LIKE $1 LIMIT 100`;
		const result = await query<any>(sql, [`%${q}%`]);
		const duration = Date.now() - startTime;

		console.log({
			event: 'api_search_query',
			column,
			search_term: q,
			rows_returned: result.rows.length,
			duration_ms: duration
		});

		return jsonResponse({
			data: result.rows,
			query: q,
		});
	} catch (error: any) {
		console.log({
			event: 'api_search_error',
			error: error.message,
			stack: error.stack
		});
		return jsonError(error.message);
	}
});

// Get member access statistics
api.get('/access-stats', async (c) => {
	try {
		const result = await query<any>(`
			SELECT 
				member_id,
				MAX(accessed_at) as last_accessed,
				COUNT(*) as access_count
			FROM member_access_log
			GROUP BY member_id
		`);

		const statsMap: Record<string, { last_accessed: string; access_count: number }> = {};

		for (const row of result.rows) {
			const record = row as any;
			statsMap[record.member_id] = {
				last_accessed: String(record.last_accessed),
				access_count: Number(record.access_count || 0)
			};
		}

		return jsonResponse(statsMap);
	} catch (error: any) {
		console.log({
			event: 'api_access_stats_error',
			error: error.message
		});
		return jsonResponse({});
	}
});

// Get member change history
api.get('/change-history', async (c) => {
	try {
		const result = await query<any>(`
			SELECT 
				c.id,
				c.member_id,
				c.field_name,
				c.old_value,
				c.new_value,
				c.changed_at,
				c.ip_address,
				a.Vorname,
				a.Nachname,
				a.EMail
			FROM member_changes_log c
			LEFT JOIN auswertung a ON (c.member_id = a.AdrNr OR c.member_id = a.MitglNr)
			ORDER BY c.changed_at DESC
			LIMIT 1000
		`);

		return jsonResponse({
			changes: result.rows || []
		});
	} catch (error: any) {
		if (error.code === '42P01') {
			console.log({
				event: 'api_change_history_table_missing',
				table: 'auswertung'
			});
			return jsonResponse({ changes: [] });
		}

		console.log({
			event: 'api_change_history_error',
			error: error.message
		});
		return jsonResponse({ changes: [] });
	}
});

// Get statistics for dashboard
api.get('/stats', async (c) => {
	try {
		const totalMembers = await queryOne<{ count: string }>(
			'SELECT COUNT(*) as count FROM auswertung'
		);

		const membersWithAccess = await queryOne<{ count: string }>(
			'SELECT COUNT(DISTINCT member_id) as count FROM member_access_log'
		);

		const totalAccesses = await queryOne<{ count: string }>(
			'SELECT COUNT(*) as count FROM member_access_log'
		);

		const totalChanges = await queryOne<{ count: string }>(
			'SELECT COUNT(*) as count FROM member_changes_log'
		);

		const membersWithChanges = await queryOne<{ count: string }>(
			'SELECT COUNT(DISTINCT member_id) as count FROM member_changes_log'
		);

		const topFields = await query<any>(`
			SELECT field_name, COUNT(*) as count 
			FROM member_changes_log 
			GROUP BY field_name 
			ORDER BY count DESC 
			LIMIT 5
		`);

		const recentActivity = await queryOne<{ count: string }>(`
			SELECT COUNT(*) as count 
			FROM member_changes_log 
			WHERE changed_at > now() - interval '7 days'
		`);

		const totalMembersCount = Number(totalMembers?.count || 0);
		const membersWithAccessCount = Number(membersWithAccess?.count || 0);
		const totalAccessesCount = Number(totalAccesses?.count || 0);
		const totalChangesCount = Number(totalChanges?.count || 0);
		const membersWithChangesCount = Number(membersWithChanges?.count || 0);
		const recentActivityCount = Number(recentActivity?.count || 0);

		const accessRate =
			totalMembersCount > 0
				? Math.round((membersWithAccessCount / totalMembersCount) * 100)
				: 0;

		const changeRate =
			membersWithAccessCount > 0
				? Math.round((membersWithChangesCount / membersWithAccessCount) * 100)
				: 0;

		return jsonResponse({
			totalMembers: totalMembersCount,
			membersWithAccess: membersWithAccessCount,
			totalAccesses: totalAccessesCount,
			totalChanges: totalChangesCount,
			membersWithChanges: membersWithChangesCount,
			topFields: topFields.rows || [],
			recentActivity: recentActivityCount,
			accessRate,
			changeRate
		});
	} catch (error: any) {
		if (error.code === '42P01') {
			console.log({
				event: 'api_stats_table_missing',
				table: 'auswertung'
			});
		} else {
			console.log({
				event: 'api_stats_error',
				error: error.message
			});
		}

		return jsonResponse({
			totalMembers: 0,
			membersWithAccess: 0,
			totalAccesses: 0,
			totalChanges: 0,
			membersWithChanges: 0,
			topFields: [],
			recentActivity: 0,
			accessRate: 0,
			changeRate: 0
		});
	}
});

// Clear member data (undo import): auswertung + member_tokens
api.post('/clear-member-data', async (c) => {
	try {
		await query('TRUNCATE TABLE member_tokens', []);
		await query('TRUNCATE TABLE auswertung', []);

		console.log({
			event: 'member_data_cleared',
			ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			message: 'Mitgliederdaten und Token erfolgreich gelöscht'
		});
	} catch (error: any) {
		if (error.code === '42P01') {
			// Table doesn't exist - treat as success
			return jsonResponse({
				message: 'Keine Mitgliederdaten vorhanden'
			});
		}
		console.log({
			event: 'clear_member_data_error',
			error: error.message
		});
		return jsonError(error.message, 500);
	}
});

// Clear change history and access logs
api.post('/clear-history', async (c) => {
	try {
		await query('DELETE FROM member_changes_log', []);
		await query('DELETE FROM member_access_log', []);

		console.log({
			event: 'history_cleared',
			ip: c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			message: 'Verlauf und Statistiken erfolgreich gelöscht'
		});
	} catch (error: any) {
		console.log({
			event: 'clear_history_error',
			error: error.message
		});
		return jsonError(error.message, 500);
	}
});

// Get token status for all members
api.get('/token-status', async (c) => {
	try {
		const result = await query<any>(`
			SELECT 
				t.member_id,
				t.generated_at,
				t.expires_at,
				t.regenerated_count,
				a.Vorname,
				a.Nachname,
				a.EMail
			FROM member_tokens t
			LEFT JOIN auswertung a ON (t.member_id = a.AdrNr OR t.member_id = a.MitglNr)
			ORDER BY t.generated_at DESC
		`);

		const now = Date.now();
		const tokens = (result.rows || []).map((row: any) => ({
			...row,
			is_expired: now > Number(row.expires_at),
			days_remaining: Math.floor(
				(Number(row.expires_at) - now) / (24 * 60 * 60 * 1000)
			)
		}));

		return jsonResponse({ tokens });
	} catch (error: any) {
		console.log({
			event: 'token_status_error',
			error: error.message
		});
		return jsonResponse({ tokens: [] });
	}
});

// Regenerate token for a specific member
api.post('/regenerate-token/:memberId', async (c) => {
	try {
		const memberId = normalizeMemberId(c.req.param('memberId'));
		if (!memberId) return jsonError('Ungültige Mitglieds-ID', 400);

		const secret = process.env.ADMIN_PASSWORD || '';

		const { generateMemberToken } = await import('../utils/tokens');

		const token = await generateMemberToken(memberId, secret);
		const now = Date.now();
		const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

		await query(
			`INSERT INTO member_tokens (member_id, token, generated_at, expires_at, regenerated_count)
			 VALUES ($1, $2, $3, $4, 0)
			 ON CONFLICT (member_id) DO UPDATE SET
			 	token = EXCLUDED.token,
			 	generated_at = EXCLUDED.generated_at,
			 	expires_at = EXCLUDED.expires_at,
			 	regenerated_count = member_tokens.regenerated_count + 1`,
			[memberId, token, now, expiresAt]
		);

		const baseUrl = new URL(c.req.url).origin;
		const updateUrl = `${baseUrl}/update/${token}`;

		console.log({
			event: 'token_regenerated',
			member_id: memberId,
			ip: c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			token,
			updateUrl,
			expiresAt,
			message: 'Token erfolgreich neu generiert'
		});
	} catch (error: any) {
		console.error('Error regenerating token:', error);
		return jsonError(error.message, 500);
	}
});

// Delete token for a specific member
api.delete('/delete-token/:memberId', async (c) => {
	try {
		const memberId = normalizeMemberId(c.req.param('memberId'));
		if (!memberId) return jsonError('Ungültige Mitglieds-ID', 400);

		const result = await query(
			'DELETE FROM member_tokens WHERE member_id = $1',
			[memberId]
		);

		console.log({
			event: 'token_deleted',
			member_id: memberId,
			ip: c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			success: true,
			deletedCount: result.rowCount || 0,
			message: 'Token erfolgreich gelöscht'
		});
	} catch (error: any) {
		console.log({
			event: 'token_delete_error',
			error: error.message
		});
		return jsonError(error.message, 500);
	}
});

// Bulk delete tokens - single request for multiple tokens
api.post('/bulk-delete-tokens', async (c) => {
	try {
		const body = await c.req.json();
		const rawIds: any[] = body.memberIds || [];

		const memberIds = rawIds
			.map((id) => normalizeMemberId(id))
			.filter((id) => id !== '');

		if (memberIds.length === 0) {
			return jsonError('Keine Token-IDs angegeben', 400);
		}

		const BATCH_SIZE = 50;
		let deletedCount = 0;

		for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
			const batch = memberIds.slice(i, i + BATCH_SIZE);
			const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');

			const result = await query(
				`DELETE FROM member_tokens WHERE member_id IN (${placeholders})`,
				batch
			);

			deletedCount += result.rowCount || 0;
		}

		console.log({
			event: 'bulk_tokens_deleted',
			count: deletedCount,
			ip: c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			success: true,
			deletedCount,
			message: `${deletedCount} Token erfolgreich gelöscht`
		});
	} catch (error: any) {
		console.log({
			event: 'bulk_token_delete_error',
			error: error.message
		});
		return jsonError(error.message, 500);
	}
});

// MySQL dump import: convert + load in one flow (full D1-Import-SQL logic in UI)
api.post('/import-sql', async (c) => {
	try {
		const formData = await c.req.formData();
		const file = formData.get('mysqlDump') as { text?: () => Promise<string> } | null;

		if (!file || typeof (file as any)?.text !== 'function') {
			return jsonError('Bitte eine MySQL-Dump-Datei (.sql) hochladen', 400);
		}

		const content = await (file as any).text();
		if (!content || content.trim().length === 0) {
			return jsonError('Die Datei ist leer', 400);
		}

		const { schemaStatements, dataStatements } = convertMysqlDumpToPostgres(content);
		const allStatements = [...schemaStatements, ...dataStatements];
		const totalStatements = allStatements.length;

		if (totalStatements === 0) {
			return jsonError('Keine gültigen Tabellen oder Daten in der Datei gefunden (erwarte Tabelle "adresse")', 400);
		}

		let executedStatements = 0;
		await withTransaction(async (client) => {
			for (let i = 0; i < allStatements.length; i++) {
				const stmt = allStatements[i];
				try {
					await client.query(stmt);
					executedStatements++;
				} catch (err: any) {
					const msg = err.message || String(err);
					throw new Error(`Anweisung ${i + 1}/${totalStatements}: ${msg}`);
				}
			}
		});

		console.log({
			event: 'mysql_import_complete',
			schemaCount: schemaStatements.length,
			dataCount: dataStatements.length,
			executedStatements,
			ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			success: true,
			message: `${executedStatements} Anweisungen ausgeführt (${schemaStatements.length} Schema, ${dataStatements.length} Daten)`,
			totalStatements: executedStatements,
			rowsImported: dataStatements.filter(s => /^INSERT\s+INTO/i.test(s)).length
		});
	} catch (error: any) {
		console.log({
			event: 'mysql_import_error',
			error: error.message,
			stack: error.stack
		});
		return jsonError(error.message || 'Import fehlgeschlagen', 500);
	}
});

// Bulk regenerate tokens - single request for multiple tokens
api.post('/bulk-regenerate-tokens', async (c) => {
	try {
		const body = await c.req.json();
		const rawIds: any[] = body.memberIds || [];
		const validityDays = Math.min(Math.max(body.validityDays || 90, 7), 365);

		const memberIds = rawIds
			.map((id) => normalizeMemberId(id))
			.filter((id) => id !== '');

		if (memberIds.length === 0) {
			return jsonError('Keine Token-IDs angegeben', 400);
		}

		const { generateMemberToken } = await import('../utils/tokens');
		const secret = process.env.ADMIN_PASSWORD || '';
		const baseUrl = new URL(c.req.url).origin;
		const now = Date.now();
		const expiresAt = now + validityDays * 24 * 60 * 60 * 1000;

		const tokenData: Array<{ memberId: string; token: string; updateUrl: string }> = [];

		for (const memberId of memberIds) {
			const token = await generateMemberToken(memberId, secret);
			tokenData.push({
				memberId,
				token,
				updateUrl: `${baseUrl}/update/${token}`
			});
		}

		await withTransaction(async (client) => {
			for (const item of tokenData) {
				await client.query(
					`INSERT INTO member_tokens (member_id, token, generated_at, expires_at, regenerated_count)
					 VALUES ($1, $2, $3, $4, 0)
					 ON CONFLICT (member_id) DO UPDATE SET
					 	token = EXCLUDED.token,
					 	generated_at = EXCLUDED.generated_at,
					 	expires_at = EXCLUDED.expires_at,
					 	regenerated_count = member_tokens.regenerated_count + 1`,
					[item.memberId, item.token, now, expiresAt]
				);
			}
		});

		console.log({
			event: 'bulk_tokens_regenerated',
			count: tokenData.length,
			ip: c.req.header('cf-connecting-ip')
		});

		return jsonResponse({
			success: true,
			regeneratedCount: tokenData.length,
			tokens: tokenData.map((t) => ({ memberId: t.memberId, updateUrl: t.updateUrl })),
			message: `${tokenData.length} Token erfolgreich neu generiert`
		});
	} catch (error: any) {
		console.log({
			event: 'bulk_token_regenerate_error',
			error: error.message
		});
		return jsonError(error.message, 500);
	}
});

export default api;

