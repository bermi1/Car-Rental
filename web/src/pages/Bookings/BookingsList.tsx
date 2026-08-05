import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardToolbar,
  Chip,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  formatDateRange,
  formatMoney,
} from '@rental/shared';
import type { Booking } from '@rental/shared';
import { api } from '../../api/client';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_documents', label: 'Pending Docs' },
  { value: 'documents_submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function BookingsList() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setBookings(null);
    api.get<Booking[]>(`/bookings${status ? `?status=${status}` : ''}`).then(setBookings);
  }, [status]);

  // Client-side filter: the list endpoint filters by status only, and the
  // dataset is small enough that a local text match beats another round trip.
  const visible = useMemo(() => {
    if (!bookings) return null;
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      [b.client?.full_name, b.vehicle?.make, b.vehicle?.model, b.vehicle?.plate_number, b.pickup_region]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [bookings, search]);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every rental across the fleet."
        actions={
          <Link to="/bookings/new">
            <Button icon="plus">New Booking</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={FILTERS} value={status} onChange={setStatus} />
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client, vehicle, plate…"
          wrapperClassName="w-full sm:w-72"
        />
      </div>

      <Card flush>
        {!visible ? (
          <SkeletonTable />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={search ? 'No matching bookings' : 'No bookings yet'}
            description={search ? 'Try a different search term.' : 'Create a booking to get started.'}
          />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {visible.length} booking{visible.length === 1 ? '' : 's'}
              </p>
            </CardToolbar>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Client</TH>
                  <TH>Vehicle</TH>
                  <TH>Dates</TH>
                  <TH>Route</TH>
                  <TH numeric>Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((b) => (
                  <TR key={b.id}>
                    <TD className="whitespace-nowrap">
                      <Link
                        to={`/bookings/${b.id}`}
                        className="font-medium text-fg transition-colors hover:text-accent"
                      >
                        {b.client?.full_name ?? '—'}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {b.vehicle ? (
                        <>
                          {b.vehicle.make} {b.vehicle.model}
                          <span className="ml-1.5 text-fg-subtle">{b.vehicle.plate_number}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">{formatDateRange(b.start_date, b.end_date)}</TD>
                    <TD>
                      <span className="whitespace-nowrap">
                        {b.pickup_region} → {b.dropoff_region}
                      </span>
                      {b.is_cross_region && (
                        <Chip tone="warning" className="ml-2">
                          Cross-region
                        </Chip>
                      )}
                    </TD>
                    <TD numeric className="whitespace-nowrap font-medium text-fg">
                      {formatMoney(b.quoted_amount, b.quoted_currency)}
                    </TD>
                    <TD>
                      <StatusBadge status={b.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
      </Card>
    </>
  );
}
