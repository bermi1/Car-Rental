import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, Input, Spinner } from '@rental/shared';
import type { Client } from '@rental/shared';
import { api } from '../../api/client';

export function ClientsList() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const timeout = setTimeout(() => {
      api.get<Client[]>(`/clients${qs}`).then(setClients);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Clients</h1>
          <p className="mt-1 text-sm text-neutral-500">All registered renters.</p>
        </div>
        <Input placeholder="Search name, email, phone" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </div>

      {!clients ? (
        <Spinner />
      ) : clients.length === 0 ? (
        <EmptyState title="No clients found" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">ID Type</th>
                <th className="px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <Link to={`/clients/${c.id}`} className="font-medium text-neutral-900 hover:text-primary-600">
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{c.phone}</td>
                  <td className="px-6 py-4 text-neutral-600">{c.email}</td>
                  <td className="px-6 py-4 text-neutral-600">{c.id_type.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-neutral-600">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
