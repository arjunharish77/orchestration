# Data Model Reference Integrity

This file documents where Unnatify CRM uses database foreign keys and where it intentionally stores denormalized references. The goal is to keep production history stable even when operational records are deleted, renamed, or archived.

## Enforced Foreign Keys

These relations should stay enforced because the child record is not useful without its parent:

- `User.roleId -> Role.id`
- `User.teamId -> Team.id`
- `User.permissionTemplateId -> PermissionTemplate.id`
- `AuthSession.userId -> User.id`
- `UserSalesGroup.userId -> User.id`
- `UserSalesGroup.salesGroupId -> SalesGroup.id`
- `PermissionTemplateModule.permissionTemplateId -> PermissionTemplate.id`
- `PermissionTemplateField.permissionTemplateId -> PermissionTemplate.id`
- `Lead.teamId -> Team.id`
- `Lead.sourceBatchId -> LeadUploadBatch.id`
- `LeadUploadRow.batchId -> LeadUploadBatch.id`
- `LeadCustomFieldValue.leadId -> Lead.id`
- `LeadCustomFieldValue.fieldId -> LeadCustomField.id`
- `UserCustomFieldValue.userId -> User.id`
- `UserCustomFieldValue.fieldId -> UserCustomField.id`
- `Activity.leadId -> Lead.id`
- `ActivityCustomFieldValue.activityId -> Activity.id`
- `ActivityCustomFieldValue.fieldId -> ActivityCustomField.id`
- `Task.leadId -> Lead.id`
- `TaskComment.taskId -> Task.id`
- `WhatsAppTemplateVariable.templateId -> WhatsAppTemplate.id`
- `AutomationWorkflowVersion.workflowId -> AutomationWorkflow.id`
- `AutomationRunStep.runId -> AutomationRun.id`
- `AssignmentRuleCondition.ruleId -> AssignmentRule.id`
- `AssignmentRuleAction.ruleId -> AssignmentRule.id`
- `AssignmentRuleRunLog.runId -> AssignmentRuleRun.id`
- `ScheduledReport.savedReportId -> SavedReport.id` with `ON DELETE SET NULL`

## Intentional Denormalized References

These fields intentionally do not use hard foreign keys. They preserve historical events and allow retention cleanup without breaking primary business records.

- `Lead.assignedUserId`, `Lead.assignedTeamId`, `Lead.assignedPartnerId`
  - Stored as historical assignment pointers because users/teams/partners may be disabled or restructured while the lead history must remain readable.

- `Lead.createdBy`, `Lead.updatedBy`, `Activity.createdBy`, `Task.createdBy`, `Task.updatedBy`, `LeadAssignment.createdBy`, `LeadStatusHistory.createdBy`
  - Stored as actor identifiers. These may be user IDs, system actors, worker actors, ops actors, or future service accounts.

- `LeadAssignment.assignedUserId`, `LeadAssignment.assignedTeamId`, `LeadAssignment.ruleRunId`
  - Assignment history must remain even if a user, team, or rule is archived.

- `AssignmentRuleRun.ruleId`, `AssignmentRuleRun.leadId`
  - Run logs are audit-style facts. They should survive rule or lead archival/export flows.

- `AutomationRun.workflowId`, `AutomationRun.leadId`, `AutomationScheduledJob.runId`
  - Automation execution history can outlive workflow drafts, versions, and queued jobs.

- `AutomationApiCallLog.workflowId`, `AutomationApiCallLog.runId`
  - Connector/API logs are event facts and are governed by retention policy.

- `ConnectorEvent.connectorId`
  - Connector logs should survive connector replacement, rotation, or deletion.

- `WhatsAppNumber.connectorId`, `WhatsAppTemplate.connectorId`, `WhatsAppConversation.leadId`, `WhatsAppConversation.userId`, `WhatsAppMessage.conversationId`, `WhatsAppMessage.leadId`
  - Messaging history is retained as event history and may point to archived conversations, users, or leads.

- `VoicebotTriggerTemplate.connectorId`, `VoicebotWebhookMapping.connectorId`, `VoicebotCall.leadId`
  - Voicebot provider details can change independently from historical calls.

- `TelephonyCall.leadId`, `TelephonyCall.agentUserId`, `TelephonyRouteRequest.leadId`, `TelephonyAgentPopupEvent.leadId`, `TelephonyAgentPopupEvent.agentUserId`, `TelephonyCallLogEvent.leadId`
  - Telephony records must remain traceable even if lead/user data is archived under retention.

- `UploadedFile.uploadedBy`, `ReportExport.requestedBy`, `SavedReport.createdBy`, `SavedReport.updatedBy`, `ScheduledReport.createdBy`, `ScheduledReport.updatedBy`
  - File/report ownership is stored as actor identity so generated artifacts can remain downloadable or auditable even if the user is deactivated.

- `AuditLog.changedBy`
  - Audit logs are immutable facts. The actor can be a user ID, email, ops actor, worker, or system actor.

## Operational Rules

- Do not add cascade deletes to audit, connector event, telephony, automation run, assignment run, upload, or report export history unless the retention policy explicitly requires it.
- Prefer soft disable/deactivation for users, teams, connectors, workflows, and templates.
- Use retention jobs for historical cleanup, not ad hoc deletes.
- If a denormalized ID is shown in the UI, resolve it to a display name where possible and fall back to a safe label, not a raw UUID.
- If a new high-volume table is added, add indexes for common filters at the same time as the table migration.
