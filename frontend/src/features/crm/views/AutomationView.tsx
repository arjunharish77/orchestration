'use client';

import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Checkbox, FormControl, ListItemText, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { ModuleShell } from '../../../components/common/WorkspacePrimitives';
import { apiRequest } from '../../../lib/api';
import { formatDate, humanizeKey } from '../../../lib/format';
import { toLeadRows } from '../types/lead';
import { AutomationNode, ExitConditionConfig } from './automation/AutomationCanvas';
import { AutomationEditor } from './automation/AutomationEditor';
import { AutomationList } from './automation/AutomationList';
import { AutomationMetrics } from './automation/AutomationMetrics';

const assignmentFieldLabels: Record<string, string> = {
  'lead.branchCode': 'Branch Code',
  'lead.branchName': 'Branch Name',
  'lead.status': 'Lead Status',
  'lead.category': 'Lead Category',
  'lead.disposition': 'Lead Disposition',
  'lead.preferredLanguage': 'Preferred Language',
  'lead.partnerMapping': 'Partner Mapping',
  'lead.customerLocation': 'Customer Location',
  'lead.offerAmount': 'Loan Offer Amount',
  'lead.emiAmount': 'EMI Amount',
  'user.phone': 'Agent Phone',
  'user.teamId': 'User Team',
  'user.role': 'User Role'
};

const operatorLabels: Record<string, string> = {
  exists: 'Has any value',
  equals: 'Equals',
  not_equals: 'Does not equal',
  contains: 'Contains',
  in: 'Is one of',
  not_in: 'Is not one of',
  gt: 'Greater than',
  gte: 'Greater than or equal',
  lt: 'Less than',
  lte: 'Less than or equal'
};

const actionTypeLabels: Record<string, string> = {
  round_robin_team: 'Round robin within team',
  assign_user: 'Assign selected user',
  assign_team: 'Assign selected team',
  least_loaded_user: 'Least-loaded online user',
  match_user_custom_field: 'Match user custom field'
};

type LeadRow = {
  id: string;
  dbId?: string;
  name: string;
};

type AutomationRunRow = readonly [string, string, string, number];

type WorkflowRunStep = {
  id?: string | null;
  nodeId?: string | null;
  status?: string | null;
  reason?: string | null;
  result?: unknown;
  startedAt?: string | null;
  endedAt?: string | null;
};

type WorkflowRunDetail = {
  id?: string | null;
  workflowId?: string | null;
  leadId?: string | null;
  status?: string | null;
  trigger?: string | null;
  exitReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  steps?: WorkflowRunStep[];
};

type CustomFieldDefinition = {
  moduleName?: string | null;
  activityTypeCode?: string | null;
  fieldKey?: string | null;
  label?: string | null;
};

type ActivityTypeConfig = {
  code: string;
  label: string;
  isActive?: boolean;
  showInLeadDetail?: boolean;
  allowManualCreate?: boolean;
};

type AutomationViewProps = {
  automationRows?: AutomationRunRow[];
  authToken: string | null;
};

function createInitialAutomationNodes(): AutomationNode[] {
  return [
    { id: 'trigger', type: 'Trigger', label: 'Lead Created', config: { trigger: 'Lead created' } }
  ];
}

const defaultExitCondition: ExitConditionConfig = {
  stopStatuses: ['Converted', 'Expired'],
  stopDispositions: ['Not Interested', 'Wrong Number'],
  maxAttempts: 0
};

function createDefaultExitCondition(): ExitConditionConfig {
  return {
    stopStatuses: [...defaultExitCondition.stopStatuses],
    stopDispositions: [...defaultExitCondition.stopDispositions],
    maxAttempts: defaultExitCondition.maxAttempts
  };
}

function labelForFieldPath(value?: string | null) {
  return value ? assignmentFieldLabels[value] ?? humanizeKey(value) : '-';
}

function labelForOperator(value?: string | null) {
  return value ? operatorLabels[value] ?? humanizeKey(value) : '-';
}

function labelForActionType(value?: string | null) {
  return value ? actionTypeLabels[value] ?? humanizeKey(value) : '-';
}

function asWorkflowRunDetail(value: unknown): WorkflowRunDetail | null {
  if (!value || typeof value !== 'object') return null;
  const detail = value as WorkflowRunDetail;
  return {
    ...detail,
    steps: Array.isArray(detail.steps) ? detail.steps : []
  };
}

function summarizeStepResult(result: unknown) {
  if (!result || typeof result !== 'object') return result ? String(result) : '-';
  const row = result as Record<string, unknown>;
  const visibleKeys = ['matched', 'httpStatus', 'warning', 'minutes', 'status', 'activityCreated', 'assignedUserId', 'connectorId'];
  const parts = visibleKeys
    .filter((key) => row[key] !== undefined && row[key] !== null)
    .map((key) => `${humanizeKey(key)}: ${String(row[key])}`);
  return parts.length ? parts.join(' · ') : 'Completed';
}

