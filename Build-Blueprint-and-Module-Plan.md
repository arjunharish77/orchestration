# Unnatify CRM Build Blueprint and Module Plan

This document explains what will be built before we start generating code.

It is written for a beginner-friendly build process and covers:

* What modules the CRM will have
* What each module will do
* What will be built first
* What will be configurable later
* How PostgreSQL tables will be created
* What will remain pending until you provide more information

This is a planning document only. It does not include application source code.

---

## 1. Product Goal

Unnatify CRM will be a full CRM foundation designed for the Reliance Indus loan conversion use case.

The system will support:

* Lead management
* CSV lead upload
* Lead validation
* Branch/team/partner assignment
* User and role management
* Permission management
* Activity timeline
* Task and follow-up management
* WhatsApp, voicebot, and telephony integration through MCUBE
* Configurable automation workflows
* Audit logs
* Admin/ops monitoring
* Reports and dashboards

There will be no hardcoded default automation workflow.

Admins will configure workflows later from the automation engine.

---

## 2. Confirmed Technical Decisions

| Area | Decision |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| UI style | Compact Material-style CRM UI inspired by `arjunharish77/crm-new`, using lighter shades and blue-focused accents |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| ORM / migrations | Prisma |
| Workers | Node.js workers with BullMQ |
| Queue/cache | Redis |
| Deployment | Docker Compose on VPS |
| Reverse proxy | Nginx |
| Frontend domain | `app.unnatify.com` |
| API domain | `api.unnatify.com` |
| Upload format | CSV only |
| Login | Email/password first |
| OTP/email provider | Resend for email OTP and password reset |
| Provider | MCUBE for WhatsApp, voicebot, and telephony |
| Fixed roles | Administrator, Sales Manager, Sales User |
| Branch/Partner setup | Configurable Teams |
| Default automation | None |

---

## 3. Main User Types

### Administrator

Administrator users can manage the full CRM.

They will be able to:

* Log in
* Manage users
* Manage roles
* Manage teams
* Manage permissions
* Upload leads
* View all leads
* Assign leads
* Configure automation workflows
* View dashboards
* View reports
* View audit logs
* Manage connector settings
* Access admin/ops pages

### Sales Manager

Sales Managers are operational managers.

They will be able to:

* View leads based on permission/team access
* Track team performance
* Assign or reassign leads if permitted
* Monitor tasks and follow-ups
* View reports based on access
* Review activity timelines

### Sales User

Sales Users are regular CRM users.

They will be able to:

* View assigned leads
* View permitted customer details
* Add notes and activities
* Create follow-up tasks
* Update lead status/disposition
* Use click-to-call when enabled
* View WhatsApp/voicebot history if permitted

### System User

There will be a default `System` user.

This user is not a human login user. It is used to attribute actions performed by:

* Background workers
* Automation workflows
* Scheduled jobs
* MCUBE webhooks
* System-generated updates
* Expiry checks
* Bulk processing

---

## 4. Teams and Business Grouping

Branch Manager, Partner, branch teams, partner teams, and operational teams will be configurable as Teams.

This avoids hardcoding too many roles.

Examples:

```txt
Team: Mumbai Branch
Team: Delhi Branch
Team: Partner A
Team: Partner B
Team: Loan Conversion Team
Team: Call Center Team
```

Users can belong to only one team.

Lead visibility and assignment can use teams.

Users may also have custom fields. User-level custom fields can be used in assignment rules.

---

## 5. Phase-Wise Build Plan

### Phase 1: Project Foundation

Goal: Create the technical base of the project.

Will include:

* Frontend app setup
* Backend API setup
* Worker app setup
* PostgreSQL setup
* Redis setup
* Docker Compose setup
* Environment configuration
* Prisma setup
* Basic health checks
* Basic logging

Output:

* App can start locally
* API can connect to PostgreSQL
* API can connect to Redis
* Worker service can start
* Docker Compose can start all services

### Phase 2: Authentication and Users

Goal: Allow users to log in and manage basic identity.

Will include:

* Email/password login
* Password hashing
* JWT/session handling
* Current user API
* Logout support
* Administrator user creation
* System user creation
* Email OTP provision in data model/config
* Resend email provider integration
* 2FA setting at account level
* 2FA setting at user level, controllable only by admins

Email OTP and password reset should use Resend. Resend API key, verified sender/domain, and from-address will be configured through environment variables or secure settings.

2FA rules:

* There should be an account-level option to disable 2FA for all users
* Administrators should be able to disable/enable 2FA at individual user level
* Normal users should not be able to disable their own 2FA if admin policy requires it

