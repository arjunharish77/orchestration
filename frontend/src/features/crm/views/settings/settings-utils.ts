import { CustomFieldDefinition, SettingsUploadDetailRow } from './settings-types';
import { defaultLeadLists, defaultTaskLists } from '../../../../lib/crm-defaults';
import { formatDate, humanizeKey } from '../../../../lib/format';

export { defaultLeadLists, defaultTaskLists, formatDate, humanizeKey };

export const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  datetime: 'Date & Time',
  select: 'Dropdown',
  multi_select: 'Multi-select Dropdown',
  boolean: 'Yes / No',
  json: 'JSON'
};

export const customFieldModules: Array<CustomFieldDefinition['moduleName']> = ['Lead', 'User', 'Activity'];
export const customFieldTypes: Array<CustomFieldDefinition['fieldType']> = ['text', 'number', 'date', 'datetime', 'select', 'multi_select', 'boolean', 'json'];

export function labelForModule(value?: string | null) {
  return value ? humanizeKey(value) : '-';
}

export function labelForFieldType(value?: string | null) {
  return value ? fieldTypeLabels[value] ?? humanizeKey(value) : '-';
}

export function parseDefaultValue(fieldType: CustomFieldDefinition['fieldType'], value: string) {
  if (!value.trim()) return undefined;
  if (fieldType === 'number') return Number(value);
  if (fieldType === 'boolean') return value === 'true';
  if (fieldType === 'multi_select') return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (fieldType === 'json') return JSON.parse(value);
  return value;
}

export function rawUploadValue(row: SettingsUploadDetailRow, key: string) {
  const value = row.rawData?.[key];
  return value === undefined || value === null || value === '' ? '-' : String(value);
}
