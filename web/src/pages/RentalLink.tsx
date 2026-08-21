import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Icon, Input, Spinner, formatDate, formatMoney, humanize } from '@rental/shared';
import { api, ApiError, assetUrl } from '../api/client';
import type { Bill } from '../types/bill';
import { useTheme } from '../context/ThemeContext';

/**
 * The customer's own rental, at /r/<token>.
 *
 * This is the link staff send over WhatsApp. It opens straight onto the car
 * that was booked — no account, no menu, nothing belonging to anybody else.
 * The token in the URL is the only thing that unlocks it, and it unlocks
 * exactly one booking.
 *
 * The agreement is not a checkbox next to a link. The customer scrolls the
 * whole contract, and only once they have reached the end of it can they
 * accept the terms and sign, because consent to something unread is not
 * consent.
 */

interface SharedRental {
  booking: {
    id: string;
    start_date: string;
    end_date: string;
    status: string;
    pickup_region: string;
    dropoff_region: string;
    rental_type: string;
    quoted_amount: number;
    quoted_currency: string;
    client_name: string;
    make: string;
    model: string;
    year: number | null;
    photos: string[] | null;
    category: string;
    company_name: string;
    contact_phone: string | null;
    logo_path: string | null;
  };
  bill: Bill | null;
  contract: {
    id: string;
    reference: string | null;
    signed: boolean;
    signed_name: string | null;
    signed_at: string | null;
    terms_accepted: boolean;
  } | null;
  contract_body: string | null;
}

