# Enterprise SaaS Gap Audit

Last reviewed: 2026-05-06

Scope reviewed: root docs, deployment files, Prisma schema, backend modules, worker source, frontend routes/components/views, and current task/audit docs. Generated folders such as `node_modules`, `.next`, `dist`, and coverage output were intentionally excluded.

## Executive Summary

The app has a strong CRM foundation: route-backed frontend pages, auth/session support, configurable fields/lists, lead CSV upload, lead detail workflow, settings modules, MCUBE telephony endpoints, connector provisions, automation, assignment, reports, workers, and Docker deployment wiring.

Tenant isolation is intentionally out of scope for this deployment model. The current hardening pass shows the main enterprise remediation items are now either implemented or explicitly blocked by external MCUBE/provider details. Remaining production risk is mostly operational validation: running the full release checklist, using real provider test credentials, and expanding browser E2E coverage as the product stabilizes.

Current status note: the detailed gap sections below are kept as the audit trail that drove the hardening work. The authoritative implementation status is `Implementation-Task-Tracker.md`, where the remediation items are marked complete or explicitly blocked. Any `Needed:` wording below should be read as the original audit finding unless the tracker still lists the item as open.

## Enterprise Hardening Status

### 1. Settings / Access Permission Enforcement

Current status: remediated in tracker.

Settings visibility is controlled by the Settings module permission, while administrator-only backend operations remain separate from normal CRM admin users. The permission template model also covers module actions and field-level visible/editable/hidden/masked rules.

### 2. Direct Automation Runner

Current status: remediated in tracker.

Direct backend runs now fail or explicitly skip unsupported nodes instead of marking placeholder success. Queued worker execution remains the recommended path for connector-heavy automation, and connector API nodes enforce HTTPS/private-network safety, timeout, retry, and logging rules.

### 3. WhatsApp and Voicebot Provider Execution

Current status: provisioned and blocked on MCUBE provider details.

The app keeps UI/API provisions for WhatsApp and voicebot, but provider execution remains blocked until MCUBE supplies final API base URLs, authentication, payloads, status mappings, and test credentials. Where provider execution is not configured, actions should surface `not_configured`, `dry_run`, or queued/provisioned states instead of false success.

Blocked inputs remain listed at the bottom of this document and in `Implementation-Task-Tracker.md`.

### 4. Upload Validation Needs Scale Hardening

Sync upload, queued upload preflight, and worker upload now use configurable mandatory rules and duplicate-key validation. Large CSV import still needs scale and resilience hardening before very large production batches.

Why this matters:
- Large imports will be slow and database-heavy.
- Retried jobs need explicit idempotency guarantees.

Needed:
- Add backend file size and row-count limits, not just Nginx limits.
- Preload branch/team mappings and existing mobile/external IDs before row processing.
- Validate dates explicitly before storing.
- Add idempotent import behavior for retried jobs.

Relevant files:
- `backend/src/uploads/uploads.service.ts`
- `workers/src/index.ts`

### 5. Production Security Needs Final Policy Hardening

Good pieces exist: JWT secret production check, httpOnly refresh flow, auth guard, redaction helpers, permissions, Redis-backed rate limiting with local fallback, timing-safe webhook secret comparison, CSRF protection for cookie-authenticated mutating requests, strict production CORS fallback, and basic security headers. Enterprise policy gaps remain.

Needed:
- Add refresh-token rotation/reuse detection policy.
- Add account lockout and suspicious-login audit events.
- Add password policy enforcement.
- Add audit for security-setting changes and admin access changes.
- Ensure API-call and connector logs never persist raw secrets.

Relevant files:
- `backend/src/common/rate-limit.ts`
- `backend/src/common/webhook-security.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/common/sensitive.ts`
- `backend/src/main.ts`

### 6. Deployment Images Are Not Production-Hardened

Dockerfiles use `npm install`, runtime images include broad dependencies, containers run as root, and service healthchecks are missing for app containers.

Needed:
- Use `npm ci`.
- Use multi-stage builds with production-only dependencies in runtime.
- Add non-root users.
- Add frontend/backend/worker healthchecks.
- Run Prisma migrations as an explicit deploy step or entrypoint strategy.
- Add `NODE_ENV=production`.
- Add resource limits/reservations.
- Decide whether Postgres/Redis should be bound to host localhost in production or be internal-only.

