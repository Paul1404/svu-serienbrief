import type { Pool } from 'pg';

export interface AppVariables {
	db: Pool;
	adminPassword: string;
}

