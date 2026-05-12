'use client';

import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { Stack } from '@mui/material';
import { ReportsOverview } from './report-types';
import { formatDate, numberValue, stringValue } from './report-utils';

export function ReportSummaryTab({ reportsOverview }: { reportsOverview: ReportsOverview }) {
  return (
    <Stack spacing={0.85}>
      <Section title="Lead Upload Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['File', 'Rows', 'Imported', 'Failed', 'Status', 'Created']}
          rows={(reportsOverview.uploadBatches ?? []).map((upload) => [
            stringValue(upload.fileName),
            String(numberValue(upload.totalRows)),
            String(numberValue(upload.importedRows, numberValue(upload.validRows))),
            String(numberValue(upload.invalidRows)),
            <AppChip key={`${stringValue(upload.id)}-status`} label={stringValue(upload.status)} />,
            formatDate(stringValue(upload.createdAt))
          ])}
        />
      </Section>
      <Section title="Invalid Lead Report" defaultExpanded={false}>
        <CompactDataTable
          columns={['Row', 'Status', 'Error', 'Lead', 'Created', 'Batch']}
          rows={(reportsOverview.invalidUploadRows ?? []).map((row) => [
            stringValue(row.rowNumber),
            <AppChip key={`${stringValue(row.id)}-status`} label={stringValue(row.uploadStatus)} />,
            stringValue(row.errorMessage),
            stringValue(row.leadName, stringValue(row.leadId)),
            formatDate(stringValue(row.createdAt)),
            stringValue(row.batchId)
          ])}
        />
      </Section>
      <Section title="Team-wise Distribution" defaultExpanded={false}>
        <CompactDataTable
          columns={['Team', 'Code', 'Type', 'Lead Count']}
          rows={(reportsOverview.teamDistribution ?? []).map((team) => [
            stringValue(team.name),
            stringValue(team.code),
            stringValue(team.type),
            String(numberValue(team.leadCount))
          ])}
        />
      </Section>
    </Stack>
  );
}
