import { Router } from 'express';
import { query } from '../config/db';
import {
  requireAuth,
  requireCompanyAdmin,
  requireStaffOrAdmin,
  requireCompany,
  resolveCompany,
  AuthedRequest,
} from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';

const router = Router();

// List (any authenticated user; clients use this to browse available vehicles)
router.get('/', requireAuth, resolveCompany, async (req: AuthedRequest, res) => {
  const { status, category, start_date, end_date, company_id } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];

  // Internal users only ever see their own company's fleet. Clients browse
  // across companies — that's the marketplace — and may filter to one.
  const tenant = req.user!.role === 'client' ? company_id : req.companyId;
  if (tenant) {
    params.push(tenant);
    conditions.push(`v.company_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`v.status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`v.category = $${params.length}`);
  }

  let availabilitySubquery = '';
  if (start_date && end_date) {
    params.push(start_date, end_date);
    availabilitySubquery = `AND v.id NOT IN (
      SELECT vehicle_id FROM bookings
      WHERE status IN ('confirmed','active','documents_submitted','pending_documents')
      AND start_date <= $${params.length} AND end_date >= $${params.length - 1}
    )`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT v.* FROM vehicles v ${where} ${availabilitySubquery} ORDER BY v.created_at DESC`,
    params
  );
  res.json(rows);
});

/**
 * A single vehicle. Clients browse across the whole platform — that's the
 * point of a marketplace — but staff only ever see their own company's cars,
 * so one tenant can't read another's fleet by guessing an id.
 */
router.get('/:id', requireAuth, resolveCompany, async (req: AuthedRequest, res) => {
  const staffScoped = req.user!.role !== 'client' && req.companyId;
  const { rows } = staffScoped
    ? await query('SELECT * FROM vehicles WHERE id = $1 AND company_id = $2', [req.params.id, req.companyId])
    : await query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(rows[0]);
});

router.post('/', requireAuth, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { make, model, plate_number, category, current_mileage, daily_rate_tzs } = req.body;
  if (!make || !model || !plate_number || !category) {
    return res.status(400).json({ error: 'make, model, plate_number, category are required' });
  }
  const { rows } = await query(
    `INSERT INTO vehicles (company_id, make, model, plate_number, category, current_mileage, daily_rate_tzs)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.companyId, make, model, plate_number, category, current_mileage || 0, daily_rate_tzs || 0]
  );
  await logActivity({
    actorStaffId: req.user!.sub,
    action: 'vehicle_created',
    entityType: 'vehicle',
    entityId: rows[0].id,
    description: `Added vehicle ${make} ${model} (${plate_number})`,
  });
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth, resolveCompany, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const fields = ['make', 'model', 'plate_number', 'category', 'status', 'current_mileage', 'daily_rate_tzs'];
  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id, req.companyId);
  // The company clause is what stops one tenant editing another's car by id.
  const { rows } = await query(
    `UPDATE vehicles SET ${updates.join(', ')}
      WHERE id = $${params.length - 1} AND company_id = $${params.length}
      RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(rows[0]);
});

router.delete('/:id', requireAuth, resolveCompany, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { rowCount } = await query('DELETE FROM vehicles WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.companyId,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Vehicle not found' });
  res.status(204).send();
});

// Photo upload
router.post(
  '/:id/photos',
  requireAuth,
  requireStaffOrAdmin,
  upload.array('photos', 10),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const saved: string[] = [];
    for (const file of files) {
      const relPath = `vehicles/${req.params.id}/${Date.now()}-${file.originalname}`;
      await storage.save(file.buffer, relPath);
      saved.push(storage.urlFor(relPath));
    }
    const { rows } = await query(
      `UPDATE vehicles SET photos = photos || $1::text[] WHERE id = $2 RETURNING *`,
      [saved, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(rows[0]);
  }
);

// Maintenance logs
router.get('/:id/maintenance', requireAuth, requireStaffOrAdmin, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM maintenance_logs WHERE vehicle_id = $1 ORDER BY date DESC',
    [req.params.id]
  );
  res.json(rows);
});

router.post('/:id/maintenance', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { service_type, mileage_at_service, next_service_due_mileage, date, notes } = req.body;
  if (!service_type || mileage_at_service == null || !date) {
    return res.status(400).json({ error: 'service_type, mileage_at_service, date are required' });
  }
  const { rows } = await query(
    `INSERT INTO maintenance_logs (vehicle_id, service_type, mileage_at_service, next_service_due_mileage, date, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.id, service_type, mileage_at_service, next_service_due_mileage || null, date, notes || null, req.user!.sub]
  );
  await query('UPDATE vehicles SET current_mileage = $1 WHERE id = $2 AND current_mileage < $1', [
    mileage_at_service,
    req.params.id,
  ]);
  res.status(201).json(rows[0]);
});

export default router;
