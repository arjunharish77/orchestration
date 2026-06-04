'use client';

import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps
} from 'reactflow';
import { AppChip } from '../../../../components/common/AppChip';
import { FormDialog } from '../../../../components/common/FormDialog';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';

const green = '#2d6a2d';
const panel = '#ffffff';
const line = '#e0ede0';
const mutedPanel = '#eef7ee';

const automationNodePalette = [
  'If/Else',
  'Delay',
  'Assignment',
  'WhatsApp',
  'Voicebot',
  'Task',
  'Lead Update',
  'Create Activity',
  'Mark Expired',
  'Notify',
  'Stop',
  'Pause',
  'Resume',
  'API Call'
];

const automationNodeColors: Record<string, string> = {
  Trigger: '#0f5628',
  'If/Else': '#1e6a8d',
  Assignment: '#2d6a2d',
  WhatsApp: '#16835a',
  Voicebot: '#5f6f20',
  Task: '#6d5f18',
  'Lead Update': '#4e7a34',
  'Create Activity': '#2c6f67',
  'Mark Expired': '#7b4f1d',
  Notify: '#5f6f20',
  Stop: '#9a3412',
  Pause: '#766118',
  Resume: '#277049',
  'API Call': '#4b637a'
};

const automationNodeDescriptions: Record<string, string> = {
  'If/Else': 'Branch based on lead or activity fields.',
  Delay: 'Wait before continuing the workflow.',
  Assignment: 'Run owner, team, or sales group assignment.',
  WhatsApp: 'Send an approved WhatsApp template.',
  Voicebot: 'Trigger an outbound voicebot call.',
  Task: 'Create a follow-up task.',
  'Lead Update': 'Update status, owner, category, or custom fields.',
  'Create Activity': 'Log a system activity on the lead.',
  'Mark Expired': 'Move the lead to an expired state.',
  Notify: 'Notify an owner or team.',
  Stop: 'End this workflow path.',
  Pause: 'Pause until manually resumed or criteria pass.',
  Resume: 'Resume a paused workflow path.',
  'API Call': 'Call an external HTTP endpoint.'
};

const workflowNodeTypes = { workflowNode: WorkflowNode };

export type AutomationNode = {
  id: string;
  type: string;
  label: string;
  config: Record<string, any> | string;
  position?: { x: number; y: number };
  branchFromId?: string;
  branchLabel?: 'Yes' | 'No';
  branchRootId?: string;
  branchPath?: 'Yes' | 'No';
};

export type AutomationEdge = {
  edgeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: Record<string, unknown>;
};

export type ExitConditionConfig = {
  stopStatuses: string[];
  stopDispositions: string[];
  maxAttempts: number;
};

type AutomationCanvasProps = {
  nodes: AutomationNode[];
  edges?: AutomationEdge[];
  selectedNodeId: string;
  exitCondition: ExitConditionConfig;
  onSelectNode: (nodeId: string) => void;
  onOpenNode: (nodeId: string) => void;
  onAddNode: (afterIndex: number, type: string, branchLabel?: 'Yes' | 'No') => void;
  onCloneNode: (node: AutomationNode) => void;
  onDeleteNode: (node: AutomationNode) => void;
  onUpdateNodePosition?: (nodeId: string, position: { x: number; y: number }) => void;
  toolbarActions?: ReactNode;
};

type WorkflowNodeData = {
  node: AutomationNode;
  index: number;
  selected: boolean;
  color: string;
  onSelect: (nodeId: string) => void;
  onOpen: (nodeId: string) => void;
  onClone: (node: AutomationNode) => void;
  onDelete: (node: AutomationNode) => void;
  onOpenAddNode: (afterIndex: number, branchLabel?: 'Yes' | 'No') => void;
};