### Phase 3: Roles, Teams, and Permissions

Goal: Create access control foundation.

Will include:

* Fixed roles: Administrator, Sales Manager, Sales User
* Team management
* Sales group management
* Permission templates
* Module-level permissions
* Action-level permissions
* Field-level permissions for Leads
* Field-level permissions for Activities
* Field-level permissions for Users where custom user fields are exposed
* Configurable mandatory fields for Users, Leads, and Activities
* Field visibility/editability/hide/mask rules managed inside permission templates

Permission examples:

```txt
Can view leads
Can create leads
Can edit leads
Can assign leads
Can export leads
Can upload CSV
Can configure automation
Can view audit logs
```

Field-level examples:

```txt
visible
editable
hidden
masked
```

Field-level access for standard and custom fields should be configured through Permission Templates, not directly on the custom field definition.

Custom field definitions should control field structure. Permission templates should control who can view, edit, hide, or see masked values.

### Phase 3A: Custom Field Management

Goal: Allow admins to create and manage custom fields from the UI.

Custom fields should be supported for:

* Users
* Leads
* Activities

Custom field setup should include:

* Field label
* Field key/API name
* Field type
* Mandatory/optional setting
* Default value
* Validation rule
* Display order
* Active/inactive status

Field access should be configured in Permission Templates:

```txt
visible
editable
hidden
masked
```

### Phase 4: Lead Module

Goal: Build the main CRM entity.

Will include:

* Lead list
* Lead detail page
* Lead create/edit APIs
* Lead ownership
* Team assignment
* User assignment
* Partner/team assignment
* Lead status
* Lead category
* Lead disposition
* Lead automation status
* Lead source/upload batch tracking
* Lead filtering and pagination
* Lead search
* Lead audit trail
* Lead custom fields
* Configurable mandatory lead fields
* Configurable Lead Status list
* Configurable Lead Category list
* Configurable Lead Disposition list
* Lead-level disposition update form
* Configurable extra fields on disposition forms

Important:

Confirmed initial CSV lead fields:

```txt
customer_name - mandatory
mobile_number - mandatory
loan_id / lead_id - mandatory
branch_code - mandatory
branch_name - optional if branch_code is present
loan_offer_amount - mandatory
emi_amount - optional
upload_date - mandatory
loan_closure / offer_expiry_date - mandatory
customer_location - optional
preferred_language - optional
partner_mapping - optional
```

These fields should still be manageable through configurable field/mandatory-field settings where possible.

Phone number rule:

```txt
Lead mobile numbers and user/agent phone numbers must be stored as 10 digits only.
No +91 prefix.
No country code.
No spaces or symbols.
All telephony requests and responses should use 10-digit numbers.
CSV import should validate and store mobile_number as exactly 10 digits.
```

Initial Lead Status values:

```txt
New
Valid
Invalid
Assigned
In Progress
Automation Active
Automation Paused
Converted
Closed
Expired
```

Initial Lead Category values:

```txt
Hot Lead
Warm Lead
Cold Lead
Callback Requested
Need More Details
Not Interested
Wrong Number
Already Applied
Converted
Expired
No Response
```

Initial Lead Disposition values:

```txt
Converted
Interested
Follow-up Required
Callback Scheduled
Documents Pending
Not Interested
Not Reachable
Wrong Number
Escalated
```

All Lead Status, Lead Category, and Lead Disposition values must be configurable from settings.

Partner/user disposition updates should happen from a form at lead level. The disposition form should support extra configurable fields when required.

Example extra disposition fields:

```txt
callback_date
callback_time
remarks
documents_required
next_follow_up_date
```

### Phase 5: CSV Lead Upload

Goal: Allow admins to upload leads by CSV.

Will include:

* CSV upload page
* File validation
* Upload batch record
* CSV parsing
* Required field validation
* Mobile number validation
* Duplicate detection
* Invalid row report
* Valid lead creation
* Branch/team mapping validation
* Upload summary
* Upload history in Settings
* Status shown against every upload batch
* Uploaded CSV copy visible from upload history
* Downloadable uploaded-leads CSV with an extra `upload_status` column per row

Possible upload statuses:

```txt
uploaded
processing
completed
completed_with_errors
failed
```

Possible row statuses:

```txt
valid
invalid
duplicate
skipped
imported
```

Final required CSV columns will be added after you provide them.

Upload history should make it easy to answer:

