import React, { useEffect, useState } from 'react';
import { Button, Card, CardHeader, CardTitle, EmptyState, Input, Spinner, StatCard } from '@rental/shared';
import { api, getToken, API_BASE } from '../../api/client';

interface ReportsSummary {
  revenue_by_vehicle: { vehicle_id: string; make: string; model: string; plate_number: string; revenue: number; bookings: number }[];
  revenue_by_period: { period: string; revenue: number; bookings: number }[];
  fleet_utilization_trend: { period: string; bookings: number }[];
  booking_volume_trend: { status: string; count: number }[];
  most_rented_vehicles: { make: string; model: string; plate_number: string; rentals: number }[];
  average_rental_duration_days: number;
}

export function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportsSummary | null>(null);

  function load() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<ReportsSummary>(`/reports/summary?${params.toString()}`).then(setData);
  }

  useEffect(load, [from, to]);

  async function downloadFile(kind: 'csv' | 'pdf', report?: string) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (report) params.set('report', report);
    const res = await fetch(`${API_BASE}/api/reports/export.${kind}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report ? `${report}.${kind}` : `report.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Reports</h1>
          <p className="mt-1 text-sm text-neutral-500">Revenue, utilization, and booking trends.</p>
        </div>
        <div className="flex items-end gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="secondary" onClick={() => downloadFile('pdf')}>
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Average Rental Duration" value={`${data.average_rental_duration_days.toFixed(1)} days`} />
        <StatCard
          label="Total Revenue (Range)"
          value={`${data.revenue_by_vehicle.reduce((s, v) => s + Number(v.revenue), 0).toLocaleString()} TZS`}
        />
        <StatCard label="Vehicles Rented" value={data.most_rented_vehicles.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by Vehicle</CardTitle>
          <button onClick={() => downloadFile('csv', 'revenue_by_vehicle')} className="text-sm font-medium text-primary-600 hover:underline">
            Export CSV
          </button>
        </CardHeader>
        {data.revenue_by_vehicle.length === 0 ? (
          <EmptyState title="No data for this range" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="py-2">Vehicle</th>
                <th className="py-2">Bookings</th>
                <th className="py-2">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.revenue_by_vehicle.map((v) => (
                <tr key={v.vehicle_id}>
                  <td className="py-2">{v.make} {v.model} ({v.plate_number})</td>
                  <td className="py-2">{v.bookings}</td>
                  <td className="py-2">{Number(v.revenue).toLocaleString()} TZS</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Period</CardTitle>
            <button onClick={() => downloadFile('csv', 'revenue_by_period')} className="text-sm font-medium text-primary-600 hover:underline">
              Export CSV
            </button>
          </CardHeader>
          {data.revenue_by_period.length === 0 ? (
            <EmptyState title="No data for this range" />
          ) : (
            <ul className="space-y-2">
              {data.revenue_by_period.map((p) => (
                <li key={p.period} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{new Date(p.period).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</span>
                  <span className="font-medium text-neutral-900">{Number(p.revenue).toLocaleString()} TZS</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Rented Vehicles</CardTitle>
            <button onClick={() => downloadFile('csv', 'most_rented_vehicles')} className="text-sm font-medium text-primary-600 hover:underline">
              Export CSV
            </button>
          </CardHeader>
          {data.most_rented_vehicles.length === 0 ? (
            <EmptyState title="No data for this range" />
          ) : (
            <ul className="space-y-2">
              {data.most_rented_vehicles.map((v, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{v.make} {v.model} ({v.plate_number})</span>
                  <span className="font-medium text-neutral-900">{v.rentals} rentals</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Volume by Status</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {data.booking_volume_trend.map((s) => (
            <div key={s.status} className="rounded-lg bg-neutral-50 p-3 text-center">
              <p className="text-xl font-semibold text-neutral-900">{s.count}</p>
              <p className="mt-1 text-xs capitalize text-neutral-500">{s.status.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
