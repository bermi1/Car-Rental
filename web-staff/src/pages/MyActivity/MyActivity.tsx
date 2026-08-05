import React, { useEffect, useState } from 'react';
import { Card, EmptyState, Spinner } from '@rental/shared';
import { api } from '../../api/client';

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

export function MyActivity() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    api.get<ActivityEntry[]>('/staff/me/activity').then(setEntries);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Activity</h1>
        <p className="mt-1 text-sm text-neutral-500">Bookings and reports you've handled.</p>
      </div>

      {!entries ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions you take will show up here." />
      ) : (
        <Card>
          <ul className="divide-y divide-neutral-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                <p className="text-neutral-800">{e.description}</p>
                <span className="text-xs text-neutral-400">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
