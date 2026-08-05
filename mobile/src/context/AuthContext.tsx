import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { api, setToken, clearToken, getToken } from '../api/client';
import { getDeviceIdentifier } from '../utils/deviceId';

export interface ClientUser {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  id_type: string;
  id_number: string | null;
  id_document_file: string | null;
  driving_license_file: string | null;
  created_at: string;
}

interface AuthContextValue {
  user: ClientUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { full_name: string; phone: string; email: string; password: string }) => Promise<void>;
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

  async function login(email: string, password: string) {
    const deviceIdentifier = await getDeviceIdentifier();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = Device.deviceName || (platform === 'ios' ? "iPhone" : 'Android device');

    const res = await api.post<{ token: string; user: ClientUser }>('/auth/client/login', {
      email,
      password,
      device_name: deviceName,
      platform,
      device_identifier: deviceIdentifier,
    });
    await setToken(res.token);
    setUser(res.user);
  }

  async function register(input: { full_name: string; phone: string; email: string; password: string }) {
    const res = await api.post<{ token: string; user: ClientUser }>('/auth/client/register', input);
    await setToken(res.token);
    setUser(res.user);
    // Immediately follow with a login so the device gets linked too.
    await login(input.email, input.password);
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
