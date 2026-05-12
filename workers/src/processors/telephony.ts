import { Job } from 'bullmq';
import { activityTypeCodes, prisma, systemActor } from '../context';
import { normalizeTenDigitPhone, toJson } from '../utils';

export async function processTelephonyWebhook(job: Job<{ payload: Record<string, unknown>; eventType?: string }>) {
  const payload = job.data.payload ?? {};
  const direction = String(payload.Direction ?? payload.direction ?? '').toLowerCase();
  const leadPhone = normalizeTenDigitPhone(String(direction === 'outbound'
    ? payload.DestinationNumber ?? payload.destinationNumber ?? payload.CustomerNumber ?? payload.customerNumber ?? ''
    : payload.SourceNumber ?? payload.sourceNumber ?? payload.CallerId ?? payload.caller_id ?? ''));
  const agentPhone = normalizeTenDigitPhone(String(direction === 'outbound'
    ? payload.SourceNumber ?? payload.sourceNumber ?? ''
    : payload.DestinationNumber ?? payload.destinationNumber ?? ''));
  const [lead, agent] = await Promise.all([
    leadPhone ? prisma.lead.findFirst({ where: { mobile: leadPhone } }) : null,
    agentPhone ? prisma.user.findFirst({ where: { phone: agentPhone } }) : null
  ]);
  const call = await prisma.telephonyCall.create({
    data: {
      leadId: lead?.id,
      phoneNumber: leadPhone,
      agentUserId: agent?.id,
      callDirection: direction || null,
      callStatus: String(payload.Status ?? payload.status ?? '') || null,
      callDuration: Number(payload.CallDuration ?? payload.callDuration ?? 0) || null,
      recordingUrl: String(payload.ResourceURL ?? payload.resourceUrl ?? payload.recordingUrl ?? '') || null,
      providerCallId: String(payload.CallSessionId ?? payload.callSessionId ?? '') || null,
      disposition: String(payload.Disposition ?? payload.disposition ?? '') || null,
      rawPayload: toJson(payload)
    }
  });
  await prisma.connectorEvent.create({
    data: {
      eventType: job.data.eventType ?? 'telephony_webhook_worker',
      rawPayload: toJson(payload),
      normalizedPayload: toJson({ callId: call.id, leadId: lead?.id, agentUserId: agent?.id, leadPhone, agentPhone }),
      status: call.callStatus ?? 'received'
    }
  });
  if (lead?.id) {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: activityTypeCodes.call,
        title: 'Telephony call logged',
        disposition: call.disposition,
        notes: String(payload.Status ?? ''),
        metadata: toJson({ callId: call.id }),
        createdBy: agent?.id ?? systemActor
      }
    });
  }
  return { ok: true, callId: call.id, leadId: lead?.id, agentUserId: agent?.id };
}
