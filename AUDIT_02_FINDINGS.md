# AUDIT_02_FINDINGS — Deep Review

_Generated from static code analysis. Every claim cites file path and line number._

---

## A. Correctness / Bugs

### A-1 `reportType` conditional is always `'lead-summary'` — dead else branch

**File:** `backend/src/reports/reports.service.ts:205` and `:393`

```ts
const reportType = input.reportType === 'lead-summary' ? 'lead-summary' : 'lead-summary';
```

Both branches of the ternary return the identical string. Any other `reportType` value is silently coerced to `'lead-summary'`. The `ScheduledReport` model stores a `reportType` field and the frontend lets users pick types, but the export always generates a lead-summary CSV regardless.

**Impact:** Scheduled/exported reports of any type other than `lead-summary` silently produce lead-summary data.

---

### A-2 `partnerMapping` CSV column parsed but never written to the Lead

**Files:** `workers/src/processors/lead-upload.ts:55,211`, `backend/src/uploads/uploads.service.ts:62,382,404`

The `partnerMapping` field is read from the uploaded CSV column `partner_mapping`, added to the normalized row type, and included in the validation dictionary, but the `prisma.lead.create` call at `lead-upload.ts:136-166` and `uploads.service.ts:202-222` does NOT include it. The `Lead` schema (`prisma/schema.prisma:207-231`) has no `partnerMapping` field. Data is silently discarded on every upload.

**Impact:** Any CSV upload including `partner_mapping` data silently loses it. The UploadsView mapping UI (which surfaces this column) misleads the user.

---

### A-3 `GET /connectors/telephony/config` does not exist — config panel loads nothing

**Files:** `frontend/src/features/crm/views/connectors/TelephonyConnectorPanel.tsx:436`, `backend/src/telephony/telephony.controller.ts`

The TelephonyConnectorPanel fetches `GET /connectors/telephony/config` on mount to display current settings. The backend `TelephonyConnectorController` at `telephony.controller.ts:60-176` only exposes:

- `GET reference` → `:60`
- `POST config` → `:67` (save only)
- `POST preview-variables` → `:74`
- `GET popups/recent` → `:81`
- etc.

There is no `GET config` endpoint. The panel's load call returns 404, the form is always blank on open, and agents cannot see their saved telephony configuration.

**Impact:** Telephony connector configuration panel is read-broken. Users must re-enter all settings every time they open the panel.

---

### A-4 `offer-expiry.check` jobs are never enqueued — expiry processor is dead

**Files:** `workers/src/processors/offers.ts`, `workers/src/index.ts:61`

The `processOfferExpiry` processor is registered and handles `offer-expiry.check` jobs. However, there is no code anywhere in the backend that enqueues this job. No `@Cron()`, no `setInterval`, no `Queue.add()` call targeting `offer-expiry`. The processor is wired in the worker but unreachable.

**Impact:** Lead status is never automatically transitioned to `Expired` when `offerExpiryDate` passes. This is a core CRM feature (loan offer expiry) that is completely non-functional.

---

### A-5 Automation delay nodes create `AutomationScheduledJob` records that are never resumed

**Files:** `workers/src/processors/automation.ts:110-112`, `backend/src/automation/automation.service.ts:552-556`

When a delay node executes, the processor creates an `AutomationScheduledJob` row with `runAt` in the future and returns `status: 'pending'`. The automation run is paused. However, no worker, cron, or polling loop exists to query `AutomationScheduledJob WHERE status='scheduled' AND runAt <= NOW()` and re-enqueue the run. The `automation-delayed` queue exists but is only populated if something calls `Queue.add()` — nothing does.

**Impact:** Any automation workflow containing a delay node will permanently stall after the delay step. The run status shows `waiting` indefinitely.

---

### A-6 Calendar view in TasksView is not a calendar — renders the Board view

**File:** `frontend/src/features/crm/views/TasksView.tsx`

The "Calendar" tab in TasksView renders the same kanban-style board columns as the Board tab. There is no calendar grid, no date-picker navigation, no date-grouped layout. The tab label is misleading.

**Impact:** Users expecting a calendar to plan/review tasks by date get the board view instead.

---

### A-7 Owner and Lead filter pills in ActivitiesView are permanently inert

**File:** `frontend/src/features/crm/views/ActivitiesView.tsx:575-576`

```tsx
<FilterPill label="Owner" value="Anyone" muted />
<FilterPill label="Lead" value="Any" muted />
```

Both pills have no `onClick` handler and the `muted` prop prevents interaction. `GET /activities` only accepts a `type` query parameter (`activities.controller.ts:20`). The backend has no owner/lead filter path for this endpoint.

**Impact:** Two filter controls are permanently non-functional, misleading users into thinking filtering is possible.

---

### A-8 `getRefreshToken()` always returns `null` — logout never revokes refresh token

**File:** `frontend/src/lib/auth.ts:23-25`

```ts
export function getRefreshToken() {
  return null;
}
```

