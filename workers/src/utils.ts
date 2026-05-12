import { Prisma } from '@prisma/client';

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

export function normalizeTenDigitPhone(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveVariables(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key: string) => {
      const resolved = variables[key] ?? variables[key?.replace(/^lead\./, '')] ?? variables[key?.replace(/^user\./, '')];
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((item) => resolveVariables(item, variables));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveVariables(item, variables)]));
  }
  return value;
}

export function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function resolveSecretRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveSecretRefs);
  if (!isPlainObject(value)) return value;
  if (typeof value.secretRef === 'string') return process.env[value.secretRef] ?? '';
  if (value.masked === true && 'value' in value) return value.value ?? '';
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveSecretRefs(entry)]));
}

export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sensitive = ['password', 'token', 'secret', 'authorization', 'apikey', 'apiKey', 'auth', 'credential']
      .some((part) => normalized.includes(part.toLowerCase()));
    return [key, sensitive ? '[masked]' : maskSensitive(entry)];
  }));
}

export function readPath(value: unknown, path?: string | null) {
  if (!path) return undefined;
  return path.split('.').filter(Boolean).reduce<unknown>((current, key) => {
    if (!isPlainObject(current)) return undefined;
    return current[key];
  }, value);
}

export function appendQuery(url: string, params: unknown) {
  if (!isPlainObject(params)) return url;
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
}

export function validatePublicHttpsUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'API-call node URL is invalid';
  }
  if (parsed.protocol !== 'https:') return 'API-call node URL must use HTTPS';
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    return 'API-call node URL cannot target localhost or private network addresses';
  }
  return '';
}
