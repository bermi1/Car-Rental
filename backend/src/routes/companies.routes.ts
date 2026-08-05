import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireSuperAdmin, resolveCompany, AuthedRequest } from '../middleware/auth';
import { logActivity } from '../services/activityLog';

const router = Router();

/** Turns a company name into a URL-safe slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Companies the caller may act inside. A super admin sees the whole platform;
 * anyone else sees only their own, which keeps the company switcher in the
 * console honest without a second permission check on the client.
 */
router.get('/', requireAuth, resolveCompany, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'super_admin') {
    const { rows } = await query(
      `SELECT c.*,
              (SELECT count(*) FROM vehicles v WHERE v.company_id = c.id)::int AS vehicle_count,
              (SELECT count(*) FROM bookings b WHERE b.company_id = c.id)::int AS booking_count,
              (SELECT count(*) FROM staff_users s WHERE s.company_id = c.id)::int AS staff_count
         FROM companies c
        ORDER BY c.created_at`
    );
    return res.json(rows);
  }

  const { rows } = await query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
  res.json(rows);
});

router.get('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const { rows } = await query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
  res.json(rows[0]);
});

/**
 * Registers a new company on the platform. Creating the company also creates
 * its settings row, so a brand-new tenant can quote a booking immediately
 * rather than erroring on missing configuration.
 */
router.post('/', requireAuth, requireSuperAdmin, async (req: AuthedRequest, res) => {
  const { name, registration_number, contact_email, contact_phone, region } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const base = slugify(name);
  if (!base) return res.status(400).json({ error: 'Company name must contain letters or numbers' });

  // Slugs are unique platform-wide; suffix until one is free.
  let slug = base;
  for (let n = 2; ; n++) {
    const { rows } = await query('SELECT 1 FROM companies WHERE slug = $1', [slug]);
    if (!rows.length) break;
    slug = `${base}-${n}`;
  }

  const { rows } = await query(
    `INSERT INTO companies (name, slug, registration_number, contact_email, contact_phone, region)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, slug, registration_number || null, contact_email || null, contact_phone || null, region || null]
  );
  const company = rows[0];

  await query('INSERT INTO company_settings (company_id) VALUES ($1)', [company.id]);

  await logActivity({
    actorStaffId: req.user!.sub,
    companyId: company.id,
    action: 'create',
    entityType: 'company',
    entityId: company.id,
    description: `Registered company ${company.name}`,
  });

  res.status(201).json(company);
});

router.put('/:id', requireAuth, requireSuperAdmin, async (req: AuthedRequest, res) => {
  const fields = ['name', 'registration_number', 'contact_email', 'contact_phone', 'region', 'is_active'];
  const updates = fields.filter((f) => req.body[f] !== undefined);
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  const setClause = updates.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const { rows } = await query(
    `UPDATE companies SET ${setClause} WHERE id = $1 RETURNING *`,
    [req.params.id, ...updates.map((f) => req.body[f])]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Company not found' });

  await logActivity({
    actorStaffId: req.user!.sub,
    companyId: rows[0].id,
    action: 'update',
    entityType: 'company',
    entityId: rows[0].id,
    description: `Updated company ${rows[0].name}`,
  });

  res.json(rows[0]);
});

export default router;
