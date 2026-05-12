'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { ModuleShell } from '../../../components/common/WorkspacePrimitives';
import { apiRequest, apiText } from '../../../lib/api';
import { ConnectorsView } from './ConnectorsView';
import { SettingsFrame } from './SettingsFrame';
import { SettingsActivityTypesPage } from './settings/SettingsActivityTypesPage';
import { SettingsFieldsPage } from './settings/SettingsFieldsPage';
import { SettingsListsPage } from './settings/SettingsListsPage';
import { SettingsSecurityPage } from './settings/SettingsSecurityPage';
import { SettingsUploadHistoryPage } from './settings/SettingsUploadHistoryPage';
import { AccessOverview, ActivityTypeConfig, CsvUploadConfig, CustomFieldDefinition, DispositionFormField, MandatoryRule, SecurityOverview, SecurityUserRow, SettingsUploadDetailRow, SettingsUploadRow, TaskLists } from './settings/settings-types';
import { customFieldModules, customFieldTypes, defaultLeadLists, defaultTaskLists, formatDate, labelForFieldType, labelForModule, parseDefaultValue, rawUploadValue } from './settings/settings-utils';
import { UsersView } from './UsersView';

const settingsRoutes = [
  { value: 'access', label: 'Users & Access', path: '/settings/users', description: 'Roles, teams, sales groups, and permission templates.' },
  { value: 'connectors', label: 'Connectors', path: '/settings/connectors', description: 'Telephony, API calls, WhatsApp, voicebot, and request logs.' },
  { value: 'fields', label: 'Fields & Disposition', path: '/settings/fields', description: 'Custom fields, mandatory fields, and disposition form schema.' },
  { value: 'activity-types', label: 'Activity Types', path: '/settings/activity-types', description: 'Activity type visibility, labels, and manual creation rules.' },
  { value: 'lists', label: 'List Values', path: '/settings/lists', description: 'Configurable lead statuses, categories, and dispositions.' },
  { value: 'uploads', label: 'Upload History', path: '/settings/uploads', description: 'CSV upload batches, result files, and failed row reports.' },
  { value: 'security', label: 'Security', path: '/settings/security', description: 'Login, OTP, 2FA, and operations-center controls.' }
];

const defaultCsvUploadConfig: CsvUploadConfig = {
  requiredColumns: ['customer_name', 'mobile_number', 'loan_id', 'branch_code', 'loan_offer_amount', 'upload_date', 'offer_expiry_date'],
  duplicateKeyFields: ['mobile', 'externalLeadId'],
  defaultMapping: {}
};

function settingsTabFromPath(pathname: string) {
  const route = settingsRoutes.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  return route?.value ?? 'access';
}