`logoutSession` calls `getRefreshToken()` and always receives `null`, so the `POST /auth/logout` call never includes a refresh token. The `AuthSession` record in the DB is revoked by the backend on logout, but if the access token is expired and the session already revoked, a race condition could leave orphaned sessions or fail to clean up cookies properly.

**Impact:** Low severity. Auth sessions are still invalidated via `AuthSession.revokedAt`, but the frontend cannot explicitly revoke the refresh token. No functional harm if cookies are `httpOnly` and cleared server-side.

---

### A-9 JWTs without `sid` bypass session database validation

**File:** `backend/src/auth/auth.guard.ts:31-38`

```ts
if (payload.sid) {
  // session lookup
}
```

If `payload.sid` is absent, the guard accepts the token on signature alone. Tokens issued by `OpsController` (`ops.controller.ts:43`) have `{ ops: true, email }` with no `sub` or `sid`. These cannot authenticate user API calls anyway, but the guard's `if (payload.sid)` guard means any future code path that generates user-like JWTs without a `sid` will bypass session revocation.

**Impact:** Moderate. No current exploit path, but fragile contract. If a JWT is somehow issued without `sid`, it can't be revoked server-side.

---

### A-10 `permissionCache` is a module-level variable — stale after permission changes

**File:** `frontend/src/features/crm/CrmApp.tsx:89`

```ts
let permissionCache: PermissionCacheEntry | null = null;
```

This variable lives at module scope outside the React component. It is keyed by `token + userId` (`CrmApp.tsx:138`), so it refreshes on re-login. However, if an admin changes a user's permissions mid-session, the change is not reflected until the user logs out and back in.

**Impact:** Permission changes by admins take effect only on next login. Security downgrade (adding restrictions) is not enforced immediately.

---

### A-11 `DELETE /tasks/:id` does not exist anywhere

**File:** `backend/src/tasks/tasks.controller.ts`

The tasks controller has `GET`, `POST`, `PATCH`, and `POST :id/comments` but no `DELETE` route. There is also no `deleteTask` method in the tasks service. The frontend `TasksView.tsx` has no delete action either (confirmed by grep). Task deletion is consistently absent from both frontend and backend.

**Impact:** Users cannot delete tasks. Potentially intentional (soft-delete pattern), but there is no alternative (no status=deleted, no archive). Tasks accumulate permanently.

---

### A-12 `GET /leads/summary` exists in backend but is never called

**File:** `backend/src/leads/leads.controller.ts:27-30`

The endpoint `GET /leads/summary` is defined and guarded with `JwtAuthGuard` + Activity permission check. No frontend view or component calls it. This is likely a planned widget that was not connected.

**Impact:** Dead code. No functional impact.

---

### A-13 `automationVariables()` runs 4 DB queries per workflow node (N+1)

**File:** `workers/src/processors/automation.ts:199-231`

`automationVariables(leadId)` calls `prisma.lead.findUnique`, `prisma.user.findUnique`, `prisma.leadCustomFieldValue.findMany`, and `prisma.userCustomFieldValue.findMany`. This function is called once per executing node that needs lead/user context (condition nodes, WhatsApp nodes, voicebot nodes, lead_update nodes). A 10-step workflow touching lead variables triggers 40 DB queries per run.

**Impact:** Performance and DB load scale linearly with workflow length. With hundreds of concurrent automation runs, this becomes significant.

---

## B. Frontend ↔ Backend Wiring

Legend: ✅ wired · ❌ broken/missing · ⚠️ partial

