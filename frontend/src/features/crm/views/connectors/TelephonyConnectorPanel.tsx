'use client';

import PhoneForwardedIcon from '@mui/icons-material/PhoneForwarded';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { AppChip } from '../../../../components/common/AppChip';
import { CompactDataTable } from '../../../../components/common/CompactDataTable';
import { MessageAlert } from '../../../../components/common/MessageAlert';
import { SectionPanel as Section } from '../../../../components/common/WorkspacePrimitives';
import { apiBaseUrl, apiRequest } from '../../../../lib/api';
import { formatDateTime, humanizeKey } from '../../../../lib/format';
import { AgentPopupConfigPanel } from './AgentPopupConfigPanel';
import { ClickToCallConfigPanel } from './ClickToCallConfigPanel';
import type {
  ConnectorEvent,
  TelephonyAccessUser,
  TelephonyClickTestForm,
  TelephonyConfigForm,
  TelephonyConnector,
  TelephonyConnectorConfig,
  TelephonyEndpoint,
  TelephonyMappingForm,
  TelephonyReference
} from './connector-types';

const green = '#2d6a2d';

type AccessOverview = { users?: TelephonyAccessUser[] };

const popupFieldOptions = [
  { value: 'customerName', label: 'Customer Name' },
  { value: 'mobile', label: 'Mobile Number' },
  { value: 'status', label: 'Lead Status' },
  { value: 'category', label: 'Lead Category' },
  { value: 'disposition', label: 'Lead Disposition' },
  { value: 'branchCode', label: 'Branch Code' },
  { value: 'branchName', label: 'Branch Name' },
  { value: 'offerAmount', label: 'Loan Offer Amount' },
  { value: 'emiAmount', label: 'EMI Amount' },
  { value: 'preferredLanguage', label: 'Preferred Language' },
  { value: 'customerLocation', label: 'Customer Location' },
  { value: 'partnerMapping', label: 'Partner Mapping' }
];

const popupTabOptions = ['Overview', 'Activities', 'Dispositions', 'Tasks', 'Calls', 'Notes', 'Custom Fields', 'Automation History'];

const fallbackTelephonyReference: TelephonyReference = {
  provider: 'MCUBE',
  phoneRule: 'Lead and user phone numbers are stored and returned as 10 digits only.',
  endpoints: [
    {
      key: 'lead-route',
      title: 'Inbound Call Route API',
      method: 'GET',
      url: `${apiBaseUrl}/webhooks/telephony/lead-route?caller_id=9845098450`,
      requiredHeaders: { 'x-webhook-secret': '<configured in Telephony connector>' },
      responseType: 'text/plain',
      sampleResponse: '9123456789',
      blankResponseRule: 'Returns blank text when no lead or agent phone is available.'
    },
    {
      key: 'agent-popup',
      title: 'Agent Popup API',
      method: 'POST',
      url: `${apiBaseUrl}/webhooks/telephony/agent-popup`,
      requiredHeaders: { 'x-webhook-secret': '<configured in Telephony connector>' },
      responseType: 'application/json',
      contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
      sampleBody: {
        SourceNumber: '9901662111',
        DestinationNumber: '8067330904',
        DisplayNumber: '1234567890',
        Status: 'Answered',
        Direction: 'Outbound',
        CallSessionId: '080673309211440075398',
        CallDuration: '0',
        StartTime: '2016-01-29 18:26:38'
      },
      sampleResponse: {
        Status: 'Success',
        Message: 'Message broadcasted',
        CallSessionId: '080673309211440075398'
      }
    },
    {
      key: 'call-log-complete',
      title: 'Call Log Complete API',
      method: 'POST',
      url: `${apiBaseUrl}/webhooks/telephony/call-log-complete`,
      requiredHeaders: { 'x-webhook-secret': '<configured in Telephony connector>' },
      responseType: 'application/json',
      contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
      sampleBody: {
        SourceNumber: '9611795983',
        DestinationNumber: '9611795980',
        DisplayNumber: '9020897874',
        StartTime: '2015-08-20 18:26:38',
        EndTime: '2015-08-20 18:26:38',
        CallDuration: '12',
        Status: 'Answered',
        ResourceURL: 'https://recordings.example.com/calls/080673309211440075398.mp3',
        Direction: 'Inbound',
        CallSessionId: '080673309211440075398'
      },
      sampleResponse: {
        Status: 'Success',
        Message: 'Phone Call Logged Successfully'
      }
    }
  ],
  clickToCall: {
    defaultBody: {
      HTTP_AUTHORIZATION: 'stored-provider-token',
      exenumber: '{{user.phone}}',
      custnumber: '{{lead.mobile}}'
    },
    supportedVariables: ['{{lead.mobile}}', '{{lead.customerName}}', '{{lead.externalLeadId}}', '{{lead.status}}', '{{lead.category}}', '{{lead.custom.field_key}}', '{{user.phone}}', '{{user.name}}', '{{user.custom.field_key}}', '{{activity.custom.field_key}}'],
    supportedMethods: ['GET', 'POST'],
    requestTypes: ['JSON', 'FORM_URLENCODED'],
    responseTypes: ['JSON', 'TEXT']
  },
  popupConfig: {
    defaultVisibleFields: ['customerName', 'mobile', 'status', 'category', 'disposition', 'branchCode', 'offerAmount'],
    defaultTabs: ['Overview', 'Activities', 'Dispositions', 'Tasks', 'Calls', 'Notes', 'Custom Fields', 'Automation History']
  }
};

