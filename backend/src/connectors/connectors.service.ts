import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import IORedis from 'ioredis';
import { AccessService } from '../access/access.service';
import { activityTypeCodes } from '../activities/activity-types';
import { AuditService } from '../audit/audit.service';
import { requiredEnv } from '../common/env';
import { normalizeTenDigitPhone } from '../common/phone';
import { maskSensitive, publicConnectorConfig, readConnectorSecret, secureConnectorConfig, secureConnectorConfigWithExisting } from '../common/sensitive';
import { assertWebhookSecret } from '../common/webhook-security';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateConnectorDto,
  CreateVoicebotConnectorDto,
  CreateVoicebotTriggerTemplateDto,
  CreateVoicebotWebhookMappingDto,
  CreateWhatsAppConnectorDto,
  CreateWhatsAppTemplateDto,
  ExtractVariablesDto,
  SendWhatsAppMessageDto,
  TestVoicebotCallDto,
  UpdateConnectorDto,
  UpdateVoicebotConnectorDto,
  UpdateVoicebotTriggerTemplateDto,
  UpdateVoicebotWebhookMappingDto,
  UpdateWhatsAppConnectorDto,
  UpdateWhatsAppNumberDto,
  UpdateWhatsAppTemplateDto,
  UpsertWhatsAppNumberDto
} from './connectors.dto';
import {
  applyMapping,
  extractVariables,
  humanizeVariable,
  isOptOutText,
  isTruthy,
  normalizeWhatsAppStatus,
  numberOrNull,
  resolveVariables,
  toInputJson
} from './connectors-utils';

const CONNECTOR_VISIBLE_LEAD_ID_LIMIT = 10000;