| Frontend Call | Backend Endpoint | Status | Notes |
|---|---|---|---|
| `GET /leads` | `leads.controller.ts:17` | ✅ | |
| `POST /leads` | `leads.controller.ts:35` | ✅ | |
| `PATCH /leads/:id` | `leads.controller.ts:82` | ✅ | |
| `POST /leads/:id/assign` | `leads.controller.ts:100` | ✅ | |
| `POST /leads/bulk-assign` | `leads.controller.ts:68` | ✅ | |
| `POST /leads/bulk-update` | `leads.controller.ts:75` | ✅ | |
| `POST /leads/:id/disposition` | `leads.controller.ts:92` | ✅ | |
| `GET /leads/saved-views` | `leads.controller.ts:41` | ✅ | |
| `POST /leads/saved-views` | `leads.controller.ts:48` | ✅ | |
| `PUT /leads/saved-views/:id` | `leads.controller.ts:55` | ✅ | |
| `DELETE /leads/saved-views/:id` | `leads.controller.ts:62` | ✅ | |
| `GET /leads/export.csv` | `leads.controller.ts:22` | ✅ | |
| `GET /leads/summary` | `leads.controller.ts:27` | ⚠️ | Backend exists; never called from frontend |
| `GET /activities` | `activities.controller.ts:18` | ✅ | No pagination params accepted or sent |
| `POST /activities` | `activities.controller.ts:25` | ✅ | |
| `PATCH /activities/:id` | `activities.controller.ts:35` | ✅ | |
| `DELETE /activities/:id` | `activities.controller.ts:43` | ✅ | |
| `GET /tasks` | `tasks.controller.ts:18` | ✅ | |
| `POST /tasks` | `tasks.controller.ts:46` | ✅ | |
| `PATCH /tasks/:id` | `tasks.controller.ts:53` | ✅ | |
| `DELETE /tasks/:id` | — | ❌ | No backend endpoint; no frontend call either |
| `POST /tasks/:id/comments` | `tasks.controller.ts:58` | ⚠️ | Backend exists; frontend calls from `LeadDetailView` task panel |
| `GET /dashboard/overview` | `dashboard.controller.ts:17` | ✅ | |
| `GET /reports/overview` | `reports.controller.ts:18` | ✅ | |
| `GET /reports/drilldown` | `reports.controller.ts:116` | ✅ | |
| `GET /reports/exports` | `reports.controller.ts:53` | ✅ | |
| `POST /reports/exports` | `reports.controller.ts:47` | ✅ | |
| `GET /reports/saved` | `reports.controller.ts:59` | ⚠️ | Backend exists; not called from `ReportsView` |
| `POST /reports/saved` | `reports.controller.ts:66` | ⚠️ | Backend exists; not called from `ReportsView` |
| `GET /reports/schedules` | `reports.controller.ts:87` | ⚠️ | Backend exists; not called from `ReportsView` |
| `POST /reports/schedules` | `reports.controller.ts:94` | ⚠️ | Backend exists; not called from `ReportsView` |
| `GET /audit-logs` | `audit.controller.ts:18` | ✅ | |
| `GET /uploads` | `uploads.controller.ts:21` | ✅ | |
| `POST /uploads/csv` | `uploads.controller.ts:27` | ✅ | |
| `GET /uploads/:id` | `uploads.controller.ts:53` | ✅ | |
| `GET /uploads/:id/result-csv` | `uploads.controller.ts:35` | ⚠️ | Backend exists; no download button in `UploadsView` |
| `GET /settings/lead-lists` | `settings.controller.ts` | ✅ | |
| `GET /settings/task-lists` | `settings.controller.ts` | ✅ | |
| `GET /settings/activity-types` | `settings.controller.ts` | ✅ | |
| `GET /settings/disposition-form` | `settings.controller.ts` | ✅ | |
| `GET /settings/csv-upload-config` | `settings.controller.ts:281` | ✅ | |
| `PUT /settings/csv-upload-config` | `settings.controller.ts:288` | ⚠️ | Backend exists; no UI in `SettingsView` to configure this |
| `GET /custom-fields/definitions` | `custom-fields.controller.ts:18` | ✅ | |
| `POST /custom-fields/definitions` | `custom-fields.controller.ts:25` | ✅ | |
| `PATCH /custom-fields/definitions/:m/:id` | `custom-fields.controller.ts:32` | ✅ | |
| `GET /access/overview` | `access.controller.ts` | ✅ | |
| `GET /automation/overview` | `automation.controller.ts:18` | ✅ | |
| `GET /automation/workflows` | `automation.controller.ts:25` | ✅ | |
| `POST /automation/workflows` | `automation.controller.ts:33` | ✅ | |
| `GET /automation/workflows/:id` | `automation.controller.ts:40` | ✅ | |
| `PATCH /automation/workflows/:id` | `automation.controller.ts:47` | ✅ | |
| `POST /automation/workflows/:id/definition` | `automation.controller.ts:54` | ✅ | |
| `POST /automation/workflows/:id/run` | `automation.controller.ts:96` | ✅ | |
| `POST /automation/workflows/:id/enqueue` | `automation.controller.ts:104` | ✅ | |
| `GET /automation/runs/:id` | `automation.controller.ts:109` | ✅ | |
| `POST /automation/runs/:id/retry-failed` | `automation.controller.ts:117` | ✅ | |
| `GET /assignment-engine/rules` | `assignment.controller.ts:46` | ✅ | |
| `POST /assignment-engine/rules` | `assignment.controller.ts:53` | ✅ | |
| `PATCH /assignment-engine/rules/:id` | `assignment.controller.ts:60` | ✅ | |
| `DELETE /assignment-engine/rules/:id` | `assignment.controller.ts:67` | ✅ | |
| `POST /assignment-engine/run` | `assignment.controller.ts:18` | ✅ | |
| `POST /assignment-engine/preview` | `assignment.controller.ts:25` | ✅ | |
| `GET /assignment-engine/metadata` | `assignment.controller.ts:33` | ✅ | |
| `GET /connectors` | `connectors.controller.ts:43` | ✅ | |
| `POST /connectors/api` | `connectors.controller.ts:50` | ✅ | |
| `PATCH /connectors/api/:id` | `connectors.controller.ts:57` | ✅ | |
| `DELETE /connectors/api/:id` | `connectors.controller.ts:64` | ✅ | |
| `POST /connectors/whatsapp/connectors` | `connectors.controller.ts:78` | ✅ | |
| `POST /connectors/whatsapp/messages` | `connectors.controller.ts:141` | ✅ | |
| `POST /connectors/telephony/click-to-call` | `telephony.controller.ts:135` | ✅ | |
| `GET /connectors/telephony/config` | — | ❌ | **Only `POST config` exists** — panel cannot load saved settings (see A-3) |
| `GET /connectors/telephony/reference` | `telephony.controller.ts:60` | ✅ | |
| `POST /connectors/telephony/preview-variables` | `telephony.controller.ts:74` | ✅ | |
| `GET /connectors/telephony/popups/recent` | `telephony.controller.ts:81` | ✅ | |
| `POST /connectors/telephony/popups/stream-token` | `telephony.controller.ts:102` | ✅ | |
| `Sse /connectors/telephony/popups/stream` | `telephony.controller.ts:95` | ✅ | |
| `GET /files/:id/download` | `files.controller.ts:51` | ✅ | |
| `GET /health/workers` | `health.controller.ts:70` | ✅ | |

