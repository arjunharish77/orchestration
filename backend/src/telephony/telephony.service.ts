import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import IORedis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { activityTypeCodes } from '../activities/activity-types';
import { AuditService } from '../audit/audit.service';
import { requiredEnv } from '../common/env';
import { assertWebhookSecret } from '../common/webhook-security';
import { PrismaService } from '../prisma/prisma.service';
import {
  agentPopupSample,
  appendQuery,
  callLogSample,
  customValueMap,
  extractVariables,
  formatCallSummary,
  formatRequestBody,
  isPlainObject,
  normalizeMcubePayload,
  normalizeTenDigitPhone,
  parseDurationSeconds,
  parseProviderDate,
  popupLeadSelect,
  resolveTelephonyNumbers,
  resolveTemplate,
  safeJson,
  toInputJson,
  toJsonObject,
  toSerializable
} from './telephony.utils';
import { ExecuteClickToCallDto, PreviewTelephonyVariablesDto, SaveTelephonyConnectorConfigDto, UpdatePopupDeliveryDto } from './telephony.dto';

@Injectable()
export class TelephonyService {
  private readonly onlineAgents = new Map<string, { seenAt: number; phone: string | null }>();
  private readonly redisUrl = requiredEnv('REDIS_URL', 'redis://localhost:6379');
  private readonly presenceRedis = new IORedis(this.redisUrl, {
    maxRetriesPerRequest: null
  });
  private readonly popupPublisher = new IORedis(this.redisUrl, {
    maxRetriesPerRequest: null
  });
  private readonly popupSubscriber = new IORedis(this.redisUrl, {
    maxRetriesPerRequest: null
  });
  private static readonly popupSubjects = new Map<string, { subject: Subject<{ type?: string; data: unknown }>; subscribers: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {
    void this.setupPopupPubSub();
  }

  async routeLead(callerId: unknown) {
    const callerPhone = normalizeTenDigitPhone(callerId);
    if (!callerPhone) return '';

    const lead = await this.prisma.lead.findFirst({
      where: { mobile: callerPhone },
      orderBy: { updatedAt: 'desc' }
    });

    let agentPhone: string | null = null;
    if (lead?.assignedUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: lead.assignedUserId }
      });
      agentPhone = normalizeTenDigitPhone(user?.phone);
    }

    await this.prisma.telephonyRouteRequest.create({
      data: {
        callerId: callerPhone,
        leadId: lead?.id,
        returnedAgentNumber: agentPhone,
        rawPayload: toJsonObject({ caller_id: String(callerId ?? '') })
      }
    });
    await this.recordTelephonyConnectorEvent({
      eventType: 'telephony_call_route',
      rawPayload: { caller_id: String(callerId ?? '') },
      normalizedPayload: { callerId: callerPhone, leadId: lead?.id, returnedAgentNumber: agentPhone },
      status: agentPhone ? 'success' : 'blank_response'
    });

    return agentPhone ?? '';
  }

  async connectorReference(apiBaseUrl: string) {
    const baseUrl = apiBaseUrl.replace(/\/$/, '');
    const connector = await this.telephonyConnector();

    return {
      connector,
      provider: 'MCUBE',
      phoneRule: 'Lead and user phone numbers are stored and returned as 10 digits only.',
      endpoints: [
        {
          key: 'lead-route',
          title: 'Inbound Call Route API',
          method: 'GET',
          url: `${baseUrl}/webhooks/telephony/lead-route?caller_id=9845098450`,
          requiredHeaders: { 'x-webhook-secret': '<configured in Telephony connector>' },
          responseType: 'text/plain',
          sampleResponse: '9123456789',
          blankResponseRule: 'Returns blank text when no lead or agent phone is available.'
        },
        {
          key: 'agent-popup',
          title: 'Agent Popup API',
          method: 'POST',
          url: `${baseUrl}/webhooks/telephony/agent-popup`,
          requiredHeaders: { 'x-webhook-secret': '<configured in Telephony connector>' },
          contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
          responseType: 'application/json',
          sampleBody: agentPopupSample(),
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
          url: `${baseUrl}/webhooks/telephony/call-log-complete`,
          requiredHeaders: { 'x-webhook-secret': '<configured in Telephony connector>' },
          contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
          responseType: 'application/json',
          sampleBody: callLogSample(),
          sampleResponse: {
            Status: 'Success',
            Message: 'Phone Call Logged Successfully'
          }
        }
      ],
      clickToCall: {
        description: 'Postman-like provider API call. Body supports mail merge from lead, user, activity, and custom fields.',
        supportedMethods: ['GET', 'POST'],
        requestTypes: ['JSON', 'FORM_URLENCODED'],
        responseTypes: ['JSON', 'TEXT'],
        defaultBody: {
          HTTP_AUTHORIZATION: 'stored-provider-token',
          exenumber: '{{user.phone}}',
          custnumber: '{{lead.mobile}}'
        },
        supportedVariables: [
          '{{lead.mobile}}',
          '{{lead.customerName}}',
          '{{lead.externalLeadId}}',
          '{{lead.status}}',
          '{{lead.category}}',
          '{{lead.custom.field_key}}',
          '{{user.phone}}',
          '{{user.name}}',
          '{{user.custom.field_key}}',
          '{{activity.custom.field_key}}'
        ]
      },
      popupConfig: {
        description: 'Admin configurable popup fields and tabs. Frontend tab sync will use local/broadcast state when realtime sessions are added.',
        defaultVisibleFields: ['customerName', 'mobile', 'status', 'category', 'disposition', 'branchCode', 'offerAmount'],
        defaultTabs: ['Overview', 'Activities', 'Dispositions', 'Tasks', 'Calls', 'Notes', 'Custom Fields', 'Automation History']
      }
    };
  }

  async saveConnectorConfig(input: SaveTelephonyConnectorConfigDto, actor = 'system') {
    const existing = await this.telephonyConnector();
    const config = {
      clickToCallUrl: normalizeClickToCallUrl(input.clickToCallUrl ?? ''),
      httpMethod: input.httpMethod ?? 'POST',
      responseKeyword: input.responseKeyword ?? '',
      requestType: input.requestType ?? 'JSON',
      responseType: input.responseType ?? 'JSON',
      providerSupportEmail: input.providerSupportEmail ?? 'support@mcube.com',
      webhookSecret: input.webhookSecret ?? existingConfigValue(existing?.config, 'webhookSecret') ?? '',
      customHeaders: input.customHeaders ?? {},
      dataTemplate: input.dataTemplate ?? {
        HTTP_AUTHORIZATION: 'stored-provider-token',
        exenumber: '{{user.phone}}',
        custnumber: '{{lead.mobile}}'
      },
      popupConfig: input.popupConfig ?? {}
    };

    if (existing) {
      const connector = await this.prisma.connector.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          provider: input.provider ?? existing.provider ?? 'MCUBE',
          config: toInputJson(config),
          isActive: input.isActive ?? existing.isActive
        }
      });
      await this.audit.write({ moduleName: 'Connector', entityId: connector.id, action: 'update_telephony_connector', oldValue: existing, newValue: connector, changedBy: actor });
      return connector;
    }

    const connector = await this.prisma.connector.create({
      data: {
        name: input.name ?? 'MCUBE Telephony',
        type: 'telephony',
        provider: input.provider ?? 'MCUBE',
        config: toInputJson(config),
        isActive: input.isActive ?? false
      }
    });
    await this.audit.write({ moduleName: 'Connector', entityId: connector.id, action: 'create_telephony_connector', newValue: connector, changedBy: actor });
    return connector;
  }

  async assertWebhookSecret(providedSecret?: string | null) {
    const connector = await this.telephonyConnector();
    const config = isPlainObject(connector?.config) ? connector.config : {};
    const configuredSecret = String(config.webhookSecret ?? '').trim();
    assertWebhookSecret({ configuredSecret, providedSecret: providedSecret ?? undefined });
  }

  previewVariables(input: PreviewTelephonyVariablesDto) {
    return { variables: extractVariables(input.template) };
  }

  async recentPopups(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const userPhone = normalizeTenDigitPhone(user?.phone);
    const events = await this.prisma.telephonyAgentPopupEvent.findMany({
      where: { status: { in: ['received', 'delivered', 'seen'] } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const matched = events
      .filter((event) => {
        if (event.agentUserId && event.agentUserId === userId) return true;
        if (event.agentPhone && userPhone) return event.agentPhone === userPhone;
        const payload = event.rawPayload as Record<string, unknown>;
        const normalized = normalizeMcubePayload(payload);
        const numbers = resolveTelephonyNumbers(normalized);
        return !userPhone || numbers.agentPhone === userPhone;
      })
      .slice(0, 5);
    const leadIds = matched.map((event) => event.leadId).filter(Boolean) as string[];
    const leads = leadIds.length
      ? await this.prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: {
            id: true,
            externalLeadId: true,
            customerName: true,
            mobile: true,
            email: true,
            status: true,
            category: true,
            disposition: true,
            branchCode: true,
            branchName: true,
            offerAmount: true,
            emiAmount: true,
            preferredLanguage: true,
            location: true,
            uploadDate: true,
            offerExpiryDate: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : [];
    const leadById = new Map(leads.map((lead) => [lead.id, {
      ...lead,
      customerLocation: lead.location
    }]));
    return matched.map((event) => ({
      ...this.formatPopupEvent(event),
      lead: event.leadId ? leadById.get(event.leadId) ?? null : null
    }));
  }

  async popupStream(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const streamKey = normalizeTenDigitPhone(user?.phone) ?? userId;
    const initialPopups = await this.recentPopups(userId);
    const seenPopupIds = new Set(initialPopups.map((popup) => popup.id));
    const entry = TelephonyService.popupSubjects.get(streamKey) ?? {
      subject: new Subject<{ type?: string; data: unknown }>(),
      subscribers: 0
    };
    entry.subscribers += 1;
    TelephonyService.popupSubjects.set(streamKey, entry);

    return new Observable<{ type?: string; data: unknown }>((subscriber) => {
      subscriber.next({ type: 'telephony-popup-ready', data: { connected: true, timestamp: new Date().toISOString() } });
      const subscription = entry.subject.subscribe((message) => {
        if (message.type === 'telephony-popup') {
          const popupId = typeof message.data === 'object' && message.data && 'id' in message.data
            ? String((message.data as { id: unknown }).id)
            : null;
          if (popupId) {
            if (seenPopupIds.has(popupId)) return;
            seenPopupIds.add(popupId);
            void this.markPopupDelivered(popupId, userId);
          }
        }
        subscriber.next(message);
      });

      const heartbeat = setInterval(() => {
        subscriber.next({ type: 'telephony-popup-heartbeat', data: { timestamp: new Date().toISOString() } });
      }, 30_000);

      const popupPoll = setInterval(() => {
        void this.recentPopups(userId).then(async (popups) => {
          for (const popup of popups.reverse()) {
            if (seenPopupIds.has(popup.id)) continue;
            seenPopupIds.add(popup.id);
            await this.markPopupDelivered(popup.id, userId);
            subscriber.next({ type: 'telephony-popup', data: toSerializable(popup) });
          }
        }).catch((error) => {
          subscriber.next({ type: 'telephony-popup-error', data: { message: error instanceof Error ? error.message : 'Popup stream refresh failed' } });
        });
      }, 2_000);

      return () => {
        clearInterval(heartbeat);
        clearInterval(popupPoll);
        subscription.unsubscribe();
        entry.subscribers -= 1;
        if (entry.subscribers <= 0) {
          entry.subject.complete();
          TelephonyService.popupSubjects.delete(streamKey);
        }
      };
    });
  }

  async agentHeartbeat(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true, isActive: true } });
    if (!user?.isActive) return { online: false };
    const phone = normalizeTenDigitPhone(user.phone);
    this.onlineAgents.set(userId, { seenAt: Date.now(), phone });
    await this.writeAgentPresence(userId, phone);
    return {
      online: true,
      phone,
      expiresInSeconds: 75
    };
  }

  async updatePopupDelivery(eventId: string, userId: string, input: UpdatePopupDeliveryDto) {
    const event = await this.prisma.telephonyAgentPopupEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Popup event not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const userPhone = normalizeTenDigitPhone(user?.phone);
    if (event.agentUserId && event.agentUserId !== userId) throw new BadRequestException('Popup does not belong to this user');
    if (event.agentPhone && userPhone && event.agentPhone !== userPhone) throw new BadRequestException('Popup does not belong to this agent phone');
    const now = new Date();
    const updated = await this.prisma.telephonyAgentPopupEvent.update({
      where: { id: eventId },
      data: input.status === 'closed'
        ? { status: 'closed', closedAt: now, seenAt: event.seenAt ?? now, lastSessionId: input.sessionId ?? event.lastSessionId }
        : { status: event.status === 'received' ? 'seen' : event.status, seenAt: event.seenAt ?? now, lastSessionId: input.sessionId ?? event.lastSessionId }
    });
    if (input.status === 'closed') {
      await this.emitPopupClosedToAgentPhone(event.agentPhone ?? userPhone, eventId);
    }
    return this.formatPopupEvent(updated);
  }

  async onlineAgentSummary() {
    const now = Date.now();
    const local = Array.from(this.onlineAgents.entries())
      .filter(([, session]) => now - session.seenAt <= 75_000)
      .map(([userId, session]) => ({
        userId,
        phone: session.phone,
        lastSeenAt: new Date(session.seenAt).toISOString()
      }));
    const keys = await this.presenceRedis.keys('telephony:agent-presence:*');
    const remote = await Promise.all(keys.map(async (key) => {
      const value = await this.presenceRedis.get(key);
      if (!value) return null;
      const parsed = safeJson(value);
      return {
        userId: key.replace('telephony:agent-presence:', ''),
        phone: normalizeTenDigitPhone(parsed.phone),
        lastSeenAt: String(parsed.seenAt ?? new Date().toISOString())
      };
    }));
    const byUser = new Map<string, { userId: string; phone: string | null; lastSeenAt: string }>();
    [...local, ...remote.filter(Boolean) as Array<{ userId: string; phone: string | null; lastSeenAt: string }>].forEach((entry) => byUser.set(entry.userId, entry));
    return Array.from(byUser.values());
  }

  async executeClickToCall(input: ExecuteClickToCallDto, actorUserId?: string) {
    const connector = await this.telephonyConnector();
    const config = (connector?.config ?? {}) as Record<string, unknown>;
    const clickToCallUrl = normalizeClickToCallUrl(String(config.clickToCallUrl ?? ''));
    if (!connector || !clickToCallUrl) throw new BadRequestException('Telephony click-to-call connector is not configured');

    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
      include: {
        customValues: { include: { field: true } }
      }
    });
    if (!lead) throw new BadRequestException('Lead not found');

    const userId = actorUserId ?? input.userId ?? lead.assignedUserId;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          include: { customValues: { include: { field: true } } }
        })
      : null;

    const leadPhone = normalizeTenDigitPhone(lead.mobile) ?? lead.mobile;
    const agentPhone = normalizeTenDigitPhone(user?.phone) ?? user?.phone ?? '';

    const context = {
      lead: { ...lead, mobile: leadPhone },
      user: user ? { ...user, phone: agentPhone } : {},
      activity: input.activity ?? {},
      leadCustom: customValueMap(lead.customValues),
      userCustom: customValueMap(user?.customValues ?? [])
    };
    const method = String(config.httpMethod ?? 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';
    const requestType = String(config.requestType ?? 'JSON').toUpperCase();
    const headers = resolveTemplate(config.customHeaders ?? {}, context) as Record<string, string>;
    const body = resolveTemplate(config.dataTemplate ?? {}, context);
    const resolvedUrl = String(resolveTemplate(clickToCallUrl, context));
    const url = method === 'GET' && isPlainObject(body) ? appendQuery(resolvedUrl, body) : resolvedUrl;
    const responseKeyword = String(config.responseKeyword ?? '').trim().toLowerCase();
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...headers,
          ...(method === 'POST' && requestType === 'FORM_URLENCODED' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          ...(method === 'POST' && requestType !== 'FORM_URLENCODED' ? { 'Content-Type': 'application/json' } : {})
        },
        body: method === 'POST' ? formatRequestBody(body, requestType) : undefined
      });
      const responseText = await response.text();
      const responseMatched = !responseKeyword || responseText.toLowerCase().includes(responseKeyword);
      const success = response.ok && responseMatched;
      const providerFailure = responseText || `Provider returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      const failureDetail = !response.ok
        ? providerFailure
        : responseKeyword && !responseMatched
          ? `Response keyword "${config.responseKeyword}" was not found in provider response: ${providerFailure}`
          : responseText;
      await this.prisma.connectorEvent.create({
        data: {
          connectorId: connector.id,
          eventType: 'telephony_click_to_call',
          rawPayload: toInputJson({ leadId: lead.id, userId: user?.id, url, method, requestType, headers, body }),
          normalizedPayload: toInputJson({ status: response.status, ok: response.ok, responseMatched, responseKeyword, responseText, durationMs: Date.now() - startedAt }),
          status: success ? 'success' : 'failed',
          error: success ? null : failureDetail.slice(0, 500)
        }
      });

      return {
        status: success ? 'success' : 'failed',
        success,
        httpStatus: response.status,
        response: responseText,
        error: success ? undefined : failureDetail.slice(0, 500)
      };
    } catch (error) {
      await this.prisma.connectorEvent.create({
        data: {
          connectorId: connector.id,
          eventType: 'telephony_click_to_call',
          rawPayload: toInputJson({ leadId: lead.id, userId: user?.id, url, method, requestType, headers, body }),
          normalizedPayload: toInputJson({ durationMs: Date.now() - startedAt }),
          status: 'failed',
          error: error instanceof Error ? error.message : 'Click-to-call failed'
        }
      });
      throw error;
    }
  }

  async agentPopup(payload: Record<string, unknown>) {
    const normalized = normalizeMcubePayload(payload);
    const numbers = resolveTelephonyNumbers(normalized);
    const callSessionId = normalized.callSessionId || randomUUID();
    const lead = await this.findLeadForTelephony(numbers.leadPhone);
    const agentUser = numbers.agentPhone ? await this.findUserByPhone(numbers.agentPhone) : null;
    const existing = normalized.callSessionId
      ? await this.prisma.telephonyAgentPopupEvent.findFirst({
          where: { callSessionId: normalized.callSessionId },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    if (existing) {
      const existingAgentUserId = agentUser?.id ?? existing.agentUserId;
      const canDeliverExisting = existingAgentUserId ? await this.isAgentOnline(existingAgentUserId) : false;
      if (canDeliverExisting) {
        await this.emitPopupToAgentPhone(numbers.agentPhone ?? existing.agentPhone, existing.id);
      } else {
        await this.prisma.telephonyAgentPopupEvent.update({
          where: { id: existing.id },
          data: { status: 'discarded', agentUserId: existingAgentUserId ?? existing.agentUserId }
        });
      }
      await this.recordTelephonyConnectorEvent({
        eventType: 'telephony_agent_popup',
        rawPayload: payload,
        normalizedPayload: {
          callSessionId,
          popupEventId: existing.id,
          leadId: lead?.id ?? existing.leadId,
          agentUserId: existingAgentUserId,
          normalizedDirection: numbers.direction,
          normalizedLeadPhone: numbers.leadPhone,
          normalizedAgentPhone: numbers.agentPhone,
          duplicate: true
        },
        status: canDeliverExisting ? 'delivered' : 'discarded'
      });
      return {
        Status: 'Success',
        Message: 'Message broadcasted',
        CallSessionId: existing.callSessionId ?? callSessionId
      };
    }

    const canDeliverPopup = agentUser?.id ? await this.isAgentOnline(agentUser.id) : false;
    const event = await this.prisma.telephonyAgentPopupEvent.create({
      data: {
        leadId: lead?.id,
        callSessionId,
        agentPhone: numbers.agentPhone,
        agentUserId: agentUser?.id,
        rawPayload: toJsonObject({
          ...payload,
          normalizedDirection: numbers.direction,
          normalizedLeadPhone: numbers.leadPhone,
          normalizedAgentPhone: numbers.agentPhone
        }),
        status: canDeliverPopup ? 'received' : 'discarded'
      }
    });

    if (canDeliverPopup) {
      await this.emitPopupToAgentPhone(numbers.agentPhone, event.id);
    }
    await this.recordTelephonyConnectorEvent({
      eventType: 'telephony_agent_popup',
      rawPayload: payload,
      normalizedPayload: {
        callSessionId,
        popupEventId: event.id,
        leadId: lead?.id,
        agentUserId: agentUser?.id,
        normalizedDirection: numbers.direction,
        normalizedLeadPhone: numbers.leadPhone,
        normalizedAgentPhone: numbers.agentPhone
      },
      status: event.status
    });

    return {
      Status: 'Success',
      Message: 'Message broadcasted',
      CallSessionId: callSessionId
    };
  }

  async callLogComplete(payload: Record<string, unknown>) {
    const normalized = normalizeMcubePayload(payload);
    const numbers = resolveTelephonyNumbers(normalized);
    const displayPhone = normalizeTenDigitPhone(normalized.displayNumber);
    const callSessionId = normalized.callSessionId || randomUUID();
    const lead = await this.findLeadForTelephony(numbers.leadPhone);
    const agentUser = numbers.agentPhone ? await this.findUserByPhone(numbers.agentPhone) : null;
    const existing = normalized.callSessionId
      ? await this.prisma.telephonyCall.findFirst({
          where: { providerCallId: normalized.callSessionId },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    if (existing) {
      const updateData = {
        leadId: lead?.id ?? existing.leadId,
        phoneNumber: numbers.leadPhone ?? displayPhone ?? existing.phoneNumber,
        agentUserId: agentUser?.id ?? lead?.assignedUserId ?? existing.agentUserId,
        callDirection: numbers.direction || existing.callDirection,
        callStatus: normalized.status || existing.callStatus,
        callDuration: parseDurationSeconds(normalized.callDuration) ?? existing.callDuration,
        recordingUrl: normalized.recordingUrl || existing.recordingUrl,
        disposition: normalized.disposition || existing.disposition,
        startedAt: parseProviderDate(normalized.startTime) ?? existing.startedAt,
        endedAt: parseProviderDate(normalized.endTime) ?? existing.endedAt,
        rawPayload: toJsonObject(payload)
      };
      await this.prisma.telephonyCall.update({
        where: { id: existing.id },
        data: updateData
      });
      await this.prisma.telephonyCallLogEvent.create({
        data: {
          leadId: lead?.id ?? existing.leadId,
          callSessionId,
          rawPayload: toJsonObject({
            ...payload,
            normalizedDirection: numbers.direction,
            normalizedLeadPhone: numbers.leadPhone,
            normalizedAgentPhone: numbers.agentPhone,
            duplicateOfCallId: existing.id
          }),
          status: 'updated_existing'
        }
      });
      await this.updateExistingCallActivity(callSessionId, {
        leadId: lead?.id ?? existing.leadId,
        direction: numbers.direction,
        agentLabel: agentUser?.name ?? numbers.agentPhone ?? displayPhone,
        durationSeconds: parseDurationSeconds(normalized.callDuration),
        sourcePhone: numbers.sourcePhone,
        destinationPhone: numbers.destinationPhone,
        leadPhone: numbers.leadPhone,
        agentPhone: numbers.agentPhone,
        displayPhone,
        status: normalized.status,
        recordingUrl: normalized.recordingUrl,
        callNotes: normalized.callNotes
      });
      await this.recordTelephonyConnectorEvent({
        eventType: 'telephony_call_log_complete',
        rawPayload: payload,
        normalizedPayload: { callSessionId, leadId: lead?.id ?? existing.leadId, callId: existing.id, status: 'updated_existing' },
        status: 'updated_existing'
      });
      return {
        Status: 'Success',
        Message: 'Phone Call Logged Successfully'
      };
    }

    await this.prisma.telephonyCallLogEvent.create({
      data: {
        leadId: lead?.id,
        callSessionId,
        rawPayload: toJsonObject({
          ...payload,
          normalizedDirection: numbers.direction,
          normalizedLeadPhone: numbers.leadPhone,
          normalizedAgentPhone: numbers.agentPhone
        }),
        status: 'received'
      }
    });

    const call = await this.prisma.telephonyCall.create({
      data: {
        leadId: lead?.id,
        phoneNumber: numbers.leadPhone ?? displayPhone,
        agentUserId: agentUser?.id ?? lead?.assignedUserId,
        callDirection: numbers.direction || null,
        callStatus: normalized.status || null,
        callDuration: parseDurationSeconds(normalized.callDuration),
        recordingUrl: normalized.recordingUrl || null,
        providerCallId: callSessionId,
        disposition: normalized.disposition || null,
        startedAt: parseProviderDate(normalized.startTime),
        endedAt: parseProviderDate(normalized.endTime),
        rawPayload: toJsonObject(payload)
      }
    });
    await this.recordTelephonyConnectorEvent({
      eventType: 'telephony_call_log_complete',
      rawPayload: payload,
      normalizedPayload: { callSessionId, leadId: lead?.id, agentUserId: agentUser?.id, callId: call.id, status: 'received' },
      status: 'received'
    });

    if (lead) {
      const summary = formatCallSummary(numbers.direction, agentUser?.name ?? numbers.agentPhone ?? displayPhone, parseDurationSeconds(normalized.callDuration));
      await this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: activityTypeCodes.call,
          title: summary,
          notes: summary,
          disposition: normalized.disposition || null,
          metadata: toJsonObject({
            callSessionId,
            sourcePhone: numbers.sourcePhone,
            destinationPhone: numbers.destinationPhone,
            leadPhone: numbers.leadPhone,
            agentPhone: numbers.agentPhone,
            displayPhone,
            direction: numbers.direction,
            status: normalized.status,
            duration: String(normalized.callDuration ?? ''),
            durationSeconds: parseDurationSeconds(normalized.callDuration),
            recordingUrl: normalized.recordingUrl,
            callNotes: normalized.callNotes
          }),
          createdBy: 'system'
        }
      });
    }

    return {
      Status: 'Success',
      Message: 'Phone Call Logged Successfully'
    };
  }

  private async updateExistingCallActivity(callSessionId: string, input: {
    leadId?: string | null;
    direction: unknown;
    agentLabel: string | null | undefined;
    durationSeconds: number | null;
    sourcePhone: string | null;
    destinationPhone: string | null;
    leadPhone: string | null;
    agentPhone: string | null;
    displayPhone: string | null;
    status: string;
    recordingUrl: string;
    callNotes: string;
  }) {
    if (!input.leadId) return;
    const recentActivities = await this.prisma.activity.findMany({
      where: { leadId: input.leadId, type: activityTypeCodes.call },
      orderBy: { createdAt: 'desc' },
      take: 25
    });
    const activity = recentActivities.find((entry) => {
      const metadata = entry.metadata as Record<string, unknown> | null;
      return String(metadata?.callSessionId ?? '') === callSessionId;
    });
    if (!activity) return;
    const summary = formatCallSummary(input.direction, input.agentLabel, input.durationSeconds);
    await this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        title: summary,
        notes: summary,
        metadata: toJsonObject({
          callSessionId,
          sourcePhone: input.sourcePhone,
          destinationPhone: input.destinationPhone,
          leadPhone: input.leadPhone,
          agentPhone: input.agentPhone,
          displayPhone: input.displayPhone,
          direction: input.direction,
          status: input.status,
          duration: input.durationSeconds === null ? '' : String(input.durationSeconds),
          durationSeconds: input.durationSeconds,
          recordingUrl: input.recordingUrl,
          callNotes: input.callNotes,
          updatedFromDuplicateWebhook: true
        })
      }
    });
  }

  private async recordTelephonyConnectorEvent(input: { eventType: string; rawPayload: unknown; normalizedPayload?: unknown; status?: string; error?: string }) {
    const connector = await this.telephonyConnector();
    await this.prisma.connectorEvent.create({
      data: {
        connectorId: connector?.id,
        eventType: input.eventType,
        rawPayload: toInputJson(input.rawPayload),
        normalizedPayload: input.normalizedPayload === undefined ? undefined : toInputJson(input.normalizedPayload),
        status: input.status ?? 'received',
        error: input.error
      }
    });
  }

  private async findLeadForTelephony(leadPhone: string | null) {
    if (!leadPhone) return null;

    return this.prisma.lead.findFirst({
      where: {
        mobile: leadPhone
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  private async findUserByPhone(phone: string | null) {
    if (!phone) return null;
    return this.prisma.user.findFirst({
      where: {
        phone,
        isActive: true,
        isSystem: false
      },
      select: { id: true, name: true, phone: true }
    });
  }

  private telephonyConnector() {
    return this.prisma.connector.findFirst({
      where: { type: 'telephony', provider: 'MCUBE' },
      orderBy: { updatedAt: 'desc' }
    });
  }

  private async isAgentOnline(userId: string) {
    const local = this.onlineAgents.get(userId);
    if (local && Date.now() - local.seenAt <= 75_000) return true;
    return Boolean(await this.presenceRedis.exists(`telephony:agent-presence:${userId}`));
  }

  private async writeAgentPresence(userId: string, phone: string | null) {
    await this.presenceRedis.set(
      `telephony:agent-presence:${userId}`,
      JSON.stringify({ phone, seenAt: new Date().toISOString() }),
      'EX',
      75
    );
  }

  private async emitPopupToAgentPhone(agentPhone: string | null, eventId: string) {
    if (!agentPhone) return;
    await this.popupPublisher.publish('telephony:popup-events', JSON.stringify({ agentPhone, eventId }));
  }

  private async emitPopupClosedToAgentPhone(agentPhone: string | null, eventId: string) {
    if (!agentPhone) return;
    await this.popupPublisher.publish('telephony:popup-events', JSON.stringify({ agentPhone, eventId, eventType: 'closed' }));
  }

  private async markPopupDelivered(eventId: string, userId: string) {
    await this.prisma.telephonyAgentPopupEvent.update({
      where: { id: eventId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        agentUserId: userId,
        deliveryCount: { increment: 1 }
      }
    }).catch(() => undefined);
  }

  private async setupPopupPubSub() {
    await this.popupSubscriber.subscribe('telephony:popup-events');
    this.popupSubscriber.on('message', (_channel, payload) => {
      void this.handlePopupPubSubMessage(payload).catch(() => undefined);
    });
  }

  private async handlePopupPubSubMessage(payload: string) {
    const message = safeJson(payload);
    const agentPhone = normalizeTenDigitPhone(message.agentPhone);
    const eventId = typeof message.eventId === 'string' ? message.eventId : '';
    if (!agentPhone || !eventId) return;
    const entry = TelephonyService.popupSubjects.get(agentPhone);
    if (!entry) return;
    if (message.eventType === 'closed') {
      entry.subject.next({ type: 'telephony-popup-closed', data: { id: eventId } });
      return;
    }
    const popup = await this.popupEventById(eventId);
    if (!popup) return;
    const agentUser = await this.findUserByPhone(agentPhone);
    const updated = await this.prisma.telephonyAgentPopupEvent.update({
      where: { id: eventId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        agentPhone,
        agentUserId: agentUser?.id,
        deliveryCount: { increment: entry.subscribers }
      }
    }).catch(() => undefined);
    entry.subject.next({ type: 'telephony-popup', data: updated ? await this.popupEventById(eventId) : popup });
  }

  private async popupEventById(eventId: string) {
    const event = await this.prisma.telephonyAgentPopupEvent.findUnique({ where: { id: eventId } });
    if (!event) return null;

    const lead = event.leadId
      ? await this.prisma.lead.findUnique({
          where: { id: event.leadId },
          select: popupLeadSelect
        })
      : null;

    return toSerializable({
      ...this.formatPopupEvent(event),
      lead: lead ? { ...lead, customerLocation: lead.location } : null
    });
  }

  private formatPopupEvent(event: { id: string; callSessionId: string | null; status: string; createdAt: Date; rawPayload: Prisma.JsonValue; deliveredAt?: Date | null; seenAt?: Date | null; closedAt?: Date | null; deliveryCount?: number | null }) {
    return {
      id: event.id,
      callSessionId: event.callSessionId,
      status: event.status,
      createdAt: event.createdAt,
      deliveredAt: event.deliveredAt,
      seenAt: event.seenAt,
      closedAt: event.closedAt,
      deliveryCount: event.deliveryCount ?? 0,
      payload: event.rawPayload
    };
  }
}

function normalizeClickToCallUrl(url: string) {
  return url.replace(/\/Restmcube-api\/outbound-call(?=([?#]|$))/i, '/Restmcube-api/outbound-calls');
}

function existingConfigValue(config: unknown, key: string) {
  return isPlainObject(config) && typeof config[key] === 'string' ? String(config[key]) : undefined;
}
