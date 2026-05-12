'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import TuneIcon from '@mui/icons-material/Tune';
import { alpha, Box, Button, FormControl, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { FormDialog } from '../../../../components/common/FormDialog';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { AccessPermissionTemplate } from '../settings/settings-types';

type PermissionTemplateForm = {
  name: string;
  description: string;
};

type ModulePermissionForm = {
  permissionTemplateId: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canAssign: boolean;
  canBulkUpload: boolean;
  canConfigureAutomation: boolean;
  canManageConnector: boolean;
  canViewAuditLogs: boolean;
};

type FieldPermissionForm = {
  permissionTemplateId: string;
  moduleName: 'Lead' | 'User' | 'Activity' | 'ActivityType' | 'ActivityTypeField';
  fieldKey: string;
  access: string;
};

type FieldDefinition = {
  id: string;
  fieldKey: string;
  label: string;
};

type TemplateModuleRow = Partial<Omit<ModulePermissionForm, 'permissionTemplateId'>> & {
  moduleName?: string | null;
};

type TemplateFieldRow = {
  moduleName?: string | null;
  fieldKey?: string | null;
  access?: string | null;
};

const defaultModulePermissions: Omit<ModulePermissionForm, 'permissionTemplateId' | 'moduleName'> = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canExport: false,
  canAssign: false,
  canBulkUpload: false,
  canConfigureAutomation: false,
  canManageConnector: false,
  canViewAuditLogs: false
};

const permissionActions: Array<[keyof ModulePermissionForm, string]> = [
  ['canView', 'View'],
  ['canCreate', 'Create'],
  ['canEdit', 'Edit'],
  ['canDelete', 'Delete'],
  ['canExport', 'Export'],
  ['canAssign', 'Assign'],
  ['canBulkUpload', 'Bulk Upload'],
  ['canConfigureAutomation', 'Configure Automation'],
  ['canManageConnector', 'Manage Connector'],
  ['canViewAuditLogs', 'View Audit Logs']
];

const actionsByModule: Record<string, Array<keyof ModulePermissionForm>> = {
  Dashboard: ['canView'],
  Lead: ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport', 'canAssign'],
  Activity: ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport', 'canViewAuditLogs'],
  Task: ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport'],
  Upload: ['canView', 'canBulkUpload', 'canExport'],
  Automation: ['canView', 'canConfigureAutomation'],
  Report: ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport'],
  Settings: ['canView', 'canCreate', 'canEdit', 'canDelete'],
  User: ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport'],
  Connector: ['canView', 'canManageConnector'],
  Assignment: ['canView', 'canCreate', 'canEdit', 'canDelete'],
  Audit: ['canViewAuditLogs']
};

