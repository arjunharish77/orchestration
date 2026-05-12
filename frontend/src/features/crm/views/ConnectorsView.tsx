'use client';

import { Box, Button, Checkbox, FormControl, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { CompactDataTable } from '../../../components/common/CompactDataTable';
import { AppChip } from '../../../components/common/AppChip';
import { FormDialog } from '../../../components/common/FormDialog';
import { MessageAlert } from '../../../components/common/MessageAlert';
import { ModuleShell, SegmentedTabs } from '../../../components/common/WorkspacePrimitives';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import { ApiCallConnectorPanel } from './connectors/ApiCallConnectorPanel';
import { ConnectorLogsPanel } from './connectors/ConnectorLogsPanel';
import type { ActivityMappingField, ConnectorEvent, ConnectorOverview, GenericConnector, VoicebotTemplate, VoicebotWebhookMapping, WhatsAppNumber, WhatsAppTemplate } from './connectors/connector-types';
import { TelephonyConnectorPanel } from './connectors/TelephonyConnectorPanel';
import { VoicebotConnectorPanel } from './connectors/VoicebotConnectorPanel';
import { WhatsAppConnectorPanel } from './connectors/WhatsAppConnectorPanel';

const defaultApiForm = { name: '', provider: '', method: 'POST', url: '', headers: '{}', responseKeyword: 'success', body: '{\n  "exenumber": "{{user.phone}}",\n  "custnumber": "{{lead.mobile}}"\n}', isActive: true };
const defaultWhatsAppConnectorForm = {
  name: '',
  provider: 'Meta Cloud API',
  phoneNumberId: '',
  graphVersion: 'v23.0',
  accessToken: '',
  defaultCountryCode: '91',
  verifyToken: '',
  webhookSecret: '',
  outboundUrl: '',
  businessAccountId: '',
  enableConverse: true,
  notifyMode: 'lead_owner',
  enableRichMedia: true,
  showUrlPreview: false,
  allowApprovedTemplates: true,
  allowUnapprovedTemplates: false,
  complianceType: 'opt_out',
  complianceFieldKey: 'whatsapp_opt_out',
  dailyRecipientLimit: '0',
  qualityRating: '',
  enableSendFromNumber: true,
  isActive: true
};
const defaultWhatsAppNumberForm = { connectorId: '', phoneNumber: '', label: '', isDefault: true, isActive: true };
const defaultWhatsAppSendForm = { leadId: '', templateId: '', content: '' };
const defaultWhatsAppTemplateForm = { connectorId: '', name: '', category: 'UTILITY', language: 'en', content: 'Hello {{lead.customerName}}', mediaConfig: '{}', status: 'draft', availableInChat: true };
const defaultVoicebotConnectorForm = { name: '', webhookSecret: '', executionEnabled: true, config: '{}', isActive: true };
const defaultVoicebotTemplateForm = { connectorId: '', name: '', method: 'POST', url: '', headers: '{}', queryParams: '{}', bodyTemplate: '{\n  "phone": "{{lead.mobile}}"\n}', responseConfig: '{}' };
const defaultVoicebotMappingForm = { connectorId: '', sampleBody: '{\n  "phone": "9845098450",\n  "status": "completed",\n  "intent": "interested"\n}', fieldMappings: '{\n  "phone": "phone",\n  "status": "status",\n  "intent": "intent",\n  "recordingUrl": "recordingUrl"\n}', isActive: true };
const defaultActivityMappingFields = [
  { value: 'phone', label: 'Phone' },
  { value: 'status', label: 'Status' },
  { value: 'intent', label: 'Intent' },
  { value: 'disposition', label: 'Disposition' },
  { value: 'recordingUrl', label: 'Recording URL' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'summary', label: 'Summary' },
  { value: 'duration', label: 'Duration' }
];

function flattenSamplePaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return prefix ? [prefix] : [];
  if (Array.isArray(value)) {
    if (!value.length) return prefix ? [prefix] : [];
    return flattenSamplePaths(value[0], prefix ? `${prefix}.0` : '0');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return prefix ? [prefix] : [];
  return entries.flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object') return flattenSamplePaths(item, path);
    return [path];
  });
}

export function ConnectorsView({ authToken, embedded = false }: { authToken: string | null; embedded?: boolean }) {
  const [connectorEvents, setConnectorEvents] = useState<ConnectorEvent[]>([]);
  const [connectorOverview, setConnectorOverview] = useState<ConnectorOverview>({});
  const [voicebotSample, setVoicebotSample] = useState('{\n  "phone": "9845098450",\n  "status": "completed",\n  "intent": "interested"\n}');
  const [connectorTab, setConnectorTab] = useState('telephony');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [apiEditingId, setApiEditingId] = useState<string | null>(null);
  const [apiForm, setApiForm] = useState(defaultApiForm);
  const [whatsAppConnectorDialogOpen, setWhatsAppConnectorDialogOpen] = useState(false);
  const [whatsAppConnectorEditingId, setWhatsAppConnectorEditingId] = useState<string | null>(null);
  const [whatsAppConnectorForm, setWhatsAppConnectorForm] = useState(defaultWhatsAppConnectorForm);
  const [whatsAppTemplateDialogOpen, setWhatsAppTemplateDialogOpen] = useState(false);
  const [whatsAppTemplateEditingId, setWhatsAppTemplateEditingId] = useState<string | null>(null);
  const [whatsAppTemplateForm, setWhatsAppTemplateForm] = useState(defaultWhatsAppTemplateForm);
  const [voicebotConnectorDialogOpen, setVoicebotConnectorDialogOpen] = useState(false);
  const [voicebotConnectorEditingId, setVoicebotConnectorEditingId] = useState<string | null>(null);
  const [voicebotConnectorForm, setVoicebotConnectorForm] = useState(defaultVoicebotConnectorForm);
  const [voicebotTemplateDialogOpen, setVoicebotTemplateDialogOpen] = useState(false);
  const [voicebotTemplateEditingId, setVoicebotTemplateEditingId] = useState<string | null>(null);
  const [voicebotTemplateForm, setVoicebotTemplateForm] = useState(defaultVoicebotTemplateForm);
  const [whatsAppNumberDialogOpen, setWhatsAppNumberDialogOpen] = useState(false);
  const [whatsAppNumberEditingId, setWhatsAppNumberEditingId] = useState<string | null>(null);
  const [whatsAppNumberForm, setWhatsAppNumberForm] = useState(defaultWhatsAppNumberForm);
  const [whatsAppSendForm, setWhatsAppSendForm] = useState(defaultWhatsAppSendForm);
  const [voicebotMappingDialogOpen, setVoicebotMappingDialogOpen] = useState(false);
  const [voicebotMappingEditingId, setVoicebotMappingEditingId] = useState<string | null>(null);
  const [voicebotMappingForm, setVoicebotMappingForm] = useState(defaultVoicebotMappingForm);
  const [voicebotTestTemplateId, setVoicebotTestTemplateId] = useState('');
  const [voicebotTestVariables, setVoicebotTestVariables] = useState('{}');
  const [variablePreview, setVariablePreview] = useState<string[]>([]);
  const [activityMappingFields, setActivityMappingFields] = useState<ActivityMappingField[]>(defaultActivityMappingFields);

  const parseJson = (value: string, fallback: Record<string, unknown> = {}) => {
    const trimmed = value.trim();
    try {
      return trimmed ? JSON.parse(trimmed) : fallback;
    } catch {
      setMessage('Invalid JSON. Please check the connector configuration.');
      throw new Error('Invalid JSON');
    }
  };

  const safeJson = (value: string) => {
    try {
      return value.trim() ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  };

  const configTextValue = (config: Record<string, unknown>, key: string, fallback = '') => {
    const value = config[key];
    return typeof value === 'string' && value !== '[masked]' ? value : fallback;
  };

  const objectConfig = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  );

  const buildWhatsAppConnectorConfig = () => ({
    providerType: 'meta_cloud_api',
    phoneNumberId: whatsAppConnectorForm.phoneNumberId.trim(),
    graphVersion: whatsAppConnectorForm.graphVersion.trim() || 'v23.0',
    accessToken: whatsAppConnectorForm.accessToken.trim(),
    defaultCountryCode: whatsAppConnectorForm.defaultCountryCode.replace(/\D/g, '') || '91',
    verifyToken: whatsAppConnectorForm.verifyToken.trim(),
    webhookSecret: whatsAppConnectorForm.webhookSecret.trim(),
    businessAccountId: whatsAppConnectorForm.businessAccountId.trim(),
    enableConverse: whatsAppConnectorForm.enableConverse,
    notifyMode: whatsAppConnectorForm.notifyMode,
    enableRichMedia: whatsAppConnectorForm.enableRichMedia,
    showUrlPreview: whatsAppConnectorForm.showUrlPreview,
    allowApprovedTemplates: whatsAppConnectorForm.allowApprovedTemplates,
    allowUnapprovedTemplates: whatsAppConnectorForm.allowUnapprovedTemplates,
    complianceType: whatsAppConnectorForm.complianceType,
    complianceFieldKey: whatsAppConnectorForm.complianceFieldKey.trim(),
    dailyRecipientLimit: Number(whatsAppConnectorForm.dailyRecipientLimit || 0),
    qualityRating: whatsAppConnectorForm.qualityRating.trim(),
    enableSendFromNumber: whatsAppConnectorForm.enableSendFromNumber,
    ...(whatsAppConnectorForm.outboundUrl.trim() ? { outboundUrl: whatsAppConnectorForm.outboundUrl.trim() } : {})
  });

  const samplePathRows = flattenSamplePaths(safeJson(voicebotMappingForm.sampleBody));
  const currentVoicebotMappings = safeJson(voicebotMappingForm.fieldMappings);
  const updateVoicebotMappingField = (payloadPath: string, activityField: string) => {
    const nextMappings = { ...currentVoicebotMappings };
    const existingKey = Object.keys(nextMappings).find((key) => nextMappings[key] === payloadPath);
    if (existingKey) delete nextMappings[existingKey];
    if (activityField) nextMappings[activityField] = payloadPath;
    setVoicebotMappingForm((form) => ({ ...form, fieldMappings: JSON.stringify(nextMappings, null, 2) }));
  };

  const loadConnectorOverview = async () => {
    const payload = await apiRequest<ConnectorOverview>('/connectors', { token: authToken });
    setConnectorOverview(payload ?? {});
    setConnectorEvents(Array.isArray(payload.events) ? payload.events : []);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadConnectorEvents() {
      try {
        const payload = await apiRequest<ConnectorOverview>('/connectors', { token: authToken });
        if (!cancelled) {
          setConnectorOverview(payload ?? {});
          setConnectorEvents(Array.isArray(payload.events) ? payload.events : []);
        }
      } catch {
        if (!cancelled) {
          setConnectorOverview({});
          setConnectorEvents([]);
        }
      }
    }
    void loadConnectorEvents();

    return () => {
      cancelled = true;
    };
  }, [authToken, connectorTab]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivityFields() {
      try {
        const payload = await apiRequest<Array<{ fieldKey: string; label: string }>>('/custom-fields/definitions?moduleName=Activity', { token: authToken });
        const custom = (Array.isArray(payload) ? payload : []).map((field) => ({ value: `custom.${field.fieldKey}`, label: `Custom: ${field.label}` }));
        if (!cancelled) setActivityMappingFields([...defaultActivityMappingFields, ...custom]);
      } catch {
        if (!cancelled) setActivityMappingFields(defaultActivityMappingFields);
      }
    }
    void loadActivityFields();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const mutateConnector = async <T = unknown,>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) => {
    if (!authToken) {
      setMessage('Login required');
      return null;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = await apiRequest<T>(path, {
        token: authToken,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      setMessage('Saved');
      await loadConnectorOverview();
      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openCreateApi = () => {
    setApiEditingId(null);
    setApiForm(defaultApiForm);
    setApiDialogOpen(true);
  };

  const openEditApi = (connector: GenericConnector) => {
    const config = connector.config ?? {};
    setApiEditingId(connector.id);
    setApiForm({
      name: connector.name ?? '',
      provider: connector.provider ?? '',
      method: String(config.method ?? 'POST'),
      url: String(config.url ?? ''),
      headers: JSON.stringify(config.headers ?? {}, null, 2),
      responseKeyword: String(config.responseKeyword ?? 'success'),
      body: JSON.stringify(config.bodyTemplate ?? {}, null, 2),
      isActive: Boolean(connector.isActive)
    });
    setApiDialogOpen(true);
  };

  const saveApiConnector = async () => {
    try {
      const body = {
        name: apiForm.name,
        type: 'api_call',
        provider: apiForm.provider || undefined,
        isActive: apiForm.isActive,
        config: {
          method: apiForm.method,
          url: apiForm.url,
          headers: parseJson(apiForm.headers),
          responseKeyword: apiForm.responseKeyword,
          bodyTemplate: parseJson(apiForm.body)
        }
      };
      const saved = await mutateConnector(apiEditingId ? `/connectors/api/${apiEditingId}` : '/connectors/api', apiEditingId ? 'PATCH' : 'POST', body);
      if (saved) setApiDialogOpen(false);
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const saveWhatsAppConnector = async () => {
    try {
      const saved = await mutateConnector(
        whatsAppConnectorEditingId ? `/connectors/whatsapp/connectors/${whatsAppConnectorEditingId}` : '/connectors/whatsapp/connectors',
        whatsAppConnectorEditingId ? 'PATCH' : 'POST',
        { name: whatsAppConnectorForm.name, provider: whatsAppConnectorForm.provider, config: buildWhatsAppConnectorConfig(), isActive: whatsAppConnectorForm.isActive }
      );
      if (saved) setWhatsAppConnectorDialogOpen(false);
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const openCreateWhatsAppConnector = () => {
    setWhatsAppConnectorEditingId(null);
    setWhatsAppConnectorForm(defaultWhatsAppConnectorForm);
    setWhatsAppConnectorDialogOpen(true);
  };

  const openEditWhatsAppConnector = (connector: GenericConnector) => {
    const config = connector.config ?? {};
    setWhatsAppConnectorEditingId(connector.id);
    setWhatsAppConnectorForm({
      name: connector.name ?? '',
      provider: connector.provider ?? 'Meta Cloud API',
      phoneNumberId: configTextValue(config, 'phoneNumberId', configTextValue(config, 'metaPhoneNumberId')),
      graphVersion: configTextValue(config, 'graphVersion', configTextValue(config, 'apiVersion', 'v23.0')),
      accessToken: '',
      defaultCountryCode: configTextValue(config, 'defaultCountryCode', configTextValue(config, 'countryCode', '91')),
      verifyToken: '',
      webhookSecret: '',
      outboundUrl: configTextValue(config, 'outboundUrl', configTextValue(config, 'sendUrl')),
      businessAccountId: configTextValue(config, 'businessAccountId', configTextValue(config, 'wabaId')),
      enableConverse: config.enableConverse !== false,
      notifyMode: String(config.notifyMode ?? 'lead_owner'),
      enableRichMedia: config.enableRichMedia !== false,
      showUrlPreview: config.showUrlPreview === true,
      allowApprovedTemplates: config.allowApprovedTemplates !== false,
      allowUnapprovedTemplates: config.allowUnapprovedTemplates === true,
      complianceType: String(config.complianceType ?? 'opt_out'),
      complianceFieldKey: configTextValue(config, 'complianceFieldKey', 'whatsapp_opt_out'),
      dailyRecipientLimit: String(config.dailyRecipientLimit ?? 0),
      qualityRating: configTextValue(config, 'qualityRating'),
      enableSendFromNumber: config.enableSendFromNumber !== false,
      isActive: Boolean(connector.isActive)
    });
    setWhatsAppConnectorDialogOpen(true);
  };

  const saveWhatsAppTemplate = async () => {
    try {
      const saved = await mutateConnector(
        whatsAppTemplateEditingId ? `/connectors/whatsapp/templates/${whatsAppTemplateEditingId}` : '/connectors/whatsapp/templates',
        whatsAppTemplateEditingId ? 'PATCH' : 'POST',
        { ...whatsAppTemplateForm, mediaConfig: parseJson(whatsAppTemplateForm.mediaConfig) }
      );
      if (saved) setWhatsAppTemplateDialogOpen(false);
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const openCreateWhatsAppTemplate = () => {
    setWhatsAppTemplateEditingId(null);
    setWhatsAppTemplateForm({ ...defaultWhatsAppTemplateForm, connectorId: (connectorOverview.whatsAppConnectors ?? [])[0]?.id ?? '' });
    setWhatsAppTemplateDialogOpen(true);
  };

  const openCreateWhatsAppNumber = () => {
    setWhatsAppNumberEditingId(null);
    setWhatsAppNumberForm({ ...defaultWhatsAppNumberForm, connectorId: (connectorOverview.whatsAppConnectors ?? [])[0]?.id ?? '' });
    setWhatsAppNumberDialogOpen(true);
  };

  const openEditWhatsAppNumber = (number: WhatsAppNumber) => {
    setWhatsAppNumberEditingId(number.id);
    setWhatsAppNumberForm({
      connectorId: number.connectorId ?? '',
      phoneNumber: number.phoneNumber ?? '',
      label: number.label ?? '',
      isDefault: Boolean(number.isDefault),
      isActive: Boolean(number.isActive)
    });
    setWhatsAppNumberDialogOpen(true);
  };

  const saveWhatsAppNumber = async () => {
    const saved = await mutateConnector(
      whatsAppNumberEditingId ? `/connectors/whatsapp/numbers/${whatsAppNumberEditingId}` : '/connectors/whatsapp/numbers',
      whatsAppNumberEditingId ? 'PATCH' : 'POST',
      whatsAppNumberForm
    );
    if (saved) setWhatsAppNumberDialogOpen(false);
  };

  const sendWhatsAppMessage = async () => {
    const saved = await mutateConnector('/connectors/whatsapp/messages', 'POST', {
      leadId: whatsAppSendForm.leadId || undefined,
      templateId: whatsAppSendForm.templateId || undefined,
      content: whatsAppSendForm.content || undefined,
      messageType: whatsAppSendForm.templateId ? 'template' : 'text'
    });
    if (saved) setWhatsAppSendForm(defaultWhatsAppSendForm);
  };

  const openEditWhatsAppTemplate = (template: WhatsAppTemplate) => {
    setWhatsAppTemplateEditingId(template.id);
    setWhatsAppTemplateForm({
      connectorId: template.connectorId ?? '',
      name: template.name ?? '',
      category: template.category ?? '',
      language: template.language ?? 'en',
      content: template.content ?? '',
      mediaConfig: JSON.stringify(template.mediaConfig ?? {}, null, 2),
      status: template.status ?? 'draft',
      availableInChat: Boolean(template.availableInChat)
    });
    setWhatsAppTemplateDialogOpen(true);
  };

  const saveVoicebotConnector = async () => {
    try {
      const extraConfig = parseJson(voicebotConnectorForm.config);
      const saved = await mutateConnector(
        voicebotConnectorEditingId ? `/connectors/voicebot/connectors/${voicebotConnectorEditingId}` : '/connectors/voicebot/connectors',
        voicebotConnectorEditingId ? 'PATCH' : 'POST',
        {
          name: voicebotConnectorForm.name,
          config: {
            ...extraConfig,
            webhookSecret: voicebotConnectorForm.webhookSecret.trim(),
            executionEnabled: voicebotConnectorForm.executionEnabled
          },
          isActive: voicebotConnectorForm.isActive
        }
      );
      if (saved) setVoicebotConnectorDialogOpen(false);
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const openCreateVoicebotConnector = () => {
    setVoicebotConnectorEditingId(null);
    setVoicebotConnectorForm(defaultVoicebotConnectorForm);
    setVoicebotConnectorDialogOpen(true);
  };

  const openCreateVoicebotTemplate = () => {
    setVoicebotTemplateEditingId(null);
    setVoicebotTemplateForm({ ...defaultVoicebotTemplateForm, connectorId: (connectorOverview.voicebotConnectors ?? [])[0]?.id ?? '' });
    setVoicebotTemplateDialogOpen(true);
  };

  const openEditVoicebotTemplate = (template: VoicebotTemplate) => {
    setVoicebotTemplateEditingId(template.id);
    setVoicebotTemplateForm({
      connectorId: template.connectorId ?? '',
      name: template.name ?? '',
      method: template.method ?? 'POST',
      url: template.url ?? '',
      headers: JSON.stringify(template.headers ?? {}, null, 2),
      queryParams: JSON.stringify(template.queryParams ?? {}, null, 2),
      bodyTemplate: JSON.stringify(template.bodyTemplate ?? {}, null, 2),
      responseConfig: JSON.stringify(template.responseConfig ?? {}, null, 2)
    });
    setVoicebotTemplateDialogOpen(true);
  };

  const openEditVoicebotConnector = (connector: GenericConnector) => {
    setVoicebotConnectorEditingId(connector.id);
    const config = objectConfig(connector.config);
    const additionalConfig = Object.fromEntries(Object.entries(config).filter(([key]) => !['webhookSecret', 'secret', 'executionEnabled'].includes(key)));
    setVoicebotConnectorForm({
      name: connector.name ?? '',
      webhookSecret: configTextValue(config, 'webhookSecret', configTextValue(config, 'secret')),
      executionEnabled: config.executionEnabled !== false,
      config: JSON.stringify(additionalConfig, null, 2),
      isActive: Boolean(connector.isActive)
    });
    setVoicebotConnectorDialogOpen(true);
  };

  const saveVoicebotTemplate = async () => {
    try {
      const saved = await mutateConnector(voicebotTemplateEditingId ? `/connectors/voicebot/templates/${voicebotTemplateEditingId}` : '/connectors/voicebot/templates', voicebotTemplateEditingId ? 'PATCH' : 'POST', {
        connectorId: voicebotTemplateForm.connectorId,
        name: voicebotTemplateForm.name,
        method: voicebotTemplateForm.method,
        url: voicebotTemplateForm.url,
        headers: parseJson(voicebotTemplateForm.headers),
        queryParams: parseJson(voicebotTemplateForm.queryParams),
        bodyTemplate: parseJson(voicebotTemplateForm.bodyTemplate),
        responseConfig: parseJson(voicebotTemplateForm.responseConfig)
      });
      if (saved) setVoicebotTemplateDialogOpen(false);
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const extractVariables = async (template: unknown) => {
    if (!authToken) return;
    try {
      const payload = await apiRequest<{ variables: string[] }>('/connectors/extract-variables', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
      });
      setVariablePreview(payload.variables ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Variable extraction failed');
    }
  };

  const saveVoicebotMapping = async () => {
    try {
      const saved = await mutateConnector(voicebotMappingEditingId ? `/connectors/voicebot/webhook-mappings/${voicebotMappingEditingId}` : '/connectors/voicebot/webhook-mappings', voicebotMappingEditingId ? 'PATCH' : 'POST', {
        connectorId: voicebotMappingForm.connectorId,
        sampleBody: parseJson(voicebotMappingForm.sampleBody),
        fieldMappings: parseJson(voicebotMappingForm.fieldMappings),
        isActive: voicebotMappingForm.isActive
      });
      if (saved) setVoicebotMappingDialogOpen(false);
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const openCreateVoicebotMapping = () => {
    setVoicebotMappingEditingId(null);
    setVoicebotMappingForm({ ...defaultVoicebotMappingForm, connectorId: (connectorOverview.voicebotConnectors ?? [])[0]?.id ?? '' });
    setVoicebotMappingDialogOpen(true);
  };

  const openEditVoicebotMapping = (mapping: VoicebotWebhookMapping) => {
    setVoicebotMappingEditingId(mapping.id);
    setVoicebotMappingForm({
      connectorId: mapping.connectorId ?? '',
      sampleBody: JSON.stringify(mapping.sampleBody ?? {}, null, 2),
      fieldMappings: JSON.stringify(mapping.fieldMappings ?? {}, null, 2),
      isActive: Boolean(mapping.isActive)
    });
    setVoicebotMappingDialogOpen(true);
  };

  const testVoicebotCall = async () => {
    if (!voicebotTestTemplateId) return;
    try {
      const saved = await mutateConnector<{ requiredVariables?: unknown[]; missingVariables?: unknown[] }>(`/connectors/voicebot/templates/${voicebotTestTemplateId}/test-call`, 'POST', {
        variables: parseJson(voicebotTestVariables),
        dryRun: true
      });
      if (saved) setVariablePreview((saved.requiredVariables ?? saved.missingVariables ?? []).map(String));
    } catch {
      // parseJson already set a user-facing message.
    }
  };

  const body = (
      <Stack spacing={1}>
        <MessageAlert message={message} />
        <SegmentedTabs
          value={connectorTab}
          onChange={setConnectorTab}
          tabs={[
            { value: 'telephony', label: 'Telephony' },
            { value: 'api', label: 'API Call' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'voicebot', label: 'Voicebot' },
            { value: 'logs', label: 'Logs' }
          ]}
        />
        {connectorTab === 'telephony' ? <TelephonyConnectorPanel authToken={authToken} embedded={embedded} connectorEvents={connectorEvents} /> : null}
        {connectorTab === 'api' ? (
          <ApiCallConnectorPanel
            connectorOverview={connectorOverview}
            openCreateApi={openCreateApi}
            openEditApi={openEditApi}
            deleteApiConnector={(connectorId) => void mutateConnector(`/connectors/api/${connectorId}`, 'DELETE')}
          />
        ) : null}
        {connectorTab === 'whatsapp' ? (
          <WhatsAppConnectorPanel
            connectorOverview={connectorOverview}
            variablePreview={variablePreview}
            whatsAppSendForm={whatsAppSendForm}
            saving={saving}
            setWhatsAppSendForm={setWhatsAppSendForm}
            openCreateWhatsAppNumber={openCreateWhatsAppNumber}
            openCreateWhatsAppTemplate={openCreateWhatsAppTemplate}
            openCreateWhatsAppConnector={openCreateWhatsAppConnector}
            openEditWhatsAppConnector={openEditWhatsAppConnector}
            openEditWhatsAppNumber={openEditWhatsAppNumber}
            openEditWhatsAppTemplate={openEditWhatsAppTemplate}
            deleteWhatsAppConnector={(connectorId) => void mutateConnector(`/connectors/whatsapp/connectors/${connectorId}`, 'DELETE')}
            deleteWhatsAppNumber={(numberId) => void mutateConnector(`/connectors/whatsapp/numbers/${numberId}`, 'DELETE')}
            deleteWhatsAppTemplate={(templateId) => void mutateConnector(`/connectors/whatsapp/templates/${templateId}`, 'DELETE')}
            extractVariables={extractVariables}
            sendWhatsAppMessage={sendWhatsAppMessage}
            syncWhatsAppTemplates={(connectorId) => void mutateConnector(`/connectors/whatsapp/connectors/${connectorId}/sync-templates`, 'POST')}
          />
        ) : null}
        {connectorTab === 'voicebot' ? (
          <VoicebotConnectorPanel
            connectorOverview={connectorOverview}
            voicebotSample={voicebotSample}
            voicebotTestTemplateId={voicebotTestTemplateId}
            voicebotTestVariables={voicebotTestVariables}
            setVoicebotSample={setVoicebotSample}
            setVoicebotTestTemplateId={setVoicebotTestTemplateId}
            setVoicebotTestVariables={setVoicebotTestVariables}
            openCreateVoicebotMapping={openCreateVoicebotMapping}
            openCreateVoicebotTemplate={openCreateVoicebotTemplate}
            openCreateVoicebotConnector={openCreateVoicebotConnector}
            openEditVoicebotConnector={openEditVoicebotConnector}
            openEditVoicebotTemplate={openEditVoicebotTemplate}
            openEditVoicebotMapping={openEditVoicebotMapping}
            deleteVoicebotConnector={(connectorId) => void mutateConnector(`/connectors/voicebot/connectors/${connectorId}`, 'DELETE')}
            deleteVoicebotTemplate={(templateId) => void mutateConnector(`/connectors/voicebot/templates/${templateId}`, 'DELETE')}
            deleteVoicebotMapping={(mappingId) => void mutateConnector(`/connectors/voicebot/webhook-mappings/${mappingId}`, 'DELETE')}
            extractVariables={extractVariables}
            testVoicebotCall={testVoicebotCall}
          />
        ) : null}
        {connectorTab === 'logs' ? <ConnectorLogsPanel connectorEvents={connectorEvents} /> : null}
        <FormDialog
          open={apiDialogOpen}
          title={apiEditingId ? 'Edit API Connector' : 'Create API Connector'}
          subtitle="Reusable API call connector for automation nodes. Body supports lead, user, and activity merge fields."
          onClose={() => setApiDialogOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setApiDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !apiForm.name || !apiForm.url} onClick={saveApiConnector}>Save API</Button>
          ]}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField size="small" label="Connector name" value={apiForm.name} onChange={(event) => setApiForm((form) => ({ ...form, name: event.target.value }))} />
              <TextField size="small" label="Provider" value={apiForm.provider} onChange={(event) => setApiForm((form) => ({ ...form, provider: event.target.value }))} />
              <FormControl size="small">
                <Select value={apiForm.method} onChange={(event) => setApiForm((form) => ({ ...form, method: event.target.value }))}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Response keyword" value={apiForm.responseKeyword} onChange={(event) => setApiForm((form) => ({ ...form, responseKeyword: event.target.value }))} />
              <TextField size="small" label="URL" value={apiForm.url} onChange={(event) => setApiForm((form) => ({ ...form, url: event.target.value }))} sx={{ gridColumn: { md: '1 / -1' } }} />
            </Box>
            <VariableSuggestionChips />
            <TextField size="small" label="Headers JSON" multiline minRows={3} value={apiForm.headers} onChange={(event) => setApiForm((form) => ({ ...form, headers: event.target.value }))} />
            <TextField size="small" label="Body template JSON" multiline minRows={8} value={apiForm.body} onChange={(event) => setApiForm((form) => ({ ...form, body: event.target.value }))} />
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Checkbox checked={apiForm.isActive} onChange={(event) => setApiForm((form) => ({ ...form, isActive: event.target.checked }))} />
              <Typography>Active</Typography>
            </Stack>
          </Stack>
        </FormDialog>
        <FormDialog
          open={whatsAppConnectorDialogOpen}
          title={whatsAppConnectorEditingId ? 'Edit WhatsApp Connector' : 'Create WhatsApp Connector'}
          subtitle="Connect Meta WhatsApp Cloud API for automation, counsellor chat, and delivery/read status updates."
          onClose={() => setWhatsAppConnectorDialogOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setWhatsAppConnectorDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !whatsAppConnectorForm.name || !whatsAppConnectorForm.phoneNumberId || (!whatsAppConnectorEditingId && !whatsAppConnectorForm.accessToken) || (!whatsAppConnectorEditingId && !whatsAppConnectorForm.verifyToken)} onClick={saveWhatsAppConnector}>Save Connector</Button>
          ]}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField size="small" label="Connector name" value={whatsAppConnectorForm.name} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, name: event.target.value }))} />
              <TextField size="small" label="Provider" value={whatsAppConnectorForm.provider} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, provider: event.target.value }))} />
              <TextField size="small" label="Phone number ID" value={whatsAppConnectorForm.phoneNumberId} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, phoneNumberId: event.target.value }))} />
              <TextField size="small" label="Graph version" value={whatsAppConnectorForm.graphVersion} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, graphVersion: event.target.value }))} />
              <TextField size="small" label="Business Account ID" value={whatsAppConnectorForm.businessAccountId} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, businessAccountId: event.target.value }))} />
              <TextField size="small" label="Quality rating" value={whatsAppConnectorForm.qualityRating} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, qualityRating: event.target.value }))} />
              <TextField
                size="small"
                label={whatsAppConnectorEditingId ? 'Access token (leave blank to keep)' : 'Access token'}
                type="password"
                value={whatsAppConnectorForm.accessToken}
                onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, accessToken: event.target.value }))}
              />
              <TextField size="small" label="Default country code" value={whatsAppConnectorForm.defaultCountryCode} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, defaultCountryCode: event.target.value.replace(/\D/g, '').slice(0, 4) }))} />
              <FormControl size="small">
                <Select value={whatsAppConnectorForm.complianceType} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, complianceType: event.target.value }))}>
                  <MenuItem value="opt_out">Opt-out field</MenuItem>
                  <MenuItem value="opt_in">Opt-in field</MenuItem>
                  <MenuItem value="none">No compliance field</MenuItem>
                </Select>
              </FormControl>
              <TextField size="small" label="Compliance field key" value={whatsAppConnectorForm.complianceFieldKey} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, complianceFieldKey: event.target.value }))} />
              <TextField size="small" type="number" label="Daily unique recipient limit" value={whatsAppConnectorForm.dailyRecipientLimit} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, dailyRecipientLimit: event.target.value }))} />
              <FormControl size="small">
                <Select value={whatsAppConnectorForm.notifyMode} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, notifyMode: event.target.value }))}>
                  <MenuItem value="lead_owner">Notify lead owner</MenuItem>
                  <MenuItem value="last_sender">Notify last sender</MenuItem>
                  <MenuItem value="none">No chat notification owner</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={whatsAppConnectorEditingId ? 'Webhook verify token (leave blank to keep)' : 'Webhook verify token'}
                type="password"
                value={whatsAppConnectorForm.verifyToken}
                onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, verifyToken: event.target.value }))}
              />
              <TextField
                size="small"
                label="Webhook secret header (optional)"
                type="password"
                value={whatsAppConnectorForm.webhookSecret}
                onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, webhookSecret: event.target.value }))}
              />
              <TextField
                size="small"
                label="Custom send URL (optional)"
                helperText="Leave empty for Meta Cloud API default URL."
                value={whatsAppConnectorForm.outboundUrl}
                onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, outboundUrl: event.target.value }))}
                sx={{ gridColumn: { md: '1 / -1' } }}
              />
            </Box>
            <TextField size="small" label="Webhook URL" value={`${apiBaseUrl}/connectors/whatsapp/webhook`} InputProps={{ readOnly: true }} />
            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Checkbox checked={whatsAppConnectorForm.isActive} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, isActive: event.target.checked }))} />
              <Typography>Active</Typography>
              <Checkbox checked={whatsAppConnectorForm.enableConverse} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, enableConverse: event.target.checked }))} />
              <Typography>Converse chat</Typography>
              <Checkbox checked={whatsAppConnectorForm.enableRichMedia} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, enableRichMedia: event.target.checked }))} />
              <Typography>Rich media</Typography>
              <Checkbox checked={whatsAppConnectorForm.showUrlPreview} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, showUrlPreview: event.target.checked }))} />
              <Typography>URL preview</Typography>
              <Checkbox checked={whatsAppConnectorForm.allowApprovedTemplates} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, allowApprovedTemplates: event.target.checked }))} />
              <Typography>Approved templates</Typography>
              <Checkbox checked={whatsAppConnectorForm.allowUnapprovedTemplates} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, allowUnapprovedTemplates: event.target.checked }))} />
              <Typography>Unapproved inside 24h</Typography>
              <Checkbox checked={whatsAppConnectorForm.enableSendFromNumber} onChange={(event) => setWhatsAppConnectorForm((form) => ({ ...form, enableSendFromNumber: event.target.checked }))} />
              <Typography>Choose send number</Typography>
            </Stack>
          </Stack>
        </FormDialog>
        <FormDialog
          open={whatsAppTemplateDialogOpen}
          title={whatsAppTemplateEditingId ? 'Edit WhatsApp Template' : 'Create WhatsApp Template'}
          subtitle="Templates can be used from automation and counsellor chat when enabled."
          onClose={() => setWhatsAppTemplateDialogOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setWhatsAppTemplateDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !whatsAppTemplateForm.connectorId || !whatsAppTemplateForm.name} onClick={saveWhatsAppTemplate}>Save Template</Button>
          ]}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <FormControl size="small">
                <Select displayEmpty value={whatsAppTemplateForm.connectorId} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, connectorId: event.target.value }))}>
                  <MenuItem value="">Select connector</MenuItem>
                  {(connectorOverview.whatsAppConnectors ?? []).map((connector) => <MenuItem key={connector.id} value={connector.id}>{connector.name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Template name" value={whatsAppTemplateForm.name} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, name: event.target.value }))} />
              <TextField size="small" label="Category" value={whatsAppTemplateForm.category} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, category: event.target.value }))} />
              <TextField size="small" label="Language" value={whatsAppTemplateForm.language} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, language: event.target.value }))} />
              <FormControl size="small">
                <Select value={whatsAppTemplateForm.status} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, status: event.target.value }))}>
                  {['review_required', 'draft', 'approved', 'active', 'paused', 'archived'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <VariableSuggestionChips onInsert={(token) => setWhatsAppTemplateForm((form) => ({ ...form, content: appendMergeToken(form.content, token) }))} />
            <TextField
              size="small"
              label="Template content"
              helperText="Use merge fields like {{lead.mobile}}. Click a suggestion above to insert it."
              multiline
              minRows={6}
              value={whatsAppTemplateForm.content}
              onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, content: event.target.value }))}
            />
            <TextField size="small" label="Media config JSON" multiline minRows={4} value={whatsAppTemplateForm.mediaConfig} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, mediaConfig: event.target.value }))} />
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Checkbox checked={whatsAppTemplateForm.availableInChat} onChange={(event) => setWhatsAppTemplateForm((form) => ({ ...form, availableInChat: event.target.checked }))} />
              <Typography>Available in counsellor chat</Typography>
            </Stack>
          </Stack>
        </FormDialog>
        <FormDialog
          open={whatsAppNumberDialogOpen}
          title={whatsAppNumberEditingId ? 'Edit WhatsApp Number' : 'Add WhatsApp Number'}
          subtitle="Register a 10-digit business number against a WhatsApp connector."
          onClose={() => setWhatsAppNumberDialogOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setWhatsAppNumberDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !whatsAppNumberForm.connectorId || !whatsAppNumberForm.phoneNumber} onClick={saveWhatsAppNumber}>Save Number</Button>
          ]}
        >
          <Stack spacing={1}>
            <FormControl size="small">
              <Select displayEmpty value={whatsAppNumberForm.connectorId} onChange={(event) => setWhatsAppNumberForm((form) => ({ ...form, connectorId: event.target.value }))}>
                <MenuItem value="">Select connector</MenuItem>
                {(connectorOverview.whatsAppConnectors ?? []).map((connector) => <MenuItem key={connector.id} value={connector.id}>{connector.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField size="small" label="10-digit number" value={whatsAppNumberForm.phoneNumber} onChange={(event) => setWhatsAppNumberForm((form) => ({ ...form, phoneNumber: event.target.value.replace(/\D/g, '').slice(-10) }))} />
              <TextField size="small" label="Label" value={whatsAppNumberForm.label} onChange={(event) => setWhatsAppNumberForm((form) => ({ ...form, label: event.target.value }))} />
            </Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Checkbox checked={whatsAppNumberForm.isDefault} onChange={(event) => setWhatsAppNumberForm((form) => ({ ...form, isDefault: event.target.checked }))} />
              <Typography>Default number</Typography>
              <Checkbox checked={whatsAppNumberForm.isActive} onChange={(event) => setWhatsAppNumberForm((form) => ({ ...form, isActive: event.target.checked }))} />
              <Typography>Active</Typography>
            </Stack>
          </Stack>
        </FormDialog>
        <FormDialog
          open={voicebotConnectorDialogOpen}
          title={voicebotConnectorEditingId ? 'Edit Voicebot Connector' : 'Create Voicebot Connector'}
          subtitle="Store voicebot provider credentials and webhook behavior."
          onClose={() => setVoicebotConnectorDialogOpen(false)}
          actions={[
            <Button key="cancel" onClick={() => setVoicebotConnectorDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !voicebotConnectorForm.name} onClick={saveVoicebotConnector}>Save Connector</Button>
          ]}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField size="small" label="Connector name" value={voicebotConnectorForm.name} onChange={(event) => setVoicebotConnectorForm((form) => ({ ...form, name: event.target.value }))} />
              <TextField size="small" label="Webhook secret" type="password" value={voicebotConnectorForm.webhookSecret} onChange={(event) => setVoicebotConnectorForm((form) => ({ ...form, webhookSecret: event.target.value }))} />
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
              <Checkbox checked={voicebotConnectorForm.executionEnabled} onChange={(event) => setVoicebotConnectorForm((form) => ({ ...form, executionEnabled: event.target.checked }))} />
              <Typography>Enable provider execution</Typography>
              <Checkbox checked={voicebotConnectorForm.isActive} onChange={(event) => setVoicebotConnectorForm((form) => ({ ...form, isActive: event.target.checked }))} />
              <Typography>Active</Typography>
            </Stack>
            <TextField size="small" label="Additional config JSON" multiline minRows={5} value={voicebotConnectorForm.config} onChange={(event) => setVoicebotConnectorForm((form) => ({ ...form, config: event.target.value }))} />
          </Stack>
        </FormDialog>
        <FormDialog
          open={voicebotTemplateDialogOpen}
          title={voicebotTemplateEditingId ? 'Edit Voicebot Trigger' : 'Create Voicebot Trigger'}
          subtitle="Map an automation trigger to a provider API call. Variables are read from the body template."
          onClose={() => setVoicebotTemplateDialogOpen(false)}
          maxWidth="lg"
          actions={[
            <Button key="cancel" onClick={() => setVoicebotTemplateDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !voicebotTemplateForm.connectorId || !voicebotTemplateForm.name || !voicebotTemplateForm.url} onClick={saveVoicebotTemplate}>Save Trigger</Button>
          ]}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 160px' } }}>
              <FormControl size="small">
                <Select displayEmpty value={voicebotTemplateForm.connectorId} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, connectorId: event.target.value }))}>
                  <MenuItem value="">Select connector</MenuItem>
                  {(connectorOverview.voicebotConnectors ?? []).map((connector) => <MenuItem key={connector.id} value={connector.id}>{connector.name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Trigger name" value={voicebotTemplateForm.name} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, name: event.target.value }))} />
              <FormControl size="small">
                <Select value={voicebotTemplateForm.method} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, method: event.target.value }))}>
                  {['GET', 'POST', 'PUT', 'PATCH'].map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Provider URL" value={voicebotTemplateForm.url} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, url: event.target.value }))} sx={{ gridColumn: { md: '1 / -1' } }} />
            </Box>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField size="small" label="Headers JSON" multiline minRows={5} value={voicebotTemplateForm.headers} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, headers: event.target.value }))} />
              <TextField size="small" label="Query params JSON" multiline minRows={5} value={voicebotTemplateForm.queryParams} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, queryParams: event.target.value }))} />
              <TextField size="small" label="Body template JSON" multiline minRows={7} value={voicebotTemplateForm.bodyTemplate} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, bodyTemplate: event.target.value }))} />
              <TextField size="small" label="Response config JSON" multiline minRows={7} value={voicebotTemplateForm.responseConfig} onChange={(event) => setVoicebotTemplateForm((form) => ({ ...form, responseConfig: event.target.value }))} />
            </Box>
          </Stack>
        </FormDialog>
        <FormDialog
          open={voicebotMappingDialogOpen}
          title={voicebotMappingEditingId ? 'Edit Voicebot Webhook Mapping' : 'Voicebot Webhook Mapping'}
          subtitle="Paste the sample body and map payload paths to activity fields."
          onClose={() => setVoicebotMappingDialogOpen(false)}
          maxWidth="lg"
          actions={[
            <Button key="cancel" onClick={() => setVoicebotMappingDialogOpen(false)}>Cancel</Button>,
            <Button key="save" variant="contained" disabled={saving || !voicebotMappingForm.connectorId} onClick={saveVoicebotMapping}>Save Mapping</Button>
          ]}
        >
          <Stack spacing={1}>
            <FormControl size="small">
              <Select displayEmpty value={voicebotMappingForm.connectorId} onChange={(event) => setVoicebotMappingForm((form) => ({ ...form, connectorId: event.target.value }))}>
                <MenuItem value="">Select connector</MenuItem>
                {(connectorOverview.voicebotConnectors ?? []).map((connector) => <MenuItem key={connector.id} value={connector.id}>{connector.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField size="small" label="Sample body JSON" multiline minRows={8} value={voicebotMappingForm.sampleBody} onChange={(event) => setVoicebotMappingForm((form) => ({ ...form, sampleBody: event.target.value }))} />
              <Stack spacing={0.75}>
                <Typography fontWeight={800} fontSize={13}>Detected payload mapping</Typography>
                <CompactDataTable
                  columns={['Sample Path', 'Activity Field']}
                  rows={samplePathRows.map((path) => {
                    const selectedField = Object.entries(currentVoicebotMappings).find(([, mappedPath]) => mappedPath === path)?.[0] ?? '';
                    return [
                      path,
                      <FormControl key={`${path}-field`} size="small" fullWidth>
                        <Select displayEmpty value={selectedField} onChange={(event) => updateVoicebotMappingField(path, event.target.value)}>
                          <MenuItem value="">Do not map</MenuItem>
                          {activityMappingFields.map((field) => <MenuItem key={field.value} value={field.value}>{field.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                    ];
                  })}
                  emptyLabel="Paste a valid sample body to detect fields"
                />
                <TextField size="small" label="Field mappings JSON" multiline minRows={3} value={voicebotMappingForm.fieldMappings} onChange={(event) => setVoicebotMappingForm((form) => ({ ...form, fieldMappings: event.target.value }))} />
              </Stack>
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Checkbox checked={voicebotMappingForm.isActive} onChange={(event) => setVoicebotMappingForm((form) => ({ ...form, isActive: event.target.checked }))} />
              <Typography>Active mapping</Typography>
            </Stack>
          </Stack>
        </FormDialog>
      </Stack>
  );

  if (embedded) return body;

  return (
    <ModuleShell title="Connectors" subtitle="Telephony, WhatsApp, voicebot, and API connector actions for users and automation.">
      {body}
    </ModuleShell>
  );
}

function VariableSuggestionChips({ onInsert }: { onInsert?: (suggestion: string) => void }) {
  const suggestions = [
    '{{lead.customerName}}',
    '{{lead.mobile}}',
    '{{lead.status}}',
    '{{lead.category}}',
    '{{lead.branchCode}}',
    '{{lead.branchName}}',
    '{{lead.offerAmount}}',
    '{{user.name}}',
    '{{user.phone}}',
    '{{activity.disposition}}',
    '{{lead.custom.field_key}}',
    '{{activity.custom.field_key}}'
  ];
  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap">
      {suggestions.map((suggestion) => (
        <AppChip
          key={suggestion}
          label={suggestion}
          onClick={onInsert ? () => onInsert(suggestion) : undefined}
          sx={onInsert ? { cursor: 'pointer', '&:hover': { bgcolor: '#eef7ee', borderColor: '#2d6a2d' } } : undefined}
        />
      ))}
    </Stack>
  );
}

function appendMergeToken(value: string, token: string) {
  const current = value ?? '';
  const spacer = !current || /\s$/.test(current) ? '' : ' ';
  return `${current}${spacer}${token}`;
}
