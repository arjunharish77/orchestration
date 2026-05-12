# Unnatify CRM — Full Production Readiness Audit
**Date:** May 2026  
**Scope:** Full codebase review of `/commcrm` — frontend (Next.js), backend (NestJS), Prisma schema, workers, and supporting docs.

---

## Current Fix Pass — May 7, 2026

This section reflects the current code after the latest hardening pass. Older findings below are kept for history and should not be read as the active status unless they are repeated here.

### Fixed / Verified

- Bulk lead assignment now uses `POST /leads/bulk-assign` instead of per-row N+1 calls.
- Bulk lead updates now use `POST /leads/bulk-update` instead of per-row N+1 calls.
- Task filtering is server-side through `GET /tasks` query params.
- Dashboard now uses a unified `/dashboard/overview` endpoint.
- The dead top-bar notification icon is removed.
- Lead and settings feedback now use structured severity patterns instead of string color checks in the main flows.
- Saved lead views are now persisted in the backend through `/leads/saved-views`, with localStorage only as fallback.
- Lead detail linked records now resolve by the internal lead id, even when a route uses an external lead/loan id.
- Lead mutation paths now resolve the internal id before writing audit logs, activities, assignments, disposition history, and custom fields.
- Duplicate formatting/default/type helpers were consolidated into shared frontend modules.
- Dashboard connector cards are driven by backend connector status.
- Reports audit logs are paginated.
- Upload worker polling cleans up on auth changes.
- Backend request validation, CSRF double-submit validation, body size limits, global rate limiting, and graceful shutdown hooks are in place.
- Verification passed on this pass: backend typecheck/build, worker typecheck/build, frontend lint/typecheck/build, and frontend architecture smoke test.

### Remaining Before Go-Live

- Provider-specific production validation still depends on real MCUBE/WhatsApp/voicebot credentials and webhook tests.
- Final CSV upload field list / mandatory-vs-optional rules must be confirmed before real production data import.
- VPS go-live smoke checks must still be run on the target server: migrations, health endpoints, worker queues, Nginx/SSL, backups, restore drill, and off-server backup.
- Expanded browser E2E coverage is recommended before high-volume rollout, but it is not blocking the current local build.

## Audit Summary

The CRM is **production-ready at the foundation level**. Auth, lead management, CSV upload, activities, tasks, automation, assignment engine, reporting, settings, and telephony popup are all functionally implemented. The remaining gaps fall into four buckets: **blocked integrations** (MCUBE credentials), **technical debt** (large view files, duplicate helpers), **UI inconsistencies** (inline forms vs. dialogs, chip/table variance), and **operational gaps** (observability, Docker hardening, test coverage).

---

## 🔴 CRITICAL — Must Fix Before Go-Live

### 1. Bulk Assignment Uses N+1 Individual API Calls
**File:** `LeadsView.tsx` → `saveBulkLeadAssignment()` (line 709–736)  
Iterates `selectedLeadRows` and fires a separate `POST /leads/:id/assign` per lead using `Promise.all`. At 50+ leads this creates a thundering-herd of backend calls, clogs the DB connection pool, and can time out.  
**Fix:** Add a `POST /leads/bulk-assign` endpoint that accepts `{ leadIds[], assignedUserId, reason }` and processes in a single transaction.

### 2. Bulk Status Update is Also N+1
**File:** `LeadsView.tsx` → `bulkUpdateLeadStatus()` (line 760–783)  
Same pattern — fires `PATCH /leads/:id` per lead individually.  
**Fix:** Add `POST /leads/bulk-update` accepting `{ leadIds[], patch }`.

### 3. Task Filtering is Entirely Client-Side
**File:** `TasksView.tsx` — filtering (line 309–333) operates on the full in-memory `tasks` array. When `/tasks` returns 1000+ rows, filtering loops over all rows in the browser on every keystroke.  
**Fix:** Move filtering to query params on `GET /tasks`. The backend already accepts `status`; extend it to accept `search`, `assignedTo`, `priority`, `dueBefore`, `dueAfter`.

