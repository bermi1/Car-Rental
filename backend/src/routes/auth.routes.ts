import { Router } from 'express';
import { query } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { requireAuth, AuthedRequest } from '../middleware/auth';

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
router.post('/client/register', async (req, res) => {
  const { full_name, phone, email, password, id_type, id_number } = req.body;
  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ error: 'full_name, phone, email, password are required' });
  }
  const existing = await query('SELECT id FROM clients WHERE email = $1', [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO clients (full_name, phone, email, id_type, id_number, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [full_name, phone, email, id_type || 'national_id', id_number || null, password_hash]
  );
  const client = rows[0];
  const token = signToken({ sub: client.id, role: 'client', name: client.full_name, email: client.email });
  res.status(201).json({ token, user: sanitizeClient(client) });
});

// ---------- Client login (+ device linking) ----------
router.post('/client/login', async (req, res) => {
  const { email, password, device_name, platform, device_identifier } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { rows } = await query('SELECT * FROM clients WHERE email = $1', [email]);
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
