import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, BookingStepper, Card, CardHeader, CardTitle, EmptyState, Spinner, StatusBadge } from '@rental/shared';
import type { Booking, DocumentRecord, ConditionReport, Contract, Deposit, BookingStatus } from '@rental/shared';
import { api, ApiError, assetUrl } from '../../api/client';

interface BookingDetailResponse extends Booking {
  documents: DocumentRecord[];
  condition_reports: ConditionReport[];
  contracts: Contract[];
  deposits: Deposit[];
}

export function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<BookingDetailResponse>(`/bookings/${id}`).then(setBooking);
  }

  useEffect(load, [id]);

  async function runAction(action: 'confirm' | 'activate' | 'complete' | 'cancel') {
    setError('');
    setBusy(true);
    try {
      await api.post(`/bookings/${id}/${action}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function generateContract() {
    setBusy(true);
    try {
      await api.post(`/contracts/generate/${id}`);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return <Spinner />;

  return (
    <div className="space-y-6">
      <Link to="/bookings" className="text-sm text-neutral-500 hover:text-primary-600">
        ← Back to Bookings
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {booking.vehicle?.make} {booking.vehicle?.model} — {booking.client?.full_name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {new Date(booking.start_date).toLocaleDateString()} – {new Date(booking.end_date).toLocaleDateString()} ·{' '}
            {booking.pickup_region} → {booking.dropoff_region}
            {booking.is_cross_region && (
              <span className="ml-2 rounded-full bg-status-pendingBg px-2 py-0.5 text-xs font-medium text-status-pendingFg">
                Cross-region
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <Card>
        <BookingStepper status={booking.status as BookingStatus} />
      </Card>

      {error && <p className="text-sm text-status-cancelledFg">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {booking.status === 'documents_submitted' && (
          <Button onClick={() => runAction('confirm')} isLoading={busy}>
            Confirm Booking
          </Button>
        )}
        {booking.status === 'confirmed' && (
          <Link to={`/check-in-out?booking=${booking.id}&type=check_in`}>
            <Button isLoading={busy}>Record Check-In</Button>
          </Link>
        )}
        {booking.status === 'active' && (
          <Link to={`/check-in-out?booking=${booking.id}&type=check_out`}>
            <Button isLoading={busy}>Record Check-Out</Button>
          </Link>
        )}
        {!['completed', 'cancelled'].includes(booking.status) && (
          <Button variant="danger" onClick={() => runAction('cancel')} isLoading={busy}>
            Cancel Booking
          </Button>
        )}
        {booking.contracts.length === 0 && (
          <Button variant="secondary" onClick={generateContract} isLoading={busy}>
            Generate Contract
          </Button>
        )}
        <Link to={`/deposits?booking=${booking.id}`}>
          <Button variant="secondary">Record Deposit</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          {booking.documents.length === 0 ? (
            <EmptyState title="No documents uploaded" />
          ) : (
            <ul className="space-y-3">
              {booking.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-800">{d.document_type.replace('_', ' ')}</p>
                    <a href={assetUrl(d.file_path)} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">
                      View file
                    </a>
                  </div>
                  <StatusBadge status={d.verified ? 'confirmed' : 'pending_documents'} />
                </li>
              ))}
            </ul>
          )}
          {booking.documents.some((d) => !d.verified) && (
            <Link to="/documents" className="mt-3 block text-sm font-medium text-primary-600 hover:underline">
              Go to verification queue →
            </Link>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
          </CardHeader>
          {booking.contracts.length === 0 ? (
            <EmptyState title="No contract generated yet" />
          ) : (
            <ul className="space-y-3">
              {booking.contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm">
                  <a href={assetUrl(c.pdf_file_path)} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">
                    Download Contract PDF
                  </a>
                  <StatusBadge status={c.signed ? 'confirmed' : 'pending_documents'} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condition Reports</CardTitle>
          </CardHeader>
          {booking.condition_reports.length === 0 ? (
            <EmptyState title="No condition reports yet" />
          ) : (
            <ul className="space-y-3">
              {booking.condition_reports.map((r) => (
                <li key={r.id} className="rounded-lg bg-neutral-50 p-3 text-sm">
                  <p className="font-medium text-neutral-800">{r.type === 'check_in' ? 'Check-In' : 'Check-Out'}</p>
                  <p className="text-xs text-neutral-500">Fuel: {r.fuel_level} · Mileage: {r.mileage.toLocaleString()} km</p>
                  {r.notes && <p className="mt-1 text-xs text-neutral-400">{r.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposits</CardTitle>
          </CardHeader>
          {booking.deposits.length === 0 ? (
            <EmptyState title="No deposits recorded" />
          ) : (
            <ul className="space-y-3">
              {booking.deposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-800">{Number(d.amount).toLocaleString()} TZS</p>
                    {d.reason && <p className="text-xs text-neutral-400">{d.reason}</p>}
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
