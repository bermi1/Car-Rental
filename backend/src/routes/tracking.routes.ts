import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, requireCompany, AuthedRequest } from '../middleware/auth';

const router = Router();

/**
 * Location sharing for active rentals.
 *
 * Pings come from the client's own phone, which asks for location permission
 * at handover. Sharing is per-booking and only accepted while the rental is
 * active, so a client's phone never reports its position outside the window
 * they agreed to.
 */

/** Client opts in or out of sharing for one of their bookings. */
router.put('/bookings/:id/sharing', requireAuth, async (req: AuthedRequest, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }

  const { rows: bookingRows } = await query('SELECT client_id, company_id FROM bookings WHERE id = $1', [
    req.params.id,
  ]);
  const booking = bookingRows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isOwner = req.user!.role === 'client' && booking.client_id === req.user!.sub;
  const isInternal =
    req.user!.role === 'super_admin' ||
    (['admin', 'staff'].includes(req.user!.role) && booking.company_id === req.user!.companyId);
  if (!isOwner && !isInternal) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    'UPDATE bookings SET location_sharing_enabled = $1 WHERE id = $2 RETURNING id, location_sharing_enabled',
    [enabled, req.params.id]
  );
  res.json(rows[0]);
});

/** Records a position. Silently ignored unless the rental is active and sharing is on. */
router.post('/pings', requireAuth, async (req: AuthedRequest, res) => {
  const { booking_id, latitude, longitude, accuracy_m, speed_kph } = req.body;
  if (!booking_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'booking_id, latitude and longitude are required' });
  }

  const { rows } = await query(
    'SELECT client_id, status, location_sharing_enabled FROM bookings WHERE id = $1',
    [booking_id]
  );
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user!.role === 'client' && booking.client_id !== req.user!.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Not an error — the app pings on a timer and shouldn't have to reason about
  // whether the rental just ended.
  if (booking.status !== 'active' || !booking.location_sharing_enabled) {
    return res.json({ recorded: false, reason: 'Location sharing is not active for this booking' });
  }

  await query(
    `INSERT INTO location_pings (booking_id, latitude, longitude, accuracy_m, speed_kph)
     VALUES ($1,$2,$3,$4,$5)`,
    [booking_id, latitude, longitude, accuracy_m ?? null, speed_kph ?? null]
  );
  res.json({ recorded: true });
});

/** Latest known position for every vehicle currently out. */
router.get('/live', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT b.id AS booking_id, b.location_sharing_enabled,
            c.full_name AS client_name, c.phone AS client_phone,
            v.make, v.model, v.plate_number,
            p.latitude, p.longitude, p.accuracy_m, p.speed_kph, p.recorded_at
       FROM bookings b
       JOIN clients c ON c.id = b.client_id
       JOIN vehicles v ON v.id = b.vehicle_id
       LEFT JOIN LATERAL (
         SELECT * FROM location_pings
          WHERE booking_id = b.id
          ORDER BY recorded_at DESC
          LIMIT 1
       ) p ON true
      WHERE b.company_id = $1 AND b.status = 'active'
      ORDER BY p.recorded_at DESC NULLS LAST`,
    [req.companyId]
  );
  res.json(rows);
});

/** The full trail for one booking — used when a vehicle needs to be found. */
router.get('/bookings/:id/trail', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { rows: bookingRows } = await query(
    'SELECT id FROM bookings WHERE id = $1 AND company_id = $2',
    [req.params.id, req.companyId]
  );
  if (!bookingRows[0]) return res.status(404).json({ error: 'Booking not found' });

  const { rows } = await query(
    `SELECT latitude, longitude, accuracy_m, speed_kph, recorded_at
       FROM location_pings
      WHERE booking_id = $1
      ORDER BY recorded_at DESC
      LIMIT 500`,
    [req.params.id]
  );
  res.json(rows);
});

export default router;
