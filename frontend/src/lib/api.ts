'use client';

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

export const apiBaseUrl = requiredPublicEnv('NEXT_PUBLIC_API_URL', configuredApiBaseUrl, 'http://127.0.0.1:4000');
export const authTokenStorageKey = 'unnatify_access_token';
export const refreshTokenStorageKey = 'unnatify_refresh_token';

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function readPayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json().catch(() => null);
  return response.text().catch(() => '');
}

export async function apiRequest<T>(path: string, options: RequestInit & { token?: string | null } = {}): Promise<T> {
  const response = await requestRaw(path, options);
  const payload = await readPayload(response);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : typeof payload === 'string' && payload
        ? payload
        : `Request failed with ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}

export async function apiText(path: string, options: RequestInit & { token?: string | null } = {}): Promise<string> {
  const response = await requestRaw(path, options);
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new ApiError(text || `Request failed with ${response.status}`, response.status, text);
  return text;
}

async function requestRaw(path: string, options: RequestInit & { token?: string | null } = {}) {
  const { token, headers, ...rest } = options;
  return fetch(`${apiBaseUrl}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...authHeaders(token ?? null),
      ...csrfHeaders(rest.method),
      ...headers
    }
  });
}

function csrfHeaders(method?: string): HeadersInit {
  const normalized = String(method ?? 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(normalized)) return {};
  const token = readCookie('unnatify_csrf_token');
  return token ? { 'x-csrf-token': token } : {};
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function requiredPublicEnv(name: string, value: string | undefined, fallback: string) {
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return fallback;
}