```txt
Who uploaded the file?
When was it uploaded?
How many rows were uploaded?
How many rows were valid?
How many rows failed?
What is the current processing status?
Can I download the uploaded file with row-level upload status?
```

### Phase 6: Activity Module

Goal: Track everything that happens to a lead.

Will include:

* Activity timeline on lead detail
* Manual notes
* System activities
* Status change activities
* Assignment change activities
* WhatsApp message activities
* Voicebot call activities
* Telephony call activities
* Document shared activities
* Activity custom fields
* Configurable mandatory activity fields

Activities will support metadata so connector payloads and extra details can be stored without changing the table for every new field.

### Phase 7: Task and Follow-Up Module

Goal: Help users manage human follow-up.

Will include:

* Task creation
* Task assignment
* Due date
* Priority
* Task status
* Task type
* Follow-up remarks
* Task list
* Task filters
* Lead-linked tasks

Task types:

```txt
Follow Up
Callback
Document Collection
Verification
Manual Review
```

Task statuses:

```txt
Pending
In Progress
Completed
Missed
Cancelled
```

### Phase 8: Audit Logs

Goal: Keep a record of important changes.

Will include audit logs for:

* User created/updated/deleted
* Role changes
* Team changes
* Permission changes
* Lead created/updated/deleted
* Lead assignment changes
* Lead status changes
* Task changes
* Activity changes
* Connector configuration changes
* Automation changes
* System-generated changes

Audit logs will be read-only.

System-generated changes will show as modified by `System`.

### Phase 9: MCUBE Connector Foundation

Goal: Prepare the integration layer for MCUBE.

Will include:

* Connector configuration storage
* MCUBE provider placeholder
* Webhook ingestion structure
* Raw payload storage
* Signature/secret validation provision
* Event normalization layer
* Error logging
* Retry/failure handling plan

Partial telephony/API requirements received:

* Inbound call route API
* Agent popup API
* Call log complete API
* Click-to-call configuration
* Click-to-call request body with mail merge from lead and user fields

Do not store real org IDs, access keys, or secret keys in source control or planning docs. Use placeholders in documentation and environment variables/config records in implementation.

MCUBE implementation still cannot be fully completed until you provide:

* MCUBE technical documentation
* API base URL
* Authentication method
* Status mapping
* Disposition mapping
* Test credentials

### Phase 10: WhatsApp Module

Goal: Provide a full WhatsApp connector that can be used in automation and by counsellors in a Converse-like chat experience.

Will include:

* WhatsApp connector settings
* Multiple WhatsApp business numbers provision
* Template management
* Template variable mapping
* Template media/header/document provision
* Automation action to send WhatsApp templates
* WhatsApp message records
* Message status tracking
* Template/message send provision
* Free-text chat provision when service window is active
* Customer reply storage
* Button click storage
* Delivery/read/failed webhook handling
* Raw webhook payload storage
* Lead timeline integration
* Counsellor chat UI similar to LeadSquared Converse
* Quick replies
* Attachments where provider supports it
* Opt-in/opt-out field handling
* Real-time message notifications
* Chat analytics/reporting later

Statuses may include:

```txt
queued
sent
delivered
read
failed
replied
```

Final MCUBE WhatsApp statuses will be mapped after documentation is available.

WhatsApp connector should be inspired by LeadSquared WhatsApp + Converse behavior:

* Templates should be usable from automation
* Templates should be usable from counsellor chat
* Templates should support variables/mail merge
* Templates should support media/document attachment provision
* Templates should have an "available in chat/converse" style setting
* Beyond the active service window, counsellors should use approved templates
* Within the active service window, counsellors can use real-time chat/free text if provider supports it
* Counsellors should see conversations in lead context
* Chat should show sent/delivered/read/failed status indicators
* Incoming messages should create or update lead-linked WhatsApp activities
* Incoming messages from unknown numbers can be handled by configurable lead creation/routing settings later
* Chat recent contacts should be user-specific
* Notifications should be configurable, such as notify lead owner or last sender

WhatsApp automation node requirements:

* Select WhatsApp connector/account/number
* Select approved template
* Show only variables required by the selected template
* For each variable, provide dropdown to select Lead, User, Activity, or custom field values
* Support media/document URL mapping from Lead or Activity fields where template requires it
* Store request/response logs
* Store raw provider response
* Create WhatsApp activity on lead

Counsellor chat requirements:

* Chat entry from lead detail
* Chat inbox/recent contacts
* Search leads/conversations
* View conversation in lead context
* Send approved template
* Send free text if service window is active
* Send/receive supported media where provider supports it
* Quick replies by category
* Real-time inbound message notification
* Message status indicators
* Permission-template based masking for sensitive lead fields

