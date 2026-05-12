'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Button, Divider, FormControl, IconButton, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { AppChip } from '../../../../components/common/AppChip';
import { ExitConditionConfig } from './AutomationCanvas';

type AutomationNode = {
  id: string;
  type: string;
  label: string;
  config: Record<string, any> | string;
};

type MappingField = {
  value: string;
  label: string;
};

type ActivityFieldDefinition = {
  activityTypeCode?: string | null;
  fieldKey?: string | null;
  label?: string | null;
};

const line = '#e0ede0';
const soft = '#f4fbf4';
const green = '#2d6a2d';

const triggerOptions = ['Lead uploaded', 'Lead created', 'Lead updated', 'WhatsApp message status changed', 'WhatsApp reply received', 'Voicebot disposition received', 'Call log received', 'Task completed', 'Offer expiry reached'];
const conditionFieldOptions = [
  ['lead.status', 'Lead Status'],
  ['lead.category', 'Lead Category'],
  ['lead.disposition', 'Lead Disposition'],
  ['lead.branchCode', 'Branch Code'],
  ['lead.branchName', 'Branch Name'],
  ['lead.preferredLanguage', 'Preferred Language'],
  ['lead.offerAmount', 'Loan Offer Amount'],
  ['lead.emiAmount', 'EMI Amount'],
  ['lead.location', 'Customer Location'],
  ['lead.custom', 'Lead Custom Field']
];
const leadUpdateFields = [
  ['status', 'Lead Status'],
  ['category', 'Lead Category'],
  ['disposition', 'Lead Disposition'],
  ['assignedUserId', 'Owner'],
  ['assignedTeamId', 'Team'],
  ['automationStatus', 'Automation Status'],
  ['partnerMapping', 'Partner Mapping']
];
const operators = ['equals', 'not_equals', 'contains', 'exists', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte'];
const branchModes = [
  ['all', 'Match all conditions'],
  ['any', 'Match any condition']
];
const exitStatusOptions = ['Converted', 'Expired', 'No Response', 'Not Interested'];
const exitDispositionOptions = ['Converted', 'Not Interested', 'Wrong Number', 'Expired', 'No Response'];
const templateFieldOptions = ['lead.customerName', 'lead.mobile', 'lead.status', 'lead.category', 'lead.branchCode', 'lead.branchName', 'lead.offerAmount', 'lead.emiAmount', 'lead.preferredLanguage', 'user.name', 'user.phone', 'user.email', 'activity.disposition'];

export function NodeInspector({
  selectedNode,
  nodeTypes,
  exitCondition,
  setExitCondition,
  updateSelectedNode,
  cloneSelectedNode,
  deleteSelectedNode,
  assignmentRules,
  connectorOverview,
  mappingFields = [],
  activityTypes = [],
  activityFieldDefinitions = []
}: {
  selectedNode: AutomationNode;
  nodeTypes: string[];
  exitCondition: ExitConditionConfig;
  setExitCondition: (value: ExitConditionConfig) => void;
  updateSelectedNode: (patch: Partial<AutomationNode>) => void;
  cloneSelectedNode: () => void;
  deleteSelectedNode: () => void;
  assignmentRules: any[];
  connectorOverview: any;
  mappingFields?: MappingField[];
  activityTypes?: Array<{ code: string; label: string; isActive?: boolean }>;
  activityFieldDefinitions?: ActivityFieldDefinition[];
}) {
  const config = typeof selectedNode.config === 'object' && selectedNode.config ? selectedNode.config : { summary: selectedNode.config };
  const updateConfig = (patch: Record<string, unknown>) => updateSelectedNode({ config: { ...config, ...patch } });
  const selectedActivityType = String(config.type ?? '008').padStart(3, '0');
  const createActivityFields = activityFieldDefinitions.filter((field) => {
    const scope = field.activityTypeCode || 'ALL';
    return scope === 'ALL' || scope === selectedActivityType;
  });
  const whatsAppTemplates = connectorOverview.whatsAppTemplates ?? [];
  const voicebotTemplates = connectorOverview.voicebotTemplates ?? [];
  const apiConnectors = connectorOverview.connectors ?? [];
  const selectedWhatsAppTemplate = whatsAppTemplates.find((template: any) => template.id === config.templateId);
  const selectedVoicebotTemplate = voicebotTemplates.find((template: any) => template.id === config.templateId);
  const selectedApiConnector = apiConnectors.find((connector: any) => connector.id === config.connectorId);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, gap: 1.1 }}>
      <Stack spacing={1}>
        <InspectorPanel title="Node">
          <Stack spacing={0.85}>
            <TextField size="small" label="Label" value={selectedNode.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
            <SelectField value={selectedNode.type} onChange={(value) => updateSelectedNode({ type: value, config: defaultConfigForType(value) })}>
              {['Trigger', ...nodeTypes].map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </SelectField>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <AppChip label={selectedNode.type} />
              {selectedNode.type === 'If/Else' ? <AppChip label="Yes / No branches" /> : null}
            </Stack>
          </Stack>
        </InspectorPanel>

        <InspectorPanel title="Actions">
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" onClick={cloneSelectedNode}>Clone</Button>
            <Button size="small" variant="outlined" color="error" disabled={selectedNode.type === 'Trigger'} onClick={deleteSelectedNode}>Delete</Button>
          </Stack>
        </InspectorPanel>
      </Stack>

      <Stack spacing={1}>
        <InspectorPanel title={`${selectedNode.type} settings`}>
          {selectedNode.type === 'Trigger' ? <TriggerEditor config={config} updateConfig={updateConfig} /> : null}
          {selectedNode.type === 'If/Else' ? <ConditionBuilder config={config} updateConfig={updateConfig} mappingFields={mappingFields} /> : null}
          {selectedNode.type === 'Delay' ? <DelayEditor config={config} updateConfig={updateConfig} /> : null}
          {selectedNode.type === 'Assignment' ? <AssignmentEditor config={config} updateConfig={updateConfig} assignmentRules={assignmentRules} /> : null}
          {selectedNode.type === 'WhatsApp' ? <TemplateMappingEditor title="WhatsApp template" templates={whatsAppTemplates} selectedTemplate={selectedWhatsAppTemplate} config={config} updateConfig={updateConfig} mappingFields={mappingFields} /> : null}
          {selectedNode.type === 'Voicebot' ? <TemplateMappingEditor title="Voicebot trigger" templates={voicebotTemplates} selectedTemplate={selectedVoicebotTemplate} config={config} updateConfig={updateConfig} mappingFields={mappingFields} /> : null}
          {selectedNode.type === 'Task' ? <TaskEditor config={config} updateConfig={updateConfig} mappingFields={mappingFields} /> : null}
          {selectedNode.type === 'Lead Update' ? <LeadUpdateEditor config={config} updateConfig={updateConfig} mappingFields={mappingFields} /> : null}
          {selectedNode.type === 'Create Activity' ? <CreateActivityEditor config={config} updateConfig={updateConfig} selectedActivityType={selectedActivityType} activityTypes={activityTypes} activityFields={createActivityFields} mappingFields={mappingFields} /> : null}
          {selectedNode.type === 'API Call' ? <ApiCallEditor config={config} updateConfig={updateConfig} apiConnectors={apiConnectors} selectedApiConnector={selectedApiConnector} mappingFields={mappingFields} /> : null}
          {['Mark Expired', 'Notify', 'Stop', 'Pause', 'Resume'].includes(selectedNode.type) ? <SimpleConfigEditor config={config} updateSelectedNode={updateSelectedNode} /> : null}
        </InspectorPanel>

        <InspectorPanel title="Exit conditions">
          <ExitConditionEditor exitCondition={exitCondition} setExitCondition={setExitCondition} />
        </InspectorPanel>
      </Stack>
    </Box>
  );
}

function InspectorPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderColor: line, borderRadius: '8px', overflow: 'hidden', bgcolor: '#fff' }}>
      <Box sx={{ px: 1, py: 0.65, bgcolor: soft, borderBottom: `1px solid ${line}` }}>
        <Typography fontWeight={850} fontSize={14}>{title}</Typography>
      </Box>
      <Box sx={{ p: 1 }}>{children}</Box>
    </Paper>
  );
}

function SelectField({ value, onChange, children, multiple = false, renderValue }: { value: any; onChange: (value: any) => void; children: ReactNode; multiple?: boolean; renderValue?: (selected: any) => ReactNode }) {
  return (
    <FormControl size="small" fullWidth>
      <Select multiple={multiple} displayEmpty value={value} renderValue={renderValue} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Select>
    </FormControl>
  );
}

function TriggerEditor({ config, updateConfig }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void }) {
  return (
    <SelectField value={config.trigger ?? 'Lead created'} onChange={(value) => updateConfig({ trigger: value })}>
      {triggerOptions.map((trigger) => <MenuItem key={trigger} value={trigger}>{trigger}</MenuItem>)}
    </SelectField>
  );
}

function DelayEditor({ config, updateConfig }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void }) {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <TextField size="small" type="number" label="Delay minutes" value={config.delayMinutes ?? 15} onChange={(event) => updateConfig({ delayMinutes: Number(event.target.value) })} />
      <SelectField value={config.delayUnit ?? 'minutes'} onChange={(value) => updateConfig({ delayUnit: value })}>
        {['minutes', 'hours', 'days'].map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
      </SelectField>
    </Box>
  );
}

