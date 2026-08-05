import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, EmptyState, Spinner, StatusBadge } from '@rental/shared';
import type { Client, Booking, ClientDevice } from '@rental/shared';
import { api, assetUrl } from '../../api/client';

interface ClientProfile extends Client {
  bookings: (Booking & { make: string; model: string; plate_number: string })[];
}

export function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [devices, setDevices] = useState<ClientDevice[] | null>(null);

  useEffect(() => {
    api.get<ClientProfile>(`/clients/${id}`).then(setClient);
    api.get<ClientDevice[]>(`/devices/client/${id}`).then(setDevices);
  }, [id]);

  if (!client) return <Spinner />;

  return (
    <div className="space-y-6">
      <Link to="/clients" className="text-sm text-neutral-500 hover:text-primary-600">
        ← Back to Clients
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{client.full_name}</h1>
        <p className="mt-1 text-sm text-neutral-500">{client.email} · {client.phone}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-neutral-400">ID Type</p>
            <p className="font-medium text-neutral-800">{client.id_type.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-neutral-400">ID Number</p>
            <p className="font-medium text-neutral-800">{client.id_number || '—'}</p>
          </div>
          <div>
            <p className="text-neutral-400">ID Document</p>
            {client.id_document_file ? (
              <a href={assetUrl(client.id_document_file)} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">
                View
              </a>
            ) : (
              <p className="text-neutral-400">Not uploaded</p>
            )}
          </div>
          <div>
            <p className="text-neutral-400">Driving License</p>
            {client.driving_license_file ? (
              <a href={assetUrl(client.driving_license_file)} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">
                View
              </a>
            ) : (
              <p className="text-neutral-400">Not uploaded</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rental History</CardTitle>
        </CardHeader>
        {client.bookings.length === 0 ? (
          <EmptyState title="No bookings yet" />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {client.bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <Link to={`/bookings/${b.id}`} className="font-medium text-neutral-800 hover:text-primary-600">
                    {b.make} {b.model} ({b.plate_number})
                  </Link>
                  <p className="text-xs text-neutral-400">
                    {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked Devices</CardTitle>
        </CardHeader>
        {!devices || devices.length === 0 ? (
          <EmptyState title="No devices linked" description="This client hasn't logged in from the mobile app yet." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{d.device_name}</p>
                  <p className="text-xs text-neutral-400">
                    {d.platform} · Last active {new Date(d.last_active_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={d.is_active ? 'confirmed' : 'cancelled'} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
