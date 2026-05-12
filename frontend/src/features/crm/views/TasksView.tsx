'use client';

import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import SearchIcon from '@mui/icons-material/Search';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ViewListIcon from '@mui/icons-material/ViewList';
import { Box, Button, Card, FormControl, IconButton, InputAdornment, ListItemIcon, Menu, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AdvancedFilterBuilder, AdvancedFilterCondition } from '../../../components/common/AdvancedFilterBuilder';
import { MetaChip } from '../../../components/common/MetaChip';
import { StatusChip } from '../../../components/common/StatusChip';
import { CapsuleButton } from '../../../components/common/CapsuleButton';
import { CompactDataTable } from '../../../components/common/CompactDataTable';
import { FieldSelector } from '../../../components/common/FieldSelector';
import { FormDialog } from '../../../components/common/FormDialog';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { TableToolbar } from '../../../components/common/TableToolbar';
import { FilterPill, ModuleShell, PageFilterBar, SectionPanel as Section, SegmentedTabs } from '../../../components/common/WorkspacePrimitives';
import { apiRequest } from '../../../lib/api';
import { defaultTaskLists } from '../../../lib/crm-defaults';
import { FieldOption } from '../../../lib/field-metadata';
import { formatDate, humanizeKey } from '../../../lib/format';
import { buildTaskFieldOptions } from './tasks/task-columns';

const green = '#2d6a2d';
const line = '#e0ede0';
const tint = '#eef7ee';

type TaskLeadRow = {
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

type TaskRow = {
  id: string;
  leadId?: string | null;
  taskType: string;
  priority: string;
  status: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  remarks?: string | null;
  lead?: { id: string; externalLeadId?: string | null; customerName?: string | null; mobile?: string | null } | null;
  comments?: Array<{ id: string; comment: string; createdAt?: string; createdBy?: string | null }>;
};

type AccessOverview = {
  users?: Array<{ id: string; name?: string | null; email?: string | null }>;
};

type TaskUserOption = {
  id: string;
  name: string;
};

type LeadOption = {
  id: string;
  externalLeadId?: string | null;
  customerName?: string | null;
  mobile?: string | null;
};

type LeadListPayload = {
  items?: LeadOption[];
};

const emptyCreateTaskForm = {
  leadId: '',
  assignedTo: '',
  taskType: '',
  priority: 'Medium',
  dueDate: '',
  remarks: ''
};

function dateBounds(label: 'today' | 'yesterday' | 'this_week' | 'this_month') {
  const now = new Date();
  const start = new Date(now);
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

function isDueToday(value?: string | null) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = dateBounds('today');
  return due >= today.start && due < today.end;
}

function isDueTomorrow(value?: string | null) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const tomorrowStart = dateBounds('today').start;
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  return due >= tomorrowStart && due < tomorrowEnd;
}

function isDueThisWeek(value?: string | null) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const { start, end } = dateBounds('this_week');
  return due >= start && due < end;
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  return due < new Date();
}

