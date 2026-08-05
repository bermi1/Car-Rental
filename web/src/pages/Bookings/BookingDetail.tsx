import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookingStepper,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  Field,
  Icon,
  PageHeader,
  Spinner,
  StatusBadge,
  formatDate,
  formatDateRange,
  formatMoney,
  humanize,
  rentalDays,
} from '@rental/shared';
import type {
  Booking,
  BookingStatus,
  ConditionReport,
  Contract,
  Deposit,
  DocumentRecord,
} from '@rental/shared';
import { api, ApiError, assetUrl } from '../../api/client';
import { BackLink } from '../../components/BackLink';
import { ErrorNotice } from '../../components/ErrorNotice';

interface BookingDetailResponse extends Booking {
  documents: DocumentRecord[];
  condition_reports: ConditionReport[];
  contracts: Contract[];
  deposits: Deposit[];
}

type Action = 'confirm' | 'activate' | 'complete' | 'cancel';

export function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<BookingDetailResponse>(`/bookings/${id}`).then(setBooking);
  }

  useEffect(load, [id]);

  async function runAction(action: Action) {
    setError('');
    setBusy(true);
    try {
      await api.post(`/bookings/${id}/${action}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function generateContract() {
    setError('');
    setBusy(true);
    try {
      await api.post(`/contracts/generate/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the contract.');
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return <Spinner />;

  const terminal = booking.status === 'completed' || booking.status === 'cancelled';

  return (
    <>
      <PageHeader
        back={<BackLink to="/bookings">Bookings</BackLink>}
        title={`${booking.vehicle?.make ?? ''} ${booking.vehicle?.model ?? ''}`.trim() || 'Booking'}
        description={
          <>
            {booking.client?.full_name} · {formatDateRange(booking.start_date, booking.end_date)} ·{' '}
            {booking.pickup_region} → {booking.dropoff_region}
            {booking.is_cross_region && (
              <Chip tone="warning" className="ml-2">
                Cross-region
              </Chip>
            )}
          </>
        }
        actions={<StatusBadge status={booking.status} />}
      />

      <Card>
        <BookingStepper status={booking.status as BookingStatus} />
      </Card>

      <div className="mt-4 space-y-4">
        <ErrorNotice message={error} />

        <div className="flex flex-wrap gap-2">
          {booking.status === 'documents_submitted' && (
            <Button icon="check" onClick={() => runAction('confirm')} isLoading={busy}>
              Confirm Booking
            </Button>
          )}
          {booking.status === 'confirmed' && (
            <Link to={`/check-in-out?booking=${booking.id}&type=check_in`}>
              <Button icon="clipboard">Record Check-In</Button>
            </Link>
          )}
          {booking.status === 'active' && (
            <Link to={`/check-in-out?booking=${booking.id}&type=check_out`}>
              <Button icon="clipboard">Record Check-Out</Button>
            </Link>
          )}
          {/* A cancelled booking has nothing to put in a contract. */}
          {booking.contracts.length === 0 && booking.status !== 'cancelled' && (
            <Button variant="outline" icon="file" onClick={generateContract} isLoading={busy}>
              Generate Contract
            </Button>
          )}
          {!terminal && (
            <Button variant="ghost" icon="x" onClick={() => runAction('cancel')} isLoading={busy}>
              Cancel Booking
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rental</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Field label="Vehicle">
            {booking.vehicle ? (
              <Link to={`/fleet/${booking.vehicle_id}`} className="text-accent hover:opacity-75">
                {booking.vehicle.plate_number}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Client">
            {booking.client ? (
              <Link to={`/clients/${booking.client_id}`} className="text-accent hover:opacity-75">
                {booking.client.full_name}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Rental Type">{humanize(booking.rental_type)}</Field>
          <Field label="Duration">{rentalDays(booking.start_date, booking.end_date)} days</Field>
          <Field label="Pickup">{booking.pickup_region}</Field>
          <Field label="Drop-off">{booking.dropoff_region}</Field>
          <Field label="Quoted">{formatMoney(booking.quoted_amount, booking.quoted_currency)}</Field>
          <Field label="Created">{formatDate(booking.created_at)}</Field>
        </dl>
      </Card>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <Link to="/documents" className="text-[13px] font-medium text-accent hover:opacity-75">
              Verification queue
            </Link>
          </CardHeader>
          {booking.documents.length === 0 ? (
            <EmptyState icon="shield" title="No documents uploaded" />
          ) : (
            <ul className="space-y-2">
              {booking.documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{humanize(d.document_type)}</p>
                    <a
                      href={assetUrl(d.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:opacity-75"
                    >
                      View file
                      <Icon name="external" size={12} />
                    </a>
                  </div>
                  <StatusBadge status={d.verified ? 'verified' : 'pending'} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
          </CardHeader>
          {booking.contracts.length === 0 ? (
            <EmptyState icon="file" title="No contract yet" description="Generate one once the booking is confirmed." />
          ) : (
            <ul className="space-y-2">
              {booking.contracts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5"
                >
                  <a
                    href={assetUrl(c.pdf_file_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:opacity-75"
                  >
                    <Icon name="download" size={14} />
                    Contract PDF
                  </a>
                  <StatusBadge status={c.signed ? 'verified' : 'pending'} label={c.signed ? 'Signed' : 'Unsigned'} />
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
            <EmptyState icon="clipboard" title="No reports yet" description="Recorded at check-in and check-out." />
          ) : (
            <ul className="space-y-2">
              {booking.condition_reports.map((r) => (
                <li key={r.id} className="rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-fg">
                      {r.type === 'check_in' ? 'Check-In' : 'Check-Out'}
                    </p>
                    <span className="text-xs text-fg-subtle">{formatDate(r.recorded_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    Fuel {humanize(r.fuel_level)} · {r.mileage.toLocaleString()} km
                  </p>
                  {r.notes && <p className="mt-1 text-xs text-fg-subtle">{r.notes}</p>}
                  {r.photos?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.photos.map((p, i) => (
                        <a key={i} href={assetUrl(p)} target="_blank" rel="noreferrer">
                          <img
                            src={assetUrl(p)}
                            alt=""
                            className="h-12 w-12 rounded-md border border-line object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposits</CardTitle>
            <Link to="/deposits" className="text-[13px] font-medium text-accent hover:opacity-75">
              All deposits
            </Link>
          </CardHeader>
          {booking.deposits.length === 0 ? (
            <EmptyState icon="wallet" title="No deposits recorded" />
          ) : (
            <ul className="space-y-2">
              {booking.deposits.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium tabular-nums text-fg">{formatMoney(d.amount)}</p>
                    {d.reason && <p className="truncate text-xs text-fg-subtle">{d.reason}</p>}
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
