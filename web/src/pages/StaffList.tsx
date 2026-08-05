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
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatDate,
  initials,
} from '@rental/shared';
import type { StaffUser } from '@rental/shared';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ErrorNotice } from '../components/ErrorNotice';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'staff' };

export function StaffList() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get<StaffUser[]>('/staff').then(setStaff);
  }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/staff', form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: StaffUser) {
    setError('');
    try {
      await api.put(`/staff/${s.id}`, { is_active: !s.is_active });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the account.');
    }
  }

  return (
    <>
      <PageHeader
        title="Staff Accounts"
        description="Who can sign in to this console, and at what level."
        actions={
          <Button icon="plus" onClick={() => setShowForm(true)}>
            Add Staff
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
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Added</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {staff.map((s) => {
                  const isSelf = s.id === user?.id;
                  return (
                    <TR key={s.id}>
                      <TD>
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-fg-muted">
                            {initials(s.name)}
                          </span>
                          <span className="font-medium text-fg">
                            {s.name}
                            {isSelf && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(you)</span>}
                          </span>
                        </span>
                      </TD>
                      <TD>{s.email}</TD>
                      <TD>
                        <StatusBadge
                          status={s.role === 'admin' ? 'confirmed' : 'pending'}
                          label={s.role === 'admin' ? 'Admin' : 'Staff'}
                        />
                      </TD>
                      <TD>
                        <StatusBadge
                          status={s.is_active ? 'verified' : 'inactive'}
                          label={s.is_active ? 'Active' : 'Deactivated'}
                        />
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(s.created_at)}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isSelf}
                            title={isSelf ? 'You cannot deactivate your own account' : undefined}
                            onClick={() => toggleActive(s)}
                          >
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add staff account"
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
            hint="Share it with them directly — it isn't emailed."
          />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff — daily operations</option>
            <option value="admin">Admin — full access</option>
          </Select>
        </form>
      </Modal>
    </>
  );
}
