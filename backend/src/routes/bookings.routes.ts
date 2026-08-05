import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, AuthedRequest } from '../middleware/auth';
import { calculateQuote } from '../utils/pricing';
import { logActivity } from '../services/activityLog';
import { canConfirmBooking, maybeAdvanceToDocumentsSubmitted } from '../services/bookingWorkflow';

const router = Router();

const BOOKING_SELECT = `
  SELECT b.*,
    row_to_json(v.*) AS vehicle,
    json_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'email', c.email) AS client
  FROM bookings b
  JOIN vehicles v ON v.id = b.vehicle_id
  JOIN clients c ON c.id = b.client_id
`;

// List bookings with filters
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const { status, vehicle_id, client_id, from, to } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];

  if (req.user!.role === 'client') {
    params.push(req.user!.sub);
    conditions.push(`b.client_id = $${params.length}`);
  } else if (client_id) {
    params.push(client_id);
    conditions.push(`b.client_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}`);
  }
  if (vehicle_id) {
    params.push(vehicle_id);
    conditions.push(`b.vehicle_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`b.end_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`b.start_date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`${BOOKING_SELECT} ${where} ORDER BY b.created_at DESC`, params);
  res.json(rows);
});

// Today's pickups/returns (staff overview)
router.get('/today', requireAuth, requireStaffOrAdmin, async (req, res) => {
  const { rows } = await query(
    `${BOOKING_SELECT}
     WHERE (b.start_date = CURRENT_DATE OR b.end_date = CURRENT_DATE)
     AND b.status IN ('confirmed','active')
     ORDER BY b.start_date ASC`
  );
  res.json(rows);
});

// Full timeline/detail for one booking
router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [req.params.id]);
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user!.role === 'client' && booking.client_id !== req.user!.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [documents, conditionReports, contracts, deposits] = await Promise.all([
    query('SELECT * FROM documents WHERE booking_id = $1 ORDER BY uploaded_at ASC', [req.params.id]),
    query('SELECT * FROM condition_reports WHERE booking_id = $1 ORDER BY recorded_at ASC', [req.params.id]),
    query('SELECT * FROM contracts WHERE booking_id = $1 ORDER BY generated_at DESC', [req.params.id]),
    query('SELECT * FROM deposits WHERE booking_id = $1 ORDER BY recorded_at DESC', [req.params.id]),
  ]);

  res.json({
    ...booking,
    documents: documents.rows,
    condition_reports: conditionReports.rows,
    contracts: contracts.rows,
    deposits: deposits.rows,
  });
});

// Quote calculation preview
router.post('/quote', requireAuth, async (req, res) => {
  const { vehicle_id, start_date, end_date, currency, override_amount } = req.body;
  if (!vehicle_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'vehicle_id, start_date, end_date are required' });
  }
  const [{ rows: vRows }, { rows: sRows }] = await Promise.all([
    query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]),
    query('SELECT * FROM system_settings WHERE id = 1'),
  ]);
  if (!vRows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  const settings = sRows[0];

  const seasonal = await query(
    `SELECT rate_multiplier FROM seasonal_pricing
     WHERE (category IS NULL OR category = $1) AND start_date <= $3 AND end_date >= $2
     ORDER BY rate_multiplier DESC LIMIT 1`,
    [vRows[0].category, start_date, end_date]
  );

  const { days, amount } = calculateQuote({
    dailyRateTzs: vRows[0].daily_rate_tzs,
    startDate: start_date,
    endDate: end_date,
    currency: currency || 'TZS',
    usdToTzsRate: Number(settings.usd_to_tzs_rate),
    seasonalMultiplier: seasonal.rows[0]?.rate_multiplier ? Number(seasonal.rows[0].rate_multiplier) : 1,
  });

  res.json({ days, amount: override_amount != null ? Number(override_amount) : amount, currency: currency || 'TZS' });
});

// Create booking (staff-on-behalf-of-client OR client self-request)
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const {
    vehicle_id, client_id, rental_type, start_date, end_date,
    pickup_region, dropoff_region, quoted_currency, quoted_amount,
  } = req.body;

  const isStaff = req.user!.role === 'admin' || req.user!.role === 'staff';
  const resolvedClientId = isStaff ? client_id : req.user!.sub;

  if (!vehicle_id || !resolvedClientId || !start_date || !end_date || !pickup_region || !dropoff_region) {
    return res.status(400).json({ error: 'Missing required booking fields' });
  }

  const is_cross_region = pickup_region.trim().toLowerCase() !== dropoff_region.trim().toLowerCase();

  const { rows } = await query(
    `INSERT INTO bookings
      (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region,
       is_cross_region, quoted_currency, quoted_amount, created_by_staff_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      vehicle_id, resolvedClientId, rental_type || 'self_drive', start_date, end_date,
      pickup_region, dropoff_region, is_cross_region,
      quoted_currency || 'TZS', quoted_amount || 0, isStaff ? req.user!.sub : null,
    ]
  );

  await query("UPDATE vehicles SET status = 'booked' WHERE id = $1 AND status = 'available'", [vehicle_id]);

  // A repeat client may already have the required documents on file (uploaded
  // and/or verified against a previous booking) — check immediately so this
  // booking isn't stuck at pending_documents waiting for a re-upload event.
  await maybeAdvanceToDocumentsSubmitted(rows[0].id);

  if (isStaff) {
    await logActivity({
      actorStaffId: req.user!.sub,
      action: 'booking_created',
      entityType: 'booking',
      entityId: rows[0].id,
      description: `Created booking for client ${resolvedClientId}`,
    });
  }

  const { rows: finalRows } = await query('SELECT * FROM bookings WHERE id = $1', [rows[0].id]);
  res.status(201).json(finalRows[0]);
});

