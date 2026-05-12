# AUDIT_01_STACK.md — Phase 1 Discovery

> Generated: 2026-05-08  
> Auditor: Claude Code (claude-sonnet-4-6)

---

## 1. Frontend

### 1.1 Framework
- **Next.js 16.2.4** (React 19.2.5) — **App Router** exclusively
- Every route file is `'use client'` — there is no server-side rendering or server components in use. The entire app is a client-side SPA wrapped in Next.js routing shell.
- Standalone output mode (`output: 'standalone'` in `next.config.mjs`)
- Turbopack configured for dev builds

### 1.2 Language
**TypeScript** throughout. `tsconfig.json` present. CI runs `npm run typecheck`.

### 1.3 UI Library / Styling
- **Material-UI v7.3.10** (`@mui/material`, `@mui/icons-material`, `@mui/x-data-grid`) with Emotion (`@emotion/react`, `@emotion/styled`)
- `@mui/material-nextjs` for App Router cache provider integration
- Custom MUI theme in `frontend/src/theme/theme.ts` — green (`#2d6a2d`) brand colour
- **No Tailwind, no shadcn/ui, no custom CSS files**
- CSS custom properties (`--g50..--g900`, `--crm-*`, `--s-*-bg/fg/dot`, `--radius-*`) defined in `MuiCssBaseline` global override
- **ReactFlow 11.11.4** — automation workflow canvas
- **Recharts 2.13.0** — report charts

### 1.4 Component Library Inventory

All reusable components live in `frontend/src/components/`.

| Component | Location | Purpose | Notes |
|---|---|---|---|
| `LoginScreen` | `auth/LoginScreen.tsx` | Full auth flow (password, OTP, reset) | |
| `CrmShell` | `layout/CrmShell.tsx` | App shell: sidebar + topbar + mobile drawer | 349 lines |
| `SettingsSidebar` | `settings/SettingsSidebar.tsx` | Settings section nav (replaced by `SettingsFrame`) | May be dead code |
| `AdvancedFilterBuilder` | `common/` | Multi-condition filter rows with field-aware operators | |
| `AppButton` | `common/` | Thin MUI Button wrapper | **Near-duplicate of `CapsuleButton`** |
| `AppChip` | `common/` | Thin MUI Chip wrapper | |
| `CapsuleButton` | `common/` | Primary action button (pill-shaped, slightly larger) | **Near-duplicate of `AppButton`** |
| `CompactDataTable` | `common/` | Paginated table with row selection + bulk actions | 143 lines |
| `ConfirmDialog` | `common/` | Confirmation modal for destructive actions | |
| `FieldSelector` | `common/` | Column visibility dropdown | |
| `FilterDialog` | `common/` | Modal wrapper for filter forms (Apply/Reset/Cancel) | **Partially duplicates `FormDialog`** |
| `FormDialog` | `common/` | Generic modal with arbitrary action buttons | **Partially duplicates `FilterDialog`** |
| `MessageAlert` | `common/` | Inline `<Alert>` wrapper (null-safe) | |
| `MetaChip` | `common/` | Small metadata badge | |
| `PageHeader` | `common/` | Title + subtitle + action buttons | |
| `RouteState` | `common/` | Loading/error/empty-state container | Appears unused in views — views implement their own states inline |
| `RowActionMenu` | `common/` | Per-row kebab actions menu | Appears unused — views use local `LeadRowActionsMenu` inline components |
| `SectionCard` | `common/` | Styled Card wrapper | |
| `StatusChip` | `common/` | Colour-coded status badge | |
| `TableToolbar` | `common/` | Above-table toolbar (column control + actions) | |
| `ToastProvider` | `common/` | Global toast snackbar system (`useToast` hook) | |
| `TrendChip` | `common/` | Up/down/neutral trend indicator | |
| `WorkspacePrimitives` | `common/` | Barrel export: `ModuleShell`, `SectionPanel`, `PageFilterBar`, `FilterPill`, `SegmentedTabs` | |

**Duplicates / near-duplicates to note:**
- `AppButton` vs `CapsuleButton` — both wrap MUI Button with slightly different default style; usage is inconsistent across views (some pages use `CapsuleButton`, some mix both)
- `FilterDialog` vs `FormDialog` — nearly identical structure; `FilterDialog` just has a fixed Reset/Cancel/Apply pattern hardwired
- `RouteState` and `RowActionMenu` are defined but effectively unused (views implement equivalent patterns inline, see Section 6)