**Summary:** 2 broken endpoints, ~6 backend-only endpoints that have no frontend UI.

---

## C. Worker Queue Wiring

| Queue Name | Job Name | Worker Handler | Enqueue Origin | Status |
|---|---|---|---|---|
| `lead-upload` | `lead-upload.process` | `processLeadUpload` | `uploads.service.ts` | ✅ |
| `whatsapp-send` | `whatsapp.send` | `processWhatsAppSend` | `connectors.service.ts` | ✅ |
| `whatsapp-webhook` | `whatsapp.webhook` | `processWhatsAppWebhook` | `connectors.controller.ts` webhook | ✅ |
| `voicebot-trigger` | `voicebot.trigger` | `processVoicebotTrigger` | `connectors.service.ts` | ✅ |
| `voicebot-webhook` | `voicebot.webhook` | `processVoicebotWebhook` | `connectors.controller.ts` webhook | ✅ |
| `telephony-webhook` | `telephony.webhook` | `processTelephonyWebhook` | `telephony.service.ts` | ✅ |
| `automation` | `automation.run-step` | `processAutomationRun` | `automation.service.ts` | ✅ |
| `automation-delayed` | `automation.delayed` | `processAutomationRun` | **Never enqueued** | ❌ |
| `offer-expiry` | `offer-expiry.check` | `processOfferExpiry` | **Never enqueued** | ❌ |
| `assignment` | `assignment.run` | `processAssignmentRun` | `assignment.service.ts` | ✅ |
| `connector-retry` | `connector.retry` | `processConnectorRetry` | `connectors.service.ts` | ✅ |

**Two queues have no enqueue source:**
- `offer-expiry` — processed by `offers.ts` but nothing triggers `offer-expiry.check` jobs. No `@Cron()`, no backend scheduler, no manual trigger. Lead status expiry is broken.
- `automation-delayed` — created for delayed node resumption; `AutomationScheduledJob` DB rows are written but nothing polls them and enqueues `automation.delayed` jobs when `runAt` is reached. Delay nodes in automation workflows permanently stall.

**Retry configuration:** Workers are created with only `{ connection, concurrency }` (`index.ts:75-78`). BullMQ default is 0 retries (1 attempt). Any job that throws is immediately dead-lettered. Critical queues like `lead-upload` and `whatsapp-send` have no automatic retry.

---

## D. Security

### D-1 CSRF protection bypassed for all normal authenticated requests

**File:** `backend/src/common/security.ts:34`

```ts
if (extractBearerToken(request.headers.authorization)) return next();
```

The CSRF middleware exits early if a Bearer token is present in the `Authorization` header. The frontend _always_ sends a Bearer token (see `api.ts:9,54`). Result: CSRF protection is active only for cookieonly requests (e.g., a cross-site form POST from another domain without JS). For all normal frontend API calls, CSRF protection is a no-op.

The CSRF cookie (`unnatify_csrf_token`) is set, the `x-csrf-token` header is read, but the comparison at `security.ts:39` is never reached for the frontend. This is a design mismatch — the double-submit cookie pattern relies on the same-origin JavaScript being able to read the cookie. If both cookie auth and Bearer auth are supported, CSRF protection must be enforced for cookie-auth paths and can be skipped for Bearer-auth paths. That logic is correct in principle, but the frontend also includes cookies (`credentials: 'include'` in `api.ts:55`), making it potentially vulnerable to CSRF if an attacker can craft a cookie-only request (e.g., forms, iframes).

**Practical impact:** Moderate. Cookie-based CSRF attacks are theoretically possible but require the attacker to bypass Bearer token requirement. The main concern is that the CSRF system provides false assurance without real protection for the cookie path.

---

### D-2 Access token stored in `sessionStorage` — XSS-accessible

**File:** `frontend/src/lib/auth.ts:12`

JWT access token is stored in `sessionStorage`. Any XSS payload executing in the CRM origin can read the token and make authenticated API calls. The refresh flow also uses `sessionStorage.getItem(authTokenStorageKey) ?? localStorage.getItem(authTokenStorageKey)` (`auth.ts:60`), falling back to localStorage for legacy tokens.

**Practical impact:** Standard trade-off. HttpOnly cookies would be safer. The current httpOnly cookie for `unnatify_access_token` is also set by the backend (`auth.controller.ts:134`), and `apiRequest` sends `credentials: 'include'`, so the httpOnly cookie is sent on every request regardless of whether the Bearer token is also present. The sessionStorage token is therefore redundant for same-origin requests — it's effectively a belt-and-suspenders auth. However, the presence of the token in sessionStorage is still a risk if XSS occurs.

