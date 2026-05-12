'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, FormControl, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { RowActionMenu } from '../../../../components/common/RowActionMenu';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { apiBaseUrl } from '../../../../lib/api';
import { formatDate } from '../../../../lib/format';
import type { ConnectorOverview, GenericConnector, WhatsAppNumber, WhatsAppTemplate } from './connector-types';

const bg = '#fafdfa';

type WhatsAppConnectorPanelProps = {
  connectorOverview: ConnectorOverview;
  variablePreview: string[];
  whatsAppSendForm: { leadId: string; templateId: string; content: string };
  saving: boolean;
  setWhatsAppSendForm: React.Dispatch<React.SetStateAction<{ leadId: string; templateId: string; content: string }>>;
  openCreateWhatsAppNumber: () => void;
  openCreateWhatsAppTemplate: () => void;
  openCreateWhatsAppConnector: () => void;
  openEditWhatsAppConnector: (connector: GenericConnector) => void;
  openEditWhatsAppNumber: (number: WhatsAppNumber) => void;
  openEditWhatsAppTemplate: (template: WhatsAppTemplate) => void;
  deleteWhatsAppConnector: (connectorId: string) => void;
  deleteWhatsAppNumber: (numberId: string) => void;
  deleteWhatsAppTemplate: (templateId: string) => void;
  syncWhatsAppTemplates: (connectorId: string) => void;
  extractVariables: (template: unknown) => void;
  sendWhatsAppMessage: () => void;
};

