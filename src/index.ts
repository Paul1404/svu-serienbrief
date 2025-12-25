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

const app = new Hono<{ Bindings: Env }>();

// Public routes (no auth required)
app.route('/', pages);

// Protected API routes (auth required)
app.use('/api/*', authMiddleware);
app.route('/api', api);

export default app;
