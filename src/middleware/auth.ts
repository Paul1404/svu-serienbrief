/**
 * Authentication middleware
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

export const sessions = new Map<string, { expires: number }>();

export function cleanupSessions() {
	const now = Date.now();
	for (const [id, session] of sessions.entries()) {
		if (now > session.expires) {
			sessions.delete(id);
		}
	}
}

export function getSessionId(request: Request): string | null {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return null;

	const cookies = Object.fromEntries(
		cookieHeader.split(';').map((c) => {
			const [key, ...val] = c.trim().split('=');
			return [key, val.join('=')];
		})
	);

	return cookies['session'] || null;
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
	const sessionId = getSessionId(c.req.raw);
	const url = new URL(c.req.url);

	if (!sessionId || !sessions.has(sessionId)) {
		console.log({
			event: 'auth_failed',
			reason: !sessionId ? 'no_session_cookie' : 'session_not_found',
			path: url.pathname,
			method: c.req.method
		});
		
		// Store the original URL to redirect back after login
		const originalUrl = c.req.url;
		const returnTo = url.pathname + url.search;
		
		// Don't include /login or /logout in the return path
		if (returnTo !== '/login' && returnTo !== '/logout') {
			return c.redirect(`/login?return=${encodeURIComponent(returnTo)}`);
		}
		return c.redirect('/login');
	}

	const session = sessions.get(sessionId)!;
	if (Date.now() > session.expires) {
		sessions.delete(sessionId);
		console.log({
			event: 'session_expired',
			session_id: sessionId.substring(0, 8) + '...',
			path: url.pathname
		});
		
		// Store the original URL for redirect after re-login
		const originalUrl = c.req.url;
		const returnTo = url.pathname + url.search;
		
		if (returnTo !== '/login' && returnTo !== '/logout') {
			return c.redirect(`/login?return=${encodeURIComponent(returnTo)}`);
		}
		return c.redirect('/login');
	}

	console.log({
		event: 'auth_success',
		session_id: sessionId.substring(0, 8) + '...',
		path: url.pathname,
		method: c.req.method
	});

	await next();
}
