import { Router } from 'express';
import { query } from '../config/db';
import {
  requireAuth,
  requireRole,
  AuthedRequest,
  requireCompanyAdmin,
  resolveCompany,
} from '../middleware/auth';
import { hashPassword } from '../utils/password';

const router = Router();

/**
 * Staff accounts.
 *
 * Every read and write here is scoped to req.companyId, which comes from the
 * caller's token (or, for a super admin, the company they've switched into).
 * A company admin can only ever see and create people inside their own
 * company — and a created account always carries that company, because an
 * account with no company can authenticate but not use anything.
 */

/** The company a write should land in, or null if the caller hasn't picked one. */
function targetCompany(req: AuthedRequest): string | null {
  if (req.user!.role === 'super_admin') {
    // A super admin may name the company explicitly; otherwise the one they
    // are currently switched into.
    return req.body?.company_id || req.companyId || null;
  }
  return req.companyId || null;
}

router.get('/', requireAuth, resolveCompany, requireCompanyAdmin, async (req: AuthedRequest, res) => {
  // A super admin who hasn't switched into a company sees the whole platform,
  // which is the only view where that's the right answer.
  const platformWide = req.user!.role === 'super_admin' && !req.companyId;

  const { rows } = platformWide
    ? await query(
        `SELECT s.id, s.name, s.email, s.role, s.is_active, s.created_at, s.company_id, c.name AS company_name
           FROM staff_users s
           LEFT JOIN companies c ON c.id = s.company_id
          ORDER BY s.created_at DESC`
      )
    : await query(
        `SELECT s.id, s.name, s.email, s.role, s.is_active, s.created_at, s.company_id, c.name AS company_name
           FROM staff_users s
           LEFT JOIN companies c ON c.id = s.company_id
          WHERE s.company_id = $1
          ORDER BY s.created_at DESC`,
        [req.companyId]
      );
  res.json(rows);
});

router.post('/', requireAuth, resolveCompany, requireCompanyAdmin, async (req: AuthedRequest, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password are required' });
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await query('SELECT id FROM staff_users WHERE lower(email) = $1', [normalizedEmail]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already in use' });

  // Only a super admin can mint another super admin, and that account is the
  // one kind that legitimately has no company.
  const isSuperAdmin = req.user!.role === 'super_admin';
  const requestedRole = role === 'admin' ? 'admin' : role === 'super_admin' && isSuperAdmin ? 'super_admin' : 'staff';

  const companyId = requestedRole === 'super_admin' ? null : targetCompany(req);
  if (!companyId && requestedRole !== 'super_admin') {
    return res.status(400).json({
      error: 'Choose a company for this account — staff without a company cannot use the console.',
    });
  }
  if (companyId) {
    const company = await query('SELECT id FROM companies WHERE id = $1', [companyId]);
    if (!company.rows.length) return res.status(400).json({ error: 'That company does not exist' });
  }

  const password_hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO staff_users (name, email, password_hash, role, company_id) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, name, email, role, is_active, created_at, company_id`,
    [String(name).trim(), normalizedEmail, password_hash, requestedRole, companyId]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth, resolveCompany, requireCompanyAdmin, async (req: AuthedRequest, res) => {
  // Confirm the target is inside the caller's company before touching it —
  // otherwise one company's admin could reset another company's passwords.
  const { rows: targetRows } = await query('SELECT id, company_id, role FROM staff_users WHERE id = $1', [
    req.params.id,
  ]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: 'Staff user not found' });

  const isSuperAdmin = req.user!.role === 'super_admin';
  if (!isSuperAdmin && target.company_id !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { name, role, is_active, password } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
  if (role !== undefined) {
    // A company admin can toggle staff/admin but cannot create a platform owner.
    const nextRole = role === 'super_admin' && isSuperAdmin ? 'super_admin' : role === 'admin' ? 'admin' : 'staff';
    params.push(nextRole);
    updates.push(`role = $${params.length}`);
  }
  if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    params.push(await hashPassword(password));
    updates.push(`password_hash = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE staff_users SET ${updates.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, email, role, is_active, created_at, company_id`,
    params
  );
  res.json(rows[0]);
});

// Staff/Admin: "my activity" — actions performed by the logged-in staff member
router.get('/me/activity', requireAuth, requireRole('admin', 'staff', 'super_admin'), async (req: AuthedRequest, res) => {
  const { rows } = await query(
    'SELECT * FROM activity_log WHERE actor_staff_id = $1 ORDER BY created_at DESC LIMIT 200',
    [req.user!.sub]
  );
  res.json(rows);
});

// Admin: recent activity feed for the caller's company
router.get('/activity/recent', requireAuth, resolveCompany, requireCompanyAdmin, async (req: AuthedRequest, res) => {
  const platformWide = req.user!.role === 'super_admin' && !req.companyId;
  const { rows } = platformWide
    ? await query(
        `SELECT a.*, s.name AS actor_name FROM activity_log a
         LEFT JOIN staff_users s ON s.id = a.actor_staff_id
         ORDER BY a.created_at DESC LIMIT 50`
      )
    : await query(
        `SELECT a.*, s.name AS actor_name FROM activity_log a
         LEFT JOIN staff_users s ON s.id = a.actor_staff_id
         WHERE a.company_id = $1
         ORDER BY a.created_at DESC LIMIT 50`,
        [req.companyId]
      );
  res.json(rows);
});

export default router;
