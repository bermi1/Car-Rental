import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';

const router = Router();

// Client: list my own devices
router.get('/me', requireAuth, requireRole('client'), async (req: AuthedRequest, res) => {
  const { rows } = await query(
    'SELECT * FROM client_devices WHERE client_id = $1 ORDER BY last_active_at DESC',
    [req.user!.sub]
  );
  res.json(rows);
});

// Client: unlink a device
router.delete('/me/:id', requireAuth, requireRole('client'), async (req: AuthedRequest, res) => {
  const { rows } = await query(
    'UPDATE client_devices SET is_active = false WHERE id = $1 AND client_id = $2 RETURNING *',
    [req.params.id, req.user!.sub]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
  res.json(rows[0]);
});

// Admin: list devices for any client
router.get('/client/:clientId', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM client_devices WHERE client_id = $1 ORDER BY last_active_at DESC',
    [req.params.clientId]
  );
  res.json(rows);
});

export default router;