### 4. `NotificationsIcon` in TopBar is Dead UI
**File:** `CrmShell.tsx` line 223 — `NotificationsIcon` is rendered as a plain icon with no click handler, no count badge, no popover. Users will click it and get no response.  
**Fix:** Either wire it to a real notification system or remove it. Do not ship non-functional chrome.

### 5. Dashboard Fires 6 Parallel API Calls on Every Load
**File:** `DashboardView.tsx` → `loadDashboardOverview()` (line 323–330)  
Calls `/leads`, `/leads/summary`, `/uploads`, `/automation/overview`, `/reports/overview`, `/tasks?status=Pending` simultaneously on every dashboard mount. No caching, no debounce, no abort on unmount.  
**Fix:** Add a single `/dashboard/overview` backend endpoint. Return all metrics in one call. Cache the result for 30–60 seconds server-side.

### 6. `restoreStoredSession` Called on Every `CrmApp` Mount
**File:** `CrmApp.tsx` line 122 — calls `restoreStoredSession` which reads from localStorage/cookie and then immediately calls `/access/users/:id/effective-permissions`. This happens even on fast navigations between routes.  
**Fix:** Cache the `effectivePermissions` result in React context or Zustand. Only re-fetch on explicit refresh or after token rotation.

### 7. MCUBE Integration Blocked — No Fallback UI
**Files:** `ConnectorsView`, `TelephonyConnectorPanel`  
Click-to-call and popup delivery depend on MCUBE credentials that are not yet available. The UI has no "Integration not configured" state — it silently fails with a generic error toast.  
**Fix:** Check connector active status on load and render a clear "MCUBE not configured" banner with a link to the Settings → Connectors page.

---

## 🟠 HIGH — Fix Before First User-Facing Release

### 8. `loadLeadMessage` Shown as Success Color for Non-Success States
**File:** `LeadsView.tsx` line 788  
```tsx
color={leadMessage === 'Lead created' ? green : 'error'}
```
Any message other than the exact string `'Lead created'` shows as red — including `'Lead loaded for edit'` (line 522) which is shown as an error. Multiple similar patterns exist in `LeadDetailView.tsx`.  
**Fix:** Use a proper `{ message, severity }` state object and render with `<Alert severity={...}>`.

### 9. Saved Views Stored Only in `localStorage` — Lost Across Devices
**File:** `LeadsView.tsx` lines 132–146  
Saved views are persisted per-user in `localStorage`. A user switching browsers or devices loses all saved views.  
**Fix:** POST saved views to a `/users/:id/saved-views` endpoint and fetch on load, falling back to localStorage.

### 10. `assignedUserName` Denormalized on Lead but Not Kept in Sync
**File:** `LeadsView.tsx` `toLeadRows()` line 178  
`owner` reads from `lead.assignedUserName` which is a denormalized field. When a user's name changes, this field goes stale. The leads table then shows the old name.  
**Fix:** Either join the user name fresh on every lead query, or add a database-level trigger/hook to update all `assignedUserName` values when a User's name is updated.

### 11. `LeadDetailView` Makes Two Separate Calls to `/leads/:id`
**File:** `LeadDetailView.tsx` — `loadLead()` (line 344) fetches the lead, then `loadLeadLinkedData()` (line 385) fetches it **again** as part of a `Promise.all`. The second call result overwrites `leadDetail` but the data is the same lead object.  
**Fix:** Merge into a single `/leads/:id` call that returns lead + assignments + automationRuns in one response (use Prisma `include`).

### 12. Automation View — Workflow Run Result Shown as Raw JSON
**File:** `AutomationView.tsx` lines 712–719  
When a workflow is run, the result is displayed as `JSON.stringify(workflowRunDetail, null, 2)` in a plain textarea. This is a development artifact.  
**Fix:** Replace with a structured `RunResultCard` showing status, steps, exit reason, and timing.

### 13. `DashboardView` Shows Hardcoded Connector Names
**File:** `DashboardView.tsx` line 469  
```tsx
{['MCUBE', 'WhatsApp', 'Voicebot', 'Resend', 'Generic API'].map((item) => ...)}
```
This is hardcoded — does not reflect actual connector configuration. An inactive connector will still show as a chip.  
**Fix:** Fetch from `/connectors` and show real status with color coding (active = green, inactive = grey/red).

