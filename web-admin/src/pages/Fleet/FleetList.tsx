import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, Input, Spinner, StatusBadge } from '@rental/shared';
import type { Vehicle } from '@rental/shared';
import { api } from '../../api/client';

export function FleetList() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ make: '', model: '', plate_number: '', category: '', daily_rate_tzs: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<Vehicle[]>('/vehicles').then(setVehicles);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/vehicles', { ...form, daily_rate_tzs: Number(form.daily_rate_tzs) });
      setForm({ make: '', model: '', plate_number: '', category: '', daily_rate_tzs: '' });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Fleet</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage vehicles, availability, and maintenance.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add Vehicle'}</Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Input label="Make" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required />
            <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            <Input
              label="Plate Number"
              value={form.plate_number}
              onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
              required
            />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
            <Input
              label="Daily Rate (TZS)"
              type="number"
              value={form.daily_rate_tzs}
              onChange={(e) => setForm({ ...form, daily_rate_tzs: e.target.value })}
              required
            />
            <div className="col-span-full">
              <Button type="submit" isLoading={saving}>
                Save Vehicle
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!vehicles ? (
        <Spinner />
      ) : vehicles.length === 0 ? (
        <EmptyState title="No vehicles yet" description="Add your first vehicle to get started." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Plate</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Mileage</th>
                <th className="px-6 py-3">Daily Rate</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <Link to={`/fleet/${v.id}`} className="font-medium text-neutral-900 hover:text-primary-600">
                      {v.make} {v.model}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{v.plate_number}</td>
                  <td className="px-6 py-4 text-neutral-600">{v.category}</td>
                  <td className="px-6 py-4 text-neutral-600">{v.current_mileage.toLocaleString()} km</td>
                  <td className="px-6 py-4 text-neutral-600">{Number(v.daily_rate_tzs).toLocaleString()} TZS</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={v.status} />
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
