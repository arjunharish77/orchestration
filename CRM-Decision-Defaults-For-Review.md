# CRM Decision Defaults For Review

Purpose: this document captures the logical product decisions I would choose for Unnatify CRM as a production SaaS-style CRM foundation. Each item lists available options and the selected default. Please correct any selected option you want changed.

Status key:

- Selected: my recommended/default choice.
- Alternative: valid option, not chosen.
- Confirmed: already clarified by you earlier.

## 1. App Structure and Visible Modules

### 1.1 Main Sidebar Modules

Options:

- Dashboard, Leads, Activities, CSV Uploads, Tasks, Automation, Reports, Settings.
- Add Opportunities, Forms, Lists, Pipelines as main modules.
- Keep only Leads and Settings initially.

Selected:

- Dashboard, Leads, Activities, CSV Uploads, Tasks, Automation, Reports, Settings.

Reason:

- This matches the current Unnatify requirements without importing extra reference-repo modules like Opportunities or Forms.

### 1.2 Settings Placement

Options:

- Put all admin/configuration modules under Settings.
- Expose Users, Fields, Connectors, Upload History, and Security as main sidebar items.

Selected:

- Put all admin/configuration modules under Settings.

### 1.3 Hidden Modules

Options:

- Hide unavailable modules completely.
- Show unavailable modules disabled.
- Show unavailable modules and redirect to No Access.

Selected:

- Hide unavailable modules completely, and show No Access only on direct URL access.

Confirmed:

- Same rule applies to Dashboard, Leads, Activities, CSV Uploads, Tasks, Automation, Reports, and Settings.

## 2. Authentication and Security

### 2.1 Login Method

Options:

- Email and password only.
- Email and password with optional email OTP / 2FA.
- Passwordless OTP only.

Selected:

- Email and password with optional email OTP / 2FA.

Confirmed:

- Email/password login is required.
- Provision for email OTP is required.
- Account-level and user-level 2FA controls are required.

### 2.2 2FA Control

Options:

- User self-managed only.
- Admin-managed per user only.
- Account-level global control plus admin-managed user-level control.

Selected:

- Account-level global control plus admin-managed user-level control.

### 2.3 Admin Operations Center

Options:

- Regular Administrator users can access it.
- Separate backend-created ops login only.

Selected:

- Separate backend-created ops login only.

Confirmed:

- Do not expose Admin Operations Center to normal admin users.
- Do not audit Admin Operations Center actions.

## 3. Roles, Teams, Sales Groups, and Ownership

### 3.1 Fixed Roles

Options:

- Administrator, Sales Manager, Sales User only.
- Add Branch Manager and Partner as roles.
- Keep roles fully configurable.

Selected:

- Fixed roles: Administrator, Sales Manager, Sales User.

Confirmed:

- Branch Manager, Partner, etc. are Teams/configurable groupings, not roles.

### 3.2 Team Membership

Options:

- User can belong to one team.
- User can belong to many teams.

Selected:

- User belongs to one team.

Confirmed:

- Users can only belong to one team.
- Sales group membership is separate from team membership and can support multiple groups.

### 3.3 Sales Group Membership

Options:

- User can belong to one sales group.
- User can belong to multiple sales groups.
- Sales groups only exist as assignment buckets, not user membership.

Selected:

- User can belong to multiple sales groups.

Confirmed:

- If a user is in multiple sales groups, visibility combines all assigned sales groups.

### 3.4 Lead Ownership

Options:

- Lead assigned to user only.
- Lead assigned to team only.
- Lead assigned to both user and sales group.

Selected:

- Lead assigned to user only.

Confirmed:

- Leads should not be assigned directly to sales groups.

### 3.5 System Owner

Options:

- New leads are unassigned.
- New leads are assigned to a special non-login System owner.
- New leads must be assigned immediately during upload/create.

Selected:

- New/uploaded leads default to special non-login System owner.

Confirmed:

- System-owned leads are treated as available for assignment automation.
- System can appear in owner filters and can be selected as assignment target.
- Assigning to/from System requires all-leads visibility plus assign permission.

## 4. Permission Templates

### 4.1 Source of Truth

Options:

- Role decides access.
- Permission template decides access.
- Role and permission template merge.

Selected:

- Permission template decides actual access.

Confirmed:

- Role is mainly identity/default behavior.

### 4.2 System Templates

