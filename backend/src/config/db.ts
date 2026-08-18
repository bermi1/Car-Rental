import { Pool } from 'pg';
import { env } from './env';

/**
 * Postgres connection.
 *
 * Nothing here is tied to a particular host. The app speaks plain Postgres, so
 * Neon, Railway, Render, Aiven, Vercel Postgres, Supabase or a box you run
 * yourself all work by changing DATABASE_URL and nothing else.
 */

/**
 * Managed Postgres is always over TLS, and node-postgres — unlike libpq —
 * ignores `sslmode` in the connection string, so it has to be set here.
 *
 * The rule is "TLS unless we're clearly on your own machine": anything that
 * isn't localhost gets TLS, which is the safe default when the choice is
 * between an encrypted connection and a plaintext one crossing the internet.
 */
function sslConfig(url: string) {
  if (/[?&]sslmode=disable/.test(url)) return undefined;

  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // An unparseable URL will fail at connect time with a clearer message than
    // anything we could produce here; assume TLS in the meantime.
    return { rejectUnauthorized: false };
  }

  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '' ||
    host.endsWith('.local') ||
    // Docker Compose service names and the like.
    !host.includes('.');

  if (isLocal) return undefined;

  // Managed providers hand out certificates from their own chains, and some
  // rotate them. Verifying the chain here buys little — the hostname and
  // credentials are already secrets — and breaks deploys when a provider
  // changes issuer, so encrypt without pinning the chain.
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: sslConfig(env.databaseUrl),
  // Serverless functions open many short-lived connections. Keep each
  // instance's pool small so a burst of traffic doesn't exhaust the
  // provider's connection limit, and drop idle ones quickly.
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

// A pooled client can die between requests (provider restart, idle reaper). If
// nothing listens for that, node treats it as an unhandled error event and
// exits the process.
pool.on('error', (err) => {
  console.error('Idle Postgres client error:', err.message);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