function labelForPopupField(value: string) {
  return popupFieldOptions.find((option) => option.value === value)?.label ?? humanizeKey(value);
}

function splitCsvList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function editableBodyTemplate(value: unknown) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? fallbackTelephonyReference.clickToCall.defaultBody, null, 2);
}

function parseEditableBodyTemplate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function JsonPreview({ value, minRows = 4 }: { value: unknown; minRows?: number }) {
  return (
    <TextField
      size="small"
      multiline
      minRows={minRows}
      value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      InputProps={{ readOnly: true }}
      sx={{
        '& textarea': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.45
        }
      }}
    />
  );
}

function EndpointCard({ endpoint }: { endpoint: TelephonyEndpoint }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '8px', p: 1, bgcolor: '#fafdfa', borderColor: '#e0ede0', boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
      <Stack spacing={0.8}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography fontWeight={800}>{endpoint.title}</Typography>
          <Stack direction="row" spacing={0.5}>
            <AppChip label={endpoint.method} />
            <AppChip label={endpoint.responseType} />
          </Stack>
        </Stack>
        <TextField size="small" label="Clean Unnatify URL" value={endpoint.url} InputProps={{ readOnly: true }} />
        {endpoint.requiredHeaders ? (
          <TextField
            size="small"
            label="Required header"
            value={Object.entries(endpoint.requiredHeaders).map(([key, value]) => `${key}: ${value}`).join('\n')}
            multiline
            minRows={1}
            InputProps={{ readOnly: true }}
          />
        ) : null}
        {endpoint.contentTypes ? <Typography color="text.secondary">Content-Type: {endpoint.contentTypes.join(' or ')}</Typography> : null}
        {endpoint.blankResponseRule ? <Typography color="text.secondary">{endpoint.blankResponseRule}</Typography> : null}
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: endpoint.sampleBody ? '1fr 1fr' : '1fr' } }}>
          {endpoint.sampleBody ? <JsonPreview value={endpoint.sampleBody} /> : null}
          <JsonPreview value={endpoint.sampleResponse ?? ''} minRows={endpoint.sampleBody ? 4 : 2} />
        </Box>
      </Stack>
    </Paper>
  );
}

