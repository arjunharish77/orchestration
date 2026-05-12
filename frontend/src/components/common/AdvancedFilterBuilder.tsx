'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Button, FormControl, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { FieldOption, normalizeFilterOperator, operatorsForFieldType } from '../../lib/field-metadata';

export type AdvancedFilterCondition = {
  field: string;
  operator: string;
  value: string;
};

export function AdvancedFilterBuilder({
  fields,
  fieldByKey,
  match,
  onMatchChange,
  conditions,
  onConditionsChange,
  defaultField = fields[0]?.key ?? '',
  renderValue
}: {
  fields: FieldOption[];
  fieldByKey: Map<string, FieldOption>;
  match: 'all' | 'any';
  onMatchChange: (value: 'all' | 'any') => void;
  conditions: AdvancedFilterCondition[];
  onConditionsChange: Dispatch<SetStateAction<AdvancedFilterCondition[]>>;
  defaultField?: string;
  renderValue?: (condition: AdvancedFilterCondition, index: number) => ReactNode;
}) {
  const updateCondition = (index: number, patch: Partial<AdvancedFilterCondition>) => {
    onConditionsChange((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const renderDefaultValue = (condition: AdvancedFilterCondition, index: number) => {
    const field = fieldByKey.get(condition.field);
    const options = field?.options ?? [];
    const disabled = ['exists', 'not_exists'].includes(condition.operator);
    const inputType = field?.fieldType === 'date' || field?.fieldType === 'datetime'
      ? 'date'
      : field?.fieldType === 'number'
        ? 'number'
        : 'text';

    if (options.length > 0 || field?.fieldType === 'boolean') {
      const nextOptions = field?.fieldType === 'boolean' ? ['true', 'false'] : options;
      return (
        <FormControl size="small">
          <Select disabled={disabled} displayEmpty value={condition.value} onChange={(event) => updateCondition(index, { value: event.target.value })}>
            <MenuItem value="">Select value</MenuItem>
            {nextOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </Select>
        </FormControl>
      );
    }

    return (
      <TextField
        size="small"
        type={inputType}
        label="Value"
        disabled={disabled}
        value={condition.value}
        onChange={(event) => updateCondition(index, { value: event.target.value })}
        InputLabelProps={field?.fieldType === 'date' || field?.fieldType === 'datetime' ? { shrink: true } : undefined}
      />
    );
  };

  return (
    <Stack spacing={0.75}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography fontWeight={850}>Advanced conditions</Typography>
          <FormControl size="small" sx={{ minWidth: 142 }}>
            <Select value={match} onChange={(event) => onMatchChange(event.target.value as 'all' | 'any')}>
              <MenuItem value="all">Match all</MenuItem>
              <MenuItem value="any">Match any</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onConditionsChange((current) => [...current, { field: defaultField, operator: normalizeFilterOperator(fieldByKey.get(defaultField)?.fieldType, 'equals'), value: '' }])} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>Add condition</Button>
      </Stack>
      {conditions.map((condition, index) => (
        <Box key={`${condition.field}-${index}`} sx={{ display: 'grid', gap: 0.65, gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 1.1fr) minmax(150px, 0.9fr) minmax(180px, 1.2fr) 40px' }, alignItems: 'center' }}>
          <FormControl size="small">
            <Select value={condition.field} onChange={(event) => {
              const nextField = fieldByKey.get(event.target.value);
              updateCondition(index, {
                field: event.target.value,
                operator: normalizeFilterOperator(nextField?.fieldType, condition.operator),
                value: ''
              });
            }}>
              {fields.map((field) => <MenuItem key={field.key} value={field.key}>{field.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select value={condition.operator} onChange={(event) => updateCondition(index, { operator: event.target.value, value: ['exists', 'not_exists'].includes(event.target.value) ? '' : condition.value })}>
              {operatorsForFieldType(fieldByKey.get(condition.field)?.fieldType).map((operator) => <MenuItem key={operator.value} value={operator.value}>{operator.label}</MenuItem>)}
            </Select>
          </FormControl>
          {renderValue?.(condition, index) ?? renderDefaultValue(condition, index)}
          <Tooltip title={conditions.length === 1 ? 'At least one condition is kept' : 'Remove condition'}>
            <span>
              <IconButton size="small" disabled={conditions.length === 1} onClick={() => onConditionsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))} sx={{ borderRadius: 1 }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ))}
    </Stack>
  );
}
