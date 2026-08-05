import React, { useEffect, useState } from 'react';
import { Button, Card, EmptyState, Input, Select, Spinner, StatusBadge } from '@rental/shared';
import type { StaffUser } from '@rental/shared';
import { api } from '../../api/client';

export function StaffList() {
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<StaffUser[]>('/staff').then(setStaff);
  }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff', form);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: StaffUser) {
    await api.put(`/staff/${s.id}`, { is_active: !s.is_active });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Staff Accounts</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage internal staff and their roles.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add Staff'}</Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
            <div className="col-span-full">
              <Button type="submit" isLoading={saving}>
                Save Staff Account
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!staff ? (
        <Spinner />
      ) : staff.length === 0 ? (
        <EmptyState title="No staff accounts yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 font-medium text-neutral-900">{s.name}</td>
                  <td className="px-6 py-4 text-neutral-600">{s.email}</td>
                  <td className="px-6 py-4 text-neutral-600 capitalize">{s.role}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={s.is_active ? 'confirmed' : 'cancelled'} />
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleActive(s)} className="text-sm font-medium text-primary-600 hover:underline">
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
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
