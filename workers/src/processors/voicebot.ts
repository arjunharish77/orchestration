import { Job } from 'bullmq';
import { activityTypeCodes, prisma, systemActor } from '../context';
import { appendQuery, isPlainObject, maskSensitive, normalizeTenDigitPhone, readPath, resolveSecretRefs, resolveVariables, toJson, validatePublicHttpsUrl } from '../utils';

export async function processVoicebotTrigger(job: Job<{ templateId: string; leadId?: string; variables?: Record<string, unknown>; dryRun?: boolean; actor?: string }>) {
  const template = await prisma.voicebotTriggerTemplate.findUnique({ where: { id: job.data.templateId } });
  if (!template) throw new Error(`Voicebot trigger template not found: ${job.data.templateId}`);
  const connector = await prisma.voicebotConnector.findUnique({ where: { id: template.connectorId } });
  const connectorConfig = isPlainObject(connector?.config) ? connector.config : {};
  const variables = job.data.variables ?? {};
  const request = {
    method: template.method,
    url: resolveVariables(template.url, variables),
    headers: resolveVariables(resolveSecretRefs(template.headers ?? {}), variables),
    queryParams: resolveVariables(resolveSecretRefs(template.queryParams ?? {}), variables),
    body: resolveVariables(resolveSecretRefs(template.bodyTemplate ?? {}), variables)
  };
  const providerConfigured = job.data.dryRun === false && Boolean(connector?.isActive) && connectorConfig.executionEnabled !== false && Boolean(template.url);
  const execution = providerConfigured ? await executeVoicebotProvider(template, request) : null;
  const callStatus = job.data.dryRun === false
    ? (execution ? execution.callStatus : 'not_configured')
    : 'dry_run';
  const call = await prisma.voicebotCall.create({
    data: {
      leadId: job.data.leadId,
      providerCallId: execution?.providerCallId ?? null,
      callStatus,
      rawPayload: toJson({ templateId: template.id, request: maskSensitive(request), response: execution?.response })
    }
  });
  const event = await prisma.connectorEvent.create({
    data: {
      connectorId: template.connectorId,
      eventType: 'voicebot_trigger_worker',
      rawPayload: toJson(job.data),
      normalizedPayload: toJson({ callId: call.id, request: maskSensitive(request), response: execution?.response }),
      status: execution?.ok ? 'success' : call.callStatus ?? 'not_configured',
      error: execution?.ok === false ? execution.error?.slice(0, 500) : null
    }
  });
  if (job.data.leadId) {
    await prisma.activity.create({
      data: {
        leadId: job.data.leadId,
        type: activityTypeCodes.voicebot,
        title: callStatus === 'queued' ? 'Voicebot trigger queued' : callStatus === 'dry_run' ? 'Voicebot trigger dry run' : callStatus === 'failed' ? 'Voicebot trigger failed' : 'Voicebot trigger not configured',
        metadata: toJson({ callId: call.id, eventId: event.id, templateId: template.id }),
        createdBy: job.data.actor ?? systemActor
      }
    });
  }
  return {
    ok: execution?.ok ?? callStatus === 'queued',
    callId: call.id,
    eventId: event.id,
    status: callStatus,
    dryRun: job.data.dryRun !== false,
    reason: callStatus === 'not_configured' ? 'provider_execution_not_configured' : execution?.reason,
    error: execution?.error
  };
}

export async function processVoicebotWebhook(job: Job<{ connectorId: string; payload: Record<string, unknown> }>) {
  const payload = job.data.payload ?? {};
  const phone = normalizeTenDigitPhone(String(
    payload.phone ?? payload.Phone ?? payload.mobile ?? payload.Mobile ?? payload.customerPhone ?? ''
  ));
  const lead = phone ? await prisma.lead.findFirst({ where: { mobile: phone } }) : null;
  const call = await prisma.voicebotCall.create({
    data: {
      leadId: lead?.id,
      providerCallId: String(payload.callId ?? payload.CallId ?? payload.sessionId ?? payload.SessionId ?? '') || null,
      callStatus: String(payload.status ?? payload.Status ?? 'received'),
      recordingUrl: String(payload.recordingUrl ?? payload.RecordingUrl ?? '') || null,
      transcript: String(payload.transcript ?? payload.Transcript ?? '') || null,
      summary: String(payload.summary ?? payload.Summary ?? '') || null,
      intent: String(payload.intent ?? payload.Intent ?? '') || null,
      disposition: String(payload.disposition ?? payload.Disposition ?? '') || null,
      duration: Number(payload.duration ?? payload.Duration ?? 0) || null,
      rawPayload: toJson(payload)
    }
  });
  await prisma.connectorEvent.create({
    data: {
      connectorId: job.data.connectorId,
      eventType: 'voicebot_webhook_worker',
      rawPayload: toJson(payload),
      normalizedPayload: toJson({ callId: call.id, leadId: lead?.id, phone }),
      status: call.callStatus ?? 'received'
    }
  });
  if (lead?.id) {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: activityTypeCodes.voicebot,
        title: 'Voicebot result received',
        disposition: call.disposition,
        notes: call.summary ?? call.transcript ?? call.intent,
        metadata: toJson({ callId: call.id }),
        createdBy: systemActor
      }
    });
  }
  return { ok: true, callId: call.id, leadId: lead?.id };
}

async function executeVoicebotProvider(template: { method: string; responseConfig: unknown }, request: { method: string; url: unknown; headers: unknown; queryParams: unknown; body: unknown }) {
  const url = String(request.url ?? '');
  const urlValidation = validatePublicHttpsUrl(url);
  if (urlValidation) return { ok: false, callStatus: 'failed', reason: 'provider_url_invalid', error: urlValidation, providerCallId: null, response: null };

  const method = String(request.method ?? 'POST').toUpperCase();
  const headers = isPlainObject(request.headers) ? Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, String(value)])) : {};
  const queryParams = isPlainObject(request.queryParams) ? request.queryParams : {};
  const responseConfig = isPlainObject(template.responseConfig) ? template.responseConfig : {};

  try {
    const response = await fetch(appendQuery(url, queryParams), {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(request.body ?? {})
    });
    const responseText = await response.text();
    const parsed = parseJson(responseText);
    const responseKeyword = String(responseConfig.responseKeyword ?? '').trim().toLowerCase();
    const keywordMatched = !responseKeyword || responseText.toLowerCase().includes(responseKeyword);
    const ok = response.ok && keywordMatched;
    const providerCallId = String(
      readPath(parsed, String(responseConfig.providerCallIdPath ?? responseConfig.callIdPath ?? '')) ??
      readPath(parsed, 'callId') ??
      readPath(parsed, 'id') ??
      readPath(parsed, 'data.callId') ??
      ''
    ) || null;
    return {
      ok,
      callStatus: ok ? 'queued' : 'failed',
      providerCallId,
      response: { httpStatus: response.status, body: responseText.slice(0, 5000) },
      reason: ok ? undefined : 'provider_trigger_failed',
      error: ok ? undefined : responseText.slice(0, 500)
    };
  } catch (error) {
    return {
      ok: false,
      callStatus: 'failed',
      providerCallId: null,
      response: null,
      reason: 'provider_trigger_failed',
      error: error instanceof Error ? error.message : 'Voicebot provider request failed'
    };
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
