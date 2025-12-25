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

		const query = `SELECT * FROM adresse LIMIT ? OFFSET ?`;
		const result = await c.env.svu_prod.prepare(query).bind(limit, offset).all();

		return jsonResponse({
			data: result.results,
			page,
			limit,
		});
	} catch (error: any) {
		return jsonError(error.message);
	}
});

// Search by column
api.get('/search', async (c) => {
	try {
		const column = c.req.query('column');
		const query = c.req.query('q');

		if (!column || !query) {
			return jsonError('Missing required parameters', 400);
		}

		const sql = `SELECT * FROM adresse WHERE ${sanitizeIdentifier(column)} LIKE ? LIMIT 100`;
		const result = await c.env.svu_prod.prepare(sql).bind(`%${query}%`).all();

		return jsonResponse({
			data: result.results,
			query,
		});
	} catch (error: any) {
		return jsonError(error.message);
	}
});

export default api;