export function SettingsView({ authToken, accessOverview: initialAccessOverview = {}, onRefreshAccess, initialTab = 'access' }: { authToken: string | null; accessOverview?: AccessOverview; onRefreshAccess?: () => void; initialTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [accessOverview, setAccessOverview] = useState<AccessOverview>(initialAccessOverview);
  const [fieldModule, setFieldModule] = useState<CustomFieldDefinition['moduleName']>('Lead');
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [settingsUploads, setSettingsUploads] = useState<SettingsUploadRow[]>([]);
  const [selectedUploadReport, setSelectedUploadReport] = useState<{ fileName: string; rows: SettingsUploadDetailRow[] } | null>(null);
  const [leadLists, setLeadLists] = useState(defaultLeadLists);
  const [taskLists, setTaskLists] = useState<TaskLists>(defaultTaskLists);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeConfig[]>([]);
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview>({});
  const [dispositionFormFields, setDispositionFormFields] = useState<DispositionFormField[]>([]);
  const [dispositionFieldForm, setDispositionFieldForm] = useState({ fieldKey: '', label: '', fieldType: 'text', isRequired: false, options: '' });
  const [mandatoryRules, setMandatoryRules] = useState<MandatoryRule[]>([]);
  const [csvUploadConfig, setCsvUploadConfig] = useState<CsvUploadConfig>(defaultCsvUploadConfig);
  const [mandatoryRuleForm, setMandatoryRuleForm] = useState({
    moduleName: 'Lead' as CustomFieldDefinition['moduleName'],
    fieldKey: '',
    roleId: '',
    teamId: '',
    context: '',
    isRequired: true,
    isActive: true
  });
  const [leadListText, setLeadListText] = useState({ status: '', category: '', disposition: '' });
  const [taskListText, setTaskListText] = useState({ type: '', status: '' });
  const [activityTypeForm, setActivityTypeForm] = useState<Omit<ActivityTypeConfig, 'code' | 'isSystem'>>({
    label: '',
    isActive: true,
    showInGlobalList: true,
    showInLeadDetail: true,
    allowManualCreate: true
  });
  const settingsTab = settingsTabFromPath(pathname || settingsRoutes.find((route) => route.value === initialTab)?.path || '/settings/users');
  const [fieldForm, setFieldForm] = useState({
    activityTypeCode: 'ALL',
    label: '',
    fieldKey: '',
    fieldType: 'text' as CustomFieldDefinition['fieldType'],
    isRequired: false,
    displayOrder: '10',
    defaultValue: '',
    options: '',
    validation: ''
  });
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);

  const loadAccessOverview = useCallback(async () => {
    if (!authToken) {
      setAccessOverview({});
      return;
    }
    try {
      const payload = await apiRequest<AccessOverview>('/access/overview', { token: authToken });
      setAccessOverview(payload ?? {});
      onRefreshAccess?.();
    } catch {
      setAccessOverview({});
    }
  }, [authToken, onRefreshAccess]);

  const loadCustomFields = useCallback(async () => {
    try {
      const payload = await apiRequest<CustomFieldDefinition[]>(`/custom-fields/definitions?moduleName=${fieldModule}`, { token: authToken });
      setCustomFields(Array.isArray(payload) ? payload : []);
    } catch {
      setCustomFields([]);
    }
  }, [authToken, fieldModule]);

  const loadLeadLists = useCallback(async () => {
    try {
      const payload = await apiRequest<typeof defaultLeadLists>('/settings/lead-lists', { token: authToken });
      const nextLists = {
        status: Array.isArray(payload.status) ? payload.status : defaultLeadLists.status,
        category: Array.isArray(payload.category) ? payload.category : defaultLeadLists.category,
        disposition: Array.isArray(payload.disposition) ? payload.disposition : defaultLeadLists.disposition
      };
      if (!Array.isArray(payload.status) || !Array.isArray(payload.category) || !Array.isArray(payload.disposition)) {
        setSettingsMessage('Some list values were missing from settings. Seed defaults are shown for missing lists.');
      }
      setLeadLists(nextLists);
      setLeadListText({
        status: nextLists.status.join(', '),
        category: nextLists.category.join(', '),
        disposition: nextLists.disposition.join(', ')
      });
    } catch {
      setLeadLists(defaultLeadLists);
      setLeadListText({
        status: defaultLeadLists.status.join(', '),
        category: defaultLeadLists.category.join(', '),
        disposition: defaultLeadLists.disposition.join(', ')
      });
      setSettingsMessage('Could not load configured list values. Seed defaults are shown until settings load.');
    }
  }, [authToken]);

  const loadTaskLists = useCallback(async () => {
    try {
      const payload = await apiRequest<TaskLists>('/settings/task-lists', { token: authToken });
      const nextLists = {
        type: Array.isArray(payload.type) ? payload.type : defaultTaskLists.type,
        status: Array.isArray(payload.status) ? payload.status : defaultTaskLists.status
      };
      setTaskLists(nextLists);
      setTaskListText({
        type: nextLists.type.join(', '),
        status: nextLists.status.join(', ')
      });
    } catch {
      setTaskLists(defaultTaskLists);
      setTaskListText({
        type: defaultTaskLists.type.join(', '),
        status: defaultTaskLists.status.join(', ')
      });
      setSettingsMessage('Could not load configured task values. Seed defaults are shown until settings load.');
    }
  }, [authToken]);

  const loadActivityTypes = useCallback(async () => {
    try {
      const payload = await apiRequest<ActivityTypeConfig[]>('/settings/activity-types', { token: authToken });
      setActivityTypes(Array.isArray(payload) ? payload : []);
    } catch {
      setActivityTypes([]);
      setSettingsMessage('Could not load activity type configuration.');
    }
  }, [authToken]);

  const loadDispositionForm = useCallback(async () => {
    try {
      const payload = await apiRequest<{ fields?: DispositionFormField[] }>('/settings/disposition-form', { token: authToken });
      setDispositionFormFields(Array.isArray(payload.fields) ? payload.fields : []);
    } catch {
      setDispositionFormFields([]);
    }
  }, [authToken]);

  const loadMandatoryRules = useCallback(async () => {
    try {
      const payload = await apiRequest<MandatoryRule[]>('/settings/mandatory-rules', { token: authToken });
      setMandatoryRules(Array.isArray(payload) ? payload : []);
    } catch {
      setMandatoryRules([]);
    }
  }, [authToken]);

  const loadCsvUploadConfig = useCallback(async () => {
    try {
      const payload = await apiRequest<CsvUploadConfig>('/settings/csv-upload-config', { token: authToken });
      setCsvUploadConfig({
        requiredColumns: Array.isArray(payload.requiredColumns) ? payload.requiredColumns : defaultCsvUploadConfig.requiredColumns,
        duplicateKeyFields: Array.isArray(payload.duplicateKeyFields) ? payload.duplicateKeyFields : defaultCsvUploadConfig.duplicateKeyFields,
        defaultMapping: payload.defaultMapping && typeof payload.defaultMapping === 'object' ? payload.defaultMapping : {}
      });
    } catch {
      setCsvUploadConfig(defaultCsvUploadConfig);
    }
  }, [authToken]);

  const loadUploadHistory = useCallback(async () => {
    try {
      const payload = await apiRequest<SettingsUploadRow[]>('/uploads', { token: authToken });
      setSettingsUploads(Array.isArray(payload) ? payload : []);
    } catch {
      setSettingsUploads([]);
    }
  }, [authToken]);

  const loadSecurityOverview = useCallback(async () => {
    try {
      const payload = await apiRequest<SecurityOverview>('/settings/security', { token: authToken });
      setSecurityOverview(payload ?? {});
    } catch {
      setSecurityOverview({});
    }
  }, [authToken]);

  useEffect(() => {
    if (settingsTab === 'access' || settingsTab === 'fields') void loadAccessOverview();
    if (settingsTab === 'fields') {
      void loadCustomFields();
      void loadDispositionForm();
      void loadMandatoryRules();
      void loadCsvUploadConfig();
    }
    if (settingsTab === 'lists') {
      void loadLeadLists();
      void loadTaskLists();
    }
    if (settingsTab === 'activity-types') void loadActivityTypes();
    if (settingsTab === 'uploads') void loadUploadHistory();
    if (settingsTab === 'security') void loadSecurityOverview();
  }, [loadAccessOverview, loadActivityTypes, loadCsvUploadConfig, loadCustomFields, loadDispositionForm, loadLeadLists, loadMandatoryRules, loadSecurityOverview, loadTaskLists, loadUploadHistory, settingsTab]);

  const refreshActiveSettingsTab = () => {
    if (settingsTab === 'fields') {
      void loadCustomFields();
      void loadDispositionForm();
      void loadMandatoryRules();
      void loadCsvUploadConfig();
    } else if (settingsTab === 'lists') {
      void loadLeadLists();
      void loadTaskLists();
    } else if (settingsTab === 'activity-types') {
      void loadActivityTypes();
    } else if (settingsTab === 'uploads') {
      void loadUploadHistory();
    } else if (settingsTab === 'security') {
      void loadSecurityOverview();
    } else if (settingsTab === 'access') {
      void loadAccessOverview();
    }
  };

  const changeSettingsTab = (tab: string) => {
    const route = settingsRoutes.find((item) => item.value === tab);
    if (route) {
      router.push(route.path);
    }
  };

  const createCustomField = async () => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const validation = fieldForm.validation.trim() ? JSON.parse(fieldForm.validation) : undefined;
      const options = fieldForm.options.trim() ? fieldForm.options.split(',').map((entry) => entry.trim()).filter(Boolean) : undefined;
      const body = {
        moduleName: fieldModule,
        ...(fieldModule === 'Activity' ? { activityTypeCode: fieldForm.activityTypeCode || 'ALL' } : {}),
        fieldKey: fieldForm.fieldKey,
        label: fieldForm.label,
        fieldType: fieldForm.fieldType,
        isRequired: fieldForm.isRequired,
        displayOrder: Number(fieldForm.displayOrder || 0),
        defaultValue: parseDefaultValue(fieldForm.fieldType, fieldForm.defaultValue),
        options,
        validation
      };
      await apiRequest('/custom-fields/definitions', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setSettingsMessage('Custom field saved');
      setFieldForm({ activityTypeCode: 'ALL', label: '', fieldKey: '', fieldType: 'text', isRequired: false, displayOrder: '10', defaultValue: '', options: '', validation: '' });
      await loadCustomFields();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not save field');
    } finally {
      setSavingField(false);
    }
  };

  const updateCustomField = async (field: CustomFieldDefinition, patch: Partial<CustomFieldDefinition>) => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest(`/custom-fields/definitions/${field.moduleName}/${field.id}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      setSettingsMessage('Custom field updated');
      await loadCustomFields();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not update field');
    } finally {
      setSavingField(false);
    }
  };

  const saveLeadList = async (type: 'status' | 'category' | 'disposition') => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const values = leadListText[type].split(',').map((entry) => entry.trim()).filter(Boolean);
      const payload = await apiRequest<{ values?: string[] }>(`/settings/lead-lists/${type}`, {
        token: authToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      });
      setLeadLists({ ...leadLists, [type]: payload.values ?? values });
      setLeadListText({ ...leadListText, [type]: (payload.values ?? values).join(', ') });
      setSettingsMessage('List values saved');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not save list values');
    } finally {
      setSavingField(false);
    }
  };

  const saveTaskList = async (type: 'type' | 'status') => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const values = taskListText[type].split(',').map((entry) => entry.trim()).filter(Boolean);
      const payload = await apiRequest<{ values?: string[] }>(`/settings/task-lists/${type}`, {
        token: authToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      });
      setTaskLists({ ...taskLists, [type]: payload.values ?? values });
      setTaskListText({ ...taskListText, [type]: (payload.values ?? values).join(', ') });
      setSettingsMessage('Task list values saved');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not save task list values');
    } finally {
      setSavingField(false);
    }
  };

  const createActivityType = async () => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest('/settings/activity-types', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityTypeForm)
      });
      setActivityTypeForm({ label: '', isActive: true, showInGlobalList: true, showInLeadDetail: true, allowManualCreate: true });
      setSettingsMessage('Activity type created');
      await loadActivityTypes();
      return true;
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not create activity type');
      return false;
    } finally {
      setSavingField(false);
    }
  };

  const updateActivityType = async (type: ActivityTypeConfig, patch: Partial<ActivityTypeConfig>) => {
    const previous = activityTypes;
    const next = activityTypes.map((entry) => entry.code === type.code ? { ...entry, ...patch } : entry);
    setActivityTypes(next);
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest(`/settings/activity-types/${encodeURIComponent(type.code)}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...type, ...patch })
      });
      setSettingsMessage('Activity type updated');
      return true;
    } catch (error) {
      setActivityTypes(previous);
      setSettingsMessage(error instanceof Error ? error.message : 'Could not update activity type');
      return false;
    } finally {
      setSavingField(false);
    }
  };

  const deactivateActivityType = async (code: string) => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest(`/settings/activity-types/${encodeURIComponent(code)}/deactivate`, {
        token: authToken,
        method: 'PATCH'
      });
      setSettingsMessage('Activity type deactivated');
      await loadActivityTypes();
      return true;
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not deactivate activity type');
      return false;
    } finally {
      setSavingField(false);
    }
  };

  const addDispositionField = async () => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const payload = await apiRequest<{ fields?: DispositionFormField[] }>('/settings/disposition-form/fields', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldKey: dispositionFieldForm.fieldKey,
          label: dispositionFieldForm.label,
          fieldType: dispositionFieldForm.fieldType,
          isRequired: dispositionFieldForm.isRequired,
          options: dispositionFieldForm.options.split(',').map((entry) => entry.trim()).filter(Boolean),
          isActive: true
        })
      });
      setDispositionFormFields(payload.fields ?? []);
      setDispositionFieldForm({ fieldKey: '', label: '', fieldType: 'text', isRequired: false, options: '' });
      setSettingsMessage('Disposition field saved');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not add disposition field');
    } finally {
      setSavingField(false);
    }
  };

  const deactivateDispositionField = async (fieldKey: string) => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const payload = await apiRequest<{ fields?: DispositionFormField[] }>(`/settings/disposition-form/fields/${fieldKey}/deactivate`, {
        token: authToken,
        method: 'PATCH',
      });
      setDispositionFormFields(payload.fields ?? []);
      setSettingsMessage('Disposition field updated');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not deactivate disposition field');
    } finally {
      setSavingField(false);
    }
  };

  const updateDispositionField = async (fieldKey: string) => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const nextFields = dispositionFormFields.map((field) => (
        field.fieldKey === fieldKey
          ? {
              ...field,
              label: dispositionFieldForm.label,
              fieldType: dispositionFieldForm.fieldType,
              isRequired: dispositionFieldForm.isRequired,
              options: dispositionFieldForm.options.split(',').map((entry) => entry.trim()).filter(Boolean),
              isActive: true
            }
          : field
      ));
      const payload = await apiRequest<{ fields?: DispositionFormField[] }>('/settings/disposition-form', {
        token: authToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: nextFields })
      });
      setDispositionFormFields(payload.fields ?? []);
      setSettingsMessage('Disposition field updated');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not update disposition field');
    } finally {
      setSavingField(false);
    }
  };

  const createMandatoryRule = async () => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest('/settings/mandatory-rules', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleName: mandatoryRuleForm.moduleName,
          fieldKey: mandatoryRuleForm.fieldKey,
          roleId: mandatoryRuleForm.roleId || undefined,
          teamId: mandatoryRuleForm.teamId || undefined,
          context: mandatoryRuleForm.context || undefined,
          isRequired: mandatoryRuleForm.isRequired,
          isActive: mandatoryRuleForm.isActive
        })
      });
      setSettingsMessage('Mandatory rule saved');
      await loadMandatoryRules();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not save mandatory rule');
    } finally {
      setSavingField(false);
    }
  };

  const updateMandatoryRule = async (ruleId: string) => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest(`/settings/mandatory-rules/${ruleId}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleName: mandatoryRuleForm.moduleName,
          fieldKey: mandatoryRuleForm.fieldKey,
          roleId: mandatoryRuleForm.roleId || undefined,
          teamId: mandatoryRuleForm.teamId || undefined,
          context: mandatoryRuleForm.context || undefined,
          isRequired: mandatoryRuleForm.isRequired,
          isActive: mandatoryRuleForm.isActive
        })
      });
      setSettingsMessage('Mandatory rule updated');
      await loadMandatoryRules();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not update mandatory rule');
    } finally {
      setSavingField(false);
    }
  };

  const deactivateMandatoryRule = async (ruleId: string) => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      await apiRequest(`/settings/mandatory-rules/${ruleId}/deactivate`, {
        token: authToken,
        method: 'PATCH'
      });
      setSettingsMessage('Mandatory rule deactivated');
      await loadMandatoryRules();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not deactivate mandatory rule');
    } finally {
      setSavingField(false);
    }
  };

  const saveCsvUploadConfig = async () => {
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const payload = await apiRequest<CsvUploadConfig>('/settings/csv-upload-config', {
        token: authToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csvUploadConfig)
      });
      setCsvUploadConfig(payload ?? csvUploadConfig);
      setSettingsMessage('CSV upload rules saved');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not save CSV upload rules');
    } finally {
      setSavingField(false);
    }
  };

  const downloadUploadCsv = async (uploadId: string, kind: 'result-csv' | 'original-csv') => {
    setSettingsMessage(null);
    try {
      const text = await apiText(`/uploads/${uploadId}/${kind}`, { token: authToken });
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = kind === 'result-csv' ? 'lead-upload-result.csv' : 'lead-upload-original.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not download CSV');
    }
  };

  const loadUploadIssueReport = async (upload: SettingsUploadRow) => {
    setSettingsMessage(null);
    try {
      const payload = await apiRequest<{ rows?: SettingsUploadDetailRow[] }>(`/uploads/${upload.id}`, { token: authToken });
      const issueRows = Array.isArray(payload.rows)
        ? payload.rows.filter((row: SettingsUploadDetailRow) => row.uploadStatus !== 'imported')
        : [];
      setSelectedUploadReport({ fileName: upload.fileName, rows: issueRows });
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not load upload report');
    }
  };

  const setAccountTwoFactor = async (enabled: boolean) => {
    const previous = securityOverview.accountTwoFactorEnabled;
    setSecurityOverview((current) => ({ ...current, accountTwoFactorEnabled: enabled }));
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const payload = await apiRequest<{ accountTwoFactorEnabled?: boolean }>('/settings/security/two-factor/account', {
        token: authToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      setSecurityOverview((current) => ({ ...current, accountTwoFactorEnabled: Boolean(payload.accountTwoFactorEnabled) }));
      setSettingsMessage('Security settings saved');
    } catch (error) {
      setSecurityOverview((current) => ({ ...current, accountTwoFactorEnabled: previous }));
      setSettingsMessage(error instanceof Error ? error.message : 'Could not update security');
      void loadSecurityOverview();
    } finally {
      setSavingField(false);
    }
  };

  const setUserTwoFactor = async (userId: string, patch: { enabled?: boolean; disabledByAdmin?: boolean }) => {
    const previousUsers = securityOverview.users ?? [];
    setSecurityOverview((current) => ({
      ...current,
      users: (current.users ?? []).map((entry) => {
        if (entry.id !== userId) return entry;
        return {
          ...entry,
          ...(patch.enabled === undefined ? {} : { twoFactorEnabled: patch.enabled }),
          ...(patch.disabledByAdmin === undefined ? {} : { twoFactorDisabledByAdmin: patch.disabledByAdmin })
        };
      })
    }));
    setSavingField(true);
    setSettingsMessage(null);
    try {
      const user = await apiRequest<SecurityUserRow>(`/settings/security/users/${userId}/two-factor`, {
        token: authToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      setSecurityOverview((current) => ({
        ...current,
        users: (current.users ?? []).map((entry) => (entry.id === userId ? user : entry))
      }));
      setSettingsMessage('User 2FA setting saved');
    } catch (error) {
      setSecurityOverview((current) => ({ ...current, users: previousUsers }));
      setSettingsMessage(error instanceof Error ? error.message : 'Could not update user 2FA');
      void loadSecurityOverview();
    } finally {
      setSavingField(false);
    }
  };

  return (
    <ModuleShell title="Settings" subtitle="Configure access, lead fields, dispositions, uploads, connectors, and security policies.">
      <SettingsFrame
        routes={settingsRoutes}
        active={settingsTab}
        onChange={changeSettingsTab}
        onRefresh={refreshActiveSettingsTab}
        message={<MessageAlert message={settingsMessage} />}
      >
        {settingsTab === 'access' ? (
          <UsersView accessOverview={accessOverview} authToken={authToken} onRefresh={loadAccessOverview} embedded />
        ) : null}
        {settingsTab === 'connectors' ? (
          <ConnectorsView authToken={authToken} embedded />
        ) : null}
        {settingsTab === 'fields' ? (
          <SettingsFieldsPage
            fieldModule={fieldModule}
            setFieldModule={setFieldModule}
            customFieldModules={customFieldModules}
            customFieldTypes={customFieldTypes}
            labelForModule={labelForModule}
            labelForFieldType={labelForFieldType}
            fieldForm={fieldForm}
            setFieldForm={setFieldForm}
            savingField={savingField}
            createCustomField={createCustomField}
            customFields={customFields}
            updateCustomField={updateCustomField}
            dispositionFieldForm={dispositionFieldForm}
            setDispositionFieldForm={setDispositionFieldForm}
            addDispositionField={addDispositionField}
            updateDispositionField={updateDispositionField}
            dispositionFormFields={dispositionFormFields}
            deactivateDispositionField={deactivateDispositionField}
            mandatoryRuleForm={mandatoryRuleForm}
            setMandatoryRuleForm={setMandatoryRuleForm}
            mandatoryRules={mandatoryRules}
            roles={accessOverview.roles ?? []}
            teams={accessOverview.teams ?? []}
            createMandatoryRule={createMandatoryRule}
            updateMandatoryRule={updateMandatoryRule}
            deactivateMandatoryRule={deactivateMandatoryRule}
            csvUploadConfig={csvUploadConfig}
            setCsvUploadConfig={setCsvUploadConfig}
            saveCsvUploadConfig={saveCsvUploadConfig}
            activityTypes={activityTypes}
          />
        ) : null}
        {settingsTab === 'activity-types' ? (
          <SettingsActivityTypesPage
            activityTypes={activityTypes}
            activityTypeForm={activityTypeForm}
            setActivityTypeForm={setActivityTypeForm}
            savingField={savingField}
            createActivityType={createActivityType}
            updateActivityType={updateActivityType}
            deactivateActivityType={deactivateActivityType}
          />
        ) : null}
        {settingsTab === 'lists' ? (
          <SettingsListsPage
            leadLists={leadLists}
            taskLists={taskLists}
            leadListText={leadListText}
            taskListText={taskListText}
            setLeadListText={setLeadListText}
            setTaskListText={setTaskListText}
            savingField={savingField}
            saveLeadList={saveLeadList}
            saveTaskList={saveTaskList}
          />
        ) : null}
        {settingsTab === 'uploads' ? (
          <SettingsUploadHistoryPage
            settingsUploads={settingsUploads}
            selectedUploadReport={selectedUploadReport}
            formatDate={formatDate}
            rawUploadValue={rawUploadValue}
            loadUploadIssueReport={loadUploadIssueReport}
            downloadUploadCsv={downloadUploadCsv}
            closeUploadIssueReport={() => setSelectedUploadReport(null)}
          />
        ) : null}
        {settingsTab === 'security' ? (
          <SettingsSecurityPage securityOverview={securityOverview} saving={savingField} setAccountTwoFactor={setAccountTwoFactor} setUserTwoFactor={setUserTwoFactor} />
        ) : null}
      </SettingsFrame>
    </ModuleShell>
  );
}
