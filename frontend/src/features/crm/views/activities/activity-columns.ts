import { FieldOption } from '../../../../lib/field-metadata';

export const allActivityTypeOptions = [
  { code: '001', label: 'Call' },
  { code: '002', label: 'Meeting' },
  { code: '003', label: 'Note' },
  { code: '004', label: 'Disposition' },
  { code: '005', label: 'WhatsApp' },
  { code: '006', label: 'Voicebot' },
  { code: '007', label: 'Document Shared' },
  { code: '008', label: 'System' },
  { code: '009', label: 'Task' },
  { code: '010', label: 'Upload' },
  { code: '011', label: 'Assignment' },
  { code: '012', label: 'Telephony Popup' },
  { code: '013', label: 'Telephony Call' }
];

export const activityTypeOptions = allActivityTypeOptions.filter((type) => !['012', '013'].includes(type.code));
export const defaultActivityTypeCode = activityTypeOptions[0].code;
export const legacyActivityTypeCodes: Record<string, string> = Object.fromEntries(allActivityTypeOptions.map((type) => [type.label, type.code]));
export const activityTypeLabels: Record<string, string> = Object.fromEntries(allActivityTypeOptions.map((type) => [type.code, type.label]));

export const baseActivityListFields: FieldOption[] = [
  { key: 'lead', label: 'Lead', fieldType: 'text' },
  { key: 'type', label: 'Type', fieldType: 'select', options: activityTypeOptions.map((type) => `${type.code} · ${type.label}`) },
  { key: 'title', label: 'Title', fieldType: 'text' },
  { key: 'disposition', label: 'Disposition', fieldType: 'select', options: ['Converted', 'Interested', 'Follow-up Required', 'Callback Scheduled', 'Documents Pending', 'Not Interested', 'Not Reachable', 'Wrong Number', 'Escalated'] },
  { key: 'notes', label: 'Notes', fieldType: 'text' },
  { key: 'createdBy', label: 'Created By', fieldType: 'text' },
  { key: 'createdAt', label: 'Created', fieldType: 'date' }
];
