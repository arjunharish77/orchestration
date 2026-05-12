import { Prisma } from '@prisma/client';

export function normalizeTenDigitPhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return null;
}

export function parseProviderDate(value: unknown): Date | null {
  if (!value) return null;
  const normalized = String(value).trim().replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDurationSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const duration = Number(value);
  return Number.isFinite(duration) ? duration : null;
}

export const popupLeadSelect = {
  id: true,
  externalLeadId: true,
  customerName: true,
  mobile: true,
  email: true,
  status: true,
  category: true,
  disposition: true,
  branchCode: true,
  branchName: true,
  offerAmount: true,
  emiAmount: true,
  preferredLanguage: true,
  location: true,
  uploadDate: true,
  offerExpiryDate: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.LeadSelect;

export function normalizeMcubePayload(payload: Record<string, unknown>) {
  return {
    sourceNumber: payload.SourceNumber ?? payload.sourceNumber ?? payload.source_number,
    destinationNumber: payload.DestinationNumber ?? payload.destinationNumber ?? payload.destination_number,
    displayNumber: payload.DisplayNumber ?? payload.displayNumber ?? payload.display_number,
    callSessionId: String(payload.CallSessionId ?? payload.callSessionId ?? payload.call_session_id ?? ''),
    status: String(payload.Status ?? payload.status ?? ''),
    direction: String(payload.Direction ?? payload.direction ?? ''),
    callDuration: payload.CallDuration ?? payload.callDuration ?? payload.call_duration,
    recordingUrl: String(payload.ResourceURL ?? payload.resourceUrl ?? payload.recordingUrl ?? ''),
    disposition: String(payload.Disposition ?? payload.CallDisposition ?? payload.LeadDisposition ?? payload.disposition ?? ''),
    startTime: payload.StartTime ?? payload.startTime ?? payload.start_time,
    endTime: payload.EndTime ?? payload.endTime ?? payload.end_time,
    callNotes: ''
  };
}

export function resolveTelephonyNumbers(normalized: ReturnType<typeof normalizeMcubePayload>) {
  const sourcePhone = normalizeTenDigitPhone(normalized.sourceNumber);
  const destinationPhone = normalizeTenDigitPhone(normalized.destinationNumber);
  const direction = String(normalized.direction || '').toLowerCase();
  const isOutbound = direction === 'outbound';

  return {
    sourcePhone,
    destinationPhone,
    direction: normalized.direction,
    leadPhone: isOutbound ? destinationPhone : sourcePhone,
    agentPhone: isOutbound ? sourcePhone : destinationPhone
  };
}

export function formatCallSummary(direction: unknown, agentLabel: string | null | undefined, durationSeconds: number | null) {
  const normalizedDirection = String(direction || '').toLowerCase() === 'outbound' ? 'Outbound' : 'Inbound';
  const target = agentLabel || 'unknown agent';
  const duration = formatDuration(durationSeconds);
  return duration ? `${normalizedDirection} call with ${target} for ${duration}` : `${normalizedDirection} call with ${target}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (!minutes) return `${remainingSeconds}s`;
  if (!remainingSeconds) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export function toInputJson(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export function toSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function customValueMap(values: Array<{ field: { fieldKey: string }; value: unknown }>) {
  return Object.fromEntries(values.map((value) => [value.field.fieldKey, value.value]));
}

export function resolveTemplate(value: unknown, context: { lead: Record<string, unknown>; user: Record<string, unknown> | null; activity: Record<string, unknown>; leadCustom: Record<string, unknown>; userCustom: Record<string, unknown> }): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolveTemplate(entry, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveTemplate(entry, context)]));
  }
  if (typeof value !== 'string') return value;

  return value
    .replace(/\{\{lead\.custom\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => String(context.leadCustom[key] ?? ''))
    .replace(/\{\{user\.custom\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => String(context.userCustom[key] ?? ''))
    .replace(/\{\{activity\.custom\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => String((context.activity.customFields as Record<string, unknown> | undefined)?.[key] ?? ''))
    .replace(/\{\{lead\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => String(context.lead[key] ?? ''))
    .replace(/\{\{user\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => String(context.user?.[key] ?? ''));
}

export function appendQuery(url: string, body: Record<string, unknown>) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(body)) {
    parsed.searchParams.set(key, String(value ?? ''));
  }
  return parsed.toString();
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function formatRequestBody(body: unknown, requestType: string) {
  if (requestType === 'FORM_URLENCODED') {
    if (!isPlainObject(body)) return String(body ?? '');
    return new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value ?? '')])).toString();
  }
  if (typeof body === 'string') return body;
  return JSON.stringify(body ?? {});
}

export function agentPopupSample() {
  return {
    SourceNumber: '9901662111',
    DestinationNumber: '8067330904',
    DisplayNumber: '1234567890',
    Status: 'Answered',
    Direction: 'Outbound',
    CallSessionId: '080673309211440075398',
    CallDuration: '0',
    StartTime: '2016-01-29 18:26:38'
  };
}

export function callLogSample() {
  return {
    SourceNumber: '9611795983',
    DestinationNumber: '9611795980',
    DisplayNumber: '9020897874',
    StartTime: '2015-08-20 18:26:38',
    EndTime: '2015-08-20 18:26:38',
    CallDuration: '12',
    Status: 'Answered',
    ResourceURL: 'https://recordings.example.com/calls/080673309211440075398.mp3',
    Direction: 'Inbound',
    CallSessionId: '080673309211440075398'
  };
}

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

export function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
