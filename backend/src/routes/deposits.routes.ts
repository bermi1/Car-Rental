import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, AuthedRequest } from '../middleware/auth';
import { logActivity } from '../services/activityLog';

const router = Router();

router.get('/', requireAuth, requireStaffOrAdmin, async (req, res) => {
  const { status } = req.query as Record<string, string>;
  const params: any[] = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE d.status = $1';
  }
  const { rows } = await query(
    `SELECT d.*, b.client_id, b.vehicle_id, c.full_name AS client_name
     FROM deposits d
     JOIN bookings b ON b.id = d.booking_id
     JOIN clients c ON c.id = b.client_id
     ${where}
     ORDER BY d.recorded_at DESC`,
    params
  );
  res.json(rows);
});

router.get('/booking/:bookingId', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM deposits WHERE booking_id = $1 ORDER BY recorded_at DESC', [
    req.params.bookingId,
  ]);
  res.json(rows);
});

router.post('/', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { booking_id, amount, status } = req.body;
  if (!booking_id || amount == null) return res.status(400).json({ error: 'booking_id and amount are required' });

  const { rows } = await query(
    `INSERT INTO deposits (booking_id, amount, status, recorded_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [booking_id, amount, status || 'held', req.user!.sub]
  );

  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'deposit_recorded',
    entityType: 'booking',
    entityId: booking_id,
    description: `Recorded deposit of ${amount} for booking ${booking_id}`,
  });

  res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { status, reason } = req.body;
  if (!['held', 'released', 'forfeited'].includes(status)) {
    return res.status(400).json({ error: 'status must be held, released, or forfeited' });
  }
  const { rows } = await query(
    `UPDATE deposits SET status = $1, reason = $2, recorded_by = $3, recorded_at = now() WHERE id = $4 RETURNING *`,
    [status, reason || null, req.user!.sub, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Deposit not found' });

  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'deposit_updated',
    entityType: 'deposit',
    entityId: rows[0].id,
    description: `Marked deposit ${rows[0].id} as ${status}`,
  });

  res.json(rows[0]);
});

export default router;
