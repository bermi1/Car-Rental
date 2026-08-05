import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  EmptyState,
  Icon,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  formatDateTime,
  formatRelative,
} from '@rental/shared';
import { api } from '../api/client';
import { useT } from '../i18n';

interface LivePosition {
  booking_id: string;
  location_sharing_enabled: boolean;
  client_name: string;
  client_phone: string;
  make: string;
  model: string;
  plate_number: string;
  latitude: string | null;
  longitude: string | null;
  accuracy_m: string | null;
  speed_kph: string | null;
  recorded_at: string | null;
}

export function Tracking() {
  const t = useT();
  const [rows, setRows] = useState<LivePosition[] | null>(null);

  function load() {
    api.get<LivePosition[]>('/tracking/live').then(setRows);
  }

  useEffect(() => {
    load();
    // Positions come from phones on a timer; refresh so the page stays live
    // without the user reaching for reload.
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <PageHeader title={t('tracking.title')} description={t('tracking.description')} />

      {!rows ? (
        <Card flush>
          <SkeletonTable rows={3} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="car" title={t('tracking.empty')} description={t('tracking.emptyHint')} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const hasPosition = r.latitude !== null && r.longitude !== null;
            return (
              <Card key={r.booking_id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/bookings/${r.booking_id}`}
                      className="block truncate text-sm font-semibold text-fg hover:text-accent"
                    >
                      {r.make} {r.model}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-fg-subtle">{r.plate_number}</p>
                  </div>
                  <StatusBadge
                    status={r.location_sharing_enabled ? 'active' : 'inactive'}
                    label={r.location_sharing_enabled ? 'Sharing' : 'Off'}
                  />
                </div>

                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[13px] font-medium text-fg">{r.client_name}</p>
                  <a
                    href={`tel:${r.client_phone}`}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-accent hover:opacity-75"
                  >
                    {r.client_phone}
                  </a>
                </div>

                <div className="mt-3 rounded-lg bg-surface-sunken/60 p-3">
                  {!r.location_sharing_enabled ? (
                    <p className="text-xs text-fg-muted">{t('tracking.sharingOff')}</p>
                  ) : !hasPosition ? (
                    <p className="text-xs text-fg-muted">{t('tracking.noPings')}</p>
                  ) : (
                    <>
                      <p className="font-mono text-[13px] tabular-nums text-fg">
                        {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                      </p>
                      <p className="mt-1 text-xs text-fg-subtle">
                        {t('tracking.lastSeen')} {formatRelative(r.recorded_at)}
                        {r.accuracy_m ? ` · ±${Math.round(Number(r.accuracy_m))}m` : ''}
                        {r.speed_kph ? ` · ${Math.round(Number(r.speed_kph))} km/h` : ''}
                      </p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-75"
                      >
                        <Icon name="external" size={12} />
                        {t('tracking.openMap')}
                      </a>
                      {r.recorded_at && (
                        <p className="mt-1 text-[11px] text-fg-subtle">{formatDateTime(r.recorded_at)}</p>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
