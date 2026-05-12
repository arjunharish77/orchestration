'use client';

import {
  DataGrid,
  GridColDef,
  GridRowId,
  GridRowSelectionModel
} from '@mui/x-data-grid';
import { alpha, Box, Button, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { ReactNode, useMemo } from 'react';

type CompactDataTableProps = {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  rowIds?: Array<string | number>;
  emptyLabel?: string;
  ariaLabel?: string;
  loading?: boolean;
  onPrimaryCellClick?: (rowIndex: number) => void;
  selectedRows?: number[];
  onSelectionChange?: (rows: number[]) => void;
  bulkActions?: ReactNode;
  pageLabel?: string;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
};

export type CrmTableColumn<T> = {
  key: string;
  label: string;
  primary?: boolean;
  visible?: boolean;
  customFieldKey?: string;
  render?: (row: T) => ReactNode;
  getValue?: (row: T) => ReactNode;
};

export type CrmTablePagination = {
  label?: string;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
};

type CrmDataTableProps<T> = {
  columns: Array<CrmTableColumn<T>>;
  rows: T[];
  getRowId?: (row: T, rowIndex: number) => string | number;
  emptyLabel?: string;
  loading?: boolean;
  toolbar?: ReactNode;
  filterSlot?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  pagination?: CrmTablePagination;
  selectedRows?: number[];
  onSelectionChange?: (rows: number[]) => void;
  bulkActions?: ReactNode;
  onPrimaryRowClick?: (row: T, rowIndex: number) => void;
};

const line = 'var(--crm-border)';
const panel = 'var(--crm-paper)';
const greenAlpha06 = 'rgba(var(--crm-primary-rgb), 0.06)';
const skeletonGreen = 'var(--crm-soft)';
const tableHeader = 'var(--crm-paper-soft)';
const emptySelectedRows: number[] = [];

export function CompactTableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <Box sx={{ border: `1px solid ${line}`, borderRadius: '8px', overflow: 'hidden', bgcolor: panel }}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Stack key={rowIndex} direction="row" spacing={1} sx={{ px: 1, py: 0.65, borderBottom: rowIndex === rows - 1 ? 'none' : `1px solid ${line}` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} variant="rounded" height={18} sx={{ flex: columnIndex === 0 ? 1.25 : 1, bgcolor: skeletonGreen }} />
          ))}
        </Stack>
      ))}
    </Box>
  );
}

