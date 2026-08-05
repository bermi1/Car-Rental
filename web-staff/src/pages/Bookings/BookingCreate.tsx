import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, Input, Select } from '@rental/shared';
import type { Client, Vehicle } from '@rental/shared';
import { api, ApiError } from '../../api/client';

export function BookingCreate() {
  const navigate = useNavigate();
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [rentalType, setRentalType] = useState<'self_drive' | 'driver_included'>('self_drive');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupRegion, setPickupRegion] = useState('');
  const [dropoffRegion, setDropoffRegion] = useState('');
  const [currency, setCurrency] = useState<'TZS' | 'USD'>('TZS');
  const [override, setOverride] = useState('');
  const [quote, setQuote] = useState<{ days: number; amount: number } | null>(null);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.get<Client[]>(`/clients?search=${encodeURIComponent(clientSearch)}`).then(setClientResults);
    }, 250);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const qs = new URLSearchParams({ status: 'available' });
    if (startDate) qs.set('start_date', startDate);
    if (endDate) qs.set('end_date', endDate);
    api.get<Vehicle[]>(`/vehicles?${qs.toString()}`).then(setVehicles);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!vehicleId || !startDate || !endDate) {
      setQuote(null);
      return;
    }
    api
      .post<{ days: number; amount: number }>('/bookings/quote', {
        vehicle_id: vehicleId,
        start_date: startDate,
        end_date: endDate,
        currency,
      })
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [vehicleId, startDate, endDate, currency]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedClient) return setError('Select a client first');
    if (!vehicleId) return setError('Select a vehicle');
    setSaving(true);
    try {
      const booking = await api.post<{ id: string }>('/bookings', {
        client_id: selectedClient.id,
        vehicle_id: vehicleId,
        rental_type: rentalType,
        start_date: startDate,
        end_date: endDate,
        pickup_region: pickupRegion,
        dropoff_region: dropoffRegion,
        quoted_currency: currency,
        quoted_amount: override ? Number(override) : quote?.amount ?? 0,
      });
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create booking');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">New Booking</h1>
        <p className="mt-1 text-sm text-neutral-500">Create a booking on behalf of a client.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        {selectedClient ? (
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm">
            <div>
              <p className="font-medium text-neutral-800">{selectedClient.full_name}</p>
              <p className="text-xs text-neutral-400">{selectedClient.email} · {selectedClient.phone}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <Input
              placeholder="Search by name, email, or phone"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            {clientResults.length > 0 && (
              <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-100">
                {clientResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setClientResults([]);
                        setClientSearch('');
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    >
                      <span className="font-medium text-neutral-800">{c.full_name}</span>{' '}
                      <span className="text-neutral-400">{c.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Rental Details</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <Select label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
            <option value="">Select an available vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} ({v.plate_number}) — {Number(v.daily_rate_tzs).toLocaleString()} TZS/day
              </option>
            ))}
          </Select>
          <Select label="Rental Type" value={rentalType} onChange={(e) => setRentalType(e.target.value as any)}>
            <option value="self_drive">Self-Drive</option>
            <option value="driver_included">With Driver</option>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Pickup Region" value={pickupRegion} onChange={(e) => setPickupRegion(e.target.value)} required />
            <Input label="Drop-off Region" value={dropoffRegion} onChange={(e) => setDropoffRegion(e.target.value)} required />
          </div>
          {pickupRegion && dropoffRegion && pickupRegion.trim().toLowerCase() !== dropoffRegion.trim().toLowerCase() && (
            <p className="rounded-lg bg-status-pendingBg px-3 py-2 text-sm text-status-pendingFg">
              This is a cross-region rental.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
              <option value="TZS">TZS</option>
              <option value="USD">USD</option>
            </Select>
            <Input
              label={`Override Amount (${currency})`}
              type="number"
              placeholder={quote ? String(quote.amount) : 'auto-calculated'}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
          </div>
          {quote && (
            <p className="text-sm text-neutral-500">
              Suggested quote: <span className="font-medium text-neutral-800">{quote.amount.toLocaleString()} {currency}</span> for {quote.days} day(s)
            </p>
          )}

          {error && <p className="text-sm text-status-cancelledFg">{error}</p>}
          <Button type="submit" isLoading={saving}>
            Create Booking
          </Button>
        </Card>
      </form>
    </div>
  );
}
