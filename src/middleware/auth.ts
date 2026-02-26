/**
 * Authentication middleware with improved session management
 * Ported from Cloudflare D1 to Postgres (Neon) via the shared DB helper.
 */

import type { Context, Next } from 'hono';
import { query, queryOne } from '../db';

interface Session {
	session_id: string;
	expires: number;
	created_at: number;
	last_activity: number;
	ip_address: string;
	user_agent: string;
}

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
const MAX_SESSIONS_PER_IP = 5; // Prevent session flooding

export async function cleanupSessions() {
	const now = Date.now();

	const result = await query(
		`DELETE FROM admin_sessions 
		 WHERE expires < $1 OR ($2 - last_activity) > $3`,
		[now, now, IDLE_TIMEOUT]
	);

	if (result.rowCount && result.rowCount > 0) {
		console.log({
			event: 'sessions_cleaned',
			count: result.rowCount
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

export async function createSession(ipAddress: string, userAgent: string): Promise<{ sessionId: string; expires: number }> {
	// Cleanup old sessions first
	await cleanupSessions();

	// Check for too many sessions from same IP
	const ipSessionCount = await queryOne<{ count: string }>(
		'SELECT COUNT(*) as count FROM admin_sessions WHERE ip_address = $1',
		[ipAddress]
	);

	if (Number(ipSessionCount?.count ?? 0) >= MAX_SESSIONS_PER_IP) {
		// Remove oldest session for this IP
		const oldestSession = await queryOne<{ session_id: string }>(
			'SELECT session_id FROM admin_sessions WHERE ip_address = $1 ORDER BY created_at ASC LIMIT 1',
			[ipAddress]
		);

		if (oldestSession) {
			await query('DELETE FROM admin_sessions WHERE session_id = $1', [oldestSession.session_id]);
			console.log({
				event: 'session_limit_reached',
				ip: ipAddress,
				action: 'removed_oldest',
				removed_session_id: oldestSession.session_id.substring(0, 8) + '...'
			});
		}
	}

	const sessionId = crypto.randomUUID();
	const now = Date.now();
	const expires = now + SESSION_DURATION;
	const truncatedUA = userAgent.substring(0, 255);

	await query(
		`INSERT INTO admin_sessions (session_id, expires, created_at, last_activity, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[sessionId, expires, now, now, ipAddress, truncatedUA]
	);

	console.log({
		event: 'session_created',
		session_id: sessionId.substring(0, 8) + '...',
		ip: ipAddress,
		user_agent_prefix: truncatedUA.substring(0, 50) + '...',
		expires_in_hours: SESSION_DURATION / (60 * 60 * 1000)
	});

	return { sessionId, expires };
}

export async function validateSession(sessionId: string, ipAddress: string, userAgent: string): Promise<boolean> {
	const session = await queryOne<Session>(
		'SELECT * FROM admin_sessions WHERE session_id = $1',
		[sessionId]
	);
	
	if (!session) {
		console.log({
			event: 'session_validation_failed',
			reason: 'session_not_found',
			session_id: sessionId.substring(0, 8) + '...',
			ip: ipAddress
		});
		return false;
	}
	
	const now = Date.now();
	
	// Check expiration
	if (now > session.expires) {
		await query('DELETE FROM admin_sessions WHERE session_id = $1', [sessionId]);
		console.log({
			event: 'session_validation_failed',
			reason: 'expired',
			session_id: sessionId.substring(0, 8) + '...',
			expired_ms_ago: now - session.expires
		});
		return false;
	}
	
	// Check idle timeout
	if ((now - session.last_activity) > IDLE_TIMEOUT) {
		await query('DELETE FROM admin_sessions WHERE session_id = $1', [sessionId]);
		console.log({
			event: 'session_validation_failed',
			reason: 'idle_timeout',
			session_id: sessionId.substring(0, 8) + '...',
			idle_ms: now - session.last_activity,
			idle_timeout_ms: IDLE_TIMEOUT
		});
		return false;
	}
	
	// Validate BOTH IP and User-Agent changed (security measure)
	// This allows dual-WAN setups while still detecting session theft
	const ipChanged = session.ip_address !== ipAddress;
	const userAgentChanged = session.user_agent !== userAgent;
	
	// Log any changes (even if not rejecting)
	if (ipChanged || userAgentChanged) {
		console.log({
			event: 'session_credential_change_detected',
			session_id: sessionId.substring(0, 8) + '...',
			ip_changed: ipChanged,
			ua_changed: userAgentChanged,
			original_ip: session.ip_address,
			current_ip: ipAddress,
			original_ua_prefix: session.user_agent.substring(0, 50) + '...',
			current_ua_prefix: userAgent.substring(0, 50) + '...',
			will_reject: ipChanged && userAgentChanged
		});
	}
	
	if (ipChanged && userAgentChanged) {
		await query('DELETE FROM admin_sessions WHERE session_id = $1', [sessionId]);
		console.log({
			event: 'session_validation_failed',
			reason: 'ip_and_useragent_mismatch',
			session_id: sessionId.substring(0, 8) + '...',
			original_ip: session.ip_address,
			current_ip: ipAddress
		});
		return false;
	}
	
	// Update last activity
	await query(
		'UPDATE admin_sessions SET last_activity = $1 WHERE session_id = $2',
		[now, sessionId]
	);
	
	console.log({
		event: 'session_validated',
		session_id: sessionId.substring(0, 8) + '...',
		ip: ipAddress,
		ip_changed: ipChanged,
		ua_changed: userAgentChanged,
		age_minutes: Math.round((now - session.created_at) / (60 * 1000)),
		idle_seconds: Math.round((now - session.last_activity) / 1000)
	});
	
	return true;
}

export async function authMiddleware(c: Context, next: Next) {
	// Run periodic cleanup (throttled - only every 100 requests)
	if (Math.random() < 0.01) {
		await cleanupSessions();
	}
	
	const sessionId = getSessionId(c.req.raw);
	const url = new URL(c.req.url);
	const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
	const userAgent = c.req.header('user-agent') || '';

	// Determine why auth failed (for UX messaging)
	let authFailReason: 'no_cookie' | 'expired' | null = null;
	
	if (!sessionId) {
		authFailReason = 'no_cookie';
	} else {
		const isValid = await validateSession(sessionId, ipAddress, userAgent);
		if (!isValid) {
			authFailReason = 'expired';
		}
	}
	
	if (authFailReason) {
		console.log({
			event: 'auth_failed',
			reason: authFailReason === 'no_cookie' ? 'no_session_cookie' : 'invalid_session',
			path: url.pathname,
			method: c.req.method,
			ip: ipAddress,
			user_agent_prefix: userAgent.substring(0, 50) + '...',
			session_id: sessionId ? sessionId.substring(0, 8) + '...' : 'none',
			all_headers: {
				'cf-connecting-ip': c.req.header('cf-connecting-ip'),
				'x-forwarded-for': c.req.header('x-forwarded-for'),
				'user-agent': userAgent.substring(0, 100)
			}
		});
		
		// Store the original URL to redirect back after login
		const returnTo = url.pathname + url.search;
		
		// Build redirect URL with session expired message if applicable
		const loginParams = new URLSearchParams();
		
		// Only show "expired" message if user HAD a session cookie (not first visit)
		if (authFailReason === 'expired') {
			loginParams.set('expired', '1');
		}
		
		// Don't include /login or /logout in the return path
		if (returnTo !== '/login' && returnTo !== '/logout') {
			loginParams.set('return', returnTo);
		}
		
		const queryString = loginParams.toString();
		return c.redirect(`/login${queryString ? '?' + queryString : ''}`);
	}

	if (sessionId) {
		console.log({
			event: 'auth_success',
			session_id: sessionId.substring(0, 8) + '...',
			path: url.pathname,
			method: c.req.method,
			ip: ipAddress
		});
	}

	await next();
}
