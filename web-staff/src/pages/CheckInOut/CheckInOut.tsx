import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, EmptyState, Input, Select, Spinner } from '@rental/shared';
import type { Booking } from '@rental/shared';
import { api } from '../../api/client';

export function CheckInOut() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('booking') || '');
  const [type, setType] = useState<'check_in' | 'check_out'>((searchParams.get('type') as any) || 'check_in');
  const [fuelLevel, setFuelLevel] = useState('full');
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Booking[]>('/bookings?status=confirmed'), api.get<Booking[]>('/bookings?status=active')]).then(
      ([confirmed, active]) => setBookings([...confirmed, ...active])
    );
  }, []);

  const selected = bookings?.find((b) => b.id === selectedId);

  function selectBooking(b: Booking) {
    setSelectedId(b.id);
    setType(b.status === 'confirmed' ? 'check_in' : 'check_out');
    setSearchParams({ booking: b.id, type: b.status === 'confirmed' ? 'check_in' : 'check_out' });
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setSuccess(false);
    try {
      const form = new FormData();
      form.append('booking_id', selectedId);
      form.append('type', type);
      form.append('fuel_level', fuelLevel);
      form.append('mileage', mileage);
      form.append('notes', notes);
      if (photos) Array.from(photos).forEach((f) => form.append('photos', f));

      await api.post('/condition-reports', form);

      if (type === 'check_in') {
        await api.post(`/bookings/${selectedId}/activate`);
      } else {
        await api.post(`/bookings/${selectedId}/complete`);
      }

      setSuccess(true);
      setMileage('');
      setNotes('');
      setPhotos(null);
      setSelectedId('');
      const [confirmed, active] = await Promise.all([
        api.get<Booking[]>('/bookings?status=confirmed'),
        api.get<Booking[]>('/bookings?status=active'),
      ]);
      setBookings([...confirmed, ...active]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Check-In / Check-Out</h1>
        <p className="mt-1 text-sm text-neutral-500">Record vehicle condition at pickup and return.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select a Booking</CardTitle>
          </CardHeader>
          {!bookings ? (
            <Spinner />
          ) : bookings.length === 0 ? (
            <EmptyState title="Nothing to check in or out" description="No confirmed or active bookings right now." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {bookings.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => selectBooking(b)}
                    className={`block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-neutral-50 ${
                      selectedId === b.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <p className="font-medium text-neutral-800">
                      {b.client?.full_name} — {b.vehicle?.make} {b.vehicle?.model}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {b.status === 'confirmed' ? 'Needs check-in' : 'Needs check-out'} ·{' '}
                      {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{type === 'check_in' ? 'Check-In Report' : 'Check-Out Report'}</CardTitle>
          </CardHeader>
          {!selected ? (
            <EmptyState title="No booking selected" description="Pick a booking from the list to record a condition report." />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select label="Fuel Level" value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)}>
                <option value="full">Full</option>
                <option value="three_quarters">Three Quarters</option>
                <option value="half">Half</option>
                <option value="quarter">Quarter</option>
                <option value="empty">Empty</option>
              </Select>
              <Input label="Mileage (km)" type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} required />
              <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">Photos</span>
                <input type="file" accept="image/*" multiple onChange={(e) => setPhotos(e.target.files)} className="text-sm" />
              </label>
              {success && <p className="text-sm text-status-activeFg">Report saved and booking updated.</p>}
              <Button type="submit" isLoading={saving}>
                Submit {type === 'check_in' ? 'Check-In' : 'Check-Out'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
