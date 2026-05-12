import * as Sentry from '@sentry/node';

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1')
  });
}

import { Job, Queue, Worker } from 'bullmq';
import { assignmentRunner, connection, prisma } from './context';
import { logWorker, redact } from './logger';
import { processAutomationRun } from './processors/automation';
import { processConnectorRetry } from './processors/connector';
import { pollScheduledReports } from './processors/report-schedule';
import { processLeadUpload } from './processors/lead-upload';
import { processOfferExpiry } from './processors/offers';
import { processTelephonyWebhook } from './processors/telephony';
import { processVoicebotTrigger, processVoicebotWebhook } from './processors/voicebot';
import { processWhatsAppSend, processWhatsAppWebhook } from './processors/whatsapp';

type KnownJob =
  | 'queue-smoke'
  | 'lead-upload.process'
  | 'whatsapp.send'
  | 'whatsapp.webhook'
  | 'voicebot.trigger'
  | 'voicebot.webhook'
  | 'telephony.webhook'
  | 'automation.run-step'
  | 'automation.delayed'
  | 'offer-expiry.check'
  | 'assignment.run'
  | 'connector.retry';

const queueNames = [
  'lead-upload',
  'whatsapp-send',
  'whatsapp-webhook',
  'voicebot-trigger',
  'voicebot-webhook',
  'telephony-webhook',
  'automation',
  'automation-delayed',
  'offer-expiry',
  'assignment',
  'connector-retry'
];

const deadLetterQueue = new Queue('dead-letter', { connection });
const offerExpiryQueue = new Queue('offer-expiry', { connection });
const automationDelayedQueue = new Queue('automation-delayed', { connection });

async function processJob(job: Job) {
  const name = job.name as KnownJob;

  switch (name) {
    case 'queue-smoke':
      return { ok: true, echo: job.data };
    case 'lead-upload.process':
      return processLeadUpload(job as Job<{ batchId: string; actor?: string; columnMapping?: Record<string, string> }>);
    case 'whatsapp.send':
      return processWhatsAppSend(job as Job<{ messageId?: string; leadId?: string; content?: string; templateId?: string; actor?: string; providerMessageId?: string }>);
    case 'whatsapp.webhook':
      return processWhatsAppWebhook(job as Job<{ payload: Record<string, unknown> }>);
    case 'voicebot.trigger':
      return processVoicebotTrigger(job as Job<{ templateId: string; leadId?: string; variables?: Record<string, unknown>; dryRun?: boolean; actor?: string }>);
    case 'voicebot.webhook':
      return processVoicebotWebhook(job as Job<{ connectorId: string; payload: Record<string, unknown> }>);
    case 'telephony.webhook':
      return processTelephonyWebhook(job as Job<{ payload: Record<string, unknown>; eventType?: string }>);
    case 'offer-expiry.check':
      return processOfferExpiry(job as Job<{ limit?: number; actor?: string }>);
    case 'assignment.run':
      return assignmentRunner.processAssignmentRun(job as Job<{ leadId: string; ruleId?: string; actor?: string; activityId?: string; context?: Record<string, unknown>; mode?: string }>);
    case 'connector.retry':
      return processConnectorRetry(job as Job<{ eventId?: string; failedEventId?: string; actor?: string }>);
    case 'automation.run-step':
    case 'automation.delayed':
      return processAutomationRun(job as Job<{ runId?: string; workflowId: string; versionId?: string; input?: { leadId?: string; context?: Record<string, unknown>; useDraft?: boolean; runLabel?: string }; actor?: string }>);
    default:
      logWorker('warn', 'unknown_job', { job: jobInfo(job), data: job.data });
      return { ok: true, ignored: true };
  }
}

const workers = queueNames.map((queueName) => new Worker(queueName, processJob, {
  connection,
  concurrency: queueConcurrency(queueName)
}));

async function writeHeartbeat(queueName: string) {
  await connection.set(
    `health:workers:${queueName}`,
    JSON.stringify({ service: 'unnatify-workers', queueName, timestamp: new Date().toISOString() }),
    'EX',
    120
  );
}

async function registerScheduledJobs() {
  await offerExpiryQueue.add('offer-expiry.check', {}, {
    repeat: { pattern: '0 2 * * *' },
    removeOnComplete: { count: 7 },
    removeOnFail: { count: 7 }
  });
}

