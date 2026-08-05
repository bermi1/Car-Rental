import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  Icon,
  Input,
  PageHeader,
  SearchInput,
  Select,
  formatMoney,
  rentalDays,
} from '@rental/shared';
import type { Client, Vehicle } from '@rental/shared';
import { api, ApiError } from '../../api/client';
import { BackLink } from '../../components/BackLink';
import { ErrorNotice } from '../../components/ErrorNotice';

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

  // Debounced client lookup.
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

  // Availability depends on the chosen window, so refetch when it changes.
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

  const crossRegion =
    Boolean(pickupRegion && dropoffRegion) &&
    pickupRegion.trim().toLowerCase() !== dropoffRegion.trim().toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedClient) return setError('Select a client first.');
    if (!vehicleId) return setError('Select a vehicle.');

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
      setError(err instanceof ApiError ? err.message : 'Failed to create booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink to="/bookings">Bookings</BackLink>}
        title="New Booking"
        description="Raise a booking on behalf of a client."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          {selectedClient ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-sunken/60 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{selectedClient.full_name}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {selectedClient.email} · {selectedClient.phone}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div>
              <SearchInput
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search by name, email or phone"
              />
              {clientResults.length > 0 && (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {clientResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientResults([]);
                          setClientSearch('');
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-sunken"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-fg">{c.full_name}</span>
                          <span className="block truncate text-xs text-fg-subtle">{c.email}</span>
                        </span>
                        <Icon name="chevronRight" size={15} className="shrink-0 text-fg-subtle" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Rental Details</CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  required
                  hint={startDate && endDate ? `${rentalDays(startDate, endDate)} day(s)` : undefined}
                />
              </div>

              <Select label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
                <option value="">
                  {vehicles.length ? 'Select an available vehicle' : 'No vehicles available for these dates'}
                </option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} ({v.plate_number}) — {formatMoney(v.daily_rate_tzs)}/day
                  </option>
                ))}
              </Select>

              <Select
                label="Rental Type"
                value={rentalType}
                onChange={(e) => setRentalType(e.target.value as any)}
              >
                <option value="self_drive">Self-Drive</option>
                <option value="driver_included">With Driver</option>
              </Select>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Pickup Region"
                  placeholder="e.g. Dar es Salaam"
                  value={pickupRegion}
                  onChange={(e) => setPickupRegion(e.target.value)}
                  required
                />
                <Input
                  label="Drop-off Region"
                  placeholder="e.g. Arusha"
                  value={dropoffRegion}
                  onChange={(e) => setDropoffRegion(e.target.value)}
                  required
                />
              </div>

              {crossRegion && (
                <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-fg">
                  <Icon name="alert" size={15} className="shrink-0" />
                  This is a cross-region rental.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                </Select>
                <Input
                  label={`Override Amount (${currency})`}
                  type="number"
                  min="0"
                  placeholder={quote ? String(quote.amount) : 'Auto-calculated'}
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                  hint="Leave blank to use the quote"
                />
              </div>

              {quote && (
                <div className="flex items-center justify-between rounded-lg border border-line bg-surface-sunken/60 px-3.5 py-3">
                  <span className="text-[13px] text-fg-muted">
                    Suggested quote · {quote.days} day{quote.days === 1 ? '' : 's'}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-fg">
                    {formatMoney(quote.amount, currency)}
                  </span>
                </div>
              )}

              <ErrorNotice message={error} />

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" isLoading={saving}>
                  Create Booking
                </Button>
                <Button type="button" variant="ghost" onClick={() => navigate('/bookings')}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
