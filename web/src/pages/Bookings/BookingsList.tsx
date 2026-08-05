import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardToolbar,
  Chip,
  DataTable,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  Tabs,
  formatDateRange,
  formatMoney,
  type DataColumn,
} from '@rental/shared';
import type { Booking } from '@rental/shared';
import { api } from '../../api/client';
import { useT } from '../../i18n';

export function BookingsList() {
  const t = useT();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setBookings(null);
    api.get<Booking[]>(`/bookings${status ? `?status=${status}` : ''}`).then(setBookings);
  }, [status]);

  const filters = [
    { value: '', label: t('common.all') },
    { value: 'pending_documents', label: 'Pending Docs' },
    { value: 'documents_submitted', label: 'Submitted' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // Client-side filter: the endpoint filters by status only, and the dataset is
  // small enough that a local text match beats another round trip.
  const visible = useMemo(() => {
    if (!bookings) return null;
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      [b.client?.full_name, b.vehicle?.make, b.vehicle?.model, b.vehicle?.plate_number, b.pickup_region]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [bookings, search]);

  const columns: DataColumn<Booking>[] = [
    {
      key: 'client',
      header: t('common.client'),
      primary: true,
      render: (b) => (
        <Link to={`/bookings/${b.id}`} className="font-medium text-fg transition-colors hover:text-accent">
          {b.client?.full_name ?? '—'}
        </Link>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'vehicle',
      header: t('common.vehicle'),
      secondary: true,
      render: (b) =>
        b.vehicle ? (
          <>
            {b.vehicle.make} {b.vehicle.model} <span className="text-fg-subtle">{b.vehicle.plate_number}</span>
          </>
        ) : (
          '—'
        ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'dates',
      header: t('common.date'),
      render: (b) => formatDateRange(b.start_date, b.end_date),
      className: 'whitespace-nowrap',
    },
    {
      key: 'route',
      header: 'Route',
      render: (b) => (
        <>
          <span className="whitespace-nowrap">
            {b.pickup_region} → {b.dropoff_region}
          </span>
          {b.is_cross_region && (
            <Chip tone="warning" className="ml-2">
              Cross-region
            </Chip>
          )}
        </>
      ),
    },
    {
      key: 'amount',
      header: t('common.amount'),
      numeric: true,
      render: (b) => (
        <span className="font-medium text-fg">{formatMoney(b.quoted_amount, b.quoted_currency)}</span>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'status',
      header: t('common.status'),
      action: true,
      render: (b) => <StatusBadge status={b.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nav.bookings')}
        description="Every rental across the fleet."
        actions={
          <Link to="/bookings/new">
            <Button icon="plus">{t('overview.newBooking')}</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <Tabs items={filters} value={status} onChange={setStatus} className="w-max sm:w-auto" />
        </div>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
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
                {visible.length} {visible.length === 1 ? 'booking' : 'bookings'}
              </p>
            </CardToolbar>
            <DataTable columns={columns} rows={visible} rowKey={(b) => b.id} />
          </>
        )}
      </Card>
    </>
  );
}
