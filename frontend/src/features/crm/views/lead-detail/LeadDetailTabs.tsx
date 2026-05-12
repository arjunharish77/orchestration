'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { Box, Button, Checkbox, Collapse, FormControl, FormHelperText, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { StatusChip } from '../../../../components/common/StatusChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { MessageAlert } from '../../../../components/common/MessageAlert';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { ActivityCard, PropertyRow } from '../../components/LeadDetailParts';
import type {
  LeadActivityForm,
  LeadActivityRow,
  LeadAuditRow,
  LeadDetailData,
  LeadDispositionField,
  LeadFieldDefinition,
  LeadLike,
  LeadTaskForm,
  LeadTaskRow
} from './lead-detail-types';

const green = '#2d6a2d';
const bg = '#fafdfa';
const panel = '#ffffff';

function recordingUrlForActivity(activity: LeadActivityRow) {
  const value = activity.metadata?.recordingUrl ?? activity.metadata?.ResourceURL ?? activity.metadata?.resourceUrl;
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
}

function formatActivityValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.map((item) => formatActivityValue(item)).join(', ');
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[hidden]');
}

function isPlaybackActivity(activity: LeadActivityRow) {
  return String(activity.type ?? '').padStart(3, '0') === '001' && Boolean(recordingUrlForActivity(activity));
}

function isRawIdKey(key: string) {
  const normalized = key.replace(/[_\s-]+/g, '').toLowerCase();
  return normalized === 'id' || normalized.endsWith('id');
}

function activityStatus(activity: LeadActivityRow) {
  const metadata = activity.metadata ?? {};
  const raw = metadata.status ?? metadata.messageStatus ?? metadata.callStatus ?? metadata.deliveryStatus;
  if (raw) return formatActivityValue(raw);
  const title = String(activity.title ?? '').toLowerCase();
  if (title.includes('queued')) return 'Queued';
  if (title.includes('sent')) return 'Sent';
  if (title.includes('delivered')) return 'Delivered';
  if (title.includes('read')) return 'Read';
  if (title.includes('failed')) return 'Failed';
  return '-';
}

export function LeadOverviewTab({ lead }: { lead: LeadLike }) {
  return (
    <Stack spacing={1}>
      <Section title="Lead Overview">
        <PropertyRow label="Customer Name" value={lead.name} />
        <PropertyRow label="Mobile" value={lead.phone} />
        <PropertyRow label="Lead Status" value={lead.status} />
        <PropertyRow label="Lead Category" value={lead.category} />
        <PropertyRow label="Branch" value={`${lead.branch} · ${lead.branchName}`} />
        <PropertyRow label="Owner" value={lead.owner} />
      </Section>
      <Section title="Loan Details">
        <PropertyRow label="Loan Offer Amount" value={lead.amount} />
        <PropertyRow label="EMI Amount" value={lead.emi} />
        <PropertyRow label="Preferred Language" value={lead.language} />
      </Section>
    </Stack>
  );
}

export function LeadActivitiesTab({
  lead,
  activityRows,
  activityForm,
  setActivityForm,
  activityTypeOptions,
  dispositionOptions,
  activityDefinitions,
  activityCustomValues,
  setActivityCustomValues,
  customFieldOptions,
  createActivity,
  updateActivity,
  editingActivityId,
  cancelEditActivity,
  savingActivity,
  activityMessage,
  onEditActivity,
  onDeleteActivity,
  deletingActivityId,
  resolveUserName
}: {
  lead: LeadLike;
  activityRows: LeadActivityRow[];
  activityForm: LeadActivityForm;
  setActivityForm: (value: LeadActivityForm) => void;
  activityTypeOptions: Array<{ code: string; label: string; allowManualCreate?: boolean }>;
  dispositionOptions: string[];
  activityDefinitions: LeadFieldDefinition[];
  activityCustomValues: Record<string, unknown>;
  setActivityCustomValues: (value: Record<string, unknown>) => void;
  customFieldOptions: (field: LeadFieldDefinition) => string[];
  createActivity: () => void;
  updateActivity?: () => void;
  editingActivityId?: string | null;
  cancelEditActivity?: () => void;
  savingActivity: boolean;
  activityMessage?: string | null;
  onEditActivity?: (activity: LeadActivityRow) => void;
  onDeleteActivity?: (activityId: string) => void;
  deletingActivityId?: string | null;
  resolveUserName?: (value?: string | null) => string;
}) {
  const [activityFilterType, setActivityFilterType] = useState('all');
  const [activityFilterRange, setActivityFilterRange] = useState('all');
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  useEffect(() => {
    if (editingActivityId) setActivityDialogOpen(true);
  }, [editingActivityId]);
  const activityTypeFilterOptions = useMemo(() => {
    const usedCodes = new Set(activityRows.map((activity) => String(activity.type ?? '').padStart(3, '0')));
    return activityTypeOptions.filter((option) => usedCodes.has(option.code));
  }, [activityRows, activityTypeOptions]);
  const manualActivityTypeOptions = useMemo(
    () => activityTypeOptions.filter((type) => type.allowManualCreate === true),
    [activityTypeOptions]
  );
  const manualTypeCodes = useMemo(() => new Set(manualActivityTypeOptions.map((type) => type.code)), [manualActivityTypeOptions]);
  const filteredActivityRows = useMemo(() => activityRows.filter((activity) => {
    const typeCode = String(activity.type ?? '').padStart(3, '0');
    if (activityFilterType !== 'all' && typeCode !== activityFilterType) return false;
    if (activityFilterRange === 'all') return true;
    const createdAt = new Date(activity.createdAt ?? '');
    if (Number.isNaN(createdAt.getTime())) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    if (activityFilterRange === 'today') return createdAt >= startOfToday && createdAt < startOfTomorrow;
    if (activityFilterRange === 'week') {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      return createdAt >= startOfWeek;
    }
    if (activityFilterRange === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return createdAt >= startOfMonth;
    }
    return true;
  }), [activityFilterRange, activityFilterType, activityRows]);
  const closeActivityDialog = () => {
    setActivityDialogOpen(false);
    if (editingActivityId) cancelEditActivity?.();
  };
  const saveActivity = () => {
    if (editingActivityId && updateActivity) {
      updateActivity();
    } else {
      createActivity();
    }
    setActivityDialogOpen(false);
  };

  return (
    <Stack spacing={1.1}>
      <Paper variant="outlined" sx={{ p: 0.8, borderRadius: 1, bgcolor: panel, borderColor: '#e0ede0', boxShadow: '0 8px 22px rgba(22, 39, 22, 0.05)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={800} sx={{ letterSpacing: 0 }}>ACTIVITY FILTERS</Typography>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select value={activityFilterType} onChange={(event) => setActivityFilterType(event.target.value)}>
                <MenuItem value="all">All Types</MenuItem>
                {activityTypeFilterOptions.map((type) => <MenuItem key={type.code} value={type.code}>{type.code} · {type.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select value={activityFilterRange} onChange={(event) => setActivityFilterRange(event.target.value)}>
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
              </Select>
            </FormControl>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                if (!editingActivityId && !manualActivityTypeOptions.some((type) => type.code === activityForm.type)) {
                  setActivityForm({ ...activityForm, type: manualActivityTypeOptions[0]?.code ?? '002' });
                }
                setActivityDialogOpen(true);
              }}
              sx={{ borderRadius: 1, whiteSpace: 'nowrap' }}
            >
              Add Activity
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <MessageAlert message={activityMessage} />
      <FormDialog
        open={activityDialogOpen}
        title={editingActivityId ? 'Edit Activity' : 'Add Activity'}
        subtitle="Capture notes, meetings, dispositions, and activity custom fields for this lead. Calls are created only from telephony call logs."
        onClose={closeActivityDialog}
        maxWidth="lg"
        actions={[
          <Button key="cancel" onClick={closeActivityDialog}>Cancel</Button>,
          <Button key="save" variant="contained" disabled={savingActivity || !activityForm.title} onClick={saveActivity}>{editingActivityId ? 'Save Activity' : 'Add Activity'}</Button>
        ]}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '160px 1fr 1fr' } }}>
          <FormControl size="small">
            <Select value={activityForm.type} onChange={(event) => setActivityForm({ ...activityForm, type: event.target.value })}>
              {manualActivityTypeOptions.map((type) => <MenuItem key={type.code} value={type.code}>{type.code} · {type.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Title" value={activityForm.title} onChange={(event) => setActivityForm({ ...activityForm, title: event.target.value })} />
          <FormControl size="small">
            <Select displayEmpty value={activityForm.disposition} onChange={(event) => setActivityForm({ ...activityForm, disposition: event.target.value })}>
              <MenuItem value="">Lead disposition</MenuItem>
              {dispositionOptions.map((disposition) => <MenuItem key={disposition} value={disposition}>{disposition}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Notes" value={activityForm.notes} onChange={(event) => setActivityForm({ ...activityForm, notes: event.target.value })} sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
          {activityDefinitions.map((field) => {
            const options = customFieldOptions(field);
            if (field.fieldType === 'boolean') {
              return (
                <Stack key={field.id} direction="row" alignItems="center" spacing={0.5}>
                  <Checkbox size="small" checked={Boolean(activityCustomValues[field.fieldKey])} onChange={(event) => setActivityCustomValues({ ...activityCustomValues, [field.fieldKey]: event.target.checked })} />
                  <Typography fontSize={12}>{field.label}{field.isRequired ? ' *' : ''}</Typography>
                </Stack>
              );
            }
            if (options.length > 0 && field.fieldType === 'select') {
              return (
                <FormControl key={field.id} size="small">
                  <Select displayEmpty value={String(activityCustomValues[field.fieldKey] ?? '')} onChange={(event) => setActivityCustomValues({ ...activityCustomValues, [field.fieldKey]: event.target.value })}>
                    <MenuItem value="">{field.label}{field.isRequired ? ' *' : ''}</MenuItem>
                    {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </Select>
                </FormControl>
              );
            }
            return (
              <TextField key={field.id} size="small" label={`${field.label}${field.isRequired ? ' *' : ''}`} value={String(activityCustomValues[field.fieldKey] ?? '')} onChange={(event) => setActivityCustomValues({ ...activityCustomValues, [field.fieldKey]: event.target.value })} />
            );
          })}
        </Box>
      </FormDialog>
      {filteredActivityRows.length > 0 ? filteredActivityRows.map((activity) => {
        const typeCode = String(activity.type ?? '').padStart(3, '0');
        const canManuallyMaintain = manualTypeCodes.has(typeCode);
        const recordingUrl = recordingUrlForActivity(activity);
        const metadataRows = Object.entries(activity.metadata ?? {}).filter(([key, value]) => !isRawIdKey(key) && value !== null && value !== undefined && value !== '');
        const customRows = activity.customFields ?? [];
        const isExpanded = expandedActivityId === activity.id;
        const createdByName = resolveUserName?.(activity.createdBy) ?? activity.createdBy ?? 'System';
        const status = activityStatus(activity);
        return (
        <Stack key={activity.id} spacing={0.5}>
          <ActivityCard activity={activity} lead={lead} createdByName={createdByName} expanded={isExpanded} onToggle={() => setExpandedActivityId(isExpanded ? null : activity.id)} />
          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            {isPlaybackActivity(activity) ? <Button size="small" variant="outlined" startIcon={<PlayCircleOutlineIcon />} href={recordingUrl} target="_blank" rel="noreferrer">Play Recording</Button> : null}
            {canManuallyMaintain && (onEditActivity || onDeleteActivity) ? (
              <RowActionMenu
                ariaLabel={`Actions for ${activity.title}`}
                actions={[
                  ...(onEditActivity ? [{ label: 'Edit activity', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEditActivity(activity) }] : []),
                  ...(onDeleteActivity ? [{
                    label: deletingActivityId === activity.id ? 'Deleting' : 'Delete activity',
                    icon: <DeleteOutlineIcon fontSize="small" />,
                    tone: 'danger' as const,
                    disabled: deletingActivityId === activity.id,
                    onClick: () => onDeleteActivity(activity.id)
                  }] : [])
                ]}
              />
            ) : null}
          </Stack>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Paper variant="outlined" sx={{ borderRadius: 1, p: 1, bgcolor: '#fafdfa', borderColor: '#e0ede0' }}>
              <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                <PropertyRow label="Title" value={activity.title} />
                <PropertyRow label="Type" value={activityTypeOptions.find((type) => type.code === typeCode)?.label ?? typeCode} />
                <PropertyRow label="Status" value={status} />
                <PropertyRow label="Disposition" value={activity.disposition ?? '-'} />
                <PropertyRow label="Added By" value={createdByName} />
                <PropertyRow label="Notes" value={activity.notes ?? '-'} />
                {customRows.map((field) => <PropertyRow key={`${activity.id}-${field.key}`} label={field.label || field.key} value={formatActivityValue(field.value)} />)}
                {metadataRows.map(([key, value]) => <PropertyRow key={`${activity.id}-meta-${key}`} label={key.replace(/[_-]+/g, ' ')} value={formatActivityValue(value)} />)}
              </Box>
            </Paper>
          </Collapse>
        </Stack>
        );
      }) : (
        <Paper variant="outlined" sx={{ borderRadius: 1, p: 1, bgcolor: bg, borderColor: '#e0ede0' }}>
          <Typography color="text.secondary">No activities match the selected filters.</Typography>
        </Paper>
      )}
    </Stack>
  );
}

export function LeadDispositionsTab({
  dispositionFields,
  dispositionValues,
  setDispositionValues,
  dispositionMessage
}: {
  dispositionFields: LeadDispositionField[];
  dispositionValues: Record<string, string>;
  setDispositionValues: (value: Record<string, string>) => void;
  dispositionMessage?: string | null;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
      {dispositionFields.map((field) => {
        const value = dispositionValues[field.fieldKey] ?? '';
        const showRequiredHint = field.isRequired && !value;
        if (field.options?.length) {
          return (
            <FormControl key={field.fieldKey} size="small" required={field.isRequired} error={showRequiredHint}>
              <Select displayEmpty value={value} onChange={(event) => setDispositionValues({ ...dispositionValues, [field.fieldKey]: event.target.value })}>
                <MenuItem value="">{field.label}{field.isRequired ? ' *' : ''}</MenuItem>
                {field.options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
              </Select>
              {showRequiredHint ? <FormHelperText>{field.label} is required</FormHelperText> : null}
            </FormControl>
          );
        }
        return (
          <TextField key={field.fieldKey} size="small" required={field.isRequired} error={showRequiredHint} helperText={showRequiredHint ? `${field.label} is required` : undefined} label={`${field.label}${field.isRequired ? ' *' : ''}`} type={field.fieldType === 'datetime' ? 'datetime-local' : 'text'} InputLabelProps={field.fieldType === 'datetime' ? { shrink: true } : undefined} value={value} onChange={(event) => setDispositionValues({ ...dispositionValues, [field.fieldKey]: event.target.value })} sx={field.fieldKey === 'remarks' ? { gridColumn: { xs: 'auto', md: '1 / -1' } } : undefined} />
        );
      })}
      <MessageAlert message={dispositionMessage} />
    </Box>
  );
}

export function LeadTasksTab({
  taskRows,
  taskForm,
  setTaskForm,
  taskTypeOptions,
  userOptions,
  createTask,
  savingTask,
  taskMessage,
  formatDate
}: {
  taskRows: LeadTaskRow[];
  taskForm: LeadTaskForm;
  setTaskForm: (value: LeadTaskForm) => void;
  taskTypeOptions: string[];
  userOptions: Array<{ id: string; name: string }>;
  createTask: () => void;
  savingTask: boolean;
  taskMessage?: string | null;
  formatDate: (value?: string | null) => string;
}) {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const saveTask = () => {
    createTask();
    setTaskDialogOpen(false);
  };

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        {taskMessage ? <MessageAlert message={taskMessage} /> : <Typography color="text.secondary">Create and track follow-ups for this lead.</Typography>}
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setTaskDialogOpen(true)} sx={{ borderRadius: 1 }}>Create Task</Button>
      </Stack>
      <FormDialog
        open={taskDialogOpen}
        title="Create Task"
        subtitle="Add a follow-up, callback, or reminder for this lead."
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="md"
        actions={[
          <Button key="cancel" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>,
          <Button key="save" variant="contained" disabled={savingTask || !taskForm.taskType || !taskForm.assignedTo} onClick={saveTask}>Add Task</Button>
        ]}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
          <FormControl size="small">
            <Select value={taskForm.taskType} onChange={(event) => setTaskForm({ ...taskForm, taskType: event.target.value })}>
              {taskTypeOptions.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>
              {['Low', 'Medium', 'High'].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Due date and time" type="datetime-local" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} InputLabelProps={{ shrink: true }} />
          <FormControl size="small">
            <Select displayEmpty value={taskForm.assignedTo} onChange={(event) => setTaskForm({ ...taskForm, assignedTo: event.target.value })}>
              <MenuItem value="">Assign to user *</MenuItem>
              {userOptions.map((user) => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Remarks" value={taskForm.remarks} onChange={(event) => setTaskForm({ ...taskForm, remarks: event.target.value })} sx={{ gridColumn: { xs: 'auto', md: '2 / -1' } }} />
        </Box>
      </FormDialog>
      <CompactDataTable columns={['Task', 'Status', 'Priority', 'Due', 'Assigned', 'Remarks']} rows={taskRows.map((task) => [
        <Typography key={task.id} color={green} fontWeight={800}>{task.taskType}</Typography>,
        <StatusChip key={`${task.id}-status`} status={task.status} />,
        task.priority ?? '-',
        formatDate(task.dueDate),
        userOptions.find((user) => user.id === task.assignedTo)?.name ?? (task.assignedTo ? 'Unknown user' : '-'),
        task.remarks ?? '-'
      ])} />
    </Stack>
  );
}

export function LeadCallsTab({ activityRows, normalizeActivityTypeCode, labelForActivityType, formatDate, resolveUserName }: { activityRows: LeadActivityRow[]; normalizeActivityTypeCode: (value?: string | null) => string; labelForActivityType: (value?: string | null) => string; formatDate: (value?: string | null) => string; resolveUserName?: (value?: string | null) => string }) {
  return <CompactDataTable columns={['Call', 'Disposition', 'Summary', 'Recording', 'Added By', 'Created']} rows={activityRows.filter((activity) => ['001', '013'].includes(normalizeActivityTypeCode(activity.type))).map((activity) => {
    const recordingUrl = recordingUrlForActivity(activity);
    return [
      <Typography key={activity.id} color={green} fontWeight={800}>{labelForActivityType(activity.type)}</Typography>,
      activity.disposition ?? '-',
      activity.notes ?? activity.title ?? '-',
      recordingUrl ? <Button key={`${activity.id}-recording`} size="small" startIcon={<PlayCircleOutlineIcon />} href={recordingUrl} target="_blank" rel="noreferrer">Play</Button> : '-',
      resolveUserName?.(activity.createdBy) ?? 'Unknown user',
      formatDate(activity.createdAt)
    ];
  })} />;
}

export function LeadAutomationHistoryTab({ leadDetail, formatDate }: { leadDetail: LeadDetailData | null; formatDate: (value?: string | null) => string }) {
  return <CompactDataTable columns={['Workflow', 'Step', 'Status', 'Started', 'Finished']} rows={(leadDetail?.automationRuns ?? []).map((run) => ['Automation workflow', run.currentStep ?? run.steps?.[0]?.nodeName ?? '-', <StatusChip key={run.id} status={run.status} />, formatDate(run.startedAt), formatDate(run.finishedAt)])} />;
}

export function LeadAuditTab({ auditRows, labelForModule, formatDate, resolveUserName }: { auditRows: LeadAuditRow[]; labelForModule: (value?: string | null) => string; formatDate: (value?: string | null) => string; resolveUserName?: (value?: string | null) => string }) {
  return <CompactDataTable columns={['Action', 'Module', 'Modified By', 'Type', 'Created']} rows={auditRows.map((audit) => [<Typography key={audit.id} color={green} fontWeight={800}>{audit.action}</Typography>, labelForModule(audit.moduleName), resolveUserName?.(audit.changedBy) ?? 'Unknown user', audit.changedByType ?? '-', formatDate(audit.createdAt)])} />;
}

export function LeadCustomFieldsTab({ lead, formatCellValue }: { lead: LeadLike; formatCellValue: (value: unknown) => string }) {
  return <CompactDataTable columns={['Field', 'Value']} rows={(lead.customFields ?? []).map((field) => [<Typography key={field.key} color={green} fontWeight={800}>{field.label}</Typography>, formatCellValue(field.value)])} emptyLabel="No custom fields found" />;
}

export function LeadNotesTab({ activityRows, labelForActivityType, formatDate, resolveUserName }: { activityRows: LeadActivityRow[]; labelForActivityType: (value?: string | null) => string; formatDate: (value?: string | null) => string; resolveUserName?: (value?: string | null) => string }) {
  return <CompactDataTable columns={['Note', 'Activity', 'Added By', 'Created']} rows={activityRows.filter((activity) => Boolean(activity.notes)).map((activity) => [activity.notes ?? '-', labelForActivityType(activity.type), resolveUserName?.(activity.createdBy) ?? 'Unknown user', formatDate(activity.createdAt)])} emptyLabel="No notes found" />;
}
