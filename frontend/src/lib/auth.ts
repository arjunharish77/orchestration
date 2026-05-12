'use client';

import { apiRequest, authTokenStorageKey, refreshTokenStorageKey } from './api';

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
  requiresEmailOtp?: boolean;
};

export function storeAuthTokens(tokens: AuthTokens) {
  sessionStorage.setItem(authTokenStorageKey, tokens.accessToken);
  localStorage.removeItem(authTokenStorageKey);
  localStorage.removeItem(refreshTokenStorageKey);
}

export function clearAuthTokens() {
  sessionStorage.removeItem(authTokenStorageKey);
  localStorage.removeItem(authTokenStorageKey);
  localStorage.removeItem(refreshTokenStorageKey);
}

export function getRefreshToken() {
  return null;
}

export async function loginWithPassword(email: string, password: string) {
  return apiRequest<AuthTokens & { requiresEmailOtp?: boolean }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

export async function verifyLoginOtp(email: string, otp: string) {
  return apiRequest<AuthTokens>('/auth/login/email-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
}

export async function requestPasswordReset(email: string) {
  return apiRequest<{ ok?: boolean; message?: string }>('/auth/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
}

export async function confirmPasswordReset(email: string, token: string, newPassword: string) {
  return apiRequest<{ ok?: boolean; message?: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, newPassword })
  });
}

export async function restoreStoredSession<TUser>() {
  const storedToken = sessionStorage.getItem(authTokenStorageKey) ?? localStorage.getItem(authTokenStorageKey);

  try {
    if (storedToken) {
      const user = await apiRequest<TUser>('/auth/me', { token: storedToken });
      return { token: storedToken, user };
    }
  } catch {
    // Try refresh below.
  }

  try {
    const user = await apiRequest<TUser>('/auth/me');
    return { token: storedToken ?? '', user };
  } catch {
    // Try cookie refresh below.
  }

  try {
    const refreshed = await apiRequest<AuthTokens>('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    storeAuthTokens(refreshed);
    const user = await apiRequest<TUser>('/auth/me', { token: refreshed.accessToken });
    return { token: refreshed.accessToken, user };
  } catch {
    clearAuthTokens();
    return null;
  }
}

export async function logoutSession(token: string | null) {
  const refreshToken = getRefreshToken();
  if (token) {
    await apiRequest('/auth/logout', {
      token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refreshToken ? { refreshToken } : {})
    }).catch(() => undefined);
  } else {
    await apiRequest('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).catch(() => undefined);
  }
  clearAuthTokens();
}
