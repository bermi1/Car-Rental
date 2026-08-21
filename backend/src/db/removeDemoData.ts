import { pool } from '../config/db';

/**
 * Removes the demonstration data that `npm run seed` writes.
 *
 * The seed exists so a fresh checkout has something to look at. A live system
 * must not carry it: fake companies show up in the platform admin's list, fake
 * clients answer to real phone numbers, and demo passwords are published in
 * this repository.
 *
 *   npm run remove-demo-data -- --confirm
 *
 * Deletion is by the exact identifiers the seed writes and nothing else — no
 * pattern matching on names — so a real company that happens to be called
 * something similar is never caught by it. The flag is required because this
 * is not reversible.
 */

const DEMO_COMPANY_SLUGS = ['serengeti-car-hire', 'kilimanjaro-rentals', 'default'];

const DEMO_STAFF_EMAILS = [
  'owner@rentalplatform.co.tz',
  'admin@rental.co.tz',
  'staff@rental.co.tz',
  'admin@kilirentals.co.tz',
];

const DEMO_CLIENT_PHONES = ['+255712345001', '+255712345002', '+255712345003'];

async function main() {
  const confirmed = process.argv.includes('--confirm');

  const { rows: companies } = await pool.query(
    'SELECT id, name, slug FROM companies WHERE slug = ANY($1)',
    [DEMO_COMPANY_SLUGS]
  );
  const { rows: staff } = await pool.query(
    'SELECT id, email FROM staff_users WHERE lower(email) = ANY($1)',
    [DEMO_STAFF_EMAILS]
  );
  const { rows: clients } = await pool.query(
    'SELECT id, full_name, phone FROM clients WHERE phone = ANY($1)',
    [DEMO_CLIENT_PHONES]
  );

  if (!companies.length && !staff.length && !clients.length) {
    console.log('No demo data found. Nothing to remove.');
    await pool.end();
    return;
  }

  console.log('This will permanently delete:');
  for (const c of companies) console.log(`  company  ${c.name} (${c.slug}) — and its fleet, bookings and staff`);
  for (const s of staff) console.log(`  staff    ${s.email}`);
  for (const c of clients) console.log(`  customer ${c.full_name} (${c.phone})`);

  if (!confirmed) {
    console.log('\nNothing was deleted. Re-run with --confirm to go ahead:');
    console.log('  npm run remove-demo-data -- --confirm');
    await pool.end();
    return;
  }

  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // Bookings hold a client reference, so the clients' rentals must go before
    // the clients themselves — but only rentals that belong to demo clients.
    if (clients.length) {
      const clientIds = clients.map((c) => c.id);
      await db.query('DELETE FROM bookings WHERE client_id = ANY($1)', [clientIds]);
      await db.query('DELETE FROM clients WHERE id = ANY($1)', [clientIds]);
    }

    // Companies cascade to their vehicles, bookings, staff and settings.
    if (companies.length) {
      await db.query('DELETE FROM companies WHERE id = ANY($1)', [companies.map((c) => c.id)]);
    }

    // Any demo staff account not already taken out with its company — the
    // seeded super admin belongs to no company at all.
    if (staff.length) {
      await db.query('DELETE FROM staff_users WHERE id = ANY($1)', [staff.map((s) => s.id)]);
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }

  console.log('\nDemo data removed.');

  const { rows: owners } = await pool.query(
    "SELECT count(*)::int AS n FROM staff_users WHERE role = 'super_admin' AND is_active"
  );
  if (owners[0].n === 0) {
    console.log('\nThere is now no platform owner account. Create yours before signing in:');
    console.log('  npm run create-owner -- --email you@example.com --password "your password"');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('Could not remove the demo data:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
