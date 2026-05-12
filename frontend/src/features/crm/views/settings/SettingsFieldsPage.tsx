'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Checkbox, FormControl, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section, SegmentedTabs } from '../../../../components/common/WorkspacePrimitives';
import { AccessRole, AccessTeam, ActivityTypeConfig, CsvUploadConfig, CustomFieldDefinition, CustomFieldModule, DispositionFieldForm, DispositionFormField, FieldForm, MandatoryRule, MandatoryRuleForm } from './settings-types';

export function SettingsFieldsPage({
  fieldModule,
  setFieldModule,
  customFieldModules,
  customFieldTypes,
  labelForModule,
  labelForFieldType,
  fieldForm,
  setFieldForm,
  savingField,
  createCustomField,
  customFields,
  updateCustomField,
  dispositionFieldForm,
  setDispositionFieldForm,
  addDispositionField,
  updateDispositionField,
  dispositionFormFields,
  deactivateDispositionField,
  mandatoryRuleForm,
  setMandatoryRuleForm,
  mandatoryRules,
  roles,
  teams,
  createMandatoryRule,
  updateMandatoryRule,
  deactivateMandatoryRule,
  csvUploadConfig,
  setCsvUploadConfig,
  saveCsvUploadConfig,
  activityTypes
}: {
  fieldModule: CustomFieldModule;
  setFieldModule: (moduleName: CustomFieldModule) => void;
  customFieldModules: CustomFieldModule[];
  customFieldTypes: Array<CustomFieldDefinition['fieldType']>;
  labelForModule: (value?: string | null) => string;
  labelForFieldType: (value?: string | null) => string;
  fieldForm: FieldForm;
  setFieldForm: (form: FieldForm) => void;
  savingField: boolean;
  createCustomField: () => void;
  customFields: CustomFieldDefinition[];
  updateCustomField: (field: CustomFieldDefinition, patch: Partial<CustomFieldDefinition>) => void;
  dispositionFieldForm: DispositionFieldForm;
  setDispositionFieldForm: (form: DispositionFieldForm) => void;
  addDispositionField: () => void;
  updateDispositionField: (fieldKey: string) => void;
  dispositionFormFields: DispositionFormField[];
  deactivateDispositionField: (fieldKey: string) => void;
  mandatoryRuleForm: MandatoryRuleForm;
  setMandatoryRuleForm: (form: MandatoryRuleForm) => void;
  mandatoryRules: MandatoryRule[];
  roles: AccessRole[];
  teams: AccessTeam[];
  createMandatoryRule: () => void;
  updateMandatoryRule: (ruleId: string) => void;
  deactivateMandatoryRule: (ruleId: string) => void;
  csvUploadConfig: CsvUploadConfig;
  setCsvUploadConfig: (config: CsvUploadConfig) => void;
  saveCsvUploadConfig: () => void;
  activityTypes: ActivityTypeConfig[];
}) {
  const [activeSection, setActiveSection] = useState<'custom-fields' | 'disposition-fields' | 'mandatory-rules' | 'csv-upload'>('custom-fields');
  const [customFieldDialogOpen, setCustomFieldDialogOpen] = useState(false);
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [editingCustomField, setEditingCustomField] = useState<CustomFieldDefinition | null>(null);
  const [editingDispositionKey, setEditingDispositionKey] = useState<string | null>(null);
  const [mandatoryDialogOpen, setMandatoryDialogOpen] = useState(false);
  const [editingMandatoryRuleId, setEditingMandatoryRuleId] = useState<string | null>(null);

  const activityTypeOptions = [
    { code: 'ALL', label: 'All Activity Types' },
    ...activityTypes.map((type) => ({ code: type.code, label: `${type.code} - ${type.label}` }))
  ];
  const labelForActivityType = (code?: string | null) => activityTypeOptions.find((type) => type.code === (code || 'ALL'))?.label ?? (code || 'All Activity Types');

  const resetCustomFieldForm = () => setFieldForm({ activityTypeCode: fieldModule === 'Activity' ? 'ALL' : '', label: '', fieldKey: '', fieldType: 'text', isRequired: false, displayOrder: '10', defaultValue: '', options: '', validation: '' });

  const openCreateCustomField = () => {
    setEditingCustomField(null);
    resetCustomFieldForm();
    setCustomFieldDialogOpen(true);
  };

  const openEditCustomField = (field: CustomFieldDefinition) => {
    setEditingCustomField(field);
    setFieldForm({
      label: field.label,
      activityTypeCode: field.moduleName === 'Activity' ? field.activityTypeCode ?? 'ALL' : '',
      fieldKey: field.fieldKey,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      displayOrder: String(field.displayOrder ?? 0),
      defaultValue: field.defaultValue === undefined || field.defaultValue === null ? '' : typeof field.defaultValue === 'string' ? field.defaultValue : JSON.stringify(field.defaultValue),
      options: Array.isArray(field.options) ? field.options.map(String).join(', ') : '',
      validation: field.validation ? JSON.stringify(field.validation, null, 2) : ''
    });
    setCustomFieldDialogOpen(true);
  };

  const parseFieldPatch = () => ({
    label: fieldForm.label,
    ...(fieldModule === 'Activity' ? { activityTypeCode: fieldForm.activityTypeCode || 'ALL' } : {}),
    fieldType: fieldForm.fieldType,
    isRequired: fieldForm.isRequired,
    displayOrder: Number(fieldForm.displayOrder || 0),
    defaultValue: fieldForm.defaultValue.trim() ? fieldForm.defaultValue : undefined,
    options: fieldForm.options.trim() ? fieldForm.options.split(',').map((entry) => entry.trim()).filter(Boolean) : [],
    validation: fieldForm.validation.trim() ? JSON.parse(fieldForm.validation) : undefined
  });

  const handleCreateCustomField = async () => {
    if (editingCustomField) {
      await Promise.resolve(updateCustomField(editingCustomField, parseFieldPatch()));
    } else {
      await Promise.resolve(createCustomField());
    }
    setCustomFieldDialogOpen(false);
    setEditingCustomField(null);
  };

  const handleAddDispositionField = async () => {
    if (editingDispositionKey) {
      await Promise.resolve(updateDispositionField(editingDispositionKey));
    } else {
      await Promise.resolve(addDispositionField());
    }
    setDispositionDialogOpen(false);
    setEditingDispositionKey(null);
  };

  const openCreateDispositionField = () => {
    setEditingDispositionKey(null);
    setDispositionFieldForm({ fieldKey: '', label: '', fieldType: 'text', isRequired: false, options: '' });
    setDispositionDialogOpen(true);
  };

  const openEditDispositionField = (field: DispositionFormField) => {
    setEditingDispositionKey(field.fieldKey);
    setDispositionFieldForm({
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      isRequired: Boolean(field.isRequired),
      options: Array.isArray(field.options) ? field.options.join(', ') : ''
    });
    setDispositionDialogOpen(true);
  };

  const standardFieldsByModule: Record<CustomFieldModule, Array<{ key: string; label: string }>> = {
    Lead: [
      { key: 'customerName', label: 'Customer Name' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'externalLeadId', label: 'Loan ID / Lead ID' },
      { key: 'status', label: 'Lead Status' },
      { key: 'category', label: 'Lead Category' },
      { key: 'disposition', label: 'Lead Disposition' },
      { key: 'branchCode', label: 'Branch Code' },
      { key: 'branchName', label: 'Branch Name' },
      { key: 'offerAmount', label: 'Loan Offer Amount' },
      { key: 'emiAmount', label: 'EMI Amount' },
      { key: 'preferredLanguage', label: 'Preferred Language' }
    ],
    User: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'roleId', label: 'Role' },
      { key: 'teamId', label: 'Team' }
    ],
    Activity: [
      { key: 'type', label: 'Activity Type' },
      { key: 'title', label: 'Title' },
      { key: 'disposition', label: 'Disposition' },
      { key: 'notes', label: 'Notes' }
    ]
  };
  const fieldOptionsForRule = [
    ...standardFieldsByModule[mandatoryRuleForm.moduleName],
    ...customFields
      .filter((field) => field.moduleName === mandatoryRuleForm.moduleName)
      .map((field) => ({ key: field.fieldKey, label: field.label }))
  ];
  const csvUploadColumns = [
    { key: 'customer_name', label: 'Customer name' },
    { key: 'mobile_number', label: 'Mobile number' },
    { key: 'loan_id', label: 'Loan ID / Lead ID' },
    { key: 'branch_code', label: 'Branch code' },
    { key: 'branch_name', label: 'Branch name' },
    { key: 'loan_offer_amount', label: 'Loan offer amount' },
    { key: 'emi_amount', label: 'EMI amount' },
    { key: 'upload_date', label: 'Upload date' },
    { key: 'offer_expiry_date', label: 'Loan closure / offer expiry date' },
    { key: 'customer_location', label: 'Customer location' },
    { key: 'preferred_language', label: 'Preferred language' },
    { key: 'partner_mapping', label: 'Partner mapping' }
  ];
  const csvMappingTargets = [
    ...csvUploadColumns,
    ...customFields
      .filter((field) => field.moduleName === 'Lead' && field.isActive !== false)
      .map((field) => ({ key: `custom:${field.fieldKey}`, label: `Custom: ${field.label}` }))
  ];
  const duplicateFieldOptions = [
    { key: 'mobile', label: 'Mobile' },
    { key: 'externalLeadId', label: 'Loan ID / Lead ID' },
    { key: 'customerName', label: 'Customer name' },
    { key: 'branchCode', label: 'Branch code' },
    { key: 'branchName', label: 'Branch name' },
    ...customFields
      .filter((field) => field.moduleName === 'Lead')
      .map((field) => ({ key: `custom:${field.fieldKey}`, label: `Custom: ${field.label}` }))
  ];
  const toggleCsvValue = (key: 'requiredColumns' | 'duplicateKeyFields', value: string) => {
    const current = csvUploadConfig[key] ?? [];
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    setCsvUploadConfig({ ...csvUploadConfig, [key]: next });
  };
  const setCsvDefaultMapping = (target: string, sourceHeader: string) => {
    const nextMapping = { ...(csvUploadConfig.defaultMapping ?? {}) };
    const trimmed = sourceHeader.trim();
    if (trimmed) {
      nextMapping[target] = trimmed;
    } else {
      delete nextMapping[target];
    }
    setCsvUploadConfig({ ...csvUploadConfig, defaultMapping: nextMapping });
  };

  const openCreateMandatoryRule = () => {
    setEditingMandatoryRuleId(null);
    setMandatoryRuleForm({ moduleName: fieldModule, fieldKey: '', roleId: '', teamId: '', context: '', isRequired: true, isActive: true });
    setMandatoryDialogOpen(true);
  };

  const openEditMandatoryRule = (rule: MandatoryRule) => {
    setEditingMandatoryRuleId(rule.id);
    setMandatoryRuleForm({
      moduleName: rule.moduleName,
      fieldKey: rule.fieldKey,
      roleId: rule.roleId ?? '',
      teamId: rule.teamId ?? '',
      context: rule.context ?? '',
      isRequired: rule.isRequired,
      isActive: rule.isActive
    });
    setMandatoryDialogOpen(true);
  };

  const handleSaveMandatoryRule = async () => {
    if (editingMandatoryRuleId) {
      await Promise.resolve(updateMandatoryRule(editingMandatoryRuleId));
    } else {
      await Promise.resolve(createMandatoryRule());
    }
    setMandatoryDialogOpen(false);
    setEditingMandatoryRuleId(null);
  };

  return (
    <>
      <SegmentedTabs
        value={activeSection}
        onChange={(value) => {
          const nextSection = value as typeof activeSection;
          if (nextSection === 'csv-upload') setFieldModule('Lead');
          setActiveSection(nextSection);
        }}
        tabs={[
          { value: 'custom-fields', label: 'Custom Fields' },
          { value: 'disposition-fields', label: 'Disposition Form' },
          { value: 'mandatory-rules', label: 'Mandatory Rules' },
          { value: 'csv-upload', label: 'CSV Upload' }
        ]}
      />
      {activeSection === 'custom-fields' ? (
        <Section
          title="Custom Fields"
          defaultExpanded={false}
          actions={
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateCustomField} sx={{ borderRadius: 1 }}>Add Field</Button>
          }
        >
          <Stack spacing={1} sx={{ p: 1 }}>
            <SegmentedTabs
              value={fieldModule}
              onChange={(value) => setFieldModule(value as CustomFieldModule)}
              tabs={customFieldModules.map((moduleName) => ({ value: moduleName, label: labelForModule(moduleName) }))}
            />
            <CompactDataTable
              columns={fieldModule === 'Activity' ? ['Activity Type', 'Label', 'Internal Key', 'Type', 'Required', 'Order', 'Active', 'Action'] : ['Label', 'Internal Key', 'Type', 'Required', 'Order', 'Active', 'Action']}
              rows={customFields.map((field) => [
                ...(fieldModule === 'Activity' ? [labelForActivityType(field.activityTypeCode)] : []),
                field.label,
                field.fieldKey,
                labelForFieldType(field.fieldType),
                field.isRequired ? 'Yes' : 'No',
                <TextField key={`${field.id}-order`} size="small" defaultValue={field.displayOrder} type="number" onBlur={(event) => updateCustomField(field, { displayOrder: Number(event.target.value || 0) })} sx={{ width: 86 }} />,
                <Stack key={`${field.id}-active`} direction="row" spacing={0.5} alignItems="center">
                  <Checkbox size="small" checked={field.isActive} onChange={(event) => updateCustomField(field, { isActive: event.target.checked })} />
                  <Typography fontSize={12}>{field.isActive ? 'Active' : 'Inactive'}</Typography>
                </Stack>,
                <RowActionMenu
                  key={`${field.id}-actions`}
                  actions={[
                    { label: 'Edit field', icon: <EditIcon fontSize="small" />, onClick: () => openEditCustomField(field) }
                  ]}
                />
              ])}
            />
          </Stack>
        </Section>
      ) : null}
      {activeSection === 'disposition-fields' ? (
        <Section title="Disposition Form Fields" defaultExpanded={false} actions={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateDispositionField} sx={{ borderRadius: 1 }}>Add Field</Button>}>
          <Stack spacing={1} sx={{ p: 1 }}>
            <CompactDataTable
              columns={['Label', 'Internal Key', 'Type', 'Required', 'Active', 'Action']}
              rows={dispositionFormFields.map((field) => [
                field.label,
                field.fieldKey,
                labelForFieldType(field.fieldType),
                field.isRequired ? 'Yes' : 'No',
                <AppChip key={`${field.fieldKey}-status`} label={field.isActive === false ? 'Inactive' : 'Active'} />,
                <RowActionMenu
                  key={`${field.fieldKey}-actions`}
                  actions={[
                    { label: 'Edit field', icon: <EditIcon fontSize="small" />, onClick: () => openEditDispositionField(field) },
                    { label: field.isActive === false ? 'Already inactive' : 'Deactivate field', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', disabled: field.isActive === false, onClick: () => deactivateDispositionField(field.fieldKey) }
                  ]}
                />
              ])}
            />
          </Stack>
        </Section>
      ) : null}
      {activeSection === 'mandatory-rules' ? (
        <Section title="Mandatory Field Rules" defaultExpanded={false} actions={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateMandatoryRule} sx={{ borderRadius: 1 }}>Add Rule</Button>}>
        <Stack spacing={1} sx={{ p: 1 }}>
          <CompactDataTable
            columns={['Module', 'Field', 'Role', 'Team', 'Context', 'Required', 'Status', 'Action']}
            rows={mandatoryRules.map((rule) => [
              labelForModule(rule.moduleName),
              fieldOptionsForRule.find((field) => field.key === rule.fieldKey)?.label ?? rule.fieldKey,
              roles.find((role) => role.id === rule.roleId)?.name ?? 'All roles',
              teams.find((team) => team.id === rule.teamId)?.name ?? 'All teams',
              rule.context || 'All contexts',
              rule.isRequired ? 'Yes' : 'No',
              <AppChip key={`${rule.id}-status`} label={rule.isActive ? 'Active' : 'Inactive'} />,
              <RowActionMenu
                key={`${rule.id}-actions`}
                actions={[
                  { label: 'Edit rule', icon: <EditIcon fontSize="small" />, onClick: () => openEditMandatoryRule(rule) },
                  { label: rule.isActive ? 'Deactivate rule' : 'Already inactive', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', disabled: !rule.isActive, onClick: () => deactivateMandatoryRule(rule.id) }
                ]}
              />
            ])}
          />
        </Stack>
        </Section>
      ) : null}
      {activeSection === 'csv-upload' ? (
        <Section title="CSV Upload Configuration" defaultExpanded={false} actions={<Button size="small" variant="contained" onClick={saveCsvUploadConfig} sx={{ borderRadius: 1 }}>Save CSV Rules</Button>}>
          <Stack spacing={1.5} sx={{ p: 1 }}>
            <Box>
              <Typography fontWeight={800} fontSize={13}>Required upload fields</Typography>
              <Typography color="text.secondary" fontSize={12}>Uploads are blocked when any selected field is not mapped or is blank in a row.</Typography>
              <Box sx={{ mt: 0.75, display: 'grid', gap: 0.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
                {csvUploadColumns.map((field) => (
                  <Stack key={field.key} direction="row" spacing={0.5} alignItems="center">
                    <Checkbox size="small" checked={(csvUploadConfig.requiredColumns ?? []).includes(field.key)} onChange={() => toggleCsvValue('requiredColumns', field.key)} />
                    <Typography fontSize={12}>{field.label}</Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={13}>Duplicate key</Typography>
              <Typography color="text.secondary" fontSize={12}>All selected fields are combined as one duplicate key. Blank duplicate-key values fail import and manual lead creation.</Typography>
              <Box sx={{ mt: 0.75, display: 'grid', gap: 0.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
                {duplicateFieldOptions.map((field) => (
                  <Stack key={field.key} direction="row" spacing={0.5} alignItems="center">
                    <Checkbox size="small" checked={(csvUploadConfig.duplicateKeyFields ?? []).includes(field.key)} onChange={() => toggleCsvValue('duplicateKeyFields', field.key)} />
                    <Typography fontSize={12}>{field.label}</Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={13}>Default header mapping</Typography>
              <Typography color="text.secondary" fontSize={12}>These header names are used as reusable defaults when a CSV is selected. Users can still adjust mapping per upload batch.</Typography>
              <CompactDataTable
                columns={['Target field', 'Default CSV header']}
                rows={csvMappingTargets.map((field) => [
                  field.label,
                  <TextField
                    key={`${field.key}-default-mapping`}
                    size="small"
                    placeholder="CSV header name"
                    value={(csvUploadConfig.defaultMapping ?? {})[field.key] ?? ''}
                    onChange={(event) => setCsvDefaultMapping(field.key, event.target.value)}
                    sx={{ minWidth: 260 }}
                  />
                ])}
                emptyLabel="No upload fields available"
              />
            </Box>
          </Stack>
        </Section>
      ) : null}
      <FormDialog
        open={customFieldDialogOpen}
        title={`${editingCustomField ? 'Edit' : 'Create'} ${labelForModule(fieldModule)} Custom Field`}
        subtitle="Custom fields become available in list columns, filters, assignment rules, and forms."
        onClose={() => setCustomFieldDialogOpen(false)}
        maxWidth="md"
        actions={(
          <>
            <Button variant="text" onClick={() => setCustomFieldDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={savingField || !fieldForm.label || !fieldForm.fieldKey} onClick={handleCreateCustomField}>{editingCustomField ? 'Save Field' : 'Create Field'}</Button>
          </>
        )}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {fieldModule === 'Activity' ? (
            <FormControl size="small">
              <Select value={fieldForm.activityTypeCode || 'ALL'} onChange={(event) => setFieldForm({ ...fieldForm, activityTypeCode: event.target.value })}>
                {activityTypeOptions.map((type) => <MenuItem key={type.code} value={type.code}>{type.label}</MenuItem>)}
              </Select>
            </FormControl>
          ) : null}
          <TextField size="small" label="Label" value={fieldForm.label} onChange={(event) => setFieldForm({ ...fieldForm, label: event.target.value })} />
          <TextField size="small" label="Internal key" disabled={Boolean(editingCustomField)} value={fieldForm.fieldKey} onChange={(event) => setFieldForm({ ...fieldForm, fieldKey: event.target.value })} />
          <FormControl size="small">
            <Select value={fieldForm.fieldType} onChange={(event) => setFieldForm({ ...fieldForm, fieldType: event.target.value as CustomFieldDefinition['fieldType'] })}>
              {customFieldTypes.map((fieldType) => <MenuItem key={fieldType} value={fieldType}>{labelForFieldType(fieldType)}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Order" value={fieldForm.displayOrder} onChange={(event) => setFieldForm({ ...fieldForm, displayOrder: event.target.value })} />
          <TextField size="small" label="Default value" value={fieldForm.defaultValue} onChange={(event) => setFieldForm({ ...fieldForm, defaultValue: event.target.value })} />
          <TextField size="small" label="Options, comma separated" value={fieldForm.options} onChange={(event) => setFieldForm({ ...fieldForm, options: event.target.value })} />
          <TextField size="small" label="Validation JSON" placeholder='{"minLength":3}' value={fieldForm.validation} onChange={(event) => setFieldForm({ ...fieldForm, validation: event.target.value })} />
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Checkbox size="small" checked={fieldForm.isRequired} onChange={(event) => setFieldForm({ ...fieldForm, isRequired: event.target.checked })} />
            <Typography fontSize={12}>Mandatory</Typography>
          </Stack>
        </Box>
      </FormDialog>
      <FormDialog
        open={dispositionDialogOpen}
        title={`${editingDispositionKey ? 'Edit' : 'Create'} Disposition Form Field`}
        subtitle="These fields appear in the lead disposition form and can collect callback or follow-up details."
        onClose={() => setDispositionDialogOpen(false)}
        maxWidth="md"
        actions={(
          <>
            <Button variant="text" onClick={() => setDispositionDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={savingField || !dispositionFieldForm.fieldKey || !dispositionFieldForm.label} onClick={handleAddDispositionField}>{editingDispositionKey ? 'Save Field' : 'Create Field'}</Button>
          </>
        )}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField size="small" label="Internal key" disabled={Boolean(editingDispositionKey)} value={dispositionFieldForm.fieldKey} onChange={(event) => setDispositionFieldForm({ ...dispositionFieldForm, fieldKey: event.target.value })} />
          <TextField size="small" label="Label" value={dispositionFieldForm.label} onChange={(event) => setDispositionFieldForm({ ...dispositionFieldForm, label: event.target.value })} />
          <FormControl size="small">
            <Select value={dispositionFieldForm.fieldType} onChange={(event) => setDispositionFieldForm({ ...dispositionFieldForm, fieldType: event.target.value })}>
              {['text', 'datetime', 'date', 'select', 'number'].map((fieldType) => <MenuItem key={fieldType} value={fieldType}>{labelForFieldType(fieldType)}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Options" value={dispositionFieldForm.options} onChange={(event) => setDispositionFieldForm({ ...dispositionFieldForm, options: event.target.value })} />
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Checkbox size="small" checked={dispositionFieldForm.isRequired} onChange={(event) => setDispositionFieldForm({ ...dispositionFieldForm, isRequired: event.target.checked })} />
            <Typography fontSize={12}>Required</Typography>
          </Stack>
        </Box>
      </FormDialog>
      <FormDialog
        open={mandatoryDialogOpen}
        title={`${editingMandatoryRuleId ? 'Edit' : 'Create'} Mandatory Field Rule`}
        subtitle="Rules let admins make standard or custom fields mandatory by module, role, team, or context."
        onClose={() => setMandatoryDialogOpen(false)}
        maxWidth="md"
        actions={(
          <>
            <Button variant="text" onClick={() => setMandatoryDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={savingField || !mandatoryRuleForm.fieldKey} onClick={handleSaveMandatoryRule}>{editingMandatoryRuleId ? 'Save Rule' : 'Create Rule'}</Button>
          </>
        )}
      >
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <FormControl size="small">
            <Select
              value={mandatoryRuleForm.moduleName}
              onChange={(event) => {
                const moduleName = event.target.value as CustomFieldModule;
                setFieldModule(moduleName);
                setMandatoryRuleForm({ ...mandatoryRuleForm, moduleName, fieldKey: '' });
              }}
            >
              {customFieldModules.map((moduleName) => <MenuItem key={moduleName} value={moduleName}>{labelForModule(moduleName)}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={mandatoryRuleForm.fieldKey} onChange={(event) => setMandatoryRuleForm({ ...mandatoryRuleForm, fieldKey: event.target.value })}>
              <MenuItem value="">Field</MenuItem>
              {fieldOptionsForRule.map((field) => <MenuItem key={field.key} value={field.key}>{field.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={mandatoryRuleForm.roleId} onChange={(event) => setMandatoryRuleForm({ ...mandatoryRuleForm, roleId: event.target.value })}>
              <MenuItem value="">All roles</MenuItem>
              {roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select displayEmpty value={mandatoryRuleForm.teamId} onChange={(event) => setMandatoryRuleForm({ ...mandatoryRuleForm, teamId: event.target.value })}>
              <MenuItem value="">All teams</MenuItem>
              {teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Context" placeholder="lead_create, disposition, csv_upload" value={mandatoryRuleForm.context} onChange={(event) => setMandatoryRuleForm({ ...mandatoryRuleForm, context: event.target.value })} />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Checkbox size="small" checked={mandatoryRuleForm.isRequired} onChange={(event) => setMandatoryRuleForm({ ...mandatoryRuleForm, isRequired: event.target.checked })} />
            <Typography fontSize={12}>Required</Typography>
            <Checkbox size="small" checked={mandatoryRuleForm.isActive} onChange={(event) => setMandatoryRuleForm({ ...mandatoryRuleForm, isActive: event.target.checked })} />
            <Typography fontSize={12}>Active</Typography>
          </Stack>
        </Box>
      </FormDialog>
    </>
  );
}
