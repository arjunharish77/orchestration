import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { statfs } from 'fs/promises';
import Redis from 'ioredis';
import { dirname, resolve } from 'path';
import { requiredConfigValue } from '../common/env';
import { getHttpMetricsSnapshot } from '../common/structured-logger';
import { PrismaService } from '../prisma/prisma.service';

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

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'unnatify-api',
      timestamp: new Date().toISOString()
    };
  }

  @Get('db')
  async getDbHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      dependency: 'postgres',
      timestamp: new Date().toISOString()
    };
  }

  @Get('redis')
  async getRedisHealth() {
    const redis = new Redis(this.redisUrl(), {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      return {
        status: pong === 'PONG' ? 'ok' : 'degraded',
        dependency: 'redis',
        timestamp: new Date().toISOString()
      };
    } finally {
      redis.disconnect();
    }
  }

  @Get('workers')
  async getWorkerHealth() {
    const redis = new Redis(this.redisUrl(), {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
    try {
      await redis.connect();
      const heartbeatValues = await Promise.all(queueNames.map((queueName) => redis.get(`health:workers:${queueName}`)));
      const heartbeats = Object.fromEntries(queueNames.map((queueName, index) => [queueName, parseHeartbeat(heartbeatValues[index])]));
      const isHealthy = Object.values(heartbeats).every((heartbeat) => heartbeat.status === 'ok');
      const queues = queueNames.map((queueName) => ({
        queue: queueName,
        ...(heartbeats[queueName] ?? { status: 'missing' })
      }));

      return {
        status: isHealthy ? 'ok' : 'degraded',
        dependency: 'workers',
        queues,
        heartbeats,
        timestamp: new Date().toISOString()
      };
    } finally {
      redis.disconnect();
    }
  }

  @Get('metrics')
  async getMetrics() {
    if (this.config.get<string>('NODE_ENV') === 'production' && this.config.get<string>('HEALTH_METRICS_PUBLIC') !== 'true') {
      throw new NotFoundException('Metrics endpoint is disabled');
    }

    const redisUrl = this.redisUrl();
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
    const queues = queueNames.map((queueName) => new Queue(queueName, { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) }));

    try {
      const now = new Date();
      const since = new Date(now.getTime() - 60 * 60 * 1000);
      const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const httpMetrics = getHttpMetricsSnapshot();
      const [dbLatencyMs, redisLatencyMs] = await Promise.all([
        measure(async () => this.prisma.$queryRaw`SELECT 1`),
        measure(async () => {
          await redis.connect();
          await redis.ping();
        })
      ]);

      const [queueCounts, heartbeatValues, uploads, automation, connectors, telephony, disk] = await Promise.all([
        Promise.all(queues.map(async (queue) => ({ queue: queue.name, counts: await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused') }))),
        Promise.all(queueNames.map((queueName) => redis.get(`health:workers:${queueName}`))),
        this.uploadMetrics(dayStart),
        this.automationMetrics(dayStart),
        this.connectorMetrics(dayStart),
        this.telephonyMetrics(dayStart),
        diskMetrics(this.config.get<string>('UPLOAD_DIR') ?? resolve(process.cwd(), '..', 'uploads'))
      ]);

      const heartbeats = Object.fromEntries(queueNames.map((queueName, index) => [queueName, parseHeartbeat(heartbeatValues[index])]));
      const alerts = buildAlerts({
        http: httpMetrics,
        dbLatencyMs,
        redisLatencyMs,
        queueCounts,
        heartbeats,
        uploads,
        automation,
        connectors,
        telephony,
        disk
      });

      return {
        status: alerts.some((alert) => alert.severity === 'critical') ? 'critical' : alerts.length ? 'degraded' : 'ok',
        generatedAt: now.toISOString(),
        window: {
          since: dayStart.toISOString(),
          recentSince: since.toISOString()
        },
        api: {
          uptimeSeconds: Math.round(process.uptime()),
          http: httpMetrics,
          dbLatencyMs,
          redisLatencyMs
        },
        queues: queueCounts,
        workers: heartbeats,
        uploads,
        automation,
        connectors,
        telephony,
        disk,
        alerts
      };
    } finally {
      await Promise.allSettled(queues.map((queue) => queue.close()));
      redis.disconnect();
    }
  }

  private async uploadMetrics(since: Date) {
    const [processing, failed, completedWithErrors, recent] = await Promise.all([
      this.prisma.leadUploadBatch.count({ where: { status: { in: ['queued', 'processing'] } } }),
      this.prisma.leadUploadBatch.count({ where: { status: { in: ['failed', 'error'] }, updatedAt: { gte: since } } }),
      this.prisma.leadUploadBatch.count({ where: { status: 'completed_with_errors', updatedAt: { gte: since } } }),
      this.prisma.leadUploadBatch.count({ where: { createdAt: { gte: since } } })
    ]);
    return { recent, processing, failed, completedWithErrors };
  }

  private async automationMetrics(since: Date) {
    const [running, failedRuns, failedSteps, pendingSteps] = await Promise.all([
      this.prisma.automationRun.count({ where: { status: { in: ['running', 'queued'] } } }),
      this.prisma.automationRun.count({ where: { status: 'failed', startedAt: { gte: since } } }),
      this.prisma.automationRunStep.count({ where: { status: 'failed', startedAt: { gte: since } } }),
      this.prisma.automationRunStep.count({ where: { status: 'pending' } })
    ]);
    return { running, failedRuns, failedSteps, pendingSteps };
  }

  private async connectorMetrics(since: Date) {
    const [failed, pending, recent] = await Promise.all([
      this.prisma.connectorEvent.count({ where: { status: { in: ['failed', 'error'] }, createdAt: { gte: since } } }),
      this.prisma.connectorEvent.count({ where: { status: { in: ['queued', 'processing', 'retrying'] } } }),
      this.prisma.connectorEvent.count({ where: { createdAt: { gte: since } } })
    ]);
    return { recent, pending, failed };
  }

  private async telephonyMetrics(since: Date) {
    const [calls, failedCalls, popups, unresolvedPopups] = await Promise.all([
      this.prisma.telephonyCall.count({ where: { createdAt: { gte: since } } }),
      this.prisma.telephonyCall.count({ where: { createdAt: { gte: since }, callStatus: { in: ['Failed', 'failed', 'error'] } } }),
      this.prisma.telephonyAgentPopupEvent.count({ where: { createdAt: { gte: since } } }),
      this.prisma.telephonyAgentPopupEvent.count({ where: { status: { in: ['received', 'pending'] } } })
    ]);
    return { calls, failedCalls, popups, unresolvedPopups };
  }

  private redisUrl() {
    return requiredConfigValue('REDIS_URL', this.config.get<string>('REDIS_URL'), 'redis://localhost:6379');
  }
}

function parseHeartbeat(value: string | null) {
  if (!value) return { status: 'missing' };
  try {
    const parsed = JSON.parse(value) as { timestamp?: string };
    const timestamp = parsed.timestamp ?? '';
    const ageMs = Date.now() - new Date(timestamp).getTime();
    return {
      ...parsed,
      ageMs,
      status: Number.isFinite(ageMs) && ageMs < 90_000 ? 'ok' : 'stale'
    };
  } catch {
    return { status: 'invalid' };
  }
}

async function measure(task: () => Promise<unknown>) {
  const startedAt = Date.now();
  await task();
  return Date.now() - startedAt;
}

async function diskMetrics(path: string) {
  try {
    const stats = await statfs(path).catch(() => statfs(dirname(path)));
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10 : null;
    return { path, totalBytes, freeBytes, usedPercent };
  } catch (error) {
    return { path, status: 'unknown', error: error instanceof Error ? error.message : 'Could not read disk metrics' };
  }
}

function buildAlerts(metrics: {
  dbLatencyMs: number;
  redisLatencyMs: number;
  http: { p95LatencyMs: number; statusCounts: Record<string, number> };
  queueCounts: Array<{ queue: string; counts: Record<string, number> }>;
  heartbeats: Record<string, { status?: string; ageMs?: number }>;
  uploads: { processing: number; failed: number; completedWithErrors: number };
  automation: { running: number; failedRuns: number; failedSteps: number; pendingSteps: number };
  connectors: { pending: number; failed: number };
  telephony: { failedCalls: number; unresolvedPopups: number };
  disk: { usedPercent?: number | null; status?: string };
}) {
  const alerts: Array<{ severity: 'warning' | 'critical'; area: string; message: string }> = [];
  if (metrics.http.p95LatencyMs > 2_000) alerts.push({ severity: 'warning', area: 'api', message: `API p95 latency is ${metrics.http.p95LatencyMs}ms` });
  if ((metrics.http.statusCounts['5xx'] ?? 0) > 0) alerts.push({ severity: 'warning', area: 'api', message: `API recorded ${metrics.http.statusCounts['5xx']} recent 5xx responses` });
  if (metrics.dbLatencyMs > 1_000) alerts.push({ severity: 'critical', area: 'postgres', message: `Database latency is ${metrics.dbLatencyMs}ms` });
  if (metrics.redisLatencyMs > 1_000) alerts.push({ severity: 'critical', area: 'redis', message: `Redis latency is ${metrics.redisLatencyMs}ms` });
  for (const [queue, heartbeat] of Object.entries(metrics.heartbeats)) {
    if (heartbeat.status !== 'ok') alerts.push({ severity: heartbeat.status === 'missing' ? 'critical' : 'warning', area: 'workers', message: `${queue} worker heartbeat is ${heartbeat.status ?? 'unknown'}` });
  }
  for (const item of metrics.queueCounts) {
    if ((item.counts.failed ?? 0) > 0) alerts.push({ severity: 'warning', area: 'queues', message: `${item.queue} has ${item.counts.failed} failed jobs` });
    if (((item.counts.waiting ?? 0) + (item.counts.delayed ?? 0)) > 1_000) alerts.push({ severity: 'critical', area: 'queues', message: `${item.queue} backlog is above 1000 jobs` });
  }
  if (metrics.uploads.failed > 0 || metrics.uploads.completedWithErrors > 0) alerts.push({ severity: 'warning', area: 'uploads', message: 'Recent uploads have failures or row errors' });
  if (metrics.automation.failedRuns > 0 || metrics.automation.failedSteps > 0) alerts.push({ severity: 'warning', area: 'automation', message: 'Recent automation runs or steps failed' });
  if (metrics.connectors.failed > 0) alerts.push({ severity: 'warning', area: 'connectors', message: 'Recent connector events failed' });
  if (metrics.telephony.failedCalls > 0) alerts.push({ severity: 'warning', area: 'telephony', message: 'Recent telephony calls failed' });
  if (typeof metrics.disk.usedPercent === 'number' && metrics.disk.usedPercent > 85) alerts.push({ severity: metrics.disk.usedPercent > 95 ? 'critical' : 'warning', area: 'disk', message: `Disk usage is ${metrics.disk.usedPercent}%` });
  return alerts;
}