### 1.5 State Management
**None** — pure React state only (`useState`, `useEffect`, `useCallback`, `useMemo`). No React Query, Redux, Zustand, or Context beyond the MUI ThemeProvider. All data fetching is manual `useEffect` + `useState` in each view component.

### 1.6 Frontend ↔ Backend Communication
- Custom `apiRequest<T>` function in `frontend/src/lib/api.ts` wrapping native `fetch`
- Base URL: `NEXT_PUBLIC_API_URL` env var (fallback `http://127.0.0.1:4000` in dev, throws in prod if missing)
- Auth: `Authorization: Bearer <token>` header; token sourced from `sessionStorage`
- CSRF: reads `unnatify_csrf_token` cookie, adds `x-csrf-token` header on non-GET requests
- Credentials: `credentials: 'include'` on every request (sends cookies)
- No caching layer; every mount triggers a fresh fetch

### 1.7 Auth (Frontend)
- JWT access token stored in `sessionStorage` (key: `unnatify_access_token`)
- Refresh token: stored in `localStorage` originally but `storeAuthTokens()` now removes it — refresh is cookie-only
- Session restore in `CrmApp` `useEffect`: tries stored token → `/auth/me` → `/auth/refresh` cookie
- Redirect to `/login` if no session. Redirect to first permitted view if current view is not permitted.
- Module-level permission checks: `effectivePermissions` fetched from `/access/users/:id/effective-permissions`, cached in module-level variable `permissionCache` (resets on logout)

---

## 2. Backend

### 2.1 Framework
**NestJS 11.1.19** (`@nestjs/platform-express` — Express adapter)

### 2.2 Language / Entry Point / Route Registration
- **TypeScript** (`ts-node-dev` in dev, compiled to `dist/` for prod)
- Entry: `backend/src/main.ts` → `bootstrap()` → `NestFactory.create(AppModule)`
- Routes registered via NestJS `@Controller(prefix)` + HTTP method decorators in each module
- No API prefix (`/api/v1`) — routes mount at root: `/leads`, `/auth`, `/tasks`, etc.
- `AppModule` (`app.module.ts`) imports 19 modules

### 2.3 Auth/Session Strategy
- **JWT** (`@nestjs/jwt`): access token (default 8h), refresh token stored as bcrypt hash in `AuthSession` DB table
- Cookies: `unnatify_access_token` (httpOnly, Lax), `unnatify_refresh_token` (httpOnly, Lax), `unnatify_csrf_token` (NOT httpOnly, Strict) — frontend reads the CSRF cookie for the `x-csrf-token` header
- `JwtAuthGuard` verifies Bearer token on protected routes; `OpsGuard` (separate) for `/ops/*`
- Account lockout: configurable login failure limit + lock duration (env vars)
- Email OTP: optional 2FA on login (env `EMAIL_OTP_ENABLED`)
- Password reset: token-based (sent via Resend API when configured)

### 2.4 Database Connection
- **Prisma v5.20.0** with PostgreSQL 16
- `PrismaService` extends `PrismaClient`, implements `OnModuleInit`/`OnModuleDestroy`
- Single `PrismaModule` (global) — no connection pooling configuration beyond Prisma's default pool
- No explicit `DATABASE_URL` connection pool params in `.env.example` (PgBouncer or similar not configured)

### 2.5 Backend ↔ Runner Communication
- **BullMQ** + Redis: backend enqueues jobs by creating `Queue` instances with `REDIS_URL`
- Queues: `lead-upload`, `whatsapp-send`, `whatsapp-webhook`, `voicebot-trigger`, `voicebot-webhook`, `telephony-webhook`, `automation`, `automation-delayed`, `offer-expiry`, `assignment`, `connector-retry`
- No direct HTTP calls between backend and workers — pure Redis/BullMQ

---

## 3. Runner (Workers)

### 3.1 Queue Technology
**BullMQ 5.12.12** + **Redis 7**

### 3.2 Jobs Processed