Options:

- All system templates locked.
- Only Administrator Full Access locked.
- All templates editable.

Selected:

- Administrator Full Access is locked; Sales Manager and Sales User templates are editable by admins.

### 4.3 Settings Permissions

Options:

- Settings has only module-level visibility.
- Settings has section-level permissions.
- Each Settings action has a separate permission.

Selected:

- Settings has only module-level visibility.

Confirmed:

- Any user with Settings permission can perform Settings actions.

### 4.4 Field Permission States

Options:

- Visible / hidden only.
- Visible / editable / hidden.
- Visible / editable / hidden / masked.

Selected:

- Visible / editable / hidden / masked.

Confirmed:

- Masked phone: `******3210`.
- Masked email/name/text keeps partial characters.
- Hidden fields are removed from forms, tables, details, selectors, filters, exports, and search.
- Masked fields remain searchable/filterable but are excluded from exports unless the user has full field access.

### 4.5 Record Visibility Scopes

Options:

- Own leads only.
- Team leads.
- Sales group leads.
- All leads.
- All of the above as configurable scopes.

### 4.6 Log Visibility

Selected:

- All connector logs, raw webhook/API request/response logs, system logs, and technical execution logs are visible only to Administrator users.
- Do not ask module-by-module log visibility again; this is the global default.

Selected:

- All of the above as configurable scopes.

Confirmed:

- Tasks and activities inherit visibility from linked lead.
- Records not linked to a lead are visible only to admins.
- Current owner decides visibility; previous owners do not keep access.

## 5. Module-Level Action Permissions

### 5.1 Leads

Options:

- Generic CRUD only.
- CRM-specific actions.

Selected:

- View, create, edit, delete, export, assign, bulk assign, click-to-call, add task, add disposition, view audit.

### 5.2 Activities

Options:

- One shared activity permission set.
- Per activity type permission set.

Selected:

- Per activity type permission set.

Confirmed:

- `001 - Call`: view, export, play recording only.
- Non-call activity types: view, create, edit, delete, export.
- Activity field permissions are per activity type.

### 5.3 Tasks

Selected actions:

- View, create, edit, close/complete, reschedule, assign, delete, export.

### 5.4 CSV Uploads

Selected actions:

- View upload history, upload CSV, download uploaded CSV, download result CSV, view failed rows, export.

### 5.5 Automation

Selected actions:

- View, create, edit, delete, clone, activate/deactivate, run/test, view run history, export.

### 5.6 Reports

Selected actions:

- View, filter, export, download scheduled/export history.

## 6. Lead Model and Lifecycle

### 6.1 Required Standard Fields

Options:

- Keep only mobile mandatory.
- Use the confirmed lead upload fields.
- Fully configurable mandatory fields only.

Selected:

- Use confirmed lead fields as the foundation, with mandatory behavior configurable and upload fields in csv should also be configurable

Confirmed:

- CSV upload field configuration lives inside Settings -> Fields & Disposition.
- CSV upload required/optional rules are configured separately from normal lead form mandatory rules.
- CSV upload mapping supports both standard lead fields and lead custom fields.
- Only one active default CSV mapping configuration is needed.
- During upload, the system should first auto-map by headers, then users can manually adjust mapping for that file.
- Manual mapping changes during upload apply only to that upload batch and do not update the active default mapping.
- If required CSV fields are missing after mapping, block the upload before processing.
- For row-level validation failures, import valid rows and mark invalid rows failed.
- Duplicate leads in CSV are skipped and marked failed.
- Duplicate detection is configurable and can use any selected standard/custom lead fields as a composite key.
- The duplicate rule applies to both CSV upload and manual lead creation.
- Manual duplicate creation is blocked with a duplicate warning.
- Duplicate checks cannot be bypassed.
- Duplicate matching is trimmed and case-insensitive for text fields.
- If any duplicate-key field is blank, validation fails.

Confirmed lead fields:

- Customer name
- Mobile number
- Loan ID / Lead ID
- Branch code
- Branch name
- Loan offer amount
- EMI amount, if applicable
- Upload date
- Loan closure / offer expiry date
- Customer location
- Preferred language
- Partner mapping, if available

### 6.2 List Values

Options:

- Hardcoded values.
- Configurable list values.
- Hybrid seeded defaults plus configurable values.

Selected:

- Seeded defaults plus configurable values.