function AssignmentEditor({ config, updateConfig, assignmentRules }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; assignmentRules: any[] }) {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <SelectField value={config.mode ?? 'full_engine'} onChange={(value) => updateConfig({ mode: value })}>
        <MenuItem value="full_engine">Run full assignment engine</MenuItem>
        <MenuItem value="rule">Run selected rule</MenuItem>
      </SelectField>
      {config.mode === 'rule' ? (
        <SelectField value={config.ruleId ?? ''} onChange={(value) => updateConfig({ ruleId: value })}>
          <MenuItem value="">Select rule</MenuItem>
          {assignmentRules.map((rule) => <MenuItem key={rule.id} value={rule.id}>{rule.name}</MenuItem>)}
        </SelectField>
      ) : <Typography color="text.secondary" fontSize={13} sx={{ alignSelf: 'center' }}>Rules are evaluated by priority.</Typography>}
    </Box>
  );
}

function ConditionBuilder({ config, updateConfig, mappingFields }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; mappingFields: MappingField[] }) {
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const fields = [...conditionFieldOptions.map(([value, label]) => ({ value, label })), ...mappingFields.filter((field) => field.value.startsWith('lead.custom.'))];
  const conditions = [{ fieldPath: config.fieldPath ?? 'lead.status', operator: config.operator ?? 'equals', value: config.value ?? '' }, ...groups];
  const updateConditionAt = (index: number, patch: Record<string, unknown>) => {
    if (index === 0) return updateConfig(patch);
    updateConfig({ groups: groups.map((group: any, groupIndex: number) => groupIndex === index - 1 ? { ...group, ...patch } : group) });
  };
  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '220px 1fr' }, alignItems: 'center' }}>
        <SelectField value={config.branchMode ?? 'all'} onChange={(value) => updateConfig({ branchMode: value })}>
          {branchModes.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </SelectField>
        <Typography color="text.secondary" fontSize={13}>Matched conditions continue on the Yes path; unmatched conditions continue on No.</Typography>
      </Box>
      <Divider />
      {conditions.map((condition, index) => (
        <Box key={index} sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: '1.2fr 150px 1fr 34px' }, alignItems: 'center' }}>
          <SelectField value={condition.fieldPath ?? 'lead.status'} onChange={(value) => updateConditionAt(index, { fieldPath: value })}>
            {fields.map((field) => <MenuItem key={field.value} value={field.value}>{field.label}</MenuItem>)}
          </SelectField>
          <SelectField value={condition.operator ?? 'equals'} onChange={(value) => updateConditionAt(index, { operator: value })}>
            {operators.map((operator) => <MenuItem key={operator} value={operator}>{operator.replace(/_/g, ' ')}</MenuItem>)}
          </SelectField>
          <TextField size="small" label={condition.operator === 'in' || condition.operator === 'not_in' ? 'Values, comma separated' : 'Value'} value={condition.value ?? ''} disabled={['exists', 'not_exists'].includes(condition.operator)} onChange={(event) => updateConditionAt(index, { value: event.target.value })} />
          <IconButton size="small" disabled={index === 0} onClick={() => updateConfig({ groups: groups.filter((_: any, groupIndex: number) => groupIndex !== index - 1) })}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Box>
      ))}
      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => updateConfig({ groups: [...groups, { fieldPath: 'lead.status', operator: 'equals', value: '' }] })}>Add condition</Button>
    </Stack>
  );
}

