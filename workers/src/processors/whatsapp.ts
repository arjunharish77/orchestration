import { Job } from 'bullmq';
import { activityTypeCodes, prisma, systemActor } from '../context';
import { appendQuery, isPlainObject, maskSensitive, normalizeTenDigitPhone, readPath, resolveSecretRefs, resolveVariables, toJson, validatePublicHttpsUrl } from '../utils';

export async function processWhatsAppSend(job: Job<{ messageId?: string; leadId?: string; content?: string; templateId?: string; actor?: string; providerMessageId?: string }>) {
  const actor = job.data.actor ?? systemActor;
  let message = job.data.messageId ? await prisma.whatsAppMessage.findUnique({ where: { id: job.data.messageId } }) : null;
  if (!message) {
    const conversation = await prisma.whatsAppConversation.create({
      data: {
        leadId: job.data.leadId,
        lastMessageAt: new Date()
      }
    });
    message = await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        leadId: job.data.leadId,
        direction: 'outbound',
        messageType: job.data.templateId ? 'template' : 'text',
        content: job.data.content,
        status: 'queued',
        rawPayload: toJson({ templateId: job.data.templateId }),
        sentBy: actor
      }
    });
  }
  const providerResult = await sendWhatsAppToProvider(message, job.data);
  const providerMessageId = job.data.providerMessageId ?? message.providerMessageId ?? providerResult.providerMessageId;
  const providerConfigured = Boolean(providerMessageId) || providerResult.ok;
  const updated = await prisma.whatsAppMessage.update({
    where: { id: message.id },
    data: {
      status: providerResult.status,
      providerMessageId: providerMessageId ?? null
    }
  });
  await prisma.connectorEvent.create({
    data: {
      eventType: 'whatsapp_send_worker',
      rawPayload: toJson(job.data),
      normalizedPayload: toJson({
        messageId: updated.id,
        leadId: updated.leadId,
        status: updated.status,
        reason: providerResult.reason,
        httpStatus: providerResult.httpStatus
      }),
      status: providerResult.ok ? 'success' : updated.status,
      error: providerResult.ok ? null : providerResult.error?.slice(0, 500)
    }
  });
  if (updated.leadId) {
    await prisma.activity.create({
      data: {
        leadId: updated.leadId,
        type: activityTypeCodes.whatsapp,
        title: providerConfigured
          ? (updated.messageType === 'template' ? 'WhatsApp template sent' : updated.messageType === 'media' ? 'WhatsApp media sent' : 'WhatsApp message sent')
          : providerResult.status === 'failed' ? 'WhatsApp send failed' : 'WhatsApp send not configured',
        notes: updated.content,
        metadata: toJson({ messageId: updated.id, providerMessageId: updated.providerMessageId, status: updated.status }),
        createdBy: actor
      }
    });
  }
  return {
    ok: providerResult.ok,
    messageId: updated.id,
    status: updated.status,
    reason: providerResult.reason,
    error: providerResult.error
  };
}

export async function processWhatsAppWebhook(job: Job<{ payload: Record<string, unknown> }>) {
  const payload = job.data.payload ?? {};
  const phone = normalizeTenDigitPhone(String(
    payload.Phone ?? payload.phone ?? payload.Mobile ?? payload.mobile ??
    payload.SourceNumber ?? payload.sourceNumber ?? payload.CustomerNumber ?? payload.customerNumber ?? ''
  ));
  const lead = phone ? await prisma.lead.findFirst({ where: { mobile: phone } }) : null;
  const direction = String(payload.Direction ?? payload.direction ?? 'inbound').toLowerCase();
  const status = String(
    payload.Status ?? payload.status ?? payload.MessageStatus ?? payload.messageStatus ??
    (direction === 'inbound' ? 'received' : 'sent')
  );
  const content = String(payload.Text ?? payload.text ?? payload.Message ?? payload.message ?? payload.Body ?? payload.body ?? '');
  const conversation = await ensureConversation(lead?.id, direction === 'inbound');
  const message = await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      leadId: lead?.id,
      direction,
      messageType: String(payload.MessageType ?? payload.messageType ?? 'text'),
      content: content || null,
      status,
      providerMessageId: String(
        payload.MessageId ?? payload.messageId ?? payload.ProviderMessageId ?? payload.providerMessageId ?? ''
      ) || null,
      rawPayload: toJson(payload)
    }
  });
  await prisma.connectorEvent.create({
    data: {
      eventType: direction === 'inbound' ? 'whatsapp_inbound_worker' : 'whatsapp_status_worker',
      rawPayload: toJson(payload),
      normalizedPayload: toJson({ leadId: lead?.id, messageId: message.id, phone, status }),
      status
    }
  });
  if (lead?.id) {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: activityTypeCodes.whatsapp,
        title: direction === 'inbound' ? 'WhatsApp reply received' : 'WhatsApp status updated',
        notes: content || status,
        metadata: toJson({ messageId: message.id }),
        createdBy: systemActor
      }
    });
  }
  return { ok: true, messageId: message.id, leadId: lead?.id };
}