export function AutomationCanvas({ nodes, edges: workflowEdges = [], selectedNodeId, exitCondition, onSelectNode, onOpenNode, onAddNode, onCloneNode, onDeleteNode, onUpdateNodePosition, toolbarActions }: AutomationCanvasProps) {
  const [addDialog, setAddDialog] = useState<{ afterIndex: number; branchLabel?: 'Yes' | 'No' } | null>(null);
  const exitConfigured = exitCondition.stopStatuses.length > 0 || exitCondition.stopDispositions.length > 0 || exitCondition.maxAttempts > 0;
  const flowNodes = useMemo<Node[]>(() => {
    return nodes.map((node, index) => {
      const y = index * 118;
      const x = node.branchPath === 'Yes' ? 120 : node.branchPath === 'No' ? 520 : 320;
      const color = automationNodeColors[node.type] ?? green;
      return {
        id: node.id,
        type: 'workflowNode',
        position: node.position ?? { x, y },
        data: {
          node,
          index,
          selected: selectedNodeId === node.id,
          color,
          onSelect: onSelectNode,
          onOpen: onOpenNode,
          onClone: onCloneNode,
          onDelete: onDeleteNode,
          onOpenAddNode: (afterIndex, branchLabel) => setAddDialog({ afterIndex, branchLabel })
        } satisfies WorkflowNodeData
      };
    });
  }, [nodes, onCloneNode, onDeleteNode, onOpenNode, onSelectNode, selectedNodeId]);

  const flowEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = [];
    if (workflowEdges.length > 0) {
      workflowEdges.forEach((edge) => {
        const source = nodes.find((node) => node.id === edge.sourceNodeId);
        const branchLabel = normalizeBranchLabel(edge.label ?? edge.condition?.branch ?? edge.condition?.result);
        edges.push({
          id: edge.edgeId ?? `edge-${edge.sourceNodeId}-${edge.targetNodeId}`,
          source: edge.sourceNodeId,
          sourceHandle: source?.type === 'If/Else' && branchLabel ? branchLabel.toLowerCase() : undefined,
          target: edge.targetNodeId,
          type: 'smoothstep',
          label: branchLabel ?? (edge.label && edge.label !== 'Then' ? edge.label : undefined),
          markerEnd: { type: MarkerType.ArrowClosed, color: branchLabel === 'No' ? '#c78673' : '#8fb78f' },
          style: { stroke: branchLabel === 'No' ? '#c78673' : '#8fb78f', strokeWidth: 1.8 }
        });
      });
      return edges;
    }

    nodes.forEach((node, index) => {
      if (node.type === 'If/Else') {
        const branches = nodes.filter((candidate) => candidate.branchFromId === node.id && candidate.branchLabel);
        branches.forEach((branch) => {
          const branchLabel = branch.branchLabel ?? 'Yes';
          edges.push({
            id: `edge-${node.id}-${branchLabel.toLowerCase()}-${branch.id}`,
            source: node.id,
            sourceHandle: branchLabel.toLowerCase(),
            target: branch.id,
            type: 'smoothstep',
            label: branchLabel,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#9dbb9d' },
            style: { stroke: '#9dbb9d', strokeWidth: 1.5 }
          });
        });
        if (branches.length > 0) return;
      }
      const next = nodes[index + 1];
      if (!next || next.branchFromId) return;
      if (node.branchRootId && next.branchRootId === node.branchRootId && node.branchPath !== next.branchPath) return;
      if (node.branchRootId && !next.branchRootId) return;
      edges.push({
        id: `edge-${node.id}-${next.id}`,
        source: node.id,
        target: next.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#9dbb9d' },
        style: { stroke: '#9dbb9d', strokeWidth: 1.5 }
      });
    });
    return edges;
  }, [nodes, workflowEdges]);

  const closeAddDialog = () => setAddDialog(null);
  const addNodeFromDialog = (type: string) => {
    if (!addDialog) return;
    onAddNode(addDialog.afterIndex, type, addDialog.branchLabel);
    closeAddDialog();
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
      <Section
        title="Visual Workflow Builder"
        actions={(
          <Stack direction="row" spacing={0.55} alignItems="center" flexWrap="wrap" useFlexGap>
            <AppChip label={exitConfigured ? 'Exit configured' : 'No exit condition'} />
            {toolbarActions}
          </Stack>
        )}
      >
        <Box
          sx={{
            height: { xs: 620, lg: 'calc(100vh - 250px)' },
            minHeight: 620,
            bgcolor: '#f8fcf8',
            '& .react-flow__attribution': { display: 'none' },
            '& .react-flow__node': { fontFamily: 'inherit' },
            '& .react-flow__controls': {
              boxShadow: '0 8px 20px rgba(22, 39, 22, 0.08)',
              border: `1px solid ${line}`,
              borderRadius: 1,
              overflow: 'hidden'
            },
            '& .react-flow__controls-button': { borderBottomColor: line },
            '& .react-flow__minimap': {
              border: `1px solid ${line}`,
              borderRadius: 1,
              overflow: 'hidden',
              boxShadow: '0 8px 20px rgba(22, 39, 22, 0.08)'
            }
          }}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={workflowNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.35}
            maxZoom={1.65}
            nodesDraggable
            nodesConnectable={false}
            onNodeDragStop={(_, node) => onUpdateNodePosition?.(node.id, node.position)}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#d7e8d7" gap={18} size={0.8} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => (node.type === 'workflowNode' ? (node.data as WorkflowNodeData).color : '#cfe8cf')}
              maskColor="rgba(238, 247, 238, 0.66)"
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </Box>
      </Section>
      <FormDialog
        open={Boolean(addDialog)}
        onClose={closeAddDialog}
        maxWidth="md"
        title="Add workflow node"
        subtitle={`Select the next step to insert after node ${(addDialog?.afterIndex ?? 0) + 1}${addDialog?.branchLabel ? ` on the ${addDialog.branchLabel} path.` : '.'}`}
        actions={<Button onClick={closeAddDialog} variant="outlined" sx={{ borderRadius: '8px' }}>Cancel</Button>}
      >
        <Stack spacing={1.1}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
              gap: 1
            }}
          >
            {automationNodePalette.map((type) => {
              const color = automationNodeColors[type] ?? green;
              return (
                <Button
                  key={type}
                  variant="outlined"
                  className="nodrag nopan"
                  onClick={() => addNodeFromDialog(type)}
                  sx={{
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 1,
                    minHeight: 82,
                    p: 1,
                    borderRadius: '8px',
                    borderColor: line,
                    color: 'text.primary',
                    textAlign: 'left',
                    textTransform: 'none',
                    '&:hover': { borderColor: color, bgcolor: '#f8fcf8' }
                  }}
                >
                  <Avatar sx={{ bgcolor: color, width: 30, height: 30 }}>
                    <AddIcon fontSize="small" />
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800} lineHeight={1.15}>{type}</Typography>
                    <Typography color="text.secondary" fontSize={12} lineHeight={1.35} sx={{ mt: 0.35 }}>
                      {automationNodeDescriptions[type] ?? 'Add this step to the workflow.'}
                    </Typography>
                  </Box>
                </Button>
              );
            })}
          </Box>
        </Stack>
      </FormDialog>
    </Box>
  );
}