| Queue | Job Name | What It Does |
|---|---|---|
| `lead-upload` | `lead-upload.process` | CSV row validation + lead upsert |
| `whatsapp-send` | `whatsapp.send` | Outbound WhatsApp message dispatch |
| `whatsapp-webhook` | `whatsapp.webhook` | Ingest + normalise inbound WA payloads |
| `voicebot-trigger` | `voicebot.trigger` | Fire voicebot API call for a lead |
| `voicebot-webhook` | `voicebot.webhook` | Ingest + normalise voicebot webhook |
| `telephony-webhook` | `telephony.webhook` | Process telephony call events |
| `automation` | `automation.run-step` | Execute automation workflow step |
| `automation-delayed` | `automation.delayed` | Delayed automation step (wait nodes) |
| `offer-expiry` | `offer-expiry.check` | Expire offers past their expiry date |
| `assignment` | `assignment.run` | Run lead assignment rule engine |
| `connector-retry` | `connector.retry` | Retry failed connector events |

### 3.3 Start / Scale / Failure Handling
- **Start**: `workers/src/index.ts` creates one `Worker` per queue name via BullMQ; started via `npm run dev` (ts-node-dev) or `npm run start` (compiled)
- **Concurrency**: configurable via env vars (`LEAD_UPLOAD_CONCURRENCY`, etc.); defaults: 5 for automation queues, 2 for all others
- **Heartbeat**: `setInterval(30s)` writes to Redis keys `health:workers:<queueName>` with TTL 120s; backend `/health/workers` reads these
- **Failure handling**: `worker.on('failed')` logs error; if `attemptsMade >= attempts`, pushes job to `dead-letter` queue
- **Dead-letter queue**: monitored every 30s; depth logged as warning if non-empty
- **Graceful shutdown**: SIGTERM/SIGINT handlers call `worker.close()` with 30s timeout; disconnects Redis + Prisma
- **Missing**: no `attempts` / `backoff` configuration visible in the job creation calls — needs verification in service files

---

## 4. Database

### 4.1 Data Model Summary (Prisma Schema)

The schema has **38 models** (1,039 lines). Key entities:

- **Users & Access**: `User` → `Role`, `Team`, `SalesGroup` (via `UserSalesGroup`), `PermissionTemplate` (module + field level); `AuthSession` for refresh-token storage
- **Leads**: `Lead` (core entity with 23 fields + `customValues` via `LeadCustomFieldValue`); `LeadUploadBatch` / `LeadUploadRow` for CSV imports; `LeadStatusHistory` for change tracking; `LeadAssignment` log
- **Activities & Tasks**: `Activity` (type-coded, with `ActivityCustomFieldValue`); `Task` + `TaskComment`
- **Custom Fields**: `FieldDefinition`, `LeadCustomField`, `UserCustomField`, `ActivityCustomField`, `FieldMandatoryRule`, `CustomFieldDefinitionHistory`
- **Connectors**: `Connector` (generic); `WhatsAppConnector`, `WhatsAppNumber`, `WhatsAppTemplate`, `WhatsAppConversation`, `WhatsAppMessage`, `WhatsAppQuickReply`; `VoicebotConnector`, `VoicebotTriggerTemplate`, `VoicebotTriggerVariable`, `VoicebotWebhookMapping`, `VoicebotCall`; `TelephonyCall`, `TelephonyRouteRequest`, `TelephonyAgentPopupEvent`, `TelephonyCallLogEvent`; `ConnectorEvent`
- **Automation**: `AutomationWorkflow`, `AutomationWorkflowVersion`, `AutomationRun`, `AutomationRunStep`, `AutomationScheduledJob`, `AutomationExitCondition`, `AutomationApiCallLog`
- **Assignment**: `AssignmentRule`, `AssignmentRuleCondition`, `AssignmentRuleAction`, `AssignmentRuleRun`, `AssignmentRuleRunLog`
- **Files & Reports**: `UploadedFile`; `SavedReport`, `ScheduledReport`, `ReportExport`; `SavedLeadView`
- **Config & Audit**: `AppSetting` (key-value store for all settings), `AuditLog`, `SystemLog`

### 4.2 Migrations

12 migrations in `backend/prisma/migrations/`:

