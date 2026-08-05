import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, StatCard, Spinner, EmptyState } from '@rental/shared';
import { api } from '../api/client';

interface AdminOverview {
  fleet_utilization_rate: number;
  fleet_by_status: { status: string; count: number }[];
  revenue: { total: number; completed_bookings: number };
  bookings_pipeline: { status: string; count: number }[];
  missing_documents: { id: string; start_date: string; client_name: string }[];
  maintenance_due: { id: string; make: string; model: string; plate_number: string; current_mileage: number; next_service_due_mileage: number }[];
  recent_activity: { id: string; description: string; created_at: string; actor_name: string | null }[];
}

const STATUS_LABELS: Record<string, string> = {
  pending_documents: 'Pending Documents',
  documents_submitted: 'Documents Submitted',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    api.get<AdminOverview>('/overview/admin').then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Overview</h1>
        <p className="mt-1 text-sm text-neutral-500">Snapshot of your fleet, bookings, and revenue.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fleet Utilization" value={`${data.fleet_utilization_rate}%`} hint="Booked vs. idle vehicles" />
        <StatCard
          label="Revenue (Completed)"
          value={`${Number(data.revenue.total).toLocaleString()} TZS`}
          hint={`${data.revenue.completed_bookings} completed bookings`}
        />
        <StatCard
          label="Missing Documents"
          value={data.missing_documents.length}
          hint="Bookings stuck pending documents"
        />
        <StatCard label="Maintenance Due" value={data.maintenance_due.length} hint="Vehicles nearing service mileage" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookings Pipeline</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.keys(STATUS_LABELS).map((status) => {
            const found = data.bookings_pipeline.find((p) => p.status === status);
            return (
              <div key={status} className="rounded-lg bg-neutral-50 p-3 text-center">
                <p className="text-xl font-semibold text-neutral-900">{found?.count || 0}</p>
                <p className="mt-1 text-xs text-neutral-500">{STATUS_LABELS[status]}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Missing Documents Alerts</CardTitle>
          </CardHeader>
          {data.missing_documents.length === 0 ? (
            <EmptyState title="All caught up" description="No bookings are stuck waiting on documents." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.missing_documents.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-800">{b.client_name}</p>
                    <p className="text-xs text-neutral-400">Starts {new Date(b.start_date).toLocaleDateString()}</p>
                  </div>
                  <Link to={`/bookings/${b.id}`} className="text-sm font-medium text-primary-600 hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Maintenance</CardTitle>
          </CardHeader>
          {data.maintenance_due.length === 0 ? (
            <EmptyState title="No maintenance due" description="No vehicles are close to their service mileage." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.maintenance_due.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-800">{v.make} {v.model} ({v.plate_number})</p>
                    <p className="text-xs text-neutral-400">
                      {v.current_mileage.toLocaleString()} km / due at {v.next_service_due_mileage.toLocaleString()} km
                    </p>
                  </div>
                  <Link to={`/fleet/${v.id}`} className="text-sm font-medium text-primary-600 hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        {data.recent_activity.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.recent_activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-neutral-800">{a.description}</p>
                  <p className="text-xs text-neutral-400">{a.actor_name || 'System'}</p>
                </div>
                <span className="text-xs text-neutral-400">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