function WorkflowNode({ data }: NodeProps<WorkflowNodeData>) {
  const { node, index, selected, color, onSelect, onOpen, onClone, onDelete, onOpenAddNode } = data;
  const isConditionNode = node.type === 'If/Else';
  return (
    <Paper
      variant="outlined"
      onClick={() => {
        onSelect(node.id);
        onOpen(node.id);
      }}
      sx={{
        width: 320,
        borderRadius: 1.35,
        p: 0.75,
        bgcolor: selected ? mutedPanel : panel,
        borderColor: selected ? color : line,
        borderLeft: `5px solid ${color}`,
        cursor: 'pointer',
        position: 'relative',
        boxShadow: selected ? '0 14px 30px rgba(45, 106, 45, 0.14)' : '0 8px 20px rgba(22, 39, 22, 0.06)',
        transition: 'border-color 140ms ease, background-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
        '&:hover': { bgcolor: '#f8fcf8', transform: 'translateY(-1px)', boxShadow: '0 14px 28px rgba(22, 39, 22, 0.1)' }
      }}
    >
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8, background: color, borderColor: '#fff' }} />
      {node.branchLabel ? (
        <Box
          sx={{
            position: 'absolute',
            left: 12,
            top: -12,
            px: 0.8,
            py: 0.15,
            borderRadius: 99,
            bgcolor: node.branchLabel === 'Yes' ? '#eef7ee' : '#fff7ed',
            border: `1px solid ${node.branchLabel === 'Yes' ? '#cfe4cf' : '#fed7aa'}`,
            color: node.branchLabel === 'Yes' ? green : '#9a3412',
            fontSize: 11,
            fontWeight: 850
          }}
        >
          {node.branchLabel}
        </Box>
      ) : null}
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar sx={{ bgcolor: color, width: 28, height: 28, fontSize: 11, fontWeight: 800 }}>{index + 1}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography fontWeight={850} fontSize={13} noWrap>{node.label}</Typography>
              <AppChip label={node.type} />
            </Stack>
            <Typography color="text.secondary" fontSize={11} noWrap>{summarizeNodeConfig(node)}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.2}>
          <Tooltip title="Clone node">
            <IconButton className="nodrag nopan" size="small" onClick={(event) => { event.stopPropagation(); onClone(node); }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={node.type === 'Trigger' ? 'Trigger cannot be deleted' : 'Delete node'}>
            <span>
              <IconButton className="nodrag nopan" size="small" disabled={node.type === 'Trigger'} onClick={(event) => { event.stopPropagation(); onSelect(node.id); onDelete(node); }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      {isConditionNode ? (
        <>
          <BranchAddButton label="Yes" left="34%" color={color} node={node} index={index} onSelect={onSelect} onOpenAddNode={onOpenAddNode} />
          <BranchAddButton label="No" left="66%" color="#9a3412" node={node} index={index} onSelect={onSelect} onOpenAddNode={onOpenAddNode} />
          <Handle id="yes" type="source" position={Position.Bottom} style={{ left: '34%', width: 8, height: 8, background: color, borderColor: '#fff' }} />
          <Handle id="no" type="source" position={Position.Bottom} style={{ left: '66%', width: 8, height: 8, background: '#9a3412', borderColor: '#fff' }} />
        </>
      ) : (
        <>
          <AddNextButton color={color} node={node} index={index} onSelect={onSelect} onOpenAddNode={onOpenAddNode} />
          <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: color, borderColor: '#fff' }} />
        </>
      )}
    </Paper>
  );
}

