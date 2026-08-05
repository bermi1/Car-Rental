import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  bookingStatusLabels,
  formatCompactMoney,
  formatDate,
  formatDateRange,
  formatRelative,
} from '@rental/shared';
import type { BookingStatus } from '@rental/shared';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

/* ---------------------------------- types --------------------------------- */

interface AdminOverview {
  fleet_utilization_rate: number;
  fleet_by_status: { status: string; count: number }[];
  revenue: { total: number; completed_bookings: number };
  bookings_pipeline: { status: string; count: number }[];
  missing_documents: { id: string; start_date: string; client_name: string }[];
  maintenance_due: {
    id: string;
    make: string;
    model: string;
    plate_number: string;
    current_mileage: number;
    next_service_due_mileage: number;
  }[];
  recent_activity: { id: string; description: string; created_at: string; actor_name: string | null }[];
}

interface StaffOverview {
  todays_bookings: {
    id: string;
    make: string;
    model: string;
    plate_number: string;
    client_name: string;
    start_date: string;
    end_date: string;
    status: string;
  }[];
  pending_document_verification: { id: string; client_name: string; status: string; created_at: string }[];
}

/* ------------------------------- shared bits ------------------------------ */

function RowLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-opacity hover:opacity-75"
    >
      {children}
      <Icon name="chevronRight" size={14} />
    </Link>
  );
}

function ListRow({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-fg">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-fg-subtle">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{right}</div>
    </li>
  );
}

/* --------------------------------- admin --------------------------------- */

const PIPELINE_ORDER: BookingStatus[] = [
  'pending_documents',
  'documents_submitted',
  'confirmed',
  'active',
  'completed',
  'cancelled',
];

