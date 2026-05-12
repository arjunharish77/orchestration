'use client';

import { use } from 'react';
import { CrmApp } from './CrmApp';

type CrmRouteProps = {
  view?: 'dashboard' | 'leads' | 'lead-detail' | 'activities' | 'uploads' | 'tasks' | 'automation' | 'reports' | 'settings';
  leadId?: string;
  settingsTab?: string;
};

export function CrmRoute({ view = 'leads', leadId, settingsTab }: CrmRouteProps) {
  return <CrmApp initialView={view} leadId={leadId} initialSettingsTab={settingsTab} />;
}

export function LeadDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CrmRoute view="lead-detail" leadId={id} />;
}