### 14. Reports Loads Audit Logs Without Pagination
**File:** `ReportsView.tsx` line 59  
`apiRequest('/audit-logs', ...)` fetches all audit logs with no limit. In production this could return thousands of rows.  
**Fix:** Add `pageSize=100` default and pagination controls to the audit tab.

### 15. `NoModulesAssigned` Component Uses Inline Styles, Not Theme
**File:** `CrmApp.tsx` lines 226–231  
The fallback screen uses raw `style={{ padding: 24 }}`. While trivial, it breaks the theme contract.  
**Fix:** Use MUI `Box`/`Stack` with `sx` props, consistent with every other screen.

---

## 🟡 MEDIUM — Fix Within First Sprint

### 16. Duplicate `formatDate`, `formatAmount`, `humanizeKey` Helpers Across Files
These utility functions are copy-pasted across:
- `LeadsView.tsx`
- `LeadDetailView.tsx`
- `DashboardView.tsx`
- `TasksView.tsx`
- `UploadsView.tsx`
- `AutomationView.tsx`

Each has slight variations. A bug fix in one doesn't propagate.  
**Fix:** Create `frontend/src/lib/format.ts` with canonical `formatDate`, `formatAmount`, `humanizeKey`, `formatCurrency`. Import everywhere.

### 17. Duplicate `CapsuleButton` Component in Multiple View Files
`CapsuleButton` is defined locally and independently in:
- `LeadsView.tsx`
- `LeadDetailView.tsx`
- `ReportsView.tsx`
- `TasksView.tsx`

Same props, same styling, different file.  
**Fix:** Move to `components/common/CapsuleButton.tsx` and import everywhere.

### 18. Duplicate `defaultLeadLists` / `defaultTaskLists` Across Files
These default arrays are duplicated verbatim in `LeadDetailView.tsx`, `LeadsView.tsx`, `TasksView.tsx`, and the settings files. If a new default status is added, it must be updated in 4+ places.  
**Fix:** Move to `lib/crm-defaults.ts` and import everywhere.

### 19. `LeadRow` Type Duplicated in `LeadsView` and `LeadDetailView`
Both files define a `LeadRow` type independently with small field differences (`location`, `uploadDate`, `offerExpiryDate` exist in `LeadDetailView` but not `LeadsView`).  
**Fix:** Export a single canonical `LeadRow` type from `types/lead.ts`.

### 20. `toLeadRows()` Exported from `LeadsView.tsx` and Imported into `AutomationView.tsx`
**File:** `AutomationView.tsx` line 9: `import { toLeadRows } from './LeadsView'`  
A transformer used by Automation should not be imported from a view file. This creates a coupling where importing a view file may trigger its side-effect hooks.  
**Fix:** Move `toLeadRows` and `LeadRow` to `lib/lead-transforms.ts`.

### 21. Tasks View — No "Create Task" Action from the Global Task List
**File:** `TasksView.tsx`  
There is a `Refresh` button in the header but no "Create Task" button. Users can only create tasks from within a lead detail view.  
**Fix:** Add a `Create Task` button → `FormDialog` with lead search/select + task fields.

### 22. Uploads View — No Click-Through to Upload Detail
**File:** `UploadsView.tsx`  
The upload history table shows rows with file name, counts, and status, but clicking a row does nothing. Failed rows can only be viewed via Settings → Upload History.  
**Fix:** Add an `onPrimaryCellClick` handler that opens a detail panel/dialog showing row-level errors for that batch.

### 23. Activities View — No Quick Filter by Activity Type Code
**File:** `ActivitiesView.tsx`  
The activities list supports activity type filtering, but switching between types reloads data. There's no keyboard shortcut or persistent type tab.  
**Fix:** Use MUI `Tabs` above the table to quick-switch activity type, keeping the selected type in URL params (`?type=001`).

