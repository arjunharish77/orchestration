import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/features/crm/CrmApp.tsx',
  'src/features/crm/CrmRoute.tsx',
  'src/components/layout/CrmShell.tsx',
  'src/components/common/AppChip.tsx',
  'src/components/common/AppButton.tsx',
  'src/components/common/CompactDataTable.tsx',
  'src/components/common/TableToolbar.tsx',
  'src/components/common/FormDialog.tsx',
  'src/components/common/ConfirmDialog.tsx',
  'src/components/settings/SettingsSidebar.tsx',
  'src/features/crm/views/LeadsView.tsx',
  'src/features/crm/views/LeadDetailView.tsx',
  'src/features/crm/views/AutomationView.tsx',
  'src/features/crm/views/SettingsView.tsx',
  'src/features/crm/views/settings/SettingsFieldsPage.tsx',
  'src/features/crm/views/settings/SettingsListsPage.tsx',
  'src/features/crm/views/settings/SettingsUploadHistoryPage.tsx',
  'src/features/crm/views/settings/SettingsSecurityPage.tsx',
  'src/app/dashboard/page.tsx',
  'src/app/leads/page.tsx',
  'src/app/leads/[id]/page.tsx',
  'src/app/activities/page.tsx',
  'src/app/uploads/page.tsx',
  'src/app/tasks/page.tsx',
  'src/app/automation/page.tsx',
  'src/app/reports/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/settings/users/page.tsx',
  'src/app/settings/connectors/page.tsx',
  'src/app/settings/fields/page.tsx',
  'src/app/settings/lists/page.tsx',
  'src/app/settings/uploads/page.tsx',
  'src/app/settings/security/page.tsx',
  'src/app/login/page.tsx',
  'src/app/ops-login/page.tsx'
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required frontend file: ${file}`);
}

const appShim = read('src/app/crm-app.tsx');
assert(appShim.includes("from '../features/crm/CrmApp'"), 'src/app/crm-app.tsx must remain a thin compatibility shim');
assert(!appShim.includes('Opening Unnatify'), 'Opening Unnatify loader copy should not return');

const compactTable = read('src/components/common/CompactDataTable.tsx');
assert(compactTable.includes('GridRowSelectionModel'), 'CompactDataTable must use the MUI v8 row-selection model');
assert(compactTable.includes('aria-label'), 'CompactDataTable must expose an accessible table label');

const settingsFields = read('src/features/crm/views/settings/SettingsFieldsPage.tsx');
assert(settingsFields.includes("activeSection"), 'Settings fields route must use focused route-section tabs');
assert(settingsFields.includes('Mandatory Field Rules'), 'Settings fields route must expose mandatory-field rules');

const uploads = read('src/features/crm/views/settings/SettingsUploadHistoryPage.tsx');
assert(uploads.includes('FormDialog'), 'Upload issue rows must open in a dialog instead of inline crowding');

const automation = read('src/features/crm/views/AutomationView.tsx');
assert(automation.includes('normalizeCustomFieldDefinitions'), 'Automation custom-field mappings must tolerate partial API rows');

const usersRedirect = read('src/app/users/page.tsx');
assert(usersRedirect.includes("redirect('/settings/users')"), 'Legacy /users route must deep-link to Settings > Users & Access');

const apiClient = read('src/lib/api.ts');
assert(apiClient.includes('requiredPublicEnv'), 'Frontend API client must fail fast when NEXT_PUBLIC_API_URL is missing in production');

const frontendDockerfile = read('../frontend/Dockerfile');
assert(frontendDockerfile.includes('ARG NEXT_PUBLIC_API_URL'), 'Frontend Docker build must accept NEXT_PUBLIC_API_URL as a build argument');

const compose = read('../docker-compose.yml');
assert(compose.includes('NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}'), 'docker-compose must pass NEXT_PUBLIC_API_URL into the frontend build');

console.log('[frontend-architecture-smoke] passed');

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
