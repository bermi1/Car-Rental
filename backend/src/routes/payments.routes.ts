import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, requireCompany, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';

const router = Router();

/**
 * Payments are recorded, evidenced and confirmed — there is no gateway in this
 * build. Either the client (from the app) or staff (at the desk) records what
 * was paid and attaches a receipt; staff then confirm or reject it.
 */

/** Payments across the company, newest first. */
router.get('/', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { status, booking_id } = req.query;
  const params: any[] = [req.companyId];
  let sql = `
    SELECT p.*, c.full_name AS client_name, v.make, v.model, v.plate_number
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      JOIN clients c ON c.id = b.client_id
      JOIN vehicles v ON v.id = b.vehicle_id
     WHERE p.company_id = $1`;

  if (status) {
    params.push(status);
    sql += ` AND p.status = $${params.length}`;
  }
  if (booking_id) {
    params.push(booking_id);
    sql += ` AND p.booking_id = $${params.length}`;
  }
  sql += ' ORDER BY p.created_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
});

/** Payments for one booking — readable by the client who owns it. */
router.get('/booking/:bookingId', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'client') {
    const { rows } = await query('SELECT client_id FROM bookings WHERE id = $1', [req.params.bookingId]);
    if (!rows[0] || rows[0].client_id !== req.user!.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const { rows } = await query(
    'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC',
    [req.params.bookingId]
  );
  res.json(rows);
});

/**
 * Records a payment and attaches its receipt in one request. Staff record at
 * the desk; clients record from the app after paying by mobile money or bank
 * transfer. Either way it lands as `awaiting_confirmation`.
 */
router.post('/', requireAuth, upload.single('receipt'), async (req: AuthedRequest, res) => {
  const { booking_id, amount, currency, method, reference, note, paid_at } = req.body;
  if (!booking_id || !amount) {
    return res.status(400).json({ error: 'booking_id and amount are required' });
  }

  const { rows: bookingRows } = await query(
    'SELECT id, company_id, client_id FROM bookings WHERE id = $1',
    [booking_id]
  );
  const booking = bookingRows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isClient = req.user!.role === 'client';
  if (isClient && booking.client_id !== req.user!.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!isClient && req.user!.role !== 'super_admin' && booking.company_id !== req.user!.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let receiptPath: string | null = null;
  if (req.file) {
    const rel = `receipts/${booking_id}-${Date.now()}-${req.file.originalname}`;
    await storage.save(req.file.buffer, rel, req.file.mimetype);
    receiptPath = storage.urlFor(rel);
  }

  const { rows } = await query(
    `INSERT INTO payments
       (booking_id, company_id, amount, currency, method, reference, receipt_file_path,
        note, paid_at, recorded_by_staff_id, recorded_by_client_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      booking_id,
      booking.company_id,
      Number(amount),
      currency || 'TZS',
      method || 'mobile_money',
      reference || null,
      receiptPath,
      note || null,
      paid_at || new Date().toISOString(),
      isClient ? null : req.user!.sub,
      isClient ? req.user!.sub : null,
    ]
  );

  await logActivity({
    actorStaffId: isClient ? null : req.user!.sub,
    companyId: booking.company_id,
    action: 'create',
    entityType: 'payment',
    entityId: rows[0].id,
    description: `Recorded a payment of ${amount} ${currency || 'TZS'} awaiting confirmation`,
  });

  res.status(201).json(rows[0]);
});

/** Confirms or rejects a recorded payment. */
router.put('/:id/confirm', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { confirmed, rejection_reason } = req.body;
  if (typeof confirmed !== 'boolean') {
    return res.status(400).json({ error: 'confirmed (boolean) is required' });
  }

  const { rows } = await query(
    `UPDATE payments
        SET status = $1,
            rejection_reason = $2,
            confirmed_by = $3,
            confirmed_at = now()
      WHERE id = $4 AND company_id = $5
      RETURNING *`,
    [
      confirmed ? 'confirmed' : 'rejected',
      confirmed ? null : rejection_reason || null,
      req.user!.sub,
      req.params.id,
      req.companyId,
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found' });

  await logActivity({
    actorStaffId: req.user!.sub,
    companyId: req.companyId,
    action: confirmed ? 'confirm' : 'reject',
    entityType: 'payment',
    entityId: rows[0].id,
    description: `${confirmed ? 'Confirmed' : 'Rejected'} a payment of ${rows[0].amount} ${rows[0].currency}`,
  });

  res.json(rows[0]);
});

/** What a booking still owes, after confirmed payments and penalties. */
router.get('/booking/:bookingId/balance', requireAuth, async (req: AuthedRequest, res) => {
  // Only the client on the booking, or staff inside the company that owns it.
  const { rows: owner } = await query('SELECT client_id, company_id FROM bookings WHERE id = $1', [
    req.params.bookingId,
  ]);
  if (!owner[0]) return res.status(404).json({ error: 'Booking not found' });
  const allowed =
    req.user!.role === 'super_admin' ||
    (req.user!.role === 'client'
      ? owner[0].client_id === req.user!.sub
      : owner[0].company_id === req.user!.companyId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    `SELECT b.quoted_amount, b.quoted_currency,
            COALESCE((SELECT sum(amount) FROM payments
                       WHERE booking_id = b.id AND status = 'confirmed'), 0) AS paid,
            COALESCE((SELECT sum(penalty_amount) FROM damages
                       WHERE booking_id = b.id AND status = 'charged'), 0) AS penalties
       FROM bookings b WHERE b.id = $1`,
    [req.params.bookingId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Booking not found' });

  const { quoted_amount, quoted_currency, paid, penalties } = rows[0];
  res.json({
    quoted_amount: Number(quoted_amount),
    currency: quoted_currency,
    paid: Number(paid),
    penalties: Number(penalties),
    balance: Number(quoted_amount) + Number(penalties) - Number(paid),
  });
});

export default router;