export function PermissionsTab({
  templateForm,
  setTemplateForm,
  saving,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  permissionTemplates,
  modulePermissionForm,
  setModulePermissionForm,
  moduleOptions,
  labelForModule,
  saveModulePermission,
  saveModulePermissionFor,
  fieldPermissionForm,
  setFieldPermissionForm,
  matchingFieldDefinitions,
  saveFieldPermission,
  saveFieldPermissionFor
}: {
  templateForm: PermissionTemplateForm;
  setTemplateForm: (form: PermissionTemplateForm) => void;
  saving: boolean;
  createTemplate: () => Promise<AccessPermissionTemplate | void> | AccessPermissionTemplate | void;
  updateTemplate: (templateId: string) => Promise<unknown> | unknown;
  deleteTemplate: (templateId: string) => Promise<unknown> | unknown;
  permissionTemplates: AccessPermissionTemplate[];
  modulePermissionForm: ModulePermissionForm;
  setModulePermissionForm: (form: ModulePermissionForm) => void;
  moduleOptions: string[];
  labelForModule: (value?: string | null) => string;
  saveModulePermission: () => void;
  saveModulePermissionFor: (templateId: string, moduleName: string, permissions: Partial<ModulePermissionForm>) => Promise<unknown> | unknown;
  fieldPermissionForm: FieldPermissionForm;
  setFieldPermissionForm: (form: FieldPermissionForm) => void;
  matchingFieldDefinitions: FieldDefinition[];
  saveFieldPermission: () => void;
  saveFieldPermissionFor: (templateId: string, moduleName: FieldPermissionForm['moduleName'], fieldKey: string, access: string) => Promise<unknown> | unknown;
}) {
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<'create' | 'configure'>('create');
  const visibleModuleOptions = moduleOptions;
  const selectedTemplate = templateDialogMode === 'configure'
    ? permissionTemplates.find((template) => template.id === modulePermissionForm.permissionTemplateId) ?? permissionTemplates[0]
    : null;
  const isLockedTemplate = selectedTemplate?.name === 'Administrator Full Access';
  const templateModules = (selectedTemplate?.modules ?? []) as TemplateModuleRow[];
  const templateFields = (selectedTemplate?.fields ?? []) as TemplateFieldRow[];
  const activeModulePermissions = {
    ...defaultModulePermissions,
    ...templateModules.find((moduleRow) => moduleRow.moduleName === modulePermissionForm.moduleName),
    ...modulePermissionForm
  };
  const fieldModulesForActiveModule: Array<FieldPermissionForm['moduleName']> = modulePermissionForm.moduleName === 'Activity'
    ? ['ActivityType', 'ActivityTypeField', 'Activity']
    : modulePermissionForm.moduleName === 'Lead' || modulePermissionForm.moduleName === 'User'
      ? [modulePermissionForm.moduleName]
      : [];
  const shouldShowFields = selectedTemplate && fieldModulesForActiveModule.length > 0;

  const currentFieldAccess = (moduleName: FieldPermissionForm['moduleName'], fieldKey: string) => {
    const access = fieldPermissionForm.moduleName === moduleName && fieldPermissionForm.fieldKey === fieldKey
      ? fieldPermissionForm.access
      : templateFields.find((field) => field.moduleName === moduleName && field.fieldKey === fieldKey)?.access
        ?? (moduleName === 'ActivityType' ? 'hidden' : 'visible');
    return moduleName === 'ActivityType' && access !== 'hidden' ? 'visible' : access;
  };

  const handleModuleSelect = (moduleName: string) => {
    const templateModule = templateModules.find((moduleRow) => moduleRow.moduleName === moduleName);
    setModulePermissionForm({
      ...modulePermissionForm,
      ...defaultModulePermissions,
      ...templateModule,
      permissionTemplateId: selectedTemplate?.id ?? modulePermissionForm.permissionTemplateId,
      moduleName
    });
    if (moduleName === 'Activity') {
      setFieldPermissionForm({ ...fieldPermissionForm, permissionTemplateId: selectedTemplate?.id ?? fieldPermissionForm.permissionTemplateId, moduleName: 'ActivityType', fieldKey: '', access: 'visible' });
    } else if (moduleName === 'Lead' || moduleName === 'User') {
      setFieldPermissionForm({ ...fieldPermissionForm, permissionTemplateId: selectedTemplate?.id ?? fieldPermissionForm.permissionTemplateId, moduleName, fieldKey: '', access: 'editable' });
    }
  };

  const handleActionToggle = async (key: keyof ModulePermissionForm, checked: boolean) => {
    if (!selectedTemplate?.id || isLockedTemplate || key === 'permissionTemplateId' || key === 'moduleName') return;
    const nextForm = { ...activeModulePermissions, permissionTemplateId: selectedTemplate.id, moduleName: modulePermissionForm.moduleName, [key]: checked };
    setModulePermissionForm(nextForm);
    await Promise.resolve(saveModulePermissionFor(selectedTemplate.id, modulePermissionForm.moduleName, nextForm));
  };

  const handleFieldAccess = async (fieldKey: string, access: string) => {
    if (!selectedTemplate?.id || isLockedTemplate) return;
    const next = { ...fieldPermissionForm, permissionTemplateId: selectedTemplate.id, fieldKey, access };
    setFieldPermissionForm(next);
    await Promise.resolve(saveFieldPermissionFor(selectedTemplate.id, next.moduleName, fieldKey, access));
  };

  const handleCreateTemplate = async () => {
    const created = await Promise.resolve(createTemplate());
    if (created?.id) {
      setTemplateDialogMode('configure');
    }
  };

  const handleSaveTemplate = async () => {
    if (isLockedTemplate) {
      setTemplateDialogOpen(false);
      return;
    }
    if (selectedTemplate?.id) {
      await Promise.resolve(updateTemplate(selectedTemplate.id));
      await Promise.resolve(saveModulePermission());
    } else {
      await handleCreateTemplate();
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate?.id) return;
    await Promise.resolve(deleteTemplate(selectedTemplate.id));
    setTemplateDialogOpen(false);
  };

  const openTemplateDialog = (template?: AccessPermissionTemplate) => {
    if (template?.id) {
      setTemplateDialogMode('configure');
      const activeModule = modulePermissionForm.moduleName || 'Lead';
      const templateModule = ((template.modules ?? []) as TemplateModuleRow[]).find((moduleRow) => moduleRow.moduleName === activeModule);
      const nextFieldModule: FieldPermissionForm['moduleName'] = activeModule === 'Activity'
        ? 'ActivityType'
        : activeModule === 'Lead' || activeModule === 'User'
          ? activeModule
          : fieldPermissionForm.moduleName;
      setModulePermissionForm({
        ...modulePermissionForm,
        ...defaultModulePermissions,
        ...templateModule,
        permissionTemplateId: template.id,
        moduleName: activeModule
      });
      setFieldPermissionForm({
        ...fieldPermissionForm,
        permissionTemplateId: template.id,
        moduleName: nextFieldModule,
        fieldKey: '',
        access: nextFieldModule === 'ActivityType' ? 'visible' : 'editable'
      });
      setTemplateForm({ name: template.name ?? '', description: template.description ?? '' });
    } else {
      setTemplateDialogMode('create');
      setTemplateForm({ name: '', description: '' });
    }
    setTemplateDialogOpen(true);
  };

  return (
    <Section
      title="Permission Templates"
      defaultExpanded={false}
      actions={<Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => openTemplateDialog()} sx={{ borderRadius: 1 }}>Create Template</Button>}
    >
      <Stack spacing={1} sx={{ p: 1 }}>
        <Typography color="text.secondary">Templates control module actions and field-level visible, editable, hidden, or masked access.</Typography>
        <CompactDataTable
          columns={['Name', 'Modules', 'Fields', 'System', 'Action']}
          rows={permissionTemplates.map((template) => [
            template.name,
            String(template.modules?.length ?? 0),
            String(template.fields?.length ?? 0),
            template.isSystem ? 'Yes' : 'No',
            <RowActionMenu
              key={`${template.id}-actions`}
              actions={[
                { label: template.name === 'Administrator Full Access' ? 'View template' : 'Configure template', icon: <ShieldIcon fontSize="small" />, onClick: () => openTemplateDialog(template) },
                { label: template.isSystem ? 'System template' : 'Delete template', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', disabled: template.isSystem, onClick: () => deleteTemplate(template.id) }
              ]}
            />
          ])}
        />
      </Stack>
      <FormDialog
        open={templateDialogOpen}
        title={selectedTemplate ? `Configure ${selectedTemplate.name}` : 'Create Permission Template'}
        subtitle="Configure module actions and field access in one place."
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="xl"
        paperSx={{ height: { xs: 'calc(100vh - 28px)', md: 'calc(100vh - 64px)' }, maxHeight: 'none' }}
        contentSx={{ p: 0, overflow: 'hidden' }}
        actions={(
          <>
            <Button variant="text" onClick={() => setTemplateDialogOpen(false)}>{isLockedTemplate ? 'Close' : 'Cancel'}</Button>
            {selectedTemplate && !selectedTemplate.isSystem ? <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleDeleteTemplate}>Delete</Button> : null}
            {!selectedTemplate ? <Button variant="outlined" disabled={saving || !templateForm.name} onClick={handleCreateTemplate}>Create Template</Button> : null}
            {!isLockedTemplate ? <Button variant="contained" disabled={saving || (selectedTemplate ? !modulePermissionForm.permissionTemplateId : !templateForm.name)} onClick={handleSaveTemplate}>Save Template</Button> : null}
          </>
        )}
      >
        <Stack sx={{ height: '100%', minHeight: 0 }}>
          <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 120px' } }}>
              <TextField size="small" label="Template Name" value={templateForm.name} disabled={isLockedTemplate} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
              <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="center">
                <Switch defaultChecked color="primary" disabled={isLockedTemplate} />
                <Typography>Active</Typography>
              </Stack>
              <TextField size="small" label="Description" multiline minRows={2} value={templateForm.description} disabled={isLockedTemplate} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} sx={{ gridColumn: { md: '1 / -1' } }} />
            </Box>
          </Box>
          <Paper variant="outlined" sx={{ m: 1.25, mt: 1, borderRadius: 1, borderColor: '#e0ede0', overflow: 'hidden', bgcolor: '#fafdfa', flex: 1, minHeight: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, height: '100%', minHeight: 0 }}>
              <Box sx={{ borderRight: { md: '1px solid #162716' }, bgcolor: '#eef7ee', p: 1, overflow: 'auto' }}>
                <Typography fontWeight={850} fontSize={11} color="text.secondary" textTransform="uppercase" sx={{ mb: 0.6 }}>Modules & Types</Typography>
                <Stack spacing={0.25}>
                  {visibleModuleOptions.map((moduleName) => {
                    const active = modulePermissionForm.moduleName === moduleName;
                    return (
                      <Button
                        key={moduleName}
                        fullWidth
                        onClick={() => handleModuleSelect(moduleName)}
                        sx={{
                          justifyContent: 'flex-start',
                          borderRadius: 1,
                          px: 1,
                          py: 0.8,
                          color: active ? 'text.primary' : 'text.secondary',
                          bgcolor: active ? '#eef7ee' : 'transparent',
                          '&:hover': { bgcolor: active ? '#d6e7d2' : '#e6efe1' }
                        }}
                      >
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          {moduleName === 'Connector' ? <TuneIcon fontSize="small" /> : <ShieldIcon fontSize="small" />}
                          <Box sx={{ textAlign: 'left' }}>
                            <Typography fontWeight={850}>{labelForModule(moduleName)}</Typography>
                            <Typography fontSize={12} color="text.secondary">{moduleName === 'Activity' ? 'Activity permissions' : `${labelForModule(moduleName)} fields`}</Typography>
                          </Box>
                        </Stack>
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
              <Box sx={{ p: 1.25, overflow: 'auto', minWidth: 0 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography fontWeight={850} fontSize={16}>{labelForModule(modulePermissionForm.moduleName)}</Typography>
                        <Typography color="text.secondary">{labelForModule(modulePermissionForm.moduleName)} permissions and field access.</Typography>
                      </Box>
                      {selectedTemplate ? <Stack direction="row" spacing={0.6} alignItems="center">
                        <AppChip label={selectedTemplate.isSystem ? 'System' : 'Custom'} />
                        {isLockedTemplate ? <AppChip label="Locked full access" /> : null}
                      </Stack> : null}
                    </Stack>
                  </Box>
                  <Box>
                    <Typography fontWeight={850} sx={{ mb: 0.6 }}>Actions</Typography>
                    <Stack direction="row" gap={1.2} flexWrap="wrap">
                      {permissionActions
                        .filter(([key]) => (actionsByModule[modulePermissionForm.moduleName] ?? ['canView']).includes(key))
                        .map(([key, label]) => (
                        <Stack key={key} direction="row" alignItems="center" spacing={0.45}>
                          <Switch size="small" checked={Boolean(activeModulePermissions[key])} disabled={!selectedTemplate?.id || isLockedTemplate || saving} onChange={(event) => void handleActionToggle(key, event.target.checked)} />
                          <Typography>{label}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                  <Box sx={{ height: 1, bgcolor: '#e0ede0' }} />
                  {shouldShowFields ? (
                  <Box>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                      <Box>
                        <Typography fontWeight={850}>Fields</Typography>
                        <Typography color="text.secondary">
                          {fieldPermissionForm.moduleName === 'ActivityType'
                            ? 'Set per-activity-type action access. Denied removes the activity action for that template.'
                            : fieldPermissionForm.moduleName === 'ActivityTypeField'
                              ? 'Set field visibility per activity type. Hidden removes it; masked shows partial values.'
                            : 'Set each custom field as visible, editable, hidden, or masked.'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.7}>
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <Select value={fieldPermissionForm.moduleName} onChange={(event) => setFieldPermissionForm({ ...fieldPermissionForm, moduleName: event.target.value as FieldPermissionForm['moduleName'], fieldKey: '' })}>
                            {fieldModulesForActiveModule.map((moduleName) => <MenuItem key={moduleName} value={moduleName}>{moduleName === 'ActivityType' ? 'Activity Type Actions' : moduleName === 'ActivityTypeField' ? 'Activity Type Fields' : labelForModule(moduleName)}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <Button variant="outlined" disabled={isLockedTemplate || saving || !fieldPermissionForm.permissionTemplateId || !matchingFieldDefinitions.length} onClick={saveFieldPermission}>Save Selected</Button>
                      </Stack>
                    </Stack>
                    <Stack spacing={0.55}>
                      {matchingFieldDefinitions.length ? matchingFieldDefinitions.map((field) => (
                        <Paper key={field.id} variant="outlined" sx={{ borderRadius: 1, p: 0.7, bgcolor: '#fff' }}>
                          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={0.8}>
                            <Box>
                              <Typography fontWeight={850}>{field.label}</Typography>
                              <Typography color="text.secondary" fontSize={12}>{field.fieldKey}</Typography>
                            </Box>
                            <Stack direction="row" spacing={0} sx={{ '& .MuiButton-root': { borderRadius: 0, borderColor: '#bfcbb8' }, '& .MuiButton-root:first-of-type': { borderTopLeftRadius: 1, borderBottomLeftRadius: 1 }, '& .MuiButton-root:last-of-type': { borderTopRightRadius: 1, borderBottomRightRadius: 1 } }}>
                              {(fieldPermissionForm.moduleName === 'ActivityType'
                                ? [
                                    ['visible', 'Allowed'],
                                    ['hidden', 'Denied']
                                  ]
                                : [
                                    ['editable', 'Editable'],
                                    ['visible', 'Read Only'],
                                    ['masked', 'Masked'],
                                    ['hidden', 'Hidden']
                                  ]).map(([access, label]) => {
                                const selected = currentFieldAccess(fieldPermissionForm.moduleName, field.fieldKey) === access;
                                return (
                                <Button
                                  key={access}
                                  variant={selected ? 'contained' : 'outlined'}
                                  disabled={!selectedTemplate?.id || isLockedTemplate || saving}
                                  onClick={() => void handleFieldAccess(field.fieldKey, access)}
                                  sx={{ bgcolor: selected ? undefined : alpha('#2d6a2d', 0.02) }}
                                >
                                  {label}
                                </Button>
                              );})}
                            </Stack>
                          </Stack>
                        </Paper>
                      )) : (
                        <Paper variant="outlined" sx={{ borderRadius: 1, p: 2, textAlign: 'center', bgcolor: '#fff' }}>
                          <Typography color="text.secondary">No custom fields available for this module.</Typography>
                        </Paper>
                      )}
                    </Stack>
                  </Box>
                  ) : (
                    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2, textAlign: 'center', bgcolor: '#fff' }}>
                      <Typography fontWeight={800}>No field-level controls for {labelForModule(modulePermissionForm.moduleName)}.</Typography>
                      <Typography color="text.secondary">Use the action toggles above for this module.</Typography>
                    </Paper>
                  )}
                </Stack>
              </Box>
            </Box>
          </Paper>
        </Stack>
      </FormDialog>
    </Section>
  );
}
