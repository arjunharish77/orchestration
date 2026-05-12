'use client';

import { formatAmount, formatDate } from '../../../lib/format';

export type LeadCustomFieldValue = {
  key: string;
  label: string;
  value: unknown;
};

export type LeadRow = {
  id: string;
  dbId?: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  branchName: string;
  amount: string;
  emi: string;
  status: string;
  category: string;
  source: string;
  created: string;
  owner: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  team: string;
  language: string;
  location?: string;
  uploadDate?: string;
  offerExpiryDate?: string;
  disposition?: string;
  customFields?: LeadCustomFieldValue[];
};

export function formatLeadDate(value?: string | null) {
  return formatDate(value);
}

export function formatLeadAmount(value?: number | string | null) {
  return formatAmount(value);
}

export function cleanLeadFormValue(value?: string | null) {
  return value && value !== '-' ? value : '';
}

export function toLeadRows(apiLeads: any[]): LeadRow[] {
  return apiLeads.map((lead) => ({
    id: lead.externalLeadId ?? lead.id,
    dbId: lead.id,
    initials: String(lead.customerName ?? 'L').charAt(0).toUpperCase(),
    name: lead.customerName ?? 'Unnamed Lead',
    email: lead.email ?? '-',
    phone: lead.mobile ?? '-',
    branch: lead.branchCode ?? '-',
    branchName: lead.branchName ?? lead.team?.name ?? '-',
    amount: formatLeadAmount(lead.offerAmount),
    emi: formatLeadAmount(lead.emiAmount),
    status: lead.status ?? 'New',
    category: lead.category ?? '-',
    source: lead.uploadBatch?.fileName ? 'CSV' : 'Direct',
    created: formatLeadDate(lead.createdAt),
    owner: lead.assignedUserName ?? lead.assignedUser?.name ?? 'System',
    assignedUserId: lead.assignedUserId ?? null,
    assignedUserName: lead.assignedUserName ?? null,
    team: lead.team?.name ?? '-',
    language: lead.preferredLanguage ?? '-',
    location: lead.location ?? '-',
    uploadDate: formatLeadDate(lead.uploadDate),
    offerExpiryDate: formatLeadDate(lead.offerExpiryDate),
    disposition: lead.disposition ?? '-',
    customFields: Array.isArray(lead.customFields) ? lead.customFields : []
  }));
}

export function toLeadRow(apiLead: any): LeadRow {
  return toLeadRows([apiLead])[0];
}
