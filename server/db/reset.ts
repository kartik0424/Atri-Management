/**
 * Database reset — drops all tables and re-runs migrations + seed.
 * USE WITH CAUTION — this destroys all data.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { execSync } from 'node:child_process';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function reset() {
  console.log('⚠️  Resetting database — dropping all tables...\n');

  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      -- Drop all tables in the public schema
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      -- Drop the trigger function if it exists
      DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
    END $$;
  `);

  console.log('  ✅ All tables dropped.\n');
  await pool.end();

  // Re-run migrations and seed
  const serverDir = path.resolve(__dirname, '..');
  console.log('📦 Running migrations...\n');
  execSync('npx tsx db/migrate.ts', { cwd: serverDir, stdio: 'inherit' });

  console.log('\n🌱 Running seed...\n');
  execSync('npx tsx db/seed.ts', { cwd: serverDir, stdio: 'inherit' });

  console.log('\n✅ Database reset complete.');
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Reset failed:', err.message);
    process.exit(1);
  });