@Injectable()
export class ConnectorsService {
  private readonly whatsAppQueue: Queue;
  private readonly voicebotQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService
  ) {
    const connection = new IORedis(requiredEnv('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: null
    });
    const defaultJobOptions = {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 100
    };
    this.whatsAppQueue = new Queue('whatsapp-send', { connection, defaultJobOptions });
    this.voicebotQueue = new Queue('voicebot-trigger', { connection, defaultJobOptions });
  }

  async list(viewerId?: string) {
    const effective = viewerId ? await this.access.effectivePermissions(viewerId) : null;
    const canViewTechnicalLogs = Boolean(effective?.isAdministrator);
    const visibleLeadIds = await this.visibleLeadIdsForConnectorList(viewerId, effective);
    const conversationWhere = viewerId && visibleLeadIds
      ? {
          OR: [
            { userId: viewerId },
            ...(visibleLeadIds.length ? [{ leadId: { in: visibleLeadIds } }] : [])
          ]
        }
      : undefined;
    const messageWhere = viewerId && visibleLeadIds
      ? visibleLeadIds.length
        ? {
            OR: [
              { sentBy: viewerId },
              { leadId: { in: visibleLeadIds } }
            ]
          }
        : { sentBy: viewerId }
      : undefined;
    const [connectors, whatsAppConnectors, whatsAppNumbers, whatsAppTemplates, whatsAppConversations, whatsAppMessages, whatsAppQuickReplies, voicebotConnectors, voicebotTemplates, voicebotWebhookMappings, events, leadSummaries] = await Promise.all([
      this.prisma.connector.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.whatsAppConnector.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.whatsAppNumber.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.whatsAppTemplate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { variables: true }
      }),
      this.prisma.whatsAppConversation.findMany({ where: conversationWhere, orderBy: { updatedAt: 'desc' }, take: 50 }),
      this.prisma.whatsAppMessage.findMany({ where: messageWhere, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.whatsAppQuickReply.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, take: 200 }),
      this.prisma.voicebotConnector.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.voicebotTriggerTemplate.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.voicebotWebhookMapping.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      canViewTechnicalLogs
        ? this.prisma.connectorEvent.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
          })
        : Promise.resolve([]),
      this.whatsAppLeadSummaries(viewerId, visibleLeadIds)
    ]);

    const connectorNameMap = new Map<string, string>([
      ...connectors.map((connector) => [connector.id, connector.name] as const),
      ...whatsAppConnectors.map((connector) => [connector.id, connector.name] as const),
      ...voicebotConnectors.map((connector) => [connector.id, connector.name] as const)
    ]);

    return {
      connectors: connectors.map((connector) => this.publicConnector(connector)),
      whatsAppConnectors: whatsAppConnectors.map((connector) => this.publicConnector(connector)),
      whatsAppNumbers,
      whatsAppTemplates,
      whatsAppConversations,
      whatsAppMessages,
      whatsAppQuickReplies,
      whatsAppLeadSummaries: leadSummaries,
      voicebotConnectors: voicebotConnectors.map((connector) => this.publicConnector(connector)),
      voicebotTemplates: voicebotTemplates.map((template) => this.publicVoicebotTemplate(template)),
      voicebotWebhookMappings: voicebotWebhookMappings.map((mapping) => ({
        ...mapping,
        sampleBody: publicConnectorConfig(mapping.sampleBody)
      })),
      events: events.map((event) => ({
        ...event,
        connectorName: event.connectorId ? connectorNameMap.get(event.connectorId) ?? event.connectorId : null
      }))
    };
  }

  async whatsAppChatOverview(viewerId: string) {
    const settings = await this.whatsAppRuntimeSettings();
    if (settings.enableConverse === false) return { leadSummaries: [], conversations: [], messages: [], templates: [], quickReplies: [], settings };
    const effective = await this.access.effectivePermissions(viewerId);
    const visibleLeadIds = await this.visibleLeadIdsForConnectorList(viewerId, effective);
    const leadWhere = visibleLeadIds
      ? visibleLeadIds.length
        ? { id: { in: visibleLeadIds } }
        : { id: '__none__' }
      : {};
    const messageWhere = visibleLeadIds
      ? visibleLeadIds.length
        ? { leadId: { in: visibleLeadIds } }
        : { leadId: '__none__' }
      : {};
    const conversationWhere = visibleLeadIds
      ? visibleLeadIds.length
        ? { leadId: { in: visibleLeadIds } }
        : { leadId: '__none__' }
      : {};

    const [leadSummaries, conversations, messages, templates, quickReplies] = await Promise.all([
      this.prisma.lead.findMany({
        where: leadWhere,
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: { id: true, customerName: true, mobile: true, status: true, category: true, disposition: true, assignedUserId: true }
      }),
      this.prisma.whatsAppConversation.findMany({ where: conversationWhere, orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.prisma.whatsAppMessage.findMany({ where: messageWhere, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.whatsAppTemplate.findMany({
        where: { availableInChat: true },
        orderBy: { name: 'asc' },
        take: 100,
        include: { variables: true }
      }),
      this.prisma.whatsAppQuickReply.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, take: 100 })
    ]);

    const conversationByLeadId = new Map(conversations.filter((conversation) => conversation.leadId).map((conversation) => [conversation.leadId as string, conversation]));
    const latestMessageByLeadId = new Map<string, (typeof messages)[number]>();
    for (const message of messages) {
      if (!message.leadId || latestMessageByLeadId.has(message.leadId)) continue;
      latestMessageByLeadId.set(message.leadId, message);
    }

    return {
      leadSummaries: leadSummaries.map((lead) => {
        const conversation = conversationByLeadId.get(lead.id);
        const latestMessage = latestMessageByLeadId.get(lead.id);
        return {
          ...lead,
          serviceWindowUntil: conversation?.serviceWindowUntil ?? null,
          lastMessageAt: conversation?.lastMessageAt ?? latestMessage?.createdAt ?? null,
          lastMessage: latestMessage?.content ?? null,
          lastMessageStatus: latestMessage?.status ?? null,
          lastMessageDirection: latestMessage?.direction ?? null
        };
      }),
      conversations,
      messages,
      templates,
      quickReplies,
      numbers: await this.prisma.whatsAppNumber.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }], take: 50 }),
      settings
    };
  }

  async createConnector(input: CreateConnectorDto, actor = 'system') {
    const connector = await this.prisma.connector.create({
      data: {
        name: input.name,
        type: input.type ?? 'api_call',
        provider: input.provider,
        config: toInputJson(secureConnectorConfig(input.config ?? {})),
        isActive: input.isActive ?? false
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: connector.id, action: 'create_api_connector', newValue: connector, changedBy: actor });
    return this.publicConnector(connector);
  }

  async updateConnector(id: string, input: UpdateConnectorDto, actor = 'system') {
    const existing = await this.prisma.connector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Connector not found');
    const connector = await this.prisma.connector.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        provider: input.provider,
        config: input.config === undefined ? undefined : toInputJson(secureConnectorConfig(input.config)),
        isActive: input.isActive
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_api_connector', oldValue: existing, newValue: connector, changedBy: actor });
    return this.publicConnector(connector);
  }

  async deleteConnector(id: string, actor = 'system') {
    const existing = await this.prisma.connector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Connector not found');
    await this.prisma.connector.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_api_connector', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  getWhatsAppConnector(id: string) {
    return this.prisma.whatsAppConnector.findUnique({ where: { id } }).then((connector) => connector ? this.publicConnector(connector) : null);
  }

  async createWhatsAppConnector(input: CreateWhatsAppConnectorDto, actor = 'system') {
    const connector = await this.prisma.whatsAppConnector.create({
      data: {
        name: input.name,
        provider: input.provider ?? 'MCUBE',
        config: toInputJson(secureConnectorConfig(input.config ?? {})),
        isActive: input.isActive ?? false
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: connector.id, action: 'create_whatsapp_connector', newValue: connector, changedBy: actor });
    return this.publicConnector(connector);
  }

  async updateWhatsAppConnector(id: string, input: UpdateWhatsAppConnectorDto, actor = 'system') {
    const existing = await this.prisma.whatsAppConnector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('WhatsApp connector not found');
    const connector = await this.prisma.whatsAppConnector.update({
      where: { id },
      data: {
        name: input.name,
        provider: input.provider,
        config: input.config === undefined ? undefined : toInputJson(secureConnectorConfigWithExisting(input.config, existing.config)),
        isActive: input.isActive
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_whatsapp_connector', oldValue: existing, newValue: connector, changedBy: actor });
    return this.publicConnector(connector);
  }

  async verifyWhatsAppWebhookToken(verifyToken?: string) {
    if (!verifyToken) return false;
    const connectors = await this.prisma.whatsAppConnector.findMany({ where: { isActive: true }, take: 100 });
    return connectors.some((connector) => {
      const config = this.asConfig(connector.config);
      return [config.verifyToken, config.webhookVerifyToken, config.webhookToken].some((value) => readConnectorSecret(value) === verifyToken);
    });
  }

  async verifyWhatsAppWebhookSecret(providedSecret?: string) {
    const connectors = await this.prisma.whatsAppConnector.findMany({ where: { isActive: true }, take: 100 });
    const configuredSecrets = connectors.flatMap((connector) => {
      const config = this.asConfig(connector.config);
      return [config.webhookSecret, config.secret].map((value) => readConnectorSecret(value)).filter(Boolean);
    });
    if (!configuredSecrets.length) return true;
    if (!providedSecret) return false;
    return configuredSecrets.some((secret) => secret === providedSecret);
  }

  async verifyWhatsAppWebhookSignature(signature?: string, rawBody?: string) {
    const connectors = await this.prisma.whatsAppConnector.findMany({ where: { isActive: true }, take: 100 });
    const appSecrets = connectors.map((connector) => {
      const config = this.asConfig(connector.config);
      return readConnectorSecret(config.appSecret ?? config.webhookAppSecret ?? config.metaAppSecret);
    }).filter(Boolean);
    if (!appSecrets.length) return true;
    if (!signature || !rawBody) return false;
    return appSecrets.some((appSecret) => {
      const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const actual = signature.replace(/^sha256=/i, '');
      return timingEqual(expected, actual);
    });
  }

  async deleteWhatsAppConnector(id: string, actor = 'system') {
    const existing = await this.prisma.whatsAppConnector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('WhatsApp connector not found');
    await this.prisma.whatsAppConnector.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_whatsapp_connector', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  async upsertWhatsAppNumber(input: UpsertWhatsAppNumberDto, actor = 'system') {
    const phoneNumber = normalizeTenDigitPhone(input.phoneNumber);
    if (!phoneNumber) throw new NotFoundException('WhatsApp number must be 10 digits');
    const connector = await this.prisma.whatsAppConnector.findUnique({ where: { id: input.connectorId } });
    if (!connector) throw new NotFoundException('WhatsApp connector not found');
    if (input.isDefault) {
      await this.prisma.whatsAppNumber.updateMany({ where: { connectorId: input.connectorId }, data: { isDefault: false } });
    }
    const existing = await this.prisma.whatsAppNumber.findFirst({
      where: { connectorId: input.connectorId, phoneNumber }
    });
    const number = existing
      ? await this.prisma.whatsAppNumber.update({
          where: { id: existing.id },
          data: {
            label: input.label,
            isDefault: input.isDefault ?? existing.isDefault,
            isActive: input.isActive ?? existing.isActive
          }
        })
      : await this.prisma.whatsAppNumber.create({
          data: {
            connectorId: input.connectorId,
            phoneNumber,
            label: input.label,
            isDefault: input.isDefault ?? false,
            isActive: input.isActive ?? true
          }
        });
    await this.audit.write({ moduleName: 'Connector', entityId: number.id, action: existing ? 'update_whatsapp_number' : 'upsert_whatsapp_number', oldValue: existing ?? undefined, newValue: number, changedBy: actor });
    return number;
  }

  async updateWhatsAppNumber(id: string, input: UpdateWhatsAppNumberDto, actor = 'system') {
    const existing = await this.prisma.whatsAppNumber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('WhatsApp number not found');
    const connectorId = input.connectorId ?? existing.connectorId;
    if (input.connectorId) {
      const connector = await this.prisma.whatsAppConnector.findUnique({ where: { id: input.connectorId } });
      if (!connector) throw new NotFoundException('WhatsApp connector not found');
    }
    const phoneNumber = input.phoneNumber === undefined ? existing.phoneNumber : normalizeTenDigitPhone(input.phoneNumber);
    if (!phoneNumber) throw new NotFoundException('WhatsApp number must be 10 digits');
    if (input.isDefault) {
      await this.prisma.whatsAppNumber.updateMany({
        where: { connectorId, id: { not: id } },
        data: { isDefault: false }
      });
    }
    const number = await this.prisma.whatsAppNumber.update({
      where: { id },
      data: {
        connectorId,
        phoneNumber,
        label: input.label,
        isDefault: input.isDefault,
        isActive: input.isActive
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_whatsapp_number', oldValue: existing, newValue: number, changedBy: actor });
    return number;
  }

  async deleteWhatsAppNumber(id: string, actor = 'system') {
    const existing = await this.prisma.whatsAppNumber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('WhatsApp number not found');
    await this.prisma.whatsAppNumber.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_whatsapp_number', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  async createWhatsAppTemplate(input: CreateWhatsAppTemplateDto, actor = 'system') {
    const variables = extractVariables(input.content);
    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        connectorId: input.connectorId,
        name: input.name,
        category: input.category,
        language: input.language,
        content: input.content,
        mediaConfig: toInputJson(secureConnectorConfig(input.mediaConfig ?? {})),
        availableInChat: input.availableInChat ?? false,
        status: input.status ?? 'draft',
        variables: {
          create: variables.map((variable) => ({
            variableKey: variable,
            displayName: humanizeVariable(variable)
          }))
        }
      },
      include: { variables: true }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: template.id, action: 'create_whatsapp_template', newValue: template, changedBy: actor });
    return template;
  }

  async updateWhatsAppTemplate(id: string, input: UpdateWhatsAppTemplateDto, actor = 'system') {
    const existing = await this.prisma.whatsAppTemplate.findUnique({ where: { id }, include: { variables: true } });
    if (!existing) throw new NotFoundException('WhatsApp template not found');
    const variables = input.content ? extractVariables(input.content) : existing.variables.map((variable) => variable.variableKey);
    await this.prisma.whatsAppTemplateVariable.deleteMany({ where: { templateId: id } });
    const template = await this.prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        connectorId: input.connectorId,
        name: input.name,
        category: input.category,
        language: input.language,
        content: input.content,
        mediaConfig: input.mediaConfig === undefined ? undefined : toInputJson(secureConnectorConfig(input.mediaConfig)),
        availableInChat: input.availableInChat,
        status: input.status,
        variables: {
          create: variables.map((variable) => ({
            variableKey: variable,
            displayName: humanizeVariable(variable)
          }))
        }
      },
      include: { variables: true }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_whatsapp_template', oldValue: existing, newValue: template, changedBy: actor });
    return template;
  }

  async deleteWhatsAppTemplate(id: string, actor = 'system') {
    const existing = await this.prisma.whatsAppTemplate.findUnique({ where: { id }, include: { variables: true } });
    if (!existing) throw new NotFoundException('WhatsApp template not found');
    await this.prisma.$transaction([
      this.prisma.whatsAppTemplateVariable.deleteMany({ where: { templateId: id } }),
      this.prisma.whatsAppTemplate.delete({ where: { id } })
    ]);
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_whatsapp_template', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  async syncWhatsAppTemplates(connectorId: string, actor = 'system') {
    const connector = await this.prisma.whatsAppConnector.findUnique({ where: { id: connectorId } });
    if (!connector) throw new NotFoundException('WhatsApp connector not found');
    const config = this.asConfig(connector.config);
    const wabaId = String(readConnectorSecret(config.businessAccountId ?? config.wabaId ?? config.whatsAppBusinessAccountId ?? '') ?? '').trim();
    const accessToken = String(readConnectorSecret(config.accessToken ?? config.token ?? config.bearerToken ?? '') ?? '').trim();
    const graphVersion = String(config.graphVersion ?? config.apiVersion ?? 'v23.0').replace(/^\/+/, '');
    if (!wabaId || !accessToken) throw new NotFoundException('WhatsApp Business Account ID and access token are required to sync templates');
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates?limit=250`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const text = await response.text();
    if (!response.ok) {
      await this.prisma.connectorEvent.create({
        data: {
          connectorId,
          eventType: 'whatsapp_template_sync_failed',
          rawPayload: toInputJson({ status: response.status, body: text.slice(0, 1000) }),
          status: 'failed',
          error: text.slice(0, 500)
        }
      });
      throw new NotFoundException('WhatsApp template sync failed');
    }
    const payload = parseJson(text) as { data?: Array<Record<string, unknown>> };
    const templates = Array.isArray(payload.data) ? payload.data : [];
    let created = 0;
    let updated = 0;
    for (const remote of templates) {
      const name = String(remote.name ?? '').trim();
      if (!name) continue;
      const language = String(remote.language ?? 'en').trim();
      const category = String(remote.category ?? '').trim();
      const components = Array.isArray(remote.components) ? remote.components as Record<string, unknown>[] : [];
      const body = components.find((component) => String(component.type ?? '').toUpperCase() === 'BODY');
      const content = String(body?.text ?? name);
      const variables = extractVariables(content);
      const existing = await this.prisma.whatsAppTemplate.findFirst({ where: { connectorId, name, language } });
      const data = {
        connectorId,
        name,
        category,
        language,
        content,
        mediaConfig: toInputJson({ source: 'meta_sync', remoteId: remote.id, components, rawStatus: remote.status }),
        availableInChat: false,
        status: 'review_required'
      };
      if (existing) {
        await this.prisma.whatsAppTemplateVariable.deleteMany({ where: { templateId: existing.id } });
        await this.prisma.whatsAppTemplate.update({
          where: { id: existing.id },
          data: {
            ...data,
            variables: { create: variables.map((variable) => ({ variableKey: variable, displayName: humanizeVariable(variable) })) }
          }
        });
        updated += 1;
      } else {
        await this.prisma.whatsAppTemplate.create({
          data: {
            ...data,
            variables: { create: variables.map((variable) => ({ variableKey: variable, displayName: humanizeVariable(variable) })) }
          }
        });
        created += 1;
      }
    }
    await this.prisma.connectorEvent.create({
      data: {
        connectorId,
        eventType: 'whatsapp_template_sync',
        rawPayload: toInputJson({ connectorId }),
        normalizedPayload: toInputJson({ total: templates.length, created, updated }),
        status: 'success'
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: connectorId, action: 'sync_whatsapp_templates', newValue: { total: templates.length, created, updated }, changedBy: actor });
    return { total: templates.length, created, updated };
  }

  async createOutboundWhatsAppMessage(input: SendWhatsAppMessageDto, actor = 'system') {
    const messageType = input.messageType ?? (input.templateId ? 'template' : input.mediaUrl ? 'media' : 'text');
    const settings = await this.whatsAppRuntimeSettings(input.whatsAppNumberId);
    if (input.mediaUrl && settings.enableRichMedia === false) return this.blockedWhatsAppMessage(input, actor, messageType, 'rich_media_disabled', 'Rich media is disabled for this WhatsApp connector');
    if (input.leadId) await this.assertWhatsAppLeadVisible(input.leadId, actor);
    if (input.leadId && await this.isWhatsAppBlockedByCompliance(input.leadId, settings)) {
      const event = await this.prisma.connectorEvent.create({
        data: {
          eventType: 'whatsapp_outbound_blocked_opt_out',
          rawPayload: toInputJson(input),
          normalizedPayload: toInputJson({ leadId: input.leadId, reason: 'whatsapp_opt_out' }),
          status: 'blocked',
          error: 'Lead has opted out of WhatsApp messages'
        }
      });
      return {
        id: event.id,
        leadId: input.leadId,
        direction: 'outbound',
        messageType,
        content: input.content,
        status: 'blocked',
        providerMessageId: null,
        rawPayload: { reason: 'whatsapp_opt_out' },
        sentBy: actor,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    if (input.leadId && await this.isDailyRecipientLimitExceeded(input.leadId, settings)) {
      return this.blockedWhatsAppMessage(input, actor, messageType, 'daily_recipient_limit', 'Daily unique recipient limit reached for this connector');
    }
    const conversationId = input.conversationId ?? await this.ensureWhatsAppConversation(input.leadId, actor);
    const isTemplateMessage = messageType === 'template' && Boolean(input.templateId);
    if (isTemplateMessage && input.templateId) {
      const template = await this.prisma.whatsAppTemplate.findUnique({ where: { id: input.templateId } });
      const templateStatus = String(template?.status ?? '').toLowerCase();
      const insideWindow = await this.isWithinWhatsAppServiceWindow(input.leadId, conversationId);
      const approved = ['approved', 'active'].includes(templateStatus);
      if (approved && settings.allowApprovedTemplates === false) return this.blockedWhatsAppMessage(input, actor, messageType, 'approved_template_disabled', 'Approved WhatsApp templates are disabled for this connector');
      if (!approved && !insideWindow) return this.blockedWhatsAppMessage(input, actor, messageType, 'template_not_approved', 'Only approved WhatsApp templates can be sent outside the 24-hour window');
      if (!approved && settings.allowUnapprovedTemplates !== true) return this.blockedWhatsAppMessage(input, actor, messageType, 'unapproved_template_disabled', 'Unapproved WhatsApp templates are disabled for this connector');
    }
    if (!isTemplateMessage && !await this.isWithinWhatsAppServiceWindow(input.leadId, conversationId)) {
      const event = await this.prisma.connectorEvent.create({
        data: {
          eventType: 'whatsapp_outbound_blocked_service_window',
          rawPayload: toInputJson(input),
          normalizedPayload: toInputJson({
            leadId: input.leadId,
            conversationId,
            reason: 'template_required_before_customer_reply'
          }),
          status: 'blocked',
          error: 'A WhatsApp template is required before the customer replies. Free text and media are allowed for 24 hours after an inbound reply.'
        }
      });
      return {
        id: event.id,
        leadId: input.leadId,
        conversationId,
        direction: 'outbound',
        messageType,
        content: input.content,
        status: 'blocked',
        providerMessageId: null,
        rawPayload: { reason: 'template_required_before_customer_reply' },
        sentBy: actor,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId,
        leadId: input.leadId,
        direction: 'outbound',
        messageType,
        content: input.content,
        status: 'queued',
        rawPayload: toInputJson({
          templateId: input.templateId,
          whatsAppNumberId: input.whatsAppNumberId,
          previewUrl: input.previewUrl ?? settings.showUrlPreview,
          mediaUrl: input.mediaUrl,
          mediaMimeType: input.mediaMimeType,
          mediaFileName: input.mediaFileName,
          ...(input.rawPayload ?? {})
        }),
        sentBy: actor
      }
    });
    await this.prisma.connectorEvent.create({
      data: {
        eventType: 'whatsapp_outbound_queued',
        rawPayload: toInputJson({ messageId: message.id, ...input }),
        normalizedPayload: toInputJson({ status: message.status, messageType: message.messageType }),
        status: 'queued'
      }
    });
    await this.whatsAppQueue.add('whatsapp.send', {
      messageId: message.id,
      leadId: input.leadId,
      actor
    });
    if (input.leadId) {
      await this.prisma.activity.create({
        data: {
          leadId: input.leadId,
          type: activityTypeCodes.whatsapp,
          title: input.templateId ? 'WhatsApp template queued' : input.mediaUrl ? 'WhatsApp media queued' : 'WhatsApp message queued',
          notes: input.content,
          metadata: toInputJson({
            messageId: message.id,
            templateId: input.templateId,
            status: message.status,
            mediaUrl: input.mediaUrl,
            mediaMimeType: input.mediaMimeType,
            mediaFileName: input.mediaFileName
          }),
          createdBy: actor
        }
      });
    }
    return message;
  }

  async endWhatsAppConversation(conversationId: string, actor = 'system') {
    const conversation = await this.prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('WhatsApp conversation not found');
    if (conversation.leadId) await this.assertWhatsAppLeadVisible(conversation.leadId, actor);
    const ended = await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { userId: null, serviceWindowUntil: null, updatedAt: new Date() }
    });
    await this.prisma.connectorEvent.create({
      data: {
        eventType: 'whatsapp_conversation_ended',
        rawPayload: toInputJson({ conversationId, actor }),
        normalizedPayload: toInputJson({ conversationId, leadId: conversation.leadId, previousUserId: conversation.userId }),
        status: 'ended'
      }
    });
    if (conversation.leadId) {
      await this.prisma.activity.create({
        data: {
          leadId: conversation.leadId,
          type: activityTypeCodes.whatsapp,
          title: 'WhatsApp session ended',
          metadata: toInputJson({ conversationId }),
          createdBy: actor
        }
      });
    }
    return ended;
  }

  getVoicebotConnector(id: string) {
    return this.prisma.voicebotConnector.findUnique({ where: { id } }).then((connector) => connector ? this.publicConnector(connector) : null);
  }

  async createVoicebotConnector(input: CreateVoicebotConnectorDto, actor = 'system') {
    const connector = await this.prisma.voicebotConnector.create({
      data: {
        name: input.name,
        config: toInputJson(secureConnectorConfig(input.config ?? {})),
        isActive: input.isActive ?? false
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: connector.id, action: 'create_voicebot_connector', newValue: connector, changedBy: actor });
    return this.publicConnector(connector);
  }

  async updateVoicebotConnector(id: string, input: UpdateVoicebotConnectorDto, actor = 'system') {
    const existing = await this.prisma.voicebotConnector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voicebot connector not found');
    const connector = await this.prisma.voicebotConnector.update({
      where: { id },
      data: {
        name: input.name,
        config: input.config === undefined ? undefined : toInputJson(secureConnectorConfigWithExisting(input.config, existing.config)),
        isActive: input.isActive
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_voicebot_connector', oldValue: existing, newValue: connector, changedBy: actor });
    return this.publicConnector(connector);
  }

  async assertVoicebotWebhookSecret(connectorId: string, providedSecret?: string | null) {
    const connector = await this.prisma.voicebotConnector.findUnique({ where: { id: connectorId } });
    const config = this.asConfig(connector?.config);
    const configuredSecret = readConnectorSecret(config.webhookSecret ?? config.secret);
    assertWebhookSecret({ configuredSecret, providedSecret: providedSecret ?? undefined });
  }

  async deleteVoicebotConnector(id: string, actor = 'system') {
    const existing = await this.prisma.voicebotConnector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voicebot connector not found');
    await this.prisma.voicebotConnector.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_voicebot_connector', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  async createVoicebotTemplate(input: CreateVoicebotTriggerTemplateDto, actor = 'system') {
    const variables = extractVariables(input.bodyTemplate ?? {});
    const template = await this.prisma.voicebotTriggerTemplate.create({
      data: {
        connectorId: input.connectorId,
        name: input.name,
        method: input.method,
        url: input.url,
        headers: toInputJson(secureConnectorConfig(input.headers ?? {})),
        queryParams: toInputJson(secureConnectorConfig(input.queryParams ?? {})),
        bodyTemplate: toInputJson(secureConnectorConfig(input.bodyTemplate ?? {})),
        responseConfig: toInputJson(secureConnectorConfig(input.responseConfig ?? {}))
      }
    });

    await this.prisma.voicebotTriggerVariable.createMany({
      data: variables.map((variable) => ({
        templateId: template.id,
        variableKey: variable,
        displayName: humanizeVariable(variable)
      }))
    });

    const templateVariables = await this.prisma.voicebotTriggerVariable.findMany({
      where: { templateId: template.id },
      orderBy: { variableKey: 'asc' }
    });

    const result = { ...template, variables: templateVariables };
    await this.audit.write({ moduleName: 'Connector', entityId: template.id, action: 'create_voicebot_template', newValue: result, changedBy: actor });
    return this.publicVoicebotTemplate(result);
  }

  async updateVoicebotTemplate(id: string, input: UpdateVoicebotTriggerTemplateDto, actor = 'system') {
    const existing = await this.prisma.voicebotTriggerTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voicebot trigger template not found');
    if (input.connectorId) {
      const connector = await this.prisma.voicebotConnector.findUnique({ where: { id: input.connectorId } });
      if (!connector) throw new NotFoundException('Voicebot connector not found');
    }
    const variableSource = input.bodyTemplate ?? existing.bodyTemplate ?? {};
    const variables = extractVariables(variableSource);
    await this.prisma.voicebotTriggerVariable.deleteMany({ where: { templateId: id } });
    const template = await this.prisma.voicebotTriggerTemplate.update({
      where: { id },
      data: {
        connectorId: input.connectorId,
        name: input.name,
        method: input.method,
        url: input.url,
        headers: input.headers === undefined ? undefined : toInputJson(secureConnectorConfigWithExisting(input.headers, existing.headers)),
        queryParams: input.queryParams === undefined ? undefined : toInputJson(secureConnectorConfigWithExisting(input.queryParams, existing.queryParams)),
        bodyTemplate: input.bodyTemplate === undefined ? undefined : toInputJson(secureConnectorConfigWithExisting(input.bodyTemplate, existing.bodyTemplate)),
        responseConfig: input.responseConfig === undefined ? undefined : toInputJson(secureConnectorConfigWithExisting(input.responseConfig, existing.responseConfig))
      }
    });
    await this.prisma.voicebotTriggerVariable.createMany({
      data: variables.map((variable) => ({
        templateId: id,
        variableKey: variable,
        displayName: humanizeVariable(variable)
      }))
    });
    const templateVariables = await this.prisma.voicebotTriggerVariable.findMany({
      where: { templateId: id },
      orderBy: { variableKey: 'asc' }
    });
    const result = { ...template, variables: templateVariables };
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_voicebot_template', oldValue: existing, newValue: result, changedBy: actor });
    return this.publicVoicebotTemplate(result);
  }

  async deleteVoicebotTemplate(id: string, actor = 'system') {
    const existing = await this.prisma.voicebotTriggerTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voicebot trigger template not found');
    await this.prisma.$transaction([
      this.prisma.voicebotTriggerVariable.deleteMany({ where: { templateId: id } }),
      this.prisma.voicebotTriggerTemplate.delete({ where: { id } })
    ]);
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_voicebot_template', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  async testVoicebotCall(templateId: string, input: TestVoicebotCallDto, actor = 'system') {
    const template = await this.prisma.voicebotTriggerTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Voicebot trigger template not found');
    const variables = await this.prisma.voicebotTriggerVariable.findMany({
      where: { templateId },
      orderBy: { variableKey: 'asc' }
    });
    const resolved = {
      method: template.method,
      url: template.url,
      headers: resolveVariables(template.headers ?? {}, input.variables ?? {}),
      queryParams: resolveVariables(template.queryParams ?? {}, input.variables ?? {}),
      body: resolveVariables(template.bodyTemplate ?? {}, input.variables ?? {})
    };
    const event = await this.prisma.connectorEvent.create({
      data: {
        connectorId: template.connectorId,
        eventType: 'voicebot_test_call',
        rawPayload: toInputJson({ templateId, variables: input.variables ?? {}, resolved }),
        normalizedPayload: toInputJson({
          dryRun: input.dryRun ?? true,
          requiredVariables: variables.map((variable) => variable.variableKey),
          missingVariables: variables.map((variable) => variable.variableKey).filter((key) => (input.variables ?? {})[key] === undefined)
        }),
        status: input.dryRun === false ? 'queued' : 'dry_run'
      }
    });
    const queueJob = input.dryRun === false
      ? await this.voicebotQueue.add('voicebot.trigger', {
          templateId,
          variables: input.variables ?? {},
          dryRun: false,
          actor
        })
      : null;
    return {
      eventId: event.id,
      status: event.status,
      queueJobId: queueJob?.id ?? null,
      request: maskSensitive(resolved),
      missingVariables: (event.normalizedPayload as Record<string, unknown>)?.missingVariables ?? []
    };
  }

  async createVoicebotWebhookMapping(input: CreateVoicebotWebhookMappingDto, actor = 'system') {
    const mapping = await this.prisma.voicebotWebhookMapping.create({
      data: {
        connectorId: input.connectorId,
        sampleBody: toInputJson(maskSensitive(input.sampleBody ?? {})),
        fieldMappings: toInputJson(input.fieldMappings),
        isActive: input.isActive ?? true
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: mapping.id, action: 'create_voicebot_webhook_mapping', newValue: mapping, changedBy: actor });
    return mapping;
  }

  async updateVoicebotWebhookMapping(id: string, input: UpdateVoicebotWebhookMappingDto, actor = 'system') {
    const existing = await this.prisma.voicebotWebhookMapping.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voicebot webhook mapping not found');
    if (input.connectorId) {
      const connector = await this.prisma.voicebotConnector.findUnique({ where: { id: input.connectorId } });
      if (!connector) throw new NotFoundException('Voicebot connector not found');
    }
    const mapping = await this.prisma.voicebotWebhookMapping.update({
      where: { id },
      data: {
        connectorId: input.connectorId,
        sampleBody: input.sampleBody === undefined ? undefined : toInputJson(maskSensitive(input.sampleBody)),
        fieldMappings: input.fieldMappings === undefined ? undefined : toInputJson(input.fieldMappings),
        isActive: input.isActive
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'update_voicebot_webhook_mapping', oldValue: existing, newValue: mapping, changedBy: actor });
    return mapping;
  }

  async deleteVoicebotWebhookMapping(id: string, actor = 'system') {
    const existing = await this.prisma.voicebotWebhookMapping.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Voicebot webhook mapping not found');
    await this.prisma.voicebotWebhookMapping.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Connector', entityId: id, action: 'delete_voicebot_webhook_mapping', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  extractTemplateVariables(input: ExtractVariablesDto) {
    return {
      variables: extractVariables(input.template)
    };
  }

  async ingestWhatsAppWebhook(payload: Record<string, unknown>) {
    const metaEvents = extractMetaWhatsAppEvents(payload);
    if (metaEvents.length > 0) return this.ingestMetaWhatsAppWebhook(payload, metaEvents);

    let lead = await this.findLeadFromPayload(payload);
    const status = normalizeWhatsAppStatus(payload.Status ?? payload.status ?? payload.MessageStatus ?? payload.messageStatus);
    const providerMessageId = String(payload.MessageId ?? payload.messageId ?? payload.ProviderMessageId ?? payload.providerMessageId ?? '');
    const direction = String(payload.Direction ?? payload.direction ?? 'inbound').toLowerCase();
    const content = String(payload.Text ?? payload.text ?? payload.Message ?? payload.message ?? payload.Body ?? payload.body ?? '');
    const inboundPhone = normalizeTenDigitPhone(payload.Phone ?? payload.phone ?? payload.Mobile ?? payload.mobile ?? payload.SourceNumber ?? payload.sourceNumber ?? payload.CustomerNumber ?? payload.customerNumber ?? payload.WaId ?? payload.waId);
    const unknownHandling = await this.whatsAppUnknownNumberHandling();
    if (!lead && inboundPhone && unknownHandling === 'create_lead') {
      lead = await this.prisma.lead.create({
        data: {
          customerName: `WhatsApp ${inboundPhone}`,
          mobile: inboundPhone,
          sourceBatchId: null,
          status: 'New',
          category: 'WhatsApp',
          createdBy: 'system',
          updatedBy: 'system'
        }
      });
    }
    const ownerUserId = await this.resolveWhatsAppNotificationUserId(lead?.id, payload);
    const conversationId = await this.ensureWhatsAppConversation(lead?.id, ownerUserId ?? 'system');
    if (direction === 'inbound') {
      await this.prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), serviceWindowUntil: new Date(Date.now() + 24 * 60 * 60_000) }
      });
    }

    const message = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId,
        leadId: lead?.id,
        direction,
        messageType: String(payload.MessageType ?? payload.messageType ?? 'text'),
        content: content || null,
        status,
        providerMessageId: providerMessageId || null,
        rawPayload: toInputJson(maskSensitive(payload))
      }
    });

    await this.prisma.connectorEvent.create({
      data: {
        eventType: direction === 'inbound' ? 'whatsapp_inbound' : 'whatsapp_status',
        rawPayload: toInputJson(payload),
        normalizedPayload: toInputJson({
          leadId: lead?.id,
          messageId: message.id,
          status,
          direction,
          unknownNumberHandling: !lead ? unknownHandling : undefined,
          notifyUserId: ownerUserId
        }),
        status: lead ? 'received' : 'unknown_lead'
      }
    });

    if (direction === 'inbound' && isOptOutText(content) && lead?.id) {
      await this.setLeadWhatsAppOptOut(lead.id, true);
    }

    if (lead?.id) {
      await this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: activityTypeCodes.whatsapp,
          title: direction === 'inbound' ? 'WhatsApp reply received' : `WhatsApp ${status}`,
          notes: content || null,
          metadata: toInputJson({ messageId: message.id, providerMessageId, status, direction }),
          createdBy: 'system'
        }
      });
    }

    return { Status: 'Success', messageId: message.id, notifyUserId: ownerUserId ?? null };
  }

  private async ingestMetaWhatsAppWebhook(payload: Record<string, unknown>, events: MetaWhatsAppEvent[]) {
    const results: Array<{ messageId?: string; providerMessageId?: string; status?: string; leadId?: string | null }> = [];
    for (const event of events) {
      if (event.kind === 'status') {
        const status = normalizeWhatsAppStatus(event.status);
        const existing = event.providerMessageId
          ? await this.prisma.whatsAppMessage.findFirst({ where: { providerMessageId: event.providerMessageId }, orderBy: { createdAt: 'desc' } })
          : null;
        const updated = existing
          ? await this.prisma.whatsAppMessage.update({
              where: { id: existing.id },
              data: { status, rawPayload: toInputJson(maskSensitive({ previousRawPayload: existing.rawPayload, metaStatus: event.raw })) }
            })
          : null;
        await this.prisma.connectorEvent.create({
          data: {
            eventType: 'whatsapp_meta_status',
            rawPayload: toInputJson(maskSensitive(event.raw)),
            normalizedPayload: toInputJson({ messageId: updated?.id, providerMessageId: event.providerMessageId, status, recipientId: event.waId }),
            status: updated ? status : 'unmatched_status',
            error: updated ? null : 'No local WhatsApp message matched provider message id'
          }
        });
        if (updated?.leadId) {
          await this.prisma.activity.create({
            data: {
              leadId: updated.leadId,
              type: activityTypeCodes.whatsapp,
              title: `WhatsApp ${status}`,
              metadata: toInputJson({ messageId: updated.id, providerMessageId: event.providerMessageId, status }),
              createdBy: 'system'
            }
          });
        }
        results.push({ messageId: updated?.id, providerMessageId: event.providerMessageId, status, leadId: updated?.leadId });
        continue;
      }

      let lead = event.phone ? await this.prisma.lead.findFirst({ where: { mobile: normalizeTenDigitPhone(event.phone) ?? event.phone } }) : null;
      const unknownHandling = await this.whatsAppUnknownNumberHandling();
      if (!lead && event.phone && unknownHandling === 'create_lead') {
        lead = await this.prisma.lead.create({
          data: {
            customerName: event.profileName ? event.profileName : `WhatsApp ${event.phone}`,
            mobile: normalizeTenDigitPhone(event.phone) ?? event.phone,
            sourceBatchId: null,
            status: 'New',
            category: 'WhatsApp',
            createdBy: 'system',
            updatedBy: 'system'
          }
        });
      }
      const ownerUserId = await this.resolveWhatsAppNotificationUserId(lead?.id, { WaId: event.phone });
      const conversationId = await this.ensureWhatsAppConversation(lead?.id, ownerUserId ?? 'system');
      await this.prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), serviceWindowUntil: new Date(Date.now() + 24 * 60 * 60_000) }
      });
      const message = await this.prisma.whatsAppMessage.create({
        data: {
          conversationId,
          leadId: lead?.id,
          direction: 'inbound',
          messageType: event.messageType,
          content: event.content || null,
          status: 'received',
          providerMessageId: event.providerMessageId || null,
          rawPayload: toInputJson(maskSensitive(event.raw))
        }
      });
      await this.prisma.connectorEvent.create({
        data: {
          eventType: 'whatsapp_meta_inbound',
          rawPayload: toInputJson(maskSensitive(event.raw)),
          normalizedPayload: toInputJson({ leadId: lead?.id, messageId: message.id, providerMessageId: event.providerMessageId, phone: event.phone, notifyUserId: ownerUserId }),
          status: lead ? 'received' : 'unknown_lead'
        }
      });
      if (event.messageType === 'text' && isOptOutText(event.content) && lead?.id) {
        await this.setLeadWhatsAppOptOut(lead.id, true);
      }
      if (lead?.id) {
        await this.prisma.activity.create({
          data: {
            leadId: lead.id,
            type: activityTypeCodes.whatsapp,
            title: 'WhatsApp reply received',
            notes: event.content || null,
            metadata: toInputJson({ messageId: message.id, providerMessageId: event.providerMessageId, type: event.messageType }),
            createdBy: 'system'
          }
        });
      }
      results.push({ messageId: message.id, providerMessageId: event.providerMessageId, status: 'received', leadId: lead?.id });
    }
    return { Status: 'Success', events: results.length, results };
  }

  async recordConnectorFailure(input: { connectorId?: string; eventType: string; payload: Record<string, unknown>; error: unknown; retryAfterSeconds?: number }) {
    const message = input.error instanceof Error ? input.error.message : String(input.error ?? 'Connector action failed');
    const failed = await this.prisma.connectorEvent.create({
      data: {
        connectorId: input.connectorId,
        eventType: input.eventType,
        rawPayload: toInputJson(input.payload),
        normalizedPayload: toInputJson({ retryable: true, retryAfterSeconds: input.retryAfterSeconds ?? 60 }),
        status: 'failed',
        error: message.slice(0, 500)
      }
    });

    const retry = await this.prisma.connectorEvent.create({
      data: {
        connectorId: input.connectorId,
        eventType: 'connector_retry_scheduled',
        rawPayload: toInputJson({ failedEventId: failed.id }),
        normalizedPayload: toInputJson({
          sourceEventType: input.eventType,
          nextAttemptAt: new Date(Date.now() + (input.retryAfterSeconds ?? 60) * 1000).toISOString()
        }),
        status: 'queued'
      }
    });

    return { failedEventId: failed.id, retryEventId: retry.id };
  }

  async ingestVoicebotWebhook(connectorId: string, payload: Record<string, unknown>) {
    const mapping = await this.prisma.voicebotWebhookMapping.findFirst({
      where: { connectorId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    const fields = applyMapping(payload, (mapping?.fieldMappings ?? {}) as Record<string, unknown>);
    const lead = await this.findLeadFromPayload(payload, fields, connectorId, { usePayloadFallback: false });
    const providerCallId = String(fields.providerCallId ?? payload.CallSessionId ?? payload.callSessionId ?? payload.id ?? '');
    const call = await this.prisma.voicebotCall.create({
      data: {
        leadId: lead?.id,
        providerCallId: providerCallId || null,
        callStatus: String(fields.callStatus ?? payload.Status ?? payload.status ?? '') || null,
        recordingUrl: String(fields.recordingUrl ?? payload.ResourceURL ?? payload.recordingUrl ?? '') || null,
        transcript: String(fields.transcript ?? payload.transcript ?? '') || null,
        summary: String(fields.summary ?? payload.summary ?? '') || null,
        intent: String(fields.intent ?? payload.intent ?? '') || null,
        disposition: String(fields.disposition ?? payload.disposition ?? '') || null,
        duration: numberOrNull(fields.duration ?? payload.duration ?? payload.CallDuration),
        rawPayload: toInputJson(payload)
      }
    });
    await this.prisma.connectorEvent.create({
      data: {
        connectorId,
        eventType: 'voicebot_webhook',
        rawPayload: toInputJson(payload),
        normalizedPayload: toInputJson({ leadId: lead?.id, callId: call.id, ...fields }),
        status: lead?.id ? 'received' : 'unknown_lead'
      }
    });
    if (lead?.id) {
      await this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: activityTypeCodes.voicebot,
          title: 'Voicebot call',
          notes: call.summary ?? call.transcript,
          disposition: call.disposition,
          metadata: toInputJson({
            callId: call.id,
            providerCallId,
            intent: call.intent,
            callStatus: call.callStatus,
            duration: call.duration,
            recordingUrl: call.recordingUrl,
            transcript: call.transcript,
            summary: call.summary
          }),
          createdBy: 'system'
        }
      });
    }
    return { Status: 'Success', callId: call.id };
  }

  private async ensureWhatsAppConversation(leadId?: string | null, userId?: string | null) {
    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: { leadId: leadId ?? null, userId: userId ?? null },
      orderBy: { updatedAt: 'desc' }
    });
    if (existing) return existing.id;
    const conversation = await this.prisma.whatsAppConversation.create({
      data: {
        leadId: leadId ?? null,
        userId: userId ?? null,
        lastMessageAt: new Date()
      }
    });
    return conversation.id;
  }

  private async whatsAppRuntimeSettings(whatsAppNumberId?: string) {
    const number = whatsAppNumberId ? await this.prisma.whatsAppNumber.findUnique({ where: { id: whatsAppNumberId } }) : null;
    const connector = number?.connectorId
      ? await this.prisma.whatsAppConnector.findUnique({ where: { id: number.connectorId } })
      : await this.prisma.whatsAppConnector.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    const config = this.asConfig(connector?.config);
    return {
      connectorId: connector?.id,
      enableConverse: config.enableConverse !== false,
      notifyMode: String(config.notifyMode ?? 'lead_owner'),
      enableRichMedia: config.enableRichMedia !== false,
      showUrlPreview: config.showUrlPreview === true,
      allowApprovedTemplates: config.allowApprovedTemplates !== false,
      allowUnapprovedTemplates: config.allowUnapprovedTemplates === true,
      complianceType: String(config.complianceType ?? 'opt_out'),
      complianceFieldKey: String(config.complianceFieldKey ?? 'whatsapp_opt_out'),
      dailyRecipientLimit: Number(config.dailyRecipientLimit ?? 0),
      qualityRating: String(config.qualityRating ?? ''),
      selectedNumberId: number?.id
    };
  }

  private async blockedWhatsAppMessage(input: SendWhatsAppMessageDto, actor: string, messageType: string, reason: string, error: string) {
    const event = await this.prisma.connectorEvent.create({
      data: {
        eventType: `whatsapp_outbound_blocked_${reason}`,
        rawPayload: toInputJson(input),
        normalizedPayload: toInputJson({ leadId: input.leadId, reason }),
        status: 'blocked',
        error
      }
    });
    return {
      id: event.id,
      leadId: input.leadId,
      conversationId: input.conversationId,
      direction: 'outbound',
      messageType,
      content: input.content,
      status: 'blocked',
      providerMessageId: null,
      rawPayload: { reason },
      sentBy: actor,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async isWhatsAppBlockedByCompliance(leadId: string, settings: Awaited<ReturnType<ConnectorsService['whatsAppRuntimeSettings']>>) {
    const fieldKey = settings.complianceFieldKey || (settings.complianceType === 'opt_in' ? 'whatsapp_opt_in' : 'whatsapp_opt_out');
    const value = await this.prisma.leadCustomFieldValue.findFirst({
      where: { leadId, field: { fieldKey } },
      include: { field: true }
    });
    const checked = Boolean(value && isTruthy(value.value));
    if (settings.complianceType === 'opt_in') return !checked;
    if (settings.complianceType === 'none') return false;
    return checked || await this.isWhatsAppOptedOut(leadId);
  }

  private async isDailyRecipientLimitExceeded(leadId: string, settings: Awaited<ReturnType<ConnectorsService['whatsAppRuntimeSettings']>>) {
    if (!settings.dailyRecipientLimit || settings.dailyRecipientLimit <= 0) return false;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const rows = await this.prisma.whatsAppMessage.findMany({
      where: { direction: 'outbound', createdAt: { gte: since }, status: { not: 'blocked' } },
      select: { leadId: true },
      take: settings.dailyRecipientLimit + 500
    });
    const recipients = new Set(rows.map((row) => row.leadId).filter(Boolean));
    return !recipients.has(leadId) && recipients.size >= settings.dailyRecipientLimit;
  }

  private publicConnector<T extends { config: unknown }>(connector: T): T {
    return { ...connector, config: publicConnectorConfig(connector.config) } as T;
  }

  private publicVoicebotTemplate<T extends { headers?: unknown; queryParams?: unknown; bodyTemplate?: unknown; responseConfig?: unknown }>(template: T): T {
    return {
      ...template,
      headers: publicConnectorConfig(template.headers),
      queryParams: publicConnectorConfig(template.queryParams),
      bodyTemplate: publicConnectorConfig(template.bodyTemplate),
      responseConfig: publicConnectorConfig(template.responseConfig)
    };
  }

  private asConfig(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private async findLeadFromPayload(
    payload: Record<string, unknown>,
    mappedFields: Record<string, unknown> = {},
    connectorId?: string,
    options: { usePayloadFallback?: boolean } = {}
  ) {
    const fallbackPayload: Record<string, unknown> = options.usePayloadFallback === false ? {} : payload;
    const phone = normalizeTenDigitPhone(
      mappedFields.phone ??
      mappedFields.mobile ??
      mappedFields.leadPhone ??
      fallbackPayload.Phone ??
      fallbackPayload.phone ??
      fallbackPayload.Mobile ??
      fallbackPayload.mobile ??
      fallbackPayload.SourceNumber ??
      fallbackPayload.sourceNumber ??
      fallbackPayload.CustomerNumber ??
      fallbackPayload.customerNumber
    );
    const externalLeadId = String(
      mappedFields.leadId ??
      mappedFields.externalLeadId ??
      mappedFields.loanId ??
      fallbackPayload.LeadId ??
      fallbackPayload.leadId ??
      fallbackPayload.ExternalLeadId ??
      fallbackPayload.externalLeadId ??
      fallbackPayload.LoanId ??
      fallbackPayload.loanId ??
      ''
    ).trim();
    const directId = String(mappedFields.crmLeadId ?? fallbackPayload.crmLeadId ?? fallbackPayload.leadDbId ?? '').trim();
    const where: Prisma.LeadWhereInput[] = [];
    if (directId) where.push({ id: directId });
    if (externalLeadId) where.push({ externalLeadId });
    if (phone) where.push({ mobile: phone });
    if (where.length === 0) return null;
    const matches = await this.prisma.lead.findMany({
      where: { OR: where },
      orderBy: { updatedAt: 'desc' },
      take: 2,
      select: { id: true, externalLeadId: true, mobile: true, updatedAt: true }
    });
    if (matches.length > 1) {
      await this.prisma.connectorEvent.create({
        data: {
          connectorId,
          eventType: 'voicebot_lead_match_ambiguous',
          rawPayload: toInputJson(payload),
          normalizedPayload: toInputJson({ chosenLeadId: matches[0].id, matchCount: matches.length, matchedFields: { directId: Boolean(directId), externalLeadId: Boolean(externalLeadId), phone: Boolean(phone) } }),
          status: 'completed_with_warning'
        }
      });
    }
    return matches[0] ?? null;
  }

  private async whatsAppLeadSummaries(viewerId: string | undefined, visibleLeadIds: string[] | null) {
    if (!viewerId) return [];
    const effective = await this.access.effectivePermissions(viewerId);
    if (!this.access.canModule(effective, 'Lead', 'view')) return [];
    const leads = await this.prisma.lead.findMany({
      where: visibleLeadIds ? { id: { in: visibleLeadIds } } : {},
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
    return leads.map((lead) => this.access.applyFieldAccessToRecord(effective, 'Lead', {
      id: lead.id,
      customerName: lead.customerName,
      mobile: lead.mobile,
      status: lead.status,
      category: lead.category,
      disposition: lead.disposition,
      assignedUserId: lead.assignedUserId
    }));
  }

  private async visibleLeadIdsForConnectorList(viewerId: string | undefined, effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null) {
    if (!viewerId || !effective || this.access.hasLeadAllScope(effective)) return null;
    const leads = await this.prisma.lead.findMany({
      where: { assignedUserId: viewerId },
      select: { id: true },
      take: CONNECTOR_VISIBLE_LEAD_ID_LIMIT
    });
    return leads.map((lead) => lead.id);
  }

  private async assertWhatsAppLeadVisible(leadId: string, actor: string) {
    if (!actor || actor === 'system' || actor === 'system@unnatify.local') return;
    const effective = await this.access.effectivePermissions(actor);
    if (this.access.hasLeadAllScope(effective)) return;
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, assignedUserId: actor }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');
  }

  private async isWhatsAppOptedOut(leadId: string) {
    const values = await this.prisma.leadCustomFieldValue.findMany({
      where: {
        leadId,
        field: { fieldKey: { in: ['whatsapp_opt_out', 'opt_out', 'do_not_contact'] } }
      },
      include: { field: true }
    });
    return values.some((entry) => isTruthy(entry.value));
  }

  private async isWithinWhatsAppServiceWindow(leadId?: string, conversationId?: string) {
    if (conversationId) {
      const conversation = await this.prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
        select: { serviceWindowUntil: true }
      });
      return Boolean(conversation?.serviceWindowUntil && conversation.serviceWindowUntil.getTime() > Date.now());
    }
    if (leadId) {
      const conversation = await this.prisma.whatsAppConversation.findFirst({
        where: { leadId },
        orderBy: { updatedAt: 'desc' },
        select: { serviceWindowUntil: true }
      });
      if (conversation) return Boolean(conversation.serviceWindowUntil && conversation.serviceWindowUntil.getTime() > Date.now());
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conditions: Prisma.WhatsAppMessageWhereInput[] = [];
    if (leadId) conditions.push({ leadId });
    if (!conditions.length) return false;
    const inbound = await this.prisma.whatsAppMessage.findFirst({
      where: {
        direction: 'inbound',
        createdAt: { gte: since },
        OR: conditions
      },
      select: { id: true }
    });
    return Boolean(inbound);
  }

  private async setLeadWhatsAppOptOut(leadId: string, optedOut: boolean) {
    const field = await this.prisma.leadCustomField.upsert({
      where: { fieldKey: 'whatsapp_opt_out' },
      update: { isActive: true },
      create: {
        fieldKey: 'whatsapp_opt_out',
        label: 'WhatsApp Opt Out',
        fieldType: 'boolean',
        isActive: true
      }
    });
    await this.prisma.leadCustomFieldValue.upsert({
      where: { leadId_fieldId: { leadId, fieldId: field.id } },
      update: { value: optedOut },
      create: { leadId, fieldId: field.id, value: optedOut }
    });
  }

  private async whatsAppUnknownNumberHandling() {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: 'whatsapp.unknownNumberHandling' } });
    const value = setting?.value && typeof setting.value === 'object' && 'mode' in setting.value ? String((setting.value as Record<string, unknown>).mode) : 'store_event';
    return ['store_event', 'create_lead'].includes(value) ? value : 'store_event';
  }

  private async resolveWhatsAppNotificationUserId(leadId: string | undefined, payload: Record<string, unknown>) {
    if (!leadId) return null;
    const setting = await this.prisma.appSetting.findUnique({ where: { key: 'whatsapp.replyNotificationRouting' } });
    const mode = setting?.value && typeof setting.value === 'object' && 'mode' in setting.value ? String((setting.value as Record<string, unknown>).mode) : 'lead_owner';
    if (mode === 'none') return null;
    if (mode === 'last_sender') {
      const lastOutbound = await this.prisma.whatsAppMessage.findFirst({
        where: { leadId, direction: 'outbound', sentBy: { not: null } },
        orderBy: { createdAt: 'desc' }
      });
      if (lastOutbound?.sentBy && lastOutbound.sentBy !== 'system') return lastOutbound.sentBy;
    }
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { assignedUserId: true } });
    return lead?.assignedUserId ?? (String(payload.AssignedUserId ?? payload.assignedUserId ?? '') || null);
  }
}

type MetaWhatsAppEvent =
  | {
      kind: 'message';
      providerMessageId: string;
      phone: string;
      profileName: string;
      messageType: string;
      content: string;
      raw: Record<string, unknown>;
    }
  | {
      kind: 'status';
      providerMessageId: string;
      status: string;
      waId: string;
      raw: Record<string, unknown>;
    };

function extractMetaWhatsAppEvents(payload: Record<string, unknown>): MetaWhatsAppEvent[] {
  const entries = Array.isArray(payload.entry) ? payload.entry as Array<Record<string, unknown>> : [];
  const events: MetaWhatsAppEvent[] = [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
    for (const change of changes) {
      const value = change.value && typeof change.value === 'object' && !Array.isArray(change.value)
        ? change.value as Record<string, unknown>
        : {};
      const contacts = Array.isArray(value.contacts) ? value.contacts as Array<Record<string, unknown>> : [];
      const contactByWaId = new Map(contacts.map((contact) => [String(contact.wa_id ?? ''), contact]));
      const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
      for (const message of messages) {
        const messageType = String(message.type ?? 'text');
        const phone = String(message.from ?? '');
        const contact = contactByWaId.get(phone);
        events.push({
          kind: 'message',
          providerMessageId: String(message.id ?? ''),
          phone,
          profileName: String((contact?.profile as Record<string, unknown> | undefined)?.name ?? ''),
          messageType,
          content: metaMessageContent(message, messageType),
          raw: { entryId: entry.id, field: change.field, value, message }
        });
      }
      const statuses = Array.isArray(value.statuses) ? value.statuses as Array<Record<string, unknown>> : [];
      for (const status of statuses) {
        events.push({
          kind: 'status',
          providerMessageId: String(status.id ?? ''),
          status: String(status.status ?? ''),
          waId: String(status.recipient_id ?? ''),
          raw: { entryId: entry.id, field: change.field, value, status }
        });
      }
    }
  }
  return events;
}

function metaMessageContent(message: Record<string, unknown>, messageType: string) {
  const record = message[messageType] && typeof message[messageType] === 'object' && !Array.isArray(message[messageType])
    ? message[messageType] as Record<string, unknown>
    : {};
  if (messageType === 'text') return String(record.body ?? '');
  if (messageType === 'button') return String(record.text ?? record.payload ?? '');
  if (messageType === 'interactive') {
    const interactive = record;
    const buttonReply = interactive.button_reply as Record<string, unknown> | undefined;
    const listReply = interactive.list_reply as Record<string, unknown> | undefined;
    return String(buttonReply?.title ?? listReply?.title ?? buttonReply?.id ?? listReply?.id ?? '');
  }
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(messageType)) {
    return String(record.caption ?? record.filename ?? record.id ?? messageType);
  }
  return String(record.body ?? record.text ?? messageType);
}

function timingEqual(expected: string, actual: string) {
  try {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
