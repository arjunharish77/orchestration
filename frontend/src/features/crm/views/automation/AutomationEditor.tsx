'use client';

import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import { Button, Stack } from '@mui/material';
import { useState } from 'react';
import { FormDialog } from '../../../../components/common/FormDialog';
import { AutomationCanvas, AutomationEdge, AutomationNode, ExitConditionConfig } from './AutomationCanvas';
import { NodeInspector } from './NodeInspector';
import { AssignmentEnginePanel } from './AssignmentEnginePanel';
import { RunHistory } from './RunHistory';

type AutomationEditorProps = {
  nodes: AutomationNode[];
  edges?: AutomationEdge[];
  selectedNode: AutomationNode;
  selectedNodeId: string;
  nodeTypes: string[];
  exitCondition: ExitConditionConfig;
  setExitCondition: (value: ExitConditionConfig) => void;
  setSelectedNodeId: (value: string) => void;
  addNodeAfter: (index: number, type: string, branchLabel?: 'Yes' | 'No') => void;
  cloneSelectedNode: (node?: AutomationNode) => void;
  deleteSelectedNode: (node?: AutomationNode) => void;
  updateSelectedNode: (patch: Partial<AutomationNode>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  assignmentMessage: string | null;
  assignmentForm: any;
  setAssignmentForm: (form: any) => void;
  assignmentMetadata: any;
  assignmentPreviewLeadId: string;
  setAssignmentPreviewLeadId: (value: string) => void;
  assignmentPreview: any;
  assignmentRules: any[];
  assignmentRuns: any[];
  assignmentEditingRuleId: string | null;
  leadRows: any[];
  saveAssignmentRule: () => void;
  resetAssignmentForm: () => void;
  editAssignmentRule: (rule: any) => void;
  deleteAssignmentRule: (ruleId: string) => void;
  previewAssignment: () => void;
  runAssignment: () => void;
  labelForFieldPath: (value?: string | null) => string;
  labelForOperator: (value?: string | null) => string;
  labelForActionType: (value?: string | null) => string;
  automationRows: ReadonlyArray<readonly [string, string, string, number]>;
  connectorOverview: any;
  mappingFields: Array<{ value: string; label: string }>;
  optionSets: AutomationOptionSets;
  activityTypes: Array<{ code: string; label: string; isActive?: boolean }>;
  activityFieldDefinitions: Array<{ activityTypeCode?: string | null; fieldKey?: string | null; label?: string | null; moduleName?: string | null }>;
};

export type AutomationOptionSets = {
  leadLists: {
    status: string[];
    category: string[];
    disposition: string[];
  };
  taskLists: {
    type: string[];
    status: string[];
  };
  users: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
};

export function AutomationEditor({
  nodes,
  edges,
  selectedNode,
  selectedNodeId,
  nodeTypes,
  exitCondition,
  setExitCondition,
  setSelectedNodeId,
  addNodeAfter,
  cloneSelectedNode,
  deleteSelectedNode,
  updateSelectedNode,
  updateNodePosition,
  assignmentMessage,
  assignmentForm,
  setAssignmentForm,
  assignmentMetadata,
  assignmentPreviewLeadId,
  setAssignmentPreviewLeadId,
  assignmentPreview,
  assignmentRules,
  assignmentRuns,
  assignmentEditingRuleId,
  leadRows,
  saveAssignmentRule,
  resetAssignmentForm,
  editAssignmentRule,
  deleteAssignmentRule,
  previewAssignment,
  runAssignment,
  labelForFieldPath,
  labelForOperator,
  labelForActionType,
  automationRows,
  connectorOverview,
  mappingFields,
  optionSets,
  activityTypes,
  activityFieldDefinitions
}: AutomationEditorProps) {
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const openNodeDialog = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setNodeDialogOpen(true);
  };
  const toolbarActions = (
    <>
      <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={() => setNodeDialogOpen(true)} sx={{ borderRadius: 1 }}>
        Configure Node
      </Button>
      <Button size="small" variant="outlined" startIcon={<AssignmentTurnedInIcon />} onClick={() => setAssignmentDialogOpen(true)} sx={{ borderRadius: 1 }}>
        Assignment Rules
      </Button>
      <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => setHistoryDialogOpen(true)} sx={{ borderRadius: 1 }}>
        Run History
      </Button>
    </>
  );

  return (
    <Stack spacing={1}>
      <AutomationCanvas
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        exitCondition={exitCondition}
        onSelectNode={setSelectedNodeId}
        onOpenNode={openNodeDialog}
        onAddNode={addNodeAfter}
        onCloneNode={cloneSelectedNode}
        onDeleteNode={deleteSelectedNode}
        onUpdateNodePosition={updateNodePosition}
        toolbarActions={toolbarActions}
      />
      <FormDialog open={nodeDialogOpen} title={`Configure ${selectedNode.label || selectedNode.type}`} subtitle="Edit node behavior, variable mappings, and exit conditions." onClose={() => setNodeDialogOpen(false)} maxWidth="lg" actions={[
        <Button key="close" variant="contained" onClick={() => setNodeDialogOpen(false)}>Done</Button>
      ]}>
        <NodeInspector selectedNode={selectedNode} nodeTypes={nodeTypes} exitCondition={exitCondition} setExitCondition={setExitCondition} updateSelectedNode={updateSelectedNode} cloneSelectedNode={cloneSelectedNode} deleteSelectedNode={deleteSelectedNode} assignmentRules={assignmentRules} connectorOverview={connectorOverview} mappingFields={mappingFields} optionSets={optionSets} activityTypes={activityTypes} activityFieldDefinitions={activityFieldDefinitions} />
      </FormDialog>
      <FormDialog open={assignmentDialogOpen} title="Assignment Rules" subtitle="Configure assignment rules used by assignment nodes." onClose={() => setAssignmentDialogOpen(false)} maxWidth="lg" actions={[
        <Button key="close" variant="contained" onClick={() => setAssignmentDialogOpen(false)}>Done</Button>
      ]}>
        <AssignmentEnginePanel
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
        />
      </FormDialog>
      <FormDialog open={historyDialogOpen} title="Automation Run History" subtitle="Recent workflow execution and failed-step context." onClose={() => setHistoryDialogOpen(false)} maxWidth="lg" actions={[
        <Button key="close" variant="contained" onClick={() => setHistoryDialogOpen(false)}>Done</Button>
      ]}>
        <RunHistory automationRows={automationRows} />
      </FormDialog>
    </Stack>
  );
}