function AdminOverviewView() {
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    api.get<AdminOverview>('/overview/admin').then(setData);
  }, []);

  if (!data) return <Spinner />;

  const pipelineTotal = data.bookings_pipeline.reduce((sum, p) => sum + Number(p.count), 0);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Fleet utilisation, revenue and everything waiting on a decision."
        actions={
          <Link to="/bookings/new">
            <Button icon="plus">New Booking</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Fleet Utilisation"
          value={`${data.fleet_utilization_rate}%`}
          hint="Vehicles currently booked"
          icon="car"
        />
        <StatCard
          label="Revenue"
          value={formatCompactMoney(data.revenue.total)}
          hint={`${data.revenue.completed_bookings} completed bookings`}
          icon="wallet"
          tone="success"
        />
        <StatCard
          label="Missing Documents"
          value={data.missing_documents.length}
          hint="Bookings blocked on paperwork"
          icon="shield"
          tone={data.missing_documents.length ? 'warning' : 'accent'}
        />
        <StatCard
          label="Maintenance Due"
          value={data.maintenance_due.length}
          hint="Vehicles near service mileage"
          icon="wrench"
          tone={data.maintenance_due.length ? 'danger' : 'accent'}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Bookings Pipeline</CardTitle>
            <p className="mt-0.5 text-[13px] text-fg-muted">{pipelineTotal} bookings in total</p>
          </div>
          <RowLink to="/bookings">View all</RowLink>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_ORDER.map((status) => {
            const count = data.bookings_pipeline.find((p) => p.status === status)?.count ?? 0;
            return (
              <div key={status} className="rounded-lg border border-line bg-surface-sunken/50 px-3 py-3">
                <p className="text-xl font-semibold tabular-nums text-fg">{count}</p>
                <p className="mt-1 text-[11px] leading-tight text-fg-subtle">{bookingStatusLabels[status]}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* items-start so a short card doesn't stretch to match a tall neighbour. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card flush>
          <div className="flex items-center justify-between px-5 py-4">
            <CardTitle>Blocked on Documents</CardTitle>
            <RowLink to="/documents">Review</RowLink>
          </div>
          {data.missing_documents.length === 0 ? (
            <EmptyState icon="check" title="All caught up" description="No bookings are waiting on documents." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {data.missing_documents.map((b) => (
                <ListRow
                  key={b.id}
                  title={b.client_name}
                  subtitle={`Starts ${formatDate(b.start_date)}`}
                  right={<RowLink to={`/bookings/${b.id}`}>Open</RowLink>}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <div className="flex items-center justify-between px-5 py-4">
            <CardTitle>Maintenance Due</CardTitle>
            <RowLink to="/fleet">Fleet</RowLink>
          </div>
          {data.maintenance_due.length === 0 ? (
            <EmptyState icon="check" title="Nothing due" description="No vehicles are near their service mileage." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {data.maintenance_due.map((v) => (
                <ListRow
                  key={v.id}
                  title={`${v.make} ${v.model}`}
                  subtitle={`${v.plate_number} · ${v.current_mileage.toLocaleString()} / ${v.next_service_due_mileage.toLocaleString()} km`}
                  right={<RowLink to={`/fleet/${v.id}`}>Open</RowLink>}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card flush className="mt-6">
        <div className="px-5 py-4">
          <CardTitle>Recent Activity</CardTitle>
        </div>
        {data.recent_activity.length === 0 ? (
          <EmptyState icon="activity" title="No activity yet" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.recent_activity.map((a) => (
              <ListRow
                key={a.id}
                title={a.description}
                subtitle={a.actor_name || 'System'}
                right={<span className="text-xs text-fg-subtle">{formatRelative(a.created_at)}</span>}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/* --------------------------------- staff --------------------------------- */

function StaffOverviewView() {
  const [data, setData] = useState<StaffOverview | null>(null);

  useEffect(() => {
    api.get<StaffOverview>('/overview/staff').then(setData);
  }, []);

  if (!data) return <Spinner />;

  const needsCheckIn = data.todays_bookings.filter((b) => b.status === 'confirmed').length;
  const needsCheckOut = data.todays_bookings.filter((b) => b.status === 'active').length;

  return (
    <>
      <PageHeader
        title="Today"
        description="Pickups, returns and paperwork that needs you."
        actions={
          <Link to="/bookings/new">
            <Button icon="plus">New Booking</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Due Today" value={data.todays_bookings.length} hint="Pickups and returns" icon="calendar" />
        <StatCard
          label="Awaiting Check-In"
          value={needsCheckIn}
          hint="Confirmed, not yet collected"
          icon="clipboard"
          tone={needsCheckIn ? 'warning' : 'accent'}
        />
        <StatCard
          label="Documents to Verify"
          value={data.pending_document_verification.length}
          hint="Submitted by clients"
          icon="shield"
          tone={data.pending_document_verification.length ? 'warning' : 'accent'}
        />
      </div>

      <Card flush className="mt-6">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <CardTitle>Today's Bookings</CardTitle>
            {needsCheckOut > 0 && (
              <p className="mt-0.5 text-[13px] text-fg-muted">{needsCheckOut} awaiting check-out</p>
            )}
          </div>
          <RowLink to="/check-in-out">Check-in / out</RowLink>
        </div>
        {data.todays_bookings.length === 0 ? (
          <EmptyState icon="calendar" title="Nothing due today" description="No pickups or returns are scheduled." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.todays_bookings.map((b) => (
              <ListRow
                key={b.id}
                title={`${b.client_name} — ${b.make} ${b.model}`}
                subtitle={`${b.plate_number} · ${formatDateRange(b.start_date, b.end_date)}`}
                right={
                  <>
                    <StatusBadge status={b.status} />
                    <RowLink to={`/bookings/${b.id}`}>Open</RowLink>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </Card>

      <Card flush className="mt-6">
        <div className="flex items-center justify-between px-5 py-4">
          <CardTitle>Pending Document Verification</CardTitle>
          <RowLink to="/documents">Review queue</RowLink>
        </div>
        {data.pending_document_verification.length === 0 ? (
          <EmptyState icon="check" title="All caught up" description="Nothing is waiting on verification." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.pending_document_verification.map((b) => (
              <ListRow
                key={b.id}
                title={b.client_name}
                subtitle={`Requested ${formatDate(b.created_at)}`}
                right={
                  <>
                    <StatusBadge status={b.status} />
                    <RowLink to="/documents">Review</RowLink>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function Overview() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminOverviewView /> : <StaffOverviewView />;
}