function normalizeMappingModuleName(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'user') return 'user';
  if (normalized === 'activity') return 'activity';
  return 'lead';
}

function labelForMappingModule(value?: string | null) {
  const normalized = normalizeMappingModuleName(value);
  if (normalized === 'user') return 'User';
  if (normalized === 'activity') return 'Activity';
  return 'Lead';
}

function normalizeCustomFieldDefinitions(payload: unknown): CustomFieldDefinition[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : [];
  return rows
    .filter((row): row is CustomFieldDefinition => Boolean(row && typeof row === 'object'))
    .filter((row) => Boolean(String(row.fieldKey ?? '').trim()));
}

function defaultNodeConfig(type: string) {
  if (type === 'Trigger') return { trigger: 'Lead created' };
  if (type === 'If/Else') return { fieldPath: 'lead.status', operator: 'equals', value: 'New', branchMode: 'all', groups: [] };
  if (type === 'Delay') return { delayMinutes: 15 };
  if (type === 'Assignment') return { mode: 'full_engine', ruleId: '' };
  if (type === 'WhatsApp') return { templateId: '', variableMapping: {} };
  if (type === 'Voicebot') return { templateId: '', variableMapping: {} };
  if (type === 'Task') return { taskType: 'Follow-up', priority: 'Medium', dueInDays: 1, remarks: '' };
  if (type === 'Lead Update') return { updates: [{ field: 'status', value: 'In Progress' }] };
  if (type === 'Create Activity') return { type: '008', title: 'Automation activity', notes: '', customFields: {} };
  if (type === 'Mark Expired') return { status: 'Expired' };
  if (type === 'Notify') return { channel: 'in_app', message: '' };
  if (type === 'Stop') return { reason: 'stop_node' };
  if (type === 'Pause') return { reason: 'pause_node' };
  if (type === 'Resume') return { resumed: true };
  if (type === 'API Call') return { method: 'POST', url: '', headers: {}, body: {}, retries: 0, timeoutMs: 10000 };
  return { summary: 'Configure node' };
}

function normalizeBranchLabel(value: unknown): 'Yes' | 'No' | undefined {
  const text = String(value ?? '').trim().toLowerCase();
  if (['yes', 'true', 'matched', 'then', 'success'].includes(text)) return 'Yes';
  if (['no', 'false', 'unmatched', 'else', 'otherwise'].includes(text)) return 'No';
  return undefined;
}

function branchMetadataForDefinitionNode(node: any, edges: any[]) {
  const branchPath = normalizeBranchLabel(node.branchPath);
  const branchRootId = typeof node.branchRootId === 'string' ? node.branchRootId : undefined;
  const incomingBranch = edges.find((edge) => edge?.targetNodeId === (node.id ?? node.nodeId) && normalizeBranchLabel(edge?.label ?? edge?.condition?.branch ?? edge?.condition?.result));
  const branchLabel = normalizeBranchLabel(incomingBranch?.label ?? incomingBranch?.condition?.branch ?? incomingBranch?.condition?.result);
  return {
    ...(branchRootId && branchPath ? { branchRootId, branchPath } : {}),
    ...(branchLabel ? { branchFromId: incomingBranch.sourceNodeId, branchLabel, branchRootId: incomingBranch.sourceNodeId, branchPath: branchLabel } : {})
  };
}

function buildWorkflowEdges(nodes: AutomationNode[]) {
  const edges: Array<{ edgeId: string; sourceNodeId: string; targetNodeId: string; label: string; condition?: Record<string, string> }> = [];
  nodes.forEach((node, index) => {
    if (node.type === 'If/Else') {
      const branches = nodes.filter((candidate) => candidate.branchFromId === node.id && candidate.branchLabel);
      branches.forEach((branch) => {
        const branchLabel = branch.branchLabel ?? 'Yes';
        edges.push({
          edgeId: `edge-${node.id}-${branchLabel.toLowerCase()}-${branch.id}`,
          sourceNodeId: node.id,
          targetNodeId: branch.id,
          label: branchLabel,
          condition: { branch: branchLabel.toLowerCase(), result: branchLabel === 'Yes' ? 'true' : 'false' }
        });
      });
      if (branches.length > 0) return;
    }
    const next = nodes[index + 1];
      if (!next || next.branchFromId) return;
      if (node.branchRootId && next.branchRootId === node.branchRootId && node.branchPath !== next.branchPath) return;
      if (node.branchRootId && !next.branchRootId) return;
      edges.push({ edgeId: `edge-${node.id}-${next.id}`, sourceNodeId: node.id, targetNodeId: next.id, label: 'Then' });
  });
  return edges;
}

