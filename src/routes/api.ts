/**
 * API routes (JSON responses)
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { sanitizeIdentifier, jsonResponse, jsonError } from '../utils/helpers';

const api = new Hono<{ Bindings: Env }>();

// Get paginated data
api.get('/data', async (c) => {
	try {
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '50');
		const offset = (page - 1) * limit;

		const startTime = Date.now();
		const query = `SELECT * FROM auswertung LIMIT ? OFFSET ?`;
		const result = await c.env.svu_prod01.prepare(query).bind(limit, offset).all();
		const duration = Date.now() - startTime;

		console.log({
			event: 'api_data_query',
			page: page,
			limit: limit,
			offset: offset,
			rows_returned: result.results?.length || 0,
			duration_ms: duration
		});

		return jsonResponse({
			data: result.results,
			page,
			limit,
		});
	} catch (error: any) {
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
		const query = c.req.query('q');

		if (!column || !query) {
			console.log({
				event: 'api_search_error',
				reason: 'missing_parameters',
				column: column || 'undefined',
				query: query || 'undefined'
			});
			return jsonError('Missing required parameters', 400);
		}

		const startTime = Date.now();
		const sql = `SELECT * FROM auswertung WHERE ${sanitizeIdentifier(column)} LIKE ? LIMIT 100`;
		const result = await c.env.svu_prod01.prepare(sql).bind(`%${query}%`).all();
		const duration = Date.now() - startTime;

		console.log({
			event: 'api_search_query',
			column: column,
			search_term: query,
			rows_returned: result.results?.length || 0,
			duration_ms: duration
		});

		return jsonResponse({
			data: result.results,
			query,
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
		// Get latest access for each member
		const result = await c.env.svu_prod01.prepare(`
			SELECT 
				member_id,
				MAX(accessed_at) as last_accessed,
				COUNT(*) as access_count
			FROM member_access_log
			GROUP BY member_id
		`).all();

		// Return as a map for easy lookup
		const statsMap: Record<string, { last_accessed: string; access_count: number }> = {};
		
		if (result.results) {
			for (const row of result.results) {
				const record = row as any;
				statsMap[record.member_id] = {
					last_accessed: record.last_accessed,
					access_count: record.access_count
				};
			}
		}

		return jsonResponse(statsMap);
	} catch (error: any) {
		// Return empty object if table doesn't exist yet
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
		const result = await c.env.svu_prod01.prepare(`
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
		`).all();

		return jsonResponse({
			changes: result.results || []
		});
	} catch (error: any) {
		// Return empty array if table doesn't exist yet
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
		// Get total members
		const totalMembers = await c.env.svu_prod01.prepare(
			'SELECT COUNT(*) as count FROM auswertung'
		).first();

		// Get members with access
		const membersWithAccess = await c.env.svu_prod01.prepare(
			'SELECT COUNT(DISTINCT member_id) as count FROM member_access_log'
		).first();

		// Get total accesses
		const totalAccesses = await c.env.svu_prod01.prepare(
			'SELECT COUNT(*) as count FROM member_access_log'
		).first();

		// Get total changes
		const totalChanges = await c.env.svu_prod01.prepare(
			'SELECT COUNT(*) as count FROM member_changes_log'
		).first();

		// Get members who made changes
		const membersWithChanges = await c.env.svu_prod01.prepare(
			'SELECT COUNT(DISTINCT member_id) as count FROM member_changes_log'
		).first();

		// Get most changed fields
		const topFields = await c.env.svu_prod01.prepare(`
			SELECT field_name, COUNT(*) as count 
			FROM member_changes_log 
			GROUP BY field_name 
			ORDER BY count DESC 
			LIMIT 5
		`).all();

		// Get recent activity (last 7 days)
		const recentActivity = await c.env.svu_prod01.prepare(`
			SELECT COUNT(*) as count 
			FROM member_changes_log 
			WHERE changed_at > datetime('now', '-7 days')
		`).first();

		return jsonResponse({
			totalMembers: (totalMembers as any)?.count || 0,
			membersWithAccess: (membersWithAccess as any)?.count || 0,
			totalAccesses: (totalAccesses as any)?.count || 0,
			totalChanges: (totalChanges as any)?.count || 0,
			membersWithChanges: (membersWithChanges as any)?.count || 0,
			topFields: topFields.results || [],
			recentActivity: (recentActivity as any)?.count || 0,
			accessRate: totalMembers?.count ? Math.round(((membersWithAccess as any)?.count || 0) / (totalMembers as any).count * 100) : 0,
			changeRate: (membersWithAccess as any)?.count ? Math.round(((membersWithChanges as any)?.count || 0) / (membersWithAccess as any).count * 100) : 0
		});
	} catch (error: any) {
		console.log({
			event: 'api_stats_error',
			error: error.message
		});
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

// Clear change history and access logs
api.post('/clear-history', async (c) => {
	try {
		// Clear change log
		await c.env.svu_prod01.prepare('DELETE FROM member_changes_log').run();
		
		// Clear access log
		await c.env.svu_prod01.prepare('DELETE FROM member_access_log').run();

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
		const result = await c.env.svu_prod01.prepare(`
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
		`).all();

		const now = Date.now();
		const tokens = (result.results || []).map((row: any) => ({
			...row,
			is_expired: now > row.expires_at,
			days_remaining: Math.floor((row.expires_at - now) / (24 * 60 * 60 * 1000))
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
		const memberId = c.req.param('memberId');
		const secret = c.env.ADMIN_PASSWORD;
		
		// Import generateMemberToken
		const { generateMemberToken } = await import('../utils/tokens');
		
		const token = await generateMemberToken(memberId, secret);
		const now = Date.now();
		const expiresAt = now + (90 * 24 * 60 * 60 * 1000);
		
		await c.env.svu_prod01.prepare(`
			INSERT INTO member_tokens (member_id, token, generated_at, expires_at, regenerated_count)
			VALUES (?, ?, ?, ?, 0)
			ON CONFLICT(member_id) DO UPDATE SET
				token = excluded.token,
				generated_at = excluded.generated_at,
				expires_at = excluded.expires_at,
				regenerated_count = regenerated_count + 1
		`).bind(memberId, token, now, expiresAt).run();
		
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
		return jsonResponse({ error: error.message }, 500);
	}
});

// Delete token for a specific member
api.delete('/delete-token/:memberId', async (c) => {
	try {
		const memberId = c.req.param('memberId');
		
		const result = await c.env.svu_prod01.prepare(`
			DELETE FROM member_tokens WHERE member_id = ?
		`).bind(memberId).run();
		
		console.log({
			event: 'token_deleted',
			member_id: memberId,
			ip: c.req.header('cf-connecting-ip')
		});
		
		return jsonResponse({
			success: true,
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
		const memberIds: string[] = body.memberIds || [];
		
		if (memberIds.length === 0) {
			return jsonError('Keine Token-IDs angegeben', 400);
		}
		
		// Use batched DELETE for efficiency (D1 has variable limits)
		const BATCH_SIZE = 50;
		let deletedCount = 0;
		
		for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
			const batch = memberIds.slice(i, i + BATCH_SIZE);
			const placeholders = batch.map(() => '?').join(',');
			
			const result = await c.env.svu_prod01.prepare(`
				DELETE FROM member_tokens WHERE member_id IN (${placeholders})
			`).bind(...batch).run();
			
			deletedCount += result.meta?.changes || batch.length;
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

// Bulk regenerate tokens - single request for multiple tokens
api.post('/bulk-regenerate-tokens', async (c) => {
	try {
		const body = await c.req.json();
		const memberIds: string[] = body.memberIds || [];
		const validityDays = Math.min(Math.max(body.validityDays || 90, 7), 365);
		
		if (memberIds.length === 0) {
			return jsonError('Keine Token-IDs angegeben', 400);
		}
		
		const { generateMemberToken } = await import('../utils/tokens');
		const secret = c.env.ADMIN_PASSWORD;
		const baseUrl = new URL(c.req.url).origin;
		const now = Date.now();
		const expiresAt = now + (validityDays * 24 * 60 * 60 * 1000);
		
		// Generate all tokens and prepare batch insert
		const tokenData: Array<{ memberId: string; token: string; updateUrl: string }> = [];
		
		for (const memberId of memberIds) {
			const token = await generateMemberToken(memberId, secret);
			tokenData.push({
				memberId,
				token,
				updateUrl: `${baseUrl}/update/${token}`
			});
		}
		
		// Batch upsert tokens (D1 has variable limits)
		const BATCH_SIZE = 25; // Lower for upserts with more bindings
		
		for (let i = 0; i < tokenData.length; i += BATCH_SIZE) {
			const batch = tokenData.slice(i, i + BATCH_SIZE);
			
			// Build batch upsert statement
			const values = batch.map(() => '(?, ?, ?, ?, 0)').join(', ');
			const bindings: any[] = [];
			batch.forEach(item => {
				bindings.push(item.memberId, item.token, now, expiresAt);
			});
			
			await c.env.svu_prod01.prepare(`
				INSERT INTO member_tokens (member_id, token, generated_at, expires_at, regenerated_count)
				VALUES ${values}
				ON CONFLICT(member_id) DO UPDATE SET
					token = excluded.token,
					generated_at = excluded.generated_at,
					expires_at = excluded.expires_at,
					regenerated_count = regenerated_count + 1
			`).bind(...bindings).run();
		}
		
		console.log({
			event: 'bulk_tokens_regenerated',
			count: tokenData.length,
			ip: c.req.header('cf-connecting-ip')
		});
		
		return jsonResponse({
			success: true,
			regeneratedCount: tokenData.length,
			tokens: tokenData.map(t => ({ memberId: t.memberId, updateUrl: t.updateUrl })),
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