// Update booking fields (dates/pricing/regions) — staff/admin
router.put('/:id', requireAuth, requireStaffOrAdmin, async (req, res) => {
  const fields = [
    'rental_type', 'start_date', 'end_date', 'pickup_region', 'dropoff_region',
    'quoted_currency', 'quoted_amount',
  ];
  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (req.body.pickup_region !== undefined || req.body.dropoff_region !== undefined) {
    const current = await query('SELECT pickup_region, dropoff_region FROM bookings WHERE id = $1', [req.params.id]);
    const pickup = (req.body.pickup_region ?? current.rows[0]?.pickup_region ?? '').trim().toLowerCase();
    const dropoff = (req.body.dropoff_region ?? current.rows[0]?.dropoff_region ?? '').trim().toLowerCase();
    params.push(pickup !== dropoff);
    updates.push(`is_cross_region = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  const { rows } = await query(`UPDATE bookings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  if (!rows[0]) return res.status(404).json({ error: 'Booking not found' });
  res.json(rows[0]);
});

// Status transitions
router.post('/:id/confirm', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const gate = await canConfirmBooking(req.params.id);
  if (!gate.ok) return res.status(400).json({ error: gate.reason });

  const { rows } = await query(
    "UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status = 'documents_submitted' RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Booking must be in documents_submitted status to confirm' });

  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'booking_confirmed',
    entityType: 'booking',
    entityId: rows[0].id,
    description: `Confirmed booking ${rows[0].id}`,
  });
  res.json(rows[0]);
});

router.post('/:id/activate', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    "UPDATE bookings SET status = 'active' WHERE id = $1 AND status = 'confirmed' RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Booking must be confirmed to activate' });
  await query("UPDATE vehicles SET status = 'booked' WHERE id = $1", [rows[0].vehicle_id]);
  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'booking_activated',
    entityType: 'booking',
    entityId: rows[0].id,
    description: `Checked in / activated booking ${rows[0].id}`,
  });
  res.json(rows[0]);
});

router.post('/:id/complete', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    "UPDATE bookings SET status = 'completed' WHERE id = $1 AND status = 'active' RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Booking must be active to complete' });
  await query("UPDATE vehicles SET status = 'available' WHERE id = $1", [rows[0].vehicle_id]);
  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'booking_completed',
    entityType: 'booking',
    entityId: rows[0].id,
    description: `Completed check-out for booking ${rows[0].id}`,
  });
  res.json(rows[0]);
});

router.post('/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  const { rows: existing } = await query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Booking not found' });
  if (req.user!.role === 'client' && existing[0].client_id !== req.user!.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { rows } = await query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  await query("UPDATE vehicles SET status = 'available' WHERE id = $1", [rows[0].vehicle_id]);
  res.json(rows[0]);
});

export default router;
