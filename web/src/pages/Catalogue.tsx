import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Icon, Spinner, formatMoney, humanize } from '@rental/shared';
import { api, ApiError, assetUrl } from '../api/client';
import { useI18n } from '../i18n';
import { useTheme } from '../context/ThemeContext';
import { Logo } from '../components/Logo';

/**
 * A company's public shop window, at /c/<slug>.
 *
 * This is where a QR code lands. No sign-in, no account, no mention of any
 * other company — the link fixes which company the visitor is dealing with,
 * and everything on the page belongs to that one.
 */

interface CatalogueVehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  year: number | null;
  seats: number | null;
  transmission: string | null;
  fuel_type: string | null;
  description: string | null;
  condition_note: string | null;
  daily_rate_tzs: number;
  photos: string[];
  status: string;
}

interface CatalogueResponse {
  company: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    about: string | null;
    region: string | null;
    contact_phone: string | null;
    whatsapp_phone: string | null;
    logo_path: string | null;
  };
  vehicles: CatalogueVehicle[];
  settings: { deposit_percent: number; payment_instructions: string | null } | null;
}

function Spec({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
      <Icon name={icon as any} size={12} />
      {value}
    </span>
  );
}

export function Catalogue() {
  const { slug = '' } = useParams();
  const { language, setLanguage } = useI18n();
  const { theme, toggle } = useTheme();
  const sw = language === 'sw';

  const [data, setData] = useState<CatalogueResponse | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CatalogueVehicle | null>(null);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [quote, setQuote] = useState<{ days: number; amount: number } | null>(null);

  useEffect(() => {
    api
      .get<CatalogueResponse>(`/catalogue/${slug}`)
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 404
            ? sw
              ? 'Kampuni haijapatikana.'
              : "We couldn't find that company."
            : sw
              ? 'Imeshindikana kupakia.'
              : 'Could not load the catalogue.'
        )
      );
  }, [slug, sw]);

  // Re-price whenever the visitor changes a date, so the number is never stale.
  useEffect(() => {
    if (!selected || !dates.start || !dates.end) {
      setQuote(null);
      return;
    }
    api
      .post<{ days: number; amount: number }>(`/catalogue/${slug}/quote`, {
        vehicle_id: selected.id,
        start_date: dates.start,
        end_date: dates.end,
      })
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [selected, dates, slug]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <Icon name="alert" size={28} className="text-fg-subtle" />
        <p className="text-sm text-fg-muted">{error}</p>
      </div>
    );
  }
  if (!data) return <Spinner />;

  const { company, vehicles } = data;
  const available = vehicles.filter((v) => v.status === 'available');

  function bookVia(vehicle: CatalogueVehicle) {
    const phone = (company.whatsapp_phone || company.contact_phone || '').replace(/[^0-9]/g, '');
    const total = quote ? ` — ${formatMoney(quote.amount)} for ${quote.days} day(s)` : '';
    const text = encodeURIComponent(
      sw
        ? `Habari ${company.name}, ningependa kukodisha ${vehicle.make} ${vehicle.model} kuanzia ${dates.start} hadi ${dates.end}${total}.`
        : `Hello ${company.name}, I'd like to book the ${vehicle.make} ${vehicle.model} from ${dates.start} to ${dates.end}${total}.`
    );
    if (phone) window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener');
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {company.logo_path ? (
              <img src={assetUrl(company.logo_path)} alt="" className="h-8 w-8 rounded-lg object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <Logo size={30} />
            )}
            <span className="truncate text-sm font-semibold text-fg">{company.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-surface-sunken p-0.5">
              {(['en', 'sw'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition-all ${
                    language === code ? 'bg-surface text-fg shadow-xs' : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-6 pt-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
          {company.tagline || (sw ? 'Kodisha gari kwa urahisi' : 'Rent a car, simply')}
        </h1>
        {company.about && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{company.about}</p>}
        <p className="mt-3 text-[13px] text-fg-subtle">
          {company.region && <>{company.region} · </>}
          {available.length} {sw ? 'magari yanapatikana' : available.length === 1 ? 'car available' : 'cars available'}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        {vehicles.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-fg-muted">
            {sw ? 'Hakuna magari kwa sasa.' : 'No cars listed at the moment.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => {
              const isOpen = selected?.id === v.id;
              const free = v.status === 'available';
              return (
                <div
                  key={v.id}
                  className={`overflow-hidden rounded-xl border bg-surface shadow-xs transition-all ${
                    isOpen ? 'border-accent ring-4 ring-accent/10' : 'border-line'
                  }`}
                >
                  {v.photos?.[0] ? (
                    <img src={assetUrl(v.photos[0])} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-surface-sunken">
                      <Icon name="car" size={28} className="text-fg-subtle" />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-fg">
                        {v.make} {v.model}
                        {v.year && <span className="ml-1 font-normal text-fg-subtle">{v.year}</span>}
                      </h3>
                      {!free && (
                        <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-warning-fg">
                          {sw ? 'Imechukuliwa' : humanize(v.status)}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      <Spec icon="car" value={humanize(v.category)} />
                      {v.seats && <Spec icon="users" value={`${v.seats}`} />}
                      {v.transmission && <Spec icon="settings" value={v.transmission} />}
                      {v.fuel_type && <Spec icon="activity" value={v.fuel_type} />}
                    </div>

                    {v.description && (
                      <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{v.description}</p>
                    )}
                    {v.condition_note && (
                      <p className="mt-1.5 text-xs text-fg-subtle">
                        {sw ? 'Hali: ' : 'Condition: '}
                        {v.condition_note}
                      </p>
                    )}

                    <p className="mt-3 text-lg font-semibold tabular-nums text-fg">
                      {formatMoney(v.daily_rate_tzs)}
                      <span className="ml-1 text-xs font-normal text-fg-subtle">
                        / {sw ? 'siku' : 'day'}
                      </span>
                    </p>

                    <Button
                      className="mt-3 w-full"
                      variant={isOpen ? 'outline' : 'primary'}
                      disabled={!free}
                      onClick={() => {
                        setSelected(isOpen ? null : v);
                        setQuote(null);
                      }}
                    >
                      {!free
                        ? sw ? 'Haipatikani' : 'Not available'
                        : isOpen
                          ? sw ? 'Funga' : 'Close'
                          : sw ? 'Angalia bei' : 'Check price'}
                    </Button>

                    {isOpen && (
                      <div className="mt-4 space-y-3 border-t border-line pt-4">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-fg">
                              {sw ? 'Kuanzia' : 'From'}
                            </span>
                            <input
                              type="date"
                              value={dates.start}
                              onChange={(e) => setDates({ ...dates, start: e.target.value })}
                              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-fg">
                              {sw ? 'Hadi' : 'To'}
                            </span>
                            <input
                              type="date"
                              value={dates.end}
                              min={dates.start || undefined}
                              onChange={(e) => setDates({ ...dates, end: e.target.value })}
                              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                            />
                          </label>
                        </div>

                        {quote && (
                          <div className="rounded-lg bg-surface-sunken p-3">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[13px] text-fg-muted">
                                {quote.days} {sw ? 'siku' : quote.days === 1 ? 'day' : 'days'}
                              </span>
                              <span className="text-lg font-semibold tabular-nums text-fg">
                                {formatMoney(quote.amount)}
                              </span>
                            </div>
                          </div>
                        )}

                        <Button
                          className="w-full"
                          disabled={!quote}
                          iconRight="chevronRight"
                          onClick={() => bookVia(v)}
                        >
                          {sw ? 'Omba gari hili' : 'Request this car'}
                        </Button>
                        <p className="text-center text-[11px] leading-relaxed text-fg-subtle">
                          {sw
                            ? 'Utatakiwa kupakia kitambulisho na leseni kabla ya kukabidhiwa.'
                            : "You'll be asked for your ID and driving license before pickup."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
          <p className="text-sm font-medium text-fg">{company.name}</p>
          {company.contact_phone && <p className="text-[13px] text-fg-muted">{company.contact_phone}</p>}
          <p className="mt-2 text-xs text-fg-subtle">Powered by Bermi Rentals</p>
        </div>
      </footer>
    </div>
  );
}