Relevant files:
- `frontend/Dockerfile`
- `backend/Dockerfile`
- `workers/Dockerfile`
- `docker-compose.yml`
- `VPS-to-Go-Live-Runbook.md`

### 7. Observability Is Not Enterprise-Complete

There is health checking and structured logger utilities, but workers still use `console.log/error`, there is no request correlation ID across frontend/backend/worker jobs, and no centralized metrics/tracing.

Needed:
- Add request ID middleware and propagate IDs to audit, connector events, worker jobs, and logs.
- Replace worker console logs with structured redacted logger.
- Add metrics for API latency, queue depth, job failures, upload processing, automation steps, connector failures, and telephony stream connections.
- Add alerting guidance and dashboards.
- Add retention/archival for audit logs, connector events, automation logs, and uploaded files.

Relevant files:
- `workers/src/index.ts`
- `backend/src/common/structured-logger.ts`
- `backend/src/health/health.controller.ts`

## Functional / Domain Gaps

### 8. Assignment Engine Worker and Service Differ

Current status: remediated in the 2026-05-06 maintainability pass.

The worker no longer carries assignment logic inline in `workers/src/index.ts`; it now uses `workers/src/assignment-runner.ts`. The worker assignment runner was aligned with backend behavior for team, branch, round-robin, fallback, global fallback, per-user capacity, weighted distribution, and custom-field based assignment. Backend rule evaluation helpers were extracted to `backend/src/assignment/assignment-utils.ts`, reducing duplication inside the Nest service.

The same pass also reduced the largest backend service maintainability risks by moving pure helper logic out of service classes:
- Telephony formatting, MCUBE payload normalization, template resolution, sample payloads, and popup lead select logic now live in `backend/src/telephony/telephony.utils.ts`.
- Connector variable extraction, WhatsApp status normalization, mapping, JSON conversion, opt-out parsing, and truthy helpers now live in `backend/src/connectors/connectors-utils.ts`.
- Automation workflow graph parsing, validation, node type normalization, condition evaluation, template resolution, JSON conversion, and retry sleep helpers now live in `backend/src/automation/automation-utils.ts`.

Remaining future improvement:
- If the monorepo later adds a shared package/workspace, move the pure assignment rule evaluator into that package so backend and workers import the exact same source file without weakening either build boundary.
- Keep splitting large frontend route views by page section as UI behavior stabilizes. Current frontend risk is mostly readability, not duplicated business engines.

Relevant files:
- `backend/src/assignment/assignment.service.ts`
- `backend/src/assignment/assignment-utils.ts`
- `backend/src/automation/automation.service.ts`
- `backend/src/automation/automation-utils.ts`
- `backend/src/connectors/connectors.service.ts`
- `backend/src/connectors/connectors-utils.ts`
- `backend/src/telephony/telephony.service.ts`
- `backend/src/telephony/telephony.utils.ts`
- `workers/src/assignment-runner.ts`
- `workers/src/index.ts`

### 9. Lead / User / Activity Custom Fields Are Present But Need Stronger Lifecycle UX

Custom field definitions support create/update and values, but enterprise UX needs stronger lifecycle rules.

Needed:
- Add dependency checks before deactivating/changing type.
- Add migration/impact warning for type/options changes.
- Add field-level mandatory rule preview by role/team/context.
- Add version/history for field definitions.
- Ensure all list filters/columns expose custom fields consistently.

Relevant files:
- `backend/src/custom-fields/custom-fields.service.ts`
- `frontend/src/features/crm/views/settings/SettingsFieldsPage.tsx`
- `frontend/src/features/crm/views/leads/lead-table-columns.ts`
- `frontend/src/features/crm/views/activities/activity-columns.ts`

### 10. List Values Still Have Frontend Defaults

The backend supports configurable lists, but fallback defaults still live in several frontend files.

Needed:
- Centralize list loading/caching.
- Show clear loading/error states if list configuration fails.
- Avoid hidden hardcoded fallbacks for production screens unless labeled as seed defaults.

Relevant files:
- `frontend/src/features/crm/views/SettingsView.tsx`
- `frontend/src/features/crm/views/LeadDetailView.tsx`
- `frontend/src/features/crm/views/leads/lead-table-columns.ts`
- `frontend/src/features/crm/views/activities/activity-columns.ts`

### 11. Reports Are Useful But Not Yet Enterprise Analytics

Reports summarize many modules and can export CSV, but drill-down, saved report definitions, scheduled exports, export status, and dashboard-quality analytics are still thin.

Needed:
- Add saved reports.
- Add scheduled reports.
- Add async export status and download history with clear status.
- Add report-level field permissions.
- Add date/team/status/connector filters across all report tabs consistently.
- Add click-through drilldowns from metrics to filtered list pages.

Relevant files:
- `backend/src/reports/reports.service.ts`
- `frontend/src/features/crm/views/ReportsView.tsx`

### 12. Telephony Popup And Webhooks

SSE, Redis pub/sub, presence, draggable popup, bottom-right default, cross-tab close, configurable fields/tabs, popup delivery updates, `x-webhook-secret` webhook authentication, connector-event logging, duplicate Call Log Complete updates, and mapped-field voicebot matching are implemented.

Further hardening once MCUBE final docs are available:
- Validate against exact MCUBE payload names, status values, auth rules, and retry behavior.
- Add provider-contract smoke tests for Call Route, Agent Popup, Call Log Complete, click-to-call, WhatsApp, and voicebot.
- Expand popup layout configuration if future business users need field grouping/order beyond the current configured field list and tabs.

Relevant files:
- `backend/src/telephony/telephony.service.ts`
- `frontend/src/features/crm/components/TelephonyPopupLayer.tsx`
- `frontend/src/features/crm/views/connectors/AgentPopupConfigPanel.tsx`

## Frontend / UI / Architecture Gaps

### 13. `CrmApp` Is Smaller But Still Too Much of a Data Coordinator

Routes exist, but `CrmApp` still owns route detection, selected lead, lead lists, dashboard metrics, uploads, access overview, workspace loading, and routing logic.

Needed:
- Make `CrmApp` a pure authenticated shell/session provider.
- Move each route’s data loading to the route view or a route-specific hook.
- Add stale/retry/cache behavior per route.
- Avoid loading dashboard/report/access data from shared shell paths.

Relevant files:
- `frontend/src/features/crm/CrmApp.tsx`
- `frontend/src/features/crm/CrmRoute.tsx`

### 14. Large Frontend Views Still Need Further Split

Some views remain large and hard to maintain.

Needed:
- Split `ConnectorsView` into `ApiCallConnectorPanel`, `WhatsAppConnectorPanel`, `VoicebotConnectorPanel`, `ConnectorLogsPanel`, and shared connector dialogs.
- Split `SettingsView` further so route-section pages own their own data/loading/mutations.
- Split `ReportsView` into report tabs, report cards, filters, and export history components.
- Split lead detail activity/task/disposition creation into dialogs instead of inline sections.

Relevant files:
- `frontend/src/features/crm/views/ConnectorsView.tsx`
- `frontend/src/features/crm/views/SettingsView.tsx`
- `frontend/src/features/crm/views/ReportsView.tsx`
- `frontend/src/features/crm/views/lead-detail/LeadDetailTabs.tsx`

### 15. UI Reference Discipline Is Partial

The app has shared buttons/chips/tables, but many screens still use collapsible sections, dense inline forms, and inconsistent page patterns.

Needed:
- Settings should follow the reference-style route layout: left settings nav, focused content panel, top-right create action, table/empty state, and modal create/edit.
- Use dialogs for add/edit flows everywhere instead of inline forms.
- Remove or minimize collapsible sections where they hide essential workflows.
- Add consistent empty/error/loading states in every table and settings section.
- Add keyboard/focus states and accessible labels.

Relevant files:
- `frontend/src/components/common/*`
- `frontend/src/features/crm/views/settings/*`
- `frontend/src/features/crm/views/users/*`
- `frontend/src/features/crm/views/connectors/*`

### 16. Type Safety Still Has Flexible Connector Boundaries

Strict TS is enabled and most route/view models now use typed or normalized API shapes. Some flexible boundaries remain intentionally loose where external provider payloads are not finalized, especially connector payloads and worker automation node data.

