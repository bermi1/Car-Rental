import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireCompanyAdmin, requireCompany, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';

const router = Router();

/**
 * Settings are per company: each tenant sets its own exchange rate, default
 * pricing, penalty rates, and the payment instructions clients see when they
 * come to pay.
 */

const SETTINGS_FIELDS = [
  'usd_to_tzs_rate',
  'default_daily_rate_tzs',
  'late_return_fee_per_day_tzs',
  'fuel_shortfall_fee_tzs',
  'deposit_percent',
  'payment_instructions',
];

router.get('/', requireAuth, requireCompany, async (req: AuthedRequest, res) => {
  const { rows } = await query('SELECT * FROM company_settings WHERE company_id = $1', [req.companyId]);
  if (!rows[0]) {
    // A company created before settings existed still needs a row to edit.
    const created = await query(
      'INSERT INTO company_settings (company_id) VALUES ($1) RETURNING *',
      [req.companyId]
    );
    return res.json(created.rows[0]);
  }
  res.json(rows[0]);
});

router.put('/', requireAuth, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const updates: string[] = [];
  const params: any[] = [req.companyId];

  for (const field of SETTINGS_FIELDS) {
    if (req.body[field] !== undefined) {
      params.push(req.body[field]);
      updates.push(`${field} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push('updated_at = now()');

  const { rows } = await query(
    `UPDATE company_settings SET ${updates.join(', ')} WHERE company_id = $1 RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Settings not found' });
  res.json(rows[0]);
});


/* --------------------------- business profile ---------------------------- */

/**
 * The company's own identity — the name, wording and logo that appear on the
 * public catalogue, on the share link a customer opens, and at the head of
 * every contract. Separate from `company_settings`, which holds rates.
 */

const PROFILE_FIELDS = ['name', 'tagline', 'about', 'contact_email', 'contact_phone', 'whatsapp_phone', 'region'];

router.get('/profile', requireAuth, requireCompany, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT id, name, slug, tagline, about, contact_email, contact_phone, whatsapp_phone, region, logo_path
       FROM companies WHERE id = $1`,
    [req.companyId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
  res.json(rows[0]);
});

router.put('/profile', requireAuth, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const present = PROFILE_FIELDS.filter((f) => req.body[f] !== undefined);
  if (!present.length) return res.status(400).json({ error: 'No fields to update' });
  if (present.includes('name') && !String(req.body.name ?? '').trim()) {
    return res.status(400).json({ error: 'The business name cannot be empty' });
  }

  const setClause = present.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = present.map((f) => {
    const raw = req.body[f];
    const trimmed = typeof raw === 'string' ? raw.trim() : raw;
    return trimmed === '' ? null : trimmed;
  });

  const { rows } = await query(
    `UPDATE companies SET ${setClause} WHERE id = $1
     RETURNING id, name, slug, tagline, about, contact_email, contact_phone, whatsapp_phone, region, logo_path`,
    [req.companyId, ...values]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
  res.json(rows[0]);
});

/**
 * Uploads the business logo.
 *
 * Stored under the company's own id, so one tenant can never overwrite
 * another's, and the filename carries a timestamp so a replacement is not
 * masked by a cached copy of the old one.
 */
router.post(
  '/logo',
  requireAuth,
  requireCompanyAdmin,
  requireCompany,
  upload.single('logo'),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload' });
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'The logo must be an image file' });
    }

    const extension = (req.file.originalname.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const relPath = `logos/${req.companyId}/${Date.now()}.${extension || 'png'}`;
    await storage.save(req.file.buffer, relPath);
    const fileUrl = storage.urlFor(relPath);

    const { rows } = await query(
      'UPDATE companies SET logo_path = $1 WHERE id = $2 RETURNING id, name, logo_path',
      [fileUrl, req.companyId]
    );
    res.json(rows[0]);
  }
);

/* --------------------------- seasonal pricing ---------------------------- */

router.get('/seasonal-pricing', requireAuth, requireCompany, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    'SELECT * FROM seasonal_pricing WHERE company_id = $1 ORDER BY start_date DESC',
    [req.companyId]
  );
  res.json(rows);
});

router.post('/seasonal-pricing', requireAuth, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { name, category, start_date, end_date, rate_multiplier } = req.body;
  if (!name || !start_date || !end_date || rate_multiplier == null) {
    return res.status(400).json({ error: 'name, start_date, end_date, rate_multiplier are required' });
  }
  const { rows } = await query(
    `INSERT INTO seasonal_pricing (company_id, name, category, start_date, end_date, rate_multiplier)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.companyId, name, category || null, start_date, end_date, rate_multiplier]
  );
  res.status(201).json(rows[0]);
});

router.delete('/seasonal-pricing/:id', requireAuth, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  await query('DELETE FROM seasonal_pricing WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.companyId,
  ]);
  res.status(204).send();
});

export default router;
