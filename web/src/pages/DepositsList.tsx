import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardToolbar,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  DataTable,
  Tabs,
  Textarea,
  formatDate,
  formatMoney,
  type DataColumn,
} from '@rental/shared';
import { api, ApiError } from '../api/client';
import { ErrorNotice } from '../components/ErrorNotice';

interface DepositRow {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  reason: string | null;
  client_name: string;
  recorded_at: string;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'held', label: 'Held' },
  { value: 'released', label: 'Released' },
  { value: 'forfeited', label: 'Forfeited' },
];

export function DepositsList() {
  const [deposits, setDeposits] = useState<DepositRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [forfeiting, setForfeiting] = useState<DepositRow | null>(null);
  const [reason, setReason] = useState('');

  function load() {
    setDeposits(null);
    api.get<DepositRow[]>(`/deposits${status ? `?status=${status}` : ''}`).then(setDeposits);
  }
  useEffect(load, [status]);

  async function release(d: DepositRow) {
    setBusyId(d.id);
    setError('');
    try {
      await api.put(`/deposits/${d.id}`, { status: 'released' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not release the deposit.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmForfeit() {
    if (!forfeiting) return;
    setBusyId(forfeiting.id);
    setError('');
    try {
      await api.put(`/deposits/${forfeiting.id}`, { status: 'forfeited', reason: reason.trim() });
      setForfeiting(null);
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not forfeit the deposit.');
    } finally {
      setBusyId(null);
    }
  }

  const totalHeld = deposits?.filter((d) => d.status === 'held').reduce((s, d) => s + Number(d.amount), 0) ?? 0;

  const columns: DataColumn<DepositRow>[] = [
    {
      key: 'client',
      header: 'Client',
      primary: true,
      render: (d) => (
        <Link to={`/bookings/${d.booking_id}`} className="font-medium text-fg transition-colors hover:text-accent">
          {d.client_name}
        </Link>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (d) => <span className="font-medium text-fg">{formatMoney(d.amount)}</span>,
      className: 'whitespace-nowrap',
    },
    { key: 'status', header: 'Status', action: true, render: (d) => <StatusBadge status={d.status} /> },
    { key: 'reason', header: 'Reason', render: (d) => d.reason || '—', className: 'max-w-[220px] truncate' },
    {
      key: 'recorded',
      header: 'Recorded',
      secondary: true,
      render: (d) => formatDate(d.recorded_at),
      className: 'whitespace-nowrap',
    },
    {
      key: 'actions',
      header: '',
      action: true,
      render: (d) =>
        d.status === 'held' ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" isLoading={busyId === d.id} onClick={() => release(d)}>
              Release
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === d.id}
              onClick={() => {
                setForfeiting(d);
                setReason('');
              }}
            >
              Forfeit
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Deposits" description="Security deposits held against rentals." />

      <div className="mb-4">
        <Tabs items={FILTERS} value={status} onChange={setStatus} />
      </div>

      <ErrorNotice message={error} />

      <Card flush className="mt-4">
        {!deposits ? (
          <SkeletonTable />
        ) : deposits.length === 0 ? (
          <EmptyState icon="wallet" title="No deposits found" description="Nothing matches this filter." />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {deposits.length} deposit{deposits.length === 1 ? '' : 's'}
              </p>
              {totalHeld > 0 && (
                <p className="text-[13px] text-fg-muted">
                  Currently held <span className="font-semibold tabular-nums text-fg">{formatMoney(totalHeld)}</span>
                </p>
              )}
            </CardToolbar>
            <DataTable columns={columns} rows={deposits} rowKey={(d) => d.id} />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(forfeiting)}
        onClose={() => setForfeiting(null)}
        title="Forfeit deposit"
        description={
          forfeiting ? `${formatMoney(forfeiting.amount)} — ${forfeiting.client_name}` : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForfeiting(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={Boolean(busyId)} onClick={confirmForfeit}>
              Forfeit deposit
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          placeholder="Damage to bodywork, late return, unpaid fuel…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <p className="mt-2 text-xs text-fg-subtle">
          This is recorded against the booking, so write something the client would understand.
        </p>
      </Modal>
    </>
  );
}
