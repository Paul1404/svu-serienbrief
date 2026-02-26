import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { initDb, getDb } from './db';
import type { AppVariables } from './appContext';
import pages from './routes/pages';
import api from './routes/api-node';
import letters from './routes/letters-node';
import update from './routes/update-node';
import { authMiddleware } from './middleware/auth';
import { render404Page } from './templates/pages';

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

// Attach db and admin password to context variables
app.use('*', async (c, next) => {
	const db = getDb();
	const adminPassword = process.env.ADMIN_PASSWORD || '';

	c.set('db', db);
	c.set('adminPassword', adminPassword);

	return next();
});

// Known route prefixes for early 404 handling
const KNOWN_ROUTES = ['/', '/login', '/logout', '/logo.png', '/update', '/api', '/letters'];

function isKnownRoute(pathname: string): boolean {
	if (pathname === '/' || pathname === '/login' || pathname === '/logout' || pathname === '/logo.png') {
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
app.route('/', pages);
app.route('/update', update);

// Protected routes (require authentication)
app.use('/*', authMiddleware as any);
app.route('/api', api);
app.route('/letters', letters);

// Fallback 404
app.notFound((c) => {
	const url = new URL(c.req.url);
	return c.html(render404Page({ requestedPath: url.pathname }), 404);
});

const port = Number(process.env.PORT) || 3000;

console.log(`SVU Serienbrief Node server listening on port ${port}`);

serve({
	fetch: app.fetch,
	port,
});

