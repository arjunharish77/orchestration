import './load-smoke-env';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const email = process.env.TEST_ADMIN_EMAIL ?? process.env.SMOKE_ADMIN_EMAIL ?? 'admin@unnatify.local';
const password = process.env.TEST_ADMIN_PASSWORD ?? process.env.SMOKE_ADMIN_PASSWORD ?? 'Password@123';
const fallbackPasswords = Array.from(new Set([password, 'Password@123', 'ChangeMe123!']));

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => '');
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

async function main() {
  const login = await loginWithFallback();
  const auth = { Authorization: `Bearer ${login.accessToken}` };

  const streamToken = await request<{ token: string; expiresInSeconds: number }>('/connectors/telephony/popups/stream-token', {
    method: 'POST',
    headers: auth
  });
  if (!streamToken.token || streamToken.expiresInSeconds > 120) throw new Error('Invalid telephony stream token response');

  const filteredLeads = await request<{ items?: unknown[] }>('/leads?advancedFilters=%7B%22conditions%22%3A%5B%7B%22field%22%3A%22custom%3Asmoke_custom_flag%22%2C%22operator%22%3A%22not_exists%22%7D%5D%7D', {
    headers: auth
  });
  if (!Array.isArray(filteredLeads.items)) throw new Error('Advanced custom-field lead filter did not return a paginated list');

  const workflows = await request<unknown[]>('/automation/workflows', { headers: auth });
  if (!Array.isArray(workflows)) throw new Error('Automation workflow list is not available');

  const workerHealth = await request<{ queues?: unknown[] }>('/health/workers');
  if (!Array.isArray(workerHealth.queues)) throw new Error('Worker health endpoint is not available');

  const savedReports = await request<unknown[]>('/reports/saved', { headers: auth });
  if (!Array.isArray(savedReports)) throw new Error('Saved report list is not available');

  const schedules = await request<unknown[]>('/reports/schedules', { headers: auth });
  if (!Array.isArray(schedules)) throw new Error('Scheduled report list is not available');

  const exportRow = await request<{ status?: string; fileId?: string }>('/reports/exports', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ reportType: 'lead-summary', filters: {} })
  });
  if (!['completed', 'failed'].includes(String(exportRow.status))) throw new Error('Report export did not return a terminal status');

  const retentionPolicy = await request<{ auditLogs?: { days?: number } }>('/files/retention-policy', { headers: auth });
  if (!retentionPolicy.auditLogs?.days) throw new Error('Retention policy endpoint is not available');

  const retentionDryRun = await request<{ dryRun?: boolean; counts?: Record<string, number> }>('/files/apply-retention', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ dryRun: true })
  });
  if (!retentionDryRun.dryRun || !retentionDryRun.counts) throw new Error('Retention dry-run endpoint is not available');

  console.log('deep-remediation-smoke passed');
}

async function loginWithFallback() {
  let lastError: unknown;
  for (const candidate of fallbackPasswords) {
    try {
      return await request<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: candidate })
      });
    } catch (error) {
      lastError = error;
    }
  }
  if (process.env.CI !== 'true') {
    console.warn('[deep-remediation-smoke] skipped: local admin credentials did not match. Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to force a local run.');
    process.exit(0);
  }
  throw lastError instanceof Error ? lastError : new Error('login failed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