async function sendWhatsAppToProvider(message: { id: string; leadId: string | null; messageType: string; content: string | null; rawPayload: unknown; providerMessageId: string | null }, jobData: { templateId?: string; providerMessageId?: string }) {
  if (jobData.providerMessageId || message.providerMessageId) {
    return { ok: true, status: 'sent', providerMessageId: jobData.providerMessageId ?? message.providerMessageId ?? undefined };
  }
  const rawPayload = isPlainObject(message.rawPayload) ? message.rawPayload : {};
  const templateId = String(jobData.templateId ?? rawPayload.templateId ?? '');
  const preferredNumberId = String(rawPayload.whatsAppNumberId ?? '');
  const [lead, template, defaultNumber, preferredNumber] = await Promise.all([
    message.leadId ? prisma.lead.findUnique({ where: { id: message.leadId } }) : Promise.resolve(null),
    templateId ? prisma.whatsAppTemplate.findUnique({ where: { id: templateId } }) : Promise.resolve(null),
    prisma.whatsAppNumber.findFirst({ where: { isActive: true, isDefault: true }, orderBy: { createdAt: 'desc' } }),
    preferredNumberId ? prisma.whatsAppNumber.findUnique({ where: { id: preferredNumberId } }) : Promise.resolve(null)
  ]);
  const selectedNumber = preferredNumber?.isActive ? preferredNumber : defaultNumber;
  const connectorId = selectedNumber?.connectorId ?? template?.connectorId ?? defaultNumber?.connectorId ?? undefined;
  const connector = connectorId
    ? await prisma.whatsAppConnector.findUnique({ where: { id: connectorId } })
    : await prisma.whatsAppConnector.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  const config = isPlainObject(connector?.config) ? connector.config : {};
  const phoneNumberId = String(resolveSecretRefs(config.phoneNumberId ?? config.metaPhoneNumberId ?? '') ?? '');
  const graphVersion = String(config.graphVersion ?? config.apiVersion ?? 'v23.0').replace(/^\/+/, '');
  const rawUrl = String(config.outboundUrl ?? config.sendUrl ?? config.url ?? config.endpoint ?? (phoneNumberId ? `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages` : ''));
  if (!connector?.isActive || !rawUrl) {
    return { ok: false, status: 'not_configured', reason: 'provider_execution_not_configured' };
  }
  const countryCode = String(config.defaultCountryCode ?? config.countryCode ?? '91').replace(/\D/g, '');
  const leadMobile = normalizeTenDigitPhone(lead?.mobile) ?? String(lead?.mobile ?? '').replace(/\D/g, '');
  const whatsappTo = leadMobile.length === 10 && countryCode ? `${countryCode}${leadMobile}` : leadMobile;

  const variables = {
    'lead.id': lead?.id,
    'lead.mobile': lead?.mobile,
    'lead.whatsappTo': whatsappTo,
    'lead.customerName': lead?.customerName,
    'lead.status': lead?.status,
    'message.id': message.id,
    'message.type': message.messageType,
    'message.content': message.content ?? '',
    'message.mediaUrl': rawPayload.mediaUrl ?? '',
    'message.mediaMimeType': rawPayload.mediaMimeType ?? '',
    'message.mediaFileName': rawPayload.mediaFileName ?? '',
    'template.id': template?.id ?? '',
    'template.name': template?.name ?? '',
    'template.language': template?.language ?? ''
  };
  const url = String(resolveVariables(String(resolveSecretRefs(rawUrl)), variables));
  const urlValidation = validatePublicHttpsUrl(url);
  if (urlValidation) return { ok: false, status: 'failed', reason: 'provider_url_invalid', error: urlValidation };

  const method = String(config.method ?? config.httpMethod ?? 'POST').toUpperCase();
  const requestType = String(config.requestType ?? 'JSON').toUpperCase();
  const headers = resolveVariables(resolveSecretRefs(config.headers ?? config.customHeaders ?? {}), variables) as Record<string, string>;
  const accessToken = String(resolveSecretRefs(config.accessToken ?? config.token ?? config.bearerToken ?? '') ?? '');
  if (accessToken && !headers.Authorization && !headers.authorization) headers.Authorization = `Bearer ${accessToken}`;
  const queryParams = resolveVariables(resolveSecretRefs(config.queryParams ?? {}), variables);
  const bodyTemplate = config.bodyTemplate ?? config.dataTemplate ?? defaultWhatsAppBodyTemplate({
    messageType: message.messageType,
    content: message.content,
    previewUrl: rawPayload.previewUrl,
    mediaUrl: String(rawPayload.mediaUrl ?? ''),
    mediaFileName: String(rawPayload.mediaFileName ?? ''),
    template,
    templateComponents: rawPayload.components ?? rawPayload.templateComponents
  });
  const body = resolveVariables(resolveSecretRefs(bodyTemplate), variables);
  const requestUrl = method === 'GET' ? appendQuery(url, { ...(isPlainObject(queryParams) ? queryParams : {}), ...(isPlainObject(body) ? body : {}) }) : appendQuery(url, queryParams);
  const startedAt = Date.now();

  try {
    const response = await fetch(requestUrl, {
      method,
      headers: {
        ...headers,
        ...(method === 'POST' && requestType === 'FORM_URLENCODED' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(method === 'POST' && requestType !== 'FORM_URLENCODED' ? { 'Content-Type': 'application/json' } : {})
      },
      body: method === 'POST' ? formatProviderBody(body, requestType) : undefined
    });
    const responseText = await response.text();
    const parsed = parseJson(responseText);
    const responseKeyword = String(config.responseKeyword ?? '').trim().toLowerCase();
    const keywordMatched = !responseKeyword || responseText.toLowerCase().includes(responseKeyword);
    const ok = response.ok && keywordMatched;
    const providerMessageId = String(
      readPath(parsed, String(config.providerMessageIdPath ?? config.messageIdPath ?? '')) ??
      readPath(parsed, 'messages.0.id') ??
      readPath(parsed, 'messageId') ??
      readPath(parsed, 'id') ??
      readPath(parsed, 'data.messageId') ??
      ''
    ) || undefined;
    await prisma.connectorEvent.create({
      data: {
        connectorId: connector.id,
        eventType: 'whatsapp_provider_send',
        rawPayload: toJson(maskSensitive({ url: requestUrl, method, headers, body })),
        normalizedPayload: toJson({ httpStatus: response.status, ok, keywordMatched, providerMessageId, durationMs: Date.now() - startedAt }),
        status: ok ? 'success' : 'failed',
        error: ok ? null : responseText.slice(0, 500)
      }
    });
    return {
      ok,
      status: ok ? 'sent' : 'failed',
      providerMessageId,
      httpStatus: response.status,
      error: ok ? undefined : responseText.slice(0, 500),
      reason: ok ? undefined : 'provider_send_failed'
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'WhatsApp provider request failed';
    return { ok: false, status: 'failed', reason: 'provider_send_failed', error: messageText };
  }
}

async function ensureConversation(leadId?: string | null, inbound = false) {
  const existing = leadId ? await prisma.whatsAppConversation.findFirst({ where: { leadId }, orderBy: { updatedAt: 'desc' } }) : null;
  const data = {
    lastMessageAt: new Date(),
    updatedAt: new Date(),
    ...(inbound ? { serviceWindowUntil: new Date(Date.now() + 24 * 60 * 60_000) } : {})
  };
  if (existing) return prisma.whatsAppConversation.update({ where: { id: existing.id }, data });
  return prisma.whatsAppConversation.create({ data: { leadId, ...data } });
}

function defaultWhatsAppBodyTemplate(input: { messageType: string; content?: string | null; previewUrl?: unknown; mediaUrl?: string; mediaFileName?: string; template?: { name: string; language: string | null; mediaConfig: unknown } | null; templateComponents?: unknown }) {
  const to = '{{lead.whatsappTo}}';
  if (input.messageType === 'template' && input.template) {
    const mediaConfig = isPlainObject(input.template.mediaConfig) ? input.template.mediaConfig : {};
    const components = input.templateComponents ?? mediaConfig.components;
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: input.template.name,
        language: { code: input.template.language || 'en_US' },
        ...(Array.isArray(components) ? { components } : {})
      }
    };
  }
  if (input.messageType === 'media' || input.mediaUrl) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: {
        link: input.mediaUrl || '{{message.mediaUrl}}',
        filename: input.mediaFileName || undefined,
        caption: input.content || undefined
      }
    };
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: input.previewUrl === true,
      body: input.content || '{{message.content}}'
    }
  };
}

function formatProviderBody(body: unknown, requestType: string) {
  if (requestType === 'FORM_URLENCODED' && isPlainObject(body)) return new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value ?? '')])).toString();
  return JSON.stringify(body ?? {});
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