function TemplateMappingEditor({ title, templates, selectedTemplate, config, updateConfig, mappingFields }: { title: string; templates: any[]; selectedTemplate: any; config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; mappingFields: MappingField[] }) {
  const variables = selectedTemplate?.variables ?? [];
  const variableMapping = config.variableMapping ?? {};
  const fields = mappingFields.length ? mappingFields : templateFieldOptions.map((field) => ({ value: field, label: field }));
  return (
    <Stack spacing={1}>
      <SelectField value={config.templateId ?? ''} onChange={(value) => {
        const template = templates.find((item) => item.id === value);
        updateConfig({ templateId: value, templateName: template?.name, variableMapping: {} });
      }}>
        <MenuItem value="">Select {title}</MenuItem>
        {templates.map((template) => <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>)}
      </SelectField>
      {variables.length ? (
        <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
          {variables.map((variable: any) => (
            <MappingRow key={variable.variableKey} label={variable.variableKey} value={variableMapping[variable.variableKey] ?? ''} fields={fields} onChange={(value) => updateConfig({ variableMapping: { ...variableMapping, [variable.variableKey]: value } })} />
          ))}
        </Box>
      ) : <Typography fontSize={13} color="text.secondary">Select a saved template to map variables.</Typography>}
    </Stack>
  );
}

function TaskEditor({ config, updateConfig, mappingFields }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; mappingFields: MappingField[] }) {
  const userFields = mappingFields.filter((field) => field.value.startsWith('user.'));
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <TextField size="small" label="Task type" value={config.taskType ?? 'Follow-up'} onChange={(event) => updateConfig({ taskType: event.target.value })} />
      <SelectField value={config.priority ?? 'Medium'} onChange={(value) => updateConfig({ priority: value })}>
        {['Low', 'Medium', 'High'].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
      </SelectField>
      <TextField size="small" type="number" label="Due in days" value={config.dueInDays ?? 1} onChange={(event) => updateConfig({ dueInDays: Number(event.target.value) })} />
      <SelectField value={config.assignedTo ?? ''} onChange={(value) => updateConfig({ assignedTo: value })}>
        <MenuItem value="">Use lead owner</MenuItem>
        {userFields.map((field) => <MenuItem key={field.value} value={field.value}>{field.label}</MenuItem>)}
      </SelectField>
      <TextField size="small" multiline minRows={2} label="Remarks" value={config.remarks ?? ''} onChange={(event) => updateConfig({ remarks: event.target.value })} sx={{ gridColumn: '1 / -1' }} />
    </Box>
  );
}

