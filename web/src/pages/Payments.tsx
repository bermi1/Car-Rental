import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardToolbar,
  DataTable,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  Tabs,
  Textarea,
  formatDate,
  formatMoney,
  humanize,
  type DataColumn,
} from '@rental/shared';
import { api, ApiError, assetUrl } from '../api/client';
import { useT } from '../i18n';
import { ErrorNotice } from '../components/ErrorNotice';

interface PaymentRow {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  receipt_file_path: string | null;
  status: string;
  rejection_reason: string | null;
  paid_at: string | null;
  created_at: string;
  client_name: string;
  make: string;
  model: string;
  plate_number: string;
}

export function Payments() {
  const t = useT();
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState('');

  function load() {
    setPayments(null);
    api.get<PaymentRow[]>(`/payments${status ? `?status=${status}` : ''}`).then(setPayments);
  }
  useEffect(load, [status]);

  const filters = [
    { value: '', label: t('common.all') },
    { value: 'awaiting_confirmation', label: t('payments.awaiting') },
    { value: 'confirmed', label: t('payments.confirmed') },
    { value: 'rejected', label: t('payments.rejected') },
  ];

  const confirmedTotal = useMemo(
    () => (payments ?? []).filter((p) => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0),
    [payments]
  );

  async function confirm(p: PaymentRow) {
    setBusyId(p.id);
    setError('');
    try {
      await api.put(`/payments/${p.id}/confirm`, { confirmed: true });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm the payment.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setError('');
    try {
      await api.put(`/payments/${rejecting.id}/confirm`, {
        confirmed: false,
        rejection_reason: reason.trim() || undefined,
      });
      setRejecting(null);
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject the payment.');
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataColumn<PaymentRow>[] = [
    {
      key: 'client',
      header: t('common.client'),
      primary: true,
      render: (p) => (
        <Link to={`/bookings/${p.booking_id}`} className="font-medium text-fg transition-colors hover:text-accent">
          {p.client_name}
        </Link>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'vehicle',
      header: t('common.vehicle'),
      secondary: true,
      render: (p) => (
        <>
          {p.make} {p.model} <span className="text-fg-subtle">{p.plate_number}</span>
        </>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'amount',
      header: t('common.amount'),
      numeric: true,
      render: (p) => (
        <span className="font-medium text-fg">{formatMoney(p.amount, p.currency)}</span>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'method',
      header: t('payments.method'),
      render: (p) => (
        <>
          {humanize(p.method)}
          {p.reference && <span className="ml-1.5 text-xs text-fg-subtle">{p.reference}</span>}
        </>
      ),
    },
    {
      key: 'receipt',
      header: t('payments.receipt'),
      render: (p) =>
        p.receipt_file_path ? (
          <a
            href={assetUrl(p.receipt_file_path)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:opacity-75"
          >
            {t('common.view')}
            <Icon name="external" size={12} />
          </a>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'status',
      header: t('common.status'),
      action: true,
      render: (p) => (
        <div className="text-right">
          <StatusBadge
            status={p.status === 'confirmed' ? 'verified' : p.status === 'rejected' ? 'rejected' : 'pending'}
            label={
              p.status === 'confirmed'
                ? t('payments.confirmed')
                : p.status === 'rejected'
                  ? t('payments.rejected')
                  : t('payments.awaiting')
            }
          />
          {p.rejection_reason && (
            <p className="mt-1 max-w-[180px] truncate text-xs text-fg-subtle">{p.rejection_reason}</p>
          )}
          {p.status === 'confirmed' && p.paid_at && (
            <p className="mt-1 text-xs text-fg-subtle">{formatDate(p.paid_at)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      action: true,
      render: (p) =>
        p.status === 'awaiting_confirmation' ? (
          <div className="flex gap-2">
            <Button size="sm" icon="check" isLoading={busyId === p.id} onClick={() => confirm(p)}>
              {t('common.confirm')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === p.id}
              onClick={() => {
                setRejecting(p);
                setReason('');
              }}
            >
              {t('common.reject')}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title={t('payments.title')} description={t('payments.description')} />

      <div className="mb-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <Tabs items={filters} value={status} onChange={setStatus} className="w-max sm:w-auto" />
      </div>

      <ErrorNotice message={error} />

      <Card flush className="mt-4">
        {!payments ? (
          <SkeletonTable />
        ) : payments.length === 0 ? (
          <EmptyState icon="wallet" title={t('payments.empty')} description={t('payments.emptyHint')} />
        ) : (
          <>
            <CardToolbar className="flex-wrap">
              <p className="text-[13px] text-fg-muted">
                {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
              </p>
              {confirmedTotal > 0 && (
                <p className="text-[13px] text-fg-muted">
                  {t('payments.totalConfirmed')}{' '}
                  <span className="font-semibold tabular-nums text-fg">{formatMoney(confirmedTotal)}</span>
                </p>
              )}
            </CardToolbar>
            <DataTable columns={columns} rows={payments} rowKey={(p) => p.id} />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t('payments.rejectPayment')}
        description={
          rejecting ? `${formatMoney(rejecting.amount, rejecting.currency)} — ${rejecting.client_name}` : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" isLoading={Boolean(busyId)} onClick={confirmReject}>
              {t('payments.rejectPayment')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('payments.rejectReason')}
          placeholder="Receipt doesn't match the amount, wrong reference…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </Modal>
    </>
  );
}