const telephonySections = [
  { key: 'lead-route', label: 'Call Route API', description: 'Inbound route returns the assigned agent phone as plain text.' },
  { key: 'agent-popup', label: 'Agent Popup API', description: 'Receives live call events and opens the lead popup for the right agent.' },
  { key: 'call-log-complete', label: 'Call Log API', description: 'Stores completed call logs and recordings against the lead.' },
  { key: 'click-to-call', label: 'Click 2 Call', description: 'Configure the outbound provider request with lead and user merge fields.' },
  { key: 'popup-layout', label: 'Popup Config', description: 'Control the default fields, tabs, position, and popup behavior.' },
  { key: 'test-tools', label: 'Test Tools', description: 'Run controlled tests for route, popup, log complete, and click-to-call.' },
  { key: 'connector-logs', label: 'Connector Logs', description: 'Administrator-only recent telephony connector events.' }
];

function TelephonyLogsPanel({ connectorEvents }: { connectorEvents: ConnectorEvent[] }) {
  const rows = connectorEvents
    .filter((event) => String(event.eventType ?? '').toLowerCase().includes('telephony'))
    .map((event) => {
      const payload = event.normalizedPayload ?? event.rawPayload ?? event.payload ?? {};
      return [
        event.eventType ?? '-',
        <AppChip key={`${event.id}-status`} label={event.status ?? '-'} />,
        event.error ?? '-',
        formatDateTime(event.createdAt),
        JSON.stringify(payload).slice(0, 180)
      ];
    });

  return (
    <Paper variant="outlined" sx={{ borderRadius: '8px', p: 1, bgcolor: '#fafdfa', borderColor: '#e0ede0', boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
      <Stack spacing={1}>
        <Typography fontWeight={800}>Connector Logs</Typography>
        <Typography color="text.secondary">Shows recent telephony connector events for administrators.</Typography>
        <CompactDataTable
          columns={['Event', 'Status', 'Error', 'Created', 'Payload']}
          rows={rows}
          emptyLabel="No telephony connector logs found"
        />
      </Stack>
    </Paper>
  );
}

function TelephonyTestToolsPanel({
  endpointMap,
  clickTest,
  setClickTest,
  testClickToCall,
  runWebhookTest
}: {
  endpointMap: Map<string, TelephonyEndpoint>;
  clickTest: { leadId: string; userId: string };
  setClickTest: (value: { leadId: string; userId: string }) => void;
  testClickToCall: () => void;
  runWebhookTest: (kind: 'lead-route' | 'agent-popup' | 'call-log-complete') => void;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '8px', p: 1, bgcolor: '#fafdfa', borderColor: '#e0ede0', boxShadow: '0 10px 28px rgba(22, 39, 22, 0.05)' }}>
      <Stack spacing={1.2}>
        <Typography fontWeight={800}>Telephony Test Tools</Typography>
        <Typography color="text.secondary">Use sample payloads from the endpoint cards or selected lead/user values to verify wiring before giving URLs to MCUBE.</Typography>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <Paper variant="outlined" sx={{ borderRadius: '8px', p: 1, borderColor: '#e0ede0' }}>
            <Stack spacing={0.8}>
              <Typography fontWeight={800}>Webhook Samples</Typography>
              <Button size="small" variant="outlined" onClick={() => runWebhookTest('lead-route')}>Test Lead Route Sample</Button>
              <Button size="small" variant="outlined" onClick={() => runWebhookTest('agent-popup')}>Test Agent Popup Sample</Button>
              <Button size="small" variant="outlined" onClick={() => runWebhookTest('call-log-complete')}>Test Call Log Complete Sample</Button>
              <Typography variant="caption" color="text.secondary">
                Samples use {endpointMap.size} configured endpoint references and run through authenticated internal test routes.
              </Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ borderRadius: '8px', p: 1, borderColor: '#e0ede0' }}>
            <Stack spacing={0.8}>
              <Typography fontWeight={800}>Click-to-Call</Typography>
              <TextField size="small" label="Lead ID" value={clickTest.leadId} onChange={(event) => setClickTest({ ...clickTest, leadId: event.target.value })} />
              <TextField size="small" label="Agent user ID override" value={clickTest.userId} onChange={(event) => setClickTest({ ...clickTest, userId: event.target.value })} />
              <Button variant="contained" size="small" disabled={!clickTest.leadId} onClick={testClickToCall} sx={{ borderRadius: 1 }}>Test Click-to-Call</Button>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Paper>
  );
}

export function TelephonyConnectorPanel({ authToken, embedded = false, connectorEvents = [] }: { authToken: string | null; embedded?: boolean; connectorEvents?: ConnectorEvent[] }) {
  const [telephonyRef, setTelephonyRef] = useState<TelephonyReference>(fallbackTelephonyReference);
  const [activeSection, setActiveSection] = useState('click-to-call');
  const [clickTest, setClickTest] = useState<TelephonyClickTestForm>({ leadId: '', userId: '' });
  const [accessUsers, setAccessUsers] = useState<TelephonyAccessUser[]>([]);
  const [connectorMessage, setConnectorMessage] = useState<string | null>(null);
  const [telephonyMapping, setTelephonyMapping] = useState<TelephonyMappingForm>({
    virtualNumber: '',
    userId: '',
    visibleFields: 'customerName,mobile,status,category,disposition,branchCode,offerAmount',
    tabs: 'Overview,Activities,Dispositions,Tasks,Calls,Notes,Custom Fields,Automation History'
  });
  const [telephonyConfig, setTelephonyConfig] = useState<TelephonyConfigForm>({
    clickToCallUrl: '',
    httpMethod: 'POST',
    responseKeyword: '',
    requestType: 'JSON',
    responseType: 'JSON',
    providerSupportEmail: 'support@mcube.com',
    webhookSecret: '',
    dataTemplate: JSON.stringify(fallbackTelephonyReference.clickToCall.defaultBody, null, 2)
  });
  const selectedPopupFields = splitCsvList(telephonyMapping.visibleFields);
  const selectedPopupTabs = splitCsvList(telephonyMapping.tabs);
  const endpointMap = new Map(telephonyRef.endpoints.map((endpoint) => [endpoint.key, endpoint]));
  const activeEndpoint = endpointMap.get(activeSection);

  useEffect(() => {
    let cancelled = false;

    async function loadTelephonyReference() {
      try {
        const data = await apiRequest<TelephonyReference>('/connectors/telephony/reference', { token: authToken });
        if (!cancelled && data?.endpoints) setTelephonyRef(data);
      } catch {
        if (!cancelled) setTelephonyRef(fallbackTelephonyReference);
      }
    }

    async function loadAccessUsers() {
      try {
        const payload = await apiRequest<AccessOverview>('/access/overview', { token: authToken });
        if (!cancelled) setAccessUsers(Array.isArray(payload.users) ? payload.users : []);
      } catch {
        if (!cancelled) setAccessUsers([]);
      }
    }

    void loadTelephonyReference();
    void loadAccessUsers();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    const config = telephonyRef.connector?.config as TelephonyConnectorConfig | null | undefined;
    const firstMapping = Array.isArray(config?.popupConfig?.agentMappings) ? config.popupConfig.agentMappings[0] : null;
    setTelephonyConfig((current) => ({
      ...current,
      clickToCallUrl: String(config?.clickToCallUrl ?? current.clickToCallUrl),
      httpMethod: String(config?.httpMethod ?? current.httpMethod),
      responseKeyword: String(config?.responseKeyword ?? current.responseKeyword),
      requestType: String(config?.requestType ?? current.requestType),
      responseType: String(config?.responseType ?? current.responseType),
      providerSupportEmail: String(config?.providerSupportEmail ?? current.providerSupportEmail),
      webhookSecret: typeof config?.webhookSecret === 'string' && config.webhookSecret !== '[masked]' ? config.webhookSecret : current.webhookSecret,
	      dataTemplate: editableBodyTemplate(config?.dataTemplate)
    }));
    setTelephonyMapping((current) => ({
      ...current,
      virtualNumber: firstMapping?.virtualNumber ?? current.virtualNumber,
      userId: firstMapping?.userId ?? current.userId,
      visibleFields: Array.isArray(config?.popupConfig?.visibleFields) ? config.popupConfig.visibleFields.join(',') : current.visibleFields,
      tabs: Array.isArray(config?.popupConfig?.tabs) ? config.popupConfig.tabs.join(',') : current.tabs
    }));
  }, [telephonyRef.connector?.id, telephonyRef.connector?.config]);

  const saveTelephonyConfig = async () => {
    setConnectorMessage(null);
    try {
	      const dataTemplate = parseEditableBodyTemplate(telephonyConfig.dataTemplate);
      const payload = await apiRequest<TelephonyConnector>('/connectors/telephony/config', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: telephonyRef.connector?.name ?? 'MCUBE Telephony',
          provider: 'MCUBE',
          isActive: true,
          clickToCallUrl: telephonyConfig.clickToCallUrl,
          httpMethod: telephonyConfig.httpMethod,
          responseKeyword: telephonyConfig.responseKeyword,
          requestType: telephonyConfig.requestType,
          responseType: telephonyConfig.responseType,
          providerSupportEmail: telephonyConfig.providerSupportEmail,
          webhookSecret: telephonyConfig.webhookSecret,
          dataTemplate,
          popupConfig: (telephonyRef.connector?.config as TelephonyConnectorConfig | null | undefined)?.popupConfig ?? {}
        })
      });
      setConnectorMessage('Telephony connector saved');
      setTelephonyRef({ ...telephonyRef, connector: payload });
    } catch (error) {
      setConnectorMessage(error instanceof Error ? error.message : 'Could not save telephony connector');
    }
  };

  const testClickToCall = async () => {
    setConnectorMessage(null);
    try {
      const payload = await apiRequest<{ status?: string; success?: boolean; httpStatus?: number | string; response?: string; error?: string }>('/connectors/telephony/click-to-call', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: clickTest.leadId,
          userId: clickTest.userId || undefined
        })
      });
      if (payload.success === false || payload.status === 'failed') {
        const details = [payload.httpStatus ? `HTTP ${payload.httpStatus}` : null, payload.error || payload.response].filter(Boolean).join(' · ');
        setConnectorMessage(details ? `Click-to-call failed: ${details}` : 'Click-to-call failed');
      } else {
        setConnectorMessage(`Click-to-call ${payload.status ?? 'completed'} (${payload.httpStatus ?? '-'})`);
      }
    } catch (error) {
      setConnectorMessage(error instanceof Error ? error.message : 'Could not run click-to-call');
    }
  };

  const runWebhookTest = async (kind: 'lead-route' | 'agent-popup' | 'call-log-complete') => {
    setConnectorMessage(null);
    try {
      const endpoint = endpointMap.get(kind);
      const payload = kind === 'lead-route'
        ? { callerId: '9845098450' }
        : ((endpoint?.sampleBody ?? {}) as Record<string, unknown>);
      const response = await apiRequest<string | { Status?: string }>(`/connectors/telephony/test-tools/${kind}`, {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setConnectorMessage(`${telephonySections.find((section) => section.key === kind)?.label ?? 'Test'} returned ${typeof response === 'string' ? response || 'blank' : response?.Status ?? 'success'}`);
    } catch (error) {
      setConnectorMessage(error instanceof Error ? error.message : 'Could not run telephony test');
    }
  };

  const saveTelephonyMapping = async () => {
    setConnectorMessage(null);
    try {
      const payload = await apiRequest<TelephonyConnector>('/connectors/telephony/config', {
        token: authToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: telephonyRef.connector?.name ?? 'MCUBE Telephony',
          provider: 'MCUBE',
          isActive: telephonyRef.connector?.isActive ?? true,
          ...(telephonyRef.connector?.config ?? {}),
          popupConfig: {
            ...((telephonyRef.connector?.config as TelephonyConnectorConfig | null | undefined)?.popupConfig ?? {}),
            visibleFields: telephonyMapping.visibleFields.split(',').map((item) => item.trim()).filter(Boolean),
            tabs: telephonyMapping.tabs.split(',').map((item) => item.trim()).filter(Boolean),
            agentMappings: telephonyMapping.virtualNumber && telephonyMapping.userId ? [{ virtualNumber: telephonyMapping.virtualNumber.replace(/\D/g, '').slice(-10), userId: telephonyMapping.userId }] : []
          }
        })
      });
      setConnectorMessage('Telephony agent mapping saved');
      setTelephonyRef({ ...telephonyRef, connector: payload });
    } catch (error) {
      setConnectorMessage(error instanceof Error ? error.message : 'Could not save telephony mapping');
    }
  };

  return (
    <Section title="Telephony Connector" defaultExpanded={!embedded}>
      <Stack spacing={1} sx={{ p: 1 }}>
        <MessageAlert message={connectorMessage} />
        <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#fafdfa', borderColor: '#e0ede0', boxShadow: '0 14px 38px rgba(22, 39, 22, 0.07)' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '285px 1fr' }, minHeight: 540 }}>
            <Box sx={{ bgcolor: '#eef7ee', borderRight: { lg: '1px solid #162716' } }}>
              <Stack spacing={0} sx={{ py: 1 }}>
                {telephonySections.map((section) => {
                  const active = activeSection === section.key;
                  return (
                    <Button
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      fullWidth
                      sx={{
                        justifyContent: 'flex-start',
                        borderRadius: 0,
                        px: 1.4,
                        py: 1.05,
                        color: active ? green : 'text.primary',
                        bgcolor: active ? '#fafdfa' : 'transparent',
                        fontWeight: active ? 950 : 700,
                        '&:hover': { bgcolor: active ? '#fafdfa' : '#eef7ee' }
                      }}
                    >
                      {section.label}
                    </Button>
                  );
                })}
              </Stack>
            </Box>
            <Box sx={{ p: { xs: 1, md: 1.5 } }}>
              <Stack spacing={1.25}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={0.8}>
                      <Box sx={{ width: 42, height: 42, borderRadius: '8px', bgcolor: '#eef7ee', border: '1px solid #e0ede0', display: 'grid', placeItems: 'center', color: green }}>
                        <PhoneForwardedIcon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography fontWeight={850} fontSize={20}>{telephonySections.find((section) => section.key === activeSection)?.label}</Typography>
                        <Typography color="text.secondary">{telephonySections.find((section) => section.key === activeSection)?.description}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <AppChip label={telephonyRef.provider} />
                    <AppChip label="10-digit phone only" />
                  </Stack>
                </Stack>
                <Paper variant="outlined" sx={{ borderRadius: '8px', p: 1, bgcolor: '#eef7ee', borderColor: '#e0ede0' }}>
                  <Typography color="text.secondary">{telephonyRef.phoneRule} For inbound calls the lead phone is SourceNumber and agent phone is DestinationNumber. For outbound calls the lead phone is DestinationNumber and agent phone is SourceNumber.</Typography>
                </Paper>
                {activeEndpoint ? <EndpointCard endpoint={activeEndpoint} /> : null}
                {activeSection === 'click-to-call' ? (
                  <ClickToCallConfigPanel telephonyRef={telephonyRef} telephonyConfig={telephonyConfig} setTelephonyConfig={setTelephonyConfig} clickTest={clickTest} setClickTest={setClickTest} testClickToCall={testClickToCall} saveTelephonyConfig={saveTelephonyConfig} />
                ) : null}
                {activeSection === 'popup-layout' ? (
                  <AgentPopupConfigPanel telephonyRef={telephonyRef} telephonyMapping={telephonyMapping} setTelephonyMapping={setTelephonyMapping} accessUsers={accessUsers} selectedPopupFields={selectedPopupFields} selectedPopupTabs={selectedPopupTabs} popupFieldOptions={popupFieldOptions} popupTabOptions={popupTabOptions} labelForPopupField={labelForPopupField} saveTelephonyMapping={saveTelephonyMapping} mode="popup-layout" />
                ) : null}
                {activeSection === 'test-tools' ? (
                  <TelephonyTestToolsPanel endpointMap={endpointMap} clickTest={clickTest} setClickTest={setClickTest} testClickToCall={testClickToCall} runWebhookTest={runWebhookTest} />
                ) : null}
                {activeSection === 'connector-logs' ? <TelephonyLogsPanel connectorEvents={connectorEvents} /> : null}
              </Stack>
            </Box>
          </Box>
        </Paper>
      </Stack>
    </Section>
  );
}