Confirmed:

- Lead Category uses your list.
- Lead Status uses CRM workflow status values.
- Lead Disposition uses your disposition list.
- Lead Status can change from any value to any value, subject to permission.
- Lead Category can change from any value to any value, subject to permission.
- Lead Disposition is independent and should not automatically update Lead Status or Lead Category unless automation handles it.
- Every status/category/disposition change creates a system change-history entry with old and new values.
- Status/category/disposition change entries appear in both lead detail Activities and Audit by default.
- Status/category/disposition activity message format: `Status changed from New to Converted by Rahul M`.
- Lead created appears in both lead detail Activities and Audit by default.
- Lead created activity message format: `Lead created by System` or `Lead created by Rahul M`.
- Other lead field edits show only in Audit, not Activities.
- Owner assignment/reassignment appears in both Audit and Activities.
- Assignment activity message format: `Owner changed from System to Rahul M by System`.
- Manual assignment uses the logged-in user as actor, for example `Owner changed from Rahul M to Neha S by Admin User`.
- Task creation and task completion appear in Activities.
- Task reschedule/reassign/update stays in Tasks/Audit only and does not create Activities timeline entries.
- CSV upload/import events appear only in Upload History, not lead Activities or lead Audit.
- Automation actions on a lead appear only in Automation History.
- WhatsApp and Voicebot events appear in Activities.
- Telephony Call Log Complete call activities appear in both Activities and Calls.
- Calls tab shows call-specific columns/details; Activities shows compact timeline entries.
- Global Activities page visibility is configurable per activity type.
- Activity type visibility options are global Activities, lead detail Activities, both, or neither.
- Audit visibility is separate and controlled by audit permission, independent of activity type visibility.
- Activity type configuration lives in Settings -> Activity Types.
- Admins can create/edit/delete non-system activity types.
- System activity types are protected from deletion.
- System activity types allow editing display name, visibility, and permissions, while code and system behavior remain locked.
- Activity type codes are auto-generated as 3-digit codes.
- System activity type codes are fixed/reserved; custom activity types start after system codes.
- Default activity visibility:
  - Call: global Activities + lead detail Activities.
  - Lead Created: lead detail Activities only.
  - Status/Category/Disposition Changed: lead detail Activities only.
  - Task Created/Completed: lead detail Activities only.
  - WhatsApp/Voicebot: global Activities + lead detail Activities.

### 6.3 Lead Category

Selected seeded values:

- Hot Lead
- Warm Lead
- Cold Lead
- Callback Requested
- Need More Details
- Not Interested
- Wrong Number
- Already Applied
- Converted
- Expired
- No Response

### 6.4 Lead Disposition

Selected seeded values:

- Converted
- Interested
- Follow-up Required
- Callback Scheduled
- Documents Pending
- Not Interested
- Not Reachable
- Wrong Number
- Escalated

### 6.5 Disposition Form

Options:

- Fixed disposition dropdown only.
- Configurable disposition form with extra fields.

Selected:

- Configurable disposition form with extra fields, such as callback date/time.

### 6.6 Lead Detail Tabs

Options:

- Show all possible tabs.
- Show only required workflow tabs.

Selected:

- Activities, Tasks, Dispositions, Calls, Automation History, Audit

Confirmed:

- Hide/remove Overview, Notes, and Custom Fields tabs from lead detail.
- Show lead standard fields and lead custom fields in the left lead profile/properties section instead.
- The left lead profile should show the full list, not an independently scrollable panel.
- Lead name, mobile, and email remain in the lead profile header, not inside grouped field sections.
- Lead profile fields are grouped.
- `Customer` group is expanded by default.
- `Loan Details`, `System Details`, and `Custom Fields` groups are collapsed by default.
- `Customer` group fields: customer location, preferred language, partner mapping, owner, source, lead status, lead category, lead disposition.
- `Loan Details` group fields: Loan ID / Lead ID, loan offer amount, EMI amount, loan closure / offer expiry date, branch code, branch name.
- `System Details` group fields: upload date, created timestamp, updated timestamp.
- Upload batch/file/import status stays only in CSV Uploads / Upload History, not on lead detail.
- All lead custom fields appear in one `Custom Fields` group.
- Owner name should be shown.
- Owner change should be available from lead detail through an assignment modal with eligible users and System.
- Lead list bulk owner change should use the same assignment modal with selected lead count and eligible owner targets.

