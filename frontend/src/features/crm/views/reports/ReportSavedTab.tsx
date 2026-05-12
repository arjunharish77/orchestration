'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { ReportFilters, SavedReportRow, ScheduledReportRow } from './report-types';
import { formatDate, humanizeKey } from './report-utils';

export function ReportSavedTab({
  savedReports,
  scheduledReports,
  applySavedReport,
  deleteSavedReport,
  deleteSchedule
}: {
  savedReports: SavedReportRow[];
  scheduledReports: ScheduledReportRow[];
  applySavedReport: (filters: ReportFilters) => void;
  deleteSavedReport: (id: string) => void;
  deleteSchedule: (id: string) => void;
}) {
  return (
    <>
      <Section title="Saved Report Views" defaultExpanded={false}>
        <CompactDataTable
          columns={['Name', 'Type', 'Visibility', 'Updated', 'Actions']}
          rows={savedReports.map((row) => [
            row.name,
            humanizeKey(row.reportType),
            <AppChip key={`${row.id}-visibility`} label={row.visibility ?? 'private'} />,
            formatDate(row.updatedAt),
            <RowActionMenu
              key={`${row.id}-actions`}
              actions={[
                {
                  label: 'Apply view',
                  icon: <VisibilityIcon fontSize="small" />,
                  onClick: () => applySavedReport({ dateFrom: '', dateTo: '', teamId: '', ownerId: '', salesGroupId: '', status: '', category: '', disposition: '', connector: '', ...(row.filters ?? {}) })
                },
                { label: 'Delete view', icon: <DeleteIcon fontSize="small" />, tone: 'danger', onClick: () => deleteSavedReport(row.id) }
              ]}
            />
          ])}
        />
      </Section>
      <Section title="Scheduled Reports" defaultExpanded={false}>
        <CompactDataTable
          columns={['Name', 'Saved View', 'Frequency', 'Status', 'Next Run', 'Actions']}
          rows={scheduledReports.map((row) => [
            row.name,
            row.savedReport?.name ?? '-',
            humanizeKey(row.frequency),
            <AppChip key={`${row.id}-active`} label={row.isActive ? 'Active' : 'Paused'} />,
            formatDate(row.nextRunAt),
            <RowActionMenu
              key={`${row.id}-actions`}
              actions={[
                { label: 'Delete schedule', icon: <DeleteIcon fontSize="small" />, tone: 'danger', onClick: () => deleteSchedule(row.id) }
              ]}
            />
          ])}
        />
      </Section>
    </>
  );
}
