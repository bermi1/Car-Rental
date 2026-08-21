import { Router } from 'express';
import { query } from '../config/db';
import {
  requireAuth,
  requireStaffOrAdmin,
  requireCompany,
  resolveCompany,
  AuthedRequest,
} from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';

const router = Router();

/**
 * Repairs and servicing.
 *
 * Staff open a repair when something is wrong with a car and close it when the
 * work is done, with a note saying what was actually fixed. A repair that costs
 * money also writes an expense, so the owner's totals include the garage
 * without anyone typing the figure twice.
 */

const STATUSES = ['reported', 'in_progress', 'done', 'cancelled'];

/** Every repair for the company, newest first. */
router.get('/', requireAuth, resolveCompany, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { status, vehicle_id } = req.query;
  const params: any[] = [req.companyId];
  let sql = `
    SELECT m.*, v.make, v.model, v.plate_number, s.name AS recorded_by_name
      FROM maintenance_logs m
      JOIN vehicles v ON v.id = m.vehicle_id
      LEFT JOIN staff_users s ON s.id = m.recorded_by
     WHERE m.company_id = $1`;
  if (status) { params.push(status); sql += ` AND m.status = $${params.length}`; }
  if (vehicle_id) { params.push(vehicle_id); sql += ` AND m.vehicle_id = $${params.length}`; }
  sql += ' ORDER BY m.date DESC, m.created_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
});

/** Opens a repair against one of the company's cars. */
router.post(
  '/',
  requireAuth,
  resolveCompany,
  requireStaffOrAdmin,
  requireCompany,
  upload.array('photos', 10),
  async (req: AuthedRequest, res) => {
    const {
      vehicle_id, service_type, notes, cost, currency, status, garage,
      mileage_at_service, next_service_due_mileage, date, take_out_of_service,
    } = req.body;

    if (!vehicle_id || !service_type?.trim()) {
      return res.status(400).json({ error: 'vehicle_id and what needs doing are required' });
    }
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }

    const { rows: vehicleRows } = await query(
      'SELECT id, current_mileage FROM vehicles WHERE id = $1 AND company_id = $2',
      [vehicle_id, req.companyId]
    );
    const vehicle = vehicleRows[0];
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const files = (req.files as Express.Multer.File[]) || [];
    const photos: string[] = [];
    for (const file of files) {
      const rel = `repairs/${vehicle_id}-${Date.now()}-${file.originalname}`;
      await storage.save(file.buffer, rel, file.mimetype);
      photos.push(storage.urlFor(rel));
    }

    const amount = Number(cost) || 0;
    const repairStatus = status || 'reported';

    // A cost only counts once it has actually been incurred.
    let expenseId: string | null = null;
    if (amount > 0 && repairStatus === 'done') {
      const { rows: expenseRows } = await query(
        `INSERT INTO expenses (company_id, vehicle_id, category, description, amount, currency, spent_on, supplier, recorded_by)
         VALUES ($1,$2,'repair',$3,$4,$5,COALESCE($6, CURRENT_DATE),$7,$8) RETURNING id`,
        [req.companyId, vehicle_id, service_type.trim(), amount, currency || 'TZS', date || null, garage || null, req.user!.sub]
      );
      expenseId = expenseRows[0].id;
    }

    const { rows } = await query(
      `INSERT INTO maintenance_logs
         (vehicle_id, company_id, service_type, mileage_at_service, next_service_due_mileage,
          date, notes, cost, currency, status, garage, photos, expense_id, recorded_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        vehicle_id,
        req.companyId,
        service_type.trim(),
        Number(mileage_at_service) || vehicle.current_mileage || 0,
        next_service_due_mileage ? Number(next_service_due_mileage) : null,
        date || null,
        notes || null,
        amount,
        currency || 'TZS',
        repairStatus,
        garage || null,
        photos,
        expenseId,
        req.user!.sub,
      ]
    );

    // Off the road while it is being worked on, back on when it is finished.
    if (take_out_of_service === 'true' || take_out_of_service === true) {
      await query("UPDATE vehicles SET status = 'in_service' WHERE id = $1", [vehicle_id]);
    }

    await logActivity({
      actorStaffId: req.user!.sub,
      companyId: req.companyId,
      action: 'create',
      entityType: 'repair',
      entityId: rows[0].id,
      description: `Repair opened: ${service_type.trim()}`,
    });

    res.status(201).json(rows[0]);
  }
);

/**
 * Updates a repair — most often to close it with a note about what was done.
 * Closing a repair that cost money writes the expense at that point, once.
 */
router.put('/:id', requireAuth, resolveCompany, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { status, notes, cost, currency, garage, service_type, return_to_service } = req.body;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }

  const { rows: existingRows } = await query(
    'SELECT * FROM maintenance_logs WHERE id = $1 AND company_id = $2',
    [req.params.id, req.companyId]
  );
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Repair not found' });

  const amount = cost !== undefined ? Number(cost) || 0 : Number(existing.cost) || 0;
  const nextStatus = status || existing.status;

  // Write the expense the first time this lands on "done" with a cost, and
  // never again — expense_id is what stops it doubling up.
  let expenseId: string | null = existing.expense_id;
  if (!expenseId && nextStatus === 'done' && amount > 0) {
    const { rows: expenseRows } = await query(
      `INSERT INTO expenses (company_id, vehicle_id, category, description, amount, currency, spent_on, supplier, recorded_by)
       VALUES ($1,$2,'repair',$3,$4,$5,CURRENT_DATE,$6,$7) RETURNING id`,
      [
        req.companyId,
        existing.vehicle_id,
        service_type || existing.service_type,
        amount,
        currency || existing.currency || 'TZS',
        garage ?? existing.garage,
        req.user!.sub,
      ]
    );
    expenseId = expenseRows[0].id;
  } else if (expenseId && amount !== Number(existing.cost)) {
    // Keep an already-written expense in step rather than leaving two figures.
    await query('UPDATE expenses SET amount = $1 WHERE id = $2', [amount, expenseId]);
  }

  const { rows } = await query(
    `UPDATE maintenance_logs
        SET status = $1,
            notes = COALESCE($2, notes),
            cost = $3,
            currency = COALESCE($4, currency),
            garage = COALESCE($5, garage),
            service_type = COALESCE($6, service_type),
            expense_id = $7
      WHERE id = $8 AND company_id = $9
      RETURNING *`,
    [
      nextStatus,
      notes ?? null,
      amount,
      currency || null,
      garage ?? null,
      service_type || null,
      expenseId,
      req.params.id,
      req.companyId,
    ]
  );

  if (return_to_service === true || return_to_service === 'true' || nextStatus === 'done') {
    await query(
      "UPDATE vehicles SET status = 'available' WHERE id = $1 AND status = 'in_service'",
      [existing.vehicle_id]
    );
  }

  await logActivity({
    actorStaffId: req.user!.sub,
    companyId: req.companyId,
    action: 'update',
    entityType: 'repair',
    entityId: rows[0].id,
    description: `Repair marked ${nextStatus}${notes ? `: ${notes}` : ''}`,
  });

  res.json(rows[0]);
});

export default router;
