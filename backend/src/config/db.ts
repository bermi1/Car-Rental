import { Pool } from 'pg';
import { env } from './env';

// Supabase (and most managed Postgres) requires SSL; node-postgres doesn't
// negotiate it automatically from a `sslmode=require` query param the way
// libpq does, so it has to be configured explicitly here.
const needsSsl = /supabase\.co|supabase\.com|sslmode=require/.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
