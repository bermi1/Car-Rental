import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Icon, Input } from '@rental/shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { ErrorNotice } from '../components/ErrorNotice';
import { LogoStacked } from '../components/Logo';
import { Splash } from '../components/Splash';

export function Login() {
  const { login, user, loading, homePath } = useAuth();
  const { theme, toggle } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Splash />;
  if (user) return <Navigate to={(location.state as any)?.from || homePath} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate((location.state as any)?.from || homePath, { replace: true });
    } catch (err: any) {
      // Surface what the server actually said — "Invalid credentials" and
      // "This account is not linked to a company" need different fixes, and a
      // single generic message sends people hunting in the wrong place.
      setError(err?.message || t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const sw = language === 'sw';

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      {/* Brand panel — collapses to a slim header on a phone */}
      <div className="relative hidden overflow-hidden bg-accent lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl"
        />

        <Link to="/" className="relative flex items-center gap-2.5 text-white">
          <Icon name="arrowLeft" size={16} />
          <span className="text-[13px] font-medium">
            {sw ? 'Rudi mwanzo' : 'Back to site'}
          </span>
        </Link>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-semibold leading-[1.2] tracking-[-0.02em] text-white">
            {sw
              ? 'Endesha biashara yako ya magari bila majedwali.'
              : 'Run your rental business without the spreadsheets.'}
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/80">
            {sw
              ? 'Magari, ukodishaji, nyaraka, malipo na faini — vyote mahali pamoja.'
              : 'Fleet, bookings, documents, payments and penalties — all in one place.'}
          </p>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} Bermi Rentals System · Dar es Salaam
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="lg:invisible">
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
          <div className="w-full max-w-[380px]">
            <div className="mb-8 flex justify-center">
              <LogoStacked size={64} />
            </div>

            <h1 className="text-center text-xl font-semibold tracking-[-0.02em] text-fg">
              {sw ? 'Karibu tena' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-center text-sm text-fg-muted">{t('login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <Input
                label={t('login.email')}
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@company.co.tz or 0712 345 678"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Input
                label={t('login.password')}
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <ErrorNotice message={error} />

              <Button type="submit" size="lg" className="w-full" isLoading={submitting}>
                {t('login.submit')}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-fg-muted">
              {sw ? 'Wewe ni mteja mpya?' : 'Renting a car for the first time?'}{' '}
              <Link to="/signup" className="font-medium text-accent hover:opacity-75">
                {sw ? 'Fungua akaunti' : 'Create an account'}
              </Link>
            </p>

            <p className="mt-4 text-center text-xs leading-relaxed text-fg-subtle">{t('login.hint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
