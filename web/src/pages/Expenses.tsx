import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardToolbar,
  DataTable,
  EmptyState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  StatCard,
  Tabs,
  Textarea,
  formatDate,
  formatMoney,
  humanize,
  type DataColumn,
} from '@rental/shared';
import type { Vehicle } from '@rental/shared';
import { api, ApiError, assetUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ErrorNotice } from '../components/ErrorNotice';

interface Expense {
  id: string;
  vehicle_id: string | null;
  category: string;
  description: string;
  amount: number;
  currency: string;
  spent_on: string;
  supplier: string | null;
  receipt_file_path: string | null;
  recorded_by_name: string | null;
  make: string | null;
  model: string | null;
  plate_number: string | null;
}

interface Summary {
  total: number;
  by_category: { category: string; total: number; count: number }[];
  by_vehicle: { id: string; make: string; model: string; plate_number: string; total: number }[];
}

const CATEGORIES = [
  'fuel', 'repair', 'service', 'insurance', 'licensing', 'tyres',
  'cleaning', 'parking', 'fine', 'salary', 'rent', 'other',
];

const EMPTY = {
  category: 'fuel',
  description: '',
  amount: '',
  spent_on: new Date().toISOString().slice(0, 10),
  vehicle_id: '',
  supplier: '',
};

/** Horizontal bar, scaled against the largest value in its set. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Expenses() {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [category, setCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setExpenses(null);
    api.get<Expense[]>(`/expenses${category ? `?category=${category}` : ''}`).then(setExpenses);
    if (isAdmin) api.get<Summary>('/expenses/summary').then(setSummary).catch(() => setSummary(null));
  }
  useEffect(load, [category, isAdmin]);

  useEffect(() => {
    api.get<Vehicle[]>('/vehicles').then(setVehicles).catch(() => setVehicles([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('category', form.category);
      body.append('description', form.description);
      body.append('amount', form.amount);
      body.append('spent_on', form.spent_on);
      if (form.vehicle_id) body.append('vehicle_id', form.vehicle_id);
      if (form.supplier.trim()) body.append('supplier', form.supplier.trim());
      if (receipt) body.append('receipt', receipt);
      await api.post('/expenses', body);
      setForm(EMPTY);
      setReceipt(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the expense.');
    } finally {
      setSaving(false);
    }
  }

  const listedTotal = useMemo(
    () => (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0),
    [expenses]
  );

  const filters = [{ value: '', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))];

  const columns: DataColumn<Expense>[] = [
    {
      key: 'description',
      header: 'What',
      primary: true,
      render: (e) => (
        <>
          <span className="font-medium text-fg">{e.description}</span>
          {e.supplier && <span className="ml-1.5 text-fg-subtle">{e.supplier}</span>}
        </>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      secondary: true,
      render: (e) => humanize(e.category),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (e) =>
        e.plate_number ? (
          <>
            {e.make} {e.model} <span className="text-fg-subtle">{e.plate_number}</span>
          </>
        ) : (
          <span className="text-fg-subtle">Company-wide</span>
        ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (e) => <span className="font-medium text-fg">{formatMoney(e.amount, e.currency)}</span>,
      className: 'whitespace-nowrap',
    },
    { key: 'date', header: 'Date', render: (e) => formatDate(e.spent_on), className: 'whitespace-nowrap' },
    {
      key: 'receipt',
      header: 'Receipt',
      action: true,
      render: (e) =>
        e.receipt_file_path ? (
          <a
            href={assetUrl(e.receipt_file_path)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:opacity-75"
          >
            View <Icon name="external" size={12} />
          </a>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
  ];

  const maxCategory = Math.max(0, ...(summary?.by_category ?? []).map((c) => c.total));
  const maxVehicle = Math.max(0, ...(summary?.by_vehicle ?? []).map((v) => v.total));

  return (
    <>
      <PageHeader
        title="Expenses"
        description="What the fleet costs to keep on the road."
        actions={
          <Button icon="plus" onClick={() => setShowForm(true)}>
            Record Expense
          </Button>
        }
      />

      <ErrorNotice message={error} />

      {isAdmin && summary && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Spent" value={formatMoney(summary.total)} icon="wallet" tone="danger" />
            <StatCard
              label="Biggest Category"
              value={summary.by_category[0] ? humanize(summary.by_category[0].category) : '—'}
              hint={summary.by_category[0] ? formatMoney(summary.by_category[0].total) : undefined}
              icon="chart"
            />
            <StatCard
              label="Costliest Vehicle"
              value={summary.by_vehicle[0] ? summary.by_vehicle[0].plate_number : '—'}
              hint={summary.by_vehicle[0] ? formatMoney(summary.by_vehicle[0].total) : undefined}
              icon="car"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Category</CardTitle>
              </CardHeader>
              {summary.by_category.length === 0 ? (
                <EmptyState icon="chart" title="Nothing recorded yet" />
              ) : (
                <ul className="space-y-3">
                  {summary.by_category.map((c) => (
                    <li key={c.category}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-[13px] text-fg-muted">{humanize(c.category)}</span>
                        <span className="text-[13px] font-medium tabular-nums text-fg">
                          {formatMoney(c.total)}
                        </span>
                      </div>
                      <Bar value={c.total} max={maxCategory} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Vehicle</CardTitle>
              </CardHeader>
              {summary.by_vehicle.length === 0 ? (
                <EmptyState icon="car" title="Nothing against a vehicle yet" />
              ) : (
                <ul className="space-y-3">
                  {summary.by_vehicle.map((v) => (
                    <li key={v.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[13px] text-fg-muted">
                          {v.make} {v.model} <span className="text-fg-subtle">{v.plate_number}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-medium tabular-nums text-fg">
                          {formatMoney(v.total)}
                        </span>
                      </div>
                      <Bar value={v.total} max={maxVehicle} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="mb-4 mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <Tabs items={filters} value={category} onChange={setCategory} className="w-max sm:w-auto" />
      </div>

      <Card flush>
        {!expenses ? (
          <SkeletonTable />
        ) : expenses.length === 0 ? (
          <EmptyState icon="wallet" title="No expenses recorded" description="Record fuel, repairs, insurance and anything else the fleet costs." />
        ) : (
          <>
            <CardToolbar className="flex-wrap">
              <p className="text-[13px] text-fg-muted">
                {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
              </p>
              <p className="text-[13px] text-fg-muted">
                Shown total <span className="font-semibold tabular-nums text-fg">{formatMoney(listedTotal)}</span>
              </p>
            </CardToolbar>
            <DataTable columns={columns} rows={expenses} rowKey={(e) => e.id} />
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Record an expense"
        description="Anything the fleet costs — fuel, a garage bill, insurance, licensing."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-expense" isLoading={saving} disabled={!form.description || !form.amount}>
              Save
            </Button>
          </>
        }
      >
        <form id="add-expense" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
            <Input
              label="Amount (TZS)"
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="What was it for?"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Vehicle"
              hint="Leave blank for a company-wide cost like rent"
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            >
              <option value="">Company-wide</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} — {v.plate_number}
                </option>
              ))}
            </Select>
            <Input
              label="Date"
              type="date"
              value={form.spent_on}
              onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
            />
          </div>

          <Input
            label="Paid to"
            hint="Optional — garage, supplier, station"
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          />

          <Input
            label="Receipt"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          />
        </form>
      </Modal>
    </>
  );
}
