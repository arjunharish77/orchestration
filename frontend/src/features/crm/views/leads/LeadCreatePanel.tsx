'use client';

import { Button, Checkbox, FormControl, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { FormDrawer } from '../../../../components/common/WorkspacePrimitives';
import { LeadRow } from '../../types/lead';

export function LeadCreatePanel({
  open,
  onClose,
  editLeadId,
  leadRows,
  leadForm,
  setLeadForm,
  leadLists,
  leadDefinitions,
  leadCustomValues,
  setLeadCustomValues,
  customFieldOptions,
  leadFieldAccess,
  loadLeadForEdit,
  savingLead,
  createLead,
  editLead
}: {
  open: boolean;
  onClose: () => void;
  editLeadId: string;
  leadRows: LeadRow[];
  leadForm: any;
  setLeadForm: (value: any) => void;
  leadLists: { status: string[]; category: string[] };
  leadDefinitions: any[];
  leadCustomValues: Record<string, unknown>;
  setLeadCustomValues: (value: Record<string, unknown>) => void;
  customFieldOptions: (field: any) => string[];
  leadFieldAccess: (fieldKey: string) => string;
  loadLeadForEdit: (lead: LeadRow) => void;
  savingLead: boolean;
  createLead: () => void;
  editLead: () => void;
}) {
  const canShowField = (fieldKey: string) => leadFieldAccess(fieldKey) !== 'hidden';
  const canEditField = (fieldKey: string) => leadFieldAccess(fieldKey) === 'editable';
  const requiresCustomerName = canShowField('customerName') && canEditField('customerName');
  const requiresMobile = canShowField('mobile') && canEditField('mobile');
  const saveDisabled = savingLead
    || (requiresCustomerName && !leadForm.customerName)
    || (requiresMobile && !leadForm.mobile);

  return (
    <FormDrawer
      open={open}
      title={editLeadId ? 'Edit Lead' : 'Add Lead'}
      onClose={onClose}
      actions={
        <>
          <Button variant="outlined" size="small" onClick={onClose}>Cancel</Button>
          <Button variant="contained" size="small" disabled={saveDisabled} onClick={editLeadId ? editLead : createLead}>{editLeadId ? 'Update Lead' : 'Create Lead'}</Button>
        </>
      }
    >
      <Stack spacing={1}>
        <FormControl size="small">
          <Select displayEmpty value={editLeadId} onChange={(event) => { const next = leadRows.find((lead) => (lead.dbId ?? lead.id) === event.target.value); if (next) loadLeadForEdit(next); }}>
            <MenuItem value="">Create new lead</MenuItem>
            {leadRows.map((lead) => <MenuItem key={lead.dbId ?? lead.id} value={lead.dbId ?? lead.id}>{lead.name}</MenuItem>)}
          </Select>
        </FormControl>
        {canShowField('customerName') && <TextField size="small" label="Customer name" value={leadForm.customerName} disabled={!canEditField('customerName')} onChange={(event) => setLeadForm({ ...leadForm, customerName: event.target.value })} />}
        {canShowField('mobile') && <TextField size="small" label="10-digit mobile" value={leadForm.mobile} disabled={!canEditField('mobile')} onChange={(event) => setLeadForm({ ...leadForm, mobile: event.target.value })} />}
        {canShowField('email') && <TextField size="small" label="Email" value={leadForm.email} disabled={!canEditField('email')} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} />}
        {canShowField('status') && (
          <FormControl size="small" disabled={!canEditField('status')}>
            <Select displayEmpty value={leadForm.status} onChange={(event) => setLeadForm({ ...leadForm, status: event.target.value })}>
              <MenuItem value="">Lead status</MenuItem>
              {leadLists.status.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {canShowField('category') && (
          <FormControl size="small" disabled={!canEditField('category')}>
            <Select displayEmpty value={leadForm.category} onChange={(event) => setLeadForm({ ...leadForm, category: event.target.value })}>
              <MenuItem value="">Lead category</MenuItem>
              {leadLists.category.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {leadDefinitions.map((field) => {
          const options = customFieldOptions(field);
          const fieldAccess = leadFieldAccess(field.fieldKey);
          if (fieldAccess === 'hidden') return null;
          const disabled = fieldAccess !== 'editable';
          if (field.fieldType === 'boolean') {
            return (
              <Stack key={field.id} direction="row" alignItems="center" spacing={0.5}>
                <Checkbox size="small" disabled={disabled} checked={Boolean(leadCustomValues[field.fieldKey])} onChange={(event) => setLeadCustomValues({ ...leadCustomValues, [field.fieldKey]: event.target.checked })} />
                <Typography fontSize={12}>{field.label}{field.isRequired ? ' *' : ''}</Typography>
              </Stack>
            );
          }
          if (options.length > 0 && field.fieldType === 'select') {
            return (
              <FormControl key={field.id} size="small">
                <Select displayEmpty disabled={disabled} value={String(leadCustomValues[field.fieldKey] ?? '')} onChange={(event) => setLeadCustomValues({ ...leadCustomValues, [field.fieldKey]: event.target.value })}>
                  <MenuItem value="">{field.label}{field.isRequired ? ' *' : ''}</MenuItem>
                  {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </Select>
              </FormControl>
            );
          }
          return (
            <TextField key={field.id} size="small" disabled={disabled} label={`${field.label}${field.isRequired ? ' *' : ''}`} value={String(leadCustomValues[field.fieldKey] ?? '')} onChange={(event) => setLeadCustomValues({ ...leadCustomValues, [field.fieldKey]: event.target.value })} />
          );
        })}
      </Stack>
    </FormDrawer>
  );
}
