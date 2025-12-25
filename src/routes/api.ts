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
		const query = `SELECT * FROM adresse LIMIT ? OFFSET ?`;
		const result = await c.env.svu_prod.prepare(query).bind(limit, offset).all();
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
		const sql = `SELECT * FROM adresse WHERE ${sanitizeIdentifier(column)} LIKE ? LIMIT 100`;
		const result = await c.env.svu_prod.prepare(sql).bind(`%${query}%`).all();
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

export default api;
