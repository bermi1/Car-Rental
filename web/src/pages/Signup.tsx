import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Icon, Input } from '@rental/shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { ErrorNotice } from '../components/ErrorNotice';
import { LogoStacked } from '../components/Logo';
import { Splash } from '../components/Splash';

/**
 * Customer sign-up.
 *
 * Open to anyone — a customer does not need to be invited by a company to hold
 * an account. The phone number is the account: it is what they sign in with,
 * and it is what a company's desk already has written down when they walk in.
 */
export function Signup() {
  const { registerClient, user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const { language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sw = language === 'sw';

  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Splash />;
  if (user) return <Navigate to="/my-rentals" replace />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError(sw ? 'Nywila hazifanani.' : 'The two passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError(sw ? 'Nywila iwe na herufi 6 au zaidi.' : 'Choose a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await registerClient({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
      });
      // Someone who came here from a company's catalogue goes back to it —
      // they were part-way through renting a car, not signing up for its own
      // sake.
      const from = params.get('from');
      navigate(from && from.startsWith('/') ? from : '/my-rentals', { replace: true });
    } catch (err: any) {
      setError(err?.message || (sw ? 'Usajili umeshindikana.' : 'Could not create your account.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg">
            <Icon name="arrowLeft" size={15} />
            {sw ? 'Mwanzo' : 'Home'}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-surface-sunken p-0.5">
            {(['en', 'sw'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-label={code === 'en' ? 'English' : 'Kiswahili'}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition-all ${
                  language === code ? 'bg-surface text-fg shadow-xs' : 'text-fg-subtle hover:text-fg'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex justify-center">
            <LogoStacked size={64} />
          </div>

          <h1 className="text-center text-xl font-semibold tracking-[-0.02em] text-fg">
            {sw ? 'Fungua akaunti' : 'Create your account'}
          </h1>
          <p className="mt-1.5 text-center text-sm text-fg-muted">
            {sw
              ? 'Kodisha gari, pakia nyaraka zako na uone mikataba yako.'
              : 'Book a car, upload your documents and read your agreements.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <Input
              label={sw ? 'Jina kamili' : 'Full name'}
              autoComplete="name"
              value={form.full_name}
              onChange={set('full_name')}
              required
              autoFocus
            />
            <Input
              label={sw ? 'Namba ya simu' : 'Phone number'}
              autoComplete="tel"
              inputMode="tel"
              placeholder="0712 345 678"
              hint={sw ? 'Utaingia kwa namba hii.' : 'This is what you sign in with.'}
              value={form.phone}
              onChange={set('phone')}
              required
            />
            <Input
              label={sw ? 'Barua pepe (si lazima)' : 'Email (optional)'}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={form.email}
              onChange={set('email')}
            />
            <Input
              label={sw ? 'Nywila' : 'Password'}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              required
            />
            <Input
              label={sw ? 'Thibitisha nywila' : 'Confirm password'}
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
              required
            />

            <ErrorNotice message={error} />

            <Button type="submit" size="lg" className="w-full" isLoading={submitting}>
              {sw ? 'Fungua akaunti' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-fg-muted">
            {sw ? 'Tayari una akaunti?' : 'Already have an account?'}{' '}
            <Link to="/login" className="font-medium text-accent hover:opacity-75">
              {sw ? 'Ingia' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