function toAutomationRows(apiAutomation: any): AutomationRunRow[] {
  const workflows = apiAutomation?.workflows ?? [];
  if (!Array.isArray(workflows) || workflows.length === 0) return [];
  return workflows.map((workflow: any) => {
    const nodes = workflow.versions?.[0]?.definition?.nodes;
    const steps = Array.isArray(nodes) ? nodes : [];
    const firstConfiguredStep = steps.find((node: any) => {
      const type = String(node?.type ?? node?.nodeType ?? '').toLowerCase();
      return type && type !== 'trigger';
    });
    return [
      workflow.name ?? 'Workflow',
      firstConfiguredStep?.label ?? firstConfiguredStep?.type ?? firstConfiguredStep?.nodeType ?? (steps.length ? 'Trigger only' : 'Draft'),
      workflow.status === 'draft' ? 'Waiting' : workflow.status ?? 'Running',
      workflow.status === 'active' ? 70 : 25
    ] as AutomationRunRow;
  });
}

export function AutomationView({ automationRows: initialAutomationRows = [], authToken }: AutomationViewProps) {
  const [builderMode, setBuilderMode] = useState(false);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [nodes, setNodes] = useState<AutomationNode[]>(createInitialAutomationNodes);
  const [selectedNodeId, setSelectedNodeId] = useState('trigger');
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [workflowRunLeadId, setWorkflowRunLeadId] = useState('');
  const [workflowRunLeadIds, setWorkflowRunLeadIds] = useState<string[]>([]);
  const [workflowRunDetail, setWorkflowRunDetail] = useState<unknown>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [exitCondition, setExitCondition] = useState<ExitConditionConfig>(createDefaultExitCondition);
  const [assignmentRules, setAssignmentRules] = useState<any[]>([]);
  const [assignmentRuns, setAssignmentRuns] = useState<any[]>([]);
  const [assignmentMetadata, setAssignmentMetadata] = useState<any>({});
  const [assignmentEditingRuleId, setAssignmentEditingRuleId] = useState<string | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({ name: 'Branch and language assignment', priority: '100', fieldPath: 'lead.branchCode', operator: 'exists', value: '', actionType: 'round_robin_team', teamId: '', userId: '', maxOpenLeads: '25', userCustomFieldKey: '', userCustomFieldValue: '' });
  const [assignmentPreviewLeadId, setAssignmentPreviewLeadId] = useState('');
  const [assignmentPreview, setAssignmentPreview] = useState<any>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [connectorOverview, setConnectorOverview] = useState<any>({});
  const [mappingFieldDefinitions, setMappingFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeConfig[]>([]);
  const [leadRows, setLeadRows] = useState<LeadRow[]>([]);
  const [automationRows, setAutomationRows] = useState<AutomationRunRow[]>(initialAutomationRows);
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const nodeTypes = ['If/Else', 'Delay', 'Assignment', 'WhatsApp', 'Voicebot', 'Task', 'Lead Update', 'Create Activity', 'Mark Expired', 'Notify', 'Stop', 'Pause', 'Resume', 'API Call'];
  const automationSummary = useMemo<Array<[string, string]>>(() => {
    const connectorNodes = nodes.filter((node) => ['WhatsApp', 'Voicebot', 'API Call'].includes(node.type)).length;
    const conditionNodes = nodes.filter((node) => node.type === 'If/Else').length;
    return [
      ['Nodes', String(nodes.length)],
      ['Conditions', String(conditionNodes)],
      ['Connectors', String(connectorNodes)],
      ['Rules', String(assignmentRules.length)]
    ];
  }, [assignmentRules.length, nodes]);
  const automationMappingFields = useMemo(() => {
    const base = [
      { value: 'lead.customerName', label: 'Lead: Customer Name' },
      { value: 'lead.mobile', label: 'Lead: Mobile' },
      { value: 'lead.status', label: 'Lead: Status' },
      { value: 'lead.category', label: 'Lead: Category' },
      { value: 'lead.disposition', label: 'Lead: Disposition' },
      { value: 'lead.branchCode', label: 'Lead: Branch Code' },
      { value: 'lead.branchName', label: 'Lead: Branch Name' },
      { value: 'lead.offerAmount', label: 'Lead: Loan Offer Amount' },
      { value: 'lead.emiAmount', label: 'Lead: EMI Amount' },
      { value: 'lead.preferredLanguage', label: 'Lead: Preferred Language' },
      { value: 'user.name', label: 'User: Name' },
      { value: 'user.phone', label: 'User: Phone' },
      { value: 'user.email', label: 'User: Email' },
      { value: 'activity.disposition', label: 'Activity: Disposition' }
    ];
    const custom = mappingFieldDefinitions.map((field) => {
      const moduleName = normalizeMappingModuleName(field.moduleName);
      const fieldKey = String(field.fieldKey ?? '').trim();
      const typeScope = moduleName === 'activity' && field.activityTypeCode && field.activityTypeCode !== 'ALL' ? ` ${field.activityTypeCode}` : '';
      return {
        value: `${moduleName}.custom.${fieldKey}`,
        label: `${labelForMappingModule(field.moduleName)}${typeScope}: ${field.label || humanizeKey(fieldKey)}`
      };
    });
    return Array.from(new Map([...base, ...custom].map((field) => [field.value, field])).values());
  }, [mappingFieldDefinitions]);

  const loadWorkflows = useCallback(async () => {
    if (!authToken) return;
    setWorkflowsLoading(true);
    try {
      const payload = await apiRequest<any[]>('/automation/workflows', { token: authToken });
      setWorkflows(Array.isArray(payload) ? payload : []);
    } catch {
      setWorkflows([]);
    } finally {
      setWorkflowsLoading(false);
    }
  }, [authToken]);

  const loadAutomationOverview = useCallback(async () => {
    if (!authToken) return;
    try {
      const payload = await apiRequest<any>('/automation/overview', { token: authToken });
      setAutomationRows(toAutomationRows(payload));
    } catch {
      setAutomationRows([]);
    }
  }, [authToken]);

  const loadScheduledJobs = useCallback(async () => {
    if (!authToken) return;
    try {
      const payload = await apiRequest<any[]>('/automation/scheduled-jobs', { token: authToken });
      setScheduledJobs(Array.isArray(payload) ? payload : []);
    } catch {
      setScheduledJobs([]);
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadAutomationLeads() {
      if (!authToken) return;
      try {
        const payload = await apiRequest<any>('/leads?pageSize=30', { token: authToken });
        const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
        if (!cancelled) setLeadRows(toLeadRows(items).map((lead) => ({ id: lead.id, dbId: lead.dbId, name: lead.name })));
      } catch {
        if (!cancelled) setLeadRows([]);
      }
    }
    void loadAutomationLeads();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    void loadWorkflows();
    void loadAutomationOverview();
    void loadScheduledJobs();
  }, [loadAutomationOverview, loadScheduledJobs, loadWorkflows]);

  useEffect(() => {
    const workflow = workflows.find((item) => item.id === selectedWorkflowId);
    const definition = workflow?.versions?.[0]?.definition;
    if (!definition || !Array.isArray(definition.nodes) || definition.nodes.length === 0) return;
    const edges = Array.isArray(definition.edges) ? definition.edges : [];
    const nextNodes = definition.nodes.map((node: any) => ({
      id: node.id ?? node.nodeId,
      type: node.type ?? node.nodeType ?? 'Task',
      label: node.label ?? node.type ?? node.nodeType ?? 'Node',
      config: node.config ?? {},
      ...branchMetadataForDefinitionNode(node, edges)
    })).filter((node: AutomationNode) => node.id);
    if (nextNodes.length) {
      setNodes(nextNodes);
      setSelectedNodeId(nextNodes[0].id);
    }
    setExitCondition(normalizeExitCondition(definition.exitCondition));
  }, [selectedWorkflowId, workflows]);

  const createWorkflow = async () => {
    if (!authToken || !newWorkflowName.trim()) return;
    setWorkflowMessage(null);
    try {
      const workflow = await apiRequest<any>('/automation/workflows', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkflowName.trim(), description: 'Created from Unnatify automation editor' })
      });
      setNewWorkflowName('');
      setSelectedWorkflowId(workflow.id);
      setBuilderMode(true);
      setWorkflowMessage('Workflow created');
      await loadWorkflows();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : 'Could not create workflow');
    }
  };

  const openBuilderForWorkflow = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    setBuilderMode(true);
    setWorkflowMessage(null);
    setWorkflowRunDetail(null);
  };

  const openNewAutomationBuilder = () => {
    setSelectedWorkflowId('');
    setNewWorkflowName('');
    setNodes(createInitialAutomationNodes());
    setSelectedNodeId('trigger');
    setExitCondition(createDefaultExitCondition());
    setBuilderMode(true);
    setWorkflowMessage('Name the automation and create it to save the workflow.');
    setWorkflowRunDetail(null);
  };

  const runWorkflowFromList = async (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    await runSelectedWorkflowForId(workflowId);
  };

  const saveWorkflowDefinition = async (publish = false) => {
    if (!authToken || !selectedWorkflowId) return;
    setWorkflowMessage(null);
    try {
      await apiRequest(`/automation/workflows/${selectedWorkflowId}/definition`, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publish,
          definition: {
            exitCondition,
            nodes: nodes.map((node, index) => ({
              nodeId: node.id,
              nodeType: node.type,
              label: node.label,
              config: typeof node.config === 'object' && node.config ? node.config : { summary: node.config },
              position: { x: 0, y: index * 120 },
              branchRootId: node.branchRootId,
              branchPath: node.branchPath
            })),
            edges: buildWorkflowEdges(nodes)
          }
        })
      });
      setWorkflowMessage(publish ? 'Workflow published' : 'Workflow draft saved');
      await loadWorkflows();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : 'Could not save workflow');
    }
  };

  const runSelectedWorkflow = async (mode: 'published' | 'test' | 'manual' | 'enqueue' = 'published') => {
    if (!authToken || !selectedWorkflowId) return;
    await runSelectedWorkflowForId(selectedWorkflowId, mode);
  };

  const runSelectedWorkflowForId = async (workflowId: string, mode: 'published' | 'test' | 'manual' | 'enqueue' = 'published') => {
    if (!authToken || !workflowId) return;
    setWorkflowMessage(null);
    setWorkflowRunDetail(null);
    const isManual = mode === 'manual';
    const isTest = mode === 'test';
    const enqueue = mode === 'enqueue';
    try {
      const run = await apiRequest<any>(`/automation/workflows/${workflowId}/${enqueue ? 'enqueue' : 'run'}`, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: isManual ? undefined : workflowRunLeadId || undefined,
          leadIds: isManual ? workflowRunLeadIds : undefined,
          useDraft: isTest,
          runLabel: isTest ? 'Test Run' : isManual ? 'Manual Run' : undefined,
          context: isTest ? { runLabel: 'Test Run' } : isManual ? { runLabel: 'Manual Run' } : undefined
        })
      });
      const detail = run?.id
        ? await apiRequest<any>(`/automation/runs/${run.id}`, { token: authToken }).catch(() => run)
        : run;
      setWorkflowRunDetail(detail);
      setWorkflowMessage(enqueue ? 'Workflow run enqueued' : isTest ? 'Test run completed' : isManual ? 'Manual bulk run completed' : 'Workflow run completed');
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : 'Could not run workflow');
    }
  };

  const retryFailedRun = async () => {
    const runId = typeof workflowRunDetail === 'object' && workflowRunDetail && 'id' in workflowRunDetail ? String((workflowRunDetail as { id?: unknown }).id ?? '') : '';
    if (!authToken || !runId) return;
    setWorkflowMessage(null);
    try {
      const retry = await apiRequest<any>(`/automation/runs/${runId}/retry-failed`, {
        token: authToken,
        method: 'POST'
      });
      setWorkflowRunDetail(retry);
      setWorkflowMessage('Failed run retried from failed node');
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : 'Could not retry failed run');
    }
  };

  const addNodeAfter = (index: number, type: string, branchLabel?: 'Yes' | 'No') => {
    const parentNode = nodes[index];
    const inheritedBranch = parentNode?.branchRootId && parentNode.branchPath
      ? { branchRootId: parentNode.branchRootId, branchPath: parentNode.branchPath }
      : {};
    const newBranch = branchLabel && parentNode?.type === 'If/Else'
      ? { branchFromId: parentNode.id, branchLabel, branchRootId: parentNode.id, branchPath: branchLabel }
      : {};
    const nextNode = {
      id: `${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      type,
      label: type,
      config: defaultNodeConfig(type),
      ...inheritedBranch,
      ...newBranch
    };
    const branchIndexes = branchLabel && parentNode?.type === 'If/Else'
      ? nodes.map((node, nodeIndex) => (node.branchRootId === parentNode.id ? nodeIndex : -1)).filter((nodeIndex) => nodeIndex >= 0)
      : [];
    const insertAt = branchIndexes.length ? Math.max(...branchIndexes) + 1 : index + 1;
    setNodes([...nodes.slice(0, insertAt), nextNode, ...nodes.slice(insertAt)]);
    setSelectedNodeId(nextNode.id);
  };

  const cloneSelectedNode = (nodeToClone = selectedNode) => {
    const clone = { ...nodeToClone, id: `${nodeToClone.id}-copy-${Date.now()}`, label: `${nodeToClone.label} Copy` };
    setNodes([...nodes, clone]);
    setSelectedNodeId(clone.id);
  };

  const deleteSelectedNode = (nodeToDelete = selectedNode) => {
    if (nodeToDelete.type === 'Trigger') return;
    const nextNodes = nodes.filter((node) => node.id !== nodeToDelete.id);
    setNodes(nextNodes);
    setSelectedNodeId(nextNodes[0]?.id ?? '');
  };

  const updateSelectedNode = (patch: Partial<AutomationNode>) => {
    setNodes(nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node));
  };

  const loadAssignmentData = useCallback(async () => {
    if (!authToken) return;
    try {
      const [rulesPayload, metadataPayload] = await Promise.all([
        apiRequest<any[]>('/assignment-engine/rules', { token: authToken }),
        apiRequest<any>('/assignment-engine/metadata', { token: authToken })
      ]);
      setAssignmentRules(Array.isArray(rulesPayload) ? rulesPayload : []);
      setAssignmentMetadata(metadataPayload ?? {});
    } catch {
      setAssignmentRules([]);
      setAssignmentMetadata({});
    }
  }, [authToken]);

  const loadAssignmentRuns = useCallback(async () => {
    if (!authToken) return;
    try {
      const payload = await apiRequest<any[]>('/assignment-engine/runs', { token: authToken });
      setAssignmentRuns(Array.isArray(payload) ? payload : []);
    } catch {
      setAssignmentRuns([]);
    }
  }, [authToken]);

  useEffect(() => {
    void loadAssignmentData();
    void loadAssignmentRuns();
  }, [loadAssignmentData, loadAssignmentRuns]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    async function loadConnectors() {
      try {
        const payload = await apiRequest<any>('/connectors', { token: authToken });
        if (!cancelled) setConnectorOverview(payload ?? {});
      } catch {
        if (!cancelled) setConnectorOverview({});
      }
    }
    void loadConnectors();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    async function loadActivityTypes() {
      try {
        const payload = await apiRequest<ActivityTypeConfig[]>('/settings/activity-types', { token: authToken });
        if (!cancelled) setActivityTypes(Array.isArray(payload) ? payload : []);
      } catch {
        if (!cancelled) setActivityTypes([]);
      }
    }
    void loadActivityTypes();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    async function loadMappingFields() {
      try {
        const payloads = await Promise.all(['Lead', 'User', 'Activity'].map((moduleName) => apiRequest<unknown>(`/custom-fields/definitions?moduleName=${moduleName}`, { token: authToken })));
        if (!cancelled) setMappingFieldDefinitions(payloads.flatMap(normalizeCustomFieldDefinitions));
      } catch {
        if (!cancelled) setMappingFieldDefinitions([]);
      }
    }
    void loadMappingFields();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const resetAssignmentForm = () => {
    setAssignmentEditingRuleId(null);
    setAssignmentForm({ name: 'Branch and language assignment', priority: '100', fieldPath: 'lead.branchCode', operator: 'exists', value: '', actionType: 'round_robin_team', teamId: '', userId: '', maxOpenLeads: '25', userCustomFieldKey: '', userCustomFieldValue: '' });
  };

  const editAssignmentRule = (rule: any) => {
    const condition = (rule.conditions ?? [])[0] ?? {};
    const action = (rule.actions ?? [])[0] ?? {};
    const config = action.config ?? {};
    setAssignmentEditingRuleId(rule.id);
    setAssignmentForm({
      name: rule.name ?? '',
      priority: String(rule.priority ?? 100),
      fieldPath: condition.fieldPath ?? 'lead.branchCode',
      operator: condition.operator ?? 'exists',
      value: condition.value === undefined || condition.value === null ? '' : String(condition.value),
      actionType: action.actionType ?? 'round_robin_team',
      teamId: config.teamId ?? '',
      userId: config.userId ?? '',
      maxOpenLeads: config.maxOpenLeads === undefined || config.maxOpenLeads === null ? '' : String(config.maxOpenLeads),
      userCustomFieldKey: config.userCustomFieldKey ?? '',
      userCustomFieldValue: config.userCustomFieldValue ?? ''
    });
  };

  const saveAssignmentRule = async () => {
    if (!authToken) return;
    setAssignmentMessage(null);
    try {
      const config = {
        allowReassignment: true,
        ...(assignmentForm.teamId ? { teamId: assignmentForm.teamId } : {}),
        ...(assignmentForm.userId ? { userId: assignmentForm.userId } : {}),
        ...(assignmentForm.maxOpenLeads ? { maxOpenLeads: Number(assignmentForm.maxOpenLeads) } : {}),
        ...(assignmentForm.userCustomFieldKey ? { userCustomFieldKey: assignmentForm.userCustomFieldKey, userCustomFieldValue: assignmentForm.userCustomFieldValue } : {})
      };
      await apiRequest(assignmentEditingRuleId ? `/assignment-engine/rules/${assignmentEditingRuleId}` : '/assignment-engine/rules', {
        token: authToken,
        method: assignmentEditingRuleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assignmentForm.name,
          priority: Number(assignmentForm.priority || 100),
          targetType: 'Lead',
          isActive: true,
          conditions: assignmentForm.fieldPath ? [{ fieldPath: assignmentForm.fieldPath, operator: assignmentForm.operator, value: assignmentForm.value || undefined }] : [],
          actions: [{ actionType: assignmentForm.actionType, config }]
        })
      });
      setAssignmentMessage(assignmentEditingRuleId ? 'Assignment rule updated' : 'Assignment rule saved');
      setAssignmentEditingRuleId(null);
      await loadAssignmentData();
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Could not save assignment rule');
    }
  };

  const deleteAssignmentRule = async (ruleId: string) => {
    if (!authToken) return;
    setAssignmentMessage(null);
    try {
      await apiRequest(`/assignment-engine/rules/${ruleId}`, { token: authToken, method: 'DELETE' });
      setAssignmentMessage('Assignment rule deleted');
      if (assignmentEditingRuleId === ruleId) resetAssignmentForm();
      await loadAssignmentData();
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Could not delete assignment rule');
    }
  };

  const runAssignment = async () => {
    if (!authToken || !assignmentPreviewLeadId) return;
    setAssignmentMessage(null);
    try {
      const payload = await apiRequest<any>('/assignment-engine/run', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: assignmentPreviewLeadId })
      });
      setAssignmentPreview(payload);
      setAssignmentMessage('Assignment engine ran for selected lead');
      await Promise.all([loadAssignmentData(), loadAssignmentRuns()]);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Could not run assignment');
    }
  };

  const previewAssignment = async () => {
    if (!authToken || !assignmentPreviewLeadId) return;
    setAssignmentMessage(null);
    try {
      const payload = await apiRequest<any>('/assignment-engine/preview', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: assignmentPreviewLeadId })
      });
      setAssignmentPreview(payload);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Could not preview assignment');
    }
  };

  const runDetail = asWorkflowRunDetail(workflowRunDetail);

  return (
    <ModuleShell
      title={builderMode ? 'Automation Builder' : 'Automations'}
      subtitle={builderMode ? 'Design a node-based workflow with triggers, conditions, assignment, connectors, and exit rules.' : 'Manage automation workflows. Open a workflow to edit its visual node builder.'}
      actions={builderMode
        ? <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => setBuilderMode(false)}>Back to Automations</Button>
        : <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openNewAutomationBuilder}>Create Automation</Button>}
    >
      <Stack spacing={1}>
        <MessageAlert message={workflowMessage} />
        {!builderMode ? (
          <>
            <AutomationList
              workflows={workflows}
              loading={workflowsLoading}
              onEdit={openBuilderForWorkflow}
              onRun={runWorkflowFromList}
            />
            {scheduledJobs.length > 0 ? (
              <Box sx={{ border: '1px solid var(--crm-border)', borderRadius: 1, bgcolor: 'var(--crm-paper-soft)', p: 1.5 }}>
                <Typography fontWeight={850} fontSize={13} sx={{ mb: 1 }}>Pending Delay Jobs ({scheduledJobs.length})</Typography>
                <Stack spacing={0.75}>
                  {scheduledJobs.map((job) => (
                    <Box key={job.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.75, border: '1px solid var(--crm-border)', borderRadius: 1, bgcolor: 'background.paper' }}>
                      <Box>
                        <Typography fontSize={12} fontWeight={800}>{job.nodeId ? humanizeKey(job.nodeId) : 'Delay node'}</Typography>
                        <Typography fontSize={11} color="text.secondary">Run ID: {String(job.runId ?? '-').slice(0, 8)} · Due: {formatDate(job.runAt)}</Typography>
                      </Box>
                      <Typography fontSize={11} fontWeight={700} color={job.status === 'processing' ? 'warning.main' : 'text.secondary'}>{humanizeKey(job.status ?? 'scheduled')}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </>
        ) : (
          <>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <Select displayEmpty value={selectedWorkflowId} onChange={(event) => setSelectedWorkflowId(event.target.value)}>
              <MenuItem value="">Select workflow</MenuItem>
              {workflows.map((workflow) => <MenuItem key={workflow.id} value={workflow.id}>{workflow.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="New workflow name" value={newWorkflowName} onChange={(event) => setNewWorkflowName(event.target.value)} />
          <Button size="small" variant="outlined" disabled={!newWorkflowName.trim()} onClick={createWorkflow}>Create</Button>
          <Button size="small" variant="outlined" disabled={!selectedWorkflowId} onClick={() => saveWorkflowDefinition(false)}>Save Draft</Button>
          <Button size="small" variant="contained" disabled={!selectedWorkflowId} onClick={() => saveWorkflowDefinition(true)}>Publish</Button>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <Select displayEmpty value={workflowRunLeadId} onChange={(event) => setWorkflowRunLeadId(event.target.value)}>
              <MenuItem value="">Run without lead context</MenuItem>
              {leadRows.slice(0, 30).map((lead) => <MenuItem key={lead.dbId ?? lead.id} value={lead.dbId ?? lead.id}>{lead.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" disabled={!selectedWorkflowId || !workflowRunLeadId} onClick={() => runSelectedWorkflow('test')}>Test Draft</Button>
          <Button size="small" variant="outlined" disabled={!selectedWorkflowId} onClick={() => runSelectedWorkflow('published')}>Run Published</Button>
          <Button size="small" variant="outlined" disabled={!selectedWorkflowId} onClick={() => runSelectedWorkflow('enqueue')}>Enqueue</Button>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 360 }}>
            <Select
              multiple
              displayEmpty
              value={workflowRunLeadIds}
              renderValue={(selected) => selected.length ? `${selected.length} selected leads` : 'Select leads for manual bulk run'}
              onChange={(event) => setWorkflowRunLeadIds(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
            >
              {leadRows.slice(0, 100).map((lead) => {
                const id = lead.dbId ?? lead.id;
                return (
                  <MenuItem key={id} value={id}>
                    <Checkbox size="small" checked={workflowRunLeadIds.includes(id)} />
                    <ListItemText primary={lead.name} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" disabled={!selectedWorkflowId || workflowRunLeadIds.length === 0} onClick={() => runSelectedWorkflow('manual')}>Manual Bulk Run</Button>
        </Stack>
        {runDetail ? (
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1, border: '1px solid var(--crm-border)', borderRadius: '8px', bgcolor: 'var(--crm-paper-soft)', boxShadow: '0 8px 22px rgba(22, 39, 22, 0.04)' }}>
              <Box>
                <Typography fontWeight={850}>Run {runDetail.id ? `#${String(runDetail.id).slice(0, 8)}` : 'detail'}</Typography>
                <Typography color="text.secondary" fontSize={12}>
                  {[runDetail.status ? `Status: ${humanizeKey(runDetail.status)}` : null, runDetail.startedAt ? `Started: ${formatDate(runDetail.startedAt)}` : null, runDetail.completedAt ? `Completed: ${formatDate(runDetail.completedAt)}` : null].filter(Boolean).join(' · ')}
                </Typography>
                {runDetail.exitReason ? <Typography color="text.secondary" fontSize={12}>Exit reason: {humanizeKey(runDetail.exitReason)}</Typography> : null}
              </Box>
              <Button size="small" variant="outlined" disabled={runDetail.status !== 'failed'} onClick={retryFailedRun}>
                Retry Failed
              </Button>
            </Stack>
            <Stack spacing={0.75}>
              {(runDetail.steps ?? []).length ? (runDetail.steps ?? []).map((step, index) => (
                <Box key={step.id ?? `${step.nodeId ?? 'step'}-${index}`} sx={{ p: 1, border: '1px solid var(--crm-border)', borderRadius: '8px', bgcolor: 'var(--crm-paper)' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography fontWeight={800}>{index + 1}. {step.nodeId ? humanizeKey(step.nodeId) : 'Workflow Step'}</Typography>
                    <Typography fontWeight={800} color={step.status === 'failed' ? 'error.main' : 'primary.main'}>{humanizeKey(step.status)}</Typography>
                  </Stack>
                  <Typography color="text.secondary" fontSize={12}>
                    {[step.reason ? `Reason: ${humanizeKey(step.reason)}` : null, step.startedAt ? `Started: ${formatDate(step.startedAt)}` : null, step.endedAt ? `Ended: ${formatDate(step.endedAt)}` : null].filter(Boolean).join(' · ')}
                  </Typography>
                  <Typography color="text.secondary" fontSize={12}>Result: {summarizeStepResult(step.result)}</Typography>
                </Box>
              )) : (
                <Typography color="text.secondary" sx={{ p: 1, border: '1px solid var(--crm-border)', borderRadius: '8px' }}>No step records were returned for this run.</Typography>
              )}
            </Stack>
          </Stack>
        ) : null}
        <AutomationMetrics rows={automationSummary} />
        <AutomationEditor
            nodes={nodes}
            selectedNode={selectedNode}
            selectedNodeId={selectedNodeId}
            nodeTypes={nodeTypes}
            exitCondition={exitCondition}
            setExitCondition={setExitCondition}
            setSelectedNodeId={setSelectedNodeId}
            addNodeAfter={addNodeAfter}
            cloneSelectedNode={cloneSelectedNode}
            deleteSelectedNode={deleteSelectedNode}
            updateSelectedNode={updateSelectedNode}
            assignmentMessage={assignmentMessage}
            assignmentForm={assignmentForm}
            setAssignmentForm={setAssignmentForm}
            assignmentMetadata={assignmentMetadata}
            assignmentPreviewLeadId={assignmentPreviewLeadId}
            setAssignmentPreviewLeadId={setAssignmentPreviewLeadId}
            assignmentPreview={assignmentPreview}
            assignmentRules={assignmentRules}
            assignmentRuns={assignmentRuns}
            assignmentEditingRuleId={assignmentEditingRuleId}
            leadRows={leadRows}
            saveAssignmentRule={saveAssignmentRule}
            resetAssignmentForm={resetAssignmentForm}
            editAssignmentRule={editAssignmentRule}
            deleteAssignmentRule={deleteAssignmentRule}
            previewAssignment={previewAssignment}
            runAssignment={runAssignment}
            labelForFieldPath={labelForFieldPath}
            labelForOperator={labelForOperator}
            labelForActionType={labelForActionType}
            automationRows={automationRows}
            connectorOverview={connectorOverview}
            mappingFields={automationMappingFields}
            activityTypes={activityTypes}
            activityFieldDefinitions={mappingFieldDefinitions.filter((field) => normalizeMappingModuleName(field.moduleName) === 'activity')}
          />
          </>
        )}
      </Stack>
    </ModuleShell>
  );
}

function normalizeExitCondition(value: unknown): ExitConditionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultExitCondition;
  const record = value as Record<string, unknown>;
  return {
    stopStatuses: Array.isArray(record.stopStatuses) ? record.stopStatuses.map(String) : defaultExitCondition.stopStatuses,
    stopDispositions: Array.isArray(record.stopDispositions) ? record.stopDispositions.map(String) : defaultExitCondition.stopDispositions,
    maxAttempts: Math.max(0, Number(record.maxAttempts ?? defaultExitCondition.maxAttempts))
  };
}
