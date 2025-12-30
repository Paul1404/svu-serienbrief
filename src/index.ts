/**
 * SV 1945 Untereuerheim e.V. - Member Database
 * "Wir sind Untereuerheim"
 * 
 * Refactored with Hono framework for better organization
 */

import { Hono } from 'hono';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import pages from './routes/pages';
import api from './routes/api';
import letters from './routes/letters';
import update from './routes/update';
import { render404Page, type NotFoundStats } from './templates/pages';

const app = new Hono<{ Bindings: Env }>();

// Public routes (no authentication required)
app.get('/login', (c) => pages.request('/login', c.req.raw, c.env));
app.post('/login', (c) => pages.request('/login', c.req.raw, c.env));
app.get('/logout', (c) => pages.request('/logout', c.req.raw, c.env));
app.get('/logo.png', (c) => pages.request('/logo.png', c.req.raw, c.env));

// Public member update routes (secured by token)
app.route('/update', update);

// Protected routes (require authentication)
app.use('/*', authMiddleware);
app.get('/', (c) => pages.request('/', c.req.raw, c.env));

// Protected API routes
app.route('/api', api);

// Protected letter generation routes
app.route('/letters', letters);

// Custom 404 page with absurdly over-engineered stats
app.notFound(async (c) => {
	const startTime = performance.now();
	const url = new URL(c.req.url);
	
	// Helper to safely query a table (returns 0 if table doesn't exist)
	const safeCount = async (query: string): Promise<number> => {
		try {
			const result = await c.env.svu_prod01.prepare(query).first();
			return (result as any)?.count ?? 0;
		} catch {
			return 0; // Table doesn't exist or other error
		}
	};
	
	// Fetch ALL the stats because why not? 🤓
	const dbStart = performance.now();
	
	const [members, tokens, changes, sessions, accesses] = await Promise.all([
		safeCount('SELECT COUNT(*) as count FROM auswertung'),
		safeCount('SELECT COUNT(*) as count FROM member_tokens WHERE expires_at > datetime("now")'),
		safeCount('SELECT COUNT(*) as count FROM member_changes_log'),
		safeCount('SELECT COUNT(*) as count FROM admin_sessions'),
		safeCount('SELECT COUNT(*) as count FROM member_access_log'),
	]);
	
	const dbQueryTimeMs = performance.now() - dbStart;
	
	// Extract Cloudflare request info
	const cf = c.req.raw.cf as { colo?: string; country?: string; city?: string } | undefined;
	
	const stats: NotFoundStats = {
		requestedPath: url.pathname,
		method: c.req.method,
		timestamp: new Date().toISOString(),
		cfRay: c.req.header('cf-ray'),
		colo: cf?.colo,
		country: cf?.country,
		city: cf?.city,
		
		totalMembers: members,
		totalTokens: tokens,
		totalChanges: changes,
		totalSessions: sessions,
		totalAccesses: accesses,
		
		dbQueryTimeMs,
		workerCpuTimeMs: performance.now() - startTime,
	};
	
	return c.html(render404Page(stats), 404);
});

export default app;
