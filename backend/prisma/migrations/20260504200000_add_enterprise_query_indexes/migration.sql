CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

CREATE INDEX "ConnectorEvent_status_idx" ON "ConnectorEvent"("status");
CREATE INDEX "ConnectorEvent_createdAt_idx" ON "ConnectorEvent"("createdAt");

CREATE INDEX "WhatsAppNumber_connectorId_idx" ON "WhatsAppNumber"("connectorId");
CREATE INDEX "WhatsAppNumber_phoneNumber_idx" ON "WhatsAppNumber"("phoneNumber");
CREATE INDEX "WhatsAppNumber_isActive_idx" ON "WhatsAppNumber"("isActive");
CREATE INDEX "WhatsAppTemplate_connectorId_idx" ON "WhatsAppTemplate"("connectorId");
CREATE INDEX "WhatsAppTemplate_status_idx" ON "WhatsAppTemplate"("status");
CREATE INDEX "WhatsAppTemplate_availableInChat_idx" ON "WhatsAppTemplate"("availableInChat");
CREATE INDEX "WhatsAppQuickReply_channel_idx" ON "WhatsAppQuickReply"("channel");
CREATE INDEX "WhatsAppQuickReply_isActive_idx" ON "WhatsAppQuickReply"("isActive");

CREATE INDEX "VoicebotTriggerTemplate_connectorId_idx" ON "VoicebotTriggerTemplate"("connectorId");
CREATE INDEX "VoicebotWebhookMapping_connectorId_idx" ON "VoicebotWebhookMapping"("connectorId");
CREATE INDEX "VoicebotWebhookMapping_isActive_idx" ON "VoicebotWebhookMapping"("isActive");

CREATE INDEX "TelephonyCall_agentUserId_idx" ON "TelephonyCall"("agentUserId");
CREATE INDEX "TelephonyCall_callStatus_idx" ON "TelephonyCall"("callStatus");
CREATE INDEX "TelephonyCall_startedAt_idx" ON "TelephonyCall"("startedAt");
CREATE INDEX "TelephonyRouteRequest_callerId_idx" ON "TelephonyRouteRequest"("callerId");
CREATE INDEX "TelephonyRouteRequest_leadId_idx" ON "TelephonyRouteRequest"("leadId");
CREATE INDEX "TelephonyRouteRequest_createdAt_idx" ON "TelephonyRouteRequest"("createdAt");
CREATE INDEX "TelephonyAgentPopupEvent_leadId_idx" ON "TelephonyAgentPopupEvent"("leadId");
CREATE INDEX "TelephonyAgentPopupEvent_callSessionId_idx" ON "TelephonyAgentPopupEvent"("callSessionId");
CREATE INDEX "TelephonyAgentPopupEvent_createdAt_idx" ON "TelephonyAgentPopupEvent"("createdAt");
CREATE INDEX "TelephonyCallLogEvent_leadId_idx" ON "TelephonyCallLogEvent"("leadId");
CREATE INDEX "TelephonyCallLogEvent_callSessionId_idx" ON "TelephonyCallLogEvent"("callSessionId");
CREATE INDEX "TelephonyCallLogEvent_status_idx" ON "TelephonyCallLogEvent"("status");
CREATE INDEX "TelephonyCallLogEvent_createdAt_idx" ON "TelephonyCallLogEvent"("createdAt");

CREATE INDEX "AutomationWorkflowVersion_isPublished_idx" ON "AutomationWorkflowVersion"("isPublished");
CREATE INDEX "AutomationRun_workflowId_idx" ON "AutomationRun"("workflowId");
CREATE INDEX "AutomationRunStep_nodeType_idx" ON "AutomationRunStep"("nodeType");
CREATE INDEX "AutomationRunStep_status_idx" ON "AutomationRunStep"("status");
CREATE INDEX "AutomationRunStep_startedAt_idx" ON "AutomationRunStep"("startedAt");
CREATE INDEX "AutomationScheduledJob_runId_idx" ON "AutomationScheduledJob"("runId");
CREATE INDEX "AutomationScheduledJob_queueJobId_idx" ON "AutomationScheduledJob"("queueJobId");
CREATE INDEX "AutomationScheduledJob_runAt_idx" ON "AutomationScheduledJob"("runAt");
CREATE INDEX "AutomationScheduledJob_status_idx" ON "AutomationScheduledJob"("status");
CREATE INDEX "AutomationExitCondition_workflowId_idx" ON "AutomationExitCondition"("workflowId");
CREATE INDEX "AutomationExitCondition_isActive_idx" ON "AutomationExitCondition"("isActive");
CREATE INDEX "AutomationApiCallLog_workflowId_idx" ON "AutomationApiCallLog"("workflowId");
CREATE INDEX "AutomationApiCallLog_runId_idx" ON "AutomationApiCallLog"("runId");
CREATE INDEX "AutomationApiCallLog_status_idx" ON "AutomationApiCallLog"("status");
CREATE INDEX "AutomationApiCallLog_createdAt_idx" ON "AutomationApiCallLog"("createdAt");

CREATE INDEX "AssignmentRuleRun_ruleId_idx" ON "AssignmentRuleRun"("ruleId");
CREATE INDEX "AssignmentRuleRun_leadId_idx" ON "AssignmentRuleRun"("leadId");
CREATE INDEX "AssignmentRuleRun_status_idx" ON "AssignmentRuleRun"("status");
CREATE INDEX "AssignmentRuleRun_createdAt_idx" ON "AssignmentRuleRun"("createdAt");
CREATE INDEX "AssignmentRuleRunLog_runId_idx" ON "AssignmentRuleRunLog"("runId");
CREATE INDEX "AssignmentRuleRunLog_createdAt_idx" ON "AssignmentRuleRunLog"("createdAt");

CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_changedBy_idx" ON "AuditLog"("changedBy");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
