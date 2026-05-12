import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { compactWhere, containsInsensitive, equalsInsensitive } from '../common/filtering';
import { ListLeadsQueryDto } from './leads.dto';

export const leadSearchFields = [
  'customerName',
  'mobile',
  'email',
  'externalLeadId',
  'branchCode',
  'branchName',
  'preferredLanguage',
  'location'
] as const;

const leadDuplicateFields = ['mobile', 'externalLeadId', 'customerName', 'branchCode', 'branchName'] as const;
export type LeadDuplicateValues = Partial<Record<typeof leadDuplicateFields[number], string | null>> & {
  customFields?: Record<string, unknown>;
  customValues?: Array<{ field: { fieldKey: string }; value: unknown }>;
};

export function isLeadDuplicateField(field: string) {
  return (leadDuplicateFields as readonly string[]).includes(field) || field.startsWith('custom:');
}

export function leadDuplicateFieldValue(values: LeadDuplicateValues, field: string) {
  if (field === 'mobile') return values.mobile;
  if (field === 'externalLeadId') return values.externalLeadId;
  if (field === 'customerName') return values.customerName;
  if (field === 'branchCode') return values.branchCode;
  if (field === 'branchName') return values.branchName;
  if (field.startsWith('custom:')) {
    const fieldKey = field.slice('custom:'.length);
    return values.customFields?.[fieldKey] ?? values.customValues?.find((value) => value.field.fieldKey === fieldKey)?.value;
  }
  return '';
}

export function humanizeLeadField(field: string): string {
  if (field === 'externalLeadId') return 'Loan ID / Lead ID';
  if (field === 'mobile') return 'Mobile';
  if (field.startsWith('custom:')) return `Custom ${humanizeLeadField(field.slice('custom:'.length))}`;
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function leadWhere(
  query: ListLeadsQueryDto,
  effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null = null,
  accessService?: AccessService
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = compactWhere({
    status: equalsInsensitive(query.status),
    category: equalsInsensitive(query.category),
    disposition: equalsInsensitive(query.disposition),
    teamId: query.teamId,
    assignedUserId: query.assignedUserId,
    branchCode: equalsInsensitive(query.branchCode)
  });
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.createdFrom) createdAt.gte = startOfDay(query.createdFrom);
  if (query.createdTo) createdAt.lte = endOfDay(query.createdTo);
  if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

  const search = query.search?.trim();
  if (search) {
    where.OR = leadSearchFields
      .filter((field) => !effective || !accessService || accessService.getFieldAccess(effective, 'Lead', field) !== 'hidden')
      .map((field) => (field === 'mobile' ? { mobile: { contains: search } } : { [field]: containsInsensitive(search) }) as Prisma.LeadWhereInput);
  }
  const advanced = advancedLeadFilters(query.advancedFilters, effective, accessService);
  if (advanced.length > 0) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...advanced];
  }

  return where;
}

export function leadOrderBy(sortBy?: ListLeadsQueryDto['sortBy'], sortOrder: ListLeadsQueryDto['sortOrder'] = 'desc'): Prisma.LeadOrderByWithRelationInput {
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';
  if (!sortBy) return { createdAt: 'desc' };
  return { [sortBy]: direction };
}

export function advancedLeadFilters(
  raw?: string,
  effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null = null,
  accessService?: AccessService
): Prisma.LeadWhereInput[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const conditions = Array.isArray(parsed?.conditions) ? parsed.conditions : [];
    const filters = conditions.map((condition: unknown) => advancedLeadCondition(condition, effective, accessService)).filter(Boolean) as Prisma.LeadWhereInput[];
    if (String(parsed?.match ?? 'all') === 'any' && filters.length > 0) return [{ OR: filters }];
    return filters;
  } catch {
    return [];
  }
}

export function advancedLeadCondition(
  condition: unknown,
  effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null = null,
  accessService?: AccessService
): Prisma.LeadWhereInput | null {
  const c = condition && typeof condition === 'object' ? condition as Record<string, unknown> : {} as Record<string, unknown>;
  const field = String(c.field ?? '');
  const operator = String(c.operator ?? 'equals');
  const value = c.value === undefined || c.value === null ? '' : String(c.value);
  if (!field || (!value && !['exists', 'not_exists', 'today', 'yesterday', 'this_week', 'this_month'].includes(operator))) return null;
  if (field.startsWith('custom:')) {
    const fieldKey = field.replace('custom:', '');
    if (effective && accessService && accessService.getFieldAccess(effective, 'Lead', fieldKey) === 'hidden') return null;
    return customFieldCondition(fieldKey, operator, value);
  }
  if (field === 'createdAt' || field === 'updatedAt') return dateCondition(field, operator, value);
  if (field === 'offerAmount' || field === 'emiAmount') return numberCondition(field, operator, value);
  const supported = ['customerName', 'mobile', 'email', 'status', 'category', 'disposition', 'branchCode', 'branchName', 'preferredLanguage', 'location', 'externalLeadId'] as const;
  if (!(supported as readonly string[]).includes(field)) return null;
  if (effective && accessService && accessService.getFieldAccess(effective, 'Lead', field) === 'hidden') return null;
  if (operator === 'exists') return { [field]: { not: null } } as Prisma.LeadWhereInput;
  if (operator === 'not_exists') return { OR: [{ [field]: null }, { [field]: '' }] } as Prisma.LeadWhereInput;
  if (operator === 'contains') return { [field]: containsInsensitive(value) } as Prisma.LeadWhereInput;
  if (operator === 'starts_with') return { [field]: { startsWith: value, mode: 'insensitive' } } as Prisma.LeadWhereInput;
  if (operator === 'ends_with') return { [field]: { endsWith: value, mode: 'insensitive' } } as Prisma.LeadWhereInput;
  if (operator === 'in' || operator === 'not_in') {
    const values = value.split(',').map((entry) => entry.trim()).filter(Boolean);
    const conditionFilter = { [field]: { in: values, mode: 'insensitive' } } as Prisma.LeadWhereInput;
    return operator === 'not_in' ? { NOT: conditionFilter } : conditionFilter;
  }
  if (operator === 'not_equals') return { NOT: { [field]: equalsInsensitive(value) } } as Prisma.LeadWhereInput;
  return { [field]: equalsInsensitive(value) } as Prisma.LeadWhereInput;
}

