'use client';

import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Alert, Box, Button, FormControl, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusChip } from '../../../components/common/StatusChip';
import { CompactDataTable } from '../../../components/common/CompactDataTable';
import { FieldSelector } from '../../../components/common/FieldSelector';
import { FormDialog } from '../../../components/common/FormDialog';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { TableToolbar } from '../../../components/common/TableToolbar';
import { ModuleShell, SectionPanel as Section } from '../../../components/common/WorkspacePrimitives';
import { apiRequest, apiText } from '../../../lib/api';
import { formatDate, humanizeKey } from '../../../lib/format';
import { uploadFieldOptions } from './uploads/upload-columns';

type UploadRow = [string, string, string, string, string, string, string];
type UploadBatchDetail = {
  id: string;
  fileName?: string | null;
  totalRows?: number | null;
  validRows?: number | null;
  invalidRows?: number | null;
  importedRows?: number | null;
  status?: string | null;
  rows?: Array<{
    id?: string;
    rowNumber?: number;
    uploadStatus?: string;
    errorMessage?: string | null;
    normalizedData?: Record<string, unknown> | null;
  }>;
};
type WorkerHeartbeat = { status?: string; ageMs?: number; timestamp?: string };
type WorkerHealth = {
  status: string;
  heartbeats?: Record<string, WorkerHeartbeat>;
};
type CsvUploadConfig = {
  requiredColumns: string[];
  duplicateKeyFields: string[];
  defaultMapping: Record<string, string>;
};
type CustomFieldDefinition = {
  fieldKey: string;
  label: string;
  moduleName?: string;
  isActive?: boolean;
};

const uploadMappingFields = [
  { key: 'customer_name', label: 'Customer name', required: true },
  { key: 'mobile_number', label: 'Mobile number', required: true },
  { key: 'loan_id', label: 'Loan / Lead ID', required: true },
  { key: 'branch_code', label: 'Branch code', required: true },
  { key: 'branch_name', label: 'Branch name', required: false },
  { key: 'loan_offer_amount', label: 'Loan offer amount', required: true },
  { key: 'emi_amount', label: 'EMI amount', required: false },
  { key: 'upload_date', label: 'Upload date', required: true },
  { key: 'offer_expiry_date', label: 'Closure / expiry date', required: true },
  { key: 'customer_location', label: 'Customer location', required: false },
  { key: 'preferred_language', label: 'Preferred language', required: false },
  { key: 'partner_mapping', label: 'Partner mapping', required: false }
] as const;

const uploadHeaderAliases: Record<string, string[]> = {
  customer_name: ['customer_name', 'customer', 'customername', 'name'],
  mobile_number: ['mobile_number', 'mobile', 'phone', 'phone_number', 'customer_mobile'],
  loan_id: ['loan_id', 'lead_id', 'loan_lead_id', 'loan_id_lead_id', 'external_lead_id'],
  branch_code: ['branch_code', 'branch'],
  branch_name: ['branch_name'],
  loan_offer_amount: ['loan_offer_amount', 'offer_amount', 'loan_amount'],
  emi_amount: ['emi_amount', 'emi'],
  upload_date: ['upload_date', 'created_at', 'created_on'],
  offer_expiry_date: ['offer_expiry_date', 'expiry_date', 'loan_closure', 'loan_closure_offer_expiry_date', 'closure_expiry_date'],
  customer_location: ['customer_location', 'location'],
  preferred_language: ['preferred_language', 'language'],
  partner_mapping: ['partner_mapping', 'partner']
};

function normalizeColumnName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseCsvHeaderLine(text: string) {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const headers: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      headers.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  headers.push(current.trim().replace(/^"|"$/g, ''));
  return headers.filter(Boolean);
}

