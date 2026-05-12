import { defaultLeadLists } from '../../../../lib/crm-defaults';
import { LeadRow } from '../../types/lead';

export { defaultLeadLists };

export const sortOptions = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'customerName', label: 'Customer Name' },
  { value: 'status', label: 'Lead Status' },
  { value: 'category', label: 'Lead Category' },
  { value: 'branchCode', label: 'Branch Code' },
  { value: 'offerAmount', label: 'Loan Offer Amount' }
];

export const leadFilterBaseFields = [
  { key: 'customerName', label: 'Customer Name', fieldType: 'text' },
  { key: 'mobile', label: 'Mobile Number', fieldType: 'text' },
  { key: 'email', label: 'Email', fieldType: 'text' },
  { key: 'status', label: 'Lead Status', fieldType: 'select', optionKey: 'status' },
  { key: 'category', label: 'Lead Category', fieldType: 'select', optionKey: 'category' },
  { key: 'disposition', label: 'Lead Disposition', fieldType: 'select', optionKey: 'disposition' },
  { key: 'branchCode', label: 'Branch Code', fieldType: 'text' },
  { key: 'branchName', label: 'Branch Name', fieldType: 'text' },
  { key: 'createdAt', label: 'Created On', fieldType: 'date' },
  { key: 'updatedAt', label: 'Updated On', fieldType: 'date' },
  { key: 'offerAmount', label: 'Loan Offer Amount', fieldType: 'number' },
  { key: 'emiAmount', label: 'EMI Amount', fieldType: 'number' },
  { key: 'preferredLanguage', label: 'Preferred Language', fieldType: 'text' },
  { key: 'location', label: 'Customer Location', fieldType: 'text' }
];

export const baseLeadListFields = [
  { key: 'name', label: 'Lead Name' },
  { key: 'phone', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'category', label: 'Category' },
  { key: 'branch', label: 'Branch Code' },
  { key: 'branchName', label: 'Branch Name' },
  { key: 'amount', label: 'Loan Offer' },
  { key: 'emi', label: 'EMI' },
  { key: 'language', label: 'Language' },
  { key: 'source', label: 'Source' },
  { key: 'created', label: 'Created' }
];

const leadListPermissionKeyByField: Record<string, string> = {
  name: 'customerName',
  phone: 'mobile',
  email: 'email',
  status: 'status',
  category: 'category',
  branch: 'branchCode',
  branchName: 'branchName',
  amount: 'offerAmount',
  emi: 'emiAmount',
  language: 'preferredLanguage',
  created: 'createdAt'
};

export function isVisibleLeadListField(fieldKey: string, hiddenLeadFields: Set<string>) {
  const permissionKey = leadListPermissionKeyByField[fieldKey];
  return !permissionKey || !hiddenLeadFields.has(permissionKey);
}

export function leadListFieldOptions(leadRows: LeadRow[], leadDefinitions: Array<{ fieldKey: string; label: string }>, hiddenLeadFields = new Set<string>()) {
  return Array.from(new Map([
    ...baseLeadListFields.filter((field) => isVisibleLeadListField(field.key, hiddenLeadFields)),
    ...leadDefinitions.map((field) => ({ key: `custom:${field.fieldKey}`, label: field.label })),
    ...new Map(leadRows.flatMap((lead) => (lead.customFields ?? []).map((field) => [`custom:${field.key}`, { key: `custom:${field.key}`, label: field.label }] as const))).values()
  ].map((field) => [field.key, field])).values());
}
