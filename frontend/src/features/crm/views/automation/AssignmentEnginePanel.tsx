'use client';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, FormControl, MenuItem, Select, Stack, TextField } from '@mui/material';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { MessageAlert } from '../../../../components/common/MessageAlert';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';

type LeadRow = {
  id: string;
  dbId?: string;
  name: string;
};

type AssignmentForm = {
  name: string;
  priority: string;
  fieldPath: string;
  operator: string;
  value: string;
  actionType: string;
  teamId: string;
  userId: string;
  maxOpenLeads: string;
  userCustomFieldKey: string;
  userCustomFieldValue: string;
};

function JsonPreview({ value, minRows = 4 }: { value: unknown; minRows?: number }) {
  return (
    <TextField
      size="small"
      multiline
      minRows={minRows}
      value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      InputProps={{ readOnly: true }}
      sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.45 } }}
    />
  );
}

export function AssignmentEnginePanel({
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
  labelForActionType
}: {
  assignmentMessage: string | null;
  assignmentForm: AssignmentForm;
  setAssignmentForm: (form: AssignmentForm) => void;
  assignmentMetadata: any;
  assignmentPreviewLeadId: string;
  setAssignmentPreviewLeadId: (id: string) => void;
  assignmentPreview: unknown;
  assignmentRules: any[];
  assignmentRuns: any[];
  assignmentEditingRuleId: string | null;
  leadRows: LeadRow[];
  saveAssignmentRule: () => void;
  resetAssignmentForm: () => void;
  editAssignmentRule: (rule: any) => void;
  deleteAssignmentRule: (ruleId: string) => void;
  previewAssignment: () => void;
  runAssignment: () => void;
  labelForFieldPath: (value?: string | null) => string;
  labelForOperator: (value?: string | null) => string;
  labelForActionType: (value?: string | null) => string;
}) {
  return (
    <Section title="Assignment Engine">
      <Stack spacing={1} sx={{ p: 1 }}>
        <MessageAlert message={assignmentMessage} />
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 90px' } }}>
          <TextField size="small" label="Rule name" value={assignmentForm.name} onChange={(event) => setAssignmentForm({ ...assignmentForm, name: event.target.value })} />
          <TextField size="small" label="Priority" value={assignmentForm.priority} onChange={(event) => setAssignmentForm({ ...assignmentForm, priority: event.target.value })} />
        </Box>
        <FormControl size="small">
          <Select value={assignmentForm.fieldPath} onChange={(event) => setAssignmentForm({ ...assignmentForm, fieldPath: event.target.value })}>
            {(assignmentMetadata.conditionFields ?? ['lead.branchCode', 'lead.status']).map((field: string) => <MenuItem key={field} value={field}>{labelForFieldPath(field)}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '110px 1fr' }}>
          <FormControl size="small"><Select value={assignmentForm.operator} onChange={(event) => setAssignmentForm({ ...assignmentForm, operator: event.target.value })}>{(assignmentMetadata.operators ?? ['exists', 'equals']).map((operator: string) => <MenuItem key={operator} value={operator}>{labelForOperator(operator)}</MenuItem>)}</Select></FormControl>
          <TextField size="small" label="Value" value={assignmentForm.value} onChange={(event) => setAssignmentForm({ ...assignmentForm, value: event.target.value })} />
        </Box>
        <FormControl size="small"><Select value={assignmentForm.actionType} onChange={(event) => setAssignmentForm({ ...assignmentForm, actionType: event.target.value })}>{(assignmentMetadata.actionTypes ?? ['round_robin_team', 'assign_user']).map((type: string) => <MenuItem key={type} value={type}>{labelForActionType(type)}</MenuItem>)}</Select></FormControl>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <FormControl size="small"><Select displayEmpty value={assignmentForm.teamId} onChange={(event) => setAssignmentForm({ ...assignmentForm, teamId: event.target.value })}><MenuItem value="">Team from lead/default</MenuItem>{(assignmentMetadata.teams ?? []).map((team: any) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}</Select></FormControl>
          <TextField size="small" label="Max open leads" value={assignmentForm.maxOpenLeads} onChange={(event) => setAssignmentForm({ ...assignmentForm, maxOpenLeads: event.target.value })} />
          <TextField size="small" label="User custom field" value={assignmentForm.userCustomFieldKey} onChange={(event) => setAssignmentForm({ ...assignmentForm, userCustomFieldKey: event.target.value })} />
          <TextField size="small" label="Custom field value" value={assignmentForm.userCustomFieldValue} onChange={(event) => setAssignmentForm({ ...assignmentForm, userCustomFieldValue: event.target.value })} />
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap">
          <Button size="small" variant="contained" onClick={saveAssignmentRule} sx={{ borderRadius: 1 }}>{assignmentEditingRuleId ? 'Update Rule' : 'Save Rule'}</Button>
          {assignmentEditingRuleId ? <Button size="small" variant="outlined" onClick={resetAssignmentForm} sx={{ borderRadius: 1 }}>New Rule</Button> : null}
          <FormControl size="small" sx={{ minWidth: 150 }}><Select displayEmpty value={assignmentPreviewLeadId} onChange={(event) => setAssignmentPreviewLeadId(event.target.value)}><MenuItem value="">Preview lead</MenuItem>{leadRows.slice(0, 20).map((lead) => <MenuItem key={lead.dbId ?? lead.id} value={lead.dbId ?? lead.id}>{lead.name}</MenuItem>)}</Select></FormControl>
          <Button size="small" variant="outlined" disabled={!assignmentPreviewLeadId} onClick={previewAssignment} sx={{ borderRadius: 1 }}>Preview</Button>
          <Button size="small" variant="outlined" disabled={!assignmentPreviewLeadId} onClick={runAssignment} sx={{ borderRadius: 1 }}>Run Now</Button>
        </Stack>
        {assignmentPreview ? <JsonPreview value={assignmentPreview} minRows={4} /> : null}
        <CompactDataTable
          columns={['Rule', 'Priority', 'Condition', 'Action', 'Manage']}
          rows={assignmentRules.slice(0, 8).map((rule) => [
            rule.name,
            rule.priority,
            (rule.conditions ?? []).map((condition: any) => `${labelForFieldPath(condition.fieldPath)} ${labelForOperator(condition.operator)} ${condition.value ?? ''}`.trim()).join(', ') || '-',
            (rule.actions ?? []).map((action: any) => labelForActionType(action.actionType)).join(', ') || '-',
            <RowActionMenu
              key={`${rule.id}-actions`}
              actions={[
                { label: 'Edit rule', icon: <EditIcon fontSize="small" />, onClick: () => editAssignmentRule(rule) },
                { label: 'Delete rule', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteAssignmentRule(rule.id) }
              ]}
            />
          ])}
        />
        <CompactDataTable
          columns={['Lead', 'Rule', 'Status', 'Assigned User', 'Created']}
          rows={assignmentRuns.slice(0, 8).map((run) => [
            run.lead?.customerName ?? run.leadId ?? '-',
            run.rule?.name ?? run.ruleId ?? '-',
            run.status ?? '-',
            run.assignedUser?.name ?? run.assignedUserId ?? '-',
            run.createdAt ? new Date(run.createdAt).toLocaleDateString('en-GB') : '-'
          ])}
        />
      </Stack>
    </Section>
  );
}
