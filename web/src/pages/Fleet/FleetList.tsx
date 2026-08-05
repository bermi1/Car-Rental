import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardToolbar,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  formatMoney,
} from '@rental/shared';
import type { Vehicle } from '@rental/shared';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ErrorNotice } from '../../components/ErrorNotice';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'booked', label: 'Booked' },
  { value: 'in_service', label: 'In Service' },
  { value: 'out_of_service', label: 'Out of Service' },
];

const EMPTY_FORM = { make: '', model: '', plate_number: '', category: '', daily_rate_tzs: '' };

export function FleetList() {
  const { isAdmin } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setVehicles(null);
    api.get<Vehicle[]>(`/vehicles${status ? `?status=${status}` : ''}`).then(setVehicles);
  }
  useEffect(load, [status]);

  const visible = useMemo(() => {
    if (!vehicles) return null;
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.make, v.model, v.plate_number, v.category].some((f) => String(f).toLowerCase().includes(q))
    );
  }, [vehicles, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/vehicles', { ...form, daily_rate_tzs: Number(form.daily_rate_tzs) });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the vehicle.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Fleet"
        description="Vehicles, availability and service status."
        actions={
          isAdmin && (
            <Button icon="plus" onClick={() => setShowForm(true)}>
              Add Vehicle
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={FILTERS} value={status} onChange={setStatus} />
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search make, model, plate…"
          wrapperClassName="w-full sm:w-72"
        />
      </div>

      <Card flush>
        {!visible ? (
          <SkeletonTable />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="car"
            title={search ? 'No matching vehicles' : 'No vehicles yet'}
            description={search ? 'Try a different search term.' : 'Add your first vehicle to get started.'}
            action={
              isAdmin && !search ? (
                <Button icon="plus" onClick={() => setShowForm(true)}>
                  Add Vehicle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <CardToolbar>
              <p className="text-[13px] text-fg-muted">
                {visible.length} vehicle{visible.length === 1 ? '' : 's'}
              </p>
            </CardToolbar>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Vehicle</TH>
                  <TH>Plate</TH>
                  <TH>Category</TH>
                  <TH numeric>Mileage</TH>
                  <TH numeric>Daily Rate</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((v) => (
                  <TR key={v.id}>
                    <TD>
                      <Link
                        to={`/fleet/${v.id}`}
                        className="font-medium text-fg transition-colors hover:text-accent"
                      >
                        {v.make} {v.model}
                      </Link>
                    </TD>
                    <TD>{v.plate_number}</TD>
                    <TD>{v.category}</TD>
                    <TD numeric>{v.current_mileage.toLocaleString()} km</TD>
                    <TD numeric className="font-medium text-fg">
                      {formatMoney(v.daily_rate_tzs)}
                    </TD>
                    <TD>
                      <StatusBadge status={v.status} />
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
        title="Add vehicle"
        description="Register a new vehicle in the fleet."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button form="add-vehicle" type="submit" isLoading={saving}>
              Save vehicle
            </Button>
          </>
        }
      >
        <form id="add-vehicle" onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Make"
              placeholder="Toyota"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              required
              autoFocus
            />
            <Input
              label="Model"
              placeholder="Land Cruiser"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Plate Number"
              placeholder="T123 ABC"
              value={form.plate_number}
              onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
              required
            />
            <Input
              label="Category"
              placeholder="SUV"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            />
          </div>
          <Input
            label="Daily Rate (TZS)"
            type="number"
            min="0"
            placeholder="150000"
            value={form.daily_rate_tzs}
            onChange={(e) => setForm({ ...form, daily_rate_tzs: e.target.value })}
            required
          />
          <ErrorNotice message={error} />
        </form>
      </Modal>
    </>
  );
}