### 24. `CrmShell` Mobile Drawer Uses `bgcolor: 'background.paper'`
**File:** `CrmShell.tsx` line 285  
The mobile drawer uses `background.paper` (white) while the desktop sidebar uses `sidebarBg` (`#162716`). On mobile, the sidebar looks completely different from the desktop layout.  
**Fix:** Use `sidebarBg` in the drawer `PaperProps` to match.

### 25. Settings — Form Feedback Uses a Single `settingsMessage` String
**File:** `SettingsView.tsx` line 88  
All settings operations share one `settingsMessage` string. Saving a field while a previous error message is displayed immediately clears it, even if a different operation fails.  
**Fix:** Use a toast (`useToast`) for operation feedback, keeping `settingsMessage` only for persistent warnings about fallback data.

### 26. `AutomationView` — Node List Is a Hardcoded Demo Array on Mount
**File:** `AutomationView.tsx` lines 166–175  
When the Automation view first loads, `nodes` is initialized with demo nodes including `WhatsApp`, `Voicebot`, and `API Call`. If the user opens the builder without selecting a workflow, they see a fake template.  
**Fix:** Initialize `nodes` to `[]` or to the minimal `[Trigger]` node only. Only populate from the selected workflow.

### 27. `viewFromPath` Does Not Handle `/settings/connectors` or `/settings/users`
**File:** `CrmApp.tsx` line 60  
```tsx
if (pathname.startsWith('/settings') || pathname.startsWith('/users') || pathname.startsWith('/connectors')) return 'settings';
```
Navigating to `/settings/connectors` correctly lands in settings, but `navigateView('connectors')` routes to `/settings/connectors` which then maps back to `settings` — meaning the "Connectors" nav item in the sidebar never shows as active.  
**Fix:** The sidebar doesn't expose `connectors` or `users` as top-level items (they're settings sub-tabs), so this is acceptable — but remove the `/users` and `/connectors` top-level path matching since those routes don't exist.

### 28. Missing `aria-label` on Many Interactive Elements
Quick scan across the codebase reveals missing accessibility attributes:
- `NotificationsIcon` (no button wrapper, no label)
- `Avatar` in `CrmShell` (no label)
- `IconButton` for actions in lead rows (only some have `aria-label`)
- Filter selects lack `<InputLabel>` companions  

**Fix:** Add `aria-label` to all `IconButton` components. Wrap bare interactive icons in `<IconButton>`.

---

## 🔵 UI / UX POLISH

### 29. `leadMessage` Typography Used for Both Info and Error — No Visual Differentiation
**Files:** `LeadsView.tsx` line 788, `LeadDetailView.tsx` lines 718–719  
Messages like `'Lead loaded for edit'` render in error red because they don't match the success string exactly. Use `<Alert>` with the correct severity instead of a raw `<Typography color="error">`.

### 30. Dashboard "Updated Just Now" Badge is Always Static
**File:** `DashboardView.tsx` line 428  
`<AppChip label="Updated Just Now" />` is hardcoded. It never changes. After 10 minutes on the dashboard, this label is factually wrong.  
**Fix:** Track `lastRefreshed` timestamp and show a relative time (e.g. "Updated 3 min ago") or a manual refresh button.

### 31. Automation Metrics `toAutomationRows()` Reads a Hardcoded Node Index
**File:** `DashboardView.tsx` line 145, `AutomationView.tsx` line 157  
```tsx
workflow.versions?.[0]?.definition?.nodes?.[1]?.label ?? 'Draft'
```
Node index `[1]` is arbitrary — it reads the second node regardless of what it is.  
**Fix:** Find the first non-Trigger node by `type !== 'Trigger'`.

### 32. `DashboardView` Shows at Most 3 Metric Cards (`.slice(0, 3)`)
**File:** `DashboardView.tsx` line 431  
The metrics array may have 5 items but only the first 3 are shown. Remaining metrics (Converted, Automation Runs) are invisible.  
**Fix:** Remove the `.slice(0, 3)` and use a 5-column responsive grid.