Not selected:

- Opportunities, full Forms module, quick preview drawer.

## 7. CSV Uploads

### 7.1 Upload Format

Options:

- CSV only.
- CSV and XLSX.

Selected:

- CSV only.

Confirmed:

- Only CSV uploads are required.

### 7.2 Upload Processing

Options:

- Synchronous processing only.
- Async worker processing with upload status.

Selected:

- Async worker processing with upload status and row-level results.

### 7.3 Upload History

Options:

- Show only batch status.
- Show batch status plus downloadable uploaded/result CSV.
- Show only settings history.

Selected:

- Show upload history in Settings and CSV Uploads, with batch status, row counts, downloadable uploaded CSV, and result CSV including `upload_status`.

### 7.4 Failed Rows

Options:

- Inline failed rows.
- Modal/detail panel for failed rows.

Selected:

- Open failed row details in a modal/detail panel to avoid clutter.

## 8. Activities

### 8.1 Activity Pages

Options:

- Activity list and activity detail route.
- List-only activity queues by type.

Selected:

- List-only activity queues by activity type.

Confirmed:

- No activity detail view.
- Activity type is URL-driven with 3-digit codes like `001`, `002`, `003`.
- Clicking lead name opens lead detail.
- Activity Types are configurable from Settings -> Activity Types.
- Non-system activity types can be created/edited/deleted by admins.
- System activity types are protected from deletion and lock code/behavior.
- System activity type display name, visibility, and permissions are editable.
- Activity type codes are auto-generated as 3-digit codes, with fixed/reserved codes for system activity types.
- Activity custom fields are defined per activity type.
- Each activity type has its own configurable creation form layout/order using that activity type's fields.
- Activity type fields are available in automation as trigger/context fields and as fields to set when creating an activity.
- Activity type fields are available in global Activities filters/columns based on the selected activity type.
- Activity type fields are available in lead detail Activities filters/columns based on selected activity type.
- Lead detail Activities defaults to all visible activity types.
- When mixed activity types are shown, keep the activity list compact; type-specific fields are shown only when opening/expanding that activity item.
- There is no activity detail route and no activity modal/drawer for detail.
- Clicking an activity expands it inline to show activity details and audit log based on activity-created/activity-updated data.
- Expanded activity details show old/new values for activity updates.
- Expanded activity details respect hidden/masked activity field permissions.
- System activity types like Lead Created and Status Changed are not expandable.
- Call recording play is a direct button and does not require expansion.
- Call activities are still expandable for call metadata.
- WhatsApp and Voicebot activities are expandable for message/call details.
- Manually created non-call activities are editable after creation, subject to permission.
- Activity edits create audit entries and show old/new values inside the expanded activity.
- Admins can deactivate activity types so old records remain visible.
- Deactivated activity types are hidden from creation forms but remain available in filters/history.

### 8.2 Manual Call Activity

Options:

- Allow manual call activity creation.
- Only telephony can create call activities.

Selected:

- Only telephony Call Log Complete can create `001 - Call` activities.

Confirmed:

- Manual call records are not allowed.

### 8.3 Recording Playback

Options:

- Open recording URL in new tab only.
- Inline audio modal/player, fallback to new tab.

Selected:

- Inline audio player modal/panel; fallback to new tab if playback fails.

Confirmed:

- Show play button in Activities page and Lead Detail when `ResourceURL` exists and permissions allow.

## 9. Tasks

### 9.0 Task Configuration

Options:

- Fixed task types and statuses.
- Configurable task types and statuses.

Selected:

- Task types are configurable.
- Task statuses are configurable.
- Task priority is fixed: Low, Medium, High.
- Only exact status `Completed` counts as completed for reports/reminders.
- No separate completed/closed flag is required.

### 9.1 Task Creation

Options:

- Inline forms.
- Modal/dialog from lead detail or task list.

Selected:

- Modal/dialog for creating/editing tasks. Also option to create tasks from automation
- Tasks are always linked to a lead.
- Task assignee is mandatory.
- Task due date is not mandatory.
- Task assignee choices are limited to users who can see the linked lead.
- Keep only task remarks/description in the visible app; task comments are not needed.

### 9.2 Task Visibility

Options:

- Tasks visible if assigned to user.
- Tasks visible only if linked lead is visible.

Selected:

- Tasks visible only if linked lead is visible.

