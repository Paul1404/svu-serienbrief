/**
 * SV 1945 Untereuerheim e.V. - Member Database
 * "Wir sind Untereuerheim"
 * 
 * Refactored with Hono framework for better organization
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import pages from './routes/pages';
import api from './routes/api';
import letters from './routes/letters';
import update from './routes/update';
import { render404Page, type NotFoundStats } from './templates/pages';

const app = new Hono<{ Bindings: Env }>();

// Known route prefixes - anything outside these gets 404 immediately (before auth)
const KNOWN_ROUTES = ['/', '/login', '/logout', '/logo.png', '/update/', '/api/', '/letters/'];

function isKnownRoute(pathname: string): boolean {
	// Exact matches
	if (pathname === '/' || pathname === '/login' || pathname === '/logout' || pathname === '/logo.png') {
		return true;
	}
	// Prefix matches
	if (pathname.startsWith('/update/') || pathname.startsWith('/api/') || pathname.startsWith('/letters/')) {
		return true;
	}
	return false;
}

// Helper to render 404 page
function render404(c: Context<{ Bindings: Env }>, startTime: number): Response {
	const url = new URL(c.req.url);
	const cf = c.req.raw.cf as { colo?: string; country?: string; city?: string } | undefined;
	
	const stats: NotFoundStats = {
		requestedPath: url.pathname,
		method: c.req.method,
		colo: cf?.colo,
		country: cf?.country,
		city: cf?.city,
		workerCpuTimeMs: performance.now() - startTime,
	};
	
	return c.html(render404Page(stats), 404);
}

// Track request start time for all requests
app.use('*', async (c: Context<{ Bindings: Env }>, next: Next) => {
	c.set('startTime', performance.now());
	await next();
});

// Public 404 for unknown routes (before auth, so everyone sees it)
app.use('*', async (c: Context<{ Bindings: Env }>, next: Next) => {
	const url = new URL(c.req.url);
	
	if (!isKnownRoute(url.pathname)) {
		// Unknown route - show 404 immediately (no auth needed)
		const startTime = c.get('startTime') || performance.now();
		return render404(c, startTime);
	}
	
	await next();
});

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

// Fallback 404 for authenticated users hitting unknown sub-routes
app.notFound((c) => {
	const startTime = c.get('startTime') || performance.now();
	return render404(c, startTime);
});

export default app;