| Migration | Date | Description |
|---|---|---|
| `20260428190858_init` | 2026-04-28 | Initial schema |
| `20260429121500_add_auth_sessions` | 2026-04-29 | `AuthSession` table |
| `20260429162000_add_custom_field_rules` | 2026-04-29 | `FieldMandatoryRule` |
| `20260430120000_add_production_query_indexes` | 2026-04-30 | Performance indexes |
| `20260430143000_activity_type_codes` | 2026-04-30 | `ActivityCustomField.activityTypeCode` |
| `20260430150000_telephony_activity_type_codes` | 2026-04-30 | Telephony type codes |
| `20260504183000_add_audit_request_id` | 2026-05-04 | `AuditLog.requestId` |
| `20260504190000_add_custom_field_definition_history` | 2026-05-04 | `CustomFieldDefinitionHistory` |
| `20260504194500_add_report_saved_schedules_exports` | 2026-05-04 | Reports tables |
| `20260504200000_add_enterprise_query_indexes` | 2026-05-04 | Additional indexes |
| `20260505110000_activity_custom_fields_by_type` | 2026-05-05 | Activity type-specific fields |
| `20260507120000_add_saved_lead_views` | 2026-05-07 | `SavedLeadView` table |

**Consistency assessment**: The schema and migrations appear internally consistent — the schema reflects the accumulated state of all migrations. No schema drift detected from reading both files.

---

## 5. Repo Hygiene

### 5.1 Package Scripts

**Root** (`package.json`): npm workspaces — `build`, `typecheck`, `lint`, `seed`, `prisma:*` delegates to workspaces

**Frontend** (`frontend/package.json`):
| Script | Command |
|---|---|
| `dev` | `next dev -H 127.0.0.1 -p 3000` |
| `build` | `next build` |
| `start` | `next start -H 127.0.0.1 -p 3000` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test:architecture` | `node test/architecture-smoke.mjs` |

**Backend** (`backend/package.json`):
| Script | Command |
|---|---|
| `dev` | `ts-node-dev --respawn --transpile-only src/main.ts` |
| `build` | `tsc -p tsconfig.build.json` |
| `start` | `node dist/main.js` |
| `lint` / `typecheck` | `tsc --noEmit` |
| `test:unit` | `ts-node test/unit.ts` |
| `test:integration` | `ts-node test/integration-smoke.ts` |
| `test:deep-remediation` | `ts-node test/deep-remediation-smoke.ts` |
| `test:enterprise-parity` | `ts-node test/enterprise-parity-smoke.ts` |
| `prisma:generate` / `migrate` / `deploy` / `status` | Prisma CLI |
| `seed` | `ts-node prisma/seed.ts` |

**Workers** (`workers/package.json`):
| Script | Command |
|---|---|
| `dev` | `ts-node-dev --respawn --transpile-only src/index.ts` |
| `build` / `start` / `lint` / `typecheck` | standard |

**Observations:**
- No `test:watch` scripts anywhere
- Backend lint is just `tsc --noEmit` (not ESLint) — static analysis only, no style enforcement for backend
- Workers have no tests at all

### 5.2 `.env.example`
**Present and comprehensive** at repo root. Covers:
- DB + Redis connection strings
- JWT secrets + expiry
- Login lockout config
- CORS origins
- Upload dir, log dir, log level
- Retention periods for all data types
- Resend email config (marked optional)
- MCube telephony, WhatsApp, Voicebot webhook secrets
- OPS login config
- Smoke test credentials

**Gaps:**
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` present but no documentation of where to get them
- `OPS_PASSWORD_HASH` — no helper script to generate it
- Connector provider URLs and API keys are configured in Settings > Connectors; keep deployment docs aligned with that UI flow
- Worker-specific env vars not shown (e.g., `*_CONCURRENCY` settings)

### 5.3 Docker / Deployment
**docker-compose.yml** at root: 5 services
- `frontend` (port 3000, mem 512m)
- `backend` (port 4000, healthcheck on `/health/db` + `/health/redis`, mem 1g)
- `workers` (no ports, depends on postgres+redis, mem 1g)
- `postgres:16` (healthcheck `pg_isready`, persistent volume)
- `redis:7` (AOF persistence, maxmemory 1gb LRU, persistent volume)

All ports bound to `127.0.0.1` — assumes reverse proxy (nginx/caddy) in front. Volumes mounted to `/opt/unnatify-crm/uploads` and `/opt/unnatify-crm/logs` on host.

