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
import { logActivity } from '../services/activityLog';

const router = Router();

/**
 * What the fleet costs to keep on the road.
 *
 * Staff record expenses as they happen — that is the data entry half of the
 * job. Only an owner may delete one, because deleting is how a number quietly
 * becomes wrong.
 */

/** Matches the expense_category enum. */
const CATEGORIES = [
  'fuel', 'repair', 'service', 'insurance', 'licensing', 'tyres',
  'cleaning', 'parking', 'fine', 'salary', 'rent', 'other',
];

router.get('/', requireAuth, resolveCompany, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { from, to, category, vehicle_id } = req.query;
  const params: any[] = [req.companyId];
  let sql = `
    SELECT e.*, v.make, v.model, v.plate_number, s.name AS recorded_by_name
      FROM expenses e
      LEFT JOIN vehicles v ON v.id = e.vehicle_id
      LEFT JOIN staff_users s ON s.id = e.recorded_by
     WHERE e.company_id = $1`;
  if (from) { params.push(from); sql += ` AND e.spent_on >= $${params.length}`; }
  if (to) { params.push(to); sql += ` AND e.spent_on <= $${params.length}`; }
  if (category) { params.push(category); sql += ` AND e.category = $${params.length}`; }
  if (vehicle_id) { params.push(vehicle_id); sql += ` AND e.vehicle_id = $${params.length}`; }
  sql += ' ORDER BY e.spent_on DESC, e.created_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
});

/** Totals for the owner's dashboard: by category, and by vehicle. */
router.get('/summary', requireAuth, resolveCompany, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { from, to } = req.query;
  const params: any[] = [req.companyId];
  let where = 'WHERE e.company_id = $1';
  if (from) { params.push(from); where += ` AND e.spent_on >= $${params.length}`; }
  if (to) { params.push(to); where += ` AND e.spent_on <= $${params.length}`; }

  const [byCategory, byVehicle, total] = await Promise.all([
    query(`SELECT e.category, sum(e.amount)::float AS total, count(*)::int AS count
             FROM expenses e ${where} GROUP BY e.category ORDER BY total DESC`, params),
    query(`SELECT v.id, v.make, v.model, v.plate_number, sum(e.amount)::float AS total
             FROM expenses e JOIN vehicles v ON v.id = e.vehicle_id ${where}
            GROUP BY v.id, v.make, v.model, v.plate_number ORDER BY total DESC LIMIT 20`, params),
    query(`SELECT COALESCE(sum(e.amount), 0)::float AS total FROM expenses e ${where}`, params),
  ]);

  res.json({
    total: total.rows[0].total,
    by_category: byCategory.rows,
    by_vehicle: byVehicle.rows,
  });
});

router.post(
  '/',
  requireAuth,
  resolveCompany,
  requireStaffOrAdmin,
  requireCompany,
  upload.single('receipt'),
  async (req: AuthedRequest, res) => {
    const { vehicle_id, category, description, amount, currency, spent_on, supplier } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'A description is required' });
    if (amount === undefined || Number.isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ error: 'Enter the amount spent' });
    }
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }

    // A car named here has to be one of this company's.
    if (vehicle_id) {
      const { rows } = await query('SELECT id FROM vehicles WHERE id = $1 AND company_id = $2', [
        vehicle_id,
        req.companyId,
      ]);
      if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found' });
    }

    let receiptPath: string | null = null;
    if (req.file) {
      const rel = `expenses/${Date.now()}-${req.file.originalname}`;
      await storage.save(req.file.buffer, rel);
      receiptPath = storage.urlFor(rel);
    }

    const { rows } = await query(
      `INSERT INTO expenses
         (company_id, vehicle_id, category, description, amount, currency, spent_on, supplier,
          receipt_file_path, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8,$9,$10)
       RETURNING *`,
      [
        req.companyId,
        vehicle_id || null,
        category || 'other',
        description.trim(),
        Number(amount),
        currency || 'TZS',
        spent_on || null,
        supplier || null,
        receiptPath,
        req.user!.sub,
      ]
    );

    await logActivity({
      actorStaffId: req.user!.sub,
      companyId: req.companyId,
      action: 'create',
      entityType: 'expense',
      entityId: rows[0].id,
      description: `Recorded ${category || 'other'} expense: ${description.trim()}`,
    });

    res.status(201).json(rows[0]);
  }
);

router.put('/:id', requireAuth, resolveCompany, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const fields = ['category', 'description', 'amount', 'currency', 'spent_on', 'supplier', 'vehicle_id'];
  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(f === 'vehicle_id' ? req.body[f] || null : req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id, req.companyId);
  const { rows } = await query(
    `UPDATE expenses SET ${updates.join(', ')}
      WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });
  res.json(rows[0]);
});

/** Owner only — removing a cost changes the books. */
router.delete('/:id', requireAuth, resolveCompany, requireCompanyAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { rowCount } = await query('DELETE FROM expenses WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.companyId,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).send();
});

export default router;
