import { Router } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../config/db';
import {
  requireAuth,
  requireStaffOrAdmin,
  requireRole,
  requireCompany,
  resolveCompany,
  AuthedRequest,
} from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { normalizePhone, isValidPhone } from '../utils/phone';
import { logActivity } from '../services/activityLog';

/** Never let a password hash out of this module. */
function sanitize(client: any) {
  const { password_hash, ...rest } = client;
  return rest;
}

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

/**
 * Registers a walk-in customer from the desk.
 *
 * Not everyone arrives through the phone app — most people walk in. Staff
 * capture the customer here and the account is real: the same phone number
 * signs in later, sees this booking, and can upload their own documents.
 *
 * A password is optional. Left blank, one is generated and returned once so
 * staff can hand it over; it is never readable again.
 */
router.post('/', requireAuth, resolveCompany, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const {
    full_name, phone, email, id_type, id_number, address, date_of_birth,
    licence_number, licence_expiry, emergency_contact_name, emergency_contact_phone,
    notes, password,
  } = req.body;

  if (!full_name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "The customer's name and phone number are required" });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number, for example 0712 345 678' });
  }

  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

  // Someone who already has an account keeps it — a second row would split
  // their history across two customers with the same number.
  const { rows: existing } = await query('SELECT * FROM clients WHERE phone = $1', [normalizedPhone]);
  if (existing[0]) {
    return res.status(409).json({
      error: 'That phone number already belongs to a customer.',
      client: sanitize(existing[0]),
    });
  }
  if (normalizedEmail) {
    const { rows: byEmail } = await query('SELECT id FROM clients WHERE lower(email) = $1', [normalizedEmail]);
    if (byEmail[0]) return res.status(409).json({ error: 'That email already belongs to a customer.' });
  }

  // Readable enough to say down a phone line, random enough not to guess.
  const generated = `${normalizedPhone.slice(-4)}-${randomBytes(3).toString('hex')}`;
  const plainPassword = password?.trim() || generated;

  const { rows } = await query(
    `INSERT INTO clients
       (full_name, phone, email, id_type, id_number, password_hash, address, date_of_birth,
        licence_number, licence_expiry, emergency_contact_name, emergency_contact_phone,
        notes, created_by_staff_id, registered_by_company_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      full_name.trim(), normalizedPhone, normalizedEmail,
      id_type || 'national_id', id_number || null,
      await hashPassword(plainPassword),
      address || null, date_of_birth || null,
      licence_number || null, licence_expiry || null,
      emergency_contact_name || null, emergency_contact_phone || null,
      notes || null, req.user!.sub, req.companyId,
    ]
  );

  await logActivity({
    actorStaffId: req.user!.sub,
    companyId: req.companyId,
    action: 'create',
    entityType: 'client',
    entityId: rows[0].id,
    description: `Registered customer ${full_name.trim()}`,
  });

  // The only time the password is visible. Staff read it to the customer now
  // or it is gone.
  res.status(201).json({
    client: sanitize(rows[0]),
    temporary_password: password?.trim() ? undefined : plainPassword,
  });
});

export default router;