### Phase 11: Voicebot Module

Goal: Provide a configurable voicebot connector that can trigger calls from automation, accept result webhooks, and map voicebot results into activities.

Will include:

* Voicebot connector settings
* Postman-like API call configuration for triggering voicebot
* Request method, URL, headers, query params, and body template
* Request/response type settings
* Response success keyword or success-path configuration
* Test call option
* Automation action to trigger voicebot
* Variable extraction from trigger body template
* Variable mapping UI in automation
* Webhook URL generation
* Sample webhook body paste box
* Webhook sample-body parser
* Mapping from webhook sample fields to voicebot activity fields
* Voicebot call records
* Call status
* Recording URL
* Transcript
* Summary
* Intent
* Disposition
* Raw payload
* Lead timeline integration

Voicebot trigger body variable behavior:

* Admin configures trigger API body in connector settings
* If body contains variables, the system extracts only those variables
* When the connector is used in automation, the automation node asks only for those extracted variables
* Each extracted variable should have a dropdown to map a Lead, User, Activity, or custom field
* The automation node should not show unrelated variables

Example:

```json
{
  "phone": "{{lead_phone}}",
  "name": "{{customer_name}}",
  "language": "{{preferred_language}}"
}
```

Automation node should ask for:

```txt
lead_phone
customer_name
preferred_language
```

Webhook mapping behavior:

* System generates a webhook URL for the voicebot connector
* Admin can paste sample webhook body
* System parses the sample JSON/form body
* Admin maps sample fields to voicebot activity fields
* Admin can map to standard fields such as status, recording URL, transcript, summary, intent, disposition, duration, started_at, ended_at
* Admin can map to custom activity fields
* Raw webhook payload must always be stored
* Unmapped fields can remain in metadata JSON

Possible dispositions:

```txt
Interested
Need More Details
Request Callback
Already Applied
Call Later
Not Interested
Wrong Number
Do Not Contact
No Response
Not Reachable
```

Final disposition values will be confirmed later.

### Phase 12: Telephony Module

Goal: Support click-to-call and call logs.

Will include:

* Click-to-call API structure
* Incoming call webhook provision
* Inbound call route API
* Agent popup API
* Call log complete API
* Call log storage
* Agent/user mapping
* Call recording URL
* Call disposition
* Lead timeline integration
* Telephony connector configuration UI
* Mail-merge support from Lead and User fields in click-to-call request body
* Raw payload storage for all route, popup, and call log events

Inbound call route API:

Purpose: telephony provider passes the caller/lead phone number and CRM returns the agent phone number that should receive the call.

Expected behavior:

```txt
Method: GET
Query param: caller_id=<lead_or_caller_phone>
Response content type: text/plain
Response body: agent phone number only
```

Reference pattern with placeholders:

```txt
GET /webhooks/telephony/lead-route?caller_id=9845098450
Response: 9123456789
```

Use clean Unnatify API URLs, not LeadSquared-compatible URL paths with org/access/secret path parameters.

Routing logic should:

* Find lead by `caller_id`
* Determine assigned user/team/agent
* Return mapped agent phone number
* Log the route request
* Return blank text response if no lead is found or no assigned/mapped agent number is available

Phone format rule:

```txt
caller_id is expected as a 10-digit phone number.
Lead mobile lookup should use the 10-digit stored mobile number.
Returned agent number must also be 10 digits.
```

Agent popup API:

Purpose: telephony provider posts call context so CRM can show/open lead context for the agent.

If the mapped/assigned agent is online, show a real-time popup with lead details.

Agent popup UI requirements:

* Popup should show configurable lead details
* Admin should be able to configure which fields appear in the popup
* Admin should be able to configure which lead-detail tabs/sections are available in the popup
* Popup should include an option to open the full lead detail view in a new browser tab
* Popup should appear in all active browser tabs for that logged-in agent
* If the popup is closed in one tab, it should close from all active tabs for that agent
* Popup close/open state should be synchronized across tabs
* Popup event should be stored for audit/history
* If the agent is not online, store the popup event so it can be shown in recent/missed call notifications later

Expected behavior:

```txt
Method: POST
Content-Type: application/json
Also tolerate application/x-www-form-urlencoded if provider sends legacy format
Response content type: application/json
```

Recommended clean endpoint:

```txt
POST /webhooks/telephony/agent-popup
```

Sample request shape:

