/**
 * Page routes (HTML responses)
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { renderLoginPage, renderDashboard } from '../templates/pages';
import { sessions, cleanupSessions } from '../middleware/auth';

const pages = new Hono<{ Bindings: Env }>();

// Login page
pages.get('/login', (c) => {
return c.html(renderLoginPage());
});

// Handle login form submission
pages.post('/login', async (c) => {
try {
const formData = await c.req.formData();
const password = formData.get('password');

if (!c.env.ADMIN_PASSWORD) {
return c.html(renderLoginPage('Server configuration error'), 500);
}

if (password !== c.env.ADMIN_PASSWORD) {
return c.html(renderLoginPage('Invalid password'), 401);
}

const sessionId = crypto.randomUUID();
const expires = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
sessions.set(sessionId, { expires });
cleanupSessions();

c.header('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800; Path=/`);
		
		// Redirect back to the original URL if provided
		const returnTo = c.req.query('return') || '/';
		// Sanitize the return URL to prevent open redirects
		const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
		return c.redirect(safeReturnTo, 302);
	} catch (error: any) {
		return c.html(renderLoginPage('Login failed: ' + error.message), 500);
	}
});

// Logout
pages.get('/logout', (c) => {
	const cookieHeader = c.req.header('Cookie');
	if (cookieHeader) {
		const cookies = Object.fromEntries(
			cookieHeader.split(';').map((c) => {
				const [key, ...val] = c.trim().split('=');
				return [key, val.join('=')];
			})
		);
		const sessionId = cookies['session'];
		if (sessionId) sessions.delete(sessionId);
	}

	c.header('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
	return c.redirect('/login', 302);
});

// Dashboard (protected)
pages.get('/', (c) => {
	return c.html(renderDashboard());
});

export default pages;