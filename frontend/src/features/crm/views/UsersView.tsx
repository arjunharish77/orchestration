'use client';

import AutorenewIcon from '@mui/icons-material/Autorenew';
import { Stack } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { StatusChip } from '../../../components/common/StatusChip';
import { CapsuleButton } from '../../../components/common/CapsuleButton';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { ModuleShell, SegmentedTabs } from '../../../components/common/WorkspacePrimitives';
import { apiRequest } from '../../../lib/api';
import { normalizeOptions } from '../../../lib/field-metadata';
import { PermissionsTab } from './users/PermissionsTab';
import { SalesGroupsTab } from './users/SalesGroupsTab';
import { TeamsTab } from './users/TeamsTab';
import { UsersTab } from './users/UsersTab';
import { activityTypeOptions } from './activities/activity-columns';
import { AccessOverview, AccessPermissionTemplate, AccessUser, CustomFieldDefinition } from './settings/settings-types';
import { customFieldModules, humanizeKey, labelForModule } from './settings/settings-utils';

const moduleOptions = ['Dashboard', 'Lead', 'Activity', 'Task', 'Upload', 'Automation', 'Report', 'Settings', 'User', 'Connector', 'Assignment', 'Audit'];
const teamTypeOptions = ['Team', 'Branch', 'Partner', 'Sales Group', 'Operations'];
type FieldPermissionModule = 'Lead' | 'User' | 'Activity' | 'ActivityType' | 'ActivityTypeField';
const activityTypePermissionActions = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'export', label: 'Export' },
  { key: 'playRecording', label: 'Play Recording' }
];

function parseCustomFieldFormValue(field: CustomFieldDefinition, value: unknown) {
  if (value === '' || value === undefined || value === null) return undefined;
  if (field.fieldType === 'number') return Number(value);
  if (field.fieldType === 'boolean') return Boolean(value);
  if (field.fieldType === 'multi_select') return String(value).split(',').map((entry) => entry.trim()).filter(Boolean);
  if (field.fieldType === 'json' && typeof value === 'string') return JSON.parse(value);
  return value;
}

function customFieldOptions(field: CustomFieldDefinition) {
  return normalizeOptions(field.options);
}

function customFieldValue(record: { customFields?: Array<{ key: string; value: unknown }> }, key: string) {
  const match = record.customFields?.find((field) => field.key === key);
  if (match?.value === undefined || match.value === null || match.value === '') return '-';
  return String(match.value);
}