Confirmed:

- Even if assigned to the user, a task is hidden when the lead is not visible.
- Task updates create audit entries.
- Task created/completed activities use messages like `Task created: Callback by Rahul M` and `Task completed: Callback by Rahul M`.
- Completed tasks become read-only except reopening/status change.
- Reopening a task is audit only.
- Task reminders/notifications are a later enhancement.

### 9.3 Task Quick Filters

Selected:

- Due today, overdue, assigned to me, priority.

## 10. Assignment Engine

### 10.1 Triggering Assignment

Options:

- Only on lead creation.
- Only manual.
- As an automation node that can run at any workflow stage.

Selected:

- Assignment Engine as an automation node that can run at multiple stages.

Confirmed:

- Assignment should not happen only at lead creation.

### 10.2 Assignment Criteria

Options:

- Standard lead fields only.
- Lead standard/custom fields plus user custom fields.
- Add activity context when automation passes activity context.

Selected:

- Lead standard/custom fields, user fields/custom fields, and optional activity context.
- Sales group/Team
-Round Robin/ weighted assignment
- Assignment rules support user capacity limits, such as max active leads per user.
- Capacity can be configured per user and used/overridden per assignment rule.
- Online/offline status does not affect assignment.
- Assignment considers only active users.
- If no eligible user is found, assign to a fallback user.
- Fallback user can be configured globally and overridden per assignment rule.
- Assignment rules support weighted distribution.
- User weight is configured per rule.
- Round-robin counter reset behavior is configurable: never, daily, weekly, monthly.
- Assignment rules support priority/order; first matching rule wins.
- Admins can reorder assignment rules manually.
- Assignment rules can reassign already-owned leads.
- Assignment rules may assign back to the same current owner; no prevention setting is needed.
- If owner remains the same, do not create activity and do not record assignment run history.
- Assignment run history is recorded only when owner actually changes.

### 10.3 Assignment Scope

Options:

- Any user.
- Only users in assigner-visible scope.
- Automation can use all configured eligible users.

Selected:

- Manual assignment follows assigner-visible scope; automation uses configured eligible users and logs System as actor.

### 10.4 Assignment Audit

Selected:

- Actor shown as System for automation.
- Store workflow/run IDs in metadata for traceability.

## 11. Automation

- Workflow list as main page. + Automation Button opens in new page to create automation.
- Automation workflows use draft and published versions.
- Only published versions run.
- Activation requires a published version and is blocked if only draft exists.
- Publishing validates the workflow and blocks when required node settings are missing.
- Users can test-run a draft workflow on a selected lead before publishing.
- Test-runs make real changes and real connector calls.
- Test-runs are clearly marked as `Test Run` in logs/history.
- No separate test-run permission is needed beyond automation edit/run access.
- Activated automation triggers run only on future events; no automatic backfill.
- Manual bulk `Run automation on selected leads` is required.
- Manual bulk automation runs use the currently published version only.
- Manual bulk automation runs are marked as `Manual Run`.
- Exit conditions are checked before every node and stop the run immediately when matched.
- Connector/API nodes retry automatically on failure.
- Retry count and retry delay are configurable per connector/API node.
- Retry settings apply only to connector/API nodes.
- After all connector/API retries fail, the automation run stops.
- Failed automation runs are manually retryable from Automation History.
- Manual retry resumes from the failed node.
- Automation API node logs store full request/response bodies, masked by permissions like connector logs.
- Full automation API request/response bodies are visible only to Administrator users.
- Lead Automation History requires lead visibility and Automation module permission.
- Lead Automation History tab is hidden when the user lacks Automation module permission.

### 11.1 Builder Style

Options:

- Simple list of rules.
- Node-based builder with plus buttons.
- Full canvas/flow editor.

Selected:

- Full canvas/flow editor.

### 11.2 Node Requirements

Selected core nodes:

- Trigger
- If/Else
- Multi-condition branch
- Delay
- Assignment Engine
- API Call
- WhatsApp Template
- Voicebot
- Task
- Lead Update
- Create Activity
- Stop/Pause/Resume

### 11.3 Exit Conditions

Options:

- Exit condition as a node.
- Workflow-level exit condition setting.

Selected:

- Workflow-level exit condition setting without requiring a node.

Confirmed:

- Exit condition should be configurable in settings itself.

### 11.4 API Call Node

