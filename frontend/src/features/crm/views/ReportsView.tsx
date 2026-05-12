'use client';

import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link as MuiLink, Paper, Stack, TextField } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { AppChip } from '../../../components/common/AppChip';
import { CapsuleButton } from '../../../components/common/CapsuleButton';
import { CompactDataTable } from '../../../components/common/CompactDataTable';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { ModuleShell, SegmentedTabs } from '../../../components/common/WorkspacePrimitives';
import { apiRequest, apiText } from '../../../lib/api';
import { ReportAuditTab } from './reports/ReportAuditTab';
import { ReportAutomationTab } from './reports/ReportAutomationTab';
import { ReportCommunicationsTab } from './reports/ReportCommunicationsTab';
import { ReportFiltersPanel } from './reports/ReportFiltersPanel';
import { ReportJourneyTab } from './reports/ReportJourneyTab';
import { ReportMetricGrid } from './reports/ReportMetricGrid';
import { ReportSummaryTab } from './reports/ReportSummaryTab';
import { AuditFilters, AuditLogPage, AuditLogRow, ReportExportRow, ReportFilters, ReportsOverview } from './reports/report-types';
import { formatDate, stringValue } from './reports/report-utils';
import { AccessOverview, AccessSalesGroup, AccessUser } from './settings/settings-types';

type SavedReport = { id: string; name: string; reportType: string; filters?: Record<string, unknown>; visibility?: string; createdAt?: string };

