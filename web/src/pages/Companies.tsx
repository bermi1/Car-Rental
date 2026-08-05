import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardToolbar,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatDate,
} from '@rental/shared';
import { api, ApiError } from '../api/client';
import { useT } from '../i18n';
import { useAuth, type Company } from '../context/AuthContext';
import { ErrorNotice } from '../components/ErrorNotice';

interface CompanyRow extends Company {
  registration_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  region: string | null;
  is_active: boolean;
  created_at: string;
  vehicle_count: number;
  booking_count: number;
  staff_count: number;
}

const EMPTY = { name: '', registration_number: '', contact_email: '', contact_phone: '', region: '' };

export function Companies() {
  const t = useT();
  const { company: active, switchCompany } = useAuth();

  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get<CompanyRow[]>('/companies').then(setCompanies);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/companies', form);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register the company.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('companies.title')}
        description={t('companies.description')}
        actions={
          <Button icon="plus" onClick={() => setShowForm(true)}>
            {t('companies.add')}
          </Button>
        }
      />

      <ErrorNotice message={error} />

      <Card flush className="mt-4">
        {!companies ? (
          <SkeletonTable />
        ) : companies.length === 0 ? (
          <EmptyState icon="car" title={t('companies.empty')} description={t('companies.emptyHint')} />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {companies.length} {companies.length === 1 ? 'company' : 'companies'}
              </p>
            </CardToolbar>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>{t('companies.name')}</TH>
                  <TH>{t('companies.region')}</TH>
                  <TH numeric>{t('companies.vehicles')}</TH>
                  <TH numeric>{t('companies.bookings')}</TH>
                  <TH numeric>{t('companies.staff')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {companies.map((c) => (
                  <TR key={c.id}>
                    <TD className="whitespace-nowrap">
                      <span className="font-medium text-fg">{c.name}</span>
                      {c.contact_email && (
                        <span className="block text-xs text-fg-subtle">{c.contact_email}</span>
                      )}
                    </TD>
                    <TD>{c.region || '—'}</TD>
                    <TD numeric>{c.vehicle_count}</TD>
                    <TD numeric>{c.booking_count}</TD>
                    <TD numeric>{c.staff_count}</TD>
                    <TD>
                      <StatusBadge
                        status={c.is_active ? 'verified' : 'inactive'}
                        label={c.is_active ? 'Active' : 'Suspended'}
                      />
                      <span className="mt-1 block text-xs text-fg-subtle">{formatDate(c.created_at)}</span>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        {active?.id === c.id ? (
                          <span className="text-xs font-medium text-accent">{t('companies.switcher')}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => switchCompany({ id: c.id, name: c.name, slug: c.slug })}
                          >
                            {t('common.open')}
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('companies.add')}
        description="The company gets its own fleet, staff, bookings and settings."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
            <Button form="add-company" type="submit" isLoading={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="add-company" onSubmit={create} className="space-y-4">
          <Input
            label={t('companies.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('companies.registration')}
              value={form.registration_number}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
              hint={t('common.optional')}
            />
            <Input
              label={t('companies.region')}
              placeholder="Dar es Salaam"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('companies.contactEmail')}
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
            <Input
              label={t('companies.contactPhone')}
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
