/**
 * Authentication middleware with improved session management
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

interface Session {
	expires: number;
	createdAt: number;
	lastActivity: number;
	ipAddress: string;
	userAgent: string;
}

export const sessions = new Map<string, Session>();

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
const MAX_SESSIONS_PER_IP = 5; // Prevent session flooding

export function cleanupSessions() {
	const now = Date.now();
	let cleaned = 0;
	
	for (const [id, session] of sessions.entries()) {
		if (now > session.expires || (now - session.lastActivity) > IDLE_TIMEOUT) {
			sessions.delete(id);
			cleaned++;
		}
	}
	
	if (cleaned > 0) {
		console.log({
			event: 'sessions_cleaned',
			count: cleaned,
			remaining: sessions.size
		});
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

export function createSession(ipAddress: string, userAgent: string): { sessionId: string; expires: number } {
	// Cleanup old sessions first
	cleanupSessions();
	
	// Check for too many sessions from same IP
	const ipSessions = Array.from(sessions.values()).filter(s => s.ipAddress === ipAddress);
	if (ipSessions.length >= MAX_SESSIONS_PER_IP) {
		// Remove oldest session for this IP
		const oldestSession = Array.from(sessions.entries())
			.filter(([_, s]) => s.ipAddress === ipAddress)
			.sort(([_, a], [__, b]) => a.createdAt - b.createdAt)[0];
		if (oldestSession) {
			sessions.delete(oldestSession[0]);
			console.log({
				event: 'session_limit_reached',
				ip: ipAddress,
				action: 'removed_oldest'
			});
		}
	}
	
	const sessionId = crypto.randomUUID();
	const now = Date.now();
	const expires = now + SESSION_DURATION;
	
	sessions.set(sessionId, {
		expires,
		createdAt: now,
		lastActivity: now,
		ipAddress,
		userAgent: userAgent.substring(0, 255)
	});
	
	return { sessionId, expires };
}

export function validateSession(sessionId: string, ipAddress: string, userAgent: string): boolean {
	const session = sessions.get(sessionId);
	if (!session) return false;
	
	const now = Date.now();
	
	// Check expiration
	if (now > session.expires) {
		sessions.delete(sessionId);
		return false;
	}
	
	// Check idle timeout
	if ((now - session.lastActivity) > IDLE_TIMEOUT) {
		sessions.delete(sessionId);
		console.log({
			event: 'session_idle_timeout',
			session_id: sessionId.substring(0, 8) + '...'
		});
		return false;
	}
	
	// Validate BOTH IP and User-Agent changed (security measure)
	// This allows dual-WAN setups while still detecting session theft
	const ipChanged = session.ipAddress !== ipAddress;
	const userAgentChanged = session.userAgent !== userAgent;
	
	if (ipChanged && userAgentChanged) {
		sessions.delete(sessionId);
		console.log({
			event: 'session_security_breach',
			session_id: sessionId.substring(0, 8) + '...',
			reason: 'ip_and_useragent_mismatch',
			original_ip: session.ipAddress,
			current_ip: ipAddress
		});
		return false;
	}
	
	// Update last activity
	session.lastActivity = now;
	
	return true;
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
	// Run periodic cleanup (throttled - only every 100 requests)
	if (Math.random() < 0.01) {
		cleanupSessions();
	}
	
	const sessionId = getSessionId(c.req.raw);
	const url = new URL(c.req.url);
	const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
	const userAgent = c.req.header('user-agent') || '';

	if (!sessionId || !validateSession(sessionId, ipAddress, userAgent)) {
		console.log({
			event: 'auth_failed',
			reason: !sessionId ? 'no_session_cookie' : 'invalid_session',
			path: url.pathname,
			method: c.req.method,
			ip: ipAddress
		});
		
		// Store the original URL to redirect back after login
		const returnTo = url.pathname + url.search;
		
		// Don't include /login or /logout in the return path
		if (returnTo !== '/login' && returnTo !== '/logout') {
			return c.redirect(`/login?return=${encodeURIComponent(returnTo)}`);
		}
		return c.redirect('/login');
	}

	console.log({
		event: 'auth_success',
		session_id: sessionId.substring(0, 8) + '...',
		path: url.pathname,
		method: c.req.method,
		active_sessions: sessions.size
	});

	await next();
}
