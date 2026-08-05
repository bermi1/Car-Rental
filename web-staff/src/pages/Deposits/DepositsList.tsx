import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, EmptyState, Input, Select, Spinner, StatusBadge } from '@rental/shared';
import type { Booking } from '@rental/shared';
import { api } from '../../api/client';

interface DepositRow {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  reason: string | null;
  client_name: string;
  recorded_at: string;
}

export function DepositsList() {
  const [searchParams] = useSearchParams();
  const [deposits, setDeposits] = useState<DepositRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState(searchParams.get('booking') || '');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<DepositRow[]>('/deposits').then(setDeposits);
    Promise.all([api.get<Booking[]>('/bookings?status=confirmed'), api.get<Booking[]>('/bookings?status=active')]).then(
      ([c, a]) => setActiveBookings([...c, ...a])
    );
  }
  useEffect(load, []);

  async function updateStatus(id: string, newStatus: string) {
    setBusyId(id);
    try {
      const reason = newStatus === 'forfeited' ? prompt('Reason for forfeiting deposit') || '' : undefined;
      await api.put(`/deposits/${id}`, { status: newStatus, reason });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId || !amount) return;
    setSaving(true);
    try {
      await api.post('/deposits', { booking_id: bookingId, amount: Number(amount) });
      setAmount('');
      setBookingId('');
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Deposits</h1>
        <p className="mt-1 text-sm text-neutral-500">Record and manage security deposits.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record a Deposit</CardTitle>
        </CardHeader>
        <form onSubmit={handleRecord} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <Select label="Booking" value={bookingId} onChange={(e) => setBookingId(e.target.value)} required>
            <option value="">Select a booking</option>
            {activeBookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.client?.full_name} — {b.vehicle?.make} {b.vehicle?.model}
              </option>
            ))}
          </Select>
          <Input label="Amount (TZS)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Button type="submit" isLoading={saving}>
            Record Deposit
          </Button>
        </form>
      </Card>

      {!deposits ? (
        <Spinner />
      ) : deposits.length === 0 ? (
        <EmptyState title="No deposits recorded yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Recorded</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {deposits.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 font-medium text-neutral-900">{d.client_name}</td>
                  <td className="px-6 py-4 text-neutral-600">{Number(d.amount).toLocaleString()} TZS</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{new Date(d.recorded_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {d.status === 'held' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" isLoading={busyId === d.id} onClick={() => updateStatus(d.id, 'released')}>
                          Release
                        </Button>
                        <Button size="sm" variant="danger" isLoading={busyId === d.id} onClick={() => updateStatus(d.id, 'forfeited')}>
                          Forfeit
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
