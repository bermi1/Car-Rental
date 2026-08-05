import React, { useEffect, useState } from 'react';
import { Button, Card, CardHeader, CardTitle, EmptyState, Input, Spinner } from '@rental/shared';
import type { SystemSettings } from '@rental/shared';
import { api } from '../../api/client';

interface SeasonalPricing {
  id: string;
  name: string;
  category: string | null;
  start_date: string;
  end_date: string;
  rate_multiplier: number;
}

export function Settings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [rate, setRate] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [seasonal, setSeasonal] = useState<SeasonalPricing[] | null>(null);
  const [seasonForm, setSeasonForm] = useState({ name: '', category: '', start_date: '', end_date: '', rate_multiplier: '1.2' });
  const [showSeasonForm, setShowSeasonForm] = useState(false);

  function load() {
    api.get<SystemSettings>('/settings').then((s) => {
      setSettings(s);
      setRate(String(s.usd_to_tzs_rate));
      setDefaultRate(String(s.default_daily_rate_tzs));
    });
    api.get<SeasonalPricing[]>('/settings/seasonal-pricing').then(setSeasonal);
  }
  useEffect(load, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/settings', { usd_to_tzs_rate: Number(rate), default_daily_rate_tzs: Number(defaultRate) });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSeason(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/settings/seasonal-pricing', {
      ...seasonForm,
      category: seasonForm.category || null,
      rate_multiplier: Number(seasonForm.rate_multiplier),
    });
    setSeasonForm({ name: '', category: '', start_date: '', end_date: '', rate_multiplier: '1.2' });
    setShowSeasonForm(false);
    load();
  }

  async function removeSeason(id: string) {
    await api.delete(`/settings/seasonal-pricing/${id}`);
    load();
  }

  if (!settings) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Pricing rules and exchange rate.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exchange Rate &amp; Default Pricing</CardTitle>
        </CardHeader>
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <Input
            label="USD to TZS Exchange Rate"
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <Input
            label="Default Daily Rate (TZS)"
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" isLoading={saving}>
              Save Settings
            </Button>
            {saved && <span className="text-sm text-status-activeFg">Saved.</span>}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seasonal Pricing Windows</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowSeasonForm((s) => !s)}>
            {showSeasonForm ? 'Cancel' : 'Add Window'}
          </Button>
        </CardHeader>

        {showSeasonForm && (
          <form onSubmit={handleAddSeason} className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-4 md:grid-cols-5">
            <Input label="Name" value={seasonForm.name} onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })} required />
            <Input label="Category (optional)" value={seasonForm.category} onChange={(e) => setSeasonForm({ ...seasonForm, category: e.target.value })} />
            <Input label="Start Date" type="date" value={seasonForm.start_date} onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })} required />
            <Input label="End Date" type="date" value={seasonForm.end_date} onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })} required />
            <Input
              label="Rate Multiplier"
              type="number"
              step="0.01"
              value={seasonForm.rate_multiplier}
              onChange={(e) => setSeasonForm({ ...seasonForm, rate_multiplier: e.target.value })}
              required
            />
            <div className="col-span-full">
              <Button type="submit">Save Window</Button>
            </div>
          </form>
        )}

        {!seasonal || seasonal.length === 0 ? (
          <EmptyState title="No seasonal pricing windows" description="Add a window to adjust rates for peak periods." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {seasonal.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{s.name}{s.category ? ` · ${s.category}` : ''}</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()} · ×{s.rate_multiplier}
                  </p>
                </div>
                <button onClick={() => removeSeason(s.id)} className="text-sm font-medium text-status-cancelledFg hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