---

### D-3 Content-Security-Policy is overly restrictive for MUI emotion runtime

**File:** `backend/src/common/security.ts:25`

```
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; base-uri 'self'
```

This CSP has no `style-src unsafe-inline` or nonce. MUI v7 with Emotion injects `<style>` tags into the document at runtime. Without `style-src 'unsafe-inline'` or a nonce-based approach, the browser will block all MUI-generated styles in CSP-enforcing mode. The app may appear unstyled in CSP-strict environments. Either this CSP is not being enforced (Content-Security-Policy header without `report-only` still enforces), or the app silently breaks in certain configurations.

**Practical impact:** Either the CSP is broken (app unstyled in some browsers) or it's already ignored via browser CSP configuration. Needs testing.

---

### D-4 `POST /ops/login` is not rate-limited

**File:** `backend/src/ops/ops.controller.ts:33-39`

The ops login endpoint has no brute-force protection. An attacker who discovers the `/ops/login` path can attempt unlimited password guesses. The password is bcrypt-hashed (good), but without rate limiting, the constraint is only compute cost of bcrypt.

---

### D-5 Settings GET endpoints bypass permission check by design — intentional but undocumented

**Files:** `backend/src/settings/settings.controller.ts` — `GET lead-lists`, `task-lists`, `activity-types`, `disposition-form`

These four endpoints have `@UseGuards(JwtAuthGuard)` (require login) but no `requireSettings` permission assertion. Any authenticated user can read all lead statuses, task types, activity types, and disposition values, regardless of their role. This appears intentional (these values are needed by all views), but it's undocumented and inconsistent with the permission-guard pattern elsewhere.

---

### D-6 Voicebot and WhatsApp webhook routes exempt from JWT but not rate-limited

**File:** `backend/src/connectors/connectors.controller.ts:148,235`

Webhook routes are exempted from `JwtAuthGuard` and CSRF (they rely on `assertWebhookSecret`). The secret check uses `timingSafeEqual` (good). However, there is no rate limiting on these endpoints. A bad actor could hammer the voicebot webhook endpoint and cause unbounded activity record creation or queue flooding.

---

## E. Performance

### E-1 `GET /health/metrics` creates 11 + 1 Redis connections per call

**File:** `backend/src/health/health.controller.ts:96-100`

```ts
const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
const queues = queueNames.map((queueName) => new Queue(queueName, {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null })
}));
```

11 BullMQ `Queue` instances are created, each wrapping a separate `new Redis(...)` client. Plus 1 standalone Redis for heartbeats/pings. That's 12 Redis connections per call. The `finally` block calls `queue.close()` and `redis.disconnect()`, but `Queue.close()` in BullMQ is async and may not immediately close the underlying IO. Under load (e.g., monitoring tool polling `/health/metrics` every 5 seconds), this can accumulate 60+ Redis connections/minute.

**Fix:** Inject shared `BullMQ.Queue` instances via NestJS DI instead of constructing per-request.

---

### E-2 Activities and Tasks advanced filters are fully client-side

**Files:** `frontend/src/features/crm/views/ActivitiesView.tsx:486-500`, `TasksView.tsx`

Advanced filter conditions are evaluated in the browser against the full loaded result set. `GET /activities?type=...` and `GET /tasks?...` return all matching records with no pagination. For an active CRM with 10,000+ activities per agent, the full dataset is loaded and filtered client-side on every type change.

The tasks controller (`tasks.controller.ts:18-41`) does accept `assignedTo`, `status`, `priority`, `search`, `dueAfter`, `dueBefore`, and `pageSize` parameters — but `TasksView.tsx` does not use them for advanced filter conditions; it applies those filters after loading.

---

### E-3 Activities endpoint has no pagination

**File:** `backend/src/activities/activities.controller.ts:18-23`

`GET /activities` accepts only `leadId` and `type`. No `page`, `pageSize`, `limit`, or cursor param. The service returns all matching records. As activity volume grows, this endpoint becomes a full-table scan for the authenticated user's accessible leads.

---

### E-4 `automationVariables()` called per-node — 4 DB queries × N nodes per run

**File:** `workers/src/processors/automation.ts:199-231` (see A-13 for full details)

Pre-loading lead + user + custom field values once at run start would reduce this to a constant 4 queries per run instead of 4 × N.

---

### E-5 Lead upload: row-level transactions (N sequential `$transaction` calls for N rows)

**Files:** `workers/src/processors/lead-upload.ts:135`, `backend/src/uploads/uploads.service.ts:202`

Each valid row is imported in its own `prisma.$transaction(...)`. For a 50,000-row CSV at the configured max, this means 50,000 sequential round-trips to Postgres. Batching inserts (even in groups of 100) would reduce this to ~500 transactions.

---

## F. UI/UX Audit

### F-1 Tab style inconsistency: filled vs. underline

