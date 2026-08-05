import { query } from '../config/db';

const REQUIRED_DOCUMENT_TYPES = ['id_document', 'driving_license'];

/**
 * Once both required document types have been uploaded for a booking's
 * client, move a booking out of pending_documents into documents_submitted.
 * This does NOT confirm the booking — confirmation still requires staff to
 * mark those documents verified (see canConfirmBooking).
 */
export async function maybeAdvanceToDocumentsSubmitted(bookingId: string) {
  const { rows: bookingRows } = await query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bookingRows[0];
  if (!booking || booking.status !== 'pending_documents') return;

  const { rows: docRows } = await query(
    `SELECT DISTINCT document_type FROM documents WHERE client_id = $1 AND document_type = ANY($2)`,
    [booking.client_id, REQUIRED_DOCUMENT_TYPES]
  );
  const uploadedTypes = new Set(docRows.map((r) => r.document_type));
  const allUploaded = REQUIRED_DOCUMENT_TYPES.every((t) => uploadedTypes.has(t));

  if (allUploaded) {
    await query('UPDATE bookings SET status = $1 WHERE id = $2', ['documents_submitted', bookingId]);
  }
}

/**
 * Hard gate: a booking cannot move to "confirmed" until the client's
 * required documents are uploaded AND verified by staff.
 */
export async function canConfirmBooking(bookingId: string): Promise<{ ok: boolean; reason?: string }> {
  const { rows: bookingRows } = await query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bookingRows[0];
  if (!booking) return { ok: false, reason: 'Booking not found' };

  const { rows: docRows } = await query(
    `SELECT document_type, verified FROM documents
     WHERE client_id = $1 AND document_type = ANY($2)`,
    [booking.client_id, REQUIRED_DOCUMENT_TYPES]
  );

  for (const type of REQUIRED_DOCUMENT_TYPES) {
    const docs = docRows.filter((d) => d.document_type === type);
    if (!docs.length) return { ok: false, reason: `Missing ${type.replace('_', ' ')}` };
    if (!docs.some((d) => d.verified)) return { ok: false, reason: `${type.replace('_', ' ')} not verified` };
  }

  return { ok: true };
}
