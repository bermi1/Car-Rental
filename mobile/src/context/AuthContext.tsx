import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { api, setToken, clearToken, getToken } from '../api/client';
import { getDeviceIdentifier } from '../utils/deviceId';

export interface ClientUser {
  id: string;
  full_name: string;
  phone: string;
  /** Optional — the phone number is the account handle. */
  email: string | null;
  id_type: string;
  id_number: string | null;
  id_document_file: string | null;
  driving_license_file: string | null;
  created_at: string;
}

interface AuthContextValue {
  user: ClientUser | null;
  loading: boolean;
  /** Identifier is the client's phone number or their email. */
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    full_name: string;
    phone: string;
    email?: string;
    password: string;
    language?: 'en' | 'sw';
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const res = await api.get<{ role: string; user: ClientUser }>('/auth/me');
    setUser(res.user);
  }

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await refreshUser();
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(identifier: string, password: string) {
    const deviceIdentifier = await getDeviceIdentifier();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = Device.deviceName || (platform === 'ios' ? "iPhone" : 'Android device');

    const res = await api.post<{ token: string; user: ClientUser }>('/auth/client/login', {
      identifier,
      password,
      device_name: deviceName,
      platform,
      device_identifier: deviceIdentifier,
    });
    await setToken(res.token);
    setUser(res.user);
  }

  async function register(input: {
    full_name: string;
    phone: string;
    email?: string;
    password: string;
    language?: 'en' | 'sw';
  }) {
    const res = await api.post<{ token: string; user: ClientUser }>('/auth/client/register', input);
    await setToken(res.token);
    setUser(res.user);
    // Immediately follow with a login so the device gets linked too. The phone
    // is the handle, and it's the one field registration always has.
    await login(input.phone, input.password);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
