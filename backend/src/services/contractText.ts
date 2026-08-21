import { query } from '../config/db';
import { buildBill } from './billing';

/**
 * Builds the contract a customer actually signs.
 *
 * The old contract was a stub — a PDF with the booking's headline figures. A
 * rental agreement has to say who the parties are, what car, for how long, at
 * what price, on whose terms, and what happens when things go wrong. It also
 * has to keep saying it: the rendered text is stored on the contract row, so
 * what was agreed cannot drift when a rate or a set of terms changes later.
 */

/** Section rule. Short enough to fit a phone without forcing a sideways scroll. */
const RULE = '─'.repeat(32);

/** The wording a company starts with, until they write their own. */
export const DEFAULT_TERMS = `1. THE VEHICLE
The Company rents the vehicle described in this agreement to the Customer for the period stated. The vehicle remains the property of the Company at all times.

2. THE DRIVER
Only the Customer, and any additional driver named in this agreement, may drive the vehicle. The driver must hold a valid driving licence and produce it on request. Driving under the influence of alcohol or drugs is prohibited.

3. USE OF THE VEHICLE
The vehicle may not be used to carry passengers or goods for hire, to push or tow another vehicle, in any race or contest, or outside the agreed regions without the Company's written permission. It may not be driven on roads that are unsuitable for it.

4. PAYMENT
The rental charge is payable as set out in this agreement. Where a security deposit is taken, it is refunded after the vehicle is returned and inspected, less any amount owed under this agreement.

5. RETURN AND LATE RETURN
The vehicle must be returned to the agreed place on the agreed date, with the same fuel level as at collection. A late return is charged at the daily late fee shown in this agreement for each day or part-day, in addition to the rental charge. Returning with less fuel is charged at the fuel shortfall fee.

6. CONDITION AND DAMAGE
The condition of the vehicle is recorded in photographs and a walkaround video at collection and again at return, and both records form part of this agreement. The Customer is responsible for damage that occurs during the rental period, assessed against the Company's published penalty rates.

7. BREAKDOWN AND ACCIDENT
The Customer must inform the Company immediately of any breakdown, accident, theft or damage, and must not authorise any repair without the Company's consent. In an accident the Customer must obtain a police report.

8. TRAFFIC OFFENCES
The Customer is responsible for any traffic fine, penalty or charge incurred during the rental period.

9. LOCATION SHARING
Where the Customer has agreed to share the vehicle's location, position data is collected only while the rental is active and only for the purpose of locating the vehicle and assisting the Customer. The Customer may withdraw that consent at any time.

10. TERMINATION
The Company may end this agreement and recover the vehicle if the Customer breaches any term of it.

11. GOVERNING LAW
This agreement is governed by the laws of the United Republic of Tanzania.`;

/** The company's current terms, creating the default set on first use. */
export async function currentTerms(companyId: string) {
  const { rows } = await query(
    'SELECT * FROM company_terms WHERE company_id = $1 AND is_current = true',
    [companyId]
  );
  if (rows[0]) return rows[0];

  const { rows: created } = await query(
    `INSERT INTO company_terms (company_id, version, body, is_current)
     VALUES ($1, 1, $2, true) RETURNING *`,
    [companyId, DEFAULT_TERMS]
  );
  return created[0];
}

