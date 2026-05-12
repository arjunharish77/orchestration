export function requiredEnv(name: string, fallback: string) {
  const value = process.env[name];
  assertProductionValue(name, value);
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return fallback;
}

export function requiredConfigValue(name: string, value: string | undefined, fallback: string) {
  assertProductionValue(name, value);
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return fallback;
}

export function assertProductionValue(name: string, value: string | undefined) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!value) return;
  const normalized = value.trim().toLowerCase();
  const unsafeMarkers = ['change_me', 'replace_with', 'development-secret', 'use_a_', 'your-production', 'your_', 'localhost'];
  if (unsafeMarkers.some((marker) => normalized.includes(marker))) {
    throw new Error(`${name} must be set to a production-safe value`);
  }
}
