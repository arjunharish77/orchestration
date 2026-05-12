'use client';

import { Box, Button, FormControl, MenuItem, Select, Stack, TextField } from '@mui/material';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { AuditFilters, AuditLogRow } from './report-types';
import { auditActionOptions, formatDate, humanizeKey, labelForModule, moduleOptions } from './report-utils';

export function ReportAuditTab({
  auditRows,
  auditTotal,
  auditPage,
  auditPageSize,
  auditFilters,
  setAuditFilters,
  loadAuditLogs,
  setAuditPage,
  setAuditPageSize
}: {
  auditRows: AuditLogRow[];
  auditTotal: number;
  auditPage: number;
  auditPageSize: number;
  auditFilters: AuditFilters;
  setAuditFilters: (filters: AuditFilters) => void;
  loadAuditLogs: (page?: number, pageSize?: number) => void;
  setAuditPage: (page: number) => void;
  setAuditPageSize: (pageSize: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, auditTotal) / auditPageSize));
  return (
    <Section title="Audit Logs" defaultExpanded={false}>
      <Stack spacing={1} sx={{ p: 1 }}>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(6, minmax(0, 1fr)) 100px' } }}>
          <FormControl size="small">
            <Select displayEmpty value={auditFilters.module} onChange={(event) => setAuditFilters({ ...auditFilters, module: event.target.value })}>
              <MenuItem value="">All modules</MenuItem>
              {moduleOptions.map((moduleName) => <MenuItem key={moduleName} value={moduleName}>{labelForModule(moduleName)}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={auditFilters.action} onChange={(event) => setAuditFilters({ ...auditFilters, action: event.target.value })}>
              <MenuItem value="">All actions</MenuItem>
              {auditActionOptions.map((action) => <MenuItem key={action} value={action}>{humanizeKey(action)}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Entity ID" value={auditFilters.entityId} onChange={(event) => setAuditFilters({ ...auditFilters, entityId: event.target.value })} />
          <TextField size="small" label="Changed by" value={auditFilters.changedBy} onChange={(event) => setAuditFilters({ ...auditFilters, changedBy: event.target.value })} />
          <TextField size="small" label="From" type="date" value={auditFilters.dateFrom} onChange={(event) => setAuditFilters({ ...auditFilters, dateFrom: event.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="To" type="date" value={auditFilters.dateTo} onChange={(event) => setAuditFilters({ ...auditFilters, dateTo: event.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={() => loadAuditLogs(1, auditPageSize)} sx={{ borderRadius: 1 }}>Apply</Button>
        </Box>
        <CompactDataTable
          columns={['Module', 'Action', 'Entity', 'Changed By', 'Type', 'Created']}
          rows={auditRows.map((row) => [
            labelForModule(row.moduleName),
            humanizeKey(row.action),
            row.entityId ?? row.id,
            row.changedBy ?? '-',
            row.changedByType ?? '-',
            formatDate(row.createdAt)
          ])}
          pageLabel={`${auditRows.length ? ((auditPage - 1) * auditPageSize) + 1 : 0}-${Math.min(auditPage * auditPageSize, auditTotal)} of ${auditTotal}`}
          previousDisabled={auditPage <= 1}
          nextDisabled={auditPage >= pageCount}
          onPreviousPage={() => {
            const nextPage = Math.max(1, auditPage - 1);
            setAuditPage(nextPage);
            loadAuditLogs(nextPage, auditPageSize);
          }}
          onNextPage={() => {
            const nextPage = Math.min(pageCount, auditPage + 1);
            setAuditPage(nextPage);
            loadAuditLogs(nextPage, auditPageSize);
          }}
        />
        <FormControl size="small" sx={{ width: 150, alignSelf: 'flex-end' }}>
          <Select
            value={String(auditPageSize)}
            onChange={(event) => {
              const nextPageSize = Number(event.target.value);
              setAuditPageSize(nextPageSize);
              setAuditPage(1);
              loadAuditLogs(1, nextPageSize);
            }}
          >
            {[50, 100, 200, 500].map((size) => <MenuItem key={size} value={String(size)}>{size} rows</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
    </Section>
  );
}
