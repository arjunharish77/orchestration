'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, FormControl, MenuItem, Select, Stack, TextField } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { apiBaseUrl } from '../../../../lib/api';
import { formatDate } from '../../../../lib/format';
import type { ConnectorOverview, GenericConnector, VoicebotTemplate, VoicebotWebhookMapping } from './connector-types';

type VoicebotConnectorPanelProps = {
  connectorOverview: ConnectorOverview;
  voicebotSample: string;
  voicebotTestTemplateId: string;
  voicebotTestVariables: string;
  setVoicebotSample: React.Dispatch<React.SetStateAction<string>>;
  setVoicebotTestTemplateId: React.Dispatch<React.SetStateAction<string>>;
  setVoicebotTestVariables: React.Dispatch<React.SetStateAction<string>>;
  openCreateVoicebotMapping: () => void;
  openCreateVoicebotTemplate: () => void;
  openCreateVoicebotConnector: () => void;
  openEditVoicebotConnector: (connector: GenericConnector) => void;
  openEditVoicebotTemplate: (template: VoicebotTemplate) => void;
  openEditVoicebotMapping: (mapping: VoicebotWebhookMapping) => void;
  deleteVoicebotConnector: (connectorId: string) => void;
  deleteVoicebotTemplate: (templateId: string) => void;
  deleteVoicebotMapping: (mappingId: string) => void;
  extractVariables: (template: unknown) => void;
  testVoicebotCall: () => void;
};

export function VoicebotConnectorPanel({
  connectorOverview,
  voicebotSample,
  voicebotTestTemplateId,
  voicebotTestVariables,
  setVoicebotSample,
  setVoicebotTestTemplateId,
  setVoicebotTestVariables,
  openCreateVoicebotMapping,
  openCreateVoicebotTemplate,
  openCreateVoicebotConnector,
  openEditVoicebotConnector,
  openEditVoicebotTemplate,
  openEditVoicebotMapping,
  deleteVoicebotConnector,
  deleteVoicebotTemplate,
  deleteVoicebotMapping,
  extractVariables,
  testVoicebotCall
}: VoicebotConnectorPanelProps) {
  return (
    <Section
      title="Voicebot Connector"
      actions={
        <Stack direction="row" spacing={0.75}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openCreateVoicebotMapping} sx={{ borderRadius: 1 }}>Webhook Mapping</Button>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openCreateVoicebotTemplate} sx={{ borderRadius: 1 }}>Trigger</Button>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateVoicebotConnector} sx={{ borderRadius: 1 }}>Connector</Button>
        </Stack>
      }
    >
      <Stack spacing={1} sx={{ p: 1 }}>
        <CompactDataTable
          columns={['Connector', 'Active', 'Created', 'Webhook URL', 'Action']}
          rows={(connectorOverview.voicebotConnectors ?? []).map((connector) => [
            connector.name ?? '-',
            <AppChip key={`${connector.id}-active`} label={connector.isActive ? 'Active' : 'Inactive'} />,
            formatDate(connector.createdAt),
            `${apiBaseUrl}/connectors/voicebot/webhook/${connector.id}`,
            <RowActionMenu
              key={`${connector.id}-actions`}
              actions={[
                { label: 'Edit connector', icon: <EditIcon fontSize="small" />, onClick: () => openEditVoicebotConnector(connector) },
                { label: 'Delete connector', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteVoicebotConnector(connector.id) }
              ]}
            />
          ])}
        />
        <CompactDataTable
          columns={['Trigger', 'Method', 'URL', 'Variables', 'Created', 'Action']}
          rows={(connectorOverview.voicebotTemplates ?? []).map((template) => [
            template.name ?? '-',
            template.method ?? 'POST',
            template.url ?? '-',
            (template.variables ?? []).map((variable) => variable.variableKey).join(', ') || '-',
            formatDate(template.createdAt),
            <RowActionMenu
              key={`${template.id}-actions`}
              actions={[
                { label: 'Edit trigger', icon: <EditIcon fontSize="small" />, onClick: () => openEditVoicebotTemplate(template) },
                { label: 'Extract variables', onClick: () => extractVariables(template.bodyTemplate ?? {}) },
                { label: 'Set as test trigger', onClick: () => setVoicebotTestTemplateId(template.id) },
                { label: 'Delete trigger', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteVoicebotTemplate(template.id) }
              ]}
            />
          ])}
        />
        <CompactDataTable
          columns={['Connector', 'Active', 'Sample Keys', 'Mappings', 'Action']}
          rows={(connectorOverview.voicebotWebhookMappings ?? []).map((mapping) => [
            (connectorOverview.voicebotConnectors ?? []).find((connector) => connector.id === mapping.connectorId)?.name ?? mapping.connectorId ?? '-',
            <AppChip key={`${mapping.id}-active`} label={mapping.isActive ? 'Active' : 'Inactive'} />,
            Object.keys(mapping.sampleBody ?? {}).join(', ') || '-',
            Object.entries(mapping.fieldMappings ?? {}).map(([field, path]) => `${field}: ${String(path)}`).join(', ') || '-',
            <RowActionMenu
              key={`${mapping.id}-actions`}
              actions={[
                { label: 'Edit mapping', icon: <EditIcon fontSize="small" />, onClick: () => openEditVoicebotMapping(mapping) },
                { label: 'Delete mapping', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteVoicebotMapping(mapping.id) }
              ]}
            />
          ])}
        />
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '220px 1fr 140px' } }}>
          <FormControl size="small">
            <Select displayEmpty value={voicebotTestTemplateId} onChange={(event) => setVoicebotTestTemplateId(event.target.value)}>
              <MenuItem value="">Select trigger to test</MenuItem>
              {(connectorOverview.voicebotTemplates ?? []).map((template) => <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Test variables JSON" value={voicebotTestVariables} onChange={(event) => setVoicebotTestVariables(event.target.value)} />
          <Button size="small" variant="outlined" disabled={!voicebotTestTemplateId} onClick={testVoicebotCall}>Dry Run</Button>
        </Box>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField
            size="small"
            multiline
            minRows={5}
            label="Sample webhook body"
            value={voicebotSample}
            onChange={(event) => setVoicebotSample(event.target.value)}
          />
          <CompactDataTable
            columns={['Activity Field', 'Mapped Sample Path']}
            rows={[
              ['Phone', 'phone'],
              ['Status', 'status'],
              ['Intent', 'intent'],
              ['Disposition', 'disposition'],
              ['Recording URL', 'recordingUrl']
            ]}
          />
        </Box>
      </Stack>
    </Section>
  );
}
