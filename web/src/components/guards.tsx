import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { EmptyState } from '@rental/shared';
import { Splash } from './Splash';
import { useAuth } from '../context/AuthContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;
  // Remember where they were headed so login can send them back.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/**
 * Wraps the staff console.
 *
 * A customer holds a real account, and nothing stops them typing /fleet into
 * the address bar. They are sent to their own rentals rather than shown an
 * error, because the console was never theirs to reach.
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { isClient } = useAuth();
  if (isClient) return <Navigate to="/my-rentals" replace />;
  return <>{children}</>;
}

/** Wraps routes that only admins may open. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <EmptyState
        icon="shield"
        title="Admin access required"
        description="This section is limited to admin accounts. Ask an administrator if you need access."
      />
    );
  }
  return <>{children}</>;
}

/** Wraps routes that manage the platform itself, above any one company. */
export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon="shield"
        title="Platform access required"
        description="Managing companies is limited to the platform operator."
      />
    );
  }
  return <>{children}</>;
}
