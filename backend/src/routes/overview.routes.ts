import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireRole, requireCompanyAdmin } from '../middleware/auth';

const router = Router();

// Admin dashboard summary
router.get('/admin', requireAuth, requireCompanyAdmin, async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const dateFrom = from || '1970-01-01';
  const dateTo = to || '2999-12-31';

  const [fleet, revenue, pipeline, missingDocs, maintenanceDue, recentActivity] = await Promise.all([
    query(`SELECT status, COUNT(*)::int AS count FROM vehicles GROUP BY status`),
    query(
      `SELECT COALESCE(SUM(quoted_amount), 0) AS total, COUNT(*)::int AS count
       FROM bookings
       WHERE status = 'completed' AND created_at::date BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    ),
    query(`SELECT status, COUNT(*)::int AS count FROM bookings GROUP BY status`),
    query(
      `SELECT b.id, b.start_date, b.client_id, c.full_name AS client_name
       FROM bookings b JOIN clients c ON c.id = b.client_id
       WHERE b.status = 'pending_documents' ORDER BY b.created_at ASC LIMIT 20`
    ),
    query(
      `SELECT v.id, v.make, v.model, v.plate_number, v.current_mileage, m.next_service_due_mileage
       FROM vehicles v
       JOIN LATERAL (
         SELECT next_service_due_mileage FROM maintenance_logs
         WHERE vehicle_id = v.id ORDER BY date DESC LIMIT 1
       ) m ON true
       WHERE m.next_service_due_mileage IS NOT NULL
       AND v.current_mileage >= m.next_service_due_mileage - 1000
       ORDER BY (m.next_service_due_mileage - v.current_mileage) ASC`
    ),
    query(
      `SELECT a.*, s.name AS actor_name FROM activity_log a
       LEFT JOIN staff_users s ON s.id = a.actor_staff_id
       ORDER BY a.created_at DESC LIMIT 15`
    ),
  ]);

  const totalVehicles = fleet.rows.reduce((sum, r) => sum + r.count, 0);
  const bookedCount = fleet.rows.find((r) => r.status === 'booked')?.count || 0;
  const utilizationRate = totalVehicles ? Math.round((bookedCount / totalVehicles) * 1000) / 10 : 0;

  res.json({
    fleet_utilization_rate: utilizationRate,
    fleet_by_status: fleet.rows,
    revenue: { total: Number(revenue.rows[0].total), completed_bookings: revenue.rows[0].count },
    bookings_pipeline: pipeline.rows,
    missing_documents: missingDocs.rows,
    maintenance_due: maintenanceDue.rows,
    recent_activity: recentActivity.rows,
  });
});

// Staff dashboard summary
router.get('/staff', requireAuth, requireRole('admin', 'staff'), async (_req, res) => {
  const [todaysBookings, pendingDocs] = await Promise.all([
    query(
      `SELECT b.*, v.make, v.model, v.plate_number, c.full_name AS client_name
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN clients c ON c.id = b.client_id
       WHERE (b.start_date = CURRENT_DATE OR b.end_date = CURRENT_DATE)
       AND b.status IN ('confirmed','active')
       ORDER BY b.start_date ASC`
    ),
    query(
      `SELECT b.*, c.full_name AS client_name
       FROM bookings b JOIN clients c ON c.id = b.client_id
       WHERE b.status IN ('pending_documents','documents_submitted')
       ORDER BY b.created_at ASC`
    ),
  ]);
  res.json({
    todays_bookings: todaysBookings.rows,
    pending_document_verification: pendingDocs.rows,
  });
});

export default router;
