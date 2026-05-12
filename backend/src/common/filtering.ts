import { Prisma } from '@prisma/client';

export function containsInsensitive(value?: string): Prisma.StringFilter | undefined {
  const trimmed = value?.trim();
  return trimmed ? { contains: trimmed, mode: 'insensitive' } : undefined;
}

export function equalsInsensitive(value?: string): Prisma.StringFilter | undefined {
  const trimmed = value?.trim();
  return trimmed ? { equals: trimmed, mode: 'insensitive' } : undefined;
}

export function compactWhere<T extends Record<string, unknown>>(where: T): T {
  return Object.fromEntries(Object.entries(where).filter(([, value]) => value !== undefined && value !== '')) as T;
}
