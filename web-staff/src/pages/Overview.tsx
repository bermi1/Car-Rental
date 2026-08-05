import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, EmptyState, Spinner, StatusBadge } from '@rental/shared';
import { api } from '../api/client';

interface StaffOverview {
  todays_bookings: {
    id: string; make: string; model: string; plate_number: string; client_name: string;
    start_date: string; end_date: string; status: string;
  }[];
  pending_document_verification: { id: string; client_name: string; status: string; created_at: string }[];
}

export function Overview() {
  const [data, setData] = useState<StaffOverview | null>(null);

  useEffect(() => {
    api.get<StaffOverview>('/overview/staff').then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Overview</h1>
          <p className="mt-1 text-sm text-neutral-500">Today's pickups, returns, and pending work.</p>
        </div>
        <Link to="/bookings/new">
          <Button>Quick-Create Booking</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Bookings</CardTitle>
        </CardHeader>
        {data.todays_bookings.length === 0 ? (
          <EmptyState title="Nothing due today" description="No pickups or returns are scheduled for today." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.todays_bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{b.client_name} — {b.make} {b.model} ({b.plate_number})</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={b.status} />
                  <Link to={`/bookings/${b.id}`} className="text-sm font-medium text-primary-600 hover:underline">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Document Verification</CardTitle>
        </CardHeader>
        {data.pending_document_verification.length === 0 ? (
          <EmptyState title="All caught up" description="No bookings are waiting on document verification." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.pending_document_verification.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{b.client_name}</p>
                  <p className="text-xs text-neutral-400">Requested {new Date(b.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={b.status} />
                  <Link to="/documents" className="text-sm font-medium text-primary-600 hover:underline">
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
