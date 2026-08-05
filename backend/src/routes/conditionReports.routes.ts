import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';

const router = Router();

router.get('/booking/:bookingId', requireAuth, async (req, res) => {
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
  upload.array('photos', 20),
  async (req: AuthedRequest, res) => {
    const { booking_id, type, fuel_level, mileage, notes } = req.body;
    if (!booking_id || !type || !fuel_level || mileage == null) {
      return res.status(400).json({ error: 'booking_id, type, fuel_level, mileage are required' });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const photoUrls: string[] = [];
    for (const file of files) {
      const relPath = `condition-reports/${booking_id}/${Date.now()}-${file.originalname}`;
      await storage.save(file.buffer, relPath);
      photoUrls.push(storage.urlFor(relPath));
    }

    const { rows } = await query(
      `INSERT INTO condition_reports (booking_id, type, photos, fuel_level, mileage, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [booking_id, type, photoUrls, fuel_level, mileage, notes || null, req.user!.sub]
    );

    await query('UPDATE vehicles SET current_mileage = $1 WHERE id = (SELECT vehicle_id FROM bookings WHERE id = $2) AND current_mileage < $1', [
      mileage,
      booking_id,
    ]);

    await logActivity({
      actorStaffId: req.user!.sub,
      action: `condition_report_${type}`,
      entityType: 'booking',
      entityId: booking_id,
      description: `Recorded ${type.replace('_', ' ')} condition report for booking ${booking_id}`,
    });

    res.status(201).json(rows[0]);
  }
);

export default router;
