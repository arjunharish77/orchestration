'use client';

export type JsonObject = Record<string, unknown>;

export type ConnectorVariable = {
  variableKey: string;
};

export type GenericConnector = {
  id: string;
  name?: string | null;
  type?: string | null;
  provider?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  config?: JsonObject | null;
};

export type WhatsAppNumber = {
  id: string;
  connectorId?: string | null;
  phoneNumber?: string | null;
  label?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export type WhatsAppTemplate = {
  id: string;
  connectorId?: string | null;
  name?: string | null;
  category?: string | null;
  language?: string | null;
  content?: string | null;
  mediaConfig?: JsonObject | null;
  status?: string | null;
  availableInChat?: boolean;
  variables?: ConnectorVariable[];
  createdAt?: string | null;
};

export type WhatsAppMessage = {
  id: string;
  leadId?: string | null;
  direction?: string | null;
  messageType?: string | null;
  status?: string | null;
  content?: string | null;
  createdAt?: string | null;
};

export type ConnectorLeadSummary = {
  id: string;
  name?: string | null;
  customerName?: string | null;
  mobile?: string | null;
};

export type QuickReply = {
  id: string;
  name?: string | null;
};

export type VoicebotTemplate = {
  id: string;
  connectorId?: string | null;
  name?: string | null;
  method?: string | null;
  url?: string | null;
  headers?: JsonObject | null;
  queryParams?: JsonObject | null;
  bodyTemplate?: JsonObject | null;
  responseConfig?: JsonObject | null;
  variables?: ConnectorVariable[];
  createdAt?: string | null;
};

export type VoicebotWebhookMapping = {
  id: string;
  connectorId?: string | null;
  sampleBody?: JsonObject | null;
  fieldMappings?: JsonObject | null;
  isActive?: boolean;
};

export type ConnectorEvent = {
  id: string;
  connectorType?: string | null;
  eventType?: string | null;
  status?: string | null;
  error?: string | null;
  connectorId?: string | null;
  connectorName?: string | null;
  createdAt?: string | null;
  payload?: unknown;
  rawPayload?: unknown;
  normalizedPayload?: unknown;
  response?: unknown;
};

export type ConnectorOverview = {
  connectors?: GenericConnector[];
  events?: ConnectorEvent[];
  whatsAppConnectors?: GenericConnector[];
  whatsAppNumbers?: WhatsAppNumber[];
  whatsAppTemplates?: WhatsAppTemplate[];
  whatsAppMessages?: WhatsAppMessage[];
  whatsAppLeadSummaries?: ConnectorLeadSummary[];
  whatsAppQuickReplies?: QuickReply[];
  voicebotConnectors?: GenericConnector[];
  voicebotTemplates?: VoicebotTemplate[];
  voicebotWebhookMappings?: VoicebotWebhookMapping[];
};

export type ActivityMappingField = {
  value: string;
  label: string;
};

export type TelephonyAccessUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type TelephonyEndpoint = {
  key: string;
  title: string;
  method: string;
  url: string;
  responseType: string;
  sampleBody?: unknown;
  sampleResponse?: unknown;
  contentTypes?: string[];
  requiredHeaders?: Record<string, string>;
  blankResponseRule?: string;
};

export type TelephonyConnectorConfig = {
  clickToCallUrl?: string | null;
  httpMethod?: string | null;
  responseKeyword?: string | null;
  requestType?: string | null;
  responseType?: string | null;
  providerSupportEmail?: string | null;
  webhookSecret?: string | null;
  dataTemplate?: unknown;
  popupConfig?: {
    visibleFields?: string[];
    tabs?: string[];
    agentMappings?: Array<{ virtualNumber?: string | null; userId?: string | null }>;
  } | null;
};

export type TelephonyConnector = GenericConnector & {
  name?: string | null;
  provider?: string | null;
  isActive?: boolean;
  config?: TelephonyConnectorConfig | null;
};

export type TelephonyReference = {
  connector?: TelephonyConnector | null;
  provider: string;
  phoneRule: string;
  endpoints: TelephonyEndpoint[];
  clickToCall: {
    defaultBody: Record<string, unknown>;
    supportedVariables: string[];
    supportedMethods: string[];
    requestTypes: string[];
    responseTypes: string[];
  };
  popupConfig: {
    defaultVisibleFields: string[];
    defaultTabs: string[];
  };
};

export type TelephonyMappingForm = {
  virtualNumber: string;
  userId: string;
  visibleFields: string;
  tabs: string;
};

export type TelephonyConfigForm = {
  clickToCallUrl: string;
  httpMethod: string;
  responseKeyword: string;
  requestType: string;
  responseType: string;
  providerSupportEmail: string;
  webhookSecret: string;
  dataTemplate: string;
};

export type TelephonyClickTestForm = {
  leadId: string;
  userId: string;
};