Options:

- Fixed URL/body.
- Postman-like configurable URL/header/body with variables.

Selected:

- One generic API connector configuration represents one API action/endpoint.
- Postman-like API call with `{{...}}` variable suggestions.
- `{{...}}` suggestions include lead fields, user fields, activity fields, and custom fields.
- Automation node setup asks the user to map only variables actually used in the selected API connector.
- If an API connector call has a successful HTTP response but the configured response keyword is not found, mark it `completed_with_warning`.

Confirmed:

- Variables in connector body should drive mapping UI in automation.

## 12. Telephony / MCUBE

### 12.1 Public URLs

Selected:

- Clean Unnatify URLs under `https://api.unnatify.com`.

### 12.2 Webhook Auth

Selected:

- Header auth using `x-webhook-secret`.

### 12.3 Call Route API

Selected:

- GET endpoint returns `text/plain`.
- Return only 10-digit assigned agent phone or blank.
- Route irrespective of online/offline status.

### 12.4 Phone Mapping

Selected:

- Inbound: lead phone = `SourceNumber`, agent phone = `DestinationNumber`.
- Outbound: lead phone = `DestinationNumber`, agent phone = `SourceNumber`.

### 12.5 Agent Popup

Selected:

- Use SSE.
- Bottom-right default.
- Draggable, fixed compact size.
- Stack up to 3 visible popups.
- Appears in all active tabs.
- Closing in one tab closes everywhere.
- No sound/browser notification for now.

### 12.6 Popup Offline Behavior

Selected:

- Log and discard if the matched agent has no active tab.

### 12.7 Click-to-Call

Selected:

- Provider URL/method/headers/body configurable.
- Uses `{{lead.mobile}}`, `{{user.phone}}`, etc.
- Available from lead detail and lead list row action menu.
- Success/failure both show toast and write connector logs.
- Does not create a call activity; activity is created only by Call Log Complete.

### 12.8 Call Log Complete

Selected:

- Creates call record and `001 - Call` activity only when lead is found.
- Logs call without creating lead if lead is not found.
- Stores status from MCUBE as call status.
- Disposition blank unless MCUBE sends disposition.
- Stores full `ResourceURL` recording URL.

### 12.9 Call Activity Notes

Selected:

- `Inbound call with Rahul M for 2m 5s`
- Omit duration if missing/zero.
- Use agent phone if user not matched.
- Do not show `CallNotes` in notes.

### 12.10 Telephony Settings Sections

Selected visible sections:

- Call Route API
- Agent Popup API
- Call Log API
- Click-to-Call
- Popup Config
- Test Tools
- Connector Logs

Hidden for now:

- User-Agent Mapping
- Virtual Numbers
- Team Assignment
- Call Disposition

## 13. WhatsApp Connector

### 13.1 Scope

Options:

- Placeholder provision only.
- Template sending plus Converse-like chat.
- Full WhatsApp Business manager.

Selected:

- Template sending provision plus Converse-like counsellor chat, while final MCUBE API details remain blocked.
- Inbound WhatsApp messages from unknown numbers create a new lead.
- WhatsApp-created leads default to System owner.
- WhatsApp-created leads use source `WhatsApp`.
- Unknown WhatsApp lead uses WhatsApp phone as mobile and provider name if available, otherwise `WhatsApp Lead <phone>`.
- Inbound WhatsApp messages create Activity entries.
- Outbound WhatsApp template/free-text messages create Activity entries.
- WhatsApp chat is visible only when the user can view the linked lead.
- WhatsApp message bodies are visible in chat/activity according to lead visibility.
- WhatsApp message bodies should not be masked in connector logs.
- Full WhatsApp connector logs are visible only to Administrator users.
- WhatsApp opt-out blocking is not required now.
- WhatsApp templates are configurable in Settings and use `{{lead.field}}` style suggestions.
- WhatsApp template variables are mappable in automation node setup.
- Counsellors can send templates first; after a customer reply, a 24-hour service window allows free text and media.
- The 24-hour service window is based on the last inbound customer message timestamp.
- WhatsApp media support includes image, document/PDF, audio, and video.

### 13.2 Automation Usage

Selected:

- WhatsApp template node in automation.
- Template variables mapped from lead/user/activity fields and custom fields.

### 13.3 Chat Visibility

Selected:

- Chat should respect lead visibility and field masking.