```json
{
  "SourceNumber": "9901662111",
  "DestinationNumber": "8067330904",
  "DisplayNumber": "1234567890",
  "Status": "Answered",
  "Direction": "Outbound",
  "CallSessionId": "080673309211440075398",
  "CallDuration": "0",
  "StartTime": "2016-01-29 18:26:38"
}
```

Sample response shape:

```json
{
  "Status": "Success",
  "Message": "Message broadcasted",
  "CallSessionId": "080673309211440075398"
}
```

Call log complete API:

Purpose: telephony provider posts completed call details so CRM stores call log and creates lead activity.

Expected behavior:

```txt
Method: POST
Content-Type: application/json
Also tolerate application/x-www-form-urlencoded if provider sends legacy format
Response content type: application/json
```

Recommended clean endpoint:

```txt
POST /webhooks/telephony/call-log-complete
```

Sample request shape:

```json
{
  "SourceNumber": "9611795983",
  "DestinationNumber": "9611795980",
  "DisplayNumber": "9020897874",
  "StartTime": "2015-08-20 18:26:38",
  "EndTime": "2015-08-20 18:26:38",
  "CallDuration": "12",
  "Status": "Answered",
  "ResourceURL": "https://recordings.example.com/calls/080673309211440075398.mp3",
  "Direction": "Inbound",
  "CallSessionId": "080673309211440075398"
}
```

Sample response shape:

```json
{
  "Status": "Success",
  "Message": "Phone Call Logged Successfully"
}
```

Click-to-call configuration requirements:

* URL
* Custom headers
* HTTP method, GET or POST
* Response keyword
* Request type, such as JSON
* Data template/body
* Response type, such as JSON
* Provider support email
* Test call option
* Request and response logs

Click-to-call body should support mail merge from lead and user fields.

For click-to-call, the agent number should be the logged-in user's 10-digit phone number from the user profile.

Example body:

```json
{
  "HTTP_AUTHORIZATION": "stored-provider-token",
  "exenumber": "{{user.phone}}",
  "custnumber": "{{lead.mobile}}"
}
```

Mail-merge sources should include:

* Lead standard fields
* Lead custom fields
* User standard fields
* User custom fields

Mail-merged phone variables must resolve to 10-digit numbers.

Example variables:

```txt
{{lead.mobile}}
{{lead.customerName}}
{{lead.externalLeadId}}
{{user.phone}}
{{user.email}}
{{lead.custom.loan_type}}
{{user.custom.agent_extension}}
```

Final URL paths and security validation should be confirmed before implementation.

### Phase 13: Assignment Engine

Goal: Create a full-fledged assignment engine that can assign leads to users or teams using configurable rules.

Assignment modes to support:

* Manual assignment
* Branch/team-based assignment
* Location-based assignment
* Product-based assignment
* Language-based assignment
* Priority-based assignment
* Capacity-based assignment
* Round-robin assignment
* Assignment based on lead standard fields
* Assignment based on lead custom fields
* Assignment based on user standard fields
* Assignment based on user custom fields
* Assignment based on activity fields where the automation context includes an activity
* Reassignment rules
* Assignment preview/testing before enabling a rule

Assignment rules should support priority/order, active/inactive status, rule versioning/audit, and clear logs showing why a lead was assigned to a specific user or team.

Assignment should not run only when a lead is created. The assignment engine must be callable from automation at any stage using an Assignment node.

Examples:

```txt
Assign after lead upload
Assign after WhatsApp reply
Assign after voicebot intent
Reassign after callback requested
Assign after disposition changes
Assign after API response
```

Assignment conflict behavior:

```txt
If multiple assignment rules match, the rule with the lowest priority number wins.
Example: priority 1 runs before priority 2.
If multiple matching rules have the same priority, the older rule wins.
If no rule matches, the lead remains unassigned.
```

### Phase 14: Automation Engine

Goal: Allow admins to configure journeys.

No default workflow will be created.

The automation builder should feel close to LeadSquared-style journey building:

* Node-based canvas
* Clicking `+` adds a new node
* If/else nodes
* Multi-condition if/else branches
* Action nodes
* Delay nodes
* Assignment nodes
* API call nodes
* Delete node option
* Clone node option
* Clear visual links between nodes
* Node configuration side panel or modal
* Easy editing without technical knowledge
* Configurable exit conditions in workflow settings, not only as separate nodes

The automation engine should support:

Triggers:

