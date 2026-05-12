export type WorkerLogLevel = 'info' | 'warn' | 'error' | 'debug';

const sensitiveKeys = ['authorization', 'cookie', 'password', 'token', 'secret', 'api_key', 'apikey', 'key'];

export function logWorker(level: WorkerLogLevel, event: string, context: Record<string, unknown> = {}) {
  if (level === 'debug' && process.env.LOG_LEVEL !== 'debug') return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'unnatify-workers',
    event,
    ...(redact(context) as Record<string, unknown>)
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export function redact(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: redactText(value.message), stack: value.stack ? redactText(value.stack) : undefined };
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? redactText(value) : value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) return [key, '[redacted]'];
      return [key, redact(item)];
    })
  );
}

export function redactText(text: string) {
  return text
    .replace(/\b\d{10}\b/g, (phone) => `******${phone.slice(-4)}`)
    .replace(/re_[A-Za-z0-9_]+/g, 're_[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}
