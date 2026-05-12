'use client';

import DownloadIcon from '@mui/icons-material/Download';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Button, Typography } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { SettingsUploadDetailRow, SettingsUploadRow } from './settings-types';

const green = '#2d6a2d';

export function SettingsUploadHistoryPage({
  settingsUploads,
  selectedUploadReport,
  formatDate,
  rawUploadValue,
  loadUploadIssueReport,
  downloadUploadCsv,
  closeUploadIssueReport
}: {
  settingsUploads: SettingsUploadRow[];
  selectedUploadReport: { fileName: string; rows: SettingsUploadDetailRow[] } | null;
  formatDate: (value?: string | null) => string;
  rawUploadValue: (row: SettingsUploadDetailRow, key: string) => string;
  loadUploadIssueReport: (upload: SettingsUploadRow) => void;
  downloadUploadCsv: (uploadId: string, path: 'result-csv' | 'original-csv') => void;
  closeUploadIssueReport: () => void;
}) {
  return (
    <>
      <Section title="Upload History" defaultExpanded={false}>
        <CompactDataTable
          columns={['File', 'Rows', 'Imported', 'Failed', 'Status', 'Created', 'Action']}
          rows={settingsUploads.map((upload) => [
            <Typography key={upload.id} color={green} fontWeight={800}>{upload.fileName}</Typography>,
            String(upload.totalRows ?? 0),
            String(upload.importedRows ?? upload.validRows ?? 0),
            String(upload.invalidRows ?? 0),
            <AppChip key={`${upload.id}-status`} label={upload.status} />,
            formatDate(upload.createdAt),
            <RowActionMenu
              key={`${upload.id}-actions`}
              actions={[
                { label: 'View issue rows', icon: <ReportProblemOutlinedIcon fontSize="small" />, onClick: () => loadUploadIssueReport(upload) },
                { label: 'Download result CSV', icon: <DownloadIcon fontSize="small" />, onClick: () => downloadUploadCsv(upload.id, 'result-csv') },
                { label: 'Download original CSV', icon: <DownloadIcon fontSize="small" />, onClick: () => downloadUploadCsv(upload.id, 'original-csv') }
              ]}
            />
          ])}
        />
      </Section>
      <FormDialog
        open={Boolean(selectedUploadReport)}
        title={selectedUploadReport ? `${selectedUploadReport.fileName} issue rows` : 'Upload issue rows'}
        subtitle="Rows shown here were not imported cleanly. Download the result CSV for the full row-level status file."
        onClose={closeUploadIssueReport}
        maxWidth="lg"
        actions={<Button variant="contained" onClick={closeUploadIssueReport}>Done</Button>}
      >
        {selectedUploadReport ? (
          <CompactDataTable
            columns={['Row', 'Status', 'Error', 'Customer', 'Mobile', 'Lead ID']}
            rows={selectedUploadReport.rows.map((row) => [
              String(row.rowNumber),
              <AppChip key={`${row.id}-status`} label={row.uploadStatus} />,
              row.errorMessage ?? '-',
              rawUploadValue(row, 'customer_name'),
              rawUploadValue(row, 'mobile_number'),
              rawUploadValue(row, 'loan_id')
            ])}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
