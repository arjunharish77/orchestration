'use client';

import AddIcon from '@mui/icons-material/Add';
import CallIcon from '@mui/icons-material/Call';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import { Alert, Box, Button, Card, FormControl, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { CapsuleButton } from '../../../components/common/CapsuleButton';
import { CompactTableSkeleton } from '../../../components/common/CompactDataTable';
import { FormDialog } from '../../../components/common/FormDialog';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { ModuleShell } from '../../../components/common/WorkspacePrimitives';
import { apiRequest } from '../../../lib/api';
import { defaultLeadLists, defaultTaskLists } from '../../../lib/crm-defaults';
import { normalizeOptions } from '../../../lib/field-metadata';
import { humanizeKey } from '../../../lib/format';
import { LeadRow, formatLeadDate, toLeadRow } from '../types/lead';
import { LeadProfileCard } from '../components/LeadDetailParts';
import { activityTypeLabels, allActivityTypeOptions, defaultActivityTypeCode, legacyActivityTypeCodes } from './activities/activity-columns';
import {
  LeadActivitiesTab,
  LeadAuditTab,
  LeadAutomationHistoryTab,
  LeadCallsTab,
  LeadDispositionsTab,
  LeadTasksTab
} from './lead-detail/LeadDetailTabs';

const formatDate = formatLeadDate;
type ActivityRow = {
  id: string;
  leadId?: string | null;
  type: string;
  title: string;
  notes?: string | null;
  disposition?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
  customFields?: Array<{ key: string; label: string; value: unknown }>;
};
type ActivityTypeConfig = {
  code: string;
  label: string;
  isSystem?: boolean;
  isActive?: boolean;
  showInGlobalList?: boolean;
  showInLeadDetail?: boolean;
  allowManualCreate?: boolean;
};
type TaskRow = {
  id: string;
  taskType: string;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  remarks?: string | null;
  createdAt?: string;
  comments?: Array<{ id: string; comment: string; createdAt?: string; createdBy?: string | null }>;
};
type AuditLogRow = {
  id: string;
  moduleName: string;
  entityId?: string | null;
  action: string;
  changedBy?: string | null;
  changedByType?: string | null;
  createdAt?: string;
};
type LeadDetailData = {
  assignments?: Array<{ id: string; assignedUserId?: string | null; assignedTeamId?: string | null; reason?: string | null; createdAt?: string }>;
  automationRuns?: Array<{ id: string; workflowId?: string | null; status: string; currentStep?: string | null; startedAt?: string; finishedAt?: string | null; steps?: Array<{ nodeName?: string | null; status: string }> }>;
};
type DispositionFormField = {
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired?: boolean;
  options?: string[];
  isActive?: boolean;
};
type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  team?: string | { id: string; name: string; code?: string | null; type?: string | null } | null;
  permissionTemplate?: string | { id: string; name: string } | null;
};
type CustomFieldDefinition = {
  id: string;
  moduleName: 'Lead' | 'User' | 'Activity';
  activityTypeCode?: string | null;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multi_select' | 'boolean' | 'json';
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  defaultValue?: unknown;
  validation?: Record<string, unknown> | null;
  options?: unknown[] | null;
};
type AccessOverview = {
  users?: Array<{ id: string; name?: string | null; email?: string | null }>;
  teams?: Array<{ id: string; name?: string | null; code?: string | null }>;
};
type LeadApiResponse = {
  id: string;
  externalLeadId?: string | null;
  customerName?: string | null;
  email?: string | null;
  mobile?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  offerAmount?: number | string | null;
  emiAmount?: number | string | null;
  status?: string | null;
  category?: string | null;
  uploadBatch?: { fileName?: string | null } | null;
  createdAt?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  location?: string | null;
  uploadDate?: string | null;
  offerExpiryDate?: string | null;
  disposition?: string | null;
  team?: { name?: string | null } | null;
  preferredLanguage?: string | null;
  customFields?: Array<{ key: string; label: string; value: unknown }> | null;
};