**Dockerfiles**: present in `frontend/`, `backend/`, `workers/`. Not read in full but referenced in CI (`docker compose build --pull`).

**Workers service has no healthcheck** in docker-compose. Backend depends on postgres+redis health but not worker health.

### 5.4 Lint / Format / Test
- **Frontend**: ESLint (`eslint-config-next`); TypeScript strict mode
- **Backend**: TypeScript only (no ESLint configured for backend)
- **Workers**: TypeScript only
- **No Prettier** configured in any package
- **No Jest / Vitest**: backend tests are custom `ts-node` smoke scripts; no unit test framework
- **No Playwright / Cypress**: no e2e tests
- CI runs all smoke scripts plus `npm audit --audit-level=high`

### 5.5 CI Config
`.github/workflows/ci.yml` — single job `validate` running on all PRs and pushes to `main/master`:
1. Checkout + Node 22 setup
2. `npm ci` → `prisma:generate` → `prisma:deploy` → seed
3. `typecheck` + `lint`
4. Backend unit + integration + deep-remediation + enterprise-parity smoke tests
5. Start backend, run smoke tests
6. Frontend architecture smoke
7. Full build + Docker build
8. `npm audit --audit-level=high`

**Observations**: CI is solid. Docker build check is good. Dependency audit present. However: no e2e UI tests, no test coverage report.

---

## 6. UI Inventory

### 6.1 Routes + Pages