function numberCondition(field: 'offerAmount' | 'emiAmount', operator: string, value: string): Prisma.LeadWhereInput {
  if (operator === 'between') {
    const range = parseRangeValue(value);
    const from = Number(range.from);
    const to = Number(range.to);
    const filter: Record<string, number> = {};
    if (Number.isFinite(from)) filter.gte = from;
    if (Number.isFinite(to)) filter.lte = to;
    return Object.keys(filter).length > 0 ? { [field]: filter } : {};
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return {};
  if (operator === 'gt') return { [field]: { gt: numberValue } };
  if (operator === 'lt') return { [field]: { lt: numberValue } };
  if (operator === 'gte') return { [field]: { gte: numberValue } };
  if (operator === 'lte') return { [field]: { lte: numberValue } };
  if (operator === 'not_equals') return { NOT: { [field]: numberValue } };
  return { [field]: numberValue };
}

function dateCondition(field: 'createdAt' | 'updatedAt', operator: string, value: string): Prisma.LeadWhereInput {
  const relativeRange = relativeDateRange(operator);
  if (relativeRange) return { [field]: relativeRange };
  if (operator === 'between') {
    const range = parseRangeValue(value);
    const filter: Prisma.DateTimeFilter = {};
    const from = range.from ? startOfDay(range.from) : undefined;
    const to = range.to ? endOfDay(range.to) : undefined;
    if (from) filter.gte = from;
    if (to) filter.lte = to;
    return Object.keys(filter).length > 0 ? { [field]: filter } : {};
  }
  if (operator === 'lte') return { [field]: { lte: endOfDay(value) } };
  if (operator === 'gte') return { [field]: { gte: startOfDay(value) } };
  return { [field]: { gte: startOfDay(value), lte: endOfDay(value) } };
}

function customFieldCondition(fieldKey: string, operator: string, value: string): Prisma.LeadWhereInput {
  const relation = (valueFilter: Prisma.JsonFilter): Prisma.LeadWhereInput => ({
    customValues: {
      some: {
        field: { fieldKey },
        value: valueFilter
      }
    }
  });
  const noValue: Prisma.LeadWhereInput = {
    OR: [
      { customValues: { none: { field: { fieldKey } } } },
      relation({ equals: Prisma.JsonNull }),
      relation({ equals: '' } as Prisma.JsonFilter)
    ]
  };

  if (operator === 'exists') {
    return {
      AND: [
        { customValues: { some: { field: { fieldKey } } } },
        { NOT: noValue }
      ]
    };
  }
  if (operator === 'not_exists') return noValue;
  if (operator === 'contains') return relation({ string_contains: value } as Prisma.JsonFilter);
  if (operator === 'starts_with') return relation({ string_starts_with: value } as Prisma.JsonFilter);
  if (operator === 'ends_with') return relation({ string_ends_with: value } as Prisma.JsonFilter);
  if (operator === 'not_equals') return { AND: [{ customValues: { some: { field: { fieldKey } } } }, { NOT: relation({ equals: value } as Prisma.JsonFilter) }] };
  if (operator === 'in' || operator === 'not_in') {
    const values = value.split(',').map((entry) => entry.trim()).filter(Boolean);
    const inFilter: Prisma.LeadWhereInput = { OR: values.map((entry) => relation({ equals: entry } as Prisma.JsonFilter)) };
    return operator === 'not_in' ? { AND: [{ customValues: { some: { field: { fieldKey } } } }, { NOT: inFilter }] } : inFilter;
  }
  if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return {};
    return relation({ [operator]: numberValue } as Prisma.JsonFilter);
  }
  if (operator === 'between') {
    const range = parseRangeValue(value);
    const from = Number(range.from);
    const to = Number(range.to);
    const filter: Record<string, number> = {};
    if (Number.isFinite(from)) filter.gte = from;
    if (Number.isFinite(to)) filter.lte = to;
    return Object.keys(filter).length > 0 ? relation(filter as Prisma.JsonFilter) : {};
  }
  return relation({ equals: value } as Prisma.JsonFilter);
}

function startOfDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseRangeValue(value: string) {
  const [from, to] = value.includes('..') ? value.split('..') : value.split(',');
  return { from: from?.trim(), to: to?.trim() };
}

function relativeDateRange(operator: string) {
  const now = new Date();
  if (operator === 'today') {
    const value = now.toISOString();
    return { gte: startOfDay(value), lte: endOfDay(value) };
  }
  if (operator === 'yesterday') {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    const value = date.toISOString();
    return { gte: startOfDay(value), lte: endOfDay(value) };
  }
  if (operator === 'this_week') {
    const start = new Date(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (operator === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  return null;
}
