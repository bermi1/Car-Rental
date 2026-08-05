import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { EmptyState, Spinner } from '@rental/shared';
import { useAuth } from '../context/AuthContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  // Remember where they were headed so login can send them back.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
