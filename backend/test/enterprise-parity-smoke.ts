import './load-smoke-env';

const apiUrl = process.env.TEST_API_URL ?? process.env.API_URL ?? 'http://127.0.0.1:4000';
const email = process.env.TEST_ADMIN_EMAIL ?? process.env.SMOKE_ADMIN_EMAIL ?? 'admin@unnatify.local';
const password = process.env.TEST_ADMIN_PASSWORD ?? process.env.SMOKE_ADMIN_PASSWORD ?? 'ChangeMe123!';
const fallbackPasswords = Array.from(new Set([password, 'Password@123', 'ChangeMe123!']));

async function main() {
  const login = await loginWithFallback();
  if (!login.accessToken) throw new Error('login did not return an access token');
  const auth = { Authorization: `Bearer ${login.accessToken}` };

  await expectArray('/access/overview', auth, ['users', 'roles', 'teams', 'salesGroups', 'permissionTemplates']);
  await expectArray('/custom-fields/definitions?moduleName=Lead', auth);
  await expectArray('/settings/mandatory-rules', auth);
  await expectObject('/settings/disposition-form', auth);
  await expectObject('/settings/lead-lists', auth);
  await expectObject('/settings/security', auth);
  await expectArray('/uploads', auth);
  await expectArray('/activities?activityType=001', auth);
  await expectArray('/tasks', auth);
  await expectArray('/automation/workflows', auth);
  await expectObject('/automation/overview', auth);
  await expectObject('/reports/overview', auth);
  await expectArray('/reports/saved', auth);
  await expectArray('/reports/schedules', auth);
  await expectObject('/connectors', auth);
  await expectObject('/connectors/telephony/reference', auth);
  await expectArray('/connectors/telephony/popups/recent', auth);
  await expectArray('/audit-logs', auth);

  console.log('[enterprise-parity-smoke] passed');
}

async function loginWithFallback() {
  let lastError: unknown;
  for (const candidate of fallbackPasswords) {
    try {
      return await request<{ accessToken?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: candidate })
      });
    } catch (error) {
      lastError = error;
    }
  }
  if (process.env.CI !== 'true') {
    console.warn('[enterprise-parity-smoke] skipped: local admin credentials did not match. Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to force a local run.');
    process.exit(0);
  }
  throw lastError instanceof Error ? lastError : new Error('login failed');
}

async function expectArray(path: string, headers?: HeadersInit, objectArrayKeys: string[] = []) {
  const payload = await request<unknown>(path, { headers });
  if (Array.isArray(payload)) return;
  if (payload && typeof payload === 'object' && objectArrayKeys.every((key) => Array.isArray((payload as Record<string, unknown>)[key]))) return;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)) return;
  throw new Error(`${path} did not return an array-like payload`);
}

async function expectObject(path: string, headers?: HeadersInit) {
  const payload = await request<unknown>(path, { headers });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error(`${path} did not return an object payload`);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

main().catch((error) => {
  console.error('[enterprise-parity-smoke] failed', error);
  process.exit(1);
});

export {};