### 33. `PriorityTasksPanel` Slices to 4 Tasks Silently
**File:** `DashboardView.tsx` line 171 — `toDashboardTaskRows` slices to `slice(0, 4)`.  
There's no "View all" link. Users with 20+ pending tasks see no indication that more exist.  
**Fix:** Add a "View all N tasks →" footer link to `/tasks`.

### 34. Leads Table — Column Selector Resets to Default When Tab Changes
**File:** `LeadsView.tsx` line 293 — `visibleLeadFields` initialized to `['name', 'email', 'status', 'source', 'created']`. After navigating away from Leads and back, columns reset.  
**Fix:** Persist `visibleLeadFields` to `localStorage` keyed by userId, same as saved views.

### 35. `LeadDetailView` Calls `setTab(0)` on "Activity" Button Click
**File:** `LeadDetailView.tsx` line 714  
Clicking the "Activity" header button scrolls to tab index 0. If a user reorders tabs or future tabs are added before Activities, this breaks.  
**Fix:** Use `setTab(detailTabs.findIndex(t => t.key === 'activities'))`.

### 36. Lead Edit Form Prefills `category` From `lead.category` But `category` Might Be `'-'`
**File:** `LeadsView.tsx` `loadLeadForEdit()` line 520  
```tsx
setLeadForm({ ..., category: lead.category, ... })
```
`lead.category` can be `'-'` (the display fallback from `toLeadRows`). Submitting the edit form would save `'-'` as the actual category value.  
**Fix:** Map `'-'` back to `''` when prefilling edit forms.

### 37. `UploadsView` — Worker Health Polling Uses `setInterval` Without Cleanup on Auth Change
**File:** `UploadsView.tsx` line 216  
```tsx
const timer = window.setInterval(() => { void refreshWorkerHealth(); }, 30_000);
return () => window.clearInterval(timer);
```
The cleanup only runs on unmount. If `authToken` changes (logout → login), a new interval starts while the old one keeps running.  
**Fix:** Include `authToken` in the `useEffect` dependency array, or only poll when `authToken` is non-null.

### 38. Disposition Dialog — Save Button Disabled Until `dispositionValues.disposition` Set
**File:** `LeadDetailView.tsx` line 793  
This is correct behavior, but there's no visible hint to the user that the Disposition field is required. The button is just greyed out with no tooltip or helper text.  
**Fix:** Add `helperText="Required"` to the disposition select inside the dialog.



### 40. `SettingsView` — `settingsMessage` Includes "Could not" Check for Color
**File:** `SettingsView.tsx` line 687  
```tsx
color={settingsMessage.includes('Could not') ? 'error' : green}
```
A message like `"Could not save field - field already exists with that key"` correctly shows red. But `"Could not load configured list values. Seed defaults..."` is shown in green because it contains "Seed defaults" not "Could not"... wait, it does contain "Could not". Actually this is fragile — any future message phrasing change breaks the color logic.  
**Fix:** Use a `{ message: string, type: 'success' | 'error' | 'warning' }` state tuple.

---

## 🔒 SECURITY & OPERATIONAL

### 41. `ValidationPipe` Has `forbidUnknownValues: false`
**File:** `backend/src/main.ts` line 30  
```ts
forbidUnknownValues: false
```
This allows class-validator to skip validation for unknown class instances. Should be `true` in production.  
**Fix:** Set `forbidUnknownValues: true`.

### 42. Rate Limiter Only Covers Auth and Webhook Routes
**File:** `main.ts` line 39  
The `simpleRateLimit` middleware only protects login, OTP, password reset, and webhook paths. The rest of the API (`/leads`, `/uploads`, `/reports`) has no rate limit.  
**Fix:** Add a global rate limit (e.g. 300 req/min per IP) applied to all routes, with the tighter limits remaining on auth paths.

### 43. No Request Body Size Limit on JSON Endpoints
**File:** `main.ts` line 35  
Only `urlencoded` is limited to `25mb`. NestJS defaults to 100kb for JSON body parsing (express default). Very large JSON payloads (e.g. automation definitions with many nodes) could cause OOM issues.  
**Fix:** Add `app.use(json({ limit: '2mb' }))` after the urlencoded middleware.