export function UsersView({ accessOverview: initialAccessOverview = {}, authToken, onRefresh, embedded = false }: { accessOverview?: AccessOverview; authToken: string | null; onRefresh?: () => void; embedded?: boolean }) {
  const [accessOverview, setAccessOverview] = useState<AccessOverview>(initialAccessOverview);
  const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', password: '', roleId: '', teamId: '', permissionTemplateId: '', salesGroupIds: [] as string[] });
  const [userCustomValues, setUserCustomValues] = useState<Record<string, unknown>>({});
  const [teamForm, setTeamForm] = useState({ name: '', code: '', type: 'Team' });
  const [salesGroupName, setSalesGroupName] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', description: '' });
  const [modulePermissionForm, setModulePermissionForm] = useState({
    permissionTemplateId: '',
    moduleName: 'Lead',
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canExport: false,
    canAssign: false,
    canBulkUpload: false,
    canConfigureAutomation: false,
    canManageConnector: false,
    canViewAuditLogs: false
  });
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [fieldPermissionForm, setFieldPermissionForm] = useState({
    permissionTemplateId: '',
    moduleName: 'Lead' as FieldPermissionModule,
    fieldKey: '',
    access: 'editable'
  });
  const [accessTab, setAccessTab] = useState('users');
  const [visibleUserFields, setVisibleUserFields] = useState(['name', 'role', 'team', 'salesGroups', 'phone', 'status']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadAccessOverview = useCallback(async () => {
    if (!authToken) {
      setAccessOverview({});
      return;
    }
    try {
      const payload = await apiRequest<AccessOverview>('/access/overview', { token: authToken });
      setAccessOverview(payload ?? {});
      onRefresh?.();
    } catch {
      setAccessOverview({});
    }
  }, [authToken, onRefresh]);

  useEffect(() => {
    void loadAccessOverview();
  }, [loadAccessOverview]);

  const roles = accessOverview.roles ?? [];
  const teams = accessOverview.teams ?? [];
  const salesGroups = accessOverview.salesGroups ?? [];
  const permissionTemplates = accessOverview.permissionTemplates ?? [];
  const userFieldDefinitions = fieldDefinitions.filter((field) => field.moduleName === 'User');
  const activityTypePermissionFields = activityTypeOptions.flatMap((type) =>
    activityTypePermissionActions
      .filter((action) => (['001', '013'].includes(type.code) ? !['create', 'edit', 'delete'].includes(action.key) : true))
      .map((action) => ({
        id: `activity-type-${type.code}-${action.key}`,
        fieldKey: `${type.code}.${action.key}`,
        label: `${type.code} · ${type.label}: ${action.label}`
      }))
  );
  const activityTypeFieldPermissionFields = activityTypeOptions.flatMap((type) =>
    fieldDefinitions
      .filter((field) => field.moduleName === 'Activity')
      .map((field) => ({
        id: `activity-type-field-${type.code}-${field.fieldKey}`,
        fieldKey: `${type.code}.${field.fieldKey}`,
        label: `${type.code} · ${type.label}: ${field.label}`
      }))
  );
  const matchingFieldDefinitions = fieldPermissionForm.moduleName === 'ActivityType'
    ? activityTypePermissionFields
    : fieldPermissionForm.moduleName === 'ActivityTypeField'
      ? activityTypeFieldPermissionFields
      : [
          ...(fieldPermissionForm.moduleName === 'Lead'
            ? [{ id: 'lead-record-scope-all', fieldKey: '__recordScope.allLeads', label: 'All Leads Scope' }]
            : []),
          ...fieldDefinitions.filter((field) => field.moduleName === fieldPermissionForm.moduleName)
        ];
  const userFieldOptions = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'team', label: 'Team' },
    { key: 'salesGroups', label: 'Sales Groups' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    ...userFieldDefinitions.map((field) => ({ key: `custom:${field.fieldKey}`, label: field.label }))
  ];
  const userLabelByKey = new Map(userFieldOptions.map((field) => [field.key, field.label]));
  const renderUserCell = (user: AccessUser, field: string) => {
    if (field.startsWith('custom:')) return customFieldValue(user, field.replace('custom:', ''));
    if (field === 'role') return user.role?.name ?? '-';
    if (field === 'team') return user.team?.name ?? '-';
    if (field === 'salesGroups') {
      const groups = user.salesGroups ?? [];
      return groups.map((group) => group.salesGroup?.name ?? group.name).filter(Boolean).join(', ') || '-';
    }
    if (field === 'status') return <StatusChip key={`${user.id}-status`} status={user.isActive ? 'Active' : 'Suspended'} />;
    return String((user as Record<string, unknown>)[field] ?? '-');
  };

  useEffect(() => {
    let cancelled = false;

    async function loadFieldDefinitions() {
      try {
        const results = await Promise.all(
          customFieldModules.map((moduleName) =>
            apiRequest<CustomFieldDefinition[]>(`/custom-fields/definitions?moduleName=${moduleName}`, { token: authToken })
          )
        );
        if (!cancelled) setFieldDefinitions(results.flat().filter((field) => field?.isActive));
      } catch {
        if (!cancelled) setFieldDefinitions([]);
      }
    }

    void loadFieldDefinitions();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const postAccess = async <TResponse = unknown,>(path: string, body: Record<string, unknown>) => {
    if (!authToken) throw new Error('Login required');
    setSaving(true);
    setMessage(null);
    try {
      const payload = await apiRequest<TResponse>(path, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setMessage('Saved');
      void loadAccessOverview();
      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const mutateAccess = async <TResponse = unknown,>(path: string, method: 'PATCH' | 'DELETE', body?: Record<string, unknown>) => {
    if (!authToken) throw new Error('Login required');
    setSaving(true);
    setMessage(null);
    try {
      const payload = await apiRequest<TResponse>(path, {
        token: authToken,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      setMessage('Saved');
      void loadAccessOverview();
      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    const customFields = Object.fromEntries(
      userFieldDefinitions
        .map((field) => [field.fieldKey, parseCustomFieldFormValue(field, userCustomValues[field.fieldKey])])
        .filter(([, value]) => value !== undefined)
    );
    const created = await postAccess('/access/users', {
      name: userForm.name,
      email: userForm.email,
      phone: userForm.phone || undefined,
      password: userForm.password || undefined,
      roleId: userForm.roleId || roles[0]?.id,
      teamId: userForm.teamId || undefined,
      permissionTemplateId: userForm.permissionTemplateId || undefined,
      salesGroupIds: userForm.salesGroupIds,
      customFields
    });
    if (created) {
      setUserForm({ name: '', email: '', phone: '', password: '', roleId: '', teamId: '', permissionTemplateId: '', salesGroupIds: [] });
      setUserCustomValues({});
    }
  };

  const updateUser = async (userId: string) => {
    const customFields = Object.fromEntries(
      userFieldDefinitions
        .map((field) => [field.fieldKey, parseCustomFieldFormValue(field, userCustomValues[field.fieldKey])])
        .filter(([, value]) => value !== undefined)
    );
    return mutateAccess(`/access/users/${userId}`, 'PATCH', {
      name: userForm.name,
      email: userForm.email,
      phone: userForm.phone || undefined,
      password: userForm.password || undefined,
      roleId: userForm.roleId || undefined,
      teamId: userForm.teamId || undefined,
      permissionTemplateId: userForm.permissionTemplateId || undefined,
      salesGroupIds: userForm.salesGroupIds,
      customFields
    });
  };

  const deactivateUser = (userId: string) => mutateAccess(`/access/users/${userId}`, 'DELETE');

  const createTeam = async () => {
    const created = await postAccess('/access/teams', { name: teamForm.name, code: teamForm.code || undefined, type: teamForm.type || undefined });
    if (created) setTeamForm({ name: '', code: '', type: 'Team' });
  };

  const updateTeam = (teamId: string) => mutateAccess(`/access/teams/${teamId}`, 'PATCH', { name: teamForm.name, code: teamForm.code || undefined, type: teamForm.type || undefined });
  const deactivateTeam = (teamId: string) => mutateAccess(`/access/teams/${teamId}`, 'DELETE');

  const createSalesGroup = async () => {
    const created = await postAccess('/access/sales-groups', { name: salesGroupName });
    if (created) setSalesGroupName('');
  };

  const updateSalesGroup = (salesGroupId: string) => mutateAccess(`/access/sales-groups/${salesGroupId}`, 'PATCH', { name: salesGroupName });
  const deactivateSalesGroup = (salesGroupId: string) => mutateAccess(`/access/sales-groups/${salesGroupId}`, 'DELETE');

  const createTemplate = async () => {
    const created = await postAccess<AccessPermissionTemplate>('/access/permission-templates', { name: templateForm.name, description: templateForm.description || undefined });
    if (created) {
      setTemplateForm({ name: created.name ?? '', description: created.description ?? '' });
      const templateId = created.id;
      if (templateId) {
        setModulePermissionForm((current) => ({ ...current, permissionTemplateId: templateId }));
        setFieldPermissionForm((current) => ({ ...current, permissionTemplateId: templateId }));
      }
      return created;
    }
    return undefined;
  };

  const updateTemplate = (templateId: string) => mutateAccess(`/access/permission-templates/${templateId}`, 'PATCH', { name: templateForm.name, description: templateForm.description || undefined });
  const deleteTemplate = (templateId: string) => mutateAccess(`/access/permission-templates/${templateId}`, 'DELETE');

  const saveModulePermission = async () => {
    const templateId = modulePermissionForm.permissionTemplateId || permissionTemplates[0]?.id;
    if (!templateId) {
      setMessage('Select a permission template');
      return;
    }
    await postAccess(`/access/permission-templates/${templateId}/modules`, {
      moduleName: modulePermissionForm.moduleName,
      canView: modulePermissionForm.canView,
      canCreate: modulePermissionForm.canCreate,
      canEdit: modulePermissionForm.canEdit,
      canDelete: modulePermissionForm.canDelete,
      canExport: modulePermissionForm.canExport,
      canAssign: modulePermissionForm.canAssign,
      canBulkUpload: modulePermissionForm.canBulkUpload,
      canConfigureAutomation: modulePermissionForm.canConfigureAutomation,
      canManageConnector: modulePermissionForm.canManageConnector,
      canViewAuditLogs: modulePermissionForm.canViewAuditLogs
    });
  };

  const saveModulePermissionFor = async (templateId: string, moduleName: string, permissions: Partial<typeof modulePermissionForm>) => {
    if (!templateId) {
      setMessage('Select a permission template');
      return;
    }
    await postAccess(`/access/permission-templates/${templateId}/modules`, {
      moduleName,
      canView: Boolean(permissions.canView),
      canCreate: Boolean(permissions.canCreate),
      canEdit: Boolean(permissions.canEdit),
      canDelete: Boolean(permissions.canDelete),
      canExport: Boolean(permissions.canExport),
      canAssign: Boolean(permissions.canAssign),
      canBulkUpload: Boolean(permissions.canBulkUpload),
      canConfigureAutomation: Boolean(permissions.canConfigureAutomation),
      canManageConnector: Boolean(permissions.canManageConnector),
      canViewAuditLogs: Boolean(permissions.canViewAuditLogs)
    });
  };

  const saveFieldPermission = async () => {
    const templateId = fieldPermissionForm.permissionTemplateId || permissionTemplates[0]?.id;
    const fieldKey = fieldPermissionForm.fieldKey || matchingFieldDefinitions[0]?.fieldKey;
    if (!templateId || !fieldKey) {
      setMessage('Select a permission template and field');
      return;
    }
    await postAccess('/access/field-permissions', {
      permissionTemplateId: templateId,
      moduleName: fieldPermissionForm.moduleName,
      fieldKey,
      access: fieldPermissionForm.access
    });
  };

  const saveFieldPermissionFor = async (templateId: string, moduleName: FieldPermissionModule, fieldKey: string, access: string) => {
    if (!templateId || !fieldKey) {
      setMessage('Select a permission template and field');
      return;
    }
    await postAccess('/access/field-permissions', {
      permissionTemplateId: templateId,
      moduleName,
      fieldKey,
      access
    });
  };

  const body = (
      <Stack spacing={1}>
        <MessageAlert message={message} />
        <SegmentedTabs
          value={accessTab}
          onChange={setAccessTab}
          tabs={[
            { value: 'users', label: 'Users' },
            { value: 'teams', label: 'Teams' },
            { value: 'groups', label: 'Sales Groups' },
            { value: 'permissions', label: 'Permissions' }
          ]}
        />
        {accessTab === 'users' ? (
          <UsersTab
            embedded={embedded}
            saving={saving}
            userForm={userForm}
            setUserForm={setUserForm}
            roles={roles}
            teams={teams}
            salesGroups={salesGroups}
            permissionTemplates={permissionTemplates}
            userFieldDefinitions={userFieldDefinitions}
            userCustomValues={userCustomValues}
            setUserCustomValues={setUserCustomValues}
            customFieldOptions={customFieldOptions}
            createUser={createUser}
            updateUser={updateUser}
            deactivateUser={deactivateUser}
            onRefresh={loadAccessOverview}
            fieldOptions={userFieldOptions}
            visibleFields={visibleUserFields}
            setVisibleFields={setVisibleUserFields}
            columns={visibleUserFields.map((field) => userLabelByKey.get(field) ?? humanizeKey(field))}
            rows={(accessOverview.users ?? []).map((user) => visibleUserFields.map((field) => renderUserCell(user, field)))}
            users={accessOverview.users ?? []}
          />
        ) : null}
        {accessTab === 'teams' ? (
          <TeamsTab teamForm={teamForm} setTeamForm={setTeamForm} teamTypeOptions={teamTypeOptions} saving={saving} createTeam={createTeam} updateTeam={updateTeam} deactivateTeam={deactivateTeam} teams={teams} />
        ) : null}
        {accessTab === 'groups' ? (
          <SalesGroupsTab salesGroupName={salesGroupName} setSalesGroupName={setSalesGroupName} saving={saving} createSalesGroup={createSalesGroup} updateSalesGroup={updateSalesGroup} deactivateSalesGroup={deactivateSalesGroup} salesGroups={salesGroups} />
        ) : null}
        {accessTab === 'permissions' ? (
          <PermissionsTab
            templateForm={templateForm}
            setTemplateForm={setTemplateForm}
            saving={saving}
            createTemplate={createTemplate}
            updateTemplate={updateTemplate}
            deleteTemplate={deleteTemplate}
            permissionTemplates={permissionTemplates}
            modulePermissionForm={modulePermissionForm}
            setModulePermissionForm={setModulePermissionForm}
            moduleOptions={moduleOptions}
            labelForModule={labelForModule}
            saveModulePermission={saveModulePermission}
            saveModulePermissionFor={saveModulePermissionFor}
            fieldPermissionForm={fieldPermissionForm}
            setFieldPermissionForm={setFieldPermissionForm}
            matchingFieldDefinitions={matchingFieldDefinitions}
            saveFieldPermission={saveFieldPermission}
            saveFieldPermissionFor={saveFieldPermissionFor}
          />
        ) : null}
      </Stack>
  );

  if (embedded) return body;

  return (
    <ModuleShell title="Users & Access" subtitle="Users belong to one team, can be part of sales groups, and inherit permission templates." actions={<CapsuleButton startIcon={<AutorenewIcon />} variant="outlined" onClick={loadAccessOverview}>Refresh</CapsuleButton>}>
      {body}
    </ModuleShell>
  );
}
