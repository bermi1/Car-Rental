import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  const { rows } = await query('SELECT * FROM system_settings WHERE id = 1');
  res.json(rows[0]);
});

router.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { usd_to_tzs_rate, default_daily_rate_tzs } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (usd_to_tzs_rate !== undefined) { params.push(usd_to_tzs_rate); updates.push(`usd_to_tzs_rate = $${params.length}`); }
  if (default_daily_rate_tzs !== undefined) { params.push(default_daily_rate_tzs); updates.push(`default_daily_rate_tzs = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push('updated_at = now()');
  const { rows } = await query(`UPDATE system_settings SET ${updates.join(', ')} WHERE id = 1 RETURNING *`, params);
  res.json(rows[0]);
});

// Seasonal pricing windows
router.get('/seasonal-pricing', requireAuth, async (_req, res) => {
  const { rows } = await query('SELECT * FROM seasonal_pricing ORDER BY start_date DESC');
  res.json(rows);
});

router.post('/seasonal-pricing', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, category, start_date, end_date, rate_multiplier } = req.body;
  if (!name || !start_date || !end_date || rate_multiplier == null) {
    return res.status(400).json({ error: 'name, start_date, end_date, rate_multiplier are required' });
  }
  const { rows } = await query(
    `INSERT INTO seasonal_pricing (name, category, start_date, end_date, rate_multiplier)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, category || null, start_date, end_date, rate_multiplier]
  );
  res.status(201).json(rows[0]);
});

router.delete('/seasonal-pricing/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await query('DELETE FROM seasonal_pricing WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

export default router;
