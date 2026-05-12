'use client';

import { Box, Typography } from '@mui/material';
import { AdvancedFilterBuilder } from '../../../../components/common/AdvancedFilterBuilder';
import { FilterDialog } from '../../../../components/common/FilterDialog';

export function LeadAdvancedFilters({
  open,
  onClose,
  onApply,
  onReset,
  advancedMatch,
  setAdvancedMatch,
  advancedConditions,
  setAdvancedConditions,
  leadFilterFields,
  fieldByKey,
  renderFilterValue
}: {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  advancedMatch: 'all' | 'any';
  setAdvancedMatch: (value: 'all' | 'any') => void;
  advancedConditions: Array<{ field: string; operator: string; value: string }>;
  setAdvancedConditions: (value: any) => void;
  leadFilterFields: Array<{ key: string; label: string; fieldType?: string }>;
  fieldByKey: Map<string, { key: string; label: string; fieldType?: string }>;
  renderFilterValue: (condition: { field: string; operator: string; value: string }, index: number) => React.ReactNode;
}) {
  return (
    <FilterDialog open={open} title="Lead filters" onApply={onApply} onClose={onClose} onReset={onReset}>
      <Box>
        <Typography color="text.secondary" sx={{ mb: 1, fontSize: 13, fontWeight: 700 }}>
          Add field-level rules. Search, status, branch, category, date, and sort stay in the main filter bar.
        </Typography>
        <AdvancedFilterBuilder
          fields={leadFilterFields}
          fieldByKey={fieldByKey}
          match={advancedMatch}
          onMatchChange={setAdvancedMatch}
          conditions={advancedConditions}
          onConditionsChange={setAdvancedConditions}
          defaultField="status"
          renderValue={renderFilterValue}
        />
      </Box>
    </FilterDialog>
  );
}
