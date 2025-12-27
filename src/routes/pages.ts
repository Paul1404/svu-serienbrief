/**
 * Page routes (HTML responses)
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { renderLoginPage, renderDashboard } from '../templates/pages';
import { createSession } from '../middleware/auth';

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
		const clientIP = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
		const userAgent = c.req.header('user-agent') || 'unknown';
		const country = c.req.raw.cf?.country || 'unknown';

		if (!c.env.ADMIN_PASSWORD) {
			console.log({
				event: 'login_error',
				reason: 'missing_admin_password_config',
				client_ip: clientIP
			});
			return c.html(renderLoginPage('Server configuration error'), 500);
		}

		if (password !== c.env.ADMIN_PASSWORD) {
			console.log({
				event: 'login_failed',
				reason: 'invalid_password',
				client_ip: clientIP,
				country: country
			});
			// Add a small delay to prevent brute force attacks
			await new Promise(resolve => setTimeout(resolve, 1000));
			return c.html(renderLoginPage('Ungültiges Passwort'), 401);
		}

		const { sessionId, expires } = await createSession(c.env.svu_prod01, clientIP, userAgent);

		console.log({
			event: 'login_success',
			session_id: sessionId.substring(0, 8) + '...',
			client_ip: clientIP,
			country: country,
			session_duration_hours: 8
		});

		const maxAge = Math.floor((expires - Date.now()) / 1000);
		c.header('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`);
		
		// Redirect back to the original URL if provided
		const returnTo = c.req.query('return') || '/';
		// Sanitize the return URL to prevent open redirects
		const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
		return c.redirect(safeReturnTo, 302);
	} catch (error: any) {
		console.log({
			event: 'login_exception',
			error: error.message,
			stack: error.stack
		});
		return c.html(renderLoginPage('Login fehlgeschlagen: ' + error.message), 500);
	}
});

// Logout
pages.get('/logout', async (c) => {
	const cookieHeader = c.req.header('Cookie');
	if (cookieHeader) {
		const cookies = Object.fromEntries(
			cookieHeader.split(';').map((c) => {
				const [key, ...val] = c.trim().split('=');
				return [key, val.join('=')];
			})
		);
		const sessionId = cookies['session'];
		if (sessionId) {
			await c.env.svu_prod01.prepare('DELETE FROM admin_sessions WHERE session_id = ?')
				.bind(sessionId).run();
			console.log({
				event: 'logout',
				session_id: sessionId.substring(0, 8) + '...'
			});
		}
	}

	c.header('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
	return c.redirect('/login', 302);
});

// Dashboard (protected)
pages.get('/', (c) => {
	return c.html(renderDashboard());
});

export default pages;