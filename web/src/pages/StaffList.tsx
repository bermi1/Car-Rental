import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardToolbar,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
  DataTable,
  formatDate,
  initials,
  type DataColumn,
} from '@rental/shared';
import type { StaffUser } from '@rental/shared';
import { api, ApiError } from '../api/client';
import { useAuth, type Company } from '../context/AuthContext';
import { ErrorNotice } from '../components/ErrorNotice';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'staff', company_id: '' };

/** The server sends the company alongside each account so the list can show it. */
type StaffRow = StaffUser & { company_id: string | null; company_name: string | null };

export function StaffList() {
  const { user, company, isSuperAdmin } = useAuth();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // A super admin with no company switched in is looking at the whole
  // platform, so the account they create has to name its own company.
  const platformWide = isSuperAdmin && !company;

  function load() {
    api.get<StaffRow[]>('/staff').then(setStaff);
  }
  useEffect(load, [company?.id]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get<Company[]>('/companies').then(setCompanies).catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/staff', {
        ...form,
        // Ordinary admins never send this — the server takes their company
        // from the token and ignores anything in the body.
        company_id: form.role === 'super_admin' ? undefined : form.company_id || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: StaffRow) {
    setError('');
    try {
      await api.put(`/staff/${s.id}`, { is_active: !s.is_active });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the account.');
    }
  }

  const columns: DataColumn<StaffRow>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      render: (s) => (
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-fg-muted">
            {initials(s.name)}
          </span>
          <span className="font-medium text-fg">
            {s.name}
            {s.id === user?.id && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(you)</span>}
          </span>
        </span>
      ),
      className: 'whitespace-nowrap',
    },
    { key: 'email', header: 'Email', secondary: true, render: (s) => s.email },
    {
      key: 'role',
      header: 'Role',
      render: (s) => (
        <StatusBadge
          status={s.role === 'super_admin' ? 'active' : s.role === 'admin' ? 'confirmed' : 'pending'}
          label={s.role === 'super_admin' ? 'Platform admin' : s.role === 'admin' ? 'Owner' : 'Staff'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      action: true,
      render: (s) => (
        <StatusBadge
          status={s.is_active ? 'verified' : 'inactive'}
          label={s.is_active ? 'Active' : 'Deactivated'}
        />
      ),
    },
    ...(platformWide
      ? [
          {
            key: 'company',
            header: 'Company',
            render: (s: StaffRow) => s.company_name ?? <span className="text-fg-subtle">Platform-wide</span>,
            className: 'whitespace-nowrap',
          } as DataColumn<StaffRow>,
        ]
      : []),
    { key: 'added', header: 'Added', render: (s) => formatDate(s.created_at), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      header: '',
      action: true,
      render: (s) => (
        <Button
          size="sm"
          variant="ghost"
          disabled={s.id === user?.id}
          title={s.id === user?.id ? 'You cannot deactivate your own account' : undefined}
          onClick={() => toggleActive(s)}
        >
          {s.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="People"
        description={
          platformWide
            ? 'Every console account on the platform, and the company it belongs to.'
            : `The owner and staff who can sign in to ${company?.name ?? 'this company'}.`
        }
        actions={
          <Button icon="plus" onClick={() => setShowForm(true)}>
            Add Person
          </Button>
        }
      />

      <ErrorNotice message={error} />

      <Card flush className="mt-4">
        {!staff ? (
          <SkeletonTable />
        ) : staff.length === 0 ? (
          <EmptyState icon="shield" title="No staff accounts yet" />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {staff.length} account{staff.length === 1 ? '' : 's'}
              </p>
            </CardToolbar>
            <DataTable columns={columns} rows={staff} rowKey={(s) => s.id} />
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add someone to the team"
        description="They can sign in immediately with these credentials."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button form="add-staff" type="submit" isLoading={saving}>
              Create account
            </Button>
          </>
        }
      >
        <form id="add-staff" onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@rental.co.tz"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            hint="At least 8 characters. Share it with them directly — it isn't emailed."
          />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff — data entry and daily operations</option>
            <option value="admin">Owner — runs the company: cars, staff, money</option>
            {isSuperAdmin && <option value="super_admin">Platform admin — every company</option>}
          </Select>

          {platformWide && form.role !== 'super_admin' && (
            <Select
              label="Company"
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              required
              hint="An account without a company can sign in but cannot open anything."
            >
              <option value="">Choose a company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </form>
      </Modal>
    </>
  );
}