function labelForModule(value?: string | null) {
  return value ? humanizeKey(value) : '-';
}

function normalizeActivityTypeCode(type?: string | null) {
  if (!type) return defaultActivityTypeCode;
  return legacyActivityTypeCodes[type] ?? type;
}

function definitionsForActivityType(definitions: CustomFieldDefinition[], type?: string | null) {
  const code = normalizeActivityTypeCode(type);
  return definitions.filter((field) => !field.activityTypeCode || field.activityTypeCode === 'ALL' || field.activityTypeCode === code);
}

function parseCustomFieldFormValue(field: CustomFieldDefinition, value: unknown) {
  if (value === '' || value === undefined || value === null) return undefined;
  if (field.fieldType === 'number') return Number(value);
  if (field.fieldType === 'boolean') return Boolean(value);
  if (field.fieldType === 'multi_select') return String(value).split(',').map((entry) => entry.trim()).filter(Boolean);
  if (field.fieldType === 'json' && typeof value === 'string') return JSON.parse(value);
  return value;
}

function customFieldOptions(field: { options?: unknown[] | null }) {
  return normalizeOptions(field.options);
}

export function LeadDetailView({
  lead: initialLead,
  leadId,
  authToken,
  currentUser,
  canViewAutomation = false,
  onBack
}: {
  lead?: LeadRow | null;
  leadId?: string;
  authToken: string | null;
  currentUser: CurrentUser | null;
  canViewAutomation?: boolean;
  onBack: () => void;
}) {
  const [lead, setLead] = useState<LeadRow | null>(initialLead ?? null);
  const [tab, setTab] = useState(0);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [leadDetail, setLeadDetail] = useState<LeadDetailData | null>(null);
  const [accessOverview, setAccessOverview] = useState<AccessOverview>({});
  const [taskLists, setTaskLists] = useState(defaultTaskLists);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeConfig[]>(allActivityTypeOptions.map((type) => ({
    ...type,
    isActive: !['012', '013'].includes(type.code),
    showInGlobalList: !['012', '013'].includes(type.code),
    showInLeadDetail: !['012', '013'].includes(type.code),
    allowManualCreate: ['002', '003', '007'].includes(type.code)
  })));
  const [activityDefinitions, setActivityDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [dispositionFields, setDispositionFields] = useState<DispositionFormField[]>([]);
  const [activityForm, setActivityForm] = useState({ type: defaultActivityTypeCode, title: '', notes: '', disposition: '' });
  const [dispositionValues, setDispositionValues] = useState<Record<string, string>>({});
  const [taskForm, setTaskForm] = useState({ taskType: 'Follow-up', priority: 'Medium', dueDate: '', assignedTo: '', remarks: '' });
  const [activityCustomValues, setActivityCustomValues] = useState<Record<string, unknown>>({});
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [dispositionMessage, setDispositionMessage] = useState<string | null>(null);
  const [dispositionConfigFallback, setDispositionConfigFallback] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingDisposition, setSavingDisposition] = useState(false);
  const [callingLead, setCallingLead] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ assignedUserId: '__system__', reason: '' });
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(authToken && leadId && !initialLead));
  const leadApiId = lead?.dbId ?? (lead?.id && !lead.id.startsWith('UL-') ? lead.id : '');
  const dispositionOptions = dispositionFields.find((field) => field.fieldKey === 'disposition')?.options ?? defaultLeadLists.disposition;
  const activityTypeLabelByCode = new Map([
    ...Object.entries(activityTypeLabels),
    ...activityTypes.map((type) => [type.code, type.label] as const)
  ]);
  const leadDetailActivityTypes = activityTypes
    .filter((type) => type.isActive !== false && type.showInLeadDetail !== false)
    .map((type) => ({ code: type.code, label: type.label, allowManualCreate: type.allowManualCreate === true }));
  const manualLeadActivityTypes = leadDetailActivityTypes.filter((type) => type.allowManualCreate);
  const defaultManualActivityTypeCode = manualLeadActivityTypes[0]?.code ?? '002';
  const labelForConfiguredActivityType = (type?: string | null) => {
    const code = normalizeActivityTypeCode(type);
    const label = activityTypeLabelByCode.get(code);
    return label ? `${code} · ${label}` : code;
  };
  const detailTabs = useMemo(() => [
    { key: 'activities', label: `Activities (${activityRows.length})` },
    { key: 'tasks', label: `Tasks (${taskRows.length})` },
    { key: 'calls', label: `Calls (${activityRows.filter((activity) => ['001', '013'].includes(normalizeActivityTypeCode(activity.type))).length})` },
    ...(canViewAutomation ? [{ key: 'automation', label: 'Automation History' }] : []),
    { key: 'audit', label: `Audit (${auditRows.length})` }
  ], [activityRows, auditRows.length, canViewAutomation, taskRows.length]);
  const activeTabKey = detailTabs[tab]?.key ?? detailTabs[0].key;

  useEffect(() => {
    if (initialLead) setLead(initialLead);
  }, [initialLead]);

  useEffect(() => {
    if (tab >= detailTabs.length) setTab(0);
  }, [detailTabs.length, tab]);
  const showActivitiesTab = () => {
    const activityTabIndex = detailTabs.findIndex((item) => item.key === 'activities');
    setTab(activityTabIndex >= 0 ? activityTabIndex : 0);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadLead() {
      if (!authToken || !leadId || initialLead) return;
      setDetailLoading(true);
      setLeadDetail(null);
      try {
        const payload = await apiRequest<LeadApiResponse>(`/leads/${encodeURIComponent(leadId)}`, { token: authToken });
        if (!cancelled) {
          setLead(toLeadRow(payload));
          setLeadDetail(payload as LeadDetailData);
        }
      } catch {
        if (!cancelled) {
          setLead(null);
          setLeadDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    void loadLead();
    return () => {
      cancelled = true;
    };
  }, [authToken, initialLead, leadId]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivities() {
      if (!leadApiId) return;
      try {
        const payload = await apiRequest<ActivityRow[]>(`/activities?leadId=${encodeURIComponent(leadApiId)}`, { token: authToken });
        if (!cancelled) setActivityRows(Array.isArray(payload) ? payload : []);
      } catch {
        if (!cancelled) setActivityRows([]);
      }
    }
    void loadActivities();
    return () => {
      cancelled = true;
    };
  }, [authToken, leadApiId]);

  useEffect(() => {
    let cancelled = false;
    async function loadLeadLinkedData() {
      if (!leadApiId) return;
      setDetailLoading(true);
      try {
        const [detailPayload, taskPayload, auditPayload] = await Promise.all([
          initialLead ? apiRequest<LeadDetailData>(`/leads/${encodeURIComponent(leadApiId)}`, { token: authToken }).catch(() => null) : Promise.resolve(null),
          apiRequest<TaskRow[]>(`/tasks?leadId=${encodeURIComponent(leadApiId)}`, { token: authToken }).catch(() => []),
          apiRequest<AuditLogRow[]>(`/audit-logs?module=Lead&entityId=${encodeURIComponent(leadApiId)}`, { token: authToken }).catch(() => [])
        ]);
        if (cancelled) return;
        if (detailPayload) setLeadDetail(detailPayload);
        setTaskRows(Array.isArray(taskPayload) ? taskPayload : []);
        setAuditRows(Array.isArray(auditPayload) ? auditPayload : []);
      } catch {
        if (cancelled) return;
        setTaskRows([]);
        setAuditRows([]);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    void loadLeadLinkedData();
    return () => {
      cancelled = true;
    };
  }, [authToken, initialLead, leadApiId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSetup() {
      try {
        const [definitionPayload, accessPayload, taskListPayload, activityTypePayload] = await Promise.all([
          apiRequest<CustomFieldDefinition[]>('/custom-fields/definitions?moduleName=Activity', { token: authToken }),
          apiRequest<AccessOverview>('/access/overview', { token: authToken }).catch(() => ({})),
          apiRequest<typeof defaultTaskLists>('/settings/task-lists', { token: authToken }).catch(() => defaultTaskLists),
          apiRequest<ActivityTypeConfig[]>('/settings/activity-types', { token: authToken }).catch(() => [])
        ]);
        if (!cancelled) {
          setActivityDefinitions(Array.isArray(definitionPayload) ? definitionPayload.filter((field) => field.isActive) : []);
          setAccessOverview(accessPayload ?? {});
          setTaskLists({
            type: Array.isArray(taskListPayload.type) ? taskListPayload.type : defaultTaskLists.type,
            status: Array.isArray(taskListPayload.status) ? taskListPayload.status : defaultTaskLists.status
          });
          if (Array.isArray(activityTypePayload) && activityTypePayload.length > 0) setActivityTypes(activityTypePayload);
        }
      } catch {
        if (!cancelled) {
          setActivityDefinitions([]);
          setAccessOverview({});
          setTaskLists(defaultTaskLists);
        }
      }
    }
    void loadSetup();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadDispositionForm() {
      try {
        const payload = await apiRequest<{ fields?: DispositionFormField[] }>('/settings/disposition-form', { token: authToken });
        if (!cancelled) {
          setDispositionFields(Array.isArray(payload.fields) ? payload.fields.filter((field: DispositionFormField) => field.isActive !== false) : []);
          setDispositionConfigFallback(!Array.isArray(payload.fields));
        }
      } catch {
        if (!cancelled) {
          setDispositionFields([]);
          setDispositionConfigFallback(true);
        }
      }
    }
    void loadDispositionForm();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const refreshActivities = async () => {
    if (!leadApiId) return;
    const payload = await apiRequest<ActivityRow[]>(`/activities?leadId=${encodeURIComponent(leadApiId)}`, { token: authToken });
    setActivityRows(Array.isArray(payload) ? payload : []);
  };

  const refreshTasks = async () => {
    if (!leadApiId) return;
    const payload = await apiRequest<TaskRow[]>(`/tasks?leadId=${encodeURIComponent(leadApiId)}`, { token: authToken });
    setTaskRows(Array.isArray(payload) ? payload : []);
  };

  const createActivity = async () => {
    if (!authToken) {
      setActivityMessage('Login required');
      return;
    }
    if (!leadApiId) {
      setActivityMessage('Lead is still loading');
      return;
    }
    setSavingActivity(true);
    setActivityMessage(null);
    try {
      const customFields = Object.fromEntries(
        definitionsForActivityType(activityDefinitions, activityForm.type)
          .map((field) => [field.fieldKey, parseCustomFieldFormValue(field, activityCustomValues[field.fieldKey])])
          .filter(([, value]) => value !== undefined)
      );
      await apiRequest<ActivityRow>('/activities', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadApiId,
          type: activityForm.type,
          title: activityForm.title,
          notes: activityForm.notes || undefined,
          disposition: activityForm.disposition || undefined,
          customFields
        })
      });
      setActivityForm({ type: defaultManualActivityTypeCode, title: '', notes: '', disposition: '' });
      setActivityCustomValues({});
      setActivityMessage('Activity added');
      await refreshActivities();
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'Could not create activity');
    } finally {
      setSavingActivity(false);
    }
  };

  const openEditActivity = (activity: ActivityRow) => {
    const customValues = Object.fromEntries((activity.customFields ?? []).map((field) => [field.key, field.value]));
    setEditingActivity(activity);
    setActivityForm({
      type: normalizeActivityTypeCode(activity.type),
      title: activity.title ?? '',
      notes: activity.notes ?? '',
      disposition: activity.disposition ?? ''
    });
    setActivityCustomValues(customValues);
    showActivitiesTab();
  };

  const updateActivity = async () => {
    if (!authToken || !editingActivity) return;
    setSavingActivity(true);
    setActivityMessage(null);
    try {
      const customFields = Object.fromEntries(
        definitionsForActivityType(activityDefinitions, activityForm.type)
          .map((field) => [field.fieldKey, parseCustomFieldFormValue(field, activityCustomValues[field.fieldKey])])
          .filter(([, value]) => value !== undefined)
      );
      await apiRequest<ActivityRow>(`/activities/${encodeURIComponent(editingActivity.id)}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activityForm.type,
          title: activityForm.title,
          notes: activityForm.notes || undefined,
          disposition: activityForm.disposition || undefined,
          customFields
        })
      });
      setEditingActivity(null);
      setActivityForm({ type: defaultManualActivityTypeCode, title: '', notes: '', disposition: '' });
      setActivityCustomValues({});
      setActivityMessage('Activity updated');
      await refreshActivities();
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'Could not update activity');
    } finally {
      setSavingActivity(false);
    }
  };

  const deleteActivity = async (activityId: string) => {
    if (!authToken) return;
    setDeletingActivityId(activityId);
    setActivityMessage(null);
    try {
      await apiRequest(`/activities/${encodeURIComponent(activityId)}`, { token: authToken, method: 'DELETE' });
      setActivityMessage('Activity deleted');
      await refreshActivities();
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'Could not delete activity');
    } finally {
      setDeletingActivityId(null);
    }
  };

  const createTask = async () => {
    if (!leadApiId) {
      setTaskMessage('Lead is still loading');
      return;
    }
    setSavingTask(true);
    setTaskMessage(null);
    try {
      await apiRequest<TaskRow>('/tasks', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadApiId,
          taskType: taskForm.taskType,
          priority: taskForm.priority || undefined,
          dueDate: taskForm.dueDate || undefined,
          assignedTo: taskForm.assignedTo || undefined,
          remarks: taskForm.remarks || undefined
        })
      });
      setTaskForm({ taskType: taskLists.type[0] ?? 'Follow-up', priority: 'Medium', dueDate: '', assignedTo: '', remarks: '' });
      setTaskMessage('Task added');
      await Promise.all([refreshTasks(), refreshActivities()]);
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Could not create task');
    } finally {
      setSavingTask(false);
    }
  };

  const submitDisposition = async () => {
    if (!leadApiId) {
      setDispositionMessage('Lead is still loading');
      return;
    }
    setSavingDisposition(true);
    setDispositionMessage(null);
    try {
      const extraFields = Object.fromEntries(
        Object.entries(dispositionValues).filter(([key]) => !['disposition', 'status', 'category', 'remarks', 'callbackAt'].includes(key))
      );
      await apiRequest(`/leads/${encodeURIComponent(leadApiId)}/disposition`, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition: dispositionValues.disposition,
          status: dispositionValues.status || undefined,
          category: dispositionValues.category || undefined,
          remarks: dispositionValues.remarks || undefined,
          callbackAt: dispositionValues.callbackAt || undefined,
          extraFields
        })
      });
      setDispositionMessage('Disposition updated');
      await refreshActivities();
      setDispositionDialogOpen(false);
    } catch (error) {
      setDispositionMessage(error instanceof Error ? error.message : 'Could not update disposition');
    } finally {
      setSavingDisposition(false);
    }
  };

  const assignLead = async () => {
    if (!authToken || !leadApiId) return;
    setSavingAssignment(true);
    setAssignMessage(null);
    try {
      await apiRequest(`/leads/${encodeURIComponent(leadApiId)}/assign`, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedUserId: assignForm.assignedUserId || undefined,
          reason: assignForm.reason || undefined
        })
      });
      setAssignDialogOpen(false);
      setAssignForm({ assignedUserId: '__system__', reason: '' });
      setAssignMessage('Lead assigned');
      await refreshActivities();
    } catch (error) {
      setAssignMessage(error instanceof Error ? error.message : 'Could not assign lead');
    } finally {
      setSavingAssignment(false);
    }
  };

  const callLead = async () => {
    if (!authToken || !currentUser?.id) {
      setCallMessage('Login required');
      return;
    }
    if (!leadApiId) {
      setCallMessage('Lead is still loading');
      return;
    }
    setCallingLead(true);
    setCallMessage(null);
    try {
      const payload = await apiRequest<{ status?: string; success?: boolean; httpStatus?: number | string; response?: string; error?: string }>('/connectors/telephony/click-to-call', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: leadApiId })
      });
      if (payload.success === false || payload.status === 'failed') {
        const details = [payload.httpStatus ? `HTTP ${payload.httpStatus}` : null, payload.error || payload.response].filter(Boolean).join(' · ');
        setCallMessage(details ? `Call failed: ${details}` : 'Call failed');
      } else {
        setCallMessage(`Call ${payload.status ?? 'started'}`);
      }
      await refreshActivities();
    } catch (error) {
      setCallMessage(error instanceof Error ? error.message : 'Could not start call');
    } finally {
      setCallingLead(false);
    }
  };

  if (!lead) {
    return (
      <ModuleShell title="Lead" subtitle="">
        {detailLoading ? <CompactTableSkeleton rows={5} /> : <Alert severity="warning">Lead record was not found or you do not have access.</Alert>}
      </ModuleShell>
    );
  }

  const openTasks = taskRows.filter((task) => task.status !== 'Completed').slice(0, 4);
  const recentActivity = activityRows.slice(0, 5);
  const automationRuns = leadDetail?.automationRuns ?? [];
  const userNameById = new Map<string, string>();
  if (currentUser?.id) userNameById.set(currentUser.id, currentUser.name || currentUser.email || 'Current user');
  for (const user of accessOverview.users ?? []) {
    userNameById.set(user.id, user.name ?? user.email ?? 'Unknown user');
  }
  const resolveUserName = (value?: string | null) => {
    if (!value) return 'System';
    if (['system', 'system@unnatify.local'].includes(value.toLowerCase())) return 'System';
    if (userNameById.has(value)) return userNameById.get(value) ?? 'Unknown user';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return 'Unknown user';
    return value;
  };

  return (
    <Box sx={{ px: { xs: 1, md: 1.5 }, py: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
        <Button startIcon={<ChevronLeftIcon />} onClick={onBack} sx={{ color: 'text.primary' }}>Back</Button>
        <Stack direction="row" spacing={0.75}>
          <CapsuleButton variant="outlined" startIcon={<CallIcon />} onClick={callLead} disabled={callingLead}>{callingLead ? 'Calling' : 'Call'}</CapsuleButton>
          <CapsuleButton variant="outlined" startIcon={<PersonAddAltIcon />} onClick={() => {
            setAssignForm({ assignedUserId: lead.assignedUserId ?? '__system__', reason: '' });
            setAssignDialogOpen(true);
          }}>Change Owner</CapsuleButton>
          <CapsuleButton variant="outlined" startIcon={<AddIcon />} onClick={showActivitiesTab}>Activity</CapsuleButton>
          <CapsuleButton variant="outlined" startIcon={<DescriptionIcon />} onClick={() => setDispositionDialogOpen(true)}>Disposition</CapsuleButton>
        </Stack>
      </Stack>
      <Stack spacing={0.75} sx={{ mb: callMessage || assignMessage ? 1 : 0 }}>
        <MessageAlert message={callMessage} />
        <MessageAlert message={assignMessage} />
      </Stack>
      {!leadApiId && detailLoading ? <CompactTableSkeleton columns={4} rows={3} /> : null}
      {dispositionConfigFallback ? <Alert severity="warning" sx={{ mb: 1, borderRadius: '8px' }}>Disposition dropdowns are using seed defaults because the configured disposition form could not be loaded.</Alert> : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)', xl: '360px minmax(0, 1fr) 292px' },
          gap: 1,
          alignItems: 'start'
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <LeadProfileCard lead={lead} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card sx={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--crm-border)', boxShadow: '0 12px 34px rgba(22, 39, 22, 0.06)' }}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 0.75, borderBottom: '1px solid var(--crm-border)', minHeight: 46, '& .MuiTab-root': { minHeight: 46, fontSize: 13, fontWeight: 800, color: 'text.primary', px: 1.5 }, '& .Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '8px', my: 0.7, minHeight: 32 } }}>
              {detailTabs.map((item) => <Tab key={item.key} label={item.label} />)}
            </Tabs>
            <Box sx={{ p: 1 }}>
              {detailLoading && !leadDetail ? <CompactTableSkeleton columns={4} rows={3} /> : null}
              {!(detailLoading && !leadDetail) && activeTabKey === 'activities' ? (
                <LeadActivitiesTab
                  lead={lead}
                  activityRows={activityRows}
                  activityForm={activityForm}
                  setActivityForm={setActivityForm}
                  activityTypeOptions={leadDetailActivityTypes}
                  dispositionOptions={dispositionOptions}
                  activityDefinitions={definitionsForActivityType(activityDefinitions, activityForm.type)}
                  activityCustomValues={activityCustomValues}
                  setActivityCustomValues={setActivityCustomValues}
                  customFieldOptions={customFieldOptions}
                  createActivity={createActivity}
                  updateActivity={updateActivity}
                  editingActivityId={editingActivity?.id ?? null}
                  cancelEditActivity={() => {
                    setEditingActivity(null);
                    setActivityForm({ type: defaultManualActivityTypeCode, title: '', notes: '', disposition: '' });
                    setActivityCustomValues({});
                  }}
                  savingActivity={savingActivity}
                  activityMessage={activityMessage}
                  onEditActivity={openEditActivity}
                  onDeleteActivity={deleteActivity}
                  deletingActivityId={deletingActivityId}
                  resolveUserName={resolveUserName}
                />
              ) : null}
              {!(detailLoading && !leadDetail) && activeTabKey === 'tasks' ? (
                <LeadTasksTab
                  taskRows={taskRows}
                  taskForm={taskForm}
                  setTaskForm={setTaskForm}
                  taskTypeOptions={taskLists.type}
                  userOptions={(accessOverview.users ?? []).map((user) => ({ id: user.id, name: user.name ?? user.email ?? 'Unknown user' }))}
                  createTask={createTask}
                  savingTask={savingTask}
                  taskMessage={taskMessage}
                  formatDate={formatDate}
                />
              ) : null}
              {!(detailLoading && !leadDetail) && activeTabKey === 'calls' ? (
                <LeadCallsTab activityRows={activityRows} normalizeActivityTypeCode={normalizeActivityTypeCode} labelForActivityType={labelForConfiguredActivityType} formatDate={formatDate} resolveUserName={resolveUserName} />
              ) : null}
              {!(detailLoading && !leadDetail) && activeTabKey === 'automation' ? (
                <LeadAutomationHistoryTab leadDetail={leadDetail} formatDate={formatDate} />
              ) : null}
              {!(detailLoading && !leadDetail) && activeTabKey === 'audit' ? (
                <LeadAuditTab auditRows={auditRows} labelForModule={labelForModule} formatDate={formatDate} resolveUserName={resolveUserName} />
              ) : null}
            </Box>
          </Card>
        </Box>
        <Stack spacing={1} sx={{ display: { xs: 'none', xl: 'flex' }, minWidth: 0 }}>
          <Card sx={{ borderRadius: '8px', border: '1px solid var(--crm-border)', overflow: 'hidden' }}>
            <Box sx={{ px: 1, py: 0.85, bgcolor: 'var(--crm-soft)', borderBottom: '1px solid var(--crm-border)' }}>
              <Typography fontWeight={850}>Next Tasks</Typography>
            </Box>
            <Stack spacing={0.75} sx={{ p: 1 }}>
              {openTasks.length ? openTasks.map((task) => (
                <Box key={task.id} sx={{ p: 0.85, border: '1px solid var(--crm-border)', borderRadius: '8px', bgcolor: 'var(--crm-paper-soft)' }}>
                  <Typography fontWeight={800} noWrap>{task.taskType}</Typography>
                  <Typography color="text.secondary" fontSize={12} noWrap>{task.priority || 'Medium'} · {formatDate(task.dueDate)}</Typography>
                </Box>
              )) : (
                <Typography color="text.secondary" fontSize={12}>No open tasks for this lead.</Typography>
              )}
            </Stack>
          </Card>
          <Card sx={{ borderRadius: '8px', border: '1px solid var(--crm-border)', overflow: 'hidden' }}>
            <Box sx={{ px: 1, py: 0.85, bgcolor: 'var(--crm-soft)', borderBottom: '1px solid var(--crm-border)' }}>
              <Typography fontWeight={850}>Recent Activity</Typography>
            </Box>
            <Stack spacing={0.75} sx={{ p: 1 }}>
              {recentActivity.length ? recentActivity.map((activity) => (
                <Box key={activity.id} sx={{ p: 0.85, border: '1px solid var(--crm-border)', borderRadius: '8px', bgcolor: 'background.paper' }}>
                  <Typography fontWeight={800} noWrap>{activity.title || labelForConfiguredActivityType(activity.type)}</Typography>
                  <Typography color="text.secondary" fontSize={12} noWrap>{labelForConfiguredActivityType(activity.type)} · {formatDate(activity.createdAt)}</Typography>
                </Box>
              )) : (
                <Typography color="text.secondary" fontSize={12}>No activity yet.</Typography>
              )}
            </Stack>
          </Card>
          {canViewAutomation ? (
            <Card sx={{ borderRadius: '8px', border: '1px solid var(--crm-border)', overflow: 'hidden' }}>
              <Box sx={{ px: 1, py: 0.85, bgcolor: 'var(--crm-soft)', borderBottom: '1px solid var(--crm-border)' }}>
                <Typography fontWeight={850}>Automation Snapshot</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ p: 1 }}>
                <Typography color="text.secondary" fontSize={12}>{automationRuns.length} runs linked to this lead</Typography>
                {automationRuns.slice(0, 3).map((run) => (
                  <Box key={run.id} sx={{ p: 0.85, border: '1px solid var(--crm-border)', borderRadius: '8px', bgcolor: 'var(--crm-paper-soft)' }}>
                    <Typography fontWeight={800} noWrap>Automation workflow</Typography>
                    <Typography color="text.secondary" fontSize={12} noWrap>{run.status} · {formatDate(run.startedAt)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Box>
      <FormDialog
        open={dispositionDialogOpen}
        title="Add Disposition"
        subtitle="Update the lead disposition using the configured disposition form."
        onClose={() => setDispositionDialogOpen(false)}
        actions={[
          <Button key="cancel" onClick={() => setDispositionDialogOpen(false)}>Cancel</Button>,
          <Button key="save" variant="contained" disabled={savingDisposition || !dispositionValues.disposition} onClick={submitDisposition}>Save Disposition</Button>
        ]}
      >
        <LeadDispositionsTab
          dispositionFields={dispositionFields}
          dispositionValues={dispositionValues}
          setDispositionValues={setDispositionValues}
          dispositionMessage={dispositionMessage}
        />
      </FormDialog>
      <FormDialog
        open={assignDialogOpen}
        title="Change Owner"
        subtitle="Assign this lead to a user or System."
        onClose={() => setAssignDialogOpen(false)}
        actions={[
          <Button key="cancel" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>,
          <Button key="save" variant="contained" disabled={savingAssignment || !assignForm.assignedUserId} onClick={assignLead}>Change Owner</Button>
        ]}
      >
        <Stack spacing={1}>
          <FormControl size="small">
            <Select displayEmpty value={assignForm.assignedUserId} onChange={(event) => setAssignForm({ ...assignForm, assignedUserId: event.target.value })}>
              <MenuItem value="__system__">System</MenuItem>
              {(accessOverview.users ?? []).map((user) => <MenuItem key={user.id} value={user.id}>{user.name ?? user.email ?? 'Unknown user'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Reason" value={assignForm.reason} onChange={(event) => setAssignForm({ ...assignForm, reason: event.target.value })} />
        </Stack>
      </FormDialog>
    </Box>
  );
}
