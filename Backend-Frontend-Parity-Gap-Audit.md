# Backend to Frontend Parity Gap Audit

Date: 2026-05-04

Scope: root requirement docs, `Implementation-Task-Tracker.md`, backend controllers/services/workers, frontend routes/views/components, and current UI wiring.

Validation run:

- `npm run typecheck` passed for backend, frontend, and workers.
- `npm run lint -w frontend` passed.
- `npm run build -w backend`, `npm run build -w workers`, and `npm run build -w frontend` passed.

## Latest Remediation Pass

The deep audit items are now tracked in `Implementation-Task-Tracker.md` under `Deep Audit Remediation: Frontend, Backend, Workers, UI, and Logic`.

Completed in this pass:

- Queued worker automation now follows workflow edges instead of always running every node linearly.
- Direct backend automation runs now follow workflow edges and evaluate If/Else conditions; queued worker execution remains the preferred path for connector-heavy nodes.
- Worker API-call nodes now enforce public HTTPS URLs, block localhost/private-network targets, support timeout/retry/header config, and log request/response results.
- Lead advanced filters now support the same custom-field operators exposed in the frontend where stored JSON values support those comparisons.
- CSV upload required columns now combine the confirmed default upload requirements with active Lead mandatory rules that map to supported CSV columns.
- Upload worker validation now uses the same mapped mandatory-rule source as the backend upload API.
- Telephony agent presence is Redis-backed, so lead route online checks are no longer limited to only one backend process.
- Popup fan-out uses Redis pub/sub for instant delivery across backend replicas while keeping DB polling fallback.
- SSE uses a short-lived telephony stream token instead of the long-lived access token.
- Activity edit uses configurable Lead Disposition dropdown values instead of free text.
- Mandatory-rule UI field options now follow the selected mandatory-rule module.
- Production backend startup now fails if `JWT_SECRET` is missing.
- Auth now supports httpOnly access/refresh cookies with bearer-token fallback, and refresh tokens are no longer stored in browser storage.

Still open or intentionally partial:

- `CrmApp` is thinner than before, and Automation lead context now loads inside the Automation route view. More page-specific loading can still be moved later.
- A focused deep-remediation smoke script now covers stream-token, custom-field filter, automation list, and worker health. Lower-level branch/API-node tests can still be expanded.

## Executive Summary

The app now has a much stronger foundation than the older audit showed. Core CRM flows are wired across backend and frontend for login, lead list/detail, CSV uploads, tasks, activities, users/access, settings lists/fields/security, reports overview/export, telephony config, telephony popup SSE, generic API connectors, WhatsApp connector/template/message basics, and voicebot connector/template basics.

The remaining parity gaps are concentrated in smoke coverage, deployment-scale realtime behavior, and deeper route/data ownership polish:

- Automation node-specific UI and worker execution are much stronger now. Structured If/Else condition groups, structured exit conditions, and connector variable-picking are wired.
- Worker handlers for WhatsApp, voicebot, telephony, assignment, retries, and offer expiry now perform real processing and need deeper smoke coverage.
- Connector management is mostly wired, including guided voicebot sample-body mapping and connector-log name enrichment.
- Reports now show filtered backend data, resolved lead/workflow/rule/user names, and export download actions; deeper drill-down actions can still improve.
- Lead and task lists now have useful selected-row bulk status actions; uploads/reports remain intentionally non-bulk until a concrete workflow needs it.
- Most previously static controls have been replaced or wired; any remaining placeholders should stay tracked in the remediation section until removed or completed.

## Confirmed Working / Wired

### Auth

- Email/password login is wired.
- Login OTP flow is wired when required.
- Password reset request/confirm UI is wired.
- Refresh/logout uses shared auth helpers.

### Leads

- Lead list, detail, create, edit, assign, disposition, export, dynamic columns, quick filters, advanced filters, and custom fields are wired.
- Lead detail resolves both database IDs and external lead IDs.
- Lead assignment modal exists in list/detail.
- Lead field permissions/masking are supported by backend and used in UI paths where permissions are loaded.

### CSV Uploads

- CSV upload UI is wired to backend upload.
- Upload history, original/result CSV download, failed-row detail modal, upload summaries, progress/loading states, and worker health are visible.
- Only CSV is supported, matching requirement.

### Activities

- Activity list is route-driven by 3-digit activity type code.
- Activity list links lead names to lead detail.
- Activity create/edit/delete and custom field values are wired.
- Activity filters use shared advanced filter builder.

### Tasks

- Task list, quick filters, advanced filters, status update, comments, and lead-name display are wired.
- Lead detail task creation/comments are wired.

### Settings / Access

