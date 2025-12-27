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

export default api;