**Files:** `frontend/src/features/crm/views/LeadDetailView.tsx`, all other views

`LeadDetailView` uses MUI Tabs with a custom `sx` that sets `bgcolor: 'green'` (filled style) for the active tab indicator. Every other view that uses tabs (`ReportsView`, `ConnectorsView`, `AutomationView`) uses the default MUI underline indicator. Two distinct visual languages for the same component in the same app.

---

### F-2 Raw hex color `#2d6a2d` hardcoded in 4+ locations

**Files:**
- `frontend/src/features/crm/views/DashboardView.tsx:18`: `const green = '#2d6a2d'`
- `frontend/src/features/crm/views/TasksView.tsx:35`: `const green = '#2d6a2d'`
- `frontend/src/features/crm/views/ReportsView.tsx:23`: `const green = '#2d6a2d'`
- `frontend/src/features/crm/views/UploadsView.tsx:373`: `bgcolor: '#2d6a2d'` inline

The theme (`theme/theme.ts`) defines `palette.primary.main = '#2d6a2d'` and the CSS variable `--g700`. These raw hex constants bypass the theme, meaning a palette update would require hunting down all hardcoded occurrences.

---

### F-3 `AppButton` and `CapsuleButton` duplicate component vocabulary

**Files:** `frontend/src/components/common/AppButton.tsx`, `frontend/src/components/common/CapsuleButton.tsx`

`ReportsView.tsx:166` imports `CapsuleButton` for the "Export CSV" action. All other views use MUI `Button` directly. `AppButton` is defined but its usage is inconsistent (some views, not others). Two near-duplicate wrapper components increase cognitive load.

---

### F-4 Non-interactive filter pills show affordance of being clickable

**File:** `frontend/src/features/crm/views/ActivitiesView.tsx:575-576`

The "Owner: Anyone" and "Lead: Any" pills look visually identical to the "Date: Today/All" pill (which is interactive). Users reasonably expect all filter pills to be clickable. Only the Date pill actually works.

---

### F-5 Error and success messages use inconsistent patterns

- `ActivitiesView.tsx:568`: `<Typography color="error" fontWeight={800}>{activityMessage}</Typography>` — renders both errors AND successes (e.g., "Activity created") in the same typography, colored red on error but not styled differently for success
- `UploadsView.tsx:313`: `<MessageAlert message={uploadMessage} />` — uses a dedicated component
- `LeadsView.tsx`: uses a custom `toast` pattern
- `DashboardView.tsx`: uses `<Alert severity="...">` inline

Four different error/message display patterns across six views.

---

### F-6 Success toasts don't auto-dismiss

**Files:** `ActivitiesView.tsx:413`, `LeadsView.tsx`

`setActivityMessage('Activity created')` — the message stays visible until the next action or navigation. It's never cleared on a timer, cluttering the UI for inattentive users.

---

### F-7 Calendar tab in TasksView renders identical content to Board

Already covered in A-6. The UX impact: users see a misleading navigation item.

---

### F-8 "Log activity" from global Activities view requires knowing a Lead ID

**File:** `frontend/src/features/crm/views/ActivitiesView.tsx:641-652`

When creating an activity from the global Activities view, the Lead selector loads only the 50 most recently updated leads (`/leads?pageSize=50&sortBy=updatedAt`). If the target lead isn't in the top 50, the user cannot find it. There is no search field inside the selector.

---

### F-9 TasksView board columns use fixed hardcoded statuses

**File:** `frontend/src/features/crm/views/TasksView.tsx` (Kanban columns)

The board renders columns based on a static list of task statuses. If the admin configures custom task statuses in Settings, the board columns do not update. The column definitions are not driven by `GET /settings/task-lists`.

---

### F-10 Large view files with no skeleton loading states

Views like `LeadsView.tsx` (1025 lines), `TasksView.tsx` (848 lines), and `LeadDetailView.tsx` (811 lines) show only a loading spinner (or nothing) while data loads. MUI `Skeleton` components exist but are unused. The perceived performance feels slow because the layout jumps from blank to full content.

---

## G. Modularity / Code Quality

### G-1 Duplicate CSV parsing logic in backend service and worker

**Files:** `backend/src/uploads/uploads.service.ts` (lines ~330-460), `workers/src/processors/lead-upload.ts` (lines ~355-423)

Both files contain nearly identical CSV parsing implementations (`parseCsvRecords`, `normalizeHeader`, `hasColumn`, `getColumn`, `applyColumnMapping`). The worker is the canonical processor but the backend service contains a parallel "inline" path used for non-queued uploads. Any fix to one must be applied to both.

---

### G-2 `any[]` type in `UploadsView.tsx:133`

**File:** `frontend/src/features/crm/views/UploadsView.tsx:133`

```ts
function toUploadRows(apiUploads: any[]): UploadRow[] {
```

The upload API response type is untyped. This hides any shape mismatch between backend response and the frontend `UploadRow` tuple type.

---

### G-3 Activity type codes mixed as magic strings and constants

**Files:** `frontend/src/features/crm/views/ActivitiesView.tsx:528-533`

