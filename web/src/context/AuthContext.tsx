import React, { createContext, useContext, useEffect, useState } from 'react';
import type { StaffRole, StaffUser } from '@rental/shared';
import { api, setToken, clearToken, getToken, setActiveCompany, getActiveCompany } from '../api/client';

export interface Company {
  id: string;
  name: string;
  slug: string;
}

/**
 * Whoever is signed in — staff or customer.
 *
 * Both kinds of account are real accounts against the same API, so the app
 * carries one shape for both and lets `role` say which it is. A customer's
 * row calls their name `full_name`; it is normalised here so no page has to
 * know which kind of user it is rendering.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole | 'client';
  company_id?: string | null;
}

export interface ClientRegistration {
  full_name: string;
  phone: string;
  email?: string;
  password: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  company: Company | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** A customer rather than someone who works for a rental company. */
  isClient: boolean;
  /** Where this account belongs after signing in. */
  homePath: string;
  login: (identifier: string, password: string) => Promise<void>;
  registerClient: (details: ClientRegistration) => Promise<void>;
  logout: () => void;
  /** Super admins only: choose which tenant to act inside. */
  switchCompany: (company: Company | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface ClientAccount {
  id: string;
  full_name: string;
  email: string | null;
}

interface MeResponse {
  role: string;
  user: StaffUser & { company_id: string | null };
  company: Company | null;
}

/** Folds a customer record into the shape the rest of the app reads. */
function asSessionUser(client: ClientAccount): SessionUser {
  return { id: client.id, name: client.full_name, email: client.email, role: 'client' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<MeResponse>('/auth/me')
      .then(async (res) => {
        if (res.role === 'client') {
          setUser(asSessionUser(res.user as unknown as ClientAccount));
          return;
        }
        setUser(res.user);
        if (res.company) {
          setCompany(res.company);
          setActiveCompany(res.company.id);
          return;
        }
        // A super admin has no company of their own — restore whichever tenant
        // they were last working inside.
        const stored = getActiveCompany();
        if (stored) {
          const companies = await api.get<Company[]>('/companies').catch(() => [] as Company[]);
          const match = companies.find((c) => c.id === stored);
          if (match) setCompany(match);
          else setActiveCompany(null);
        }
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  /**
   * One sign-in box for everybody.
   *
   * Staff accounts are addressed by email and customers by phone number, so
   * the identifier itself says which door to knock on — nobody has to know
   * which kind of account they hold before they can sign in.
   */
  async function login(identifier: string, password: string) {
    if (identifier.includes('@')) {
      const res = await api.post<{ token: string; user: StaffUser; company: Company | null }>(
        '/auth/staff/login',
        { email: identifier, password }
      );
      setToken(res.token);
      setUser(res.user);
      setCompany(res.company);
      setActiveCompany(res.company?.id ?? null);
      return;
    }

    const res = await api.post<{ token: string; user: ClientAccount }>('/auth/client/login', {
      identifier,
      password,
    });
    setToken(res.token);
    setUser(asSessionUser(res.user));
    setCompany(null);
    setActiveCompany(null);
  }

  async function registerClient(details: ClientRegistration) {
    const res = await api.post<{ token: string; user: ClientAccount }>('/auth/client/register', details);
    setToken(res.token);
    setUser(asSessionUser(res.user));
    setCompany(null);
    setActiveCompany(null);
  }

  function logout() {
    clearToken();
    setActiveCompany(null);
    setUser(null);
    setCompany(null);
  }

  function switchCompany(next: Company | null) {
    setCompany(next);
    setActiveCompany(next?.id ?? null);
  }

  const role = user?.role as string | undefined;
  const isClient = role === 'client';

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        loading,
        isAdmin: role === 'admin' || role === 'super_admin',
        isSuperAdmin: role === 'super_admin',
        isClient,
        homePath: isClient ? '/my-rentals' : '/dashboard',
        login,
        registerClient,
        logout,
        switchCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
