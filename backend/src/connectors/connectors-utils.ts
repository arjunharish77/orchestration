import { Prisma } from '@prisma/client';

export function extractVariables(template: unknown) {
  const text = flattenTemplate(template).join(' ');
  const variables = new Set<string>();
  const bracePattern = /\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g;

  for (const match of text.matchAll(bracePattern)) variables.add(match[1]);

  return Array.from(variables).sort();
}

function flattenTemplate(template: unknown): string[] {
  if (template === null || template === undefined) return [];
  if (typeof template === 'string') return [template];
  if (typeof template === 'number' || typeof template === 'boolean') return [String(template)];
  if (Array.isArray(template)) return template.flatMap((item) => flattenTemplate(item));
  if (typeof template === 'object') return Object.values(template as Record<string, unknown>).flatMap((item) => flattenTemplate(item));
  return [];
}

export function humanizeVariable(variable: string) {
  return variable
    .replace(/[._]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function normalizeWhatsAppStatus(value: unknown) {
  const status = String(value ?? 'received').toLowerCase();
  if (['sent', 'delivered', 'read', 'failed', 'queued', 'received'].includes(status)) return status;
  if (status.includes('deliver')) return 'delivered';
  if (status.includes('read')) return 'read';
  if (status.includes('fail')) return 'failed';
  if (status.includes('sent')) return 'sent';
  return 'received';
}

export function applyMapping(payload: Record<string, unknown>, mapping: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(mapping).map(([target, path]) => [target, getPath(payload, String(path))]));
}

function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) return (current as Record<string, unknown>)[segment];
    return undefined;
  }, source);
}

export function numberOrNull(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function resolveVariables(value: unknown, variables: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolveVariables(entry, variables));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveVariables(entry, variables)]));
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(/\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g, (_, key) => String(variables[key] ?? ''));
}

export function isOptOutText(value: string) {
  return ['stop', 'unsubscribe', 'opt out', 'opt-out', 'do not contact'].includes(value.trim().toLowerCase());
}

export function isTruthy(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'opted_out'].includes(value.toLowerCase());
  return Boolean(value);
}
