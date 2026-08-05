import React, { useEffect, useState } from 'react';
import { Button, Card, EmptyState, Select, Spinner, StatusBadge } from '@rental/shared';
import { api } from '../../api/client';

interface DepositRow {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  reason: string | null;
  client_name: string;
  recorded_at: string;
}

export function DepositsList() {
  const [deposits, setDeposits] = useState<DepositRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    const qs = status ? `?status=${status}` : '';
    api.get<DepositRow[]>(`/deposits${qs}`).then(setDeposits);
  }
  useEffect(load, [status]);

  async function updateStatus(id: string, newStatus: string) {
    setBusyId(id);
    try {
      const reason = newStatus === 'forfeited' ? prompt('Reason for forfeiting deposit') || '' : undefined;
      await api.put(`/deposits/${id}`, { status: newStatus, reason });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Deposits</h1>
          <p className="mt-1 text-sm text-neutral-500">Security deposits held against active rentals.</p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="">All statuses</option>
          <option value="held">Held</option>
          <option value="released">Released</option>
          <option value="forfeited">Forfeited</option>
        </Select>
      </div>

      {!deposits ? (
        <Spinner />
      ) : deposits.length === 0 ? (
        <EmptyState title="No deposits found" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Recorded</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {deposits.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 font-medium text-neutral-900">{d.client_name}</td>
                  <td className="px-6 py-4 text-neutral-600">{Number(d.amount).toLocaleString()} TZS</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{new Date(d.recorded_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {d.status === 'held' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" isLoading={busyId === d.id} onClick={() => updateStatus(d.id, 'released')}>
                          Release
                        </Button>
                        <Button size="sm" variant="danger" isLoading={busyId === d.id} onClick={() => updateStatus(d.id, 'forfeited')}>
                          Forfeit
                        </Button>
                      </div>
                    )}
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
