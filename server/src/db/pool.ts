import path from 'node:path';
import dotenv from 'dotenv';

// Load .env from monorepo root BEFORE creating the pool
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log pool errors (don't crash the process)
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export default pool;