function normalizeBranchLabel(value: unknown): 'Yes' | 'No' | undefined {
  const text = String(value ?? '').trim().toLowerCase();
  if (['yes', 'true', 'matched', 'success'].includes(text)) return 'Yes';
  if (['no', 'false', 'unmatched', 'else', 'otherwise'].includes(text)) return 'No';
  return undefined;
}

function AddNextButton({
  color,
  node,
  index,
  onSelect,
  onOpenAddNode
}: {
  color: string;
  node: AutomationNode;
  index: number;
  onSelect: (nodeId: string) => void;
  onOpenAddNode: (afterIndex: number, branchLabel?: 'Yes' | 'No') => void;
}) {
  return (
    <Tooltip title="Add next node">
      <IconButton
        className="nodrag nopan"
        size="small"
        aria-label={`Add node after ${node.label || node.type}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(node.id);
          onOpenAddNode(index);
        }}
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: -19,
          transform: 'translateX(-50%)',
          width: 36,
          height: 36,
          bgcolor: color,
          color: '#fff',
          border: '3px solid #f8fcf8',
          boxShadow: '0 10px 20px rgba(22, 39, 22, 0.16)',
          '&:hover': { bgcolor: color, filter: 'brightness(0.92)' }
        }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

function BranchAddButton({
  label,
  left,
  color,
  node,
  index,
  onSelect,
  onOpenAddNode
}: {
  label: 'Yes' | 'No';
  left: string;
  color: string;
  node: AutomationNode;
  index: number;
  onSelect: (nodeId: string) => void;
  onOpenAddNode: (afterIndex: number, branchLabel?: 'Yes' | 'No') => void;
}) {
  return (
    <Tooltip title={`Add ${label} branch node`}>
      <Button
        className="nodrag nopan"
        size="small"
        aria-label={`Add ${label} branch after ${node.label || node.type}`}
        startIcon={<AddIcon />}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(node.id);
          onOpenAddNode(index, label);
        }}
        sx={{
          position: 'absolute',
          left,
          bottom: -23,
          transform: 'translateX(-50%)',
          minWidth: 74,
          height: 32,
          px: 0.85,
          borderRadius: 99,
          bgcolor: '#fff',
          color,
          border: `2px solid ${color}`,
          fontWeight: 850,
          textTransform: 'none',
          boxShadow: '0 10px 20px rgba(22, 39, 22, 0.14)',
          '& .MuiButton-startIcon': { mr: 0.35 },
          '&:hover': { bgcolor: '#f8fcf8', borderColor: color }
        }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

const fieldLabels: Record<string, string> = {
  'lead.status': 'Lead Status',
  'lead.category': 'Lead Category',
  'lead.disposition': 'Lead Disposition',
  'lead.assignedUserId': 'Lead Owner',
  'lead.assignedTeamId': 'Lead Team',
  'lead.branchCode': 'Branch Code',
  'lead.branchName': 'Branch Name',
  'lead.preferredLanguage': 'Preferred Language',
  'lead.offerAmount': 'Loan Offer Amount',
  'lead.emiAmount': 'EMI Amount',
  'lead.location': 'Customer Location',
  status: 'Lead Status',
  category: 'Lead Category',
  disposition: 'Lead Disposition',
  assignedUserId: 'Owner',
  assignedTeamId: 'Team',
  automationStatus: 'Automation Status',
  partnerMapping: 'Partner Mapping'
};

const operatorLabels: Record<string, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  exists: 'has any value',
  not_exists: 'is empty',
  in: 'is one of',
  not_in: 'is not one of',
  gt: 'greater than',
  gte: 'greater than or equal',
  lt: 'less than',
  lte: 'less than or equal'
};

function labelForField(value: unknown) {
  const key = String(value ?? '').trim();
  if (!key) return 'Field';
  if (fieldLabels[key]) return fieldLabels[key];
  return key
    .replace(/^lead\.custom\./, '')
    .replace(/^activity\.custom\./, '')
    .replace(/^user\.custom\./, '')
    .replace(/^lead\./, '')
    .replace(/^activity\./, '')
    .replace(/^user\./, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeNodeConfig(node: AutomationNode) {
  const config = typeof node.config === 'object' && node.config ? node.config : { summary: node.config };
  if (typeof config.summary === 'string' && config.summary.trim()) return config.summary;
  if (node.type === 'Trigger') return String(config.trigger ?? 'Lead created');
  if (node.type === 'If/Else') {
    const conditionCount = 1 + (Array.isArray(config.groups) ? config.groups.length : 0);
    const operator = operatorLabels[String(config.operator ?? 'equals')] ?? String(config.operator ?? 'equals').replace(/_/g, ' ');
    const value = ['exists', 'not_exists'].includes(String(config.operator)) ? '' : ` ${String(config.value ?? '').trim()}`;
    return `${labelForField(config.fieldPath)} ${operator}${value}${conditionCount > 1 ? ` · ${conditionCount} conditions` : ''}`.trim();
  }
  if (node.type === 'Delay') {
    const unit = String(config.delayUnit ?? 'minutes');
    return `${config.delayMinutes ?? config.minutes ?? 15} ${unit}`;
  }
  if (node.type === 'Assignment') return config.ruleId ? 'Run selected assignment rule' : 'Run full assignment engine';
  if (node.type === 'WhatsApp') return config.templateName ?? config.templateId ?? 'WhatsApp template';
  if (node.type === 'Voicebot') return config.templateName ?? config.templateId ?? 'Voicebot trigger';
  if (node.type === 'Task') return `${config.taskType ?? 'Task'} · ${config.priority ?? 'Medium'}`;
  if (node.type === 'Lead Update') {
    const updates = Array.isArray(config.updates) && config.updates.length ? config.updates : [{ field: config.field, value: config.value }];
    return updates
      .slice(0, 2)
      .map((update: Record<string, unknown>) => `${labelForField(update.field)} = ${String(update.value ?? '-')}`)
      .join(' · ');
  }
  if (node.type === 'Create Activity') return `${config.type ?? 'Activity'} · ${config.title ?? 'Create activity'}`;
  if (node.type === 'API Call') return `${config.method ?? 'POST'} ${config.url ?? config.endpoint ?? 'HTTPS endpoint'}`;
  return node.type;
}