## 14. Voicebot Connector

### 14.1 Scope

Options:

- Store connector only.
- Configurable API call trigger and webhook mapping.

Selected:

- Configurable Postman-like trigger plus generated webhook URL and sample body mapping.

### 14.2 Webhook Mapping

Selected:

- Paste sample body.
- Map provider fields to voicebot activity fields and custom fields.
- If the webhook phone does not match an existing lead, log the voicebot event without creating a new lead.
- If the webhook phone matches an existing lead, create a lead Activities timeline entry.
- Voicebot activity entries appear in both global Activities and lead detail Activities.
- Voicebot webhook results should not directly update lead disposition, status, or category.
- Lead updates from Voicebot outcomes happen only through automation rules/nodes.
- Voicebot activity title is fixed as `Voicebot call`; mapped/provider values stay in activity fields/details.
- Voicebot activities show a recording playback button when the webhook includes a recording URL.
- Voicebot recording playback uses the same recording playback permission model as telephony call recordings.
- Voicebot transcript and summary appear in expanded activity details when available.
- Voicebot transcript and summary visibility follows the same activity field permission and masking rules.
- Voicebot automation triggers are condition-driven from mapped webhook fields, such as lead id, phone, intent, disposition, status, or custom mapped fields.
- Voicebot webhook lead matching uses only the fields selected in connector mapping, not a hardcoded lead-id-first or phone-first order.
- If multiple Voicebot lead-match fields are selected, any one matching field can match the lead.
- If Voicebot matching finds multiple leads, attach to the most recently updated lead and log the ambiguity.
- Voicebot connector logs follow the global Administrator-only log visibility rule.

## 15. Reports

### 15.1 Report Areas

Selected:

- Lead/upload report
- Automation report
- Assignment report
- Telephony report
- WhatsApp report
- Voicebot report
- Audit report

### 15.2 Report Interaction

Options:

- Static metrics only.
- Filters, export, drilldown.

Selected:

- Filters and export now.
- Saved reports are a later enhancement.
- Scheduled reports are a later enhancement.
- Small report exports download immediately.
- Large report exports run asynchronously with export history.
- A large report is determined by row count.
- Default async export threshold is more than 10,000 rows.
- User-facing report export history appears inside Reports only.
- Report metrics/cards respect record visibility and field masking rules.
- Report drilldowns are required and open in a modal.
- Drilldown modals show the underlying filtered records in a table with export option.
- Drilldown rows with a lead open the lead detail page.
- Drilldown rows do not expose lead action menus; actions happen from the lead detail/list pages.
- All report tabs support date range filters.
- Reports include team, sales group, owner, status/category/disposition filters where relevant.

### 15.3 Lead Automation Report

Selected:

- Show automation runs.
- Clicking a run shows completed/failed/pending steps and step details.

Confirmed:

- Lead Automation report is required.

## 16. UI / UX Defaults

### 16.1 Visual Style

Options:

- Copy reference UI exactly.
- Use reference as structure/quality benchmark only.
- Keep current UI.
- Add dark mode toggle.

Selected:

- Use reference as structure/quality benchmark only.
- No dark mode toggle for now.
- Use a full green ramp (`--g50` through `--g900`) as the core palette.
- Use dark `#162716` for sidebar/navigation surfaces.
- Use `#2d6a2d` for primary buttons and active states.
- Use `#eef7ee` for tinted backgrounds such as section headers, filter bars, and info banners.
- Use soft green-tinted border `#e0ede0` instead of neutral gray.
- Link colors, avatar rings, toggle switches, progress bars, and active node left accents should all use the green system.

Confirmed:

- Do not add extra modules just because they exist in the reference repo.

### 16.2 Layout

Selected:

- Compact CRM layout.
- Route-backed pages.
- Reference-style Settings route layout with left settings navigation and large right-side section page.
- Main sidebar stays minimal.
- Main sidebar is expanded by default with icon + label.
- Sidebar collapse can exist as a user-triggered option, but not as the default state.
- On mobile/tablet, the main sidebar becomes a drawer opened by a menu button.

### 16.3 Tables

Selected:

- Shared compact data table.
- Search at top of table.
- Quick filters above/near table.
- Advanced filter modal/builder.
- Lead list saved views are required now.
- Lead list saved views are private per user.
- Each user can mark one private lead saved view as their default Leads page view.
- Lead saved views store quick filters, advanced filters, visible columns, sort, and density.
- Lead saved views do not store selected rows or bulk selection state.
- Manage columns includes standard and custom fields.
- Pagination centered at table bottom.
- Row actions in gear/three-dots menu.
- Fields should be visible of respective activities.

### 16.4 Forms and Actions

Selected:

- Create/edit actions use dialogs/modals where logical.
- Avoid large always-visible inline forms.
- Settings create/edit actions use modals/dialogs, not always-visible inline create forms.
- Use full-width large modals for complex forms such as permission templates and automation node configuration.
- Use compact modals for simple create/edit forms.
- Use dropdown controls for dropdown fields everywhere.
- Show labels/names instead of IDs.

### 16.5 Loaders and Empty States

Selected:

- Skeleton loaders for data areas.
- No full-page "Opening Unnatify" loader.
- No Loading bar, only skeleton loaders.
- Empty states with useful action when applicable.

## 17. Custom Fields and Mandatory Rules

### 17.1 Supported Modules

Selected:

- Users, Leads, Activities.

Confirmed:

- Users, Leads, Activities can have custom fields.

### 17.2 Field Types

Selected:

- Text, number, date, datetime, dropdown, multi-select, boolean, phone, email.

### 17.3 Mandatory Rules

Options:

- Mandatory on field definition only.
- Mandatory based on module/context/role/team/status/disposition.

Selected:

- Start with field definition plus configurable mandatory rules by module/context. Add deeper role/team/status targeting where needed.

## 18. Filtering and Search

### 18.1 Advanced Filter Operators

Selected:

- Text: contains, equals, starts with, ends with, empty, not empty.
- Number: equals, greater than, less than, between, empty.
- Date/datetime: on, before, after, between, today, yesterday, this week, this month.
- Dropdown: is, is not, in, not in.
- Boolean: is true, is false.

### 18.2 Global Search

Selected:

- Search only leads.
- Do not include tasks or activities in global search unless requirements change later.
- Respect record visibility.
- Search masked fields.
- Exclude hidden fields.
- Selecting result opens lead detail.

### 18.3 Exports

Selected:

- Export current filtered and visible list only.
- Hidden/masked fields excluded when user does not have full field access.

## 19. Audit and Logs

### 19.1 Business Audit

Selected:

- Audit lead changes, assignments, dispositions, user/team/permission changes, connector config changes, automation/task/activity changes.
- Activity Changes should be visible in activity history with old values and new values of fields changed.

Confirmed:

- Do not audit Admin Operations Center actions.

### 19.2 Connector Logs

Selected:

- Connector logs visible only to Administrator role users.
- Full request/response body visible only to Administrator users.
- Phone numbers masked by default.

### 19.3 Retention

Selected:

- Telephony connector logs: 365 days.
- Telephony call records: 365 days.
- Other audit/log retention should be configurable later.

## 20. Data and Deployment Defaults

### 20.1 Tenant Model

Options:

- Multi-tenant architecture.
- Single company deployment without tenant isolation.

Selected:

- Single company deployment without tenant isolation.

Confirmed:

- Tenant is not required.

### 20.2 Database

Selected:

- PostgreSQL with Prisma migrations.
- Tables created by Prisma migrations, not manually.

### 20.3 Background Jobs

Selected:

- Redis/BullMQ worker for uploads, automation, outbound connectors, reminders.

### 20.4 Production Deployment

Selected:

- Docker Compose on VPS.
- Nginx reverse proxy.
- SSL via Certbot.
- Hostinger weekly VPS backups accepted, but app-level off-server backup is still recommended before real production data.

## 21. Items Still Needing Your Later Inputs

- Final MCUBE technical document and provider-specific payloads.
- Final lead upload field mandatory/optional rules.
- Final WhatsApp MCUBE API details.
- Final Voicebot provider API details.
- Exact production domain routing once `api.unnatify.com` and `app.unnatify.com` are configured.
- Final permission template presets for Sales Manager and Sales User.
- Final lead status lifecycle transitions, if any statuses should be blocked from manual selection.
- Final report schedule/export retention rules.

## 22. Implementation Decision Rule

Selected:

- For small unclear UX/detail decisions, use reasonable CRM defaults during implementation.
- Ask for clarification only when a choice affects data model, security, permissions, integrations, or user-visible workflow behavior.
