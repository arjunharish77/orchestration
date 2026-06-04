import { FieldOption } from '../../../../lib/field-metadata';

export const uploadFieldOptions: FieldOption[] = [
  { key: 'file', label: 'File', fieldType: 'text' },
  { key: 'rows', label: 'Rows', fieldType: 'number' },
  { key: 'valid', label: 'Valid', fieldType: 'number' },
  { key: 'failed', label: 'Failed', fieldType: 'number' },
  { key: 'status', label: 'Status', fieldType: 'select' },
  { key: 'date', label: 'Date', fieldType: 'date' }
];
