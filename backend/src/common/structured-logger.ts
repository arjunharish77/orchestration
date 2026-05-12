import { LoggerService } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getRequestContext } from './request-context';

type LogLevel = 'debug' | 'log' | 'warn' | 'error';
type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url: string;
  ip?: string;
};
type ResponseLike = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  on: (event: 'finish', callback: () => void) => void;
};
type NextLike = () => void;

const sensitiveKeys = ['authorization', 'cookie', 'password', 'token', 'secret', 'api_key', 'apikey', 'key'];
const requestDurations: number[] = [];
const statusCounts: Record<string, number> = {};
const maxRequestSamples = 1_000;

export class StructuredLogger implements LoggerService {
  constructor(private readonly service = 'unnatify-api') {}

  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    if (process.env.LOG_LEVEL === 'debug') this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.debug(message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      service: this.service,
      context,
      message: typeof message === 'string' ? message : redact(message),
      trace: trace ? redactText(trace) : undefined
    };

    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}

export function requestLoggingMiddleware(logger: StructuredLogger) {
  return (request: RequestLike, response: ResponseLike, next: NextLike) => {
    const startedAt = Date.now();
    const requestId = getRequestContext()?.requestId ?? String(request.headers['x-request-id'] ?? randomUUID());
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      recordHttpMetric(response.statusCode, durationMs);
      logger.log(
        {
          event: 'http_request',
          requestId,
          method: request.method,
          path: redactUrl(request.originalUrl ?? request.url),
          statusCode: response.statusCode,
          durationMs,
          ip: request.ip,
          userAgent: redactText(String(request.headers['user-agent'] ?? ''))
        },
        'HTTP'
      );
    });

    next();
  };
}

export function getHttpMetricsSnapshot() {
  const sorted = [...requestDurations].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    sampleSize: count,
    avgLatencyMs: count ? Math.round(sum / count) : 0,
    p95LatencyMs: percentile(sorted, 0.95),
    maxLatencyMs: count ? sorted[count - 1] : 0,
    statusCounts
  };
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? redactText(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) return [key, '[redacted]'];
      return [key, redact(item)];
    })
  );
}

function redactUrl(url: string) {
  try {
    const parsed = new URL(url, 'http://local');
    for (const [key, value] of parsed.searchParams.entries()) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        parsed.searchParams.set(key, '[redacted]');
      } else {
        parsed.searchParams.set(key, redactText(value));
      }
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return redactText(url);
  }
}

function redactText(text: string) {
  return text
    .replace(/\b\d{10}\b/g, (phone) => `******${phone.slice(-4)}`)
    .replace(/re_[A-Za-z0-9_]+/g, 're_[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}

function recordHttpMetric(statusCode: number, durationMs: number) {
  requestDurations.push(durationMs);
  if (requestDurations.length > maxRequestSamples) requestDurations.shift();
  const bucket = `${Math.floor(statusCode / 100)}xx`;
  statusCounts[bucket] = (statusCounts[bucket] ?? 0) + 1;
}

function percentile(sortedValues: number[], fraction: number) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * fraction) - 1);
  return sortedValues[index];
}