Needed:
- Continue replacing broad `any` in areas with stable internal contracts.
- Keep provider payloads flexible until MCUBE WhatsApp/voicebot contracts are shared, then replace them with typed schemas.
- Add Zod or equivalent runtime validation at API boundaries if desired.
- Make field metadata typed by module.

Relevant files:
- `frontend/src/features/crm/views/*`
- `workers/src/index.ts`
- `backend/src/reports/reports.service.ts`

## Database / Data Lifecycle Gaps

### 17. Missing Relational Constraints in Several Models

Some fields store IDs but are not foreign-key relations, for example assigned users/teams, connector IDs in WhatsApp/Voicebot entities, uploadedBy, changedBy, and several run/log references.

Needed:
- Add foreign keys where safe.
- For external/system IDs, document why no FK exists.
- Add indexes for common filters: connector events by createdAt/status, audit by createdAt/changedBy, upload rows by createdAt, tasks by dueDate, activities by createdAt.
- Add retention policy and archival.

Relevant file:
- `backend/prisma/schema.prisma`

### 18. Audit and Compliance Need Strengthening

Audit exists, and Ops actions intentionally should not be audited per requirement. Enterprise SaaS still needs broader audit coverage.

Needed:
- Audit permission template changes, field permission changes, connector secret/config changes, security/2FA changes, export downloads, failed login attempts, password reset events, and bulk operations.
- Mask sensitive values in audit old/new payloads.
- Add immutable audit retention policy.

Relevant files:
- `backend/src/audit/audit.service.ts`
- `backend/src/access/access.service.ts`
- `backend/src/settings/settings.service.ts`
- `backend/src/connectors/connectors.service.ts`

## Testing / Quality Gaps

### 19. Smoke Coverage Exists But Full Enterprise Test Coverage Is Missing

There are integration/deep-remediation smoke scripts, but critical workflows need automated coverage.

Needed:
- Unit tests for phone normalization, CSV parser, upload validation, field permissions, assignment conditions, automation graph traversal, API-call safety, webhook security, and list-value behavior.
- Integration tests for login/refresh/logout, lead CRUD, CSV import worker, telephony popup SSE, WhatsApp webhook, voicebot webhook, connector CRUD, reports export/download.
- Frontend tests for settings CRUD dialogs, table filtering/columns, lead detail tabs, upload flow, telephony popup, automation editor.
- E2E tests for administrator and sales-user permission differences.

Relevant files:
- `backend/test/*`
- no current frontend test setup found.

## Deployment / Operations Gaps

### 20. Production Runbook Is Strong But Needs Operational Checks

Runbook covers VPS, Docker, Nginx, SSL, backups, restore, and checks. Enterprise readiness needs more.

Needed:
- Add a release checklist with migration backup, smoke tests, rollback commands, and queue drain checks.
- Add worker queue consumption test after deploy, not just heartbeat.
- Add Redis/Postgres resource and backup monitoring.
- Add disaster recovery RPO/RTO target.
- Add off-server backups as production requirement.
- Add secrets rotation procedure.

Relevant file:
- `VPS-to-Go-Live-Runbook.md`

## Blocked by External Inputs

These remain valid blockers:
- MCUBE technical documentation.
- MCUBE test credentials.
- MCUBE telephony test credentials and any provider-specific payload differences not covered by shared samples.
- MCUBE WhatsApp send/template API details.
- MCUBE WhatsApp status/reply webhook payloads.
- MCUBE voicebot trigger API details.
- MCUBE voicebot result webhook payloads.
- Final CSV upload field list and final mandatory/optional rules.
- Final lead status/category/disposition configuration values if seed lists change.

## Recommended Priority Order

1. Validate the current release against real local/prod-like admin credentials and provider test credentials.
2. Mark WhatsApp/voicebot provider execution as blocked/provisioned until MCUBE details arrive; prevent false sent/success states.
3. Optimize large CSV processing and add explicit idempotency for retried jobs.
4. Align automation direct runner and worker runner where any remaining fallback logic diverges.
5. Continue moving `CrmApp` toward a pure authenticated shell and move remaining route data loading into route views.
6. Continue Settings UI polish with reference-style modal flows where inline forms remain.
7. Add enterprise test coverage and CI checks.
8. Harden Dockerfiles/compose and add production observability.
9. Add retention, archival, audit, export, and disaster recovery policies.
