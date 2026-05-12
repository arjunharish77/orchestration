import { ReportsOverview } from './report-types';
import { humanizeKey } from '../../../../lib/format';
export { formatDate, humanizeKey } from '../../../../lib/format';

export const moduleOptions = ['Lead', 'Activity', 'User', 'Upload', 'Automation', 'Connector', 'Report', 'Settings', 'Task'];
export const auditActionOptions = ['create', 'update', 'delete', 'login', 'upload', 'assign', 'disposition'];

export function labelForModule(value?: string | null) {
  return value ? humanizeKey(value) : '-';
}

export function metricNumber(metrics: ReportsOverview['metrics'], key: string) {
  const value = metrics?.[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return 0;
}

export function stringValue(value: unknown, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function numberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return fallback;
}

export function arrayValue<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}
