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

export default api;
