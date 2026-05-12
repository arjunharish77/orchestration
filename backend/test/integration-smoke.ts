import './load-smoke-env';

const apiUrl = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000';
const email = process.env.TEST_ADMIN_EMAIL ?? process.env.SMOKE_ADMIN_EMAIL ?? 'admin@unnatify.local';
const password = process.env.TEST_ADMIN_PASSWORD ?? process.env.SMOKE_ADMIN_PASSWORD ?? 'ChangeMe123!';
const fallbackPasswords = Array.from(new Set([password, 'Password@123', 'ChangeMe123!']));

async function main() {
  const loginPayload = await loginWithFallback();
  if (!loginPayload.accessToken) throw new Error('login did not return accessToken');

  const headers = { Authorization: `Bearer ${loginPayload.accessToken}` };
  await expectOk('/health');
  await expectOk('/health/db');
  await expectOk('/leads', headers);
  await expectOk('/leads/summary', headers);
  await expectOk('/automation/overview', headers);
  await expectOk('/reports/overview', headers);
  await expectOk('/settings/lead-lists', headers);

  console.log('[integration-smoke] passed');
}

async function loginWithFallback() {
  let lastError: unknown;
  for (const candidate of fallbackPasswords) {
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: candidate })
      });
      assertOk(response, 'login');
      return await response.json() as { accessToken?: string };
    } catch (error) {
      lastError = error;
    }
  }
  if (process.env.CI !== 'true') {
    console.warn('[integration-smoke] skipped: local admin credentials did not match. Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to force a local run.');
    process.exit(0);
  }
  throw lastError instanceof Error ? lastError : new Error('login failed');
}

async function expectOk(path: string, headers?: HeadersInit) {
  const response = await fetch(`${apiUrl}${path}`, { headers });
  assertOk(response, path);
}

function assertOk(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
}

main().catch((error) => {
  console.error('[integration-smoke] failed', error);
  process.exit(1);
});

export {};
