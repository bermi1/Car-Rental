import { Router } from 'express';
import { query } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { normalizePhone, looksLikePhone, isValidPhone } from '../utils/phone';

const router = Router();

// ---------- Staff (admin/staff) login ----------
router.post('/staff/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { rows } = await query('SELECT * FROM staff_users WHERE email = $1', [email]);
  const staff = rows[0];
  if (!staff || !staff.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(password, staff.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // The company rides in the token so every later request resolves its tenant
  // without another lookup. A super admin has none — they pick per request.
  const token = signToken({
    sub: staff.id,
    role: staff.role,
    name: staff.name,
    email: staff.email,
    companyId: staff.company_id,
  });

  const company = staff.company_id
    ? (await query('SELECT id, name, slug FROM companies WHERE id = $1', [staff.company_id])).rows[0]
    : null;

  res.json({
    token,
    user: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      company_id: staff.company_id,
      language: staff.language,
    },
    company,
  });
});

// ---------- Client register ----------
/**
 * Open self-registration — anyone can create an account from the phone app.
 *
 * Name, phone and a password are all it takes. The phone number is the handle
 * (everyone has one; not everyone has email), so email is optional and only
 * has to be unique when it's given. Nothing here is company-scoped: a client
 * account is platform-wide and can book from any company on the platform.
 */
router.post('/client/register', async (req, res) => {
  const { full_name, phone, email, password, id_type, id_number, language } = req.body;
  if (!full_name || !phone || !password) {
    return res.status(400).json({ error: 'Your name, phone number and a password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number, for example 0712 345 678' });
  }

  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

  const phoneTaken = await query('SELECT id FROM clients WHERE phone = $1', [normalizedPhone]);
  if (phoneTaken.rows.length) {
    return res.status(409).json({ error: 'That phone number is already registered. Sign in instead.' });
  }
  if (normalizedEmail) {
    const emailTaken = await query('SELECT id FROM clients WHERE lower(email) = $1', [normalizedEmail]);
    if (emailTaken.rows.length) return res.status(409).json({ error: 'That email is already registered' });
  }

  const password_hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO clients (full_name, phone, email, id_type, id_number, password_hash, language)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      String(full_name).trim(),
      normalizedPhone,
      normalizedEmail,
      id_type || 'national_id',
      id_number || null,
      password_hash,
      language === 'sw' ? 'sw' : 'en',
    ]
  );
  const client = rows[0];
  const token = signToken({ sub: client.id, role: 'client', name: client.full_name, email: client.email });
  res.status(201).json({ token, user: sanitizeClient(client) });
});

// ---------- Client login (+ device linking) ----------
/** Accepts either the phone number or the email as the identifier. */
router.post('/client/login', async (req, res) => {
  const { identifier, email, password, device_name, platform, device_identifier } = req.body;
  const handle = String(identifier || email || '').trim();
  if (!handle || !password) {
    return res.status(400).json({ error: 'Phone number (or email) and password are required' });
  }

  const { rows } = looksLikePhone(handle)
    ? await query('SELECT * FROM clients WHERE phone = $1', [normalizePhone(handle)])
    : await query('SELECT * FROM clients WHERE lower(email) = $1', [handle.toLowerCase()]);
  const client = rows[0];
  if (!client) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(password, client.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  let deviceId: string | undefined;
  if (device_identifier && platform) {
    const upserted = await query(
      `INSERT INTO client_devices (client_id, device_name, platform, device_identifier)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (client_id, device_identifier)
       DO UPDATE SET last_active_at = now(), is_active = true, device_name = EXCLUDED.device_name
       RETURNING id`,
      [client.id, device_name || 'Unknown device', platform, device_identifier]
    );
    deviceId = upserted.rows[0].id;
  }

  const token = signToken({
    sub: client.id,
    role: 'client',
    name: client.full_name,
    email: client.email,
    deviceId,
  });
  res.json({ token, user: sanitizeClient(client) });
});

// ---------- Current user ----------
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const { role, sub } = req.user!;
  if (role === 'client') {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1', [sub]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json({ role, user: sanitizeClient(rows[0]) });
  }
  const { rows } = await query('SELECT * FROM staff_users WHERE id = $1', [sub]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const staff = rows[0];

  const company = staff.company_id
    ? (await query('SELECT id, name, slug FROM companies WHERE id = $1', [staff.company_id])).rows[0]
    : null;

  res.json({
    role,
    user: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      company_id: staff.company_id,
      language: staff.language,
    },
    company,
  });
});

// ---------- Language preference ----------
router.put('/me/language', requireAuth, async (req: AuthedRequest, res) => {
  const { language } = req.body;
  if (language !== 'en' && language !== 'sw') {
    return res.status(400).json({ error: "language must be 'en' or 'sw'" });
  }
  const table = req.user!.role === 'client' ? 'clients' : 'staff_users';
  await query(`UPDATE ${table} SET language = $1 WHERE id = $2`, [language, req.user!.sub]);
  res.json({ language });
});

function sanitizeClient(c: any) {
  const { password_hash, ...rest } = c;
  return rest;
}

export default router;