```ts
const typeCode = String(activity.type ?? '').padStart(3, '0');
if (typeCode === '001') { // recording
```

Activity type codes (`'001'`, `'002'`, etc.) are referenced as string literals in view files even though constants are defined in `activity-columns.ts`. Inconsistently applied.

---

### G-4 `formatCellValue` function likely duplicated across views

**File:** `frontend/src/features/crm/views/ActivitiesView.tsx:101-106`

```ts
function formatCellValue(value: unknown) { ... }
```

This or a near-identical function almost certainly exists in other view files. A shared utility in `frontend/src/lib/format.ts` would reduce duplication.

---

### G-5 `RowActionMenu` component identified in Phase 1 as potentially dead — actually alive

**File:** `frontend/src/features/crm/views/ActivitiesView.tsx:535`

`RowActionMenu` is used in `ActivitiesView.tsx` for edit/delete actions. The Phase 1 note about it being unused was incorrect. Disregard that entry.

---

### G-6 Monolithic view files over 800 lines

| File | Lines |
|---|---|
| `LeadsView.tsx` | 1,025 |
| `TasksView.tsx` | 848 |
| `SettingsView.tsx` | 769 |
| `LeadDetailView.tsx` | 811 |
| `ActivitiesView.tsx` | 729 |
| `AutomationView.tsx` | 700+ |
| `ConnectorsView.tsx` | 700+ |

Each file handles data fetching, state management, and rendering in a single component. Domain logic is interleaved with UI. Testability is low.

---

## H. Production Readiness

### H-1 Workers have no retry configuration — all failures are one-strike

**File:** `workers/src/index.ts:75-78`

```ts
const workers = queueNames.map((queueName) => new Worker(queueName, processJob, {
  connection,
  concurrency: queueConcurrency(queueName)
}));
```

No `attempts` or `backoff` in worker options. BullMQ default is 1 attempt total (0 retries). Any job that throws — including transient network errors, temporary DB unavailability, or momentary WhatsApp API failures — immediately goes to the dead-letter queue with no retry. Critical for production: `lead-upload.process`, `whatsapp.send`, `voicebot.trigger`.

---

### H-2 Automation delay nodes and offer expiry are permanently broken in production

Already covered in A-4 and A-5. Neither the `offer-expiry` queue nor the `automation-delayed` queue is ever populated. These require an external cron trigger (e.g., BullMQ Cron jobs or a backend `@Cron()`) to be wired in.

---

### H-3 `prisma migrate deploy` is not called in Docker entrypoint

**File:** `docker-compose.yml` (backend service `command`)

The backend service starts directly without running `prisma migrate deploy`. If migrations are pending (e.g., first deploy after a schema change), the application starts against an incompatible schema and may silently corrupt data or throw runtime errors.

**Fix:** Add `prisma migrate deploy && node dist/main` to the backend Docker entrypoint or use a separate migration init-container.

---

### H-4 `UPLOAD_DIR` uses relative path from `process.cwd()`

**Files:** `backend/src/health/health.controller.ts:122`, `backend/src/ops/ops.controller.ts:60`

```ts
resolve(this.config.get<string>('UPLOAD_DIR') ?? resolve(process.cwd(), '..', 'uploads'))
```

The fallback resolves to the parent directory of wherever the process is started. This is predictable in Docker (always `/app/..`) but fragile if the process is started from a different working directory in development or migration scripts.

---

### H-5 Email sending for OTP and password reset — needs verification

**Files:** `backend/src/auth/auth.controller.ts` — `POST /auth/email-otp/request`, `POST /auth/password-reset/request`

These endpoints are defined. Whether they actually send email (vs. just writing to DB) depends on `auth.service.ts`. The source was not read. If email is not configured in the environment, these calls may fail silently and leave users unable to reset passwords or complete MFA.

---

### H-6 `AutomationRun.count` exit condition counts ALL runs for a lead, not runs for a specific workflow

**File:** `workers/src/processors/automation.ts:337-339`

```ts
const runCount = await prisma.automationRun.count({ where: { leadId } });
if (runCount >= maxAttempts) return { shouldExit: true, reason: 'max_attempts_reached' };
```

`maxAttempts` in the exit condition is checked against total runs for the lead across ALL workflows. A lead that ran 3 different workflows at 1 run each would hit a `maxAttempts=3` guard on any fourth workflow, even if that specific workflow has never run.

---

### H-7 `SettingsSidebar`, `RouteState` are dead code

**File:** Phase 1 confirmed these as unused components. They should be removed to reduce build size and confusion.

---

## I. Missing CRM Features