function taskDueLabel(task: TaskRow) {
  if (!task.dueDate) return '-';
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return '-';
  if (isOverdue(task.dueDate)) {
    return `Overdue · ${formatDate(task.dueDate)}`;
  }
  if (isDueToday(task.dueDate)) {
    return due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isDueTomorrow(task.dueDate)) return `Tomorrow · ${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return formatDate(task.dueDate);
}

function TaskMetricCard({ title, value, hint, accent = green }: { title: string; value: string | number; hint?: string; icon?: ReactNode; accent?: string; action?: string }) {
  return (
    <Card
      sx={{
        minHeight: 96,
        borderRadius: '8px',
        p: 1.25,
        border: `1px solid ${line}`,
        bgcolor: '#fff',
        boxShadow: '0 12px 28px rgba(22, 39, 22, 0.035)',
        borderLeft: `3px solid ${accent}`
      }}
    >
      <Typography color="text.secondary" fontWeight={800} fontSize={11} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 30, lineHeight: 1.05, mt: 0.5 }}>{value}</Typography>
      {hint ? <Typography color="text.secondary" fontSize={11} sx={{ mt: 0.35 }}>{hint}</Typography> : null}
    </Card>
  );
}

function TaskBoardCard({ task, openLead }: { task: TaskRow; openLead: (lead: TaskLeadRow) => void }) {
  const overdue = task.status !== 'Completed' && isOverdue(task.dueDate);
  const leadName = task.lead?.customerName ?? task.lead?.mobile ?? 'No lead';
  const lead = task.lead ? {
    id: task.lead.externalLeadId ?? task.lead.id,
    dbId: task.lead.id,
    initials: String(task.lead.customerName ?? 'L').charAt(0).toUpperCase(),
    name: task.lead.customerName ?? task.lead.mobile ?? 'Lead',
    email: '-',
    phone: task.lead.mobile ?? '-',
    branch: '-',
    branchName: '-',
    amount: '-',
    emi: '-',
    status: '-',
    category: '-',
    source: '-',
    created: '-',
    owner: '-',
    team: '-',
    language: '-'
  } : null;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: overdue ? '#c44242' : line,
        borderLeft: overdue ? '3px solid #c44242' : `1px solid ${line}`,
        borderRadius: '8px',
        p: 0.85,
        bgcolor: '#fff',
        minHeight: 88,
        boxShadow: '0 10px 24px rgba(22, 39, 22, 0.035)',
        '&:hover': { borderColor: overdue ? '#c44242' : '#b8d8b8', transform: 'translateY(-1px)' },
        transition: '160ms ease'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography sx={{ color: overdue ? '#ad3434' : 'text.secondary', fontWeight: 800 }}>{taskDueLabel(task)}</Typography>
        <StatusChip status={task.priority || 'Normal'} />
      </Stack>
      <Typography sx={{ mt: 0.65, fontWeight: 800, color: '#162716', lineHeight: 1.2 }}>{task.taskType}</Typography>
      {task.remarks ? <Typography color="text.secondary" fontSize={12} sx={{ mt: 0.25 }}>{task.remarks}</Typography> : null}
      {lead ? (
        <Button size="small" onClick={() => openLead(lead)} sx={{ mt: 0.35, px: 0, justifyContent: 'flex-start', color: 'text.secondary', fontWeight: 800 }}>
          {leadName}
        </Button>
      ) : (
        <Typography color="text.secondary" fontSize={12} sx={{ mt: 0.45 }}>{leadName}</Typography>
      )}
    </Card>
  );
}

function TaskBoardColumn({ title, count, badge, tasks, openLead, muted }: { title: string; count: number; badge?: string; tasks: TaskRow[]; openLead: (lead: TaskLeadRow) => void; muted?: boolean }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.65 }}>
        <Typography sx={{ fontWeight: 800, color: '#162716', textTransform: 'uppercase', letterSpacing: 0 }}>{title} · {count}</Typography>
        {badge ? <MetaChip label={badge} /> : null}
      </Stack>
      <Stack spacing={0.55}>
        {tasks.length ? tasks.map((task) => <TaskBoardCard key={task.id} task={task} openLead={openLead} />) : (
          <Card variant="outlined" sx={{ borderColor: line, borderRadius: '8px', p: 1, bgcolor: muted ? '#f8fcf8' : '#fff', color: 'text.secondary', textAlign: 'center' }}>
            No tasks
          </Card>
        )}
      </Stack>
    </Box>
  );
}

export function TasksView({ authToken, openLead }: { authToken: string | null; openLead: (lead: TaskLeadRow) => void }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskUsers, setTaskUsers] = useState<TaskUserOption[]>([]);
  const [taskLists, setTaskLists] = useState(defaultTaskLists);
  const [statusFilter, setStatusFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [advancedConditions, setAdvancedConditions] = useState<AdvancedFilterCondition[]>([]);
  const [advancedMatch, setAdvancedMatch] = useState<'all' | 'any'>('all');
  const [visibleTaskFields, setVisibleTaskFields] = useState(['lead', 'taskType', 'priority', 'status', 'dueDate', 'action']);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(Boolean(authToken));
  const [selectedTaskRows, setSelectedTaskRows] = useState<number[]>([]);
  const [taskMenuAnchor, setTaskMenuAnchor] = useState<HTMLElement | null>(null);
  const [taskMenuRow, setTaskMenuRow] = useState<TaskRow | null>(null);
  const [assignTaskTarget, setAssignTaskTarget] = useState<TaskRow | null>(null);
  const [assignTaskUserId, setAssignTaskUserId] = useState('');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState(emptyCreateTaskForm);
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskViewMode, setTaskViewMode] = useState('board');

	  const taskQueryParams = useCallback(() => {
    const searchParams = new URLSearchParams();
    const today = dateBounds('today');
    if (statusFilter) searchParams.set('status', statusFilter);
    if (taskSearch.trim()) searchParams.set('search', taskSearch.trim());
    if (quickFilter === 'highPriority') searchParams.set('priority', 'High');
    if (quickFilter === 'dueToday') {
      searchParams.set('dueAfter', today.start.toISOString());
      searchParams.set('dueBefore', today.end.toISOString());
    }
    if (quickFilter === 'overdue') searchParams.set('status', 'Missed');
    searchParams.set('pageSize', '300');
    return searchParams;
	  }, [quickFilter, statusFilter, taskSearch]);

	  const toggleDueFilter = () => {
	    setQuickFilter((current) => current === 'dueToday' ? 'overdue' : current === 'overdue' ? '' : 'dueToday');
	  };

  const loadTasks = useCallback(async () => {
    if (!authToken) return;
    setTaskMessage(null);
    setLoadingTasks(true);
    try {
      const searchParams = taskQueryParams();
      const payload = await apiRequest<TaskRow[]>(`/tasks?${searchParams.toString()}`, { token: authToken });
      setTasks(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Could not load tasks');
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [authToken, taskQueryParams]);

  const updateTask = async (task: TaskRow, patch: Partial<TaskRow>) => {
    if (!authToken) return;
    setTaskMessage(null);
    try {
      await apiRequest(`/tasks/${encodeURIComponent(task.id)}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      await loadTasks();
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Could not update task');
    }
  };

  const deleteTask = async (task: TaskRow) => {
    if (!authToken) return;
    setTaskMessage(null);
    try {
      await apiRequest(`/tasks/${encodeURIComponent(task.id)}`, { token: authToken, method: 'DELETE' });
      await loadTasks();
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Could not delete task');
    }
  };

  const bulkUpdateTasks = async (patch: Partial<TaskRow>) => {
    if (!authToken || selectedTaskRows.length === 0) return;
    setTaskMessage(null);
    try {
      const selectedTasks = selectedTaskRows.map((rowIndex) => filteredTasks[rowIndex]).filter(Boolean);
      await Promise.all(selectedTasks.map((task) => apiRequest(`/tasks/${encodeURIComponent(task.id)}`, {
        token: authToken,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })));
      setSelectedTaskRows([]);
      setTaskMessage(`${selectedTasks.length} task(s) updated`);
      await loadTasks();
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Could not update selected tasks');
    }
  };

  const loadLeadOptions = useCallback(async (search = '') => {
    if (!authToken) return;
    try {
      const params = new URLSearchParams({ pageSize: '25', sortBy: 'updatedAt', sortOrder: 'desc' });
      if (search.trim()) params.set('search', search.trim());
      const payload = await apiRequest<LeadListPayload>(`/leads?${params.toString()}`, { token: authToken });
      setLeadOptions(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setLeadOptions([]);
    }
  }, [authToken]);

  const openCreateTaskDialog = () => {
    setCreateTaskForm((current) => ({
      ...current,
      taskType: current.taskType || taskLists.type[0] || 'Follow-up',
      assignedTo: current.assignedTo || taskUsers[0]?.id || ''
    }));
    setLeadSearch('');
    setCreateTaskOpen(true);
    void loadLeadOptions('');
  };

  const createTask = async () => {
    if (!authToken || !createTaskForm.leadId || !createTaskForm.assignedTo || !createTaskForm.taskType) return;
    setTaskMessage(null);
    setCreatingTask(true);
    try {
      await apiRequest('/tasks', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: createTaskForm.leadId,
          assignedTo: createTaskForm.assignedTo,
          taskType: createTaskForm.taskType,
          priority: createTaskForm.priority,
          status: 'Pending',
          dueDate: createTaskForm.dueDate || undefined,
          remarks: createTaskForm.remarks || undefined
        })
      });
      setCreateTaskOpen(false);
      setCreateTaskForm(emptyCreateTaskForm);
      setTaskMessage('Task created');
      await loadTasks();
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Could not create task');
    } finally {
      setCreatingTask(false);
    }
  };

  useEffect(() => {
    async function loadUsers() {
      if (!authToken) return;
      try {
        const payload = await apiRequest<AccessOverview>('/access/overview', { token: authToken });
        setTaskUsers(Array.isArray(payload.users) ? payload.users.map((user) => ({ id: user.id, name: user.name ?? user.email ?? user.id })) : []);
      } catch {
        setTaskUsers([]);
      }
    }
    void loadUsers();
    async function loadTaskLists() {
      if (!authToken) return;
      try {
        const payload = await apiRequest<typeof defaultTaskLists>('/settings/task-lists', { token: authToken });
        setTaskLists({
          type: Array.isArray(payload.type) ? payload.type : defaultTaskLists.type,
          status: Array.isArray(payload.status) ? payload.status : defaultTaskLists.status
        });
      } catch {
        setTaskLists(defaultTaskLists);
      }
    }
    void loadTaskLists();
  }, [authToken]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadTasks();
    }, 220);
    return () => window.clearTimeout(handle);
  }, [loadTasks]);

  useEffect(() => {
    if (!createTaskOpen) return;
    const handle = window.setTimeout(() => {
      void loadLeadOptions(leadSearch);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [createTaskOpen, leadSearch, loadLeadOptions]);

  const statusOptions = [...taskLists.status, 'Missed'];
  const taskFieldOptions: FieldOption[] = buildTaskFieldOptions({
    userNames: taskUsers.map((user) => user.name),
    taskTypes: taskLists.type,
    taskStatuses: taskLists.status
  });
  const taskLabelByKey = new Map(taskFieldOptions.map((field) => [field.key, field.label]));
  const taskFieldByKey = new Map(taskFieldOptions.map((field) => [field.key, field]));
  const taskValueByField = (task: TaskRow, field: string) => {
    if (field === 'lead') return task.lead?.customerName ?? task.lead?.mobile ?? '';
    if (field === 'assignedTo') return taskUsers.find((user) => user.id === task.assignedTo)?.name ?? (task.assignedTo ? 'Unknown user' : 'Unassigned');
    return (task as unknown as Record<string, unknown>)[field] ?? '';
  };
  const filteredTasks = tasks.filter((task) => {
    const conditionResults = advancedConditions.map((condition) => matchesCondition(taskValueByField(task, condition.field), condition, taskFieldByKey.get(condition.field)));
    const matchesAdvanced = conditionResults.length === 0 || (advancedMatch === 'all' ? conditionResults.every(Boolean) : conditionResults.some(Boolean));
    return matchesAdvanced;
  });
  const totalTasks = tasks.length;
  const highPriorityTasks = tasks.filter((task) => task.priority === 'High' && task.status !== 'Completed').length;
  const inProgressTasks = tasks.filter((task) => task.status === 'In Progress').length;
  const completedTasks = tasks.filter((task) => task.status === 'Completed').length;
  const urgentTasks = tasks.filter((task) => task.status !== 'Completed' && (task.priority === 'High' || isDueToday(task.dueDate) || isOverdue(task.dueDate)));
  const overdueTasks = urgentTasks.filter((task) => isOverdue(task.dueDate)).length;
  const openTasks = tasks.filter((task) => task.status !== 'Completed').length;
  const dueThisWeekTasks = tasks.filter((task) => task.status !== 'Completed' && isDueThisWeek(task.dueDate)).length;
  const boardTasks = filteredTasks.filter((task) => task.status !== 'Completed');
  const boardTodayTasks = boardTasks.filter((task) => isOverdue(task.dueDate) || isDueToday(task.dueDate));
  const boardTomorrowTasks = boardTasks.filter((task) => isDueTomorrow(task.dueDate));
  const boardWeekTasks = boardTasks.filter((task) => isDueThisWeek(task.dueDate) && !isDueToday(task.dueDate) && !isDueTomorrow(task.dueDate) && !isOverdue(task.dueDate));
  const boardDoneTasks = filteredTasks.filter((task) => task.status === 'Completed');
  const renderTaskCell = (task: TaskRow, field: string) => {
    if (field === 'lead') {
      const lead = task.lead ? {
        id: task.lead.externalLeadId ?? task.lead.id,
        dbId: task.lead.id,
        initials: String(task.lead.customerName ?? 'L').charAt(0).toUpperCase(),
        name: task.lead.customerName ?? task.lead.mobile ?? 'Lead',
        email: '-',
        phone: task.lead.mobile ?? '-',
        branch: '-',
        branchName: '-',
        amount: '-',
        emi: '-',
        status: '-',
        category: '-',
        source: '-',
        created: '-',
        owner: '-',
        team: '-',
        language: '-'
      } : null;
      return lead ? <Button key={`${task.id}-lead`} size="small" onClick={() => openLead(lead)} sx={{ justifyContent: 'flex-start', px: 0 }}>{lead.name}</Button> : '-';
    }
    if (field === 'status') return <StatusChip key={`${task.id}-status`} status={task.status} />;
    if (field === 'dueDate') return task.dueDate ? formatDate(task.dueDate) : '-';
    if (field === 'assignedTo') return taskUsers.find((user) => user.id === task.assignedTo)?.name ?? (task.assignedTo ? 'Unknown user' : 'Unassigned');
    if (field === 'action') {
      const completed = task.status === 'Completed';
      return (
        <IconButton
          key={`${task.id}-actions`}
          size="small"
          disabled={completed}
          aria-label={`Actions for ${task.taskType}`}
          onClick={(event) => {
            setTaskMenuAnchor(event.currentTarget);
            setTaskMenuRow(task);
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      );
    }
    return String((task as unknown as Record<string, unknown>)[field] ?? '-');
  };

  return (
    <ModuleShell
      title="Tasks"
      subtitle={`${openTasks} open · ${overdueTasks} overdue · ${dueThisWeekTasks} due this week`}
      actions={(
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <SegmentedTabs
            value={taskViewMode}
            onChange={setTaskViewMode}
            tabs={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
              { value: 'calendar', label: 'Calendar' }
            ]}
          />
          <CapsuleButton startIcon={<AddIcon />} onClick={openCreateTaskDialog}>Create Task</CapsuleButton>
        </Stack>
      )}
    >
      <Stack spacing={1}>
        <MessageAlert message={taskMessage} />
        <PageFilterBar>
          <TextField
            size="small"
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Search tasks"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ minWidth: { xs: '100%', sm: 250 }, '& .MuiOutlinedInput-root': { height: 38 } }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select value={statusFilter} displayEmpty onChange={(event) => setStatusFilter(event.target.value)}>
              <MenuItem value="">Status: All</MenuItem>
              {statusOptions.map((status) => <MenuItem key={status} value={status}>Status: {status}</MenuItem>)}
            </Select>
          </FormControl>
          <FilterPill label="Owner" value="Me" muted />
          <FilterPill label="Type" value="All" muted />
          <FilterPill label="Priority" value={quickFilter === 'highPriority' ? 'High' : 'All'} muted onClick={() => setQuickFilter(quickFilter === 'highPriority' ? '' : 'highPriority')} />
	          <FilterPill label="Due" value={quickFilter === 'dueToday' ? 'Today' : quickFilter === 'overdue' ? 'Overdue' : 'All'} muted onClick={toggleDueFilter} />
          <FilterPill label="+ Add filter" muted onClick={() => setAdvancedFilterOpen(true)} />
          <CapsuleButton startIcon={<AutorenewIcon />} variant="outlined" onClick={() => { void loadTasks(); }}>Refresh</CapsuleButton>
        </PageFilterBar>
        <Card sx={{ borderRadius: '8px', border: `1px solid ${line}`, bgcolor: tint, p: 1.25 }}>
          <Stack direction="row" spacing={1.1} alignItems="flex-start">
            <InfoOutlinedIcon sx={{ color: green, mt: 0.15 }} />
            <Box>
              <Typography variant="h6" fontWeight={850}>Task Reminders</Typography>
              <Typography color="text.secondary">
                {urgentTasks.length
                  ? `You have ${urgentTasks.length} priority task${urgentTasks.length === 1 ? '' : 's'} needing attention${overdueTasks ? `, including ${overdueTasks} overdue` : ''}.`
                  : 'No overdue or high-priority tasks need immediate attention.'}
              </Typography>
            </Box>
          </Stack>
        </Card>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
          <TaskMetricCard title="Total Tasks" value={totalTasks} hint="Across visible leads" icon={<ViewListIcon />} action="All" />
          <TaskMetricCard title="High Priority" value={highPriorityTasks} hint="Pending attention" icon={<ErrorOutlineIcon />} accent="#d32f2f" action="Action" />
          <TaskMetricCard title="In Progress" value={inProgressTasks} hint="Currently being handled" icon={<HourglassEmptyIcon />} />
          <TaskMetricCard title="Completed" value={completedTasks} hint="Closed task count" icon={<CheckCircleOutlineIcon />} />
        </Box>
        {taskViewMode === 'board' ? (
          <Box sx={{ display: 'grid', gap: 1.15, gridTemplateColumns: { xs: '1fr', lg: 'repeat(4, minmax(0, 1fr))' }, alignItems: 'start' }}>
            <TaskBoardColumn title="Today" count={boardTodayTasks.length} badge={overdueTasks ? `${overdueTasks} overdue` : undefined} tasks={boardTodayTasks} openLead={openLead} />
            <TaskBoardColumn title="Tomorrow" count={boardTomorrowTasks.length} tasks={boardTomorrowTasks} openLead={openLead} />
            <TaskBoardColumn title="This Week" count={boardWeekTasks.length} tasks={boardWeekTasks} openLead={openLead} />
            <TaskBoardColumn title="Done" count={boardDoneTasks.length} badge="7d" tasks={boardDoneTasks} openLead={openLead} muted />
          </Box>
        ) : null}
        {taskViewMode === 'calendar' ? (
          <Section title="Calendar">
            <Box sx={{ p: 1.25 }}>
              <Typography color="text.secondary" fontWeight={850}>Calendar view uses the same filtered tasks, grouped by due date.</Typography>
              <Box sx={{ mt: 1, display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
                <TaskBoardColumn title="Today" count={boardTodayTasks.length} tasks={boardTodayTasks} openLead={openLead} />
                <TaskBoardColumn title="Tomorrow" count={boardTomorrowTasks.length} tasks={boardTomorrowTasks} openLead={openLead} />
                <TaskBoardColumn title="This Week" count={boardWeekTasks.length} tasks={boardWeekTasks} openLead={openLead} />
              </Box>
            </Box>
          </Section>
        ) : null}
        {taskViewMode === 'list' ? (
        <Section title="Task List">
          <Stack spacing={0.75} sx={{ p: 0.85 }}>
            <TableToolbar
              columnsControl={<FieldSelector fields={taskFieldOptions} selected={visibleTaskFields} onChange={setVisibleTaskFields} />}
              actions={<Typography color="text.secondary" fontWeight={800}>{filteredTasks.length} tasks</Typography>}
            />
          </Stack>
          <CompactDataTable
            columns={visibleTaskFields.map((field) => taskLabelByKey.get(field) ?? humanizeKey(field))}
            rowIds={filteredTasks.map((task) => task.id)}
            loading={loadingTasks}
            selectedRows={selectedTaskRows}
            onSelectionChange={setSelectedTaskRows}
            bulkActions={(
              <Stack direction="row" spacing={0.5}>
                {taskLists.status.map((status) => (
                  <Button key={status} size="small" variant="outlined" onClick={() => void bulkUpdateTasks({ status })}>{status}</Button>
                ))}
              </Stack>
            )}
            rows={filteredTasks.map((task) => visibleTaskFields.map((field) => renderTaskCell(task, field)))}
          />
        </Section>
        ) : null}
      </Stack>
      <Menu anchorEl={taskMenuAnchor} open={Boolean(taskMenuAnchor)} onClose={() => setTaskMenuAnchor(null)}>
        <MenuItem
          disabled={!taskMenuRow}
          onClick={() => {
            if (!taskMenuRow) return;
            setAssignTaskTarget(taskMenuRow);
            setAssignTaskUserId(taskMenuRow.assignedTo ?? '');
            setTaskMenuAnchor(null);
          }}
        >
          <ListItemIcon><PersonAddAltIcon fontSize="small" /></ListItemIcon>
          Assign user
        </MenuItem>
        {taskLists.status.map((status) => (
          <MenuItem
            key={status}
            disabled={!taskMenuRow || taskMenuRow.status === status}
            onClick={() => {
              if (!taskMenuRow) return;
              const row = taskMenuRow;
              setTaskMenuAnchor(null);
              void updateTask(row, { status });
            }}
          >
            <ListItemIcon><TaskAltIcon fontSize="small" /></ListItemIcon>
            Mark {status}
          </MenuItem>
        ))}
        <MenuItem
          disabled={!taskMenuRow}
          onClick={() => {
            if (!taskMenuRow) return;
            const row = taskMenuRow;
            setTaskMenuAnchor(null);
            void deleteTask(row);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
          Delete task
        </MenuItem>
      </Menu>
      <FormDialog
        open={createTaskOpen}
        title="Create Task"
        subtitle="Create a task linked to a visible lead and assign it to a user."
        onClose={() => setCreateTaskOpen(false)}
        actions={(
          <>
            <Button onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={creatingTask || !createTaskForm.leadId || !createTaskForm.assignedTo || !createTaskForm.taskType}
              onClick={() => { void createTask(); }}
            >
              {creatingTask ? 'Creating...' : 'Create Task'}
            </Button>
          </>
        )}
      >
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Search leads"
            value={leadSearch}
            onChange={(event) => setLeadSearch(event.target.value)}
          />
          <FormControl size="small" fullWidth>
            <Select
              displayEmpty
              value={createTaskForm.leadId}
              onChange={(event) => setCreateTaskForm({ ...createTaskForm, leadId: event.target.value })}
            >
              <MenuItem value="">Select lead *</MenuItem>
              {leadOptions.map((lead) => (
                <MenuItem key={lead.id} value={lead.id}>
                  {[lead.customerName, lead.mobile, lead.externalLeadId].filter(Boolean).join(' · ') || lead.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <FormControl size="small" fullWidth>
              <Select
                displayEmpty
                value={createTaskForm.taskType}
                onChange={(event) => setCreateTaskForm({ ...createTaskForm, taskType: event.target.value })}
              >
                <MenuItem value="">Task type *</MenuItem>
                {taskLists.type.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <Select
                value={createTaskForm.priority}
                onChange={(event) => setCreateTaskForm({ ...createTaskForm, priority: event.target.value })}
              >
                {['Low', 'Medium', 'High'].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Due date and time"
              type="datetime-local"
              value={createTaskForm.dueDate}
              onChange={(event) => setCreateTaskForm({ ...createTaskForm, dueDate: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <Select
                displayEmpty
                value={createTaskForm.assignedTo}
                onChange={(event) => setCreateTaskForm({ ...createTaskForm, assignedTo: event.target.value })}
              >
                <MenuItem value="">Assign to user *</MenuItem>
                {taskUsers.map((user) => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <TextField
            size="small"
            label="Remarks"
            value={createTaskForm.remarks}
            onChange={(event) => setCreateTaskForm({ ...createTaskForm, remarks: event.target.value })}
            multiline
            minRows={2}
          />
        </Stack>
      </FormDialog>
      <FormDialog
        open={Boolean(assignTaskTarget)}
        title="Assign Task"
        subtitle={assignTaskTarget ? `Choose an owner for ${assignTaskTarget.taskType}.` : undefined}
        onClose={() => setAssignTaskTarget(null)}
        actions={(
          <>
            <Button onClick={() => setAssignTaskTarget(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!assignTaskTarget}
              onClick={async () => {
                if (!assignTaskTarget) return;
                await updateTask(assignTaskTarget, { assignedTo: assignTaskUserId || null });
                setAssignTaskTarget(null);
              }}
            >
              Save
            </Button>
          </>
        )}
      >
        <FormControl size="small" fullWidth>
          <Select displayEmpty value={assignTaskUserId} onChange={(event) => setAssignTaskUserId(event.target.value)}>
            <MenuItem value="">Unassigned</MenuItem>
            {taskUsers.map((user) => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
          </Select>
        </FormControl>
      </FormDialog>
      <FormDialog
        open={advancedFilterOpen}
        title="Task Advanced Filters"
        subtitle="Group multiple task conditions using field-aware operators."
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
          fields={taskFieldOptions}
          fieldByKey={taskFieldByKey}
          match={advancedMatch}
          onMatchChange={setAdvancedMatch}
          conditions={advancedConditions}
          onConditionsChange={setAdvancedConditions}
        />
      </FormDialog>
    </ModuleShell>
  );
}
