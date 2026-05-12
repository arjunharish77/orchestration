'use client';

import AddIcon from '@mui/icons-material/Add';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Box, Button, FormControl, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdvancedFilterBuilder, AdvancedFilterCondition } from '../../../components/common/AdvancedFilterBuilder';
import { MetaChip } from '../../../components/common/MetaChip';
import { CompactDataTable } from '../../../components/common/CompactDataTable';
import { FieldSelector } from '../../../components/common/FieldSelector';
import { FormDialog } from '../../../components/common/FormDialog';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { RowActionMenu } from '../../../components/common/RowActionMenu';
import { TableToolbar } from '../../../components/common/TableToolbar';
import { FilterPill, MetricCard, ModuleShell, PageFilterBar, SectionPanel as Section } from '../../../components/common/WorkspacePrimitives';
import { apiRequest } from '../../../lib/api';
import { FieldOption } from '../../../lib/field-metadata';
import { formatDate, humanizeKey } from '../../../lib/format';
import { activityTypeLabels, allActivityTypeOptions, baseActivityListFields, defaultActivityTypeCode, legacyActivityTypeCodes } from './activities/activity-columns';

type CustomFieldDefinition = {
  id: string;
  activityTypeCode?: string | null;
  fieldKey: string;
  label: string;
  fieldType: string;
  isActive?: boolean;
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

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  notes?: string | null;
  disposition?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  createdBy?: string | null;
  lead?: {
    id: string;
    customerName?: string | null;
    mobile?: string | null;
    externalLeadId?: string | null;
    status?: string | null;
    category?: string | null;
  } | null;
  customFields?: Array<{ key: string; label: string; value: unknown }>;
};

type ActivityLeadRow = {
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
  team: string;
  language: string;
};

type ActivityLeadOption = {
  id: string;
  externalLeadId?: string | null;
  customerName?: string | null;
  mobile?: string | null;
  status?: string | null;
  category?: string | null;
};

function normalizeActivityTypeCode(type?: string | null) {
  if (!type) return defaultActivityTypeCode;
  return legacyActivityTypeCodes[type] ?? type;
}

function formatCellValue(value: unknown) {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function customFieldValue(record: { customFields?: Array<{ key: string; value: unknown }> }, key: string) {
  const field = record.customFields?.find((item) => item.key === key);
  return formatCellValue(field?.value);
}

function recordingUrlForActivity(activity: ActivityRow) {
  const value = activity.metadata?.recordingUrl ?? activity.metadata?.ResourceURL ?? activity.metadata?.resourceUrl;
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
}

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = dateBounds('today');
  return date >= start && date < end;
}

