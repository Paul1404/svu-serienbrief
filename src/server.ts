import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { initDb, getDb, ensureCoreTables } from './db';
import type { AppVariables } from './appContext';
import pages from './routes/pages';
import api from './routes/api-node';
import letters from './routes/letters-node';
import update from './routes/update-node';
import { authMiddleware } from './middleware/auth';
import { render404Page, renderDashboard } from './templates/pages';

type AppEnv = { Variables: AppVariables };

const app = new Hono<AppEnv>();

// Initialize Postgres connection pool
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL environment variable is required');
}

initDb({
	connectionString,
	ssl: true,
});

// Request logging for PDF generation (helps debug stuck requests)
app.use('*', async (c, next) => {
	const path = new URL(c.req.url).pathname;
	if (path === '/letters/generate-pdfs' && c.req.method === 'POST') {
		process.stderr.write(`[REQ] POST /letters/generate-pdfs received\n`);
	}
	return next();
});

// Attach db and admin password to context variables
app.use('*', async (c, next) => {
	const db = getDb();
	const adminPassword = process.env.ADMIN_PASSWORD || '';

	c.set('db', db);
	c.set('adminPassword', adminPassword);

	return next();
});

// Known route prefixes for early 404 handling
const KNOWN_ROUTES = ['/', '/login', '/logout', '/logo.png', '/health', '/update', '/api', '/letters'];

function isKnownRoute(pathname: string): boolean {
	if (pathname === '/' || pathname === '/login' || pathname === '/logout' || pathname === '/logo.png' || pathname === '/health') {
		return true;
	}
	if (
		pathname.startsWith('/update') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/letters')
	) {
		return true;
	}
	return false;
}

// Public 404 for unknown routes (before auth)
app.use('*', async (c, next) => {
	const url = new URL(c.req.url);

	if (!isKnownRoute(url.pathname)) {
		return c.html(render404Page({ requestedPath: url.pathname }), 404);
	}

	return next();
});

// Public routes
app.get('/health', (c) => c.json({ ok: true }, 200));
app.route('/', pages);       // /login, /logout
app.route('/update', update);

// Protected routes (require authentication)
app.use('/*', authMiddleware as any);
app.get('/', (c) => c.html(renderDashboard()));
app.route('/api', api);
app.route('/letters', letters);

// Fallback 404
app.notFound((c) => {
	const url = new URL(c.req.url);
	return c.html(render404Page({ requestedPath: url.pathname }), 404);
});

const port = Number(process.env.PORT) || 3000;

// Start server immediately so Railway health check passes; DB setup runs in background
serve({
	fetch: app.fetch,
	port,
	hostname: '0.0.0.0',
});
console.log(`SVU Serienbrief Node server listening on port ${port}`);

ensureCoreTables()
	.then(() => console.log('Core tables ensured in database'))
	.catch((err) => {
		console.error('Fatal startup error while ensuring core tables', err);
		process.exit(1);
	});

