/**
 * API client. The console and the API are served from the same origin in
 * production, and the vite dev server proxies /api and /uploads to
 * localhost:4000 in development — so relative paths work in both.
 */

const TOKEN_KEY = 'rental_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Resolves an upload path returned by the API. */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    // An expired or invalid token should drop the session rather than leave
    // the app in a half-authenticated state.
    if (res.status === 401) clearToken();
    throw new ApiError((isJson && (data as any).error) || res.statusText, res.status);
  }
  return data as T;
}

const body = (b?: any) => (b instanceof FormData ? b : b ? JSON.stringify(b) : undefined);

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, b?: any) => request<T>(path, { method: 'POST', body: body(b) }),
  put: <T>(path: string, b?: any) => request<T>(path, { method: 'PUT', body: body(b) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Downloads a file from an authenticated endpoint. */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError('Download failed', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
