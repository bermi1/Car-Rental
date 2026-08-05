import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth, requireStaffOrAdmin, requireCompany, AuthedRequest } from '../middleware/auth';
import { aiEnabled, answerOperationsQuestion, summariseHandover, AiUnavailableError } from '../services/ai';

const router = Router();

/** Lets the console hide AI affordances entirely when no key is configured. */
router.get('/status', requireAuth, (_req, res) => {
  res.json({ enabled: aiEnabled() });
});

/**
 * Answers a plain-language question about the company's current position.
 *
 * The snapshot is assembled here rather than accepted from the client, so the
 * model only ever sees aggregates for the one company asking — a staff member
 * cannot phrase a question that reaches another tenant's data.
 */
router.post('/ask', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: new AiUnavailableError().message });

  const { question, language } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' });

  const companyId = req.companyId;

  const [company, fleet, bookings, revenue, payments, damages, maintenance] = await Promise.all([
    query('SELECT name FROM companies WHERE id = $1', [companyId]),
    query(
      `SELECT status, count(*)::int AS count, sum(daily_rate_tzs)::numeric AS daily_value
         FROM vehicles WHERE company_id = $1 GROUP BY status`,
      [companyId]
    ),
    query(
      `SELECT status, count(*)::int AS count FROM bookings WHERE company_id = $1 GROUP BY status`,
      [companyId]
    ),
    query(
      `SELECT COALESCE(sum(quoted_amount), 0)::numeric AS completed_revenue, count(*)::int AS completed_bookings
         FROM bookings WHERE company_id = $1 AND status = 'completed'`,
      [companyId]
    ),
    query(
      `SELECT status, count(*)::int AS count, COALESCE(sum(amount), 0)::numeric AS total
         FROM payments WHERE company_id = $1 GROUP BY status`,
      [companyId]
    ),
    query(
      `SELECT status, count(*)::int AS count, COALESCE(sum(penalty_amount), 0)::numeric AS total
         FROM damages WHERE company_id = $1 GROUP BY status`,
      [companyId]
    ),
    query(
      `SELECT v.make, v.model, v.plate_number, v.current_mileage,
              max(m.next_service_due_mileage) AS next_service_due
         FROM vehicles v
         LEFT JOIN maintenance_logs m ON m.vehicle_id = v.id
        WHERE v.company_id = $1
        GROUP BY v.id, v.make, v.model, v.plate_number, v.current_mileage
       HAVING max(m.next_service_due_mileage) IS NOT NULL
          AND v.current_mileage >= max(m.next_service_due_mileage) - 1000`,
      [companyId]
    ),
  ]);

  try {
    const answer = await answerOperationsQuestion({
      question,
      companyName: company.rows[0]?.name ?? 'the company',
      language: language === 'sw' ? 'sw' : 'en',
      snapshot: {
        fleet_by_status: fleet.rows,
        bookings_by_status: bookings.rows,
        completed_revenue_tzs: Number(revenue.rows[0]?.completed_revenue ?? 0),
        completed_bookings: revenue.rows[0]?.completed_bookings ?? 0,
        payments_by_status: payments.rows,
        damages_by_status: damages.rows,
        vehicles_near_service: maintenance.rows,
        generated_at: new Date().toISOString(),
      },
    });
    res.json({ answer });
  } catch (err: any) {
    res.status(err.status || 502).json({ error: err.message || 'Could not answer that question' });
  }
});

/** Drafts a handover summary from a saved condition report. */
router.post('/handover-summary', requireAuth, requireStaffOrAdmin, requireCompany, async (req: AuthedRequest, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: new AiUnavailableError().message });

  const { condition_report_id, language } = req.body;
  if (!condition_report_id) return res.status(400).json({ error: 'condition_report_id is required' });

  const { rows } = await query(
    `SELECT r.type, r.fuel_level, r.mileage, r.notes, r.photos, r.video_path,
            v.make, v.model, v.plate_number
       FROM condition_reports r
       JOIN bookings b ON b.id = r.booking_id
       JOIN vehicles v ON v.id = b.vehicle_id
      WHERE r.id = $1 AND b.company_id = $2`,
    [condition_report_id, req.companyId]
  );
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Condition report not found' });

  try {
    const summary = await summariseHandover({
      type: report.type,
      vehicle: `${report.make} ${report.model} (${report.plate_number})`,
      fuelLevel: report.fuel_level,
      mileage: Number(report.mileage),
      notes: report.notes,
      photoCount: (report.photos || []).length,
      hasVideo: Boolean(report.video_path),
      language: language === 'sw' ? 'sw' : 'en',
    });
    res.json({ summary });
  } catch (err: any) {
    res.status(err.status || 502).json({ error: err.message || 'Could not draft a summary' });
  }
});

export default router;
