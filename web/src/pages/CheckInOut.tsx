import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  cn,
  formatDateRange,
} from '@rental/shared';
import type { Booking } from '@rental/shared';
import { api, ApiError } from '../api/client';
import { ErrorNotice } from '../components/ErrorNotice';

/** Bookings awaiting collection or return, newest state first. */
async function loadActionable(): Promise<Booking[]> {
  const [confirmed, active] = await Promise.all([
    api.get<Booking[]>('/bookings?status=confirmed'),
    api.get<Booking[]>('/bookings?status=active'),
  ]);
  return [...confirmed, ...active];
}

export function CheckInOut() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('booking') || '');

  const [fuelLevel, setFuelLevel] = useState('full');
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadActionable().then(setBookings);
  }, []);

  const selected = bookings?.find((b) => b.id === selectedId) ?? null;
  // The booking's own status decides the direction — it can't be chosen wrongly.
  const type: 'check_in' | 'check_out' = selected?.status === 'active' ? 'check_out' : 'check_in';

  function selectBooking(b: Booking) {
    setSelectedId(b.id);
    setSearchParams({ booking: b.id });
    setSuccess('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const form = new FormData();
      form.append('booking_id', selected.id);
      form.append('type', type);
      form.append('fuel_level', fuelLevel);
      form.append('mileage', mileage);
      form.append('notes', notes);
      if (photos) Array.from(photos).forEach((f) => form.append('photos', f));

      await api.post('/condition-reports', form);
      await api.post(`/bookings/${selected.id}/${type === 'check_in' ? 'activate' : 'complete'}`);

      setSuccess(
        type === 'check_in'
          ? 'Check-in recorded — the booking is now active.'
          : 'Check-out recorded — the booking is complete.'
      );
      setMileage('');
      setNotes('');
      setPhotos(null);
      setSelectedId('');
      setSearchParams({});
      setBookings(await loadActionable());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Check-In / Check-Out" description="Record vehicle condition at pickup and return." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card flush>
          <div className="px-5 py-4">
            <CardTitle>Awaiting Action</CardTitle>
            <p className="mt-0.5 text-[13px] text-fg-muted">Confirmed bookings to collect, active ones to return.</p>
          </div>

          {!bookings ? (
            <Spinner />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon="check"
              title="Nothing to check in or out"
              description="No confirmed or active bookings right now."
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {bookings.map((b) => {
                const isSelected = b.id === selectedId;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => selectBooking(b)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors',
                        isSelected ? 'bg-accent-soft' : 'hover:bg-surface-sunken'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">
                          {b.client?.full_name} — {b.vehicle?.make} {b.vehicle?.model}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-fg-subtle">
                          {b.vehicle?.plate_number} · {formatDateRange(b.start_date, b.end_date)}
                        </p>
                      </div>
                      <StatusBadge
                        status={b.status === 'confirmed' ? 'pending' : 'active'}
                        label={b.status === 'confirmed' ? 'Check-in' : 'Check-out'}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{type === 'check_in' ? 'Check-In Report' : 'Check-Out Report'}</CardTitle>
            {selected && <StatusBadge status={selected.status} />}
          </CardHeader>

          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-success-soft px-3.5 py-2.5 text-[13px] text-success-fg">
              <Icon name="check" size={15} className="shrink-0" />
              {success}
            </div>
          )}

          {!selected ? (
            <EmptyState
              icon="clipboard"
              title="No booking selected"
              description="Pick one from the list to record its condition report."
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg border border-line bg-surface-sunken/60 px-3.5 py-3">
                <p className="text-[13px] font-medium text-fg">
                  {selected.vehicle?.make} {selected.vehicle?.model} · {selected.vehicle?.plate_number}
                </p>
                <p className="mt-0.5 text-xs text-fg-subtle">{selected.client?.full_name}</p>
              </div>

              <Select label="Fuel Level" value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)}>
                <option value="full">Full</option>
                <option value="three_quarters">Three Quarters</option>
                <option value="half">Half</option>
                <option value="quarter">Quarter</option>
                <option value="empty">Empty</option>
              </Select>

              <Input
                label="Mileage (km)"
                type="number"
                min="0"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                required
              />

              <Textarea
                label="Notes"
                placeholder="Scratches, dents, missing items…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-fg">Photos</span>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong px-3.5 py-3 text-[13px] text-fg-muted transition-colors hover:border-accent hover:text-fg">
                  <Icon name="upload" size={16} />
                  {photos?.length ? `${photos.length} photo(s) selected` : 'Choose photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => setPhotos(e.target.files)}
                  />
                </label>
              </div>

              <ErrorNotice message={error} />

              <Button type="submit" isLoading={saving}>
                Submit {type === 'check_in' ? 'Check-In' : 'Check-Out'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