- Users, teams, sales groups, permission templates, custom fields, disposition fields, mandatory rules, lead lists, upload history, and security settings are route-backed.
- Users can belong to one team and multiple sales groups.
- User custom fields are supported in create/edit.
- Permission template UI supports module permissions and field access values: editable, visible/read-only, masked, hidden.
- Account-level and user-level 2FA controls are wired.

### Telephony

- MCUBE-style clean webhook endpoints exist.
- Lead route API returns 10-digit agent phone or blank text.
- Agent popup and call log APIs are wired.
- Inbound/outbound lead and agent phone matching logic is implemented based on direction.
- Popup delivery uses SSE with polling fallback.
- Popup appears bottom-right, can be dragged, can open lead in a new tab, and close state syncs across tabs.

### Generic API Connectors

- Backend CRUD exists.
- Frontend create/edit/delete UI exists.
- Variable extraction endpoint exists and is used in connector screens.

## High Priority Parity Gaps

### 1. Automation Builder Is Still Partial

Backend has workflow, version, node, edge, run, enqueue, and run-detail endpoints. Frontend can create workflows, edit local node state, save/publish a full definition, run/enqueue, and show run detail.

Current status:

- Builder changes are still primarily local until full-definition save; node add/clone/delete and edge operations are not individually persisted through the node/edge endpoints.
- `NodeInspector` now has node-specific forms for Trigger, If/Else, Delay, Assignment, WhatsApp, Voicebot, Task, Lead Update, Create Activity, and API Call.
- WhatsApp and Voicebot automation nodes can select saved templates and map template variables to lead/user/activity fields, including custom fields.
- If/Else has a structured primary condition, but multi-condition branch groups still use JSON.
- Exit condition is plain text in UI, not a structured config editor.
- API node body editing is JSON-based; it still needs a friendlier variable picker based on extracted body variables.

Backend/worker execution status:

- Backend API-call node execution exists.
- Backend handles delay, create activity, mark expired, notify, stop, pause, resume.
- Worker execution now performs assignment engine, WhatsApp send, voicebot trigger, task creation, lead update, create activity, delay, pause/stop, mark expired, and connector API call nodes.
- Backend synchronous run still has narrower execution than the worker path for some node types.

Needed:

- Keep full-definition save wording clear unless node/edge endpoints become the chosen persistence model.
- Add route-backed automation editor path such as `/automation/[id]` if this is still a requirement.

### 2. Worker Queue Handlers Need Deeper Smoke Coverage

Worker handlers now exist for:

- `lead-upload.process`
- `automation.run-step`
- `automation.delayed`
- `whatsapp.send`
- `whatsapp.webhook`
- `voicebot.trigger`
- `voicebot.webhook`
- `telephony.webhook`
- `offer-expiry.check`
- `assignment.run`
- `connector.retry`

Needed:

- Add worker health checks that verify real queue consumption, not only heartbeat.
- Add integration smoke tests for at least upload, assignment, automation, WhatsApp send, and voicebot trigger queues.

### 3. WhatsApp Connector Is Functional but Not Full CRUD

Wired:

- WhatsApp connector create/edit/delete.
- WhatsApp template create/edit/delete.
- WhatsApp business number create/edit/delete.
- WhatsApp outbound message creation.
- WhatsApp webhook ingestion.
- Conversation/message/report basics.

Gaps:

- Template variable mapping is shown as extracted variables, but not as a field-mapping UI.
- Counsellor chat is available in connector settings, but not a polished lead-context chat experience across the app.

Needed:

- Add mapping UI for template variables to lead/user/activity fields.
- Decide where WhatsApp chat should live: lead detail tab, floating launcher, settings test panel, or all three.

### 4. Voicebot Connector Is Functional but Not Full CRUD

Wired:

- Voicebot connector create/edit/delete.
- Trigger template create/edit/delete.
- Test-call dry-run UI.
- Webhook mapping create/edit/delete.
- Webhook ingestion.
- Variable extraction.

Gaps:

- Voicebot trigger variable mapping is JSON-based, not a guided dropdown mapper.
- Voicebot automation node does not yet run a real trigger worker.

Needed:

- Add sample-body mapper that lets admin map sample paths to activity fields/custom activity fields.
- Implement `voicebot.trigger` worker behavior.

### 5. Reports Are Present but Not Fully Actionable

Wired:

- Overview metrics.
- Lead/upload reports.
- Automation report with step summary.
- Assignment, telephony, WhatsApp, voicebot, journey, expired leads, and audit tables.
- CSV export generation, export history list, and export-history download.

Gaps:

- Some report rows still show IDs where names would be better: workflow IDs, lead IDs, rule IDs, uploadedBy IDs.
- Report filters are limited; requested date range/team/status/connector filters are not consistently available across tabs.
- Invalid upload row details are table-based; for crowded records, modal drill-down is preferable.

Needed:

- Enrich report API or frontend lookup maps to show lead/workflow/rule/user names.
- Add consistent report-level filters.
- Add row detail modals where row content gets long.

### 6. Bulk Actions Are Not Consistent

Wired:

- Shared table component supports row selection and `bulkActions`.
- Some lead bulk action work exists.

Gaps:

- Most list pages do not pass `onSelectionChange`/`bulkActions`.
- Tasks, uploads, reports, and connector logs mostly act row-by-row.

Needed:

- Add useful bulk actions only where real workflows need them:
  - Leads: assign, update status/category, export selected.
  - Tasks: close/reschedule/reassign.
  - Upload rows: export selected failures.
  - Reports: export filtered/selected where applicable.

### 7. Advanced Filter Grouping Is Partial

Wired:

- Shared `AdvancedFilterBuilder` chooses operators based on field type.
- Dropdown/date/number inputs are used where field metadata supports them.
- Leads, activities, and tasks use advanced filters.

Gaps:

- Builder supports match all / match any for a flat condition list, but not nested grouped conditions.
- Not every table uses the shared advanced filter builder.

Needed:

- Add grouped condition blocks only if users need nested logic.
- Standardize the builder across all list pages that need filters.

## Medium Priority UI / Wiring Gaps

### Lead Detail Activity Filters

The activity tab now filters the timeline by activity type and date range.

Needed:

- Continue moving create/edit activity flows into cleaner modal patterns during the UI polish pass.

### Connector Settings UI Density

Telephony is relatively complete, but WhatsApp and Voicebot still feel like admin test panels rather than polished settings pages.

Needed:

- Split WhatsApp into Connectors, Numbers, Templates, Chat Test, Webhook Logs.
- Split Voicebot into Connectors, Trigger Templates, Webhook Mappings, Test Calls, Logs.
- Use consistent create/edit/delete dialogs for each area.

### Settings Reference Polish

Settings is route-backed and cleaner than before, but not yet consistently like the reference:

- Some sections still use nested tables/forms.
- Several actions are plain buttons instead of row action menus.
- Empty states are inconsistent.

Needed:

- Continue applying the reference pattern: left settings nav, single focused content card, top-right create action, table, empty state, modal create/edit.

### Names Instead of IDs

Many places already show names, but remaining ID-heavy spots include:

- Reports automation workflow/rule/lead references.
- Connector logs now show connector names when the backend can resolve them.
- Some audit entity/change references.

Needed:

- Add lookup maps or backend includes to return display names.

## Lower Priority / Intentional Gaps

### Generic Files Module

Backend has file list/upload/cleanup/download. Visible CRM file/document management is intentionally not exposed yet.

Current decision:

- Keep this out of the visible CRM until a document/attachment requirement is confirmed.
- Ops file viewer can remain admin-only.

### Standalone Email OTP UI

Backend has standalone email OTP request/verify. Login OTP is already wired.

Current decision:

- Only expose standalone email verification if a product flow requires it.

### Reference Repo Modules Not Needed

Do not add:

- Opportunities.
- Full Forms module.
- Lists as a main sidebar module.
- Generic CRM pipeline pages.
- Quick preview drawer.

## Remaining Open / Partial Items

The tracker is aligned with the latest wiring pass. No non-blocked backend/frontend parity item is currently known from this audit pass.

Quality follow-up that can still be expanded:

- Add deeper browser/E2E smoke coverage for automation worker execution across assignment, WhatsApp, voicebot, task, lead-update, API-call, If/Else, and exit-condition cases.
- Add provider-contract tests once MCUBE shares final WhatsApp/voicebot/telephony payloads and credentials.

## Recommended Next Implementation Order

1. Keep validating against real MCUBE samples as soon as they are available.
2. Expand E2E coverage around CSV import, activity-type configuration, automation resume/retry, assignment, reports drilldowns, and telephony popup delivery.
3. Continue visual QA on route pages after each product iteration so the compact reference-style system stays consistent.

## Blocked By External Inputs

- MCUBE technical documentation.
- MCUBE test credentials.
- MCUBE telephony test credentials and any provider-specific payload differences not covered by shared samples.
- MCUBE WhatsApp send/template API details.
- MCUBE WhatsApp status/reply webhook payloads.
- MCUBE voicebot trigger API details.
- MCUBE voicebot result webhook payloads.
- Final CSV field list and final mandatory/optional rules.
- Final lead status/category/disposition values if the seed lists change.