export function ReportsView({ authToken }: { authToken: string | null }) {
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(100);
  const [reportsOverview, setReportsOverview] = useState<ReportsOverview>({});
  const [reportExportRows, setReportExportRows] = useState<ReportExportRow[]>([]);
  const [reportUsers, setReportUsers] = useState<AccessUser[]>([]);
  const [reportSalesGroups, setReportSalesGroups] = useState<AccessSalesGroup[]>([]);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({ module: '', action: '', entityId: '', changedBy: '', dateFrom: '', dateTo: '' });
  const [reportFilters, setReportFilters] = useState<ReportFilters>({ dateFrom: '', dateTo: '', teamId: '', ownerId: '', salesGroupId: '', status: '', category: '', disposition: '', connector: '' });
  const [reportTab, setReportTab] = useState('summary');
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [drilldownDialog, setDrilldownDialog] = useState<{ title: string; rows: Array<Record<string, unknown>> } | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [saveReportOpen, setSaveReportOpen] = useState(false);
  const [saveReportName, setSaveReportName] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  const loadAuditLogs = useCallback(async (page = auditPage, pageSize = auditPageSize, filters = auditFilters) => {
    if (!authToken) return;
    setReportMessage(null);
    try {
      const searchParams = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim() !== '')));
      searchParams.set('page', String(page));
      searchParams.set('pageSize', String(pageSize));
      searchParams.set('includeTotal', 'true');
      const payload = await apiRequest<AuditLogPage>(`/audit-logs?${searchParams.toString()}`, { token: authToken });
      setAuditRows(Array.isArray(payload.rows) ? payload.rows : []);
      setAuditTotal(Number.isFinite(payload.total) ? payload.total : 0);
      setAuditPage(payload.page || page);
      setAuditPageSize(payload.pageSize || pageSize);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Could not load audit logs');
      setAuditRows([]);
      setAuditTotal(0);
    }
  }, [auditFilters, auditPage, auditPageSize, authToken]);

  const loadReportsOverview = useCallback(async (filters = reportFilters) => {
    if (!authToken) return;
    const searchParams = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim() !== '')));
    try {
      const [payload, exportsPayload, auditsPayload, savedPayload] = await Promise.all([
        apiRequest<ReportsOverview>(`/reports/overview?${searchParams.toString()}`, { token: authToken }),
        apiRequest<ReportExportRow[]>('/reports/exports', { token: authToken }),
        apiRequest<AuditLogPage>('/audit-logs?page=1&pageSize=100&includeTotal=true', { token: authToken }),
        apiRequest<SavedReport[]>('/reports/saved', { token: authToken }).catch(() => [] as SavedReport[])
      ]);
      setReportsOverview(payload ?? {});
      setReportExportRows(Array.isArray(exportsPayload) ? exportsPayload : []);
      setAuditRows(Array.isArray(auditsPayload.rows) ? auditsPayload.rows : []);
      setAuditTotal(Number.isFinite(auditsPayload.total) ? auditsPayload.total : 0);
      setAuditPage(auditsPayload.page || 1);
      setAuditPageSize(auditsPayload.pageSize || 100);
      setSavedReports(Array.isArray(savedPayload) ? savedPayload : []);
    } catch {
      setReportsOverview({});
      setReportExportRows([]);
      setAuditRows([]);
      setAuditTotal(0);
    }
  }, [authToken, reportFilters]);

  const loadReportAccessOptions = useCallback(async () => {
    if (!authToken) return;
    try {
      const payload = await apiRequest<AccessOverview>('/access/overview', { token: authToken });
      setReportUsers(Array.isArray(payload.users) ? payload.users : []);
      setReportSalesGroups(Array.isArray(payload.salesGroups) ? payload.salesGroups : []);
    } catch {
      setReportUsers([]);
      setReportSalesGroups([]);
    }
  }, [authToken]);

  useEffect(() => {
    void loadReportsOverview();
    void loadReportAccessOptions();
  }, [loadReportAccessOptions, loadReportsOverview]);

  const exportReport = async () => {
    if (!authToken) return;
    setReportMessage(null);
    try {
      await apiRequest('/reports/exports', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: 'lead-summary', filters: reportFilters })
      });
      const historyRows = await apiRequest<ReportExportRow[]>('/reports/exports', { token: authToken });
      setReportExportRows(Array.isArray(historyRows) ? historyRows : []);
      setReportMessage('Report export completed');
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Could not export report');
    }
  };

  const downloadReportFile = async (fileId: string, fileName: string) => {
    if (!authToken || !fileId) return;
    setReportMessage(null);
    try {
      const text = await apiText(`/files/${fileId}/download`, { token: authToken });
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || 'unnatify-report.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Could not download report');
    }
  };

  const openDrilldown = async (metric: string, title: string) => {
    if (!authToken) return;
    const searchParams = new URLSearchParams(Object.fromEntries(Object.entries({ ...reportFilters, metric }).filter(([, value]) => value.trim() !== '')));
    const rows = await apiRequest<Array<Record<string, unknown>>>(`/reports/drilldown?${searchParams.toString()}`, { token: authToken });
    setDrilldownDialog({ title, rows: Array.isArray(rows) ? rows : [] });
  };

  const saveReport = async () => {
    if (!authToken || !saveReportName.trim()) return;
    setSavingReport(true);
    try {
      await apiRequest('/reports/saved', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveReportName.trim(), reportType: 'lead-summary', filters: reportFilters })
      });
      const updated = await apiRequest<SavedReport[]>('/reports/saved', { token: authToken });
      setSavedReports(Array.isArray(updated) ? updated : []);
      setSaveReportName('');
      setSaveReportOpen(false);
      setReportMessage('Report saved');
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Could not save report');
    } finally {
      setSavingReport(false);
    }
  };

  const loadSavedReport = (saved: SavedReport) => {
    if (saved.filters) setReportFilters({ ...reportFilters, ...(saved.filters as ReportFilters) });
    void loadReportsOverview({ ...reportFilters, ...(saved.filters as ReportFilters) });
  };

  const exportDrilldownRows = () => {
    const rows = drilldownDialog?.rows ?? [];
    if (!rows.length) return;
    const columns = ['Name', 'Status', 'Mobile / Due', 'Updated'];
    const csvRows = rows.map((row) => [
      stringValue(row.customerName, stringValue(row.title, stringValue(row.workflowId))),
      stringValue(row.status, stringValue(row.disposition)),
      stringValue(row.mobile, formatDate(stringValue(row.dueDate))),
      formatDate(stringValue(row.updatedAt, stringValue(row.startedAt, stringValue(row.createdAt))))
    ]);
    const csv = [columns, ...csvRows].map((cells) => cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(drilldownDialog?.title ?? 'report-drilldown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleShell
      title="Reports"
      subtitle="Automation, uploads, conversations, audit history, and conversion."
      actions={
        <Stack direction="row" spacing={0.75}>
          <CapsuleButton variant="outlined" startIcon={<BookmarkBorderIcon />} onClick={() => setSaveReportOpen(true)}>Save View</CapsuleButton>
          <CapsuleButton variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportReport}>Export CSV</CapsuleButton>
        </Stack>
      }
    >
      <Stack spacing={0.9}>
        <MessageAlert message={reportMessage} />
        <ReportFiltersPanel
          filters={reportFilters}
          teamOptions={reportsOverview.teamDistribution}
          userOptions={reportUsers}
          salesGroupOptions={reportSalesGroups}
          onChange={setReportFilters}
          onReset={setReportFilters}
          onApply={() => { void loadReportsOverview(); }}
        />
        <ReportMetricGrid metrics={reportsOverview.metrics} openDrilldown={(metric, title) => { void openDrilldown(metric, title); }} />
        <Paper variant="outlined" sx={{ borderColor: 'var(--crm-border)', borderRadius: '8px', overflow: 'hidden', bgcolor: 'var(--crm-paper)' }}>
          <Box sx={{ px: 0.7, py: 0.55, borderBottom: '1px solid var(--crm-border)', bgcolor: 'var(--crm-paper-soft)' }}>
            <SegmentedTabs
              value={reportTab}
              onChange={setReportTab}
              tabs={[
                { value: 'summary', label: 'Lead & Uploads' },
                { value: 'automation', label: 'Automation' },
                { value: 'communications', label: 'Calls & Messages' },
                { value: 'journey', label: 'Journey' },
                { value: 'audit', label: 'Audit' }
              ]}
            />
          </Box>
          <Box sx={{ p: 0.8, bgcolor: '#fbfefb' }}>
            {reportTab === 'summary' ? <ReportSummaryTab reportsOverview={reportsOverview} /> : null}
            {reportTab === 'automation' ? <ReportAutomationTab reportsOverview={reportsOverview} /> : null}
            {reportTab === 'communications' ? <ReportCommunicationsTab reportsOverview={reportsOverview} /> : null}
            {reportTab === 'journey' ? (
              <ReportJourneyTab
                reportsOverview={reportsOverview}
                reportExportRows={reportExportRows}
                downloadReportFile={(fileId, fileName) => { void downloadReportFile(fileId, fileName); }}
              />
            ) : null}
            {reportTab === 'audit' ? (
              <ReportAuditTab
                auditRows={auditRows}
                auditTotal={auditTotal}
                auditPage={auditPage}
                auditPageSize={auditPageSize}
                auditFilters={auditFilters}
                setAuditFilters={setAuditFilters}
                loadAuditLogs={(page, pageSize) => { void loadAuditLogs(page, pageSize); }}
                setAuditPage={setAuditPage}
                setAuditPageSize={setAuditPageSize}
              />
            ) : null}
          </Box>
        </Paper>
      </Stack>
      <Dialog
        open={Boolean(drilldownDialog)}
        onClose={() => setDrilldownDialog(null)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 1, border: '1px solid var(--crm-border)', boxShadow: '0 24px 70px rgba(22, 39, 22, 0.18)', overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ bgcolor: 'var(--crm-soft)', borderBottom: '1px solid var(--crm-border)', py: 1 }}>{drilldownDialog?.title ?? 'Metric'} Drilldown</DialogTitle>
        <DialogContent>
          <CompactDataTable
            columns={['Name', 'Status', 'Mobile / Due', 'Updated']}
            rows={(drilldownDialog?.rows ?? []).map((row) => {
              const leadId = stringValue(row.leadId, stringValue(row.id));
              const name = stringValue(row.customerName, stringValue(row.title, stringValue(row.workflowId)));
              const linkedName = row.customerName && leadId ? (
                <MuiLink href={`/leads/${leadId}`} underline="hover" sx={{ color: 'primary.main', fontWeight: 800 }}>
                  {name}
                </MuiLink>
              ) : name;
              return [
                linkedName,
              <AppChip key={`${stringValue(row.id)}-status`} label={stringValue(row.status, stringValue(row.disposition))} />,
              stringValue(row.mobile, formatDate(stringValue(row.dueDate))),
              formatDate(stringValue(row.updatedAt, stringValue(row.startedAt, stringValue(row.createdAt))))
              ];
            })}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'var(--crm-paper-soft)', borderTop: '1px solid var(--crm-border)' }}>
          <Button startIcon={<FileDownloadIcon />} disabled={!drilldownDialog?.rows.length} onClick={exportDrilldownRows}>Export</Button>
          <Button onClick={() => setDrilldownDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={saveReportOpen} onClose={() => setSaveReportOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 1, border: '1px solid var(--crm-border)', overflow: 'hidden' } }}>
        <DialogTitle sx={{ bgcolor: 'var(--crm-soft)', borderBottom: '1px solid var(--crm-border)', py: 1 }}>Save Report View</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <TextField
            size="small"
            label="Report name"
            fullWidth
            value={saveReportName}
            onChange={(e) => setSaveReportName(e.target.value)}
            autoFocus
          />
          {savedReports.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1.5 }}>
              {savedReports.slice(0, 5).map((r) => (
                <Button key={r.id} size="small" variant="text" sx={{ justifyContent: 'flex-start', fontWeight: 700 }}
                  onClick={() => { loadSavedReport(r); setSaveReportOpen(false); }}>
                  {r.name}
                </Button>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'var(--crm-paper-soft)', borderTop: '1px solid var(--crm-border)' }}>
          <Button onClick={() => setSaveReportOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={savingReport || !saveReportName.trim()} onClick={() => { void saveReport(); }}>
            {savingReport ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </ModuleShell>
  );
}