| Feature | Notes |
|---|---|
| **Task deletion** | No backend `DELETE /tasks/:id`, no frontend UI. Tasks accumulate permanently. |
| **Lead deletion / archiving** | No delete or archive route. Leads can only change status. |
| **Calendar view for tasks** | "Calendar" tab in TasksView renders Board view — not implemented. |
| **Offer expiry automation** | `offer-expiry` queue never triggered (see A-4, C). |
| **Automation delay node resumption** | `automation-delayed` queue never triggered (see A-5, C). |
| **Saved reports UI** | Backend `GET/POST /reports/saved` and schedule endpoints exist but `ReportsView` has no UI for them. |
| **Download upload error CSV** | `GET /uploads/:id/result-csv` exists but no download button in `UploadsView`. |
| **Lead merge / deduplication UI** | Duplicate detection exists on upload but no manual merge flow. |
| **Global search (beyond leads)** | Sidebar search only navigates to `/leads?search=...`. No activity/task/contact search. |
| **Activity Owner/Lead filtering** | Filter pills exist but are permanently non-functional (see A-7). |
| **Lead custom field upload mapping** | Frontend shows custom fields in upload mapping UI but upload processor doesn't write them. |
| **Bulk task operations** | No bulk assign, status change, or delete for tasks. |
| **Notification history** | No in-app notification system. |
| **Task comments in TasksView** | `POST /tasks/:id/comments` endpoint exists, used in `LeadDetailView` task panel, but not wired in `TasksView`. |

---

## Top-10 Priority List

Ranked by: broken functionality first, then data loss, then security, then UX.

| # | Finding | Severity | Files |
|---|---|---|---|
| 1 | **Offer expiry never triggers** — leads are never expired automatically | P0 – broken feature | `workers/processors/offers.ts`, `index.ts` |
| 2 | **Automation delay nodes stall permanently** — `AutomationScheduledJob` never resumed | P0 – broken feature | `workers/processors/automation.ts:111` |
| 3 | **`GET /connectors/telephony/config` missing** — telephony config panel always blank | P0 – broken UI | `telephony.controller.ts`, `TelephonyConnectorPanel.tsx:436` |
| 4 | **`partnerMapping` silently dropped on every upload** — data loss | P1 – data loss | `lead-upload.ts:136`, `uploads.service.ts:202` |
| 5 | **`reportType` always `'lead-summary'`** — all exports produce the same report type | P1 – data correctness | `reports.service.ts:205,393` |
| 6 | **Workers have no retry** — transient failures immediately dead-letter | P1 – reliability | `workers/index.ts:75` |
| 7 | **`prisma migrate deploy` not in Docker entrypoint** — schema can be out of sync | P1 – ops | `docker-compose.yml` |
| 8 | **CSRF protection bypassed for all Bearer-authenticated requests** — false security | P2 – security | `security.ts:34` |
| 9 | **Calendar view shows Board** — misleading UX, broken feature expectation | P2 – UX | `TasksView.tsx` |
| 10 | **Activities/Tasks advanced filters are fully client-side** — performance at scale | P2 – performance | `ActivitiesView.tsx:486`, `TasksView.tsx` |

---

## Batch Fix Plan

### Batch 1 — Critical broken features (P0)

1. Add `GET /connectors/telephony/config` endpoint that reads saved config from the DB  
2. Wire `offer-expiry.check` job: add a BullMQ repeatable/cron job at backend startup or an NestJS `@Cron()` that enqueues `offer-expiry.check` daily  
3. Wire `automation-delayed` job: add a polling mechanism (e.g., `@Cron()` every 1 minute in backend or a repeatable BullMQ job in workers) that queries `AutomationScheduledJob WHERE status='scheduled' AND runAt <= NOW()` and enqueues `automation.delayed` jobs

### Batch 2 — Data correctness and reliability (P1)

4. Add `partnerMapping` field to `Lead` Prisma schema and include it in both `lead-upload.ts` and `uploads.service.ts` create calls (requires migration)  
5. Fix `reportType` tautological ternary — implement actual multi-type report generation or document that only `'lead-summary'` is supported  
6. Add `attempts: 3` and `backoff: { type: 'exponential', delay: 2000 }` to all BullMQ `Worker` configs  
7. Add `prisma migrate deploy` to backend Docker entrypoint before starting the app

### Batch 3 — Security hardening (P2)

8. Fix CSRF: enforce CSRF check for cookie-authenticated requests even when Bearer is present, OR document that CSRF is intentionally disabled for Bearer-auth paths  
9. Add rate limiting to `POST /ops/login` (e.g., express-rate-limit: 5 requests per 15 minutes per IP)  
10. Fix CSP: add `style-src 'unsafe-inline'` or implement nonce-based CSP with MUI

### Batch 4 — UX fixes (P2)

11. Replace Calendar tab with a real date-grouped task calendar (or hide the tab until implemented)  
12. Fix Owner/Lead filter pills in ActivitiesView: either remove them or wire them to `GET /activities` with proper backend query params  
13. Replace all `const green = '#2d6a2d'` with `theme.palette.primary.main` references  
14. Standardize error/success message display: adopt `<MessageAlert>` or MUI `Alert` consistently across all views

### Batch 5 — Missing features (P3)

15. Add `DELETE /tasks/:id` backend endpoint and task delete UI  
16. Connect `ReportsView` to saved reports and schedule endpoints  
17. Add download button in `UploadsView` for `result-csv` and `original-csv`  
18. Add search field to Lead selector in ActivitiesView "Log activity" dialog  
19. Fix AutomationRun exit condition `maxAttempts` to be per-workflow, not per-lead-globally
