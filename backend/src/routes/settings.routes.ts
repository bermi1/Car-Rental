import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireCompanyAdmin, requireCompany, AuthedRequest } from '../middleware/auth';

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
