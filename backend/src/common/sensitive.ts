const sensitiveKeyParts = [
  'password',
  'token',
  'secret',
  'authorization',
  'api_key',
  'apikey',
  'accesskey',
  'auth',
  'credential'
];

export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (isSensitiveKey(key)) return [key, '[masked]'];
      return [key, maskSensitive(entry)];
    })
  );
}

export function secureConnectorConfig(value: unknown): unknown {
  return secureConnectorConfigWithExisting(value);
}

export function secureConnectorConfigWithExisting(value: unknown, existing?: unknown): unknown {
  if (Array.isArray(value)) return value.map(secureConnectorConfig);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const existingEntry = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)[key]
        : undefined;
      if (!isSensitiveKey(key)) return [key, secureConnectorConfigWithExisting(entry, existingEntry)];
      if (entry === '' || entry === null || entry === undefined || entry === '[masked]') {
        return [key, existingEntry ?? { masked: true, value: '' }];
      }
      if (typeof entry === 'string' && entry.startsWith('env:')) {
        return [key, { secretRef: entry.slice(4), masked: true }];
      }
      if (entry && typeof entry === 'object' && 'secretRef' in entry) {
        return [key, { ...(entry as Record<string, unknown>), masked: true }];
      }
      return [key, { masked: true, value: entry }];
    })
  );
}

export function publicConnectorConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicConnectorConfig);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (isSensitiveKey(key)) return [key, secretHasValue(entry) ? '[masked]' : ''];
      return [key, publicConnectorConfig(entry)];
    })
  );
}

export function readConnectorSecret(value: unknown): string {
  if (typeof value === 'string') return value === '[masked]' ? '' : value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.secretRef === 'string') return process.env[record.secretRef] ?? '';
    if ('value' in record) return String(record.value ?? '');
  }
  return '';
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sensitiveKeyParts.some((part) => normalized.includes(part));
}

function secretHasValue(value: unknown) {
  if (typeof value === 'string') return Boolean(value && value !== '[masked]');
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return Boolean(record.secretRef || record.value);
  }
  return false;
}
