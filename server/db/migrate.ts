/**
 * Migration runner — reads server/db/migrations/*.sql files in order
 * and executes them against the database. Tracks applied migrations
 * in a _migrations meta-table to avoid re-running.
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query('SELECT filename FROM _migrations ORDER BY filename');
  return new Set(result.rows.map((r: { filename: string }) => r.filename));
}

async function runMigrations() {
  console.log('🗄️  Running database migrations...\n');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ⏭️  ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✅ ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ❌ ${file} — FAILED`);
      throw err;
    } finally {
      client.release();
    }
  }

  if (count === 0) {
    console.log('\n  All migrations already applied.');
  } else {
    console.log(`\n✅ Applied ${count} migration(s).`);
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  });
