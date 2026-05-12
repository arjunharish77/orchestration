'use client';

import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { ReactNode } from 'react';
import { Box, Button, InputAdornment, Stack, TextField } from '@mui/material';

const line = '#e0ede0';
const tint = '#eef7ee';
const green = '#2d6a2d';

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  quickFilters,
  onAdvancedFilter,
  columnsControl,
  densityControl,
  onExport,
  actions
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  quickFilters?: ReactNode;
  onAdvancedFilter?: () => void;
  columnsControl?: ReactNode;
  densityControl?: ReactNode;
  onExport?: () => void;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={0.65}
      alignItems={{ xs: 'stretch', md: 'center' }}
      justifyContent="space-between"
      flexWrap="wrap"
      useFlexGap
      sx={{ width: '100%' }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ xs: 'stretch', md: 'center' }} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
        {onSearchChange ? (
          <TextField
            size="small"
            value={search ?? ''}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
            sx={{
              minWidth: { xs: '100%', md: 230 },
              '& .MuiOutlinedInput-root': { height: 34, bgcolor: '#fff', borderRadius: '8px' }
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
          />
        ) : null}
        {quickFilters}
        {onAdvancedFilter ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltIcon />}
            onClick={onAdvancedFilter}
            sx={{ minHeight: 34, borderColor: line, bgcolor: tint, color: green }}
          >
            Advanced filter
          </Button>
        ) : null}
        {columnsControl}
        {densityControl}
      </Stack>
      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
        {onExport ? <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={onExport} sx={{ minHeight: 34 }}>Export</Button> : null}
        <Box>{actions}</Box>
      </Stack>
    </Stack>
  );
}
