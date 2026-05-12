import { Prisma } from '@prisma/client';

export const leadExportColumns = [
  { key: 'externalLeadId', label: 'Lead ID' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'branchCode', label: 'Branch Code' },
  { key: 'branchName', label: 'Branch Name' },
  { key: 'offerAmount', label: 'Loan Offer Amount' },
  { key: 'emiAmount', label: 'EMI Amount' },
  { key: 'location', label: 'Customer Location' },
  { key: 'preferredLanguage', label: 'Preferred Language' },
  { key: 'status', label: 'Lead Status' },
  { key: 'category', label: 'Lead Category' },
  { key: 'disposition', label: 'Lead Disposition' },
  { key: 'assignedUserName', label: 'Assigned User' },
  { key: 'assignedTeamId', label: 'Assigned Team' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'updatedAt', label: 'Updated At' }
] as const;

export function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function isExportableFieldAccess(access: string) {
  return access !== 'hidden' && access !== 'masked';
}

export function uniqueNonEmpty(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function sanitizeBulkLeadPatch(input: { status?: string; category?: string; disposition?: string; teamId?: string; assignedUserId?: string } = {}): Prisma.LeadUncheckedUpdateInput {
  const patch: Prisma.LeadUncheckedUpdateInput = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.category !== undefined) patch.category = input.category;
  if (input.disposition !== undefined) patch.disposition = input.disposition;
  if (input.teamId !== undefined) patch.teamId = input.teamId;
  if (input.assignedUserId !== undefined) {
    patch.assignedUserId = ['system', 'System', '__system__'].includes(input.assignedUserId) ? null : input.assignedUserId;
  }
  return patch;
}

export function changedKeys(incoming: Record<string, unknown>, before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(incoming).filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
}

export function pickKeys(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, source[key] ?? null]));
}
