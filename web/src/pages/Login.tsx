import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Icon, Input, Spinner } from '@rental/shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ErrorNotice } from '../components/ErrorNotice';

export function Login() {
  const { login, user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }
  if (user) return <Navigate to={(location.state as any)?.from || '/'} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate((location.state as any)?.from || '/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      {/* Soft accent wash behind the card, kept subtle so it never fights the form. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/10 blur-3xl"
      />

      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="absolute right-4 top-4 rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>

      <div className="relative w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
            <Icon name="car" size={22} />
          </span>
          <h1 className="text-xl font-semibold text-fg">Rental Console</h1>
          <p className="mt-1 text-sm text-fg-muted">Sign in to manage fleet and bookings</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-md"
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@rental.co.tz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <ErrorNotice message={error} />
          <Button type="submit" size="lg" className="w-full" isLoading={submitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          Admin and staff sign in here — your role decides what you see.
        </p>
      </div>
    </div>
  );
}
