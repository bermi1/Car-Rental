import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardToolbar,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
  Tabs,
  Textarea,
  formatDate,
  formatMoney,
  humanize,
  type DataColumn,
} from '@rental/shared';
import type { Vehicle } from '@rental/shared';
import { api, ApiError } from '../api/client';
import { ErrorNotice } from '../components/ErrorNotice';

interface Repair {
  id: string;
  vehicle_id: string;
  service_type: string;
  notes: string | null;
  cost: number;
  currency: string;
  status: string;
  garage: string | null;
  date: string;
  mileage_at_service: number;
  make: string;
  model: string;
  plate_number: string;
  recorded_by_name: string | null;
}

const STATUS_TONE: Record<string, string> = {
  reported: 'pending',
  in_progress: 'active',
  done: 'completed',
  cancelled: 'cancelled',
};

const EMPTY = {
  vehicle_id: '',
  service_type: '',
  notes: '',
  cost: '',
  garage: '',
  status: 'reported',
  take_out_of_service: true,
};

export function Repairs() {
  const [repairs, setRepairs] = useState<Repair[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [closing, setClosing] = useState<Repair | null>(null);
  const [closeNotes, setCloseNotes] = useState('');
  const [closeCost, setCloseCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setRepairs(null);
    api.get<Repair[]>(`/repairs${status ? `?status=${status}` : ''}`).then(setRepairs);
  }
  useEffect(load, [status]);

  useEffect(() => {
    api.get<Vehicle[]>('/vehicles').then(setVehicles).catch(() => setVehicles([]));
  }, []);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('vehicle_id', form.vehicle_id);
      body.append('service_type', form.service_type);
      body.append('status', form.status);
      if (form.notes.trim()) body.append('notes', form.notes.trim());
      if (form.cost) body.append('cost', form.cost);
      if (form.garage.trim()) body.append('garage', form.garage.trim());
      if (form.take_out_of_service) body.append('take_out_of_service', 'true');
      await api.post('/repairs', body);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the repair.');
    } finally {
      setSaving(false);
    }
  }

  async function close() {
    if (!closing) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/repairs/${closing.id}`, {
        status: 'done',
        notes: closeNotes.trim() || undefined,
        cost: closeCost ? Number(closeCost) : undefined,
      });
      setClosing(null);
      setCloseNotes('');
      setCloseCost('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not close the repair.');
    } finally {
      setSaving(false);
    }
  }

  const filters = [
    { value: '', label: 'All' },
    { value: 'reported', label: 'Reported' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ];

  const columns: DataColumn<Repair>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      primary: true,
      render: (r) => (
        <>
          <span className="font-medium text-fg">
            {r.make} {r.model}
          </span>
          <span className="ml-1.5 text-fg-subtle">{r.plate_number}</span>
        </>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'work',
      header: 'Work',
      secondary: true,
      render: (r) => (
        <>
          {r.service_type}
          {r.notes && <p className="mt-0.5 max-w-[22rem] text-xs text-fg-subtle">{r.notes}</p>}
        </>
      ),
    },
    {
      key: 'garage',
      header: 'Garage',
      render: (r) => r.garage || <span className="text-fg-subtle">—</span>,
      hideOnMobile: true,
    },
    {
      key: 'cost',
      header: 'Cost',
      numeric: true,
      render: (r) =>
        Number(r.cost) > 0 ? (
          <span className="font-medium text-fg">{formatMoney(r.cost, r.currency)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
      className: 'whitespace-nowrap',
    },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date), className: 'whitespace-nowrap' },
    {
      key: 'status',
      header: 'Status',
      action: true,
      render: (r) => <StatusBadge status={STATUS_TONE[r.status] ?? 'pending'} label={humanize(r.status)} />,
    },
    {
      key: 'actions',
      header: '',
      action: true,
      render: (r) =>
        r.status === 'done' || r.status === 'cancelled' ? null : (
          <Button
            size="sm"
            icon="check"
            onClick={() => {
              setClosing(r);
              setCloseCost(String(Math.round(Number(r.cost) || 0) || ''));
              setCloseNotes('');
            }}
          >
            Mark done
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Repairs & Servicing"
        description="What is in the garage, what it cost, and what was actually fixed."
        actions={
          <Button icon="plus" onClick={() => setShowForm(true)}>
            Open Repair
          </Button>
        }
      />

      <ErrorNotice message={error} />

      <div className="mb-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <Tabs items={filters} value={status} onChange={setStatus} className="w-max sm:w-auto" />
      </div>

      <Card flush>
        {!repairs ? (
          <SkeletonTable />
        ) : repairs.length === 0 ? (
          <EmptyState
            icon="alert"
            title="Nothing in the garage"
            description="Open a repair when a car needs work — it comes off the road until you close it."
          />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {repairs.length} {repairs.length === 1 ? 'repair' : 'repairs'}
              </p>
            </CardToolbar>
            <DataTable columns={columns} rows={repairs} rowKey={(r) => r.id} />
          </>
        )}
      </Card>

      {/* Open a repair */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Open a repair"
        description="The car comes off the road while the work is being done."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="open-repair" isLoading={saving} disabled={!form.vehicle_id || !form.service_type}>
              Open
            </Button>
          </>
        }
      >
        <form id="open-repair" onSubmit={open} className="space-y-4">
          <Select
            label="Vehicle"
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            required
          >
            <option value="">Choose a vehicle…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} — {v.plate_number}
              </option>
            ))}
          </Select>

          <Input
            label="What needs doing?"
            placeholder="Front brake pads, service, windscreen…"
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="reported">Reported</option>
              <option value="in_progress">In progress</option>
              <option value="done">Already done</option>
            </Select>
            <Input
              label="Cost (TZS)"
              type="number"
              min="0"
              hint="Becomes an expense once done"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>

          <Input
            label="Garage"
            hint="Optional"
            value={form.garage}
            onChange={(e) => setForm({ ...form, garage: e.target.value })}
          />

          <Textarea
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <label className="flex items-center gap-2.5 text-[13px] text-fg">
            <input
              type="checkbox"
              checked={form.take_out_of_service}
              onChange={(e) => setForm({ ...form, take_out_of_service: e.target.checked })}
              className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
            />
            Take the car off the road while this is open
          </label>
        </form>
      </Modal>

      {/* Close a repair */}
      <Modal
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        title="Mark repair as done"
        description={closing ? `${closing.make} ${closing.model} — ${closing.service_type}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button isLoading={saving} onClick={close}>
              Mark done
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="What was done?"
            placeholder="Pads and discs replaced, test driven"
            rows={3}
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            autoFocus
          />
          <Input
            label="Final cost (TZS)"
            type="number"
            min="0"
            hint="Recorded as a repair expense against this vehicle"
            value={closeCost}
            onChange={(e) => setCloseCost(e.target.value)}
          />
          <p className="text-xs text-fg-subtle">
            The car goes back to available when this is closed.
          </p>
        </div>
      </Modal>
    </>
  );
}
