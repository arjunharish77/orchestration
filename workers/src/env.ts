const unsafeMarkers = ['change_me', 'replace_with', 'development-secret', 'use_a_', 'your-production', 'your_', 'localhost'];

export function requiredEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) {
    if (process.env.NODE_ENV === 'production') {
      const normalized = value.trim().toLowerCase();
      if (unsafeMarkers.some((marker) => normalized.includes(marker))) {
        throw new Error(`${name} must be set to a production-safe value`);
      }
    }
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return fallback;
}
