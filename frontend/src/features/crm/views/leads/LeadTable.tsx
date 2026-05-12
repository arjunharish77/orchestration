'use client';

import { ReactNode } from 'react';
import { LeadRows } from '../DashboardView';
import { LeadListMeta } from '../LeadsView';
import { LeadRow } from '../../types/lead';

export function LeadTable({
  leadRows,
  openLead,
  visibleLeadFields,
  leadMeta,
  filterParams,
  onFilter,
  rowActions,
  selectedRows,
  onSelectionChange,
  bulkActions,
  loading = false
}: {
  leadRows: LeadRow[];
  openLead: (lead: LeadRow) => void;
  visibleLeadFields: string[];
  leadMeta: LeadListMeta;
  filterParams: () => Record<string, string>;
  onFilter: (params: Record<string, string>) => void;
  rowActions?: (lead: LeadRow) => ReactNode;
  selectedRows?: number[];
  onSelectionChange?: (rows: number[]) => void;
  bulkActions?: ReactNode;
  loading?: boolean;
}) {
  return (
    <LeadRows
      items={leadRows}
      openLead={openLead}
      fields={visibleLeadFields}
      pageLabel={`${leadMeta.total === 0 ? '0' : `${(leadMeta.page - 1) * leadMeta.pageSize + 1}-${Math.min(leadMeta.page * leadMeta.pageSize, leadMeta.total)}`} of ${leadMeta.total}`}
      onPreviousPage={() => onFilter({ ...filterParams(), page: String(leadMeta.page - 1) })}
      onNextPage={() => onFilter({ ...filterParams(), page: String(leadMeta.page + 1) })}
      previousDisabled={leadMeta.page <= 1}
      nextDisabled={leadMeta.page >= leadMeta.totalPages}
      rowActions={rowActions}
      selectedRows={selectedRows}
      onSelectionChange={onSelectionChange}
      bulkActions={bulkActions}
      loading={loading}
    />
  );
}
