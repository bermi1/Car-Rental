import { Router } from 'express';
import { query } from '../config/db';
import {
  requireAuth,
  requireStaffOrAdmin,
  requireCompanyAdmin,
  requireCompany,
  resolveCompany,
  AuthedRequest,
} from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { buildContractPdf } from '../services/contractPdf';
import { logActivity } from '../services/activityLog';
import { renderContract, currentTerms } from '../services/contractText';
import { randomBytes } from 'crypto';

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

/**
 * The company's terms — what every new contract is built from.
 * Editing them creates a new version rather than changing the old one, so a
 * contract already signed keeps pointing at the wording that was agreed.
 */
router.get('/terms/current', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  res.json(await currentTerms(req.companyId!));
});

router.put('/terms', requireAuth, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { body, title } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'The terms cannot be empty' });

  const { rows: currentRows } = await query(
    'SELECT COALESCE(max(version), 0) AS v FROM company_terms WHERE company_id = $1',
    [req.companyId]
  );
  const nextVersion = Number(currentRows[0].v) + 1;

  await query('UPDATE company_terms SET is_current = false WHERE company_id = $1', [req.companyId]);
  const { rows } = await query(
    `INSERT INTO company_terms (company_id, version, title, body, is_current, created_by)
     VALUES ($1,$2,$3,$4,true,$5) RETURNING *`,
    [req.companyId, nextVersion, title?.trim() || 'Rental Terms and Conditions', body.trim(), req.user!.sub]
  );
  res.json(rows[0]);
});

/**
 * Creates a share link for a booking.
 *
 * The token stands for one booking and nothing else, so it can be sent over
 * WhatsApp without handing over an account. Opening it shows the customer
 * their car, their charges and their contract to sign.
 */
router.post('/booking/:bookingId/share', requireAuth, resolveCompany, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { rows: bookingRows } = await query(
    'SELECT id, company_id, share_token FROM bookings WHERE id = $1',
    [req.params.bookingId]
  );
  const booking = bookingRows[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user!.role !== 'super_admin' && booking.company_id !== req.companyId) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Reuse an existing token: regenerating would silently break a link the
  // customer has already been sent.
  let token = booking.share_token;
  if (!token) {
    token = randomBytes(24).toString('base64url');
    await query(
      'UPDATE bookings SET share_token = $1, share_token_created_at = now() WHERE id = $2',
      [token, booking.id]
    );
  }
  res.json({ token, path: `/r/${token}` });
});

/**
 * The customer's own view of their rental, opened from the share link.
 *
 * Public by design — the token is the credential. It deliberately carries only
 * what the customer already knows or is entitled to see about their own
 * rental, and no way to reach anything else.
 */
router.get('/shared/:token', async (req, res) => {
  const { rows } = await query(
    `SELECT b.id, b.start_date, b.end_date, b.status, b.pickup_region, b.dropoff_region,
            b.rental_type, b.quoted_amount, b.quoted_currency,
            c.full_name AS client_name,
            v.make, v.model, v.year, v.photos, v.category,
            co.name AS company_name, co.contact_phone, co.logo_path
       FROM bookings b
       JOIN clients c ON c.id = b.client_id
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN companies co ON co.id = b.company_id
      WHERE b.share_token = $1`,
    [req.params.token]
  );
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: 'That link is not valid.' });

  const rendered = await renderContract(booking.id);
  const { rows: contractRows } = await query(
    `SELECT id, reference, signed, signed_name, signed_at, terms_accepted
       FROM contracts WHERE booking_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [booking.id]
  );

  res.json({
    booking,
    bill: rendered?.bill ?? null,
    contract: contractRows[0] ?? null,
    contract_body: rendered?.body ?? null,
  });
});

/**
 * The customer reads the agreement and signs it, from the share link.
 *
 * Three separate facts are recorded — that the terms were accepted, the name
 * typed as the signature, and when — so "they ticked a box" can never be
 * mistaken for "they read it and signed". The request's IP and browser are
 * kept alongside as evidence of who consented and from where.
 */
router.post('/shared/:token/sign', async (req, res) => {
  const { signed_name, accept_terms } = req.body;

  if (accept_terms !== true) {
    return res.status(400).json({ error: 'You must accept the terms and conditions to continue.' });
  }
  if (!signed_name?.trim() || signed_name.trim().length < 3) {
    return res.status(400).json({ error: 'Type your full name as your signature.' });
  }

  const { rows: bookingRows } = await query('SELECT id, company_id FROM bookings WHERE share_token = $1', [
    req.params.token,
  ]);
  const booking = bookingRows[0];
  if (!booking) return res.status(404).json({ error: 'That link is not valid.' });

  const rendered = await renderContract(booking.id);
  if (!rendered) return res.status(404).json({ error: 'That link is not valid.' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
  const agent = (req.headers['user-agent'] as string) || null;

  const { rows: existing } = await query(
    'SELECT id FROM contracts WHERE booking_id = $1 ORDER BY generated_at DESC LIMIT 1',
    [booking.id]
  );

  // The body is frozen at signature: what was agreed must still read the same
  // in a year, whatever the terms or the rates say by then.
  const params = [
    booking.id, booking.company_id, rendered.terms.id, rendered.body, rendered.reference,
    signed_name.trim(), ip, agent,
  ];

  const { rows } = existing[0]
    ? await query(
        `UPDATE contracts
            SET company_id = $2, terms_id = $3, body = $4, reference = COALESCE(reference, $5),
                signed = true, signed_name = $6, signed_at = now(),
                terms_accepted = true, terms_accepted_at = now(),
                signed_ip = $7, signed_user_agent = $8
          WHERE id = $9 RETURNING *`,
        [...params, existing[0].id]
      )
    : await query(
        `INSERT INTO contracts
           (booking_id, company_id, terms_id, body, reference, pdf_file_path,
            signed, signed_name, signed_at, terms_accepted, terms_accepted_at,
            signed_ip, signed_user_agent)
         VALUES ($1,$2,$3,$4,$5,'',true,$6,now(),true,now(),$7,$8) RETURNING *`,
        params
      );

  res.json({ signed: true, contract: rows[0] });
});

export default router;
