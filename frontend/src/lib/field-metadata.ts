'use client';

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multi_select' | 'boolean' | 'json';

export type FieldOption = {
  key: string;
  label: string;
  fieldType?: FieldType | string;
  options?: string[];
  optionKey?: string;
};

export type FilterOperator = {
  value: string;
  label: string;
};

const commonOperators: FilterOperator[] = [
  { value: 'exists', label: 'Not empty' },
  { value: 'not_exists', label: 'Empty' }
];

export function operatorsForFieldType(fieldType?: string): FilterOperator[] {
  if (fieldType === 'date' || fieldType === 'datetime') {
    return [
      { value: 'equals', label: 'On' },
      { value: 'lte', label: 'Before' },
      { value: 'gte', label: 'After' },
      { value: 'between', label: 'Between' },
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'this_week', label: 'This week' },
      { value: 'this_month', label: 'This month' },
      ...commonOperators
    ];
  }
  if (fieldType === 'number') {
    return [
      { value: 'equals', label: 'Equals' },
      { value: 'gt', label: 'Greater than' },
      { value: 'lt', label: 'Less than' },
      { value: 'between', label: 'Between' },
      ...commonOperators
    ];
  }
  if (fieldType === 'select' || fieldType === 'multi_select') {
    return [
      { value: 'equals', label: 'Is' },
      { value: 'not_equals', label: 'Is not' },
      { value: 'in', label: 'In' },
      { value: 'not_in', label: 'Not in' },
      ...commonOperators
    ];
  }
  if (fieldType === 'boolean') {
    return [
      { value: 'equals', label: 'Is true' },
      { value: 'not_equals', label: 'Is false' }
    ];
  }
  return [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    ...commonOperators
  ];
}

export function normalizeFilterOperator(fieldType: string | undefined, operator: string) {
  const allowed = operatorsForFieldType(fieldType).map((item) => item.value);
  return allowed.includes(operator) ? operator : allowed[0] ?? 'equals';
}

export function normalizeOptions(options?: unknown[] | null): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') return String(option);
      if (option && typeof option === 'object' && 'label' in option) return String((option as { label: unknown }).label);
      if (option && typeof option === 'object' && 'value' in option) return String((option as { value: unknown }).value);
      return '';
    })
    .filter(Boolean);
}