### 44. `authToken` Passed as a Prop Through Many Component Layers
**File:** `CrmApp.tsx` — `authToken` is drilled into every view component as a prop.  
Risk: A component accidentally logging props leaks the token. It also makes it harder to rotate the token transparently.  
**Fix:** Store `authToken` in React context (`AuthContext`) and consume it directly in components that need it. Stop prop-drilling.

### 45. No CSRF Token Validation on Mutation Endpoints (Only Presence Check)
**File:** `common/security.ts` (referenced in `main.ts` line 38)  
Verify that `csrfProtection()` actually validates the CSRF token value, not just its presence. Some naive implementations only check for the header key.  
**Fix:** Review `csrfProtection` implementation to confirm it validates a known-secret token or uses the double-submit cookie pattern.

### 46. Audit Log Module Not Enforced for All Sensitive Operations
Per the Prisma schema, `AuditLog`-style entries exist. Verify that the following operations always create audit entries:
- User creation/deactivation
- Permission template changes
- Bulk lead assignment
- Workflow publish/unpublish
- Connector credential updates

**Fix:** Add an audit middleware or interceptor that automatically logs PATCH/POST/DELETE on sensitive routes.

---

## 📦 MISSING FEATURES (vs. Requirements Doc)


### 48. No In-App Notification System
`NotificationsIcon` exists in the shell but is wired to nothing. The blueprint implies notifications for automation events, task due dates, and assignment changes.

### 49. No Lead Merge / Deduplication UI
The CSV upload handles server-side deduplication by `mobile`/`externalLeadId`, but there's no UI for admins to manually merge duplicate leads that slipped through.

### 50. No User Profile / Password Change Screen
Users have no way to update their own name, phone, or password from within the CRM. The settings area is admin-only.

### 51. WhatsApp Chat Panel — Schema Exists, UI Does Not
`WhatsAppConversation`, `WhatsAppMessage`, and `WhatsAppQuickReply` models are fully defined in the Prisma schema, but no frontend UI for WhatsApp conversation history or a chat panel exists.

### 52. Voicebot Call Detail View
`VoicebotCall` table stores transcript, summary, intent, disposition, and recording URL, but there's no UI to display these call details after a voicebot call completes.

### 53. Lead "Notes" Tab Referenced in UI Reference Doc — Not Implemented
The `UI-Reference-Comparison-And-Improvements.md` specifies a `LeadNotesTab`. This tab is absent from `LeadDetailView`'s `detailTabs` array.

### 54. No Scheduled / Recurring Automation Triggers
Current automation only supports event-based triggers (e.g. "Lead Created"). The `AutomationScheduledJob` model exists in the schema but there is no CRON-based trigger node type in the UI or worker.

### 55. Report Export is Fire-and-Forget — No Status Tracking
**File:** `ReportsView.tsx` `exportReport()` — POSTs to `/reports/exports`, then re-fetches the export list. But if the export is async (queued), the user has no polling or websocket notification when it's ready.

---

## 🧪 TEST COVERAGE GAPS

| Area | Status |
|---|---|
| Assignment Engine logic | No unit tests found |
| CSV upload row validator | No unit tests found |
| Automation runner / step executor | No unit tests found |
| JWT auth / refresh token rotation | No integration tests found |
| Permission template field masking | No tests found |
| Lead bulk assign endpoint | No tests found |
| Telephony webhook idempotency | No tests found |

**Recommendation:** Prioritize unit tests for Assignment Engine (`assignment-engine.service.ts`), CSV row normalization (`csv-processor.service.ts`), and Automation step executor (`automation-runner.service.ts`).

---

## 🐳 OPERATIONAL / DEPLOYMENT

### 56. No `NODE_ENV=production` Guard in `Dockerfile`
Verify that the production Docker image sets `NODE_ENV=production`. Without it, NestJS does not enable production-mode optimizations, and Next.js may serve dev assets.

