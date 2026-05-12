'use client';

import { Stack, Typography } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { ReportsOverview } from './report-types';
import { arrayValue, formatDate, stringValue } from './report-utils';

function automationStepCounts(run: Record<string, unknown>) {
  const steps = arrayValue<Record<string, unknown>>(run.steps);
  return {
    completed: steps.filter((step) => step.status === 'completed').length,
    pending: steps.filter((step) => step.status === 'pending').length,
    failed: steps.filter((step) => step.status === 'failed').length,
    skipped: steps.filter((step) => step.status === 'skipped').length
  };
}

function AutomationStepSummary({ run }: { run: Record<string, unknown> }) {
  const counts = automationStepCounts(run);
  const steps = arrayValue<Record<string, unknown>>(run.steps);

  return (
    <Stack spacing={0.65} sx={{ minWidth: 360, maxWidth: 520, whiteSpace: 'normal' }}>
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        <AppChip label={`Completed ${counts.completed}`} />
        <AppChip label={`Pending ${counts.pending}`} />
        <AppChip label={`Failed ${counts.failed}`} />
        <AppChip label={`Skipped ${counts.skipped}`} />
      </Stack>
      {steps.length > 0 ? (
        <Stack spacing={0.35}>
          {steps.slice(0, 5).map((step) => (
            <Stack key={stringValue(step.id, `${stringValue(step.nodeId)}-${stringValue(step.nodeType)}`)} direction="row" spacing={0.75} alignItems="center" sx={{ fontSize: 12 }}>
              <AppChip label={stringValue(step.status, 'pending')} />
              <Typography fontSize={12} fontWeight={800}>{stringValue(step.nodeType)}</Typography>
              <Typography fontSize={12} color="text.secondary">{stringValue(step.nodeId)}</Typography>
              {step.error ? <Typography fontSize={12} color="error.main">{stringValue(step.error)}</Typography> : null}
            </Stack>
          ))}
          {steps.length > 5 ? <Typography fontSize={12} color="text.secondary">+{steps.length - 5} more steps</Typography> : null}
        </Stack>
      ) : (
        <Typography fontSize={12} color="text.secondary">No steps recorded yet</Typography>
      )}
    </Stack>
  );
}

export function ReportAutomationTab({ reportsOverview }: { reportsOverview: ReportsOverview }) {
  return (
    <Stack spacing={0.85}>
      <Section title="Lead Automation Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['Workflow', 'Status', 'Started', 'Finished', 'Step Summary']}
          rows={(reportsOverview.automationRuns ?? []).map((run) => [
            stringValue(run.workflowName, stringValue(run.workflowId)),
            <AppChip key={`${stringValue(run.id)}-status`} label={stringValue(run.status)} />,
            formatDate(stringValue(run.startedAt)),
            formatDate(stringValue(run.completedAt, stringValue(run.finishedAt))),
            <AutomationStepSummary key={`${stringValue(run.id)}-steps`} run={run} />
          ])}
        />
      </Section>
      <Section title="Assignment Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['Lead', 'Rule', 'Status', 'Created', 'Logs']}
          rows={(reportsOverview.assignmentRuns ?? []).map((run) => [
            stringValue(run.leadName, stringValue(run.leadId)),
            stringValue(run.ruleName, stringValue(run.ruleId)),
            <AppChip key={`${stringValue(run.id)}-status`} label={stringValue(run.status)} />,
            formatDate(stringValue(run.createdAt)),
            String(arrayValue(run.logs).length)
          ])}
        />
      </Section>
    </Stack>
  );
}