export function CompactDataTable({
  columns,
  rows,
  rowIds,
  emptyLabel = 'No records found',
  ariaLabel = 'CRM data table',
  loading = false,
  onPrimaryCellClick,
  selectedRows,
  onSelectionChange,
  bulkActions,
  pageLabel,
  onPreviousPage,
  onNextPage,
  previousDisabled,
  nextDisabled
}: CompactDataTableProps) {
  const theme = useTheme();
  const selectable = Boolean(onSelectionChange);
  const selected = selectedRows ?? emptySelectedRows;

  const gridColumns: GridColDef[] = useMemo(() => columns.map((column, index) => {
    const isActionColumn = column.trim().toLowerCase() === 'action' || column.trim().toLowerCase() === 'actions';
    return {
      field: `c${index}`,
      headerName: column,
      flex: isActionColumn ? 0 : index === 0 ? 1.35 : 1,
      width: isActionColumn ? 84 : undefined,
      minWidth: isActionColumn ? 76 : index === 0 ? 180 : 130,
      maxWidth: isActionColumn ? 96 : undefined,
      sortable: !isActionColumn,
      filterable: !isActionColumn,
      align: isActionColumn ? 'center' : 'left',
      headerAlign: isActionColumn ? 'center' : 'left',
      renderCell: (params) => (
        <Box
          onClick={index === 0 && onPrimaryCellClick ? () => onPrimaryCellClick(Number(params.row.rowIndex)) : undefined}
          sx={{
            width: '100%',
            overflow: isActionColumn ? 'visible' : 'hidden',
            textOverflow: isActionColumn ? 'clip' : 'ellipsis',
            display: isActionColumn ? 'flex' : 'block',
            justifyContent: isActionColumn ? 'center' : 'flex-start',
            alignItems: isActionColumn ? 'center' : 'stretch',
            color: index === 0 ? 'text.primary' : 'text.secondary',
            fontWeight: index === 0 ? 750 : 500,
            cursor: index === 0 && onPrimaryCellClick ? 'pointer' : 'default'
          }}
        >
          {params.value}
        </Box>
      )
    };
  }), [columns, onPrimaryCellClick]);

  const gridRows = useMemo(() => rows.map((row, rowIndex) => ({
    id: rowIds?.[rowIndex] ?? rowIndex,
    rowIndex,
    ...Object.fromEntries(row.map((cell, cellIndex) => [`c${cellIndex}`, cell]))
  })), [rowIds, rows]);
  const rowIndexById = useMemo(() => new Map(gridRows.map((row) => [row.id, row.rowIndex])), [gridRows]);

  const selectionModel: GridRowSelectionModel = useMemo(() => ({
    type: 'include',
    ids: new Set<GridRowId>(
      selected
        .map((rowIndex) => gridRows[rowIndex]?.id)
        .filter((id): id is GridRowId => id !== undefined)
    )
  }), [gridRows, selected]);
  const hasCustomPagination = Boolean(onPreviousPage || onNextPage || pageLabel);

  if (loading) return <CompactTableSkeleton columns={columns.length} rows={6} />;

  return (
    <Box sx={{ border: `1px solid ${line}`, borderRadius: '8px', overflow: 'hidden', bgcolor: panel, boxShadow: '0 10px 26px rgba(22, 39, 22, 0.025)' }}>
      {selectable && selected.length > 0 ? (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, py: 0.5, borderBottom: `1px solid ${line}`, bgcolor: greenAlpha06 }}>
          <Typography fontWeight={800} color="primary.main">{selected.length} selected</Typography>
          {bulkActions}
        </Stack>
      ) : null}
      <DataGrid
        aria-label={ariaLabel}
        autoHeight
        rows={gridRows}
        columns={gridColumns}
        checkboxSelection={selectable}
        disableRowSelectionOnClick
        rowHeight={44}
        columnHeaderHeight={40}
        hideFooterPagination={hasCustomPagination}
        hideFooterSelectedRowCount
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={(model) => {
          if (!onSelectionChange) return;
          const ids = model.type === 'include' ? Array.from(model.ids) : gridRows.map((row) => row.id).filter((id) => !model.ids.has(id));
          onSelectionChange(ids
            .map((id) => rowIndexById.get(id))
            .filter((rowIndex): rowIndex is number => rowIndex !== undefined));
        }}
        localeText={{ noRowsLabel: emptyLabel }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-virtualScroller': { minHeight: rows.length === 0 ? 180 : 'unset' },
          '& .MuiDataGrid-columnHeaders': {
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: '40px !important',
            bgcolor: tableHeader
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 800,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: 0,
            color: '#526252'
          },
          '& .MuiDataGrid-row': {
            transition: theme.transitions.create(['background-color'], { duration: theme.transitions.duration.shorter }),
            '&:hover': { bgcolor: tableHeader },
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) }
            }
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid',
            borderColor: alpha(theme.palette.divider, 0.5),
            py: 0,
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.875rem',
            outline: 'none !important'
          },
          '& .MuiDataGrid-cell:focus-visible, & .MuiDataGrid-columnHeader:focus-visible': {
            outline: `2px solid ${alpha(theme.palette.primary.main, 0.55)} !important`,
            outlineOffset: -2
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid',
            borderColor: 'divider',
            minHeight: 38,
            justifyContent: 'center',
            '& .MuiTablePagination-root': { flex: '0 0 auto' }
          }
        }}
      />
      {hasCustomPagination ? (
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.2} sx={{ minHeight: 38, borderTop: `1px solid ${line}`, bgcolor: tableHeader }}>
          {onPreviousPage ? <Button size="small" onClick={onPreviousPage} disabled={previousDisabled}>Prev</Button> : null}
          <Typography color="text.secondary" sx={{ fontSize: 12, minWidth: 72, textAlign: 'center' }}>{pageLabel ?? (rows.length === 0 ? '0 of 0' : `1-${rows.length} of ${rows.length}`)}</Typography>
          {onNextPage ? <Button size="small" onClick={onNextPage} disabled={nextDisabled}>Next</Button> : null}
        </Stack>
      ) : null}
    </Box>
  );
}

export function CrmDataTable<T>({
  columns,
  rows,
  getRowId,
  emptyLabel,
  loading,
  toolbar,
  filterSlot,
  rowActions,
  pagination,
  selectedRows,
  onSelectionChange,
  bulkActions,
  onPrimaryRowClick
}: CrmDataTableProps<T>) {
  const visibleColumns = columns.filter((column) => column.visible !== false);
  const tableColumns = rowActions ? [...visibleColumns.map((column) => column.label), 'Action'] : visibleColumns.map((column) => column.label);
  const tableRows = rows.map((row) => {
    const cells = visibleColumns.map((column) => column.render?.(row) ?? column.getValue?.(row) ?? '-');
    return rowActions ? [...cells, rowActions(row)] : cells;
  });
  const rowIds = rows.map((row, rowIndex) => getRowId?.(row, rowIndex) ?? rowIndex);

  return (
    <Stack spacing={0.75}>
      {toolbar ? <Box>{toolbar}</Box> : null}
      {filterSlot ? <Box>{filterSlot}</Box> : null}
      <CompactDataTable
        columns={tableColumns}
        rows={tableRows}
        rowIds={rowIds}
        emptyLabel={emptyLabel}
        ariaLabel={emptyLabel ? `${emptyLabel} table` : 'CRM data table'}
        loading={loading}
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        bulkActions={bulkActions}
        pageLabel={pagination?.label}
        onPreviousPage={pagination?.onPreviousPage}
        onNextPage={pagination?.onNextPage}
        previousDisabled={pagination?.previousDisabled}
        nextDisabled={pagination?.nextDisabled}
        onPrimaryCellClick={onPrimaryRowClick ? (rowIndex) => onPrimaryRowClick(rows[rowIndex], rowIndex) : undefined}
      />
    </Stack>
  );
}
