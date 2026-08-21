import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, Icon, Spinner, StatusBadge, formatDate, formatMoney } from '@rental/shared';
import { api, assetUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Logo } from '../components/Logo';

/**
 * Where a customer lands after signing in: their own cars, nothing else.
 *
 * A rental in progress is the reason they signed in, so it sits at the top and
 * opens straight onto the agreement — the same page the shared link opens, so
 * a customer who arrived by link and one who signed in see the same thing.
 */

interface MyRental {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  pickup_region: string;
  dropoff_region: string;
  quoted_amount: number;
  quoted_currency: string;
  share_token: string;
  make: string;
  model: string;
  year: number | null;
  photos: string[] | null;
  company_name: string;
  logo_path: string | null;
}

/**
 * A rental is finished only when it has been completed or cancelled.
 *
 * Written as the two endings rather than a list of live states: a status added
 * later would otherwise silently file a live rental under "past".
 */
const FINISHED_STATUSES = ['completed', 'cancelled'];

export function MyRentals() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [rentals, setRentals] = useState<MyRental[] | null>(null);

  useEffect(() => {
    api.get<MyRental[]>('/bookings/mine').then(setRentals).catch(() => setRentals([]));
  }, []);

  if (!rentals) return <Spinner />;

  const current = rentals.filter((r) => !FINISHED_STATUSES.includes(r.status));
  const past = rentals.filter((r) => FINISHED_STATUSES.includes(r.status));

  return (
    <div className="min-h-screen bg-bg pb-16">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
            <Button variant="ghost" icon="logout" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Your rentals'}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {current.length > 0
            ? 'Open a rental to read your agreement and see what you owe.'
            : 'Rentals you book appear here.'}
        </p>

        {rentals.length === 0 ? (
          <Card className="mt-6">
            <EmptyState
              icon="car"
              title="No rentals yet"
              description="When a company books a car for you, or you book one yourself, it shows up here."
            />
          </Card>
        ) : (
          <>
            {current.length > 0 && (
              <section className="mt-6 space-y-4">
                {current.map((rental) => (
                  <RentalCard key={rental.id} rental={rental} highlight />
                ))}
              </section>
            )}

            {past.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-subtle">Past rentals</h2>
                <div className="space-y-4">
                  {past.map((rental) => (
                    <RentalCard key={rental.id} rental={rental} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function RentalCard({ rental, highlight }: { rental: MyRental; highlight?: boolean }) {
  const car = `${rental.make} ${rental.model}${rental.year ? ` (${rental.year})` : ''}`;

  return (
    <Link
      to={`/r/${rental.share_token}`}
      className={`block overflow-hidden rounded-xl border bg-surface shadow-xs transition-all hover:border-accent ${
        highlight ? 'border-accent/40' : 'border-line'
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        {rental.photos?.[0] ? (
          <img src={assetUrl(rental.photos[0])} alt="" className="h-40 w-full object-cover sm:h-auto sm:w-44" />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-surface-sunken sm:h-auto sm:w-44">
            <Icon name="car" size={26} className="text-fg-subtle" />
          </div>
        )}

        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-fg">{car}</p>
              <p className="mt-0.5 truncate text-[13px] text-fg-muted">{rental.company_name}</p>
            </div>
            <StatusBadge status={rental.status} />
          </div>

          <p className="mt-3 text-[13px] text-fg-muted">
            {formatDate(rental.start_date)} → {formatDate(rental.end_date)}
          </p>
          <p className="text-[13px] text-fg-subtle">
            {rental.pickup_region} → {rental.dropoff_region}
          </p>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm font-semibold tabular-nums text-fg">
              {formatMoney(rental.quoted_amount, rental.quoted_currency)}
            </span>
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">
              Open
              <Icon name="chevronRight" size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
