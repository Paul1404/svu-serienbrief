/**
 * SV 1945 Untereuerheim e.V. - Member Database
 * "Wir sind Untereuerheim"
 * 
 * Refactored with Hono framework for better organization
 */

import { Hono } from 'hono';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import pages from './routes/pages';
import api from './routes/api';
import letters from './routes/letters';
import update from './routes/update';

const app = new Hono<{ Bindings: Env }>();

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

export default app;