async function pollAutomationDelayedJobs() {
  const dueJobs = await prisma.automationScheduledJob.findMany({
    where: { status: 'scheduled', runAt: { lte: new Date() } },
    take: 50,
    orderBy: { runAt: 'asc' }
  });
  for (const scheduledJob of dueJobs) {
    if (!scheduledJob.runId) continue;
    const run = await prisma.automationRun.findUnique({
      where: { id: scheduledJob.runId },
      select: { workflowId: true, leadId: true, status: true }
    });
    if (!run || run.status !== 'waiting') continue;
    const bullJob = await automationDelayedQueue.add('automation.delayed', {
      runId: scheduledJob.runId,
      workflowId: run.workflowId,
      resumeFromNodeId: scheduledJob.nodeId ?? undefined,
      input: { leadId: run.leadId ?? undefined }
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 100
    });
    await prisma.automationScheduledJob.update({
      where: { id: scheduledJob.id },
      data: { status: 'processing', queueJobId: bullJob.id ?? null }
    });
  }
}

void registerScheduledJobs().catch((error) => {
  logWorker('error', 'register_scheduled_jobs_failed', { error });
});

const delayedJobTimer = setInterval(() => {
  void pollAutomationDelayedJobs().catch((error) => {
    logWorker('error', 'poll_automation_delayed_failed', { error });
  });
}, 30_000);

const reportScheduleTimer = setInterval(() => {
  void pollScheduledReports().catch((error) => {
    logWorker('error', 'poll_scheduled_reports_failed', { error });
  });
}, 60_000);

const heartbeatTimer = setInterval(() => {
  void Promise.all([
    ...queueNames.map(writeHeartbeat),
    monitorDeadLetterQueue()
  ]).catch((error) => {
    logWorker('error', 'heartbeat_failed', { error });
  });
}, 30_000);

async function monitorDeadLetterQueue() {
  const counts = await deadLetterQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
  const total = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
  await connection.set('health:workers:dead-letter', JSON.stringify({
    service: 'unnatify-workers',
    queueName: 'dead-letter',
    depth: total,
    counts,
    timestamp: new Date().toISOString()
  }), 'EX', 120);
  if (total > 0) {
    logWorker('warn', 'dead_letter_queue_not_empty', { depth: total, counts });
  }
}

void Promise.all([...queueNames.map(writeHeartbeat), monitorDeadLetterQueue()]);

for (const worker of workers) {
  worker.on('completed', (job) => {
    logWorker('info', 'job_completed', { job: jobInfo(job) });
  });

  worker.on('failed', (job, error) => {
    logWorker('error', 'job_failed', { job: job ? jobInfo(job) : null, error: redact(error) as Record<string, unknown> });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) Sentry.captureException(error, { extra: { job: jobInfo(job) } });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void deadLetterQueue.add('dead-letter.capture', {
	        queueName: job.queueName,
	        jobName: job.name,
	        jobId: job.id,
	        data: redact(job.data),
	        error: redact(error.message),
	        failedAt: new Date().toISOString()
	      });
    }
  });
}

logWorker('info', 'workers_started', { queues: queueNames });

async function shutdown() {
  clearInterval(heartbeatTimer);
  clearInterval(delayedJobTimer);
  clearInterval(reportScheduleTimer);
  logWorker('info', 'shutdown_initiated', { workerCount: workers.length });
  await Promise.race([
    Promise.all(workers.map((worker) => worker.close())),
    new Promise((resolve) => setTimeout(resolve, 30_000))
  ]);
  await Promise.all([deadLetterQueue.close(), offerExpiryQueue.close(), automationDelayedQueue.close()]);
  await prisma.$disconnect();
  await connection.quit();
  logWorker('info', 'shutdown_complete', {});
}

function queueConcurrency(queueName: string) {
  const envKey = `${queueName.toUpperCase().replace(/-/g, '_')}_CONCURRENCY`;
  return Number(process.env[envKey] ?? (queueName.includes('automation') ? 5 : 2));
}

function jobInfo(job: Job) {
  return {
    queueName: job.queueName,
    name: job.name,
    id: job.id,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    requestId: jobRequestId(job)
  };
}

function jobRequestId(job: Job) {
  const data = job.data as Record<string, unknown> | undefined;
  const value = data?.requestId ?? data?.correlationId;
  return typeof value === 'string' ? value : undefined;
}

process.on('SIGTERM', () => { shutdown().finally(() => process.exit(0)); });
process.on('SIGINT', () => { shutdown().finally(() => process.exit(0)); });
