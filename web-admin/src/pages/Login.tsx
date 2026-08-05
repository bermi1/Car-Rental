import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '@rental/shared';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@rental.co.tz');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold text-neutral-900">Rental Admin</p>
          <p className="mt-1 text-sm text-neutral-500">Sign in to manage your fleet</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-status-cancelledFg">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
