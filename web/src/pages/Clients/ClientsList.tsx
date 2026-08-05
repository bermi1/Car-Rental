import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardToolbar,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatDate,
  humanize,
  initials,
} from '@rental/shared';
import type { Client } from '@rental/shared';
import { api } from '../../api/client';

export function ClientsList() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');

  // Server-side search — the client table can grow well past what's worth
  // shipping to the browser.
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      api.get<Client[]>(`/clients${qs}`).then(setClients);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <>
      <PageHeader title="Clients" description="Everyone who has rented from you." />

      <div className="mb-4 flex justify-end">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
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
                {clients.length} client{clients.length === 1 ? '' : 's'}
              </p>
            </CardToolbar>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Email</TH>
                  <TH>ID Type</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {clients.map((c) => (
                  <TR key={c.id}>
                    <TD className="whitespace-nowrap">
                      <Link to={`/clients/${c.id}`} className="flex items-center gap-2.5 group">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-fg-muted">
                          {initials(c.full_name)}
                        </span>
                        <span className="font-medium text-fg transition-colors group-hover:text-accent">
                          {c.full_name}
                        </span>
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">{c.phone}</TD>
                    <TD>{c.email}</TD>
                    <TD>{humanize(c.id_type)}</TD>
                    <TD className="whitespace-nowrap">{formatDate(c.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
      </Card>
    </>
  );
}