export function RentalLink() {
  const { token = '' } = useParams();
  const { theme, toggle } = useTheme();

  const [data, setData] = useState<SharedRental | null>(null);
  const [error, setError] = useState('');
  const [readToEnd, setReadToEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [signError, setSignError] = useState('');

  function load() {
    api
      .get<SharedRental>(`/contracts/shared/${token}`)
      .then((rental) => {
        setData(rental);
        setSignature((current) => current || rental.booking.client_name);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 404
            ? 'That link is not valid. Ask the office to send you a new one.'
            : 'Could not open your rental. Please try again.'
        )
      );
  }

  useEffect(load, [token]);

  const signed = data?.contract?.signed ?? false;

  // A short agreement can fit on screen with nothing to scroll. Treating that
  // as "not read" would leave the customer with a button they can never press.
  function onContractScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true);
  }

  const contractRef = React.useCallback((el: HTMLDivElement | null) => {
    if (el && el.scrollHeight <= el.clientHeight + 24) setReadToEnd(true);
  }, []);

  async function sign() {
    setSignError('');
    setBusy(true);
    try {
      await api.post(`/contracts/shared/${token}/sign`, {
        accept_terms: accepted,
        signed_name: signature.trim(),
      });
      load();
    } catch (err) {
      setSignError(err instanceof ApiError ? err.message : 'Could not record your signature.');
    } finally {
      setBusy(false);
    }
  }

  const whatsapp = useMemo(() => {
    const phone = (data?.booking.contact_phone || '').replace(/[^0-9]/g, '');
    return phone ? `https://wa.me/${phone}` : null;
  }, [data]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <Icon name="alert" size={28} className="text-fg-subtle" />
        <p className="max-w-sm text-sm text-fg-muted">{error}</p>
      </div>
    );
  }
  if (!data) return <Spinner />;

  const { booking, bill, contract, contract_body } = data;
  const car = `${booking.make} ${booking.model}${booking.year ? ` (${booking.year})` : ''}`;

  return (
    <div className="min-h-screen bg-bg pb-16">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {booking.logo_path ? (
              <img src={assetUrl(booking.logo_path)} alt="" className="h-8 w-8 rounded-lg object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-fg">
                {booking.company_name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-semibold text-fg">{booking.company_name}</span>
          </div>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <p className="text-[13px] font-medium uppercase tracking-wider text-fg-subtle">Your rental</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">{car}</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {booking.client_name} · {formatDate(booking.start_date)} → {formatDate(booking.end_date)}
        </p>

        {booking.photos?.[0] && (
          <img
            src={assetUrl(booking.photos[0])}
            alt=""
            className="mt-5 h-52 w-full rounded-xl border border-line object-cover sm:h-72"
          />
        )}

        <Card className="mt-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Pick-up</dt>
              <dd className="mt-1 text-sm font-medium text-fg">{booking.pickup_region}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Drop-off</dt>
              <dd className="mt-1 text-sm font-medium text-fg">{booking.dropoff_region}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Rental</dt>
              <dd className="mt-1 text-sm font-medium text-fg">{humanize(booking.rental_type)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Status</dt>
              <dd className="mt-1 text-sm font-medium text-fg">{humanize(booking.status)}</dd>
            </div>
          </dl>
        </Card>

        {bill && (
          <Card className="mt-5">
            <h2 className="mb-3 text-base font-semibold text-fg">What you pay</h2>
            <ul className="divide-y divide-line">
              {bill.lines.map((line, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-fg">{line.label}</p>
                    {line.detail && <p className="text-xs text-fg-subtle">{line.detail}</p>}
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                      line.amount < 0 ? 'text-success' : 'text-fg'
                    }`}
                  >
                    {formatMoney(line.amount, bill.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              <Row label="Total" value={formatMoney(bill.subtotal, bill.currency)} />
              <Row label="Already paid" value={formatMoney(bill.paid, bill.currency)} />
              <div className="flex items-baseline justify-between gap-4 pt-1">
                <span className="text-sm font-semibold text-fg">Balance due</span>
                <span className="text-lg font-semibold tabular-nums text-fg">
                  {formatMoney(bill.balance, bill.currency)}
                </span>
              </div>
            </div>
            {bill.late_days > 0 && (
              <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-fg">
                This car is {bill.late_days} day{bill.late_days === 1 ? '' : 's'} past its return date. The late
                charge grows each day until it is returned.
              </p>
            )}
          </Card>
        )}

        <Card className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-fg">Rental agreement</h2>
            {contract?.reference && (
              <span className="font-mono text-xs text-fg-subtle">{contract.reference}</span>
            )}
          </div>

          {signed ? (
            <div className="rounded-lg border border-success/30 bg-success-soft px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-success-fg">
                <Icon name="check" size={16} />
                Signed by {contract?.signed_name}
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {contract?.signed_at && `Accepted on ${formatDate(contract.signed_at)}`}
              </p>
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-fg-muted">
              Read the whole agreement below. The Accept button turns on when you reach the end.
            </p>
          )}

          <div
            ref={contractRef}
            onScroll={onContractScroll}
            className="mt-3 max-h-[26rem] overflow-y-auto rounded-lg border border-line bg-surface-sunken/50 px-4 py-4"
          >
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-fg sm:text-xs">
              {contract_body || 'The agreement is being prepared. Please check back shortly.'}
            </pre>
          </div>

          {!signed && contract_body && (
            <div className="mt-4 space-y-4">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  readToEnd ? 'border-line bg-surface' : 'border-line bg-surface-sunken/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={!readToEnd}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-[13px] leading-relaxed text-fg">
                  I have read the agreement above in full, I understand it, and I accept the terms and conditions
                  of this rental.
                  {!readToEnd && (
                    <span className="mt-1 block text-xs text-fg-subtle">Scroll to the end of the agreement first.</span>
                  )}
                </span>
              </label>

              <Input
                label="Sign by typing your full name"
                hint="Typing your name here is your signature on this agreement."
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />

              {signature.trim().length >= 3 && (
                <div className="rounded-lg border border-dashed border-line bg-surface-sunken/50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wider text-fg-subtle">Signature</p>
                  <p className="mt-1 font-serif text-2xl italic text-fg">{signature.trim()}</p>
                </div>
              )}

              {signError && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-fg">{signError}</p>
              )}

              <Button
                icon="check"
                onClick={sign}
                isLoading={busy}
                disabled={!accepted || signature.trim().length < 3}
                className="w-full sm:w-auto"
              >
                Accept and sign
              </Button>
            </div>
          )}
        </Card>

        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-accent hover:text-accent"
          >
            <Icon name="external" size={16} />
            Message {booking.company_name}
          </a>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-fg-muted">{label}</span>
      <span className="text-[13px] font-medium tabular-nums text-fg">{value}</span>
    </div>
  );
}
