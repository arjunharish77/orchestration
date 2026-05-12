import { Prisma } from '@prisma/client';
import { toJsonValue } from '../common/json';
import { SaveLeadViewDto } from './leads.dto';

export function savedLeadViewData(userId: string, input: SaveLeadViewDto, includeUser = true) {
  const data: Record<string, unknown> = {
    name: input.name.trim(),
    filterForm: input.filterForm ? toJsonValue(input.filterForm) : Prisma.JsonNull,
    advancedMatch: input.advancedMatch ?? 'all',
    advancedConditions: input.advancedConditions ? toJsonValue(input.advancedConditions) : Prisma.JsonNull,
    visibleLeadFields: input.visibleLeadFields ? toJsonValue(input.visibleLeadFields) : Prisma.JsonNull,
    density: input.density ?? 'compact'
  };
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;
  if (includeUser) data.userId = userId;
  return data;
}

export function formatSavedLeadView(view: {
  id: string;
  name: string;
  isDefault: boolean;
  filterForm: Prisma.JsonValue | null;
  advancedMatch: string;
  advancedConditions: Prisma.JsonValue | null;
  visibleLeadFields: Prisma.JsonValue | null;
  density: string;
  updatedAt: Date;
}) {
  return {
    id: view.id,
    name: view.name,
    isDefault: view.isDefault,
    filterForm: view.filterForm ?? {},
    advancedMatch: view.advancedMatch === 'any' ? 'any' : 'all',
    advancedConditions: Array.isArray(view.advancedConditions) ? view.advancedConditions : [],
    visibleLeadFields: Array.isArray(view.visibleLeadFields) ? view.visibleLeadFields : [],
    density: view.density === 'compact' ? 'compact' : 'compact',
    updatedAt: view.updatedAt.toISOString()
  };
}
