import { Job } from 'bullmq';
import { prisma } from '../context';
import { toJson } from '../utils';

export async function processConnectorRetry(job: Job<{ eventId?: string; failedEventId?: string; actor?: string }>) {
  const eventId = job.data.eventId ?? job.data.failedEventId;
  const failedEvent = eventId ? await prisma.connectorEvent.findUnique({ where: { id: eventId } }) : null;
  if (!failedEvent) throw new Error(`Connector event not found: ${eventId ?? 'missing'}`);
  const retry = await prisma.connectorEvent.create({
    data: {
      connectorId: failedEvent.connectorId,
      eventType: `${failedEvent.eventType}_retry`,
      rawPayload: toJson(failedEvent.rawPayload),
      normalizedPayload: toJson({ retryOf: failedEvent.id, previousStatus: failedEvent.status }),
      status: 'queued'
    }
  });
  return { ok: true, retryEventId: retry.id };
}
