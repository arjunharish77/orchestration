'use client';

import SearchIcon from '@mui/icons-material/Search';
import { FormControl, InputAdornment, MenuItem, Select, TextField, Typography } from '@mui/material';
import { FilterPill, PageFilterBar } from '../../../../components/common/WorkspacePrimitives';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

export function LeadFilters({
  filterForm,
  setFilterForm,
  leadLists,
  branchOptions,
  currentUserId,
  applyQuickFilter,
  setFilterOpen,
  onSearch,
  resultLabel
}: {
  filterForm: any;
  setFilterForm: (value: any) => void;
  leadLists: { status: string[]; category: string[] };
  branchOptions: string[];
  currentUserId?: string | null;
  applyQuickFilter: (patch: Partial<any>) => void;
  setFilterOpen: (open: boolean) => void;
  onSearch: () => void;
  resultLabel?: string;
}) {
  const today = isoDate(new Date());
  const last7 = daysAgo(7);
  const last30 = daysAgo(30);
  const createdLabel = filterForm.createdFrom || filterForm.createdTo
    ? [filterForm.createdFrom || 'Any', filterForm.createdTo || 'Today'].join(' to ')
    : 'Any time';
  const createdPreset =
    !filterForm.createdFrom && !filterForm.createdTo
      ? ''
      : filterForm.createdFrom === today && filterForm.createdTo === today
        ? 'today'
        : filterForm.createdFrom === last7 && filterForm.createdTo === today
          ? '7'
          : filterForm.createdFrom === last30 && filterForm.createdTo === today
            ? '30'
            : 'custom';

  const applyCreatedPreset = (value: string) => {
    if (!value) {
      applyQuickFilter({ createdFrom: '', createdTo: '' });
      return;
    }
    if (value === 'today') {
      applyQuickFilter({ createdFrom: today, createdTo: today });
      return;
    }
    if (value === '7') {
      applyQuickFilter({ createdFrom: last7, createdTo: today });
      return;
    }
    if (value === '30') {
      applyQuickFilter({ createdFrom: last30, createdTo: today });
    }
  };

  return (
    <PageFilterBar rightContent={<Typography fontWeight={850}>{resultLabel}</Typography>}>
      <TextField
        size="small"
        placeholder="Search leads"
        value={filterForm.search}
        onChange={(event) => setFilterForm({ ...filterForm, search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            applyQuickFilter({ search: filterForm.search });
            onSearch();
          }
        }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ minWidth: { xs: '100%', sm: 260 }, '& .MuiInputBase-root': { minHeight: 34 } }}
      />
      <FormControl size="small" sx={{ minWidth: 142 }}>
        <Select displayEmpty value={filterForm.status} onChange={(event) => applyQuickFilter({ status: event.target.value })}>
          <MenuItem value="">Status: All</MenuItem>
          {leadLists.status.map((status) => <MenuItem key={status} value={status}>Status: {status}</MenuItem>)}
        </Select>
      </FormControl>
      <FilterPill
        label="Owner"
        value={filterForm.assignedUserId ? 'Me' : 'Anyone'}
        muted
        onClick={currentUserId ? () => applyQuickFilter({ assignedUserId: filterForm.assignedUserId ? '' : currentUserId }) : undefined}
      />
      <FormControl size="small" sx={{ minWidth: 132 }}>
        <Select displayEmpty value={filterForm.branchCode} onChange={(event) => applyQuickFilter({ branchCode: event.target.value })}>
          <MenuItem value="">Branch: All</MenuItem>
          {branchOptions.map((branch) => <MenuItem key={branch} value={branch}>Branch: {branch}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select displayEmpty value={filterForm.category} onChange={(event) => applyQuickFilter({ category: event.target.value })}>
          <MenuItem value="">Category: All</MenuItem>
          {leadLists.category.map((category) => <MenuItem key={category} value={category}>Category: {category}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select displayEmpty value={createdPreset} onChange={(event) => applyCreatedPreset(String(event.target.value))}>
          <MenuItem value="">Created: Any time</MenuItem>
          <MenuItem value="today">Created: Today</MenuItem>
          <MenuItem value="7">Created: Last 7d</MenuItem>
          <MenuItem value="30">Created: Last 30d</MenuItem>
          {createdPreset === 'custom' ? <MenuItem value="custom" disabled>Created: {createdLabel}</MenuItem> : null}
        </Select>
      </FormControl>
      <FilterPill label="+ Add filter" muted onClick={() => setFilterOpen(true)} />
    </PageFilterBar>
  );
}
