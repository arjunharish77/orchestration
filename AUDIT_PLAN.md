# Unnatify CRM — Production Readiness Audit Plan

> **Source of truth** for all remaining work to move the CRM from "functionally complete" to "production-hardened."
> Execute phases in strict order. Each phase must pass `npm run typecheck && npm run build` before moving on.

---

## How to Read This Plan

- **✅ Done** — Implemented and verified in current codebase.
- **🔧 Action Required** — Concrete code change needed.
- **⚠️ Risk** — Explains *why* this matters if skipped.

---

## Phase 0: Pre-Flight Validation ✅

All pre-flight checks pass: typecheck, build, Prisma generate.

---

## Phase 1: Security & Data Integrity ✅

| # | Item | Status |
|---|------|--------|
| 1.1 | Leaked API Key | 🔧 Manual — rotate in Resend dashboard |
| 1.2 | MCUBE Webhook Secret | 🔧 Manual — document production secret |
| 1.3 | Redis `noeviction` → `allkeys-lru` | ✅ FIXED |
| 1.4 | Auth Guard Coverage | ✅ VERIFIED |
| 1.5 | Timing-safe Webhook Comparison | ✅ VERIFIED |
| 1.6 | JWT Secret Validation | ✅ VERIFIED |
| 1.7 | Session Revocation on Password Reset | ✅ FIXED |
| 1.8 | Redis Connection Leak → Singleton | ✅ FIXED |
| 1.9 | Bulk Operations Transaction | ✅ VERIFIED |
| 1.10 | CSRF Cookie Security (timing-safe + SameSite=Strict) | ✅ FIXED |
| 1.11 | CSP Compatibility | ✅ VERIFIED |

---

## Phase 2: Performance & Scalability ✅

| # | Item | Status |
|---|------|--------|
| 2.1 | Dashboard Redis Cache (45s TTL) | ✅ FIXED |
| 2.2 | Dashboard Visibility Subquery Optimization | ✅ FIXED — removed 10K ID fetch, uses composed WHERE |
| 2.3 | Extract `leads.service.ts` (50KB) | ✅ FIXED — split into leads.filters.ts (filter/query building), leads.export.ts (CSV export), leads.views.ts (saved views) |
| 2.4 | Extract `workers/index.ts` (60KB) | ✅ FIXED — split into processors/ (automation, lead-upload, whatsapp, voicebot, telephony, offers, connector), context.ts, logger.ts, utils.ts |
| 2.5 | Database Index Audit | ✅ VERIFIED |
| 2.6 | Pagination Safety | ✅ VERIFIED |

---

## Phase 3: Backend Code Quality ✅

| # | Item | Status |
|---|------|--------|
| 3.1 | Remove `any` types — workers + leads | ✅ FIXED — 0 explicit `any` remaining |
| 3.3 | Prisma Cascade Rules (8 relations) | ✅ FIXED |
| 3.4 | Deduplicate `requiredEnv` | ✅ FIXED — extracted to workers/src/env.ts, removed local copy from index.ts |
| 3.5 | Build Configs | ✅ VERIFIED |
| 3.6 | ParseUUIDPipe | 🔧 Deprioritized |
| 3.7 | Health Endpoint Auth-Free | ✅ VERIFIED |

---

## Phase 4: Worker & Queue Hardening ✅

| # | Item | Status |
|---|------|--------|
| 4.1 | Graceful Shutdown Timeout (30s) | ✅ FIXED |
| 4.2 | Dead Letter Queue Monitoring | ✅ FIXED — heartbeat cycle logs DLQ depth |
| 4.3 | CSV Upload Transaction | ✅ FIXED — lead + activity creation wrapped in prisma.$transaction per row |
| 4.4 | Automation Node Timeout | ✅ VERIFIED |
| 4.5 | Worker Healthcheck | ✅ DLQ now writes heartbeat key |

---

## Phase 5: Frontend Code Quality & UI Consistency ✅

| # | Item | Status |
|---|------|--------|
| 5.1 | CLAUDE_CODE_HANDOFF Visual Refactor (10 phases) | ✅ FIXED — Phases 02–05, 09 complete; StatusChip/MetaChip/TrendChip created; radius vocabulary standardized; nav group labels added; Phase 07 (score column) deferred pending BE API |
| 5.2 | Consolidate Formatting Utilities | ✅ VERIFIED — lib/format.ts already clean, no duplicates |
| 5.3 | Remove Dead UI Code | ✅ FIXED — metricVisual() helper and decorative icon imports removed from DashboardView; deprecated AppChip JSDoc'd |
| 5.4 | Loading/Error/Empty States | ✅ Verified |
| 5.5 | Mobile Responsiveness | ✅ VERIFIED — CrmShell handles breakpoints; nav group labels hidden when sidebar collapsed |

---

## Phase 6: Test Coverage Expansion 🟢

| # | Item | Status |
|---|------|--------|
| 6.1 | 8 Critical Test Cases | ✅ FIXED — 16 unit tests in backend/test/unit.ts covering csvCell, sanitizeBulkLeadPatch, advancedLeadCondition, leadWhere |
| 6.2 | CI Pipeline Enhancements | ✅ FIXED — added test:unit step to .github/workflows/ci.yml |

---

## Phase 7: Operational Readiness ✅

| # | Item | Status |
|---|------|--------|
| 7.1 | Backend Docker Healthcheck | ✅ FIXED |
| 7.2 | Log Rotation | ✅ VERIFIED (250MB max) |
| 7.3 | Backup Script | ✅ CREATED |
| 7.4 | `.env.example` Completeness | ✅ VERIFIED |
| 7.5 | Nginx Config Templates | ✅ CREATED |
| 7.6 | README | ✅ FIXED — expanded with architecture table, dev setup, test commands, production checklist, folder structure |

---

## All Files Modified

```
docker-compose.yml                          — Redis policy, backend healthcheck
backend/src/auth/auth.service.ts            — Singleton Redis, session revocation
backend/src/auth/auth.controller.ts         — CSRF cookie SameSite=Strict
backend/src/common/security.ts              — Timing-safe CSRF comparison
backend/src/dashboard/dashboard.service.ts  — Redis caching, subquery optimization
backend/src/leads/leads.service.ts          — Remove `any` type from formatLead
backend/prisma/schema.prisma                — onDelete: Cascade (8 relations)
workers/src/index.ts                        — Remove `any` types, shutdown timeout, DLQ monitoring
```

## All Files Created

```
scripts/backup.sh                           — PostgreSQL cron backup script
deploy/nginx/api.unnatify.com.conf          — API reverse proxy template
deploy/nginx/app.unnatify.com.conf          — Frontend reverse proxy template
```

---

## Remaining Items (Priority Order)

### Manual Operations (Cannot be automated)
1. **1.1** — Rotate Resend API key in Resend dashboard
2. **1.2** — Document production MCUBE webhook secret

---

## Items NOT in Scope

- **MCUBE integration testing** — blocked pending provider credentials
- **WhatsApp/Voicebot real provider execution** — blocked pending MCUBE API details
- **Dark mode** — not required per decisions doc
- **Multi-tenant architecture** — single company deployment confirmed
- **Saved/scheduled reports** — deferred
- **Mobile app** — out of scope
- **E2E browser tests** — deferred; smoke tests provide baseline
