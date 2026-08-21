import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Spinner,
  formatDate,
  formatDateTime,
} from '@rental/shared';
import type { SystemSettings } from '@rental/shared';
import { api, ApiError } from '../api/client';
import { ErrorNotice } from '../components/ErrorNotice';
import { CatalogueShare } from '../components/CatalogueShare';
import { BusinessProfile } from '../components/BusinessProfile';
import { TermsEditor } from '../components/TermsEditor';
import { useAuth } from '../context/AuthContext';

interface SeasonalPricing {
  id: string;
  name: string;
  category: string | null;
  start_date: string;
  end_date: string;
  rate_multiplier: number;
}

const EMPTY_SEASON = { name: '', category: '', start_date: '', end_date: '', rate_multiplier: '1.2' };

export function Settings() {
  const { company } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [rate, setRate] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [fuelFee, setFuelFee] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [seasonal, setSeasonal] = useState<SeasonalPricing[] | null>(null);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [seasonForm, setSeasonForm] = useState(EMPTY_SEASON);
  const [savingSeason, setSavingSeason] = useState(false);

  function load() {
    api.get<SystemSettings>('/settings').then((s) => {
      setSettings(s);
      setRate(String(s.usd_to_tzs_rate));
      setDefaultRate(String(s.default_daily_rate_tzs));
      setLateFee(String(s.late_return_fee_per_day_tzs ?? 0));
      setFuelFee(String(s.fuel_shortfall_fee_tzs ?? 0));
      setDepositPercent(String(s.deposit_percent ?? 0));
    });
    api.get<SeasonalPricing[]>('/settings/seasonal-pricing').then(setSeasonal);
  }
  useEffect(load, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.put('/settings', {
        usd_to_tzs_rate: Number(rate),
        default_daily_rate_tzs: Number(defaultRate),
        late_return_fee_per_day_tzs: Number(lateFee),
        fuel_shortfall_fee_tzs: Number(fuelFee),
        deposit_percent: Number(depositPercent),
      });
      setSaved(true);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function addSeason(e: React.FormEvent) {
    e.preventDefault();
    setSavingSeason(true);
    setError('');
    try {
      await api.post('/settings/seasonal-pricing', {
        ...seasonForm,
        category: seasonForm.category.trim() || null,
        rate_multiplier: Number(seasonForm.rate_multiplier),
      });
      setSeasonForm(EMPTY_SEASON);
      setShowSeasonForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the pricing window.');
    } finally {
      setSavingSeason(false);
    }
  }

  async function removeSeason(id: string) {
    setError('');
    try {
      await api.delete(`/settings/seasonal-pricing/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the window.');
    }
  }

  if (!settings) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your business details, pricing rules, contract terms and public catalogue." />

      <ErrorNotice message={error} />

      {company && (
        <div className="mb-6">
          <CatalogueShare slug={company.slug} companyName={company.name} />
        </div>
      )}

      <div className="mb-6">
        <BusinessProfile />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Exchange Rate &amp; Default Pricing</CardTitle>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Applied when a booking is quoted in USD or a vehicle has no rate of its own.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={saveSettings} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="USD to TZS Rate"
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value);
                setSaved(false);
              }}
              hint="1 USD buys this many TZS"
            />
            <Input
              label="Default Daily Rate (TZS)"
              type="number"
              min="0"
              value={defaultRate}
              onChange={(e) => {
                setDefaultRate(e.target.value);
                setSaved(false);
              }}
            />
            <Input
              label="Late Return Penalty (TZS per day)"
              type="number"
              min="0"
              value={lateFee}
              onChange={(e) => {
                setLateFee(e.target.value);
                setSaved(false);
              }}
              hint="Charged for every day a car is kept past its return date."
            />
            <Input
              label="Fuel Shortfall Fee (TZS)"
              type="number"
              min="0"
              value={fuelFee}
              onChange={(e) => {
                setFuelFee(e.target.value);
                setSaved(false);
              }}
              hint="Charged when a car comes back below the fuel it left on."
            />
            <Input
              label="Deposit (% of the quote)"
              type="number"
              min="0"
              max="100"
              value={depositPercent}
              onChange={(e) => {
                setDepositPercent(e.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={saving}>
              Save Settings
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-success-fg">
                <Icon name="check" size={15} />
                Saved
              </span>
            )}
          </div>
        </form>

        <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">
          Last updated {formatDateTime(settings.updated_at)}
        </p>
      </Card>

      <div className="mt-6">
        <TermsEditor />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Seasonal Pricing</CardTitle>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Multiply rates during peak periods. Optionally limit a window to one category.
            </p>
          </div>
          <Button size="sm" variant="outline" icon="plus" onClick={() => setShowSeasonForm(true)}>
            Add Window
          </Button>
        </CardHeader>

        {!seasonal ? (
          <Spinner />
        ) : seasonal.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No seasonal pricing"
            description="Rates stay flat all year until you add a window."
          />
        ) : (
          <ul className="divide-y divide-line">
            {seasonal.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-fg">
                    {s.name}
                    {s.category && <span className="ml-1.5 font-normal text-fg-subtle">{s.category}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {formatDate(s.start_date)} – {formatDate(s.end_date)} · ×{s.rate_multiplier}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeSeason(s.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={showSeasonForm}
        onClose={() => setShowSeasonForm(false)}
        title="Add pricing window"
        description="Rates inside this window are multiplied by the factor you set."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSeasonForm(false)}>
              Cancel
            </Button>
            <Button form="add-season" type="submit" isLoading={savingSeason}>
              Save window
            </Button>
          </>
        }
      >
        <form id="add-season" onSubmit={addSeason} className="space-y-4">
          <Input
            label="Name"
            placeholder="December peak"
            value={seasonForm.name}
            onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
            required
            autoFocus
          />
          <Input
            label="Category"
            placeholder="Leave blank to apply to all vehicles"
            value={seasonForm.category}
            onChange={(e) => setSeasonForm({ ...seasonForm, category: e.target.value })}
            hint="Optional"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start Date"
              type="date"
              value={seasonForm.start_date}
              onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={seasonForm.end_date}
              onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
              min={seasonForm.start_date || undefined}
              required
            />
          </div>
          <Input
            label="Rate Multiplier"
            type="number"
            step="0.01"
            min="0"
            value={seasonForm.rate_multiplier}
            onChange={(e) => setSeasonForm({ ...seasonForm, rate_multiplier: e.target.value })}
            required
            hint="1.2 charges 20% more than the base rate"
          />
        </form>
      </Modal>
    </div>
  );
}
