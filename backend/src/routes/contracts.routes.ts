import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { buildContractPdf } from '../services/contractPdf';
import { logActivity } from '../services/activityLog';

const router = Router();

router.get('/booking/:bookingId', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM contracts WHERE booking_id = $1 ORDER BY generated_at DESC',
    [req.params.bookingId]
  );
  res.json(rows);
});

// Generate a contract PDF for a booking (staff/admin)
router.post('/generate/:bookingId', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { rows } = await query(
    `SELECT b.*, v.make, v.model, v.plate_number, c.full_name, c.phone, c.email
     FROM bookings b
     JOIN vehicles v ON v.id = b.vehicle_id
     JOIN clients c ON c.id = b.client_id
     WHERE b.id = $1`,
    [req.params.bookingId]
  );
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const pdfBuffer = await buildContractPdf({
    bookingId: booking.id,
    clientName: booking.full_name,
    clientPhone: booking.phone,
    clientEmail: booking.email,
    vehicleLabel: `${booking.make} ${booking.model}`,
    plateNumber: booking.plate_number,
    rentalType: booking.rental_type,
    startDate: booking.start_date.toISOString().slice(0, 10),
    endDate: booking.end_date.toISOString().slice(0, 10),
    pickupRegion: booking.pickup_region,
    dropoffRegion: booking.dropoff_region,
    quotedCurrency: booking.quoted_currency,
    quotedAmount: Number(booking.quoted_amount),
  });

  const relPath = `contracts/${booking.id}/${Date.now()}-contract.pdf`;
  await storage.save(pdfBuffer, relPath);
  const fileUrl = storage.urlFor(relPath);

  const inserted = await query(
    `INSERT INTO contracts (booking_id, pdf_file_path) VALUES ($1,$2) RETURNING *`,
    [booking.id, fileUrl]
  );

  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'contract_generated',
    entityType: 'booking',
    entityId: booking.id,
    description: `Generated rental contract for booking ${booking.id}`,
  });

  res.status(201).json(inserted.rows[0]);
});

// Client (or staff) uploads a signature image, marking the contract signed
router.post('/:id/sign', requireAuth, upload.single('signature'), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'signature file is required' });

  const relPath = `contracts/signatures/${req.params.id}-${Date.now()}.png`;
  await storage.save(req.file.buffer, relPath);
  const fileUrl = storage.urlFor(relPath);

  const { rows } = await query(
    `UPDATE contracts SET signed = true, signature_file_path = $1 WHERE id = $2 RETURNING *`,
    [fileUrl, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });
  res.json(rows[0]);
});

export default router;
