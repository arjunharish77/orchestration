'use client';

import { CrmRoute } from '../../../features/crm/CrmRoute';

export default function SettingsUsersPage() {
  return <CrmRoute view="settings" settingsTab="access" />;
}