function LeadUpdateEditor({ config, updateConfig, mappingFields }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; mappingFields: MappingField[] }) {
  const customLeadFields = mappingFields.filter((field) => field.value.startsWith('lead.custom.'));
  const updateRows = normalizeUpdateRows(config);
  const fields = [...leadUpdateFields.map(([value, label]) => ({ value, label })), ...customLeadFields];
  const setRows = (rows: Array<{ field: string; value: string }>) => updateConfig({ updates: rows, field: rows[0]?.field ?? 'status', value: rows[0]?.value ?? '' });
  return (
    <Stack spacing={1}>
      {updateRows.map((row, index) => (
        <Box key={`${row.field}-${index}`} sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 34px' }, alignItems: 'center' }}>
          <SelectField value={row.field} onChange={(value) => setRows(updateRows.map((item, itemIndex) => itemIndex === index ? { ...item, field: value } : item))}>
            {fields.map((field) => <MenuItem key={field.value} value={field.value}>{field.label}</MenuItem>)}
          </SelectField>
          <TextField size="small" label="New value or {{variable}}" value={row.value} onChange={(event) => setRows(updateRows.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
          <IconButton size="small" disabled={updateRows.length === 1} onClick={() => setRows(updateRows.filter((_, itemIndex) => itemIndex !== index))}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Box>
      ))}
      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setRows([...updateRows, { field: 'status', value: '' }])}>Add field update</Button>
    </Stack>
  );
}

function CreateActivityEditor({ config, updateConfig, selectedActivityType, activityTypes, activityFields, mappingFields }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; selectedActivityType: string; activityTypes: Array<{ code: string; label: string; isActive?: boolean }>; activityFields: ActivityFieldDefinition[]; mappingFields: MappingField[] }) {
  const customFields = typeof config.customFields === 'object' && config.customFields ? config.customFields : {};
  const mappedKeys = Object.keys(customFields).filter((key) => customFields[key]);
  const availableFields = activityFields.filter((field) => String(field.fieldKey ?? '').trim());
  const addableField = availableFields.find((field) => !mappedKeys.includes(String(field.fieldKey)));
  const setCustomFields = (next: Record<string, unknown>) => updateConfig({ customFields: next });
  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' } }}>
        <SelectField value={selectedActivityType} onChange={(value) => updateConfig({ type: value, customFields: {} })}>
          {(activityTypes.length ? activityTypes : [{ code: '008', label: 'System' }]).filter((type) => type.isActive !== false).map((type) => <MenuItem key={type.code} value={type.code}>{type.code} · {type.label}</MenuItem>)}
        </SelectField>
        <TextField size="small" label="Title" value={config.title ?? ''} onChange={(event) => updateConfig({ title: event.target.value })} />
        <TextField size="small" multiline minRows={2} label="Notes" value={config.notes ?? ''} onChange={(event) => updateConfig({ notes: event.target.value })} sx={{ gridColumn: '1 / -1' }} />
      </Box>
      <Divider />
      <Typography fontWeight={850} fontSize={13}>Activity field mappings</Typography>
      {mappedKeys.length ? mappedKeys.map((fieldKey) => {
        const field = availableFields.find((item) => item.fieldKey === fieldKey);
        return (
          <Box key={fieldKey} sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 34px' }, alignItems: 'center' }}>
            <SelectField value={fieldKey} onChange={(nextKey) => {
              const { [fieldKey]: currentValue, ...rest } = customFields;
              setCustomFields({ ...rest, [nextKey]: currentValue });
            }}>
              {availableFields.map((item) => <MenuItem key={item.fieldKey} value={String(item.fieldKey)}>{item.label || item.fieldKey}</MenuItem>)}
            </SelectField>
            <SelectField value={String(customFields[fieldKey] ?? '')} onChange={(value) => setCustomFields({ ...customFields, [fieldKey]: value })}>
              <MenuItem value="">Select source field</MenuItem>
              {mappingFields.map((mapping) => <MenuItem key={mapping.value} value={mapping.value}>{mapping.label}</MenuItem>)}
            </SelectField>
            <IconButton size="small" onClick={() => {
              const { [fieldKey]: _removed, ...rest } = customFields;
              void _removed;
              setCustomFields(rest);
            }}><DeleteOutlineIcon fontSize="small" /></IconButton>
            {field ? null : null}
          </Box>
        );
      }) : <Typography fontSize={13} color="text.secondary">Add only the activity fields you want this node to fill.</Typography>}
      <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!addableField} onClick={() => addableField ? setCustomFields({ ...customFields, [String(addableField.fieldKey)]: '' }) : undefined}>Add field mapping</Button>
    </Stack>
  );
}

