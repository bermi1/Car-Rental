import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireRole, AuthedRequest, requireCompanyAdmin } from '../middleware/auth';
import { hashPassword } from '../utils/password';

const router = Router();

// Admin-only: manage staff accounts
router.get('/', requireAuth, requireCompanyAdmin, async (_req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, role, is_active, created_at FROM staff_users ORDER BY created_at DESC'
  );
  res.json(rows);
});

router.post('/', requireAuth, requireCompanyAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password are required' });

  const existing = await query('SELECT id FROM staff_users WHERE email = $1', [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already in use' });

  const password_hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO staff_users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
     RETURNING id, name, email, role, is_active, created_at`,
    [name, email, password_hash, role === 'admin' ? 'admin' : 'staff']
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  const { name, role, is_active, password } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
  if (role !== undefined) { params.push(role); updates.push(`role = $${params.length}`); }
  if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
  if (password) { params.push(await hashPassword(password)); updates.push(`password_hash = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE staff_users SET ${updates.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, email, role, is_active, created_at`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Staff user not found' });
  res.json(rows[0]);
});

// Staff/Admin: "my activity" — actions performed by the logged-in staff member
router.get('/me/activity', requireAuth, requireRole('admin', 'staff'), async (req: AuthedRequest, res) => {
  const { rows } = await query(
    'SELECT * FROM activity_log WHERE actor_staff_id = $1 ORDER BY created_at DESC LIMIT 200',
    [req.user!.sub]
  );
  res.json(rows);
});

// Admin: recent activity feed across all staff (dashboard)
router.get('/activity/recent', requireAuth, requireCompanyAdmin, async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, s.name AS actor_name FROM activity_log a
     LEFT JOIN staff_users s ON s.id = a.actor_staff_id
     ORDER BY a.created_at DESC LIMIT 50`
  );
  res.json(rows);
});

export default router;
