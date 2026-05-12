'use client';

import { CrmRoute } from '../../features/crm/CrmRoute';

export default function SettingsPage() {
  return <CrmRoute view="settings" settingsTab="access" />;
}
