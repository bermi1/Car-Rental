import { pool } from '../config/db';
import { hashPassword } from '../utils/password';

/**
 * Creates (or resets) the platform owner account.
 *
 * A fresh database has no way in: staff accounts are only created from inside
 * the console, and you need an account to open the console. This is the one
 * bootstrap step, and it's the only place a super admin can be minted without
 * already being one.
 *
 *   npm run create-owner -- --email you@example.com --password 'a good one'
 *
 * Run it again with the same email to reset that account's password.
 */

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}

async function main() {
  const email = (arg('email') || process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const password = arg('password') || process.env.OWNER_PASSWORD || '';
  const name = arg('name') || process.env.OWNER_NAME || 'Platform Owner';

  if (!email || !password) {
    console.error(
      'Usage: npm run create-owner -- --email you@example.com --password "your password" [--name "Your Name"]'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const password_hash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO staff_users (name, email, password_hash, role, company_id, is_active)
     VALUES ($1, $2, $3, 'super_admin', NULL, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = 'super_admin',
           is_active = true
     RETURNING id, email, role, (xmax = 0) AS created`,
    [name, email, password_hash]
  );

  const owner = rows[0];
  console.log(
    owner.created
      ? `Platform owner created: ${owner.email}`
      : `Existing account updated to platform owner, password reset: ${owner.email}`
  );
  console.log('Sign in at /login, then register your companies on the Companies screen.');

  await pool.end();
}

main().catch(async (err) => {
  console.error('Could not create the owner account:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
