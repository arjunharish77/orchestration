'use client';

import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TuneIcon from '@mui/icons-material/Tune';
import { Box, Button, FormControl, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { ReportFilters, ReportsOverview } from './report-types';
import { stringValue } from './report-utils';
import { AccessSalesGroup, AccessUser } from '../settings/settings-types';

const emptyReportFilters: ReportFilters = { dateFrom: '', dateTo: '', teamId: '', ownerId: '', salesGroupId: '', status: '', category: '', disposition: '', connector: '' };
const statusOptions = ['New', 'Assigned', 'In Progress', 'Converted', 'Expired', 'No Response', 'Not Interested'];
const categoryOptions = ['Hot Lead', 'Warm Lead', 'Cold Lead', 'Callback Requested', 'Need More Details', 'Converted', 'Expired'];
const dispositionOptions = ['Converted', 'Interested', 'Follow-up Required', 'Callback Scheduled', 'Documents Pending', 'Not Interested', 'Not Reachable', 'Wrong Number', 'Escalated'];
const connectorOptions = [
  { value: 'telephony', label: 'Telephony' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'voicebot', label: 'Voicebot' }
];

export function ReportFiltersPanel({
  filters,
  teamOptions,
  userOptions,
  salesGroupOptions,
  onChange,
  onApply,
  onReset
}: {
  filters: ReportFilters;
  teamOptions: ReportsOverview['teamDistribution'];
  userOptions: AccessUser[];
  salesGroupOptions: AccessSalesGroup[];
  onChange: (filters: ReportFilters) => void;
  onApply: () => void;
  onReset: (filters: ReportFilters) => void;
}) {
  const activeCount = Object.values(filters).filter(Boolean).length;
  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: 'var(--crm-border)',
        borderRadius: '8px',
        bgcolor: 'var(--crm-paper)',
        p: 0.75,
        boxShadow: '0 8px 20px rgba(22, 39, 22, 0.018)'
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.75} alignItems={{ xs: 'stretch', lg: 'center' }}>
        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minWidth: { lg: 142 } }}>
          <TuneIcon fontSize="small" sx={{ color: 'var(--crm-primary)' }} />
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 13, lineHeight: 1.1 }}>Filters</Typography>
            <Typography sx={{ color: 'text.secondary', fontWeight: 750, fontSize: 11 }}>{activeCount ? `${activeCount} active` : 'All records'}</Typography>
          </Box>
        </Stack>
        <Box sx={{ flex: 1, display: 'grid', gap: 0.7, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(128px, 1fr))' }, alignItems: 'center' }}>
          <TextField size="small" label="From" type="date" value={filters.dateFrom} onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="To" type="date" value={filters.dateTo} onChange={(event) => onChange({ ...filters, dateTo: event.target.value })} InputLabelProps={{ shrink: true }} />
          <FormControl size="small">
            <Select displayEmpty value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
              <MenuItem value="">All statuses</MenuItem>
              {statusOptions.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={filters.teamId} onChange={(event) => onChange({ ...filters, teamId: event.target.value })}>
              <MenuItem value="">All teams</MenuItem>
              {(teamOptions ?? []).map((team) => <MenuItem key={stringValue(team.id)} value={stringValue(team.id)}>{stringValue(team.name)}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={filters.ownerId} onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}>
              <MenuItem value="">All owners</MenuItem>
              <MenuItem value="__system__">System</MenuItem>
              {userOptions.map((user) => <MenuItem key={user.id} value={user.id}>{user.name ?? user.email ?? user.id}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value })}>
              <MenuItem value="">All categories</MenuItem>
              {categoryOptions.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={filters.disposition} onChange={(event) => onChange({ ...filters, disposition: event.target.value })}>
              <MenuItem value="">All dispositions</MenuItem>
              {dispositionOptions.map((disposition) => <MenuItem key={disposition} value={disposition}>{disposition}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={filters.salesGroupId} onChange={(event) => onChange({ ...filters, salesGroupId: event.target.value })}>
              <MenuItem value="">All sales groups</MenuItem>
              {salesGroupOptions.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={filters.connector} onChange={(event) => onChange({ ...filters, connector: event.target.value })}>
              <MenuItem value="">All connectors</MenuItem>
              {connectorOptions.map((connector) => <MenuItem key={connector.value} value={connector.value}>{connector.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Stack direction="row" spacing={0.6} justifyContent="flex-end">
          <Button variant="outlined" size="small" startIcon={<RestartAltIcon />} onClick={() => onReset(emptyReportFilters)} sx={{ borderRadius: 1, minHeight: 36 }}>Reset</Button>
          <Button variant="contained" size="small" onClick={onApply} sx={{ borderRadius: 1, minHeight: 36, minWidth: 86 }}>Apply</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
