import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';

const router = Router();

/**
 * Condition reports are the handover record. Staff take a short walkaround
 * video plus stills when the vehicle is handed over and again when it comes
 * back, so its state is evidenced from both ends of the rental — that footage
 * is what a damage assessment is argued from.
 */

router.get('/booking/:bookingId', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'client') {
    const { rows } = await query('SELECT client_id FROM bookings WHERE id = $1', [req.params.bookingId]);
    if (!rows[0] || rows[0].client_id !== req.user!.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const { rows } = await query(
    'SELECT * FROM condition_reports WHERE booking_id = $1 ORDER BY recorded_at ASC',
    [req.params.bookingId]
  );
  res.json(rows);
});

router.post(
  '/',
  requireAuth,
  requireStaffOrAdmin,
  // One walkaround video plus stills, in a single submission.
  upload.fields([
    { name: 'photos', maxCount: 20 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req: AuthedRequest, res) => {
    const { booking_id, type, fuel_level, mileage, notes, exterior_clean } = req.body;
    if (!booking_id || !type || !fuel_level || mileage == null) {
      return res.status(400).json({ error: 'booking_id, type, fuel_level, mileage are required' });
    }

    const fileMap = (req.files as Record<string, Express.Multer.File[]>) || {};

    const photoUrls: string[] = [];
    for (const file of fileMap.photos || []) {
      const relPath = `condition-reports/${booking_id}/${Date.now()}-${file.originalname}`;
      await storage.save(file.buffer, relPath, file.mimetype);
      photoUrls.push(storage.urlFor(relPath));
    }

    let videoPath: string | null = null;
    const video = (fileMap.video || [])[0];
    if (video) {
      const relPath = `condition-reports/${booking_id}/video-${Date.now()}-${video.originalname}`;
      await storage.save(video.buffer, relPath, video.mimetype);
      videoPath = storage.urlFor(relPath);
    }

    const { rows } = await query(
      `INSERT INTO condition_reports
         (booking_id, type, photos, video_path, fuel_level, mileage, notes, exterior_clean, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        booking_id,
        type,
        photoUrls,
        videoPath,
        fuel_level,
        mileage,
        notes || null,
        exterior_clean === undefined ? null : exterior_clean === 'true' || exterior_clean === true,
        req.user!.sub,
      ]
    );

    await query(
      `UPDATE vehicles SET current_mileage = $1
        WHERE id = (SELECT vehicle_id FROM bookings WHERE id = $2) AND current_mileage < $1`,
      [mileage, booking_id]
    );

    const { rows: companyRows } = await query('SELECT company_id FROM bookings WHERE id = $1', [booking_id]);

    await logActivity({
      actorStaffId: req.user!.sub,
      companyId: companyRows[0]?.company_id ?? null,
      action: `condition_report_${type}`,
      entityType: 'booking',
      entityId: booking_id,
      description: `Recorded ${type.replace('_', ' ')} handover${videoPath ? ' with video' : ''}`,
    });

    res.status(201).json(rows[0]);
  }
);

/** The client confirms they agree with the recorded condition. */
router.put('/:id/acknowledge', requireAuth, async (req: AuthedRequest, res) => {
  const { rows: reportRows } = await query(
    `SELECT r.id, b.client_id
       FROM condition_reports r JOIN bookings b ON b.id = r.booking_id
      WHERE r.id = $1`,
    [req.params.id]
  );
  const report = reportRows[0];
  if (!report) return res.status(404).json({ error: 'Condition report not found' });
  if (req.user!.role === 'client' && report.client_id !== req.user!.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { rows } = await query(
    `UPDATE condition_reports
        SET acknowledged_by_client = true, acknowledged_at = now()
      WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  res.json(rows[0]);
});

export default router;
