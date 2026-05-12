import { Prisma } from '@prisma/client';
import { toJsonValue } from '../common/json';

export type AssignmentResult = {
  matched: boolean;
  ruleId?: string;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  reason: string;
};

export const assignmentGlobalConfigKey = 'assignment.global.config';

export function evaluateAssignmentRule(conditions: Array<{ fieldPath: string; operator: string; value: unknown }>, lead: Record<string, unknown>, activity: Record<string, unknown> | null, context: Record<string, unknown>) {
  if (conditions.length === 0) {
    return { matched: true, reason: 'Rule has no conditions' };
  }

  const failed: string[] = [];
  for (const condition of conditions) {
    const actual = resolveAssignmentField(condition.fieldPath, lead, activity, context);
    if (!compareAssignmentValue(actual, condition.operator, condition.value)) {
      failed.push(`${condition.fieldPath} ${condition.operator} ${JSON.stringify(condition.value)} failed; actual=${JSON.stringify(actual)}`);
    }
  }

  return failed.length === 0
    ? { matched: true, reason: 'All conditions matched' }
    : { matched: false, reason: failed.join('; ') };
}

export function resolveAssignmentField(fieldPath: string, lead: Record<string, unknown>, activity: Record<string, unknown> | null, context: Record<string, unknown>) {
  if (fieldPath.startsWith('lead.custom.')) {
    const key = fieldPath.replace('lead.custom.', '');
    const customValues = Array.isArray(lead.customValues) ? lead.customValues : [];
    const match = customValues.find((v: unknown) => {
      const entry = v as Record<string, unknown> | undefined;
      const field = entry?.field as Record<string, unknown> | undefined;
      return field?.fieldKey === key;
    }) as Record<string, unknown> | undefined;
    return match?.value;
  }

  if (fieldPath.startsWith('lead.')) return getPathValue(lead, fieldPath.replace('lead.', ''));
  if (fieldPath.startsWith('activity.')) return getPathValue(activity, fieldPath.replace('activity.', ''));
  if (fieldPath.startsWith('user.custom.')) return getPathValue(context, fieldPath);
  if (fieldPath.startsWith('context.')) return getPathValue(context, fieldPath.replace('context.', ''));
  return getPathValue(lead, fieldPath);
}

export function compareAssignmentValue(actual: unknown, operator: string, expected: unknown) {
  if (operator === 'equals') return String(actual ?? '') === String(expected ?? '');
  if (operator === 'not_equals') return String(actual ?? '') !== String(expected ?? '');
  if (operator === 'contains') return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
  if (operator === 'in') return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ''));
  if (operator === 'exists') return actual !== null && actual !== undefined && actual !== '';
  if (operator === 'not_exists') return actual === null || actual === undefined || actual === '';
  return false;
}

export function pickWeightedUser<T extends { id: string }>(users: T[], counter: number, config: Record<string, unknown>) {
  const weights = config.userWeights && typeof config.userWeights === 'object' ? config.userWeights as Record<string, unknown> : {};
  const weightedUsers = users.flatMap((user) => {
    const weight = Math.max(1, Math.min(100, Number(weights[user.id] ?? 1) || 1));
    return Array.from({ length: weight }, () => user);
  });
  return weightedUsers.length ? weightedUsers[counter % weightedUsers.length] : users[counter % users.length];
}

export function getPathValue(source: unknown, path: string) {
  if (!source) return undefined;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

export function userCustomWhere(fieldKey: string, value: unknown): Prisma.UserWhereInput {
  return {
    customValues: {
      some: {
        field: { fieldKey },
        ...(value === undefined ? {} : { value: { equals: toJsonValue(value) } })
      }
    }
  };
}
