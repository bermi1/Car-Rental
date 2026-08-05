import React, { createContext, useContext, useEffect, useState } from 'react';
import type { StaffUser } from '@rental/shared';
import { api, setToken, clearToken, getToken, setActiveCompany, getActiveCompany } from '../api/client';

export interface Company {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextValue {
  user: StaffUser | null;
  company: Company | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Super admins only: choose which tenant to act inside. */
  switchCompany: (company: Company | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface MeResponse {
  role: string;
  user: StaffUser & { company_id: string | null };
  company: Company | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<(StaffUser & { company_id?: string | null }) | null>(null);
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

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: StaffUser; company: Company | null }>(
      '/auth/staff/login',
      { email, password }
    );
    setToken(res.token);
    setUser(res.user);
    setCompany(res.company);
    setActiveCompany(res.company?.id ?? null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        loading,
        isAdmin: role === 'admin' || role === 'super_admin',
        isSuperAdmin: role === 'super_admin',
        login,
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
