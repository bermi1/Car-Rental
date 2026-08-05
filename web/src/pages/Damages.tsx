import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardToolbar,
  Chip,
  EmptyState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  Textarea,
  formatDate,
  formatMoney,
} from '@rental/shared';
import { api, ApiError } from '../api/client';
import { useI18n, useT } from '../i18n';
import { ErrorNotice } from '../components/ErrorNotice';

interface DamageRow {
  id: string;
  booking_id: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  penalty_amount: number;
  currency: string;
  status: string;
  ai_assisted: boolean;
  created_at: string;
  client_name: string;
  make: string;
  model: string;
  plate_number: string;
}

interface Suggestion {
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  penalty_amount: number;
  reasoning: string;
}

const SEVERITY_TONE = { minor: 'pending', moderate: 'in_service', severe: 'cancelled' } as const;

export function Damages() {
  const t = useT();
  const { language } = useI18n();

  const [damages, setDamages] = useState<DamageRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [notes, setNotes] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  function load() {
    setDamages(null);
    api.get<DamageRow[]>(`/damages${status ? `?status=${status}` : ''}`).then(setDamages);
  }
  useEffect(load, [status]);

  useEffect(() => {
    api.get<{ enabled: boolean }>('/ai/status').then((r) => setAiEnabled(r.enabled)).catch(() => setAiEnabled(false));
  }, []);

  const filters = [
    { value: '', label: t('common.all') },
    { value: 'assessed', label: t('damages.assessed') },
    { value: 'charged', label: t('damages.charged') },
    { value: 'waived', label: t('damages.waived') },
  ];

  async function setStatusOf(d: DamageRow, next: string) {
    setBusyId(d.id);
    setError('');
    try {
      await api.put(`/damages/${d.id}`, { status: next });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the damage.');
    } finally {
      setBusyId(null);
    }
  }

  async function draft() {
    setDrafting(true);
    setError('');
    setSuggestions(null);
    try {
      const res = await api.post<{ suggestions: Suggestion[] }>('/damages/assist', {
        booking_id: bookingId.trim(),
        notes,
        language,
      });
      setSuggestions(res.suggestions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not draft an assessment.');
    } finally {
      setDrafting(false);
    }
  }

  async function saveSuggestion(s: Suggestion, index: number) {
    setSavingIndex(index);
    setError('');
    try {
      const form = new FormData();
      form.append('booking_id', bookingId.trim());
      form.append('description', s.description);
      form.append('severity', s.severity);
      form.append('penalty_amount', String(s.penalty_amount));
      form.append('ai_assisted', 'true');
      await api.post('/damages', form);
      setSuggestions((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the item.');
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t('damages.title')}
        description={t('damages.description')}
        actions={
          aiEnabled && (
            <Button icon="plus" onClick={() => setShowDraft(true)}>
              {t('damages.aiDraft')}
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Tabs items={filters} value={status} onChange={setStatus} />
      </div>

      <ErrorNotice message={error} />

      <Card flush className="mt-4">
        {!damages ? (
          <SkeletonTable />
        ) : damages.length === 0 ? (
          <EmptyState icon="check" title={t('damages.empty')} description={t('damages.emptyHint')} />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {damages.length} {damages.length === 1 ? 'item' : 'items'}
              </p>
            </CardToolbar>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>{t('common.client')}</TH>
                  <TH>{t('common.vehicle')}</TH>
                  <TH>{t('common.notes')}</TH>
                  <TH>{t('damages.severity')}</TH>
                  <TH numeric>{t('damages.penalty')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {damages.map((d) => (
                  <TR key={d.id}>
                    <TD className="whitespace-nowrap">
                      <Link
                        to={`/bookings/${d.booking_id}`}
                        className="font-medium text-fg transition-colors hover:text-accent"
                      >
                        {d.client_name}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {d.make} {d.model}
                      <span className="ml-1.5 text-fg-subtle">{d.plate_number}</span>
                    </TD>
                    <TD className="max-w-[280px]">
                      <span className="block truncate">{d.description}</span>
                      {d.ai_assisted && (
                        <Chip tone="accent" className="mt-1">
                          {t('damages.aiAssisted')}
                        </Chip>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge status={SEVERITY_TONE[d.severity]} label={t(`damages.${d.severity}`)} />
                    </TD>
                    <TD numeric className="whitespace-nowrap font-medium text-fg">
                      {formatMoney(d.penalty_amount, d.currency)}
                    </TD>
                    <TD>
                      <span className="whitespace-nowrap text-xs text-fg-subtle">
                        {formatDate(d.created_at)}
                      </span>
                    </TD>
                    <TD>
                      {d.status === 'assessed' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" isLoading={busyId === d.id} onClick={() => setStatusOf(d, 'charged')}>
                            {t('damages.charge')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === d.id}
                            onClick={() => setStatusOf(d, 'waived')}
                          >
                            {t('damages.waive')}
                          </Button>
                        </div>
                      )}
                      {d.status !== 'assessed' && (
                        <span className="block text-right text-xs capitalize text-fg-subtle">{d.status}</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
      </Card>

      <Modal
        open={showDraft}
        onClose={() => setShowDraft(false)}
        title={t('damages.aiDraft')}
        description={t('damages.aiNotesHint')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDraft(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={draft} isLoading={drafting} disabled={!bookingId.trim() || !notes.trim()}>
              {t('damages.aiDraft')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Booking ID"
            placeholder="Paste the booking's ID from its detail page"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          />
          <Textarea
            label={t('damages.aiNotes')}
            rows={4}
            placeholder="Long scratch on the rear passenger door, front bumper cracked on the left, came back on a quarter tank…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <ErrorNotice message={error} />

          {suggestions && suggestions.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-fg">{t('damages.aiSuggestions')}</p>
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="rounded-lg border border-line bg-surface-sunken/60 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-fg">{s.description}</p>
                        <p className="mt-1 text-xs text-fg-muted">{s.reasoning}</p>
                      </div>
                      <StatusBadge status={SEVERITY_TONE[s.severity]} label={t(`damages.${s.severity}`)} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold tabular-nums text-fg">
                        {formatMoney(s.penalty_amount)}
                      </span>
                      <Button size="sm" isLoading={savingIndex === i} onClick={() => saveSuggestion(s, i)}>
                        {t('common.save')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-fg-subtle">
                <Icon name="alert" size={13} className="mt-px shrink-0" />
                These are drafts. Check each amount before saving — anything saved here is marked AI-assisted.
              </p>
            </div>
          )}

          {suggestions && suggestions.length === 0 && (
            <p className="text-[13px] text-fg-muted">
              The assistant didn't find anything chargeable in those notes.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