function dateBounds(label: 'today' | 'yesterday' | 'this_week' | 'this_month') {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (label === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (label === 'this_week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  }
  if (label === 'this_month') {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  }
  return { start, end };
}

function matchesCondition(value: unknown, condition: AdvancedFilterCondition, field?: FieldOption) {
  const operator = condition.operator;
  const text = String(value ?? '').toLowerCase();
  const target = String(condition.value ?? '').toLowerCase();
  if (operator === 'exists') return value !== undefined && value !== null && String(value) !== '';
  if (operator === 'not_exists') return value === undefined || value === null || String(value) === '';
  if (field?.fieldType === 'date' || field?.fieldType === 'datetime') {
    const date = value ? new Date(String(value)) : null;
    if (!date || Number.isNaN(date.getTime())) return false;
    if (operator === 'today' || operator === 'yesterday' || operator === 'this_week' || operator === 'this_month') {
      const { start, end } = dateBounds(operator);
      return date >= start && date < end;
    }
    const targetDate = condition.value ? new Date(condition.value) : null;
    if (!targetDate || Number.isNaN(targetDate.getTime())) return false;
    if (operator === 'equals') return date.toDateString() === targetDate.toDateString();
    if (operator === 'lte') return date <= targetDate;
    if (operator === 'gte') return date >= targetDate;
    if (operator === 'between') {
      const [from, to] = String(condition.value ?? '').split(',').map((item) => new Date(item.trim()));
      return !Number.isNaN(from?.getTime()) && !Number.isNaN(to?.getTime()) && date >= from && date <= to;
    }
  }
  if (operator === 'equals') return text === target;
  if (operator === 'not_equals') return text !== target;
  if (operator === 'starts_with') return text.startsWith(target);
  if (operator === 'ends_with') return text.endsWith(target);
  if (operator === 'in') return String(condition.value ?? '').split(',').map((item) => item.trim().toLowerCase()).includes(text);
  if (operator === 'not_in') return !String(condition.value ?? '').split(',').map((item) => item.trim().toLowerCase()).includes(text);
  return text.includes(target);
}

function activityLeadRow(activity: ActivityRow): ActivityLeadRow | null {
  if (!activity.lead) return null;
  return {
    id: activity.lead.externalLeadId ?? activity.lead.id,
    dbId: activity.lead.id,
    initials: String(activity.lead.customerName ?? 'L').charAt(0).toUpperCase(),
    name: activity.lead.customerName ?? activity.lead.mobile ?? 'Unnamed Lead',
    email: '-',
    phone: activity.lead.mobile ?? '-',
    branch: '-',
    branchName: '-',
    amount: '-',
    emi: '-',
    status: activity.lead.status ?? 'New',
    category: activity.lead.category ?? '-',
    source: '-',
    created: '-',
    owner: '-',
    team: '-',
    language: '-'
  };
}

export function ActivitiesView({ authToken, openLead, currentUserId }: { authToken: string | null; openLead: (lead: ActivityLeadRow) => void; currentUserId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activityType, setActivityType] = useState(defaultActivityTypeCode);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeConfig[]>(allActivityTypeOptions.map((type) => ({
    ...type,
    isActive: !['012', '013'].includes(type.code),
    showInGlobalList: !['012', '013'].includes(type.code),
    showInLeadDetail: !['012', '013'].includes(type.code),
    allowManualCreate: ['002', '003', '007'].includes(type.code)
  })));
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [visibleActivityFields, setVisibleActivityFields] = useState(['lead', 'title', 'disposition', 'createdAt', 'action']);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityDateFilter, setActivityDateFilter] = useState<'all' | 'today'>('today');
  const [activityOwnerFilter, setActivityOwnerFilter] = useState<'any' | 'me'>('any');
  const [activityLeadFilter, setActivityLeadFilter] = useState<'any' | 'linked'>('any');
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [advancedConditions, setAdvancedConditions] = useState<AdvancedFilterCondition[]>([]);
  const [advancedMatch, setAdvancedMatch] = useState<'all' | 'any'>('all');
  const [loadingActivities, setLoadingActivities] = useState(Boolean(authToken));
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null);
  const [activityEditForm, setActivityEditForm] = useState({ type: defaultActivityTypeCode, title: '', notes: '', disposition: '' });
  const [activityCustomEditValues, setActivityCustomEditValues] = useState<Record<string, string>>({});
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [dispositionOptions, setDispositionOptions] = useState<string[]>([]);
  const [createActivityOpen, setCreateActivityOpen] = useState(false);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [activityLeadOptions, setActivityLeadOptions] = useState<ActivityLeadOption[]>([]);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [activityCreateDefinitions, setActivityCreateDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [activityCreateForm, setActivityCreateForm] = useState({ leadId: '', type: '', title: '', notes: '', disposition: '' });
  const [activityCustomCreateValues, setActivityCustomCreateValues] = useState<Record<string, string>>({});

  const activityTypeLabelByCode = new Map([
    ...Object.entries(activityTypeLabels),
    ...activityTypes.map((type) => [type.code, type.label] as const)
  ]);
  const globalActivityTypeOptions = activityTypes
    .filter((type) => type.isActive !== false && type.showInGlobalList !== false)
    .map((type) => ({ code: type.code, label: type.label }));
  const selectedActivityTypeOptions = globalActivityTypeOptions.some((type) => type.code === activityType)
    ? globalActivityTypeOptions
    : [
      ...globalActivityTypeOptions,
      { code: activityType, label: activityTypeLabelByCode.get(activityType) ?? activityType }
    ];
  const manualActivityTypeOptions = activityTypes
    .filter((type) => type.isActive !== false && type.allowManualCreate === true)
    .map((type) => ({ code: type.code, label: type.label }));
  const manualActivityTypeCodes = new Set(manualActivityTypeOptions.map((type) => type.code));
  const labelForActivityType = (type?: string | null) => {
    const code = normalizeActivityTypeCode(type);
    const label = activityTypeLabelByCode.get(code);
    return label ? `${code} · ${label}` : code;
  };

  useEffect(() => {
    const nextType = normalizeActivityTypeCode(searchParams.get('type') || defaultActivityTypeCode);
    setActivityType(nextType);
    if (!searchParams.get('type')) router.replace(`/activities?type=${encodeURIComponent(nextType)}`);
  }, [router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivityTypes() {
      try {
        const payload = await apiRequest<ActivityTypeConfig[]>('/settings/activity-types', { token: authToken });
        if (!cancelled && Array.isArray(payload) && payload.length > 0) setActivityTypes(payload);
      } catch {
        if (!cancelled) {
          setActivityTypes(allActivityTypeOptions.map((type) => ({
            ...type,
            isActive: !['012', '013'].includes(type.code),
            showInGlobalList: !['012', '013'].includes(type.code),
            showInLeadDetail: !['012', '013'].includes(type.code),
            allowManualCreate: ['002', '003', '007'].includes(type.code)
          })));
        }
      }
    }
    void loadActivityTypes();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadDefinitions() {
      try {
        const payload = await apiRequest<CustomFieldDefinition[]>(`/custom-fields/definitions?moduleName=Activity&activityTypeCode=${encodeURIComponent(activityType)}`, { token: authToken });
        if (!cancelled) setActivityDefinitions(Array.isArray(payload) ? payload.filter((field) => field.isActive) : []);
      } catch {
        if (!cancelled) setActivityDefinitions([]);
      }
    }
    void loadDefinitions();
    return () => {
      cancelled = true;
    };
  }, [authToken, activityType]);

  useEffect(() => {
    let cancelled = false;
    async function loadCreateDefinitions() {
      if (!createActivityOpen || !activityCreateForm.type) {
        setActivityCreateDefinitions([]);
        return;
      }
      try {
        const payload = await apiRequest<CustomFieldDefinition[]>(`/custom-fields/definitions?moduleName=Activity&activityTypeCode=${encodeURIComponent(activityCreateForm.type)}`, { token: authToken });
        if (!cancelled) setActivityCreateDefinitions(Array.isArray(payload) ? payload.filter((field) => field.isActive) : []);
      } catch {
        if (!cancelled) setActivityCreateDefinitions([]);
      }
    }
    void loadCreateDefinitions();
    return () => {
      cancelled = true;
    };
  }, [authToken, createActivityOpen, activityCreateForm.type]);

  useEffect(() => {
    if (!createActivityOpen) return undefined;
    const timer = window.setTimeout(async () => {
      if (!authToken) return;
      setLeadSearchLoading(true);
      try {
        const params = new URLSearchParams({ pageSize: '30', sortBy: 'updatedAt', sortOrder: 'desc' });
        if (leadSearchQuery.trim()) params.set('search', leadSearchQuery.trim());
        const payload = await apiRequest<{ items?: ActivityLeadOption[] }>(`/leads?${params.toString()}`, { token: authToken });
        setActivityLeadOptions(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        // keep previous list on error
      } finally {
        setLeadSearchLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [authToken, createActivityOpen, leadSearchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadLeadLists() {
      try {
        const payload = await apiRequest<{ disposition?: string[] }>('/settings/lead-lists', { token: authToken });
        if (!cancelled) setDispositionOptions(Array.isArray(payload.disposition) ? payload.disposition : []);
      } catch {
        if (!cancelled) setDispositionOptions([]);
      }
    }
    void loadLeadLists();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivities() {
      if (!authToken) return;
      setLoadingActivities(true);
      setActivityMessage(null);
      try {
        const searchParams = new URLSearchParams({ type: activityType });
        const payload = await apiRequest<ActivityRow[]>(`/activities?${searchParams.toString()}`, { token: authToken });
        if (!cancelled) setActivities(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if (!cancelled) {
          setActivities([]);
          setActivityMessage(error instanceof Error ? error.message : 'Could not load activities');
        }
      } finally {
        if (!cancelled) setLoadingActivities(false);
      }
    }
    void loadActivities();
    return () => {
      cancelled = true;
    };
  }, [authToken, activityType]);

  const changeActivityType = (type: string) => {
    router.push(`/activities?type=${encodeURIComponent(type)}`);
  };
  const reloadActivities = async () => {
    if (!authToken) return;
    const searchParams = new URLSearchParams({ type: activityType });
    const payload = await apiRequest<ActivityRow[]>(`/activities?${searchParams.toString()}`, { token: authToken });
    setActivities(Array.isArray(payload) ? payload : []);
  };
  const openCreateActivity = () => {
    const firstType = manualActivityTypeOptions[0]?.code ?? '';
    setActivityCreateForm({ leadId: '', type: firstType, title: '', notes: '', disposition: '' });
    setActivityCustomCreateValues({});
    setLeadSearchQuery('');
    setCreateActivityOpen(true);
  };
  const createActivity = async () => {
    if (!authToken || !activityCreateForm.leadId || !activityCreateForm.type || !activityCreateForm.title) return;
    setCreatingActivity(true);
    setActivityMessage(null);
    try {
      const customFields = Object.fromEntries(Object.entries(activityCustomCreateValues).filter(([, value]) => value !== ''));
      await apiRequest('/activities', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: activityCreateForm.leadId,
          type: activityCreateForm.type,
          title: activityCreateForm.title,
          notes: activityCreateForm.notes || undefined,
          disposition: activityCreateForm.disposition || undefined,
          customFields
        })
      });
      setCreateActivityOpen(false);
      setActivityMessage('Activity created');
      if (activityCreateForm.type !== activityType) changeActivityType(activityCreateForm.type);
      else await reloadActivities();
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'Could not create activity');
    } finally {
      setCreatingActivity(false);
    }
  };
  const openEditActivity = (activity: ActivityRow) => {
    setEditingActivity(activity);
    setActivityEditForm({
      type: normalizeActivityTypeCode(activity.type),
      title: activity.title ?? '',
      notes: activity.notes ?? '',
      disposition: activity.disposition ?? ''
    });
    setActivityCustomEditValues(Object.fromEntries((activity.customFields ?? []).map((field) => [field.key, formatCellValue(field.value)])));
  };
  const saveActivity = async () => {
    if (!authToken || !editingActivity) return;
    setActivityMessage(null);
    try {
      const customFields = Object.fromEntries(Object.entries(activityCustomEditValues).filter(([, value]) => value !== ''));
      await apiRequest(`/activities/${encodeURIComponent(editingActivity.id)}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activityEditForm.type,
          title: activityEditForm.title,
          notes: activityEditForm.notes || undefined,
          disposition: activityEditForm.disposition || undefined,
          customFields
        })
      });
      setEditingActivity(null);
      setActivityMessage('Activity updated');
      await reloadActivities();
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'Could not update activity');
    }
  };
  const deleteActivity = async (activityId: string) => {
    if (!authToken) return;
    setDeletingActivityId(activityId);
    setActivityMessage(null);
    try {
      await apiRequest(`/activities/${encodeURIComponent(activityId)}`, { token: authToken, method: 'DELETE' });
      setActivityMessage('Activity deleted');
      await reloadActivities();
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'Could not delete activity');
    } finally {
      setDeletingActivityId(null);
    }
  };
  const activityFieldOptions = [
    ...baseActivityListFields.map((field) => field.key === 'type' ? {
      ...field,
      options: globalActivityTypeOptions.map((type) => `${type.code} · ${type.label}`)
    } : field),
    { key: 'action', label: 'Actions', fieldType: 'text' },
    ...activityDefinitions.map((field) => ({ key: `custom:${field.fieldKey}`, label: field.label, fieldType: field.fieldType }))
  ];
  const labelByKey = new Map(activityFieldOptions.map((field) => [field.key, field.label]));
  const fieldByKey = new Map(activityFieldOptions.map((field) => [field.key, field]));
  const valueByField = (activity: ActivityRow, field: string) => {
    if (field.startsWith('custom:')) return customFieldValue(activity, field.replace('custom:', ''));
    if (field === 'lead') return activity.lead?.customerName ?? activity.lead?.mobile ?? '';
    if (field === 'type') return labelForActivityType(activity.type);
    return (activity as unknown as Record<string, unknown>)[field] ?? '';
  };
  const filteredActivities = activities.filter((activity) => {
    const needle = activitySearch.trim().toLowerCase();
    const matchesSearch = !needle || [
      activity.title,
      activity.notes,
      activity.disposition,
      labelForActivityType(activity.type),
      activity.lead?.customerName,
      activity.lead?.mobile,
      ...(activity.customFields ?? []).map((field) => `${field.label} ${formatCellValue(field.value)}`)
    ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    const matchesDate = activityDateFilter === 'all' || isToday(activity.createdAt);
    const matchesOwner = activityOwnerFilter === 'any' || (currentUserId && activity.createdBy === currentUserId);
    const matchesLead = activityLeadFilter === 'any' || Boolean(activity.lead?.id);
    const conditionResults = advancedConditions.map((condition) => matchesCondition(valueByField(activity, condition.field), condition, fieldByKey.get(condition.field)));
    const matchesAdvanced = conditionResults.length === 0 || (advancedMatch === 'all' ? conditionResults.every(Boolean) : conditionResults.some(Boolean));
    return matchesSearch && matchesDate && matchesOwner && matchesLead && matchesAdvanced;
  });
  const todayActivities = activities.filter((activity) => isToday(activity.createdAt));
  const callsToday = todayActivities.filter((activity) => normalizeActivityTypeCode(activity.type) === '001');
  const meetingsToday = todayActivities.filter((activity) => normalizeActivityTypeCode(activity.type) === '002');
  const notesToday = todayActivities.filter((activity) => normalizeActivityTypeCode(activity.type) === '003' || /note/i.test(activity.title ?? ''));
  const exportedLabel = filteredActivities.length === 1 ? '1 activity' : `${filteredActivities.length} activities`;
  const exportActivities = () => {
    const header = visibleActivityFields.map((field) => labelByKey.get(field) ?? humanizeKey(field));
    const rows = filteredActivities.map((activity) => visibleActivityFields.map((field) => {
      const value = valueByField(activity, field);
      return `"${formatCellValue(value).replace(/"/g, '""')}"`;
    }).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activities-${activityType}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const renderActivityCell = (activity: ActivityRow, field: string) => {
    if (field.startsWith('custom:')) return customFieldValue(activity, field.replace('custom:', ''));
    if (field === 'lead') {
      const lead = activityLeadRow(activity);
      return lead ? <Button key={`${activity.id}-lead`} size="small" onClick={() => openLead(lead)} sx={{ justifyContent: 'flex-start', px: 0 }}>{lead.name}</Button> : '-';
    }
    if (field === 'action') {
      const typeCode = String(activity.type ?? '').padStart(3, '0');
      if (typeCode === '001') {
        const recordingUrl = recordingUrlForActivity(activity);
        return recordingUrl ? <Button key={`${activity.id}-recording`} size="small" startIcon={<PlayCircleOutlineIcon />} href={recordingUrl} target="_blank" rel="noreferrer">Play</Button> : '-';
      }
      if (!manualActivityTypeCodes.has(typeCode)) return '-';
      return (
        <RowActionMenu
          key={`${activity.id}-actions`}
          actions={[
            { label: 'Edit activity', icon: <EditIcon fontSize="small" />, onClick: () => openEditActivity(activity) },
            {
              label: deletingActivityId === activity.id ? 'Deleting activity' : 'Delete activity',
              icon: <DeleteOutlineIcon fontSize="small" />,
              tone: 'danger',
              disabled: deletingActivityId === activity.id,
              onClick: () => deleteActivity(activity.id)
            }
          ]}
        />
      );
    }
    if (field === 'type') return <MetaChip key={`${activity.id}-type`} label={labelForActivityType(activity.type)} />;
    if (field === 'disposition') return activity.disposition ? <MetaChip key={`${activity.id}-disp`} label={activity.disposition} /> : '-';
    if (field === 'createdAt') return formatDate(activity.createdAt);
    return String((activity as unknown as Record<string, unknown>)[field] ?? '-');
  };

  return (
    <ModuleShell
      title="Activities"
      subtitle={`Calls, notes, meetings, and system events · ${todayActivities.length} today`}
      actions={
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportActivities}>Export</Button>
          {manualActivityTypeOptions.length > 0 ? <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateActivity}>Log activity</Button> : null}
        </Stack>
      }
    >
      <Stack spacing={1}>
        <MessageAlert message={activityMessage} />
        <PageFilterBar rightContent={<Typography fontWeight={850}>Showing {exportedLabel}</Typography>}>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select value={activityType} onChange={(event) => changeActivityType(event.target.value)}>
              {selectedActivityTypeOptions.map((type) => <MenuItem key={type.code} value={type.code}>Type: {type.code} · {type.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FilterPill label="Owner" value={activityOwnerFilter === 'me' ? 'Me' : 'Anyone'} muted onClick={() => currentUserId ? setActivityOwnerFilter((current) => current === 'me' ? 'any' : 'me') : undefined} />
          <FilterPill label="Lead" value={activityLeadFilter === 'linked' ? 'Linked' : 'Any'} muted onClick={() => setActivityLeadFilter((current) => current === 'linked' ? 'any' : 'linked')} />
          <FilterPill label="Date" value={activityDateFilter === 'today' ? 'Today' : 'All'} muted onClick={() => setActivityDateFilter((current) => current === 'today' ? 'all' : 'today')} />
          <FilterPill label="+ Add filter" muted onClick={() => setAdvancedFilterOpen(true)} />
        </PageFilterBar>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
          <MetricCard label="Calls Today" value={callsToday.length} detail={`${callsToday.filter((activity) => /answered|connected/i.test(String(activity.metadata?.Status ?? activity.disposition ?? ''))).length} connected`} trend={callsToday.length ? '+ Today' : '0'} icon={<CallOutlinedIcon />} />
          <MetricCard label="Messages Sent" value={todayActivities.filter((activity) => ['004', '009'].includes(normalizeActivityTypeCode(activity.type))).length} detail="WhatsApp and connector messages" trend="+0" icon={<SendOutlinedIcon />} />
          <MetricCard label="Meetings Booked" value={meetingsToday.length} detail={`${meetingsToday.length} same-day`} trend={`+${meetingsToday.length}`} icon={<EventAvailableOutlinedIcon />} />
          <MetricCard label="Notes Added" value={notesToday.length} detail={`${notesToday.length} visible`} trend={`+${notesToday.length}`} icon={<NotesOutlinedIcon />} />
        </Box>
        <Section title="Activity List">
          <Stack spacing={0.75} sx={{ p: 0.85 }}>
            <TableToolbar
              search={activitySearch}
              onSearchChange={setActivitySearch}
              searchPlaceholder="Search activities"
              quickFilters={<MetaChip label={labelForActivityType(activityType)} />}
              columnsControl={<FieldSelector fields={activityFieldOptions} selected={visibleActivityFields} onChange={setVisibleActivityFields} />}
            />
          </Stack>
          <CompactDataTable
            loading={loadingActivities}
            columns={visibleActivityFields.map((field) => labelByKey.get(field) ?? humanizeKey(field))}
            rowIds={filteredActivities.map((activity) => activity.id)}
            rows={filteredActivities.map((activity) => visibleActivityFields.map((field) => renderActivityCell(activity, field)))}
          />
        </Section>
      </Stack>
      <FormDialog
        open={advancedFilterOpen}
        title="Activity Advanced Filters"
        subtitle="Filter activity queues by lead, disposition, dates, and custom activity fields."
        onClose={() => setAdvancedFilterOpen(false)}
        maxWidth="lg"
        actions={(
          <>
            <Button variant="text" onClick={() => setAdvancedConditions([])}>Clear</Button>
            <Button variant="contained" onClick={() => setAdvancedFilterOpen(false)}>Apply</Button>
          </>
        )}
      >
        <AdvancedFilterBuilder
          fields={activityFieldOptions}
          fieldByKey={fieldByKey}
          match={advancedMatch}
          onMatchChange={setAdvancedMatch}
          conditions={advancedConditions}
          onConditionsChange={setAdvancedConditions}
        />
      </FormDialog>
      <FormDialog
        open={createActivityOpen}
        title="Log Activity"
        subtitle="Create a manual activity against a lead. Call activities are created only from telephony."
        onClose={() => setCreateActivityOpen(false)}
        actions={(
          <>
            <Button onClick={() => setCreateActivityOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={creatingActivity || !activityCreateForm.leadId || !activityCreateForm.type || !activityCreateForm.title} onClick={createActivity}>
              {creatingActivity ? 'Creating...' : 'Create Activity'}
            </Button>
          </>
        )}
      >
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Search leads"
            placeholder="Name, mobile, or loan ID"
            value={leadSearchQuery}
            onChange={(event) => setLeadSearchQuery(event.target.value)}
            InputProps={{ endAdornment: leadSearchLoading ? <Typography fontSize={11} color="text.secondary" sx={{ whiteSpace: 'nowrap', pr: 0.5 }}>Searching…</Typography> : null }}
          />
          <FormControl size="small">
            <Select
              displayEmpty
              value={activityCreateForm.leadId}
              onChange={(event) => setActivityCreateForm({ ...activityCreateForm, leadId: event.target.value })}
            >
              <MenuItem value="">{leadSearchLoading ? 'Searching…' : activityLeadOptions.length === 0 ? 'No leads found' : 'Select lead'}</MenuItem>
              {activityLeadOptions.map((lead) => (
                <MenuItem key={lead.id} value={lead.id}>
                  {(lead.customerName || lead.mobile || lead.externalLeadId || lead.id)}{lead.mobile ? ` · ${lead.mobile}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select value={activityCreateForm.type} onChange={(event) => {
              setActivityCreateForm({ ...activityCreateForm, type: event.target.value });
              setActivityCustomCreateValues({});
            }}>
              {manualActivityTypeOptions.map((type) => <MenuItem key={type.code} value={type.code}>{type.code} · {type.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Title" value={activityCreateForm.title} onChange={(event) => setActivityCreateForm({ ...activityCreateForm, title: event.target.value })} />
          <FormControl size="small">
            <Select
              displayEmpty
              value={activityCreateForm.disposition}
              onChange={(event) => setActivityCreateForm({ ...activityCreateForm, disposition: event.target.value })}
            >
              <MenuItem value="">Disposition</MenuItem>
              {dispositionOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Notes" multiline minRows={3} value={activityCreateForm.notes} onChange={(event) => setActivityCreateForm({ ...activityCreateForm, notes: event.target.value })} />
          {activityCreateDefinitions.map((field) => (
            <TextField
              key={field.id}
              size="small"
              label={field.label}
              value={activityCustomCreateValues[field.fieldKey] ?? ''}
              onChange={(event) => setActivityCustomCreateValues({ ...activityCustomCreateValues, [field.fieldKey]: event.target.value })}
            />
          ))}
        </Stack>
      </FormDialog>
      <FormDialog
        open={Boolean(editingActivity)}
        title="Edit Activity"
        subtitle="Update the activity details and active custom fields."
        onClose={() => setEditingActivity(null)}
        actions={(
          <>
            <Button onClick={() => setEditingActivity(null)}>Cancel</Button>
            <Button variant="contained" disabled={!activityEditForm.title} onClick={saveActivity}>Save Activity</Button>
          </>
        )}
      >
        <Stack spacing={1}>
          <FormControl size="small">
            <Select value={activityEditForm.type} onChange={(event) => setActivityEditForm({ ...activityEditForm, type: event.target.value })}>
              {manualActivityTypeOptions.map((type) => <MenuItem key={type.code} value={type.code}>{type.code} · {type.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Title" value={activityEditForm.title} onChange={(event) => setActivityEditForm({ ...activityEditForm, title: event.target.value })} />
          <FormControl size="small">
            <Select
              displayEmpty
              value={activityEditForm.disposition}
              onChange={(event) => setActivityEditForm({ ...activityEditForm, disposition: event.target.value })}
            >
              <MenuItem value="">Disposition</MenuItem>
              {dispositionOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Notes" multiline minRows={3} value={activityEditForm.notes} onChange={(event) => setActivityEditForm({ ...activityEditForm, notes: event.target.value })} />
          {activityDefinitions.map((field) => (
            <TextField
              key={field.id}
              size="small"
              label={field.label}
              value={activityCustomEditValues[field.fieldKey] ?? ''}
              onChange={(event) => setActivityCustomEditValues({ ...activityCustomEditValues, [field.fieldKey]: event.target.value })}
            />
          ))}
        </Stack>
      </FormDialog>
    </ModuleShell>
  );
}
