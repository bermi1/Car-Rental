import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, EmptyState, Input, Select, Spinner, StatusBadge } from '@rental/shared';
import type { Vehicle, MaintenanceLog } from '@rental/shared';
import { api, assetUrl } from '../../api/client';

export function FleetDetail() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [form, setForm] = useState({ service_type: '', mileage_at_service: '', next_service_due_mileage: '', date: '', notes: '' });

  function load() {
    api.get<Vehicle>(`/vehicles/${id}`).then(setVehicle);
    api.get<MaintenanceLog[]>(`/vehicles/${id}/maintenance`).then(setLogs);
  }

  useEffect(load, [id]);

  async function handleStatusChange(status: string) {
    await api.put(`/vehicles/${id}`, { status });
    load();
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(e.target.files).forEach((file) => formData.append('photos', file));
    try {
      await api.post(`/vehicles/${id}/photos`, formData);
      load();
    } finally {
      setUploading(false);
    }
  }

  async function handleAddMaintenance(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/vehicles/${id}/maintenance`, {
      ...form,
      mileage_at_service: Number(form.mileage_at_service),
      next_service_due_mileage: form.next_service_due_mileage ? Number(form.next_service_due_mileage) : null,
    });
    setForm({ service_type: '', mileage_at_service: '', next_service_due_mileage: '', date: '', notes: '' });
    setShowMaintenanceForm(false);
    load();
  }

  if (!vehicle) return <Spinner />;

  return (
    <div className="space-y-6">
      <Link to="/fleet" className="text-sm text-neutral-500 hover:text-primary-600">
        ← Back to Fleet
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{vehicle.make} {vehicle.model}</h1>
          <p className="mt-1 text-sm text-neutral-500">{vehicle.plate_number} · {vehicle.category}</p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <Select
            value={vehicle.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-48"
          >
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="in_service">In Service</option>
            <option value="out_of_service">Out of Service</option>
          </Select>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-neutral-400">Mileage</p>
            <p className="font-medium text-neutral-800">{vehicle.current_mileage.toLocaleString()} km</p>
          </div>
          <div>
            <p className="text-neutral-400">Daily Rate</p>
            <p className="font-medium text-neutral-800">{Number(vehicle.daily_rate_tzs).toLocaleString()} TZS</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photo Gallery</CardTitle>
          <label className="cursor-pointer text-sm font-medium text-primary-600 hover:underline">
            {uploading ? 'Uploading...' : 'Upload Photos'}
            <input type="file" accept="image/*" multiple hidden onChange={handlePhotoUpload} disabled={uploading} />
          </label>
        </CardHeader>
        {vehicle.photos.length === 0 ? (
          <EmptyState title="No photos yet" description="Upload vehicle photos for the fleet gallery." />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {vehicle.photos.map((p, i) => (
              <img key={i} src={assetUrl(p)} alt="Vehicle" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Log</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowMaintenanceForm((s) => !s)}>
            {showMaintenanceForm ? 'Cancel' : 'Add Entry'}
          </Button>
        </CardHeader>

        {showMaintenanceForm && (
          <form onSubmit={handleAddMaintenance} className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-4 md:grid-cols-5">
            <Input label="Service Type" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} required />
            <Input label="Mileage at Service" type="number" value={form.mileage_at_service} onChange={(e) => setForm({ ...form, mileage_at_service: e.target.value })} required />
            <Input label="Next Due Mileage" type="number" value={form.next_service_due_mileage} onChange={(e) => setForm({ ...form, next_service_due_mileage: e.target.value })} />
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="col-span-full">
              <Button type="submit">Save Entry</Button>
            </div>
          </form>
        )}

        {!logs ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <EmptyState title="No maintenance recorded" />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {logs.map((log) => (
              <li key={log.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-neutral-800">{log.service_type}</p>
                  <p className="text-xs text-neutral-400">{new Date(log.date).toLocaleDateString()}</p>
                </div>
                <p className="text-xs text-neutral-500">
                  At {log.mileage_at_service.toLocaleString()} km
                  {log.next_service_due_mileage ? ` · Next due at ${log.next_service_due_mileage.toLocaleString()} km` : ''}
                </p>
                {log.notes && <p className="mt-1 text-xs text-neutral-400">{log.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
