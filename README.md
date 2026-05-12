# Unnatify CRM

Automation-first CRM for loan conversion journeys. Manages leads, field-agent assignments, WhatsApp/voicebot outreach, telephony logging, and multi-step automation workflows.

## Architecture

| Package | Purpose | Port |
|---------|---------|------|
| `backend` | NestJS REST API + Prisma ORM | 4000 |
| `frontend` | Next.js 16 App Router UI | 3000 |
| `workers` | BullMQ job processors (uploads, automation, webhooks) | — |

**Backing services:** PostgreSQL 16, Redis 7

## Local Development

### 1. Environment setup

```bash
cp .env.example .env
cp .env.example backend/.env
```

Edit `.env` and set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`. See `.env.example` for all required variables.

### 2. Install dependencies

```bash
npm install
```

### 3. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 4. Run migrations and seed

```bash
npm run prisma:migrate -w backend    # run migrations
npm run seed -w backend              # seed admin user + defaults
```

### 5. Start all services

```bash
# In separate terminals:
npm run dev -w backend
npm run dev -w workers
npm run dev -w frontend
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |

Default admin credentials (development only): `admin@unnatify.local` / `ChangeMe123!`

## Running Tests

```bash
# Unit tests (no server required)
npm run test:unit -w backend

# Integration smoke (requires running backend)
npm run test:integration -w backend

# Frontend architecture smoke
npm run test:architecture -w frontend
```

## Production Deployment

See [VPS-to-Go-Live-Runbook.md](VPS-to-Go-Live-Runbook.md) for the full deployment guide.

**Quick checklist before deploying:**

- [ ] Rotate `RESEND_API_KEY` in Resend dashboard
- [ ] Set a strong `JWT_SECRET` (32+ random characters)
- [ ] Configure Telephony, WhatsApp, and Voicebot provider credentials/webhook secrets in Settings > Connectors
- [ ] Configure Nginx using templates in `deploy/nginx/`
- [ ] Run `scripts/backup.sh` on a daily cron for PostgreSQL backups
- [ ] Set Redis `maxmemory-policy allkeys-lru` (configured in `docker-compose.yml`)

## Key Modules

- **Leads** — CRUD, CSV bulk upload (up to 50K rows), advanced filters, saved views, CSV export
- **Automation** — visual workflow builder, multi-step execution (delay/condition/assignment/WhatsApp/voicebot/API-call nodes)
- **Telephony** — inbound/outbound call logging via MCUBE webhook
- **WhatsApp** — template-based outreach via provider webhook integration
- **Reports** — lead funnel, activity timeline, automation analytics
- **Access Control** — role-based field-level permissions per module

## Folder Structure

```
backend/src/
  auth/           JWT auth + CSRF guard
  leads/          Lead CRUD, filters, export, saved views
  automation/     Workflow builder API + run history
  activities/     Activity logging
  tasks/          Task management
  reports/        Report aggregations
  access/         Role & field permission engine
  common/         Shared utilities (env, filtering, pagination, phone)

workers/src/
  processors/     Job handlers (automation, lead-upload, whatsapp, voicebot, telephony, offers, connector)
  context.ts      Shared Prisma + Redis + activityTypeCodes singletons
  logger.ts       Structured JSON logging with PII redaction
  env.ts          Production-safe env var loader

frontend/src/
  app/            Next.js App Router pages
  features/crm/  CRM views (leads, tasks, activities, automation, reports, settings)
  components/     Shared UI (StatusChip, MetaChip, TrendChip, DataTable, WorkspacePrimitives)
  lib/            API client, date/number formatting utilities
```