function defaultUploadMapping(headers: string[], fields: Array<{ key: string; label: string }>, configuredMapping: Record<string, string> = {}) {
  return Object.fromEntries(fields.map((field) => {
    const aliases = uploadHeaderAliases[field.key] ?? [field.key];
    const configuredHeader = configuredMapping[field.key];
    const matchedHeader = configuredHeader && headers.includes(configuredHeader)
      ? configuredHeader
      : headers.find((header) => aliases.includes(normalizeColumnName(header)));
    return [field.key, matchedHeader ?? ''];
  }));
}

function formatUploadStatus(status: string) {
  return humanizeKey(status || 'Unknown');
}

function requiredMappingGaps(mapping: Record<string, string>, fields: Array<{ key: string; label: string }>, requiredColumns: string[]) {
  return fields
    .filter((field) => requiredColumns.includes(field.key) && !mapping[field.key])
    .map((field) => field.label);
}

function getLeadUploadWorkerStatus(health: WorkerHealth | null) {
  return health?.heartbeats?.['lead-upload']?.status ?? 'missing';
}

function toUploadRows(apiUploads: any[]): UploadRow[] {
  return apiUploads.map((upload) => [
    upload.id ?? upload.fileName ?? '-',
    upload.fileName ?? '-',
    String(upload.totalRows ?? 0),
    String(upload.validRows ?? 0),
    String(upload.invalidRows ?? 0),
    upload.status ?? '-',
    formatDate(upload.createdAt)
  ]);
}