### 57. No Health Check Endpoint for Frontend Container
The backend has `/health/workers`. There's no equivalent `/api/health` or frontend-specific health probe for orchestration (Kubernetes liveness, Docker Compose `healthcheck`).

### 58. No Graceful Shutdown Handling in `main.ts`
**File:** `main.ts`  
There's no `app.enableShutdownHooks()` call and no `SIGTERM` handler. Under Kubernetes or PM2, rolling restarts may drop in-flight requests.  
**Fix:** Add `app.enableShutdownHooks()` after `NestFactory.create`.

### 59. Redis Connection Not Validated at Startup
If Redis is down, the app starts successfully but BullMQ workers fail silently. Rate limiting also silently breaks.  
**Fix:** Add a startup health check that validates Redis connectivity before the server begins accepting traffic.

### 60. No Automated Audit Log Retention Policy
The `AuditLog` table will grow unboundedly. No retention job or TTL index exists.  
**Fix:** Add a nightly CRON job that deletes audit logs older than 90 days (configurable via env var).

---

## ⚡ PRIORITIZED FIX ORDER

### Phase 1 — Before Any User Sees It (1–2 days)
1. Fix bulk assign/update to use batch endpoints (items 1, 2)
2. Remove dead `NotificationsIcon` or stub it properly (item 4)
3. Fix `leadMessage` color logic to use `<Alert>` (items 8, 29)
4. Fix `category: '-'` prefill in edit form (item 36)
5. Fix mobile sidebar color (item 24)
6. Add `forbidNonWhitelisted: true` and `forbidUnknownValues: true` (item 41)
7. Add `app.enableShutdownHooks()` (item 58)

### Phase 2 — Before First Beta Users (3–5 days)
8. Consolidate duplicate helpers into `lib/format.ts` (item 16)
9. Consolidate `CapsuleButton`, `defaultLeadLists`, `LeadRow` type (items 17–19)
10. Move `toLeadRows` out of `LeadsView.tsx` (item 20)
11. Add Create Task from global task list (item 21)
12. Add upload row click-through to detail (item 22)
13. Add Task server-side filtering (item 3)
14. Add global rate limit on all API routes (item 42)
15. Fix `useInterval` cleanup on auth change (item 37)
16. Fix Dashboard to show all 5 metrics (item 32)
17. Fix "View all tasks" on Dashboard (item 33)

### Phase 3 — Before Production Scale (1 week)
18. Create `/dashboard/overview` unified endpoint (item 5)
19. Persist saved views to backend (item 9)
20. Fix `assignedUserName` staleness (item 10)
21. Merge double `/leads/:id` fetch in detail view (item 11)
22. Replace raw JSON run result in Automation (item 12)
23. Wire real connector status to Dashboard (item 13)
24. Add pagination to audit logs (item 14)
25. Add `authToken` to React Context (item 44)
26. Add audit log entries for all sensitive operations (item 46)
27. Validate CSRF implementation (item 45)
28. Add Redis startup health check (item 59)
29. Add audit log retention CRON (item 60)

### Phase 4 — Feature Completeness (ongoing)
30. WhatsApp chat panel UI
31. Voicebot call detail view
32. Lead Notes tab
33. User profile / password change
35. In-app notification system
36. Scheduled automation trigger type
37. Report export status polling

---

## Files With the Most Technical Debt (in order)

| File | Lines | Issues |
|---|---|---|
| `LeadsView.tsx` | 939 | N+1 bulk ops, duplicate types/helpers, edit prefill bug |
| `LeadDetailView.tsx` | 826 | Double fetch, duplicate types/helpers, message color bugs |
| `AutomationView.tsx` | 777 | Demo nodes on mount, raw JSON result display |
| `SettingsView.tsx` | 771 | Single message string for all ops, inline forms |
| `TasksView.tsx` | 540 | Client-side only filtering, no create button |
| `DashboardView.tsx` | 480 | 6 parallel API calls, hardcoded badges, truncated metrics |
| `CrmApp.tsx` | 234 | Token prop drilling, session restore on every mount |

---

*Generated from full code review of `/commcrm` — frontend, backend, Prisma schema, and reference documents.*
