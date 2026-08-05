import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, requireCompany, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';
import { suggestDamages, aiEnabled, AiUnavailableError } from '../services/ai';

const router = Router();

/** Damages raised against the company's bookings. */
router.get('/', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { status } = req.query;
  const params: any[] = [req.companyId];
  let sql = `
    SELECT d.*, c.full_name AS client_name, v.make, v.model, v.plate_number
      FROM damages d
      JOIN bookings b ON b.id = d.booking_id
      JOIN clients c ON c.id = b.client_id
      JOIN vehicles v ON v.id = b.vehicle_id
     WHERE d.company_id = $1`;
  if (status) {
    params.push(status);
    sql += ` AND d.status = $${params.length}`;
  }
  sql += ' ORDER BY d.created_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
});

router.get('/booking/:bookingId', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'client') {
    const { rows } = await query('SELECT client_id FROM bookings WHERE id = $1', [req.params.bookingId]);
    if (!rows[0] || rows[0].client_id !== req.user!.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const { rows } = await query(
    'SELECT * FROM damages WHERE booking_id = $1 ORDER BY created_at DESC',
    [req.params.bookingId]
  );
  res.json(rows);
});

/** Records a damage item and the penalty to be charged for it. */
router.post(
  '/',
  requireAuth,
  requireStaffOrAdmin,
  requireCompany,
  upload.array('photos', 10),
  async (req: AuthedRequest, res) => {
    const { booking_id, description, severity, penalty_amount, currency, condition_report_id, ai_assisted } =
      req.body;
    if (!booking_id || !description) {
      return res.status(400).json({ error: 'booking_id and description are required' });
    }

    const { rows: bookingRows } = await query(
      'SELECT id, company_id FROM bookings WHERE id = $1 AND company_id = $2',
      [booking_id, req.companyId]
    );
    if (!bookingRows[0]) return res.status(404).json({ error: 'Booking not found' });

    const files = (req.files as Express.Multer.File[]) || [];
    const photos: string[] = [];
    for (const file of files) {
      const rel = `damages/${booking_id}-${Date.now()}-${file.originalname}`;
      await storage.save(file.buffer, rel);
      photos.push(storage.urlFor(rel));
    }

    const { rows } = await query(
      `INSERT INTO damages
         (booking_id, company_id, condition_report_id, description, severity,
          photos, penalty_amount, currency, ai_assisted, assessed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        booking_id,
        req.companyId,
        condition_report_id || null,
        description,
        severity || 'minor',
        photos,
        Number(penalty_amount) || 0,
        currency || 'TZS',
        ai_assisted === 'true' || ai_assisted === true,
        req.user!.sub,
      ]
    );

    await logActivity({
      actorStaffId: req.user!.sub,
      companyId: req.companyId,
      action: 'create',
      entityType: 'damage',
      entityId: rows[0].id,
      description: `Recorded ${severity || 'minor'} damage: ${description}`,
    });

    res.status(201).json(rows[0]);
  }
);

/** Charges, waives, or disputes an assessed damage. */
router.put('/:id', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  const { status, penalty_amount } = req.body;
  const { rows } = await query(
    `UPDATE damages
        SET status = COALESCE($1, status),
            penalty_amount = COALESCE($2, penalty_amount)
      WHERE id = $3 AND company_id = $4
      RETURNING *`,
    [status || null, penalty_amount !== undefined ? Number(penalty_amount) : null, req.params.id, req.companyId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Damage not found' });

  await logActivity({
    actorStaffId: req.user!.sub,
    companyId: req.companyId,
    action: 'update',
    entityType: 'damage',
    entityId: rows[0].id,
    description: `Damage marked ${rows[0].status}`,
  });

  res.json(rows[0]);
});

/**
 * Drafts an itemised damage assessment from the staff member's own notes.
 * Returns suggestions only — nothing is written until a human saves them, and
 * anything saved from here carries `ai_assisted` so a reviewer can tell.
 */
router.post('/assist', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: new AiUnavailableError().message });

  const { booking_id, notes, language } = req.body;
  if (!booking_id || !notes?.trim()) {
    return res.status(400).json({ error: 'booking_id and notes are required' });
  }

  const { rows } = await query(
    `SELECT b.start_date, b.end_date,
            v.make, v.model, v.plate_number, v.daily_rate_tzs,
            s.late_return_fee_per_day_tzs, s.fuel_shortfall_fee_tzs,
            (SELECT fuel_level FROM condition_reports
              WHERE booking_id = b.id AND type = 'check_in'
              ORDER BY recorded_at DESC LIMIT 1) AS fuel_in,
            (SELECT fuel_level FROM condition_reports
              WHERE booking_id = b.id AND type = 'check_out'
              ORDER BY recorded_at DESC LIMIT 1) AS fuel_out,
            (SELECT mileage FROM condition_reports
              WHERE booking_id = b.id AND type = 'check_in'
              ORDER BY recorded_at DESC LIMIT 1) AS mileage_in,
            (SELECT mileage FROM condition_reports
              WHERE booking_id = b.id AND type = 'check_out'
              ORDER BY recorded_at DESC LIMIT 1) AS mileage_out
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN company_settings s ON s.company_id = b.company_id
      WHERE b.id = $1 AND b.company_id = $2`,
    [booking_id, req.companyId]
  );
  const ctx = rows[0];
  if (!ctx) return res.status(404).json({ error: 'Booking not found' });

  const lateDays = Math.max(
    0,
    Math.round((Date.now() - new Date(ctx.end_date).getTime()) / 86_400_000)
  );

  try {
    const suggestions = await suggestDamages({
      notes,
      vehicle: `${ctx.make} ${ctx.model} (${ctx.plate_number})`,
      fuelLevelIn: ctx.fuel_in || undefined,
      fuelLevelOut: ctx.fuel_out || undefined,
      mileageDriven:
        ctx.mileage_out && ctx.mileage_in ? Number(ctx.mileage_out) - Number(ctx.mileage_in) : undefined,
      lateDays,
      rates: {
        lateReturnPerDay: Number(ctx.late_return_fee_per_day_tzs),
        fuelShortfall: Number(ctx.fuel_shortfall_fee_tzs),
        dailyRate: Number(ctx.daily_rate_tzs),
      },
      language: language === 'sw' ? 'sw' : 'en',
    });
    res.json({ suggestions });
  } catch (err: any) {
    res.status(err.status || 502).json({ error: err.message || 'Could not draft an assessment' });
  }
});

export default router;