function ApiCallEditor({ config, updateConfig, apiConnectors, selectedApiConnector, mappingFields }: { config: Record<string, any>; updateConfig: (patch: Record<string, unknown>) => void; apiConnectors: any[]; selectedApiConnector: any; mappingFields: MappingField[] }) {
  const apiConnectorConfig = selectedApiConnector?.config ?? {};
  const apiConnectorVariables = extractTemplateVariables({ url: apiConnectorConfig.url, headers: apiConnectorConfig.headers, bodyTemplate: apiConnectorConfig.bodyTemplate });
  return (
    <Stack spacing={1}>
      <SelectField value={config.connectorId ?? ''} onChange={(value) => {
        const connector = apiConnectors.find((item: any) => item.id === value);
        const connectorConfig = connector?.config ?? {};
        updateConfig({ connectorId: value, connectorName: connector?.name, method: connectorConfig.method ?? 'POST', url: connectorConfig.url ?? '', headers: connectorConfig.headers ?? {}, body: connectorConfig.bodyTemplate ?? {}, responseKeyword: connectorConfig.responseKeyword ?? '', variableMapping: {} });
      }}>
        <MenuItem value="">Custom HTTPS request</MenuItem>
        {apiConnectors.map((connector: any) => <MenuItem key={connector.id} value={connector.id}>{connector.name}</MenuItem>)}
      </SelectField>
      {selectedApiConnector ? (
        <Stack spacing={0.75}>
          <Typography fontSize={13} color="text.secondary">{String(apiConnectorConfig.method ?? 'POST')} {String(apiConnectorConfig.url ?? '')}</Typography>
          {apiConnectorVariables.map((variable) => <MappingRow key={variable} label={variable} value={(config.variableMapping ?? {})[variable] ?? ''} fields={mappingFields} onChange={(value) => updateConfig({ variableMapping: { ...(config.variableMapping ?? {}), [variable]: value } })} />)}
        </Stack>
      ) : (
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '130px 1fr' } }}>
          <SelectField value={config.method ?? 'POST'} onChange={(value) => updateConfig({ method: value })}>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
          </SelectField>
          <TextField size="small" label="HTTPS URL" value={config.url ?? ''} onChange={(event) => updateConfig({ url: event.target.value })} />
          <TextField sx={{ gridColumn: '1 / -1' }} size="small" multiline minRows={5} label="Body JSON" value={jsonText(config.body ?? {})} onChange={(event) => updateConfig({ body: parseJsonOrRaw(event.target.value) })} />
        </Box>
      )}
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        <TextField size="small" label="Retries" type="number" value={config.retries ?? 0} onChange={(event) => updateConfig({ retries: Number(event.target.value) })} />
        <TextField size="small" label="Retry delay ms" type="number" value={config.retryDelayMs ?? 1000} onChange={(event) => updateConfig({ retryDelayMs: Number(event.target.value) })} />
        <TextField size="small" label="Timeout ms" type="number" value={config.timeoutMs ?? 10000} onChange={(event) => updateConfig({ timeoutMs: Number(event.target.value) })} />
      </Box>
    </Stack>
  );
}

