import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardToolbar,
  DataTable,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  formatDate,
  humanize,
  initials,
  type DataColumn,
} from '@rental/shared';
import type { Client } from '@rental/shared';
import { api } from '../../api/client';
import { useT } from '../../i18n';

export function ClientsList() {
  const t = useT();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');

  // Server-side search — the client table can grow past what's worth shipping
  // to the browser.
  useEffect(() => {
    const timer = setTimeout(() => {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      api.get<Client[]>(`/clients${qs}`).then(setClients);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const columns: DataColumn<Client>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      render: (c) => (
        <Link to={`/clients/${c.id}`} className="group flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-fg-muted">
            {initials(c.full_name)}
          </span>
          <span className="font-medium text-fg transition-colors group-hover:text-accent">{c.full_name}</span>
        </Link>
      ),
      className: 'whitespace-nowrap',
    },
    { key: 'phone', header: 'Phone', secondary: true, render: (c) => c.phone, className: 'whitespace-nowrap' },
    { key: 'email', header: 'Email', render: (c) => c.email },
    { key: 'idType', header: 'ID Type', render: (c) => humanize(c.id_type) },
    {
      key: 'joined',
      header: 'Joined',
      render: (c) => formatDate(c.created_at),
      className: 'whitespace-nowrap',
    },
  ];

  return (
    <>
      <PageHeader title={t('nav.clients')} description="Everyone who has rented from you." />

      <div className="mb-4 flex justify-end">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          wrapperClassName="w-full sm:w-80"
        />
      </div>

      <Card flush>
        {!clients ? (
          <SkeletonTable />
        ) : clients.length === 0 ? (
          <EmptyState
            icon="users"
            title={search ? 'No matching clients' : 'No clients yet'}
            description={search ? 'Try a different search term.' : 'Clients appear here once they register.'}
          />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {clients.length} {clients.length === 1 ? 'client' : 'clients'}
              </p>
            </CardToolbar>
            <DataTable columns={columns} rows={clients} rowKey={(c) => c.id} />
          </>
        )}
      </Card>
    </>
  );
}