```txt
Lead uploaded
Lead created
Lead updated
WhatsApp status changed
WhatsApp reply received
Voicebot disposition received
Call log received
Task completed
Time delay reached
Offer expiry reached
```

Conditions:

```txt
Lead status equals value
Lead category equals value
WhatsApp reply exists
No response after X days
Voicebot intent equals value
Branch/team equals value
Assigned user exists
Expiry date passed
Lead custom field condition
User custom field condition
Activity field condition
Activity custom field condition
Multi-condition AND/OR groups
```

Actions:

```txt
Send WhatsApp message
Trigger voicebot
Create task
Update lead field
Create activity
Assign lead
Stop automation
Pause automation
Resume automation
Mark expired
Notify user/team
Call external API
```

Assignment node requirements:

* Select an existing assignment rule
* Optionally configure assignment logic directly inside the node
* Support assignment to user or team
* Support reassignment
* Support assignment using lead/user/activity standard and custom fields
* Store assignment run logs
* Show why a user/team was selected
* Allow assignment node at any stage of the workflow, not only lead creation

Automation execution will happen in workers, not directly inside API requests.

API call action requirements:

* Postman-like request builder
* Method selection such as GET, POST, PUT, PATCH, DELETE
* URL field
* Headers
* Query parameters
* Body editor
* Authentication provision where needed
* Test API call option
* Timeout and retry settings
* Store request and response logs
* Mail-merge variables from Lead fields
* Mail-merge variables from Lead custom fields
* Mail-merge variables from Activity fields
* Mail-merge variables from Activity custom fields

API call node security:

* Only Administrator users can create or edit API-call nodes
* Only HTTPS URLs are allowed
* Block localhost URLs
* Block private/internal IP ranges
* Set request timeout
* Limit retry count
* Log request and response
* Mask secrets/tokens in UI and logs
* Store API-call configuration changes in audit logs

Mail-merge examples:

```txt
{{lead.customer_name}}
{{lead.mobile}}
{{lead.custom.loan_type}}
{{activity.disposition}}
{{activity.custom.callback_time}}
```

Workflow exit conditions should be configured at workflow settings level.

Examples:

```txt
Exit if lead is converted
Exit if lead is marked not interested
Exit if customer opted out
Exit if wrong number
Exit if offer expiry date crossed
Exit if max attempts completed
```

### Phase 15: Reports and Dashboards

Goal: Give users visibility into performance.

Initial dashboards:

* Administrator dashboard
* Sales Manager dashboard
* Sales User dashboard

Important metrics:

* Total uploaded leads
* Valid leads
* Invalid leads
* Team-wise leads
* Assigned leads
* WhatsApp messages sent
* WhatsApp replies
* Voicebot calls attempted
* Voicebot calls answered
* Interested leads
* Callback requested leads
* Converted leads
* Expired leads
* Not interested leads

Reports:

* Lead upload report
* Invalid lead report
* Team-wise distribution report
* WhatsApp message report
* WhatsApp response report
* Voicebot call report
* Voicebot intent report
* Assignment report
* Conversion report
* Expired leads report
* Full customer journey report
* Lead automation report

Lead automation report should show:

* Which workflows ran for each lead
* Current automation status
* Started at
* Completed at
* Failed at
* Paused at
* Exit reason
* Step-by-step execution status
* Completed steps
* Pending steps
* Failed steps
* Skipped steps
* Retry attempts
* Error messages

When clicking one automation run, the user should see all steps in order and the status/result of each step.

### Phase 16: Admin Operations Center

Goal: Help administrators monitor the system.

Will include:

* Health page
* Logs viewer
* File viewer
* Read-only database viewer
* Queue viewer

Important safety rules:

* Not visible to normal Administrator users
* Accessible only through a separate backend-controlled custom login
* Separate URL such as `/ops-login`
* Separate backend-created ops users
* Username/password login
* Disabled unless at least one ops user exists
* Ops actions should not be audited unless this requirement changes later
* No arbitrary SQL editor
* Whitelisted database tables only
* Do not expose raw server folders
* Do not expose logs publicly
* Queue dashboard must not be public

---

## 6. Planned Frontend Areas

The frontend will be desktop-first and CRM-focused.

Design direction:

* Use the public `arjunharish77/crm-new` project as the UI reference only
* Keep the architecture from this project plan, not the Supabase-only architecture from that repo
* Use a compact Material-style layout
* Use lighter shades and blue-focused accents
* Make it more compact than the reference where possible
* Use MUI/MUI X Data Grid patterns for dense CRM tables
* Use React Flow-style patterns for the automation builder
* Prefer dense tables, compact filters, slim toolbars, and practical CRM navigation
* Avoid oversized cards, marketing-style sections, and decorative layouts
* Use MUI/MUI X style patterns for data grids, forms, tabs, dialogs, menus, and compact controls

