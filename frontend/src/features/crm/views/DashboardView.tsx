'use client';

import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BarChartIcon from '@mui/icons-material/BarChart';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Avatar, Box, Card, Paper, Skeleton, Stack, Typography } from '@mui/material';
import ButtonBase from '@mui/material/ButtonBase';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { MetaChip } from '../../../components/common/MetaChip';
import { StatusChip } from '../../../components/common/StatusChip';
import { CompactDataTable } from '../../../components/common/CompactDataTable';
import { ModuleShell, SectionPanel as Section } from '../../../components/common/WorkspacePrimitives';
import { apiRequest } from '../../../lib/api';
import { formatDate, humanizeKey } from '../../../lib/format';

const green = '#2d6a2d';
const panel = '#ffffff';
const line = '#e0ede0';

type LeadCustomField = {
  key: string;
  label: string;
  value?: unknown;
};

type DashboardLeadRow = {
  id: string;
  dbId?: string | null;
  initials: string;
  name: string;
  email?: string | null;
  status: string;
  source?: string | null;
  created?: string | null;
  customFields?: LeadCustomField[];
  [key: string]: unknown;
};

type DashboardMetric = [string, string, string];
type AutomationRunRow = readonly [string, string, string, number];
type DashboardTaskRow = {
  id: string;
  leadName: string;
  taskType: string;
  priority: string;
  dueDate?: string | null;
  status: string;
};
type DashboardConnectorRow = {
  name: string;
  status: string;
  detail?: string | null;
  updated?: string | null;
};

type DashboardOverview = {
  updatedAt?: string | null;
  leads: DashboardLeadRow[];
  metrics: DashboardMetric[];
  automation: AutomationRunRow[];
  tasks: DashboardTaskRow[];
  connectors?: DashboardConnectorRow[];
};
type DashboardVisibleView = 'dashboard' | 'leads' | 'activities' | 'uploads' | 'tasks' | 'automation' | 'reports' | 'settings';

const baseLeadListFields = [
  { key: 'name', label: 'Lead Name' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'status', label: 'Status' },
  { key: 'category', label: 'Category' },
  { key: 'disposition', label: 'Disposition' },
  { key: 'branchCode', label: 'Branch Code' },
  { key: 'branchName', label: 'Branch Name' },
  { key: 'ownerName', label: 'Owner' },
  { key: 'teamName', label: 'Team' },
  { key: 'language', label: 'Language' },
  { key: 'source', label: 'Source' },
  { key: 'created', label: 'Created' }
];

function customFieldValue(lead: DashboardLeadRow, key: string) {
  const field = lead.customFields?.find((item) => item.key === key);
  return field?.value == null || field.value === '' ? '-' : String(field.value);
}

function renderLeadCell(lead: DashboardLeadRow, fieldKey: string) {
  if (fieldKey.startsWith('custom:')) return customFieldValue(lead, fieldKey.replace('custom:', ''));
  if (fieldKey === 'name') {
    return (
      <Stack key={lead.id} direction="row" spacing={1} alignItems="center">
        <Avatar sx={{ width: 30, height: 30, bgcolor: '#eef7ee', color: green, fontWeight: 800, fontSize: 13 }}>{lead.initials}</Avatar>
        <Typography fontWeight={800}>{lead.name}</Typography>
      </Stack>
    );
  }
  if (fieldKey === 'status') return <StatusChip key={`${lead.id}-status`} status={lead.status} />;
  return String(lead[fieldKey] ?? '-');
}

function emptyDashboardOverview(): DashboardOverview {
  return {
    leads: [],
    automation: [],
    tasks: [],
    connectors: [],
    metrics: [
      ['Uploaded Leads', '0', 'CSV batches available'],
      ['Assigned Leads', '0', 'Across teams and sales groups'],
      ['Open Tasks', '0', '0 missed'],
      ['Converted', '0', 'Converted leads'],
      ['Automation Runs', '0', '0 failed, 0 pending steps']
    ]
  };
}

function dueLabel(value?: string | null) {
  if (!value) return 'No due date';
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return `Today, ${due.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`;
  return formatDate(value);
}

