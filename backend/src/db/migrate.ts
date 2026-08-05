import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

/**
 * Applies the base schema (once, on an empty database) and then every file in
 * database/migrations in filename order.
 *
 * Migrations are written to be idempotent, and each one that has run is
 * recorded in schema_migrations so re-running this is always safe — including
 * against a database that already holds live data.
 *
 * Paths resolve from the repository root so this works whether it's invoked
 * from backend/ or from the root via `npm run migrate`.
 */

function repoRoot(): string {
  // backend/src/db -> repository root
  return path.resolve(__dirname, '../../..');
}

async function applyBaseSchema() {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.staff_users') IS NOT NULL AS installed`
  );
  if (rows[0].installed) {
    console.log('Base schema already present — skipping.');
    return;
  }
  const sql = fs.readFileSync(path.join(repoRoot(), 'database/schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Base schema applied.');
}

async function applyMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(repoRoot(), 'database/migrations');
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  = ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`  + ${file}`);
  }
}

async function migrate() {
  await applyBaseSchema();
  await applyMigrations();
  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