Main sections:

* Login
* Dashboard
* Leads
* Lead detail
* CSV upload
* Tasks
* Activities
* Users
* Teams
* Roles
* Permission templates
* Automation builder
* Connectors
* Reports
* Admin operations
* Settings

The UI should be compact, clear, and data-focused.

It should not look like a marketing landing page.

---

## 7. Planned Backend Modules

The backend will be modular.

Planned modules:

* Auth
* Users
* Roles
* Teams
* Sales Groups
* Permissions
* User Custom Fields
* Leads
* Lead Uploads
* Custom Fields
* Activities
* Tasks
* Audit Logs
* Connectors
* MCUBE
* WhatsApp
* Voicebot
* Telephony
* Assignment
* Automations
* Reports
* Admin Ops
* Health

Each module will have clear responsibilities and API endpoints.

---

## 8. Planned Worker Responsibilities

Workers will handle background work.

Planned worker jobs:

* Process uploaded CSV files
* Validate lead rows
* Import valid leads
* Generate invalid row reports
* Send WhatsApp messages
* Process WhatsApp status updates
* Trigger voicebot calls
* Process voicebot webhooks
* Process telephony webhooks
* Run automation steps
* Schedule delayed automation actions
* Check offer expiry
* Apply stop conditions
* Apply pause conditions
* Assign leads
* Retry failed connector actions

Reason:

Long-running or delayed work should not happen inside normal API requests.

---

## 9. Planned PostgreSQL Tables

This is the expected table direction. The exact schema may evolve during implementation.

Core identity and access:

```txt
users
roles
teams
sales_groups
user_sales_groups
permission_templates
permission_template_modules
permission_template_fields
user_custom_fields
user_custom_field_values
```

Lead management:

```txt
leads
lead_upload_batches
lead_upload_rows
lead_assignments
lead_status_history
lead_custom_fields
lead_custom_field_values
field_definitions
field_mandatory_rules
```

Activity and tasks:

```txt
activities
activity_custom_fields
activity_custom_field_values
tasks
task_comments
```

Connectors:

```txt
connectors
connector_events
whatsapp_messages
whatsapp_connectors
whatsapp_numbers
whatsapp_templates
whatsapp_template_variables
whatsapp_conversations
whatsapp_quick_replies
voicebot_calls
voicebot_connectors
voicebot_trigger_templates
voicebot_trigger_variables
voicebot_webhook_mappings
telephony_calls
telephony_route_requests
telephony_agent_popup_events
telephony_call_log_events
```

Automation:

```txt
automation_workflows
automation_workflow_versions
automation_runs
automation_run_steps
automation_scheduled_jobs
automation_exit_conditions
automation_api_call_logs
```

Assignment:

```txt
assignment_rules
assignment_rule_conditions
assignment_rule_actions
assignment_rule_runs
assignment_rule_run_logs
```

System and operations:

```txt
uploaded_files
audit_logs
system_logs
app_settings
health_check_logs
```

Reports may initially use queries/views on these tables instead of separate report tables.

---

## 10. How PostgreSQL Tables Will Be Created

Tables will be created using Prisma migrations.

This means we will not manually create tables one by one inside PostgreSQL.

The process will be:

1. Define the database models in Prisma's schema.
2. Generate a migration from those models.
3. Prisma creates SQL migration files.
4. Apply the migration to PostgreSQL.
5. Prisma creates or changes the actual tables in the database.

### Local Development Flow

Where: Local computer, inside the backend project.

During development, after defining or changing database models, we will run a migration command.

Typical command:

```bash
npx prisma migrate dev --name migration_name
```

Example migration names:

```txt
init_identity_tables
add_leads
add_activities_tasks
add_connectors
add_automation_tables
```

This will:

* Create a migration folder
* Create SQL migration files
* Apply the migration to the local PostgreSQL database
* Update Prisma Client

### Production/VPS Flow

Where: VPS terminal, inside `/opt/unnatify-crm`.

In production we will not use the development migration command.

Production will use:

```bash
docker compose exec backend npx prisma migrate deploy
```

This command applies already-created migration files to the production PostgreSQL database.

Production should not auto-generate new migrations.

Production should only apply migrations that were already tested locally.

### Seed Data

After tables are created, we will seed required base data.

Seed data may include:

