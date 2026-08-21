import { Router } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, resolveCompany, AuthedRequest } from '../middleware/auth';
import { calculateQuote } from '../utils/pricing';
import { logActivity } from '../services/activityLog';
import { canConfirmBooking, maybeAdvanceToDocumentsSubmitted } from '../services/bookingWorkflow';
import { syncVehicleStatus, isVehicleFree } from '../services/fleetStatus';
import { buildBill, settleOnReturn } from '../services/billing';

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
router.get('/', requireAuth, resolveCompany, async (req: AuthedRequest, res) => {
  const { status, vehicle_id, client_id, from, to } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];

  // Internal callers are confined to their own tenant.
  if (req.companyId) {
    params.push(req.companyId);
    conditions.push(`b.company_id = $${params.length}`);
  }

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

/**
 * A signed-in customer's own rentals.
 *
 * Each one carries the token that opens its agreement, minted here if staff
 * never sent a link — so a customer who signs in lands on their car either
 * way, rather than on an empty page waiting for someone at the desk.
 */
router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role !== 'client') return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    `SELECT b.id, b.start_date, b.end_date, b.status, b.pickup_region, b.dropoff_region,
            b.quoted_amount, b.quoted_currency, b.share_token, b.created_at,
            v.make, v.model, v.year, v.photos,
            co.name AS company_name, co.logo_path
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN companies co ON co.id = b.company_id
      WHERE b.client_id = $1
      ORDER BY b.start_date DESC`,
    [req.user!.sub]
  );

  for (const booking of rows) {
    if (!booking.share_token) {
      const token = randomBytes(24).toString('base64url');
      await query(
        'UPDATE bookings SET share_token = $1, share_token_created_at = now() WHERE id = $2',
        [token, booking.id]
      );
      booking.share_token = token;
    }
  }

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
  // Pricing follows the vehicle's owning company — its exchange rate and its
  // seasonal windows — so a quote is correct whichever company is being booked.
  const { rows: vRows } = await query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
  if (!vRows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  const companyId = vRows[0].company_id;

  const { rows: sRows } = await query('SELECT * FROM company_settings WHERE company_id = $1', [companyId]);
  const settings = sRows[0] ?? { usd_to_tzs_rate: 2600 };

  const seasonal = await query(
    `SELECT rate_multiplier FROM seasonal_pricing
     WHERE company_id = $4 AND (category IS NULL OR category = $1)
       AND start_date <= $3 AND end_date >= $2
     ORDER BY rate_multiplier DESC LIMIT 1`,
    [vRows[0].category, start_date, end_date, companyId]
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

  // Refuse a car that is already spoken for over these dates. Without this,
  // the fleet's "booked" status is decoration — two people could hold the same
  // car and only find out at the counter.
  if (!(await isVehicleFree(vehicle_id, start_date, end_date))) {
    return res.status(409).json({
      error: 'That car is already booked for those dates. Choose other dates or another car.',
    });
  }

  const is_cross_region = pickup_region.trim().toLowerCase() !== dropoff_region.trim().toLowerCase();

  // The booking belongs to whichever company owns the vehicle — never to a
  // company id supplied by the caller.
  const { rows: vehicleRows } = await query('SELECT company_id FROM vehicles WHERE id = $1', [vehicle_id]);
  if (!vehicleRows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  const companyId = vehicleRows[0].company_id;

  if (isStaff && req.user!.role !== 'super_admin' && companyId !== req.user!.companyId) {
    return res.status(403).json({ error: 'That vehicle belongs to another company' });
  }

  const { rows } = await query(
    `INSERT INTO bookings
      (company_id, vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region,
       is_cross_region, quoted_currency, quoted_amount, created_by_staff_id, created_by_client_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      companyId, vehicle_id, resolvedClientId, rental_type || 'self_drive', start_date, end_date,
      pickup_region, dropoff_region, is_cross_region,
      quoted_currency || 'TZS', quoted_amount || 0,
      isStaff ? req.user!.sub : null,
      isStaff ? null : req.user!.sub,
    ]
  );

  await query("UPDATE vehicles SET status = 'booked' WHERE id = $1 AND status = 'available'", [vehicle_id]);

  // A repeat client may already have the required documents on file (uploaded
  // and/or verified against a previous booking) — check immediately so this
  // booking isn't stuck at pending_documents waiting for a re-upload event.
  await maybeAdvanceToDocumentsSubmitted(rows[0].id);

  await logActivity({
    actorStaffId: isStaff ? req.user!.sub : null,
    companyId,
    action: 'booking_created',
    entityType: 'booking',
    entityId: rows[0].id,
    description: isStaff
      ? `Created a booking on behalf of a client`
      : `Client requested a booking from the app`,
  });

  const { rows: finalRows } = await query('SELECT * FROM bookings WHERE id = $1', [rows[0].id]);
  res.status(201).json(finalRows[0]);
});


/**
 * Confirms the booking belongs to the caller's company before a write.
 *
 * The status transitions below all take an id from the URL, so without this a
 * staff member at one company could confirm, activate or complete another
 * company's rental just by knowing the id. Answers 404 rather than 403 so the
 * response doesn't confirm that someone else's booking exists.
 */
async function bookingInCompany(req: AuthedRequest, bookingId: string): Promise<boolean> {
  if (req.user!.role === 'super_admin' && !req.companyId) return true;
  const { rows } = await query('SELECT company_id FROM bookings WHERE id = $1', [bookingId]);
  return Boolean(rows[0]) && rows[0].company_id === req.companyId;
}

// Update booking fields (dates/pricing/regions) — staff/admin
router.put('/:id', requireAuth, resolveCompany, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  if (!(await bookingInCompany(req, req.params.id))) {
    return res.status(404).json({ error: 'Booking not found' });
  }
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
router.post('/:id/confirm', requireAuth, resolveCompany, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  if (!(await bookingInCompany(req, req.params.id))) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  const gate = await canConfirmBooking(req.params.id);
  if (!gate.ok) return res.status(400).json({ error: gate.reason });

  const { rows } = await query(
    "UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status = 'documents_submitted' RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Booking must be in documents_submitted status to confirm' });

  // A confirmed car is no longer free, so the fleet must say so immediately —
  // this is what stopped two customers being promised the same vehicle.
  await syncVehicleStatus(rows[0].vehicle_id);

  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'booking_confirmed',
    entityType: 'booking',
    entityId: rows[0].id,
    description: `Confirmed booking ${rows[0].id}`,
  });
  res.json(rows[0]);
});

router.post('/:id/activate', requireAuth, resolveCompany, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  if (!(await bookingInCompany(req, req.params.id))) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  const { rows } = await query(
    "UPDATE bookings SET status = 'active' WHERE id = $1 AND status = 'confirmed' RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Booking must be confirmed to activate' });
  await syncVehicleStatus(rows[0].vehicle_id);
  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'booking_activated',
    entityType: 'booking',
    entityId: rows[0].id,
    description: `Checked in / activated booking ${rows[0].id}`,
  });
  res.json(rows[0]);
});

router.post('/:id/complete', requireAuth, resolveCompany, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  if (!(await bookingInCompany(req, req.params.id))) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  const { rows } = await query(
    "UPDATE bookings SET status = 'completed' WHERE id = $1 AND status = 'active' RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Booking must be active to complete' });

  // Lateness stops being a moving number the moment the car is back — freeze
  // it here or every later view of the bill keeps growing.
  await settleOnReturn(req.params.id);
  await syncVehicleStatus(rows[0].vehicle_id);

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
  // Not a blanket "available": the car may still be held by another booking,
  // or be sitting in the garage. The rule decides, not this endpoint.
  await syncVehicleStatus(rows[0].vehicle_id);
  res.json(rows[0]);
});

/**
 * The bill for a booking, itemised.
 *
 * Rental, extras, late return, fuel, charged damages, less what has been
 * confirmed paid. Readable by the client it belongs to and by staff inside the
 * company that owns it — nobody else.
 */
router.get('/:id/bill', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query('SELECT client_id, company_id FROM bookings WHERE id = $1', [req.params.id]);
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const allowed =
    req.user!.role === 'super_admin' ||
    (req.user!.role === 'client'
      ? booking.client_id === req.user!.sub
      : booking.company_id === req.user!.companyId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const bill = await buildBill(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Booking not found' });
  res.json(bill);
});

export default router;
