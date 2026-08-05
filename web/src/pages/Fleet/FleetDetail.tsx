import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  formatDate,
  formatMoney,
} from '@rental/shared';
import type { MaintenanceLog, Vehicle } from '@rental/shared';
import { api, ApiError, assetUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { BackLink } from '../../components/BackLink';
import { ErrorNotice } from '../../components/ErrorNotice';

const EMPTY_LOG = {
  service_type: '',
  mileage_at_service: '',
  next_service_due_mileage: '',
  date: '',
  notes: '',
};

export function FleetDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState(EMPTY_LOG);
  const [savingLog, setSavingLog] = useState(false);

  function load() {
    api.get<Vehicle>(`/vehicles/${id}`).then(setVehicle);
    api.get<MaintenanceLog[]>(`/vehicles/${id}/maintenance`).then(setLogs);
  }
  useEffect(load, [id]);

  async function changeStatus(status: string) {
    setError('');
    try {
      await api.put(`/vehicles/${id}`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the status.');
    }
  }

  async function uploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    Array.from(e.target.files).forEach((file) => formData.append('photos', file));
    try {
      await api.post(`/vehicles/${id}/photos`, formData);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload photos.');
    } finally {
      setUploading(false);
    }
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    setSavingLog(true);
    setError('');
    try {
      await api.post(`/vehicles/${id}/maintenance`, {
        ...logForm,
        mileage_at_service: Number(logForm.mileage_at_service),
        next_service_due_mileage: logForm.next_service_due_mileage
          ? Number(logForm.next_service_due_mileage)
          : null,
      });
      setLogForm(EMPTY_LOG);
      setShowLogForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the entry.');
    } finally {
      setSavingLog(false);
    }
  }

  if (!vehicle) return <Spinner />;

  return (
    <>
      <PageHeader
        back={<BackLink to="/fleet">Fleet</BackLink>}
        title={`${vehicle.make} ${vehicle.model}`}
        description={`${vehicle.plate_number} · ${vehicle.category}`}
        actions={
          isAdmin ? (
            <Select
              value={vehicle.status}
              onChange={(e) => changeStatus(e.target.value)}
              wrapperClassName="w-48"
              aria-label="Vehicle status"
            >
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="in_service">In Service</option>
              <option value="out_of_service">Out of Service</option>
            </Select>
          ) : (
            <StatusBadge status={vehicle.status} />
          )
        }
      />

      <ErrorNotice message={error} />

      <Card className="mt-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Field label="Status">
            <StatusBadge status={vehicle.status} />
          </Field>
          <Field label="Mileage">{vehicle.current_mileage.toLocaleString()} km</Field>
          <Field label="Daily Rate">{formatMoney(vehicle.daily_rate_tzs)}</Field>
          <Field label="Added">{formatDate(vehicle.created_at)}</Field>
        </dl>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          {isAdmin && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-accent hover:opacity-75">
              <Icon name="upload" size={14} />
              {uploading ? 'Uploading…' : 'Upload'}
              <input type="file" accept="image/*" multiple hidden onChange={uploadPhotos} disabled={uploading} />
            </label>
          )}
        </CardHeader>
        {vehicle.photos.length === 0 ? (
          <EmptyState icon="car" title="No photos yet" description="Upload photos for the fleet gallery." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {vehicle.photos.map((p, i) => (
              <a key={i} href={assetUrl(p)} target="_blank" rel="noreferrer" className="group relative">
                <img
                  src={assetUrl(p)}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="aspect-square w-full rounded-lg border border-line object-cover transition-opacity group-hover:opacity-85"
                />
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Maintenance Log</CardTitle>
            <p className="mt-0.5 text-[13px] text-fg-muted">Services carried out on this vehicle.</p>
          </div>
          <Button size="sm" variant="outline" icon="plus" onClick={() => setShowLogForm(true)}>
            Add Entry
          </Button>
        </CardHeader>

        {!logs ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <EmptyState icon="wrench" title="No maintenance recorded" description="Log services to track them here." />
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fg">{log.service_type}</p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    At {log.mileage_at_service.toLocaleString()} km
                    {log.next_service_due_mileage
                      ? ` · next due at ${log.next_service_due_mileage.toLocaleString()} km`
                      : ''}
                  </p>
                  {log.notes && <p className="mt-1 text-xs text-fg-muted">{log.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-fg-subtle">{formatDate(log.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={showLogForm}
        onClose={() => setShowLogForm(false)}
        title="Add maintenance entry"
        description={`${vehicle.make} ${vehicle.model} · ${vehicle.plate_number}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLogForm(false)}>
              Cancel
            </Button>
            <Button form="add-log" type="submit" isLoading={savingLog}>
              Save entry
            </Button>
          </>
        }
      >
        <form id="add-log" onSubmit={addLog} className="space-y-4">
          <Input
            label="Service Type"
            placeholder="Oil change, brake pads…"
            value={logForm.service_type}
            onChange={(e) => setLogForm({ ...logForm, service_type: e.target.value })}
            required
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Mileage at Service"
              type="number"
              min="0"
              value={logForm.mileage_at_service}
              onChange={(e) => setLogForm({ ...logForm, mileage_at_service: e.target.value })}
              required
            />
            <Input
              label="Next Due Mileage"
              type="number"
              min="0"
              value={logForm.next_service_due_mileage}
              onChange={(e) => setLogForm({ ...logForm, next_service_due_mileage: e.target.value })}
              hint="Optional"
            />
          </div>
          <Input
            label="Date"
            type="date"
            value={logForm.date}
            onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
            required
          />
          <Textarea
            label="Notes"
            value={logForm.notes}
            onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
          />
        </form>
      </Modal>
    </>
  );
}
