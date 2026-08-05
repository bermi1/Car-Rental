import React, { useEffect, useState } from 'react';
import { Card, EmptyState, Icon, PageHeader, SkeletonTable, formatDateTime, humanize } from '@rental/shared';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

export function MyActivity() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    api.get<ActivityEntry[]>('/staff/me/activity').then(setEntries);
  }, []);

  return (
    <>
      <PageHeader title="My Activity" description={`Actions recorded against ${user?.name ?? 'your account'}.`} />

      <Card flush>
        {!entries ? (
          <SkeletonTable rows={6} />
        ) : entries.length === 0 ? (
          <EmptyState icon="activity" title="No activity yet" description="Actions you take will appear here." />
        ) : (
          <ol className="relative px-5 py-4">
            {entries.map((e, i) => (
              <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Connector line, stopping at the last entry. */}
                {i < entries.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[13px] top-7 h-full w-px bg-line" />
                )}
                <span className="relative z-10 mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-softFg">
                  <Icon name="activity" size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-fg">{e.description}</p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {humanize(e.entity_type)} · {formatDateTime(e.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
