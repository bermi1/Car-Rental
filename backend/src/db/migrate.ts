import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

async function migrate() {
  const schemaPath = path.resolve(process.cwd(), '../database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);
  console.log('Schema applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