function ExitConditionEditor({ exitCondition, setExitCondition }: { exitCondition: ExitConditionConfig; setExitCondition: (value: ExitConditionConfig) => void }) {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 150px' } }}>
      <SelectField multiple value={exitCondition.stopStatuses} renderValue={(selected) => selected.length ? selected.join(', ') : 'Stop statuses'} onChange={(value) => setExitCondition({ ...exitCondition, stopStatuses: normalizeMultiValue(value) })}>
        {exitStatusOptions.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
      </SelectField>
      <SelectField multiple value={exitCondition.stopDispositions} renderValue={(selected) => selected.length ? selected.join(', ') : 'Stop dispositions'} onChange={(value) => setExitCondition({ ...exitCondition, stopDispositions: normalizeMultiValue(value) })}>
        {exitDispositionOptions.map((disposition) => <MenuItem key={disposition} value={disposition}>{disposition}</MenuItem>)}
      </SelectField>
      <TextField size="small" type="number" label="Max attempts" value={exitCondition.maxAttempts} onChange={(event) => setExitCondition({ ...exitCondition, maxAttempts: Math.max(0, Number(event.target.value || 0)) })} />
    </Box>
  );
}

function MappingRow({ label, value, fields, onChange }: { label: string; value: string; fields: MappingField[]; onChange: (value: string) => void }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, alignItems: 'center' }}>
      <Box sx={{ px: 0.75, py: 0.45, borderRadius: '6px', bgcolor: soft, color: green, fontWeight: 850, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
      <SelectField value={value} onChange={onChange}>
        <MenuItem value="">Select source field</MenuItem>
        {fields.map((field) => <MenuItem key={field.value} value={field.value}>{field.label}</MenuItem>)}
      </SelectField>
    </Box>
  );
}

function SimpleConfigEditor({ config, updateSelectedNode }: { config: Record<string, any>; updateSelectedNode: (patch: Partial<AutomationNode>) => void }) {
  return <TextField size="small" multiline minRows={4} fullWidth label="Configuration JSON" value={jsonText(config)} onChange={(event) => updateSelectedNode({ config: parseJsonOrRaw(event.target.value) })} />;
}

function normalizeUpdateRows(config: Record<string, any>) {
  if (Array.isArray(config.updates) && config.updates.length) {
    return config.updates.map((row: any) => ({ field: String(row.field ?? 'status'), value: String(row.value ?? '') }));
  }
  return [{ field: String(config.field ?? 'status'), value: String(config.value ?? 'In Progress') }];
}

function defaultConfigForType(type: string) {
  if (type === 'Trigger') return { trigger: 'Lead created' };
  if (type === 'If/Else') return { fieldPath: 'lead.status', operator: 'equals', value: 'New', branchMode: 'all', groups: [] };
  if (type === 'Delay') return { delayMinutes: 15, delayUnit: 'minutes' };
  if (type === 'Assignment') return { mode: 'full_engine', ruleId: '' };
  if (type === 'WhatsApp' || type === 'Voicebot') return { templateId: '', variableMapping: {} };
  if (type === 'Task') return { taskType: 'Follow-up', priority: 'Medium', dueInDays: 1, remarks: '' };
  if (type === 'Lead Update') return { updates: [{ field: 'status', value: 'In Progress' }] };
  if (type === 'Create Activity') return { type: '008', title: 'Automation activity', notes: '', customFields: {} };
  if (type === 'API Call') return { method: 'POST', url: '', body: {}, retries: 0, retryDelayMs: 1000, timeoutMs: 10000 };
  return { summary: 'Configure node' };
}

function jsonText(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
}

function parseJsonOrRaw(value: string) {
  try {
    return value.trim() ? JSON.parse(value) : {};
  } catch {
    return value;
  }
}

function extractTemplateVariables(value: unknown): string[] {
  const values: string[] = [];
  const visit = (entry: unknown) => {
    if (Array.isArray(entry)) return entry.forEach(visit);
    if (entry && typeof entry === 'object') return Object.values(entry as Record<string, unknown>).forEach(visit);
    if (typeof entry !== 'string') return;
    const matcher = /\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g;
    let match = matcher.exec(entry);
    while (match) {
      values.push(match[1]);
      match = matcher.exec(entry);
    }
  };
  visit(value);
  return Array.from(new Set(values)).sort();
}

function normalizeMultiValue(value: string | string[]) {
  return typeof value === 'string' ? value.split(',').filter(Boolean) : value;
}