function money(amount: number, currency = 'TZS') {
  return `${Number(amount).toLocaleString('en-GB')} ${currency}`;
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Renders the full agreement for a booking.
 *
 * Returns the text plus the terms row it was built from, so the caller can
 * store both and the signature can be tied to an exact version.
 */
export async function renderContract(bookingId: string) {
  const { rows } = await query(
    `SELECT b.*, 
            c.full_name AS client_name, c.phone AS client_phone, c.email AS client_email,
            c.id_number, c.address AS client_address, c.licence_number, c.licence_expiry,
            c.emergency_contact_name, c.emergency_contact_phone,
            v.make, v.model, v.plate_number, v.year, v.category, v.current_mileage,
            co.name AS company_name, co.registration_number, co.contact_phone AS company_phone,
            co.contact_email AS company_email, co.region AS company_region,
            s.late_return_fee_per_day_tzs, s.fuel_shortfall_fee_tzs, s.deposit_percent
       FROM bookings b
       JOIN clients c   ON c.id = b.client_id
       JOIN vehicles v  ON v.id = b.vehicle_id
       JOIN companies co ON co.id = b.company_id
       JOIN company_settings s ON s.company_id = b.company_id
      WHERE b.id = $1`,
    [bookingId]
  );
  const d = rows[0];
  if (!d) return null;

  const terms = await currentTerms(d.company_id);
  const bill = await buildBill(bookingId);
  const days = Math.max(
    1,
    Math.round(
      (new Date(d.end_date).getTime() - new Date(d.start_date).getTime()) / 86_400_000
    ) + 1
  );

  const reference = `${(d.company_name || 'RENTAL')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 4)
    .toUpperCase()}-${String(bookingId).slice(0, 8).toUpperCase()}`;

  const billLines = (bill?.lines ?? [])
    .map((l) => `  ${l.label}${l.detail ? ` (${l.detail})` : ''}: ${money(l.amount, bill!.currency)}`)
    .join('\n');

  // Laid out as label-and-value on one line rather than padded columns: a
  // contract has to be readable on the phone it is signed on, and a column
  // aligned for a sheet of A4 falls apart at 360 pixels wide.
  const body = `VEHICLE RENTAL AGREEMENT
Reference: ${reference}
Date: ${formatDate(new Date())}

${RULE}
THE COMPANY
${RULE}
Name: ${d.company_name}
${d.registration_number ? `Registration: ${d.registration_number}\n` : ''}Region: ${d.company_region ?? '—'}
Telephone: ${d.company_phone ?? '—'}
Email: ${d.company_email ?? '—'}

${RULE}
THE CUSTOMER
${RULE}
Name: ${d.client_name}
Telephone: ${d.client_phone}
Email: ${d.client_email ?? '—'}
ID number: ${d.id_number ?? '—'}
Address: ${d.client_address ?? '—'}
Driving licence: ${d.licence_number ?? '—'}${d.licence_expiry ? ` (expires ${formatDate(d.licence_expiry)})` : ''}
Emergency contact: ${d.emergency_contact_name ?? '—'}${d.emergency_contact_phone ? ` — ${d.emergency_contact_phone}` : ''}

${RULE}
THE VEHICLE
${RULE}
Vehicle: ${d.make} ${d.model}${d.year ? ` (${d.year})` : ''}
Registration: ${d.plate_number}
Category: ${d.category}
Mileage out: ${Number(d.current_mileage).toLocaleString()} km

${RULE}
THE RENTAL
${RULE}
Collection: ${formatDate(d.start_date)} at ${d.pickup_region}
Return: ${formatDate(d.end_date)} at ${d.dropoff_region}
Duration: ${days} day${days === 1 ? '' : 's'}
Type: ${d.rental_type === 'driver_included' ? 'With driver' : 'Self drive'}

${RULE}
CHARGES
${RULE}
${billLines || `  Rental: ${money(d.quoted_amount, d.quoted_currency)}`}

  TOTAL: ${money(bill?.subtotal ?? d.quoted_amount, bill?.currency ?? d.quoted_currency)}
  Paid to date: ${money(bill?.paid ?? 0, bill?.currency ?? d.quoted_currency)}
  BALANCE: ${money(bill?.balance ?? d.quoted_amount, bill?.currency ?? d.quoted_currency)}

Late return fee: ${money(d.late_return_fee_per_day_tzs)} per day or part-day
Fuel shortfall: ${money(d.fuel_shortfall_fee_tzs)}
Security deposit: ${Number(d.deposit_percent)}% of the rental charge

${RULE}
${terms.title.toUpperCase()}
${RULE}
${terms.body}

${RULE}
DECLARATION
${RULE}
I confirm that I have read and understood this agreement and the terms and conditions set out above, that the information I have given is correct, and that I accept the charges stated. I agree to return the vehicle on the date and at the place agreed, and to pay any late return, fuel or damage charges that become due under this agreement.`;

  return { body, terms, reference, bill };
}
