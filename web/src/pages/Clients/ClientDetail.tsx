import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Icon,
  PageHeader,
  Spinner,
  StatusBadge,
  formatDate,
  formatDateRange,
  formatDateTime,
  humanize,
  initials,
} from '@rental/shared';
import type { Booking, Client, ClientDevice } from '@rental/shared';
import { api, assetUrl } from '../../api/client';
import { BackLink } from '../../components/BackLink';

interface ClientProfile extends Client {
  bookings: (Booking & { make: string; model: string; plate_number: string })[];
}

function DocumentLink({ label, path }: { label: string; path: string | null }) {
  if (!path) {
    return (
      <Field label={label}>
        <span className="text-fg-subtle">Not uploaded</span>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <a
        href={assetUrl(path)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-accent hover:opacity-75"
      >
        View
        <Icon name="external" size={12} />
      </a>
    </Field>
  );
}

export function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [devices, setDevices] = useState<ClientDevice[] | null>(null);

  useEffect(() => {
    api.get<ClientProfile>(`/clients/${id}`).then(setClient);
    api
      .get<ClientDevice[]>(`/devices/client/${id}`)
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [id]);

  if (!client) return <Spinner />;

  return (
    <>
      <PageHeader
        back={<BackLink to="/clients">Clients</BackLink>}
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-fg-muted">
              {initials(client.full_name)}
            </span>
            {client.full_name}
          </span>
        }
        description={`${client.email} · ${client.phone}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Field label="ID Type">{humanize(client.id_type)}</Field>
          <Field label="ID Number">{client.id_number || '—'}</Field>
          <DocumentLink label="ID Document" path={client.id_document_file} />
          <DocumentLink label="Driving License" path={client.driving_license_file} />
        </dl>
      </Card>

      <Card flush className="mt-6">
        <div className="px-5 py-4">
          <CardTitle>Rental History</CardTitle>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {client.bookings.length} booking{client.bookings.length === 1 ? '' : 's'} on record
          </p>
        </div>
        {client.bookings.length === 0 ? (
          <EmptyState icon="calendar" title="No bookings yet" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {client.bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <Link
                    to={`/bookings/${b.id}`}
                    className="truncate text-[13px] font-medium text-fg transition-colors hover:text-accent"
                  >
                    {b.make} {b.model}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">
                    {b.plate_number} · {formatDateRange(b.start_date, b.end_date)}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card flush className="mt-6">
        <div className="px-5 py-4">
          <CardTitle>Linked Devices</CardTitle>
          <p className="mt-0.5 text-[13px] text-fg-muted">Phones signed in to the client app.</p>
        </div>
        {!devices ? (
          <Spinner />
        ) : devices.length === 0 ? (
          <EmptyState
            icon="users"
            title="No devices linked"
            description="This client hasn't signed in from the mobile app yet."
          />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-fg">{d.device_name}</p>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">
                    {humanize(d.platform)} · last active {formatDateTime(d.last_active_at)}
                  </p>
                </div>
                <StatusBadge
                  status={d.is_active ? 'verified' : 'inactive'}
                  label={d.is_active ? 'Active' : 'Inactive'}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-fg-subtle">Client since {formatDate(client.created_at)}</p>
    </>
  );
}
