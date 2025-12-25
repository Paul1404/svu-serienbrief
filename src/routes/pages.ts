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
return c.redirect('/', 302);
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

// Logo
pages.get('/logo.png', (c) => {
const logoData = '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';
const bytes = Uint8Array.from(atob(logoData), (c) => c.charCodeAt(0));
return c.body(bytes, 200, {
'Content-Type': 'image/png',
'Cache-Control': 'public, max-age=86400',
});
});

export default pages;
