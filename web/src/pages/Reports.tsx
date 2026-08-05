import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  cn,
  formatCompactMoney,
  formatMoney,
  humanize,
} from '@rental/shared';
import { api, downloadFile } from '../api/client';
import { ErrorNotice } from '../components/ErrorNotice';

interface ReportsSummary {
  revenue_by_vehicle: {
    vehicle_id: string;
    make: string;
    model: string;
    plate_number: string;
    revenue: number;
    bookings: number;
  }[];
  revenue_by_period: { period: string; revenue: number; bookings: number }[];
  fleet_utilization_trend: { period: string; bookings: number }[];
  booking_volume_trend: { status: string; count: number }[];
  most_rented_vehicles: { make: string; model: string; plate_number: string; rentals: number }[];
  average_rental_duration_days: number;
}

/** Horizontal bar, scaled against the largest value in its set. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ExportButton({ report, from, to }: { report?: string; from: string; to: string }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (report) params.set('report', report);
      await downloadFile(`/reports/export.csv?${params}`, `${report ?? 'report'}.csv`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      className="text-[13px] font-medium text-accent transition-opacity hover:opacity-75 disabled:opacity-50"
    >
      {busy ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}

export function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setData(null);
    api
      .get<ReportsSummary>(`/reports/summary?${params}`)
      .then(setData)
      .catch(() => setError('Could not load the report.'));
  }, [from, to]);

  async function exportPdf() {
    setExportingPdf(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      await downloadFile(`/reports/export.pdf?${params}`, 'report.pdf');
    } finally {
      setExportingPdf(false);
    }
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Reports" description="Revenue, utilisation and booking trends." />
        <ErrorNotice message={error} />
        {!error && <Spinner />}
      </>
    );
  }

  const totalRevenue = data.revenue_by_vehicle.reduce((s, v) => s + Number(v.revenue), 0);
  const maxVehicleRevenue = Math.max(0, ...data.revenue_by_vehicle.map((v) => Number(v.revenue)));
  const maxPeriodRevenue = Math.max(0, ...data.revenue_by_period.map((p) => Number(p.revenue)));
  const maxRentals = Math.max(0, ...data.most_rented_vehicles.map((v) => v.rentals));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Revenue, utilisation and booking trends."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
            <Button variant="outline" icon="download" onClick={exportPdf} isLoading={exportingPdf}>
              PDF
            </Button>
          </div>
        }
      />

      <ErrorNotice message={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Revenue" value={formatCompactMoney(totalRevenue)} hint="In the selected range" icon="wallet" tone="success" />
        <StatCard
          label="Average Rental"
          value={`${data.average_rental_duration_days.toFixed(1)} days`}
          hint="Mean booking length"
          icon="clock"
        />
        <StatCard
          label="Vehicles Rented"
          value={data.most_rented_vehicles.length}
          hint="Distinct vehicles with bookings"
          icon="car"
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Revenue by Vehicle</CardTitle>
          <ExportButton report="revenue_by_vehicle" from={from} to={to} />
        </CardHeader>
        {data.revenue_by_vehicle.length === 0 ? (
          <EmptyState icon="chart" title="No data for this range" />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="px-0">Vehicle</TH>
                <TH numeric className="px-0">Bookings</TH>
                <TH numeric className="px-0">Revenue</TH>
                <TH className="w-1/4 px-0 pl-5">Share</TH>
              </TR>
            </THead>
            <TBody>
              {data.revenue_by_vehicle.map((v) => (
                <TR key={v.vehicle_id} className="hover:bg-transparent">
                  <TD className="px-0 font-medium text-fg">
                    {v.make} {v.model}
                    <span className="ml-1.5 font-normal text-fg-subtle">{v.plate_number}</span>
                  </TD>
                  <TD numeric className="px-0">
                    {v.bookings}
                  </TD>
                  <TD numeric className="px-0 font-medium text-fg">
                    {formatMoney(v.revenue)}
                  </TD>
                  <TD className="px-0 pl-5">
                    <Bar value={Number(v.revenue)} max={maxVehicleRevenue} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Month</CardTitle>
            <ExportButton report="revenue_by_period" from={from} to={to} />
          </CardHeader>
          {data.revenue_by_period.length === 0 ? (
            <EmptyState icon="chart" title="No data for this range" />
          ) : (
            <ul className="space-y-3">
              {data.revenue_by_period.map((p) => (
                <li key={p.period}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-fg-muted">
                      {new Date(p.period).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                    <span className="text-[13px] font-medium tabular-nums text-fg">{formatMoney(p.revenue)}</span>
                  </div>
                  <Bar value={Number(p.revenue)} max={maxPeriodRevenue} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Rented Vehicles</CardTitle>
            <ExportButton report="most_rented_vehicles" from={from} to={to} />
          </CardHeader>
          {data.most_rented_vehicles.length === 0 ? (
            <EmptyState icon="car" title="No data for this range" />
          ) : (
            <ul className="space-y-3">
              {data.most_rented_vehicles.map((v, i) => (
                <li key={`${v.plate_number}-${i}`}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] text-fg-muted">
                      {v.make} {v.model}
                      <span className="ml-1.5 text-fg-subtle">{v.plate_number}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums text-fg">
                      {v.rentals} rental{v.rentals === 1 ? '' : 's'}
                    </span>
                  </div>
                  <Bar value={v.rentals} max={maxRentals} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Booking Volume by Status</CardTitle>
        </CardHeader>
        {data.booking_volume_trend.length === 0 ? (
          <EmptyState icon="calendar" title="No data for this range" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {data.booking_volume_trend.map((s) => (
              <div
                key={s.status}
                className={cn('rounded-lg border border-line bg-surface-sunken/50 px-3 py-3')}
              >
                <p className="text-xl font-semibold tabular-nums text-fg">{s.count}</p>
                <p className="mt-1 text-[11px] leading-tight text-fg-subtle">{humanize(s.status)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