export function UploadsView({ uploadRows: initialUploadRows = [], authToken, onUploaded }: { uploadRows?: UploadRow[]; authToken: string | null; onUploaded?: () => void }) {
  const [uploadRows, setUploadRows] = useState<UploadRow[]>(initialUploadRows);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [visibleUploadFields, setVisibleUploadFields] = useState(['file', 'rows', 'valid', 'failed', 'status', 'date']);
  const [uploadSearch, setUploadSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [workerHealthError, setWorkerHealthError] = useState<string | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<UploadBatchDetail | null>(null);
  const [uploadDetailLoading, setUploadDetailLoading] = useState(false);
  const [leadCustomFields, setLeadCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [csvUploadConfig, setCsvUploadConfig] = useState<CsvUploadConfig>({
    requiredColumns: uploadMappingFields.filter((field) => field.required).map((field) => field.key),
    duplicateKeyFields: ['mobile', 'externalLeadId'],
    defaultMapping: {}
  });

  const effectiveUploadMappingFields = useMemo(() => [
    ...uploadMappingFields,
    ...leadCustomFields
      .filter((field) => field.isActive !== false)
      .map((field) => ({ key: `custom:${field.fieldKey}`, label: `Custom: ${field.label}`, required: csvUploadConfig.requiredColumns.includes(`custom:${field.fieldKey}`) }))
  ], [csvUploadConfig.requiredColumns, leadCustomFields]);
  const queuedUploads = useMemo(() => uploadRows.filter((row) => ['queued', 'processing'].includes(row[5])).length, [uploadRows]);
  const mappingGaps = requiredMappingGaps(columnMapping, effectiveUploadMappingFields, csvUploadConfig.requiredColumns);
  const leadUploadWorkerStatus = getLeadUploadWorkerStatus(workerHealth);
  const workerReady = leadUploadWorkerStatus === 'ok';

  const refreshUploads = useCallback(async () => {
    if (!authToken) return;
    try {
      const data = await apiRequest<any[]>('/uploads', { token: authToken });
      setUploadRows(Array.isArray(data) ? toUploadRows(data) : []);
    } catch {
      setUploadRows([]);
    }
  }, [authToken]);

  const refreshWorkerHealth = useCallback(async () => {
    try {
      setWorkerHealthError(null);
      setWorkerHealth(await apiRequest<WorkerHealth>('/health/workers', { cache: 'no-store' }));
    } catch (error) {
      setWorkerHealthError(error instanceof Error ? error.message : 'Could not check worker health');
      setWorkerHealth(null);
    }
  }, []);

  const refreshCsvUploadConfig = useCallback(async () => {
    try {
      const payload = await apiRequest<CsvUploadConfig>('/settings/csv-upload-config', { token: authToken });
      setCsvUploadConfig({
        requiredColumns: Array.isArray(payload.requiredColumns) ? payload.requiredColumns : uploadMappingFields.filter((field) => field.required).map((field) => field.key),
        duplicateKeyFields: Array.isArray(payload.duplicateKeyFields) ? payload.duplicateKeyFields : ['mobile', 'externalLeadId'],
        defaultMapping: payload.defaultMapping && typeof payload.defaultMapping === 'object' ? payload.defaultMapping : {}
      });
    } catch {
      setCsvUploadConfig((current) => current);
    }
  }, [authToken]);

  const refreshLeadCustomFields = useCallback(async () => {
    try {
      const payload = await apiRequest<CustomFieldDefinition[]>('/custom-fields/definitions?moduleName=Lead', { token: authToken });
      setLeadCustomFields(Array.isArray(payload) ? payload : []);
    } catch {
      setLeadCustomFields([]);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return undefined;
    void refreshUploads();
    void refreshWorkerHealth();
    void refreshCsvUploadConfig();
    void refreshLeadCustomFields();
    const timer = window.setInterval(() => { void refreshWorkerHealth(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [authToken, refreshCsvUploadConfig, refreshLeadCustomFields, refreshUploads, refreshWorkerHealth]);

  const selectCsvFile = async (file?: File | null) => {
    setSelectedFile(file ?? null);
    setUploadMessage(null);
    if (!file) {
      setHeaders([]);
      setColumnMapping({});
      return;
    }
    const text = await file.text();
    const nextHeaders = parseCsvHeaderLine(text);
    setHeaders(nextHeaders);
    setColumnMapping(defaultUploadMapping(nextHeaders, effectiveUploadMappingFields, csvUploadConfig.defaultMapping));
  };

  const uploadCsv = async () => {
    if (!selectedFile) return;
    if (mappingGaps.length > 0) {
      setUploadMessage(`Map required fields before upload: ${mappingGaps.join(', ')}`);
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));
      const payload = await apiRequest<{ queued?: boolean; batch?: { totalRows?: number; importedRows?: number; invalidRows?: number } }>('/uploads/csv', {
        token: authToken,
        method: 'POST',
        body: formData
      });
      const message = payload.queued ? `Upload queued: ${payload.batch?.totalRows ?? 0} rows will import when the lead-upload worker is running` : `Uploaded ${payload.batch?.importedRows ?? 0} rows, ${payload.batch?.invalidRows ?? 0} failed`;
      setUploadMessage(message);
      setSelectedFile(null);
      setHeaders([]);
      setColumnMapping({});
      setUploadDialogOpen(false);
      await refreshUploads();
      onUploaded?.();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Could not upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const uploadLabelByKey = new Map(uploadFieldOptions.map((field) => [field.key, field.label]));
  const uploadStatuses = Array.from(new Set(uploadRows.map((row) => row[5]).filter(Boolean)));
  const filteredUploadRows = uploadRows.filter((row) => {
    const matchesSearch = row.join(' ').toLowerCase().includes(uploadSearch.trim().toLowerCase());
    const matchesStatus = !statusFilter || row[5] === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const uploadValueByField = (row: UploadRow, field: string) => {
    const indexByField: Record<string, number> = { file: 1, rows: 2, valid: 3, failed: 4, status: 5, date: 6 };
    const value = row[indexByField[field] ?? 0];
    return field === 'status' ? <StatusChip key={`${row[0]}-status`} status={formatUploadStatus(value)} /> : value;
  };
  const openUploadDetail = async (uploadId: string) => {
    if (!authToken) return;
    setUploadDetailLoading(true);
    setSelectedUpload(null);
    try {
      setSelectedUpload(await apiRequest<UploadBatchDetail>(`/uploads/${encodeURIComponent(uploadId)}`, { token: authToken }));
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Could not load upload details');
    } finally {
      setUploadDetailLoading(false);
    }
  };

  const downloadUploadCsv = async (uploadId: string, variant: 'result-csv' | 'original-csv') => {
    if (!authToken) return;
    try {
      const csv = await apiText(`/uploads/${encodeURIComponent(uploadId)}/${variant}`, { token: authToken });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = variant === 'result-csv' ? `upload-${uploadId}-result.csv` : `upload-${uploadId}-original.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Could not download CSV');
    }
  };

  return (
    <ModuleShell
      title="CSV Uploads"
      subtitle="CSV upload batches, validation results, and row-level upload status."
      actions={(
        <Stack direction="row" spacing={0.75}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => { void refreshUploads(); onUploaded?.(); void refreshWorkerHealth(); }} sx={{ borderRadius: 1 }}>Refresh</Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setUploadDialogOpen(true)} sx={{ borderRadius: 1 }}>Upload CSV</Button>
        </Stack>
      )}
    >
      <Stack spacing={1}>
        <MessageAlert message={uploadMessage} />
        {!workerReady ? (
          <Alert
            severity={queuedUploads > 0 ? 'warning' : 'info'}
            action={<Button color="inherit" size="small" onClick={() => { void refreshWorkerHealth(); }}>Check</Button>}
            sx={{ borderRadius: 1, alignItems: 'center', border: '1px solid var(--crm-border)' }}
          >
            Lead upload worker is {workerHealthError ? 'not reachable' : leadUploadWorkerStatus}. {queuedUploads > 0 ? `${queuedUploads} upload${queuedUploads === 1 ? '' : 's'} waiting in queue.` : 'CSV imports need this worker to process queued files.'}
          </Alert>
        ) : null}
      </Stack>
      <Section title="Upload History">
        <Stack spacing={0.75} sx={{ p: 0.85 }}>
          <TableToolbar
            search={uploadSearch}
            onSearchChange={setUploadSearch}
            searchPlaceholder="Search uploads"
            quickFilters={(
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <Select displayEmpty value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <MenuItem value="">All statuses</MenuItem>
                  {uploadStatuses.map((status) => <MenuItem key={status} value={status}>{formatUploadStatus(status)}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            columnsControl={<FieldSelector fields={uploadFieldOptions} selected={visibleUploadFields} onChange={setVisibleUploadFields} />}
          />
        </Stack>
        <CompactDataTable
          columns={[...visibleUploadFields.map((field) => uploadLabelByKey.get(field) ?? humanizeKey(field)), 'Action']}
          rowIds={filteredUploadRows.map((row) => row[0])}
          rows={filteredUploadRows.map((row) => [
            ...visibleUploadFields.map((field) => uploadValueByField(row, field)),
            <Tooltip key={`${row[0]}-detail`} title="View upload details">
              <IconButton size="small" onClick={() => { void openUploadDetail(row[0]); }} aria-label={`View details for ${row[1]}`}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ])}
        />
      </Section>
      <FormDialog
        open={Boolean(selectedUpload) || uploadDetailLoading}
        title={selectedUpload?.fileName ?? 'Upload details'}
        subtitle={selectedUpload ? `${selectedUpload.totalRows ?? 0} rows · ${formatUploadStatus(selectedUpload.status ?? '-')}` : 'Loading upload details'}
        onClose={() => setSelectedUpload(null)}
        maxWidth="lg"
        actions={(
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} disabled={!selectedUpload} onClick={() => { if (selectedUpload) void downloadUploadCsv(selectedUpload.id, 'original-csv'); }}>Original CSV</Button>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} disabled={!selectedUpload} onClick={() => { if (selectedUpload) void downloadUploadCsv(selectedUpload.id, 'result-csv'); }}>Result CSV</Button>
            <Button variant="contained" onClick={() => setSelectedUpload(null)}>Done</Button>
          </Stack>
        )}
      >
        {uploadDetailLoading ? (
          <CompactDataTable columns={['Row', 'Status', 'Error', 'Lead']} rows={[]} loading />
        ) : (
          <Stack spacing={1}>
            <Box sx={{ display: 'grid', gap: 0.8, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, minmax(0, 1fr))' } }}>
              {[
                ['Rows', selectedUpload?.totalRows ?? 0],
                ['Imported', selectedUpload?.importedRows ?? selectedUpload?.validRows ?? 0],
                ['Failed', selectedUpload?.invalidRows ?? 0],
                ['Status', formatUploadStatus(selectedUpload?.status ?? '-')]
              ].map(([label, value]) => (
                <Box key={label} sx={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--crm-border)', borderRadius: 1, p: 1, bgcolor: 'var(--crm-paper-soft)', boxShadow: '0 8px 20px rgba(22, 39, 22, 0.035)', '&:before': { content: '""', position: 'absolute', inset: 0, width: 3, bgcolor: 'var(--crm-primary)' } }}>
                  <Typography fontSize={11} fontWeight={800} color="text.secondary">{label}</Typography>
                  <Typography fontWeight={850}>{value}</Typography>
                </Box>
              ))}
            </Box>
            <CompactDataTable
              columns={['Row', 'Status', 'Error', 'Lead']}
              rowIds={(selectedUpload?.rows ?? []).map((row, index) => row.id ?? `${row.rowNumber ?? index}`)}
              rows={(selectedUpload?.rows ?? []).map((row) => [
                row.rowNumber ?? '-',
                <StatusChip key={`${row.id}-status`} status={formatUploadStatus(row.uploadStatus ?? '-')} />,
                row.errorMessage ?? '-',
                String(row.normalizedData?.customerName ?? row.normalizedData?.mobile ?? row.normalizedData?.leadId ?? '-')
              ])}
              emptyLabel="No row details found"
            />
          </Stack>
        )}
      </FormDialog>
      <FormDialog
        open={uploadDialogOpen}
        title="Upload CSV"
        subtitle="Map CSV columns to required lead upload fields before import."
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="lg"
        actions={(
          <>
            <Button variant="text" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={!selectedFile || uploading || mappingGaps.length > 0} onClick={uploadCsv}>{uploading ? 'Uploading...' : 'Upload'}</Button>
          </>
        )}
      >
        <Stack spacing={1}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Button component="label" variant="outlined" size="small" startIcon={<CloudUploadIcon />} sx={{ borderRadius: 1, width: { xs: '100%', md: 180 } }}>
              Select CSV
              <input hidden accept=".csv,text/csv" type="file" onChange={(event) => { void selectCsvFile(event.target.files?.[0]); }} />
            </Button>
            <Typography color="text.secondary" fontWeight={700}>{selectedFile?.name ?? 'No file selected'}</Typography>
          </Stack>
          {selectedFile && mappingGaps.length > 0 ? (
            <Alert severity="warning" sx={{ borderRadius: 1 }}>
              Missing required mapping: {mappingGaps.join(', ')}
            </Alert>
          ) : null}
          {headers.length > 0 ? (
            <Box sx={{ display: 'grid', gap: 0.8, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
              {effectiveUploadMappingFields.map((field) => (
                <FormControl key={field.key} size="small">
                  <Typography fontSize={11} fontWeight={800} color="text.secondary" sx={{ mb: 0.25 }}>{field.label}{csvUploadConfig.requiredColumns.includes(field.key) ? ' *' : ''}</Typography>
                  <Select
                    value={columnMapping[field.key] ?? ''}
                    onChange={(event) => setColumnMapping({ ...columnMapping, [field.key]: event.target.value })}
                    displayEmpty
                  >
                    <MenuItem value="">Not mapped</MenuItem>
                    {headers.map((header) => <MenuItem key={`${field.key}-${header}`} value={header}>{header}</MenuItem>)}
                  </Select>
                </FormControl>
              ))}
            </Box>
          ) : null}
        </Stack>
      </FormDialog>
    </ModuleShell>
  );
}