function DashboardMetricCard({ metric, trend }: { metric: DashboardMetric; trend?: number[] }) {
  const [title, value, hint] = metric;
  return (
    <Card
      sx={{
        minHeight: 92,
        borderRadius: '8px',
        p: 1.25,
        bgcolor: 'background.paper',
        border: `1px solid ${line}`,
        boxShadow: '0 10px 28px rgba(22, 39, 22, 0.04)',
        borderLeft: `3px solid ${green}`
      }}
    >
      <Typography color="text.secondary" fontWeight={800} fontSize={11} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 30, lineHeight: 1, fontWeight: 800 }}>{value}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 11 }}>{hint}</Typography>
      {trend && trend.length > 1 ? (
        <Box sx={{ mt: 1, height: 32, overflow: 'hidden' }}>
          <svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none">
            <polyline
              points={trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${32 - (v / Math.max(...trend)) * 28}`).join(' ')}
              fill="none"
              stroke="var(--g600)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </Box>
      ) : null}
    </Card>
  );
}

function DashboardActionTile({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        minHeight: 74,
        borderRadius: '8px',
        border: `1px solid ${line}`,
        bgcolor: '#fff',
        display: 'grid',
        placeItems: 'center',
        gap: 0.45,
        px: 1,
        color: '#162716',
        transition: 'transform 140ms ease, border-color 140ms ease, background-color 140ms ease',
        '&:hover': { transform: 'translateY(-1px)', bgcolor: '#f7fcf7', borderColor: '#b8d4b8' }
      }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '50%', bgcolor: '#eef7ee', color: green }}>{icon}</Box>
      <Typography fontWeight={800} fontSize={12}>{label}</Typography>
    </ButtonBase>
  );
}

function PriorityTasksPanel({ tasks, onCreate, onViewAll }: { tasks: DashboardTaskRow[]; onCreate: () => void; onViewAll: () => void }) {
  const dueCount = tasks.filter((task) => task.status !== 'Completed').length;
  return (
    <Card sx={{ borderRadius: '8px', border: `1px solid ${line}`, bgcolor: '#fff', minHeight: 1, p: 1.25 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight={800}>Priority Tasks</Typography>
        <MetaChip label={`${dueCount} Due`} />
      </Stack>
      <Stack spacing={0.75} sx={{ mt: 1 }}>
        {tasks.length ? tasks.map((task) => (
          <Paper key={task.id} variant="outlined" sx={{ borderRadius: '8px', p: 1, borderColor: line, bgcolor: '#fafdfa' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ mt: 0.2, width: 18, height: 18, borderRadius: '50%', border: '2px solid #7f907f', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>{task.taskType} with {task.leadName}</Typography>
                <Typography color={task.priority === 'High' ? 'error.main' : 'text.secondary'} fontWeight={800} fontSize={12}>
                  {dueLabel(task.dueDate)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )) : (
          <Paper variant="outlined" sx={{ borderRadius: '8px', p: 2, borderColor: line, bgcolor: '#fafdfa', textAlign: 'center' }}>
            <Typography fontWeight={800}>No priority tasks</Typography>
            <Typography color="text.secondary" fontSize={12}>You are clear for now.</Typography>
          </Paper>
        )}
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
        <ButtonBase
          onClick={onCreate}
          sx={{
            flex: 1,
            height: 34,
            borderRadius: '8px',
            border: `1px solid ${line}`,
            color: green,
            fontWeight: 800,
            gap: 0.6,
            '&:hover': { bgcolor: '#eef7ee' }
          }}
        >
          <AddIcon fontSize="small" />
          <Typography fontWeight={800} fontSize={12}>Create Task</Typography>
        </ButtonBase>
        <ButtonBase
          onClick={onViewAll}
          sx={{
            flex: 1,
            height: 34,
            borderRadius: '8px',
            border: `1px solid ${line}`,
            color: green,
            fontWeight: 800,
            '&:hover': { bgcolor: '#eef7ee' }
          }}
        >
          <Typography fontWeight={800} fontSize={12}>View all tasks</Typography>
        </ButtonBase>
      </Stack>
    </Card>
  );
}

function canSee(visibleViews: DashboardVisibleView[] | undefined, view: DashboardVisibleView) {
  return !visibleViews || visibleViews.includes(view);
}

async function loadDashboardOverview(authToken: string | null, visibleViews?: DashboardVisibleView[]): Promise<DashboardOverview> {
  if (!authToken) return emptyDashboardOverview();
  const overview = await apiRequest<DashboardOverview>('/dashboard/overview', { token: authToken });
  const visibleMetrics = (overview.metrics ?? []).filter(([title]) => {
    const lower = title.toLowerCase();
    if (lower.includes('upload')) return canSee(visibleViews, 'uploads') || canSee(visibleViews, 'leads');
    if (lower.includes('task')) return canSee(visibleViews, 'tasks') || canSee(visibleViews, 'reports');
    if (lower.includes('automation')) return canSee(visibleViews, 'automation') || canSee(visibleViews, 'reports');
    return canSee(visibleViews, 'leads');
  });

  return {
    leads: canSee(visibleViews, 'leads') ? overview.leads ?? [] : [],
    automation: canSee(visibleViews, 'automation') ? overview.automation ?? [] : [],
    tasks: canSee(visibleViews, 'tasks') ? overview.tasks ?? [] : [],
    connectors: canSee(visibleViews, 'settings') ? overview.connectors ?? [] : [],
    updatedAt: overview.updatedAt,
    metrics: visibleMetrics.length ? visibleMetrics : [['Visible Modules', '1', 'Dashboard access only']]
  };
}

export function LeadRows<TLead extends DashboardLeadRow>({ items, openLead, fields, pageLabel, onPreviousPage, onNextPage, previousDisabled, nextDisabled, rowActions, selectedRows, onSelectionChange, bulkActions, loading = false }: { items: TLead[]; openLead: (lead: TLead) => void; fields?: string[]; pageLabel?: string; onPreviousPage?: () => void; onNextPage?: () => void; previousDisabled?: boolean; nextDisabled?: boolean; rowActions?: (lead: TLead) => ReactNode; selectedRows?: number[]; onSelectionChange?: (rows: number[]) => void; bulkActions?: ReactNode; loading?: boolean }) {
  const visibleFields = fields?.length ? fields : ['name', 'email', 'status', 'source', 'created'];
  const fieldLabels = [
    ...baseLeadListFields,
    ...new Map(items.flatMap((lead) => (lead.customFields ?? []).map((field) => [`custom:${field.key}`, { key: `custom:${field.key}`, label: field.label }] as const))).values()
  ];
  const labelByKey = new Map(fieldLabels.map((field) => [field.key, field.label]));
  return (
    <CompactDataTable
      columns={[...visibleFields.map((field) => labelByKey.get(field) ?? humanizeKey(field)), ...(rowActions ? ['Actions'] : [])]}
      rowIds={items.map((lead) => lead.dbId ?? lead.id)}
      loading={loading}
      onPrimaryCellClick={(rowIndex) => openLead(items[rowIndex])}
      rows={items.map((lead) => [...visibleFields.map((field) => renderLeadCell(lead, field)), ...(rowActions ? [rowActions(lead)] : [])])}
      pageLabel={pageLabel}
      onPreviousPage={onPreviousPage}
      onNextPage={onNextPage}
      previousDisabled={previousDisabled}
      nextDisabled={nextDisabled}
      selectedRows={selectedRows}
      onSelectionChange={onSelectionChange}
      bulkActions={bulkActions}
    />
  );
}

export function DashboardView<TLead extends DashboardLeadRow>({ authToken, leadRows, metricRows, automationRows, openLead, visibleViews }: { authToken?: string | null; leadRows?: TLead[]; metricRows?: DashboardMetric[]; automationRows?: AutomationRunRow[]; openLead: (lead: TLead) => void; visibleViews?: DashboardVisibleView[] }) {
  const router = useRouter();
  const [overview, setOverview] = useState<DashboardOverview>(() => ({
    leads: leadRows ?? [],
    metrics: metricRows ?? emptyDashboardOverview().metrics,
    automation: automationRows ?? [],
    tasks: [],
    connectors: []
  }));
  const [loading, setLoading] = useState(Boolean(authToken && !leadRows));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authToken || leadRows) return;
    setLoading(true);
    setError(null);
    try {
      setOverview(await loadDashboardOverview(authToken, visibleViews));
    } catch (loadError) {
      setOverview(emptyDashboardOverview());
      setError(loadError instanceof Error ? loadError.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, [authToken, leadRows, visibleViews]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const nextLeadRows = (leadRows ?? overview.leads) as TLead[];
  const nextMetricRows = metricRows ?? overview.metrics;
  const nextAutomationRows = automationRows ?? overview.automation;
  const updatedLabel = overview.updatedAt ? `Updated ${new Date(overview.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Updated';
  const quickActions = [
    canSee(visibleViews, 'leads') ? { label: 'Add Lead', icon: <AddIcon />, path: '/leads' } : null,
    canSee(visibleViews, 'uploads') ? { label: 'Import Data', icon: <UploadFileIcon />, path: '/uploads' } : null,
    canSee(visibleViews, 'reports') ? { label: 'Generate Report', icon: <BarChartIcon />, path: '/reports' } : null,
    canSee(visibleViews, 'automation') ? { label: 'Automation', icon: <AutoAwesomeIcon />, path: '/automation' } : null
  ].filter(Boolean) as Array<{ label: string; icon: ReactNode; path: string }>;

  return (
    <ModuleShell
      title="Dashboard"
      subtitle="Track leads, active automations, pending uploads, and connector health."
    >
      {loading ? (
        <Stack spacing={1.25}>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
            {[1, 2, 3].map((item) => (
              <Card key={item} sx={{ borderRadius: '8px', border: `1px solid ${line}`, p: 1.25, minHeight: 92, bgcolor: '#fff' }}>
                <Stack spacing={0.75}>
                  <Skeleton variant="rounded" width="45%" height={12} sx={{ bgcolor: '#eef7ee' }} />
                  <Skeleton variant="rounded" width="30%" height={28} sx={{ bgcolor: '#eef7ee' }} />
                  <Skeleton variant="rounded" width="60%" height={12} sx={{ bgcolor: '#eef7ee' }} />
                </Stack>
              </Card>
            ))}
          </Box>
          <Section title="Recent Leads">
            <LeadRows items={[]} openLead={openLead} loading />
          </Section>
        </Stack>
      ) : (
        <>
      {error ? <Typography color="error.main" fontWeight={800}>{error}</Typography> : null}
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', xl: canSee(visibleViews, 'tasks') ? 'minmax(0, 1fr) 330px' : '1fr' }, alignItems: 'stretch' }}>
        <Card sx={{ borderRadius: '8px', p: { xs: 1.5, md: 2 }, border: `1px solid ${line}`, bgcolor: panel }}>
          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
            <Box>
              <Typography variant="h5" fontWeight={800}>Dashboard Overview</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.2 }}>Here is what is happening with your leads today.</Typography>
            </Box>
            <MetaChip label={updatedLabel} />
          </Stack>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, mt: 2 }}>
            {nextMetricRows.map((metric) => <DashboardMetricCard key={metric[0]} metric={metric} />)}
          </Box>
        </Card>
        {canSee(visibleViews, 'tasks') ? <PriorityTasksPanel tasks={overview.tasks} onCreate={() => router.push('/tasks')} onViewAll={() => router.push('/tasks')} /> : null}
      </Box>
      {quickActions.length ? (
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${Math.min(4, quickActions.length)}, minmax(0, 1fr))` }, mt: 1.25 }}>
          {quickActions.map((action) => <DashboardActionTile key={action.label} label={action.label} icon={action.icon} onClick={() => router.push(action.path)} />)}
        </Box>
      ) : null}
      <Stack spacing={1} sx={{ mt: 1.25 }}>
        {canSee(visibleViews, 'leads') ? (
          <Section title="Recent Leads">
            <LeadRows items={nextLeadRows} openLead={openLead} />
          </Section>
        ) : null}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
          {canSee(visibleViews, 'automation') ? (
            <Section title="Automation Runs">
              <Stack spacing={0.75} sx={{ p: 1 }}>
                {nextAutomationRows.map(([name, step, status, progress]) => (
                  <Paper key={name} variant="outlined" sx={{ borderRadius: '8px', p: 0.85, bgcolor: panel, borderColor: line }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={800}>{name}</Typography>
                      <StatusChip status={status} />
                    </Stack>
                    <Typography color="text.secondary">{step}</Typography>
                    <Box sx={{ mt: 0.75, height: 6, borderRadius: '4px', bgcolor: '#eef7ee', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%', bgcolor: green }} />
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Section>
          ) : null}
          {canSee(visibleViews, 'settings') ? (
            <Section title="Connector Status">
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ p: 1.25 }}>
                {(overview.connectors ?? []).length ? (overview.connectors ?? []).map((connector) => (
                  <Paper key={connector.name} variant="outlined" sx={{ borderColor: line, borderRadius: '8px', p: 1, minWidth: 150, bgcolor: '#fafdfa' }}>
                    <Typography fontWeight={800}>{connector.name}</Typography>
                    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.4 }}>
                      <StatusChip status={connector.status} />
                      <Typography color="text.secondary" fontSize={12}>{connector.detail ?? '-'}</Typography>
                    </Stack>
                  </Paper>
                )) : (
                  <Typography color="text.secondary" fontWeight={800}>No connector configuration found</Typography>
                )}
              </Stack>
            </Section>
          ) : null}
        </Stack>
      </Stack>
        </>
      )}
    </ModuleShell>
  );
}