export function WhatsAppConnectorPanel({
  connectorOverview,
  variablePreview,
  whatsAppSendForm,
  saving,
  setWhatsAppSendForm,
  openCreateWhatsAppNumber,
  openCreateWhatsAppTemplate,
  openCreateWhatsAppConnector,
  openEditWhatsAppConnector,
  openEditWhatsAppNumber,
  openEditWhatsAppTemplate,
  deleteWhatsAppConnector,
  deleteWhatsAppNumber,
  deleteWhatsAppTemplate,
  syncWhatsAppTemplates,
  extractVariables,
  sendWhatsAppMessage
}: WhatsAppConnectorPanelProps) {
  const quickReplies = connectorOverview.whatsAppQuickReplies ?? [];

  return (
    <Section
      title="WhatsApp Converse"
      actions={
        <Stack direction="row" spacing={0.75}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openCreateWhatsAppNumber} sx={{ borderRadius: 1 }}>Number</Button>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openCreateWhatsAppTemplate} sx={{ borderRadius: 1 }}>Template</Button>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateWhatsAppConnector} sx={{ borderRadius: 1 }}>Connector</Button>
        </Stack>
      }
    >
      <Stack spacing={1} sx={{ p: 1 }}>
        <CompactDataTable
          columns={['Connector', 'Provider', 'Active', 'Created', 'Action']}
          rows={(connectorOverview.whatsAppConnectors ?? []).map((connector) => [
            connector.name ?? '-',
            connector.provider ?? 'MCUBE',
            <AppChip key={`${connector.id}-active`} label={connector.isActive ? 'Active' : 'Inactive'} />,
            formatDate(connector.createdAt),
            <RowActionMenu
              key={`${connector.id}-actions`}
              actions={[
                { label: 'Edit connector', icon: <EditIcon fontSize="small" />, onClick: () => openEditWhatsAppConnector(connector) },
                { label: 'Sync Meta templates', onClick: () => syncWhatsAppTemplates(connector.id) },
                { label: 'Delete connector', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteWhatsAppConnector(connector.id) }
              ]}
            />
          ])}
        />
        <CompactDataTable
          columns={['Number', 'Label', 'Connector', 'Default', 'Status', 'Action']}
          rows={(connectorOverview.whatsAppNumbers ?? []).map((number) => [
            number.phoneNumber ?? '-',
            number.label ?? '-',
            (connectorOverview.whatsAppConnectors ?? []).find((connector) => connector.id === number.connectorId)?.name ?? number.connectorId ?? '-',
            number.isDefault ? 'Yes' : 'No',
            <AppChip key={`${number.id}-active`} label={number.isActive ? 'Active' : 'Inactive'} />,
            <RowActionMenu
              key={`${number.id}-actions`}
              actions={[
                { label: 'Edit number', icon: <EditIcon fontSize="small" />, onClick: () => openEditWhatsAppNumber(number) },
                { label: 'Delete number', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteWhatsAppNumber(number.id) }
              ]}
            />
          ])}
        />
        <CompactDataTable
          columns={['Template', 'Category', 'Language', 'Status', 'Variables', 'Chat', 'Action']}
          rows={(connectorOverview.whatsAppTemplates ?? []).map((template) => [
            template.name ?? '-',
            template.category ?? '-',
            template.language ?? '-',
            <AppChip key={`${template.id}-status`} label={template.status ?? 'draft'} />,
            (template.variables ?? []).map((variable) => variable.variableKey).join(', ') || '-',
            template.availableInChat ? 'Yes' : 'No',
            <RowActionMenu
              key={`${template.id}-actions`}
              actions={[
                { label: 'Edit template', icon: <EditIcon fontSize="small" />, onClick: () => openEditWhatsAppTemplate(template) },
                { label: 'Extract variables', onClick: () => extractVariables(template.content) },
                ...(template.status === 'review_required' ? [{ label: 'Review template', icon: <EditIcon fontSize="small" />, onClick: () => openEditWhatsAppTemplate(template) }] : []),
                { label: 'Delete template', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'danger', onClick: () => deleteWhatsAppTemplate(template.id) }
              ]}
            />
          ])}
        />
        {variablePreview.length ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {variablePreview.map((variable) => <AppChip key={variable} label={variable} />)}
          </Stack>
        ) : null}
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField size="small" label="Template body supports variables" value={'Hello {{lead.customerName}}, your offer is {{lead.offerAmount}}.'} InputProps={{ readOnly: true }} />
          <TextField size="small" label="Webhook URL" value={`${apiBaseUrl}/connectors/whatsapp/webhook`} InputProps={{ readOnly: true }} />
        </Box>
        <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: bg, borderColor: '#e0ede0', boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
          <Stack spacing={1}>
            <Typography fontWeight={800}>Counsellor Chat</Typography>
            <CompactDataTable
              columns={['Lead', 'Direction', 'Type', 'Status', 'Content', 'Created']}
              rows={(connectorOverview.whatsAppMessages ?? []).slice(0, 8).map((message) => [
                message.leadId ?? '-',
                message.direction ?? '-',
                message.messageType ?? '-',
                <AppChip key={`${message.id}-status`} label={message.status ?? '-'} />,
                message.content ?? '-',
                formatDate(message.createdAt)
              ])}
            />
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '180px 1fr 180px 140px' } }}>
              <FormControl size="small">
                <Select displayEmpty value={whatsAppSendForm.leadId} onChange={(event) => setWhatsAppSendForm((form) => ({ ...form, leadId: event.target.value }))}>
                  <MenuItem value="">Select lead</MenuItem>
                  {(connectorOverview.whatsAppLeadSummaries ?? []).map((lead) => <MenuItem key={lead.id} value={lead.id}>{lead.name ?? lead.customerName ?? lead.mobile}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Free text inside service window" placeholder="Type counsellor reply" value={whatsAppSendForm.content} onChange={(event) => setWhatsAppSendForm((form) => ({ ...form, content: event.target.value }))} />
              <FormControl size="small">
                <Select displayEmpty value={whatsAppSendForm.templateId} onChange={(event) => setWhatsAppSendForm((form) => ({ ...form, templateId: event.target.value }))}>
                  <MenuItem value="">Approved template</MenuItem>
                  {(connectorOverview.whatsAppTemplates ?? []).filter((template) => template.availableInChat).map((template) => <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" disabled={saving || !whatsAppSendForm.leadId || (!whatsAppSendForm.content && !whatsAppSendForm.templateId)} onClick={sendWhatsAppMessage} sx={{ borderRadius: 1 }}>Send</Button>
            </Box>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {quickReplies.length > 0
                ? quickReplies.map((reply) => <AppChip key={reply.id} label={reply.name ?? '-'} />)
                : ['Interested', 'Callback Scheduled', 'Documents Pending'].map((reply) => <AppChip key={reply} label={reply} />)}
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Section>
  );
}