| Route | View Key | What it shows | Primary actions | Key API calls | Key components |
|---|---|---|---|---|---|
| `/` | leads | Leads list (redirects to `/leads`) | — | — | `CrmRoute` → `CrmApp` |
| `/leads` | leads | Full leads list, filters, saved views | Add Lead, Export CSV, Bulk assign/status | `GET /leads`, `GET /leads/saved-views`, `GET /custom-fields/definitions`, `GET /settings/lead-lists`, `GET /access/overview` | `LeadsView`, `LeadTable`, `LeadFilters`, `LeadAdvancedFilters`, `LeadCreatePanel` |
| `/leads/:id` | lead-detail | Lead profile + tabbed detail (Activities, Tasks, Calls, Automation, Audit) | Call, Change Owner, Add Activity, Disposition | `GET /leads/:id`, `GET /activities`, `GET /tasks`, `GET /audit-logs`, `GET /custom-fields/definitions`, `GET /settings/disposition-form`, `GET /settings/activity-types` | `LeadDetailView`, `LeadDetailTabs`, `LeadProfileCard` |
| `/dashboard` | dashboard | Metric cards, recent leads table, automation runs, connector status, priority tasks | Navigate to modules | `GET /dashboard/overview` | `DashboardView`, `CompactDataTable`, `MetaChip`, `StatusChip` |
| `/activities` | activities | Global activities list (all leads) | Filter by type/lead | `GET /activities` | `ActivitiesView` |
| `/tasks` | tasks | Task board (Today/Tomorrow/Week/Done) or list or calendar | Create Task, bulk status update | `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `GET /access/overview`, `GET /settings/task-lists`, `GET /leads` | `TasksView`, `CompactDataTable`, `AdvancedFilterBuilder` |
| `/automation` | automation | Workflow list + ReactFlow canvas editor | Create workflow, deploy version | `GET /automation/workflows`, etc. | `AutomationView`, `AutomationList`, `AutomationCanvas`, `AutomationEditor`, `NodeInspector`, `NodePalette`, `RunHistory`, `AutomationMetrics`, `AssignmentEnginePanel` |
| `/reports` | reports | Multi-tab report viewer with charts | Export CSV, save/schedule report | `GET /reports/overview`, `GET /reports/drilldown`, `GET /reports/saved`, etc. | `ReportsView`, `ReportSummaryTab`, `ReportJourneyTab`, `ReportCommunicationsTab`, `ReportAutomationTab`, `ReportAuditTab`, `ReportSavedTab` |
| `/uploads` | uploads | CSV upload history + upload form | Upload CSV, view/download results | `GET /uploads`, `POST /uploads/csv`, `GET /uploads/:id` | `UploadsView` |
| `/settings/users` | settings (access tab) | Users, Roles, Teams, Sales Groups, Permission Templates | CRUD all access entities | many `/access/*` routes | `SettingsView` → `UsersView` |
| `/settings/fields` | settings (fields tab) | Custom fields, disposition form, mandatory rules, CSV config | CRUD all field config | `/custom-fields/*`, `/settings/disposition-form`, `/settings/mandatory-rules`, `/settings/csv-upload-config` | `SettingsFieldsPage` |
| `/settings/connectors` | settings (connectors tab) | WhatsApp, Voicebot, Telephony, API call connectors | CRUD all connectors | many `/connectors/*` routes | `ConnectorsView` |
| `/settings/activity-types` | settings (activity-types tab) | Activity type config | Create/update/deactivate types | `/settings/activity-types` | `SettingsActivityTypesPage` |
| `/settings/lists` | settings (lists tab) | Lead status/category/disposition lists + task lists | Save list values | `/settings/lead-lists/*`, `/settings/task-lists/*` | `SettingsListsPage` |
| `/settings/security` | settings (security tab) | 2FA account toggle + per-user overrides | Toggle 2FA | `/settings/security/*` | `SettingsSecurityPage` |
| `/settings/uploads` | settings (uploads tab) | Upload batch history + issue reports | Download CSVs | `/uploads`, `/uploads/:id` | `SettingsUploadHistoryPage` |
| `/login` | — | Login screen (password + OTP step + password reset) | Login | `POST /auth/login`, `/auth/login/email-otp/verify`, `/auth/password-reset/*` | `LoginScreen` |
| `/ops-login` | — | Internal operations center (DB viewer, queue monitor, log viewer) | Ops login, health/logs/DB/queues/files | `/ops/*` | Inline in page component |
| `/connectors` | — | Redirect only → `/settings/connectors` | — | — | — |

### 6.2 Design Tokens

Tokens **are** defined as CSS custom properties via `MuiCssBaseline` overrides in `theme.ts`:

**Green colour scale** (`--g50` … `--g900`):
```
--g50: #eef7ee  (lightest)
--g900: #162716 (darkest / page background text)
```

**Semantic colour tokens:**
| Token | Value | Used for |
|---|---|---|
| `--crm-border` | `#e0ede0` | Card/section borders |
| `--crm-bg` | `#f8fcf8` | Page background |
| `--crm-sidebar` | `#162716` | Sidebar background |
| `--crm-primary` | `#2d6a2d` | Primary green |
| `--crm-paper` | `#ffffff` | Card surface |
| `--crm-paper-soft` | `#fafdfa` | Slightly off-white surface |
| `--crm-soft` | `#eef7ee` | Light green tint |
| `--crm-muted` | `#526252` | Secondary text |
| `--crm-border-strong` | `#cfe1cf` | Strong borders |

**Status tokens** (for StatusChip):
```
--s-new-bg/fg/dot    green
--s-asg-bg/fg/dot    blue
--s-prog-bg/fg/dot   amber
--s-conv-bg/fg/dot   green
--s-lost-bg/fg/dot   red
--status-slate-*     slate
--status-amber-*     amber
--status-rose-*      rose
```

**Radius tokens:**
```
--radius-sm: 4px
--radius-md: 8px
--radius-pill: 9999px
```

**Missing tokens:** No spacing scale (all spacing uses MUI `spacing(n)` or raw MUI `sx` units like `1.25`, `0.75`). No font-size scale tokens (inline `fontSize: 13`, `12`, `11` throughout components). No shadow scale tokens (inline `boxShadow` strings repeated across components).

**Token usage problem:** Despite the CSS vars being defined, most view components use **raw hex values** directly:
- `DashboardView.tsx:18` — `const green = '#2d6a2d'`
- `TasksView.tsx:35` — `const green = '#2d6a2d'`
- `LeadDetailView.tsx:31` — `const green = '#2d6a2d'`
- `CrmShell.tsx:55-60` — multiple raw hex constants
- Many `sx={{ bgcolor: '#eef7ee', ... }}` inline throughout

This means the theme is only partially used — the design system foundation is there but views bypass it.

### 6.3 Page Layout Descriptions (screenshot-equivalent)

**`/leads`** — Full-width module inside shell. Header row: "Leads" title (34px bold) left, action buttons right (saved view selector dropdown, Save View button, column picker, Export CSV capsule, Add Lead green capsule). Filter bar below: search field, status dropdown, category dropdown, branch dropdown, sort label, "Filters" button (opens advanced filter dialog), result range label. Below that: compact data table with checkboxes, configurable columns, pagination, bulk action bar when selected. "Add Lead" opens a right-panel drawer. Overall density: very compact, information-dense.

**`/leads/:id`** — Three-column layout on XL screens (360px | flexible | 292px), two columns on LG, single column on XS. Top: back arrow button left, action buttons right (Call, Change Owner, Activity, Disposition). Profile card on left: avatar + name + key fields in a structured grid. Center: tabbed card (Activities tab selected by default), tab header with count labels. Right column (XL only): "Next Tasks" and "Recent Activity" mini-cards with overflow hidden on smaller screens. Tab content areas contain forms + item lists.

**`/dashboard`** — Full-width inside shell. Two-column layout on XL (main | 330px priority tasks panel). Main card: "Dashboard Overview" header + "Updated X:XX" meta chip, then metric cards grid (3-wide on XL, 2-wide on SM, 1-wide on XS). Below main card: quick action tiles row (2–4 columns). Then "Recent Leads" table section (full-width), then "Automation Runs" + "Connector Status" side-by-side below.

**`/tasks`** — Module shell. Header with Board/List/Calendar segmented control + Create Task button. Filter bar with search, status dropdown, filter pills. Blue info banner for urgent task count. Four metric cards row. Board: 4 kanban columns (Today, Tomorrow, This Week, Done) each with TaskBoardCard items. List: CompactDataTable with column picker. Calendar: identical to board but labelled.

**`/automation`** — Two-panel layout. Left: workflow list (AutomationList) with cards per workflow + create button. Right: either AutomationCanvas (ReactFlow full-screen canvas with NodePalette, NodeInspector, RunHistory) or AssignmentEnginePanel or AutomationMetrics. Visually the most complex view in the app.

**`/reports`** — Header with filter panel toggle + export button. Six tabs: Summary (metric grid + bar chart), Journey (funnel), Communications (WhatsApp/voicebot stats), Automation (run charts), Audit (log table), Saved (saved/scheduled reports list). Filter panel slides in from the right with date range + dimension filters.

**`/settings/*`** — Left sidebar (SettingsFrame) with 7 navigation items. Right content panel switches based on active tab. Each tab is its own full page component. All settings pages follow a consistent pattern: section card + form row + table below for existing items.

**`/login`** — Centered card on `#f8fcf8` background. Unnatify logo + "Sign in" heading. Email field → password field → Login button. "Forgot password?" link. On OTP step: email + 6-digit OTP field + "Verify" button. Minimal, clean.

**`/ops-login`** — Plain card (920px max-width). Before login: email + password + Login button. After login: 4 action buttons (Health, Logs, DB Tables, Queues) + file path field + DB table selector + "View File"/"View Table" buttons. Large read-only JSON textarea below. Developer-only tool, not user-facing.

---

## Open Questions (Phase 1)

1. **`SettingsSidebar` component** (`settings/SettingsSidebar.tsx`) — is it used anywhere, or is `SettingsFrame` the active implementation? Appears to be unused dead code.
2. **`RouteState` component** — defined but no usage found in any view. Dead code?
3. **`RowActionMenu` component** — views define their own inline action menus rather than using this shared component. Dead code?
4. **No Prisma connection pool config** — default Prisma pool is 5 connections; under load this may be insufficient. Is PgBouncer used in production?
5. **Workers `attempts` / `backoff`** — job retry policy not visible from `workers/src/index.ts`. Are retries configured in the enqueue calls in backend services?
6. **`/connectors/telephony/click-to-call`** — called from both `LeadsView` and `LeadDetailView`, but not visible in the `connectors.controller.ts` reviewed. Needs verification — may be in a sub-controller.
7. **`/dashboard/overview`** — the `dashboard.controller.ts` was not read; assumed to exist from `DashboardView.tsx:263` call `GET /dashboard/overview`.
8. **`/automation/workflows`** — the automation controller was not read; route structure assumed from `AutomationView` usage.
9. The user described the third folder as `runner` but the actual folder is named `workers`. No `runner/` folder exists.
