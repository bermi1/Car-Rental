import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, requireRole, AuthedRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';

const router = Router();

// Staff/Admin: list all clients
router.get('/', requireAuth, requireStaffOrAdmin, async (req, res) => {
  const { search } = req.query as Record<string, string>;
  let sql = 'SELECT id, full_name, phone, email, id_type, id_number, id_document_file, driving_license_file, created_at FROM clients';
  const params: any[] = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`;
  }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// Get single client profile (+ rental history)
router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'client' && req.user!.sub !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { rows } = await query(
    'SELECT id, full_name, phone, email, id_type, id_number, id_document_file, driving_license_file, created_at FROM clients WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });

  const bookings = await query(
    `SELECT b.*, v.make, v.model, v.plate_number FROM bookings b
     JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.client_id = $1 ORDER BY b.created_at DESC`,
    [req.params.id]
  );

  res.json({ ...rows[0], bookings: bookings.rows });
});

// Update own profile (client) or any client (staff/admin)
router.put('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'client' && req.user!.sub !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const fields = ['full_name', 'phone', 'email', 'id_type', 'id_number'];
  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (req.body.password) {
    params.push(await hashPassword(req.body.password));
    updates.push(`password_hash = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE clients SET ${updates.join(', ')} WHERE id = $${params.length}
     RETURNING id, full_name, phone, email, id_type, id_number, id_document_file, driving_license_file, created_at`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  res.json(rows[0]);
});

export default router;