* System user
* Administrator role
* Sales Manager role
* Sales User role
* Default permission templates
* First Administrator user
* Default app settings

Typical command:

```bash
docker compose exec backend npm run seed
```

The exact seed command will be finalized after the project is scaffolded.

### How We Will Check Tables

On VPS:

```bash
docker compose exec postgres psql -U unnatify_user -d unnatify_crm
```

Inside PostgreSQL:

```sql
\dt
```

This lists the tables.

To exit:

```sql
\q
```

### Important Database Rules

* Use migrations for schema changes.
* Do not manually edit production tables unless absolutely necessary.
* Do not run destructive schema commands in production casually.
* Always take a backup before production migrations.
* Test restore process before relying on backups.
* Use UUID primary keys.
* Use `created_at` and `updated_at` on major tables.
* Use `created_by` and `updated_by` where user attribution matters.
* Use JSONB for raw connector payloads and flexible metadata.
* Add indexes for fields used in filtering/searching.

---

## 11. What Will Be Built First

Recommended first coding milestone:

1. Project scaffold
2. Docker Compose local setup
3. PostgreSQL and Redis containers
4. Backend health checks
5. Prisma setup
6. Initial database schema
7. Seed roles and System user
8. Auth foundation
9. Basic frontend shell
10. Login page

Reason:

Before building CRM screens, we need the system to start properly, connect to the database, and have authentication.

---

## 12. What Will Stay Pending Until You Provide Details

These items are intentionally pending:

* MCUBE API documentation
* MCUBE webhook payload samples
* MCUBE test credentials
* MCUBE status/disposition mapping
* MCUBE WhatsApp send/template API details
* MCUBE WhatsApp status/reply webhook payloads
* MCUBE voicebot trigger API details
* MCUBE voicebot result webhook payloads
* Resend API key, verified sender/domain, and from-address

We can still build the foundation before these are available.

We should not finalize connector behavior or lead import validation until these are provided.

---

## 13. Gaps Identified and Corrections Made

These gaps were identified from the latest requirements and corrected in this plan:

* User/team relationship changed from multiple teams to exactly one team per user.
* User custom fields were added.
* Lead custom fields and Activity custom fields remain required.
* Mandatory field configuration was added for Users, Leads, and Activities.
* Sales group management was made required.
* Assignment engine was expanded into a full configurable rule engine.
* Assignment rules can use user-level custom fields.
* Upload history was added under Settings.
* Upload history includes batch status and downloadable CSV with row-level `upload_status`.
* Lead automation report was added with drill-down into workflow run steps.
* Automation builder was expanded to a LeadSquared-style node builder.
* Automation supports clone/delete node controls.
* Automation supports if/else and multi-condition if/else nodes.
* Workflow exit conditions are configurable at workflow settings level.
* External API call action was added with Postman-like configuration.
* API call action supports mail-merge from lead and activity standard/custom fields.
* Admin Operations Center access changed from Administrator access to separate backend-controlled custom ops login without ops-action audit.
* Design direction was updated to use `arjunharish77/crm-new` as a UI reference only.
* The referenced repo uses a Supabase-first architecture, but this project will keep NestJS, PostgreSQL, Redis, BullMQ, and workers.
* The referenced theme currently has strong green Material colors; this project should use lighter shades and blue-focused accents instead.

Remaining gaps before implementation:

* Exact custom field behavior by role/team/module needs final confirmation during schema design.
* Exact mandatory field rules need final screens and examples.
* Exact upload history columns should be finalized before CSV upload implementation.

---

## 14. Key Build Principles

The system should be:

* Modular
* Secure
* Audit-friendly
* Queue-based for background work
* Configurable instead of hardcoded
* Easy to deploy on VPS
* Easy to expand later
* Practical for day-one production

Avoid:

* Kubernetes at this stage
* PM2 if using Docker
* Public PostgreSQL
* Public Redis
* Hardcoded automation workflows
* Unbounded database queries
* Loading huge tables into the browser
* Manual database changes without migrations

---

## 15. Final Understanding Before Code

We will build a full CRM foundation first.

The first code phase should establish the platform base:

```txt
Frontend + Backend + Workers + PostgreSQL + Redis + Prisma + Auth + Roles + Teams + Health Checks
```

After that, we will build:

```txt
Leads + CSV Upload + Activities + Tasks + Audit Logs
```

Then:

```txt
MCUBE Connectors + Automation + Reports + Admin Ops
```

PostgreSQL tables will be created through Prisma migrations, not manually.
