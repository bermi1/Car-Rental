import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, AuthedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storage } from '../services/storage';
import { logActivity } from '../services/activityLog';
import { maybeAdvanceToDocumentsSubmitted } from '../services/bookingWorkflow';

const router = Router();

// Verification queue: all unverified documents (staff/admin)
router.get('/queue', requireAuth, requireStaffOrAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT d.*, c.full_name AS client_name, c.email AS client_email
     FROM documents d JOIN clients c ON c.id = d.client_id
     WHERE d.verified = false
     ORDER BY d.uploaded_at ASC`
  );
  res.json(rows);
});

// List documents for a client (own client, or staff/admin)
router.get('/client/:clientId', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === 'client' && req.user!.sub !== req.params.clientId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { rows } = await query(
    'SELECT * FROM documents WHERE client_id = $1 ORDER BY uploaded_at DESC',
    [req.params.clientId]
  );
  res.json(rows);
});

// List documents for a booking
router.get('/booking/:bookingId', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM documents WHERE booking_id = $1 ORDER BY uploaded_at DESC',
    [req.params.bookingId]
  );
  res.json(rows);
});

// Upload a document (client uploads own; staff can upload on behalf of a client)
router.post('/', requireAuth, upload.single('file'), async (req: AuthedRequest, res) => {
  const { client_id, booking_id, document_type } = req.body;
  const targetClientId = req.user!.role === 'client' ? req.user!.sub : client_id;
  if (!targetClientId || !document_type) {
    return res.status(400).json({ error: 'client_id and document_type are required' });
  }
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const relPath = `documents/${targetClientId}/${Date.now()}-${req.file.originalname}`;
  await storage.save(req.file.buffer, relPath);
  const fileUrl = storage.urlFor(relPath);

  const { rows } = await query(
    `INSERT INTO documents (booking_id, client_id, document_type, file_path)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [booking_id || null, targetClientId, document_type, fileUrl]
  );

  // Keep a convenience pointer on the client record too
  if (document_type === 'id_document') {
    await query('UPDATE clients SET id_document_file = $1 WHERE id = $2', [fileUrl, targetClientId]);
  } else if (document_type === 'driving_license') {
    await query('UPDATE clients SET driving_license_file = $1 WHERE id = $2', [fileUrl, targetClientId]);
  }

  if (booking_id) {
    await maybeAdvanceToDocumentsSubmitted(booking_id);
  }

  res.status(201).json(rows[0]);
});

// Verify / reject a document (staff/admin)
router.put('/:id/verify', requireAuth, requireStaffOrAdmin, async (req: AuthedRequest, res) => {
  const { verified, rejection_reason } = req.body;
  const { rows } = await query(
    `UPDATE documents
     SET verified = $1, verified_by = $2, verified_at = now(), rejection_reason = $3
     WHERE id = $4 RETURNING *`,
    [!!verified, req.user!.sub, verified ? null : rejection_reason || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' });

  await logActivity({
    actorStaffId: req.user!.sub,
    action: verified ? 'document_verified' : 'document_rejected',
    entityType: 'document',
    entityId: rows[0].id,
    description: `${verified ? 'Verified' : 'Rejected'} ${rows[0].document_type} for client ${rows[0].client_id}`,
  });

  if (rows[0].booking_id) {
    await maybeAdvanceToDocumentsSubmitted(rows[0].booking_id);
  }

  res.json(rows[0]);
});

export default router;
