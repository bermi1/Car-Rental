import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { toCsv } from '../services/csv';

const router = Router();
router.use(requireAuth, requireRole('admin'));

async function revenueByVehicle(from: string, to: string) {
  const { rows } = await query(
    `SELECT v.id AS vehicle_id, v.make, v.model, v.plate_number,
            COALESCE(SUM(b.quoted_amount), 0) AS revenue, COUNT(b.id)::int AS bookings
     FROM vehicles v
     LEFT JOIN bookings b ON b.vehicle_id = v.id AND b.status = 'completed' AND b.created_at::date BETWEEN $1 AND $2
     GROUP BY v.id ORDER BY revenue DESC`,
    [from, to]
  );
  return rows;
}

async function revenueByPeriod(from: string, to: string) {
  const { rows } = await query(
    `SELECT date_trunc('month', created_at)::date AS period, COALESCE(SUM(quoted_amount),0) AS revenue, COUNT(*)::int AS bookings
     FROM bookings
     WHERE status = 'completed' AND created_at::date BETWEEN $1 AND $2
     GROUP BY period ORDER BY period ASC`,
    [from, to]
  );
  return rows;
}

async function utilizationTrend(from: string, to: string) {
  const { rows } = await query(
    `SELECT date_trunc('month', created_at)::date AS period, COUNT(*)::int AS bookings
     FROM bookings WHERE created_at::date BETWEEN $1 AND $2
     GROUP BY period ORDER BY period ASC`,
    [from, to]
  );
  return rows;
}

async function mostRentedVehicles(from: string, to: string) {
  const { rows } = await query(
    `SELECT v.make, v.model, v.plate_number, COUNT(b.id)::int AS rentals
     FROM vehicles v JOIN bookings b ON b.vehicle_id = v.id
     WHERE b.created_at::date BETWEEN $1 AND $2
     GROUP BY v.id ORDER BY rentals DESC LIMIT 10`,
    [from, to]
  );
  return rows;
}

async function avgRentalDuration(from: string, to: string) {
  const { rows } = await query(
    `SELECT COALESCE(AVG(end_date - start_date), 0) AS avg_days
     FROM bookings WHERE status IN ('completed','active') AND created_at::date BETWEEN $1 AND $2`,
    [from, to]
  );
  return Number(rows[0].avg_days);
}

router.get('/summary', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const dateFrom = from || '1970-01-01';
  const dateTo = to || '2999-12-31';

  const [byVehicle, byPeriod, utilization, mostRented, avgDuration, volumeTrend] = await Promise.all([
    revenueByVehicle(dateFrom, dateTo),
    revenueByPeriod(dateFrom, dateTo),
    utilizationTrend(dateFrom, dateTo),
    mostRentedVehicles(dateFrom, dateTo),
    avgRentalDuration(dateFrom, dateTo),
    query(
      `SELECT status, COUNT(*)::int AS count FROM bookings
       WHERE created_at::date BETWEEN $1 AND $2 GROUP BY status`,
      [dateFrom, dateTo]
    ),
  ]);

  res.json({
    revenue_by_vehicle: byVehicle,
    revenue_by_period: byPeriod,
    fleet_utilization_trend: utilization,
    booking_volume_trend: volumeTrend.rows,
    most_rented_vehicles: mostRented,
    average_rental_duration_days: avgDuration,
  });
});

router.get('/export.csv', async (req, res) => {
  const { report, from, to } = req.query as Record<string, string>;
  const dateFrom = from || '1970-01-01';
  const dateTo = to || '2999-12-31';

  let rows: Record<string, any>[] = [];
  switch (report) {
    case 'revenue_by_vehicle': rows = await revenueByVehicle(dateFrom, dateTo); break;
    case 'revenue_by_period': rows = await revenueByPeriod(dateFrom, dateTo); break;
    case 'most_rented_vehicles': rows = await mostRentedVehicles(dateFrom, dateTo); break;
    default: return res.status(400).json({ error: 'Unknown report type' });
  }

  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${report}.csv"`);
  res.send(csv);
});

router.get('/export.pdf', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const dateFrom = from || '1970-01-01';
  const dateTo = to || '2999-12-31';

  const [byVehicle, mostRented, avgDuration] = await Promise.all([
    revenueByVehicle(dateFrom, dateTo),
    mostRentedVehicles(dateFrom, dateTo),
    avgRentalDuration(dateFrom, dateTo),
  ]);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(18).text('Fleet & Revenue Report', { align: 'center' });
  doc.fontSize(10).fillColor('#555').text(`Period: ${dateFrom} to ${dateTo}`, { align: 'center' });
  doc.moveDown(2);

  doc.fillColor('#000').fontSize(13).text('Revenue by Vehicle');
  doc.fontSize(10).fillColor('#333');
  byVehicle.forEach((v) => {
    doc.text(`${v.make} ${v.model} (${v.plate_number}) — ${Number(v.revenue).toLocaleString()} TZS, ${v.bookings} bookings`);
  });
  doc.moveDown();

  doc.fillColor('#000').fontSize(13).text('Most Rented Vehicles');
  doc.fontSize(10).fillColor('#333');
  mostRented.forEach((v) => {
    doc.text(`${v.make} ${v.model} (${v.plate_number}) — ${v.rentals} rentals`);
  });
  doc.moveDown();

  doc.fillColor('#000').fontSize(13).text('Average Rental Duration');
  doc.fontSize(10).fillColor('#333').text(`${avgDuration.toFixed(1)} days`);

  doc.end();
});

export default router;
