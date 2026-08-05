import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, Select, Spinner, StatusBadge } from '@rental/shared';
import type { Booking } from '@rental/shared';
import { api } from '../../api/client';

export function BookingsList() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const qs = status ? `?status=${status}` : '';
    api.get<Booking[]>(`/bookings${qs}`).then(setBookings);
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Bookings</h1>
          <p className="mt-1 text-sm text-neutral-500">All rental bookings across the fleet.</p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56">
          <option value="">All statuses</option>
          <option value="pending_documents">Pending Documents</option>
          <option value="documents_submitted">Documents Submitted</option>
          <option value="confirmed">Confirmed</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {!bookings ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings found" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Dates</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <Link to={`/bookings/${b.id}`} className="font-medium text-neutral-900 hover:text-primary-600">
                      {b.client?.full_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{b.vehicle?.make} {b.vehicle?.model}</td>
                  <td className="px-6 py-4 text-neutral-600">
                    {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {b.pickup_region} → {b.dropoff_region}
                    {b.is_cross_region && <span className="ml-1.5 text-xs font-medium text-status-pendingFg">Cross-region</span>}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {Number(b.quoted_amount).toLocaleString()} {b.quoted_currency}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={b.status} />
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
