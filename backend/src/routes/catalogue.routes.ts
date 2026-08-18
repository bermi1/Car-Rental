import { Router } from 'express';
import { query } from '../config/db';

const router = Router();

/**
 * The public shop window — the only routes in the API that need no token.
 *
 * A QR code or a shared link points at /c/<slug>. Everything here is scoped to
 * the company in that slug, so a client never has to know which company they
 * are dealing with before they arrive, and one company's link can never show
 * another company's cars.
 *
 * Only fields a company would print on a flyer are selected. No plate numbers,
 * no mileage, no internal notes — a public endpoint should not leak the fleet's
 * operational detail to anyone who guesses a slug.
 */

/** The company behind a slug, plus its listed cars. */
router.get('/:slug', async (req, res) => {
  const { rows: companyRows } = await query(
    `SELECT id, name, slug, tagline, about, region, contact_email, contact_phone,
            whatsapp_phone, logo_path
       FROM companies
      WHERE slug = $1 AND is_active = true AND catalogue_enabled = true`,
    [req.params.slug]
  );
  const company = companyRows[0];
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const { rows: vehicles } = await query(
    `SELECT id, make, model, category, year, seats, transmission, fuel_type,
            description, condition_note, daily_rate_tzs, photos, status
       FROM vehicles
      WHERE company_id = $1
        AND listed_publicly = true
        AND status <> 'out_of_service'
      ORDER BY status = 'available' DESC, daily_rate_tzs ASC`,
    [company.id]
  );

  const { rows: settingsRows } = await query(
    'SELECT usd_to_tzs_rate, deposit_percent, payment_instructions FROM company_settings WHERE company_id = $1',
    [company.id]
  );

  // company.id is deliberately kept: the booking form needs it, and it is not
  // sensitive — it is the tenant the caller is already looking at.
  res.json({ company, vehicles, settings: settingsRows[0] ?? null });
});

/** One car from the catalogue, for the detail view before booking. */
router.get('/:slug/vehicles/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT v.id, v.make, v.model, v.category, v.year, v.seats, v.transmission,
            v.fuel_type, v.description, v.condition_note, v.daily_rate_tzs,
            v.photos, v.status,
            c.name AS company_name, c.slug AS company_slug, c.whatsapp_phone,
            c.contact_phone
       FROM vehicles v
       JOIN companies c ON c.id = v.company_id
      WHERE c.slug = $1 AND v.id = $2
        AND v.listed_publicly = true AND c.catalogue_enabled = true`,
    [req.params.slug, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(rows[0]);
});

/**
 * A price for a set of dates, without signing in.
 *
 * Someone deciding whether to book should see the number before they are asked
 * to create an account. The rate is read from the vehicle and the company's
 * seasonal pricing — never from anything the caller sends.
 */
router.post('/:slug/quote', async (req, res) => {
  const { vehicle_id, start_date, end_date } = req.body;
  if (!vehicle_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'vehicle_id, start_date and end_date are required' });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return res.status(400).json({ error: 'Check the dates — the return must not be before the pickup' });
  }

  const { rows } = await query(
    `SELECT v.id, v.daily_rate_tzs, v.company_id
       FROM vehicles v JOIN companies c ON c.id = v.company_id
      WHERE c.slug = $1 AND v.id = $2 AND v.listed_publicly = true`,
    [req.params.slug, vehicle_id]
  );
  const vehicle = rows[0];
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  // Inclusive of both ends: picking up and returning the same day is one day.
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  const { rows: seasonRows } = await query(
    `SELECT rate_multiplier FROM seasonal_pricing
      WHERE company_id = $1 AND $2::date BETWEEN start_date AND end_date
      ORDER BY rate_multiplier DESC LIMIT 1`,
    [vehicle.company_id, start_date]
  );
  const multiplier = seasonRows[0] ? Number(seasonRows[0].rate_multiplier) : 1;

  const amount = Math.round(Number(vehicle.daily_rate_tzs) * days * multiplier);
  res.json({ days, daily_rate: Number(vehicle.daily_rate_tzs), multiplier, amount, currency: 'TZS' });
});

export default router;
