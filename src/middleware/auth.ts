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

	if (!sessionId || !sessions.has(sessionId)) {
		// Store the original URL to redirect back after login
		const originalUrl = c.req.url;
		const url = new URL(originalUrl);
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
		// Store the original URL for redirect after re-login
		const originalUrl = c.req.url;
		const url = new URL(originalUrl);
		const returnTo = url.pathname + url.search;
		
		if (returnTo !== '/login' && returnTo !== '/logout') {
			return c.redirect(`/login?return=${encodeURIComponent(returnTo)}`);
		}
		return c.redirect('/login');
	}

	await next();
}
