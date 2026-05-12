-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(10),
    "passwordHash" TEXT,
    "roleId" TEXT NOT NULL,
    "teamId" TEXT,
    "permissionTemplateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorDisabledByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSalesGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salesGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSalesGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionTemplateModule" (
    "id" TEXT NOT NULL,
    "permissionTemplateId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canAssign" BOOLEAN NOT NULL DEFAULT false,
    "canBulkUpload" BOOLEAN NOT NULL DEFAULT false,
    "canConfigureAutomation" BOOLEAN NOT NULL DEFAULT false,
    "canManageConnector" BOOLEAN NOT NULL DEFAULT false,
    "canViewAuditLogs" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermissionTemplateModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionTemplateField" (
    "id" TEXT NOT NULL,
    "permissionTemplateId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "access" TEXT NOT NULL,

    CONSTRAINT "PermissionTemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "defaultValue" TEXT,
    "validation" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMandatoryRule" (
    "id" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "roleId" TEXT,
    "teamId" TEXT,
    "context" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMandatoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCustomField" (
    "id" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCustomFieldValue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "externalLeadId" TEXT,
    "customerName" TEXT NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "email" TEXT,
    "branchCode" TEXT,
    "branchName" TEXT,
    "teamId" TEXT,
    "assignedUserId" TEXT,
    "assignedTeamId" TEXT,
    "assignedPartnerId" TEXT,
    "offerAmount" DECIMAL(65,30),
    "emiAmount" DECIMAL(65,30),
    "preferredLanguage" TEXT,
    "location" TEXT,
    "uploadDate" TIMESTAMP(3),
    "offerExpiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'New',
    "category" TEXT,
    "disposition" TEXT,
    "automationStatus" TEXT,
    "sourceBatchId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadUploadBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFilePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadUploadRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "uploadStatus" TEXT NOT NULL,
    "errorMessage" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadUploadRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "assignedTeamId" TEXT,
    "reason" TEXT,
    "ruleRunId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStatusHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "oldCategory" TEXT,
    "newCategory" TEXT,
    "oldDisposition" TEXT,
    "newDisposition" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCustomField" (
    "id" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCustomFieldValue" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "taskId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "disposition" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityCustomField" (
    "id" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityCustomFieldValue" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "remarks" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorEvent" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'received',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConnector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppNumber" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "phoneNumber" VARCHAR(10) NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "language" TEXT,
    "content" TEXT NOT NULL,
    "mediaConfig" JSONB,
    "availableInChat" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplateVariable" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "variableKey" TEXT NOT NULL,
    "displayName" TEXT,
    "defaultMapping" JSONB,

    CONSTRAINT "WhatsAppTemplateVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "serviceWindowUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "leadId" TEXT,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "rawPayload" JSONB,
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppQuickReply" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WhatsApp',
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppQuickReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicebotConnector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoicebotConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicebotTriggerTemplate" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headers" JSONB,
    "queryParams" JSONB,
    "bodyTemplate" JSONB,
    "responseConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoicebotTriggerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicebotTriggerVariable" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "variableKey" TEXT NOT NULL,
    "displayName" TEXT,
    "defaultMapping" JSONB,

    CONSTRAINT "VoicebotTriggerVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicebotWebhookMapping" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "sampleBody" JSONB,
    "fieldMappings" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoicebotWebhookMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicebotCall" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "providerCallId" TEXT,
    "callStatus" TEXT,
    "recordingUrl" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "intent" TEXT,
    "disposition" TEXT,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoicebotCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelephonyCall" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "phoneNumber" VARCHAR(10),
    "agentUserId" TEXT,
    "callDirection" TEXT,
    "callStatus" TEXT,
    "callDuration" INTEGER,
    "recordingUrl" TEXT,
    "providerCallId" TEXT,
    "disposition" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelephonyCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelephonyRouteRequest" (
    "id" TEXT NOT NULL,
    "callerId" VARCHAR(10) NOT NULL,
    "leadId" TEXT,
    "returnedAgentNumber" VARCHAR(10),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelephonyRouteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelephonyAgentPopupEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "callSessionId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelephonyAgentPopupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelephonyCallLogEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "callSessionId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelephonyCallLogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationWorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationWorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "exitReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationScheduledJob" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "nodeId" TEXT,
    "queueJobId" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExitCondition" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExitCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationApiCallLog" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "runId" TEXT,
    "nodeId" TEXT,
    "request" JSONB NOT NULL,
    "response" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "targetType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRuleCondition" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentRuleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRuleAction" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentRuleAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRuleRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "leadId" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentRuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRuleRunLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentRuleRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedBy" TEXT,
    "changedByType" TEXT NOT NULL DEFAULT 'user',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalesGroup_name_key" ON "SalesGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserSalesGroup_userId_salesGroupId_key" ON "UserSalesGroup"("userId", "salesGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionTemplate_name_key" ON "PermissionTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionTemplateModule_permissionTemplateId_moduleName_key" ON "PermissionTemplateModule"("permissionTemplateId", "moduleName");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionTemplateField_permissionTemplateId_moduleName_fie_key" ON "PermissionTemplateField"("permissionTemplateId", "moduleName", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_moduleName_fieldKey_key" ON "FieldDefinition"("moduleName", "fieldKey");

-- CreateIndex
CREATE INDEX "FieldMandatoryRule_moduleName_fieldKey_idx" ON "FieldMandatoryRule"("moduleName", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserCustomField_fieldKey_key" ON "UserCustomField"("fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserCustomFieldValue_userId_fieldId_key" ON "UserCustomFieldValue"("userId", "fieldId");

-- CreateIndex
CREATE INDEX "Lead_mobile_idx" ON "Lead"("mobile");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_category_idx" ON "Lead"("category");

-- CreateIndex
CREATE INDEX "Lead_disposition_idx" ON "Lead"("disposition");

-- CreateIndex
CREATE INDEX "Lead_teamId_idx" ON "Lead"("teamId");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");

-- CreateIndex
CREATE INDEX "LeadUploadRow_batchId_idx" ON "LeadUploadRow"("batchId");

-- CreateIndex
CREATE INDEX "LeadUploadRow_uploadStatus_idx" ON "LeadUploadRow"("uploadStatus");

-- CreateIndex
CREATE INDEX "LeadAssignment_leadId_idx" ON "LeadAssignment"("leadId");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_leadId_idx" ON "LeadStatusHistory"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCustomField_fieldKey_key" ON "LeadCustomField"("fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCustomFieldValue_leadId_fieldId_key" ON "LeadCustomFieldValue"("leadId", "fieldId");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCustomField_fieldKey_key" ON "ActivityCustomField"("fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCustomFieldValue_activityId_fieldId_key" ON "ActivityCustomFieldValue"("activityId", "fieldId");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_assignedTo_idx" ON "Task"("assignedTo");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "ConnectorEvent_connectorId_idx" ON "ConnectorEvent"("connectorId");

-- CreateIndex
CREATE INDEX "ConnectorEvent_eventType_idx" ON "ConnectorEvent"("eventType");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_leadId_idx" ON "WhatsAppConversation"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_userId_idx" ON "WhatsAppConversation"("userId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_leadId_idx" ON "WhatsAppMessage"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_conversationId_idx" ON "WhatsAppMessage"("conversationId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");

-- CreateIndex
CREATE INDEX "VoicebotTriggerVariable_templateId_idx" ON "VoicebotTriggerVariable"("templateId");

-- CreateIndex
CREATE INDEX "VoicebotCall_leadId_idx" ON "VoicebotCall"("leadId");

-- CreateIndex
CREATE INDEX "VoicebotCall_providerCallId_idx" ON "VoicebotCall"("providerCallId");

-- CreateIndex
CREATE INDEX "TelephonyCall_leadId_idx" ON "TelephonyCall"("leadId");

-- CreateIndex
CREATE INDEX "TelephonyCall_providerCallId_idx" ON "TelephonyCall"("providerCallId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationWorkflowVersion_workflowId_version_key" ON "AutomationWorkflowVersion"("workflowId", "version");

-- CreateIndex
CREATE INDEX "AutomationRunStep_runId_idx" ON "AutomationRunStep"("runId");

-- CreateIndex
CREATE INDEX "AuditLog_moduleName_idx" ON "AuditLog"("moduleName");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_permissionTemplateId_fkey" FOREIGN KEY ("permissionTemplateId") REFERENCES "PermissionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSalesGroup" ADD CONSTRAINT "UserSalesGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSalesGroup" ADD CONSTRAINT "UserSalesGroup_salesGroupId_fkey" FOREIGN KEY ("salesGroupId") REFERENCES "SalesGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionTemplateModule" ADD CONSTRAINT "PermissionTemplateModule_permissionTemplateId_fkey" FOREIGN KEY ("permissionTemplateId") REFERENCES "PermissionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionTemplateField" ADD CONSTRAINT "PermissionTemplateField_permissionTemplateId_fkey" FOREIGN KEY ("permissionTemplateId") REFERENCES "PermissionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomFieldValue" ADD CONSTRAINT "UserCustomFieldValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomFieldValue" ADD CONSTRAINT "UserCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "UserCustomField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "LeadUploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadUploadRow" ADD CONSTRAINT "LeadUploadRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeadUploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCustomFieldValue" ADD CONSTRAINT "LeadCustomFieldValue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCustomFieldValue" ADD CONSTRAINT "LeadCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "LeadCustomField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCustomFieldValue" ADD CONSTRAINT "ActivityCustomFieldValue_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCustomFieldValue" ADD CONSTRAINT "ActivityCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ActivityCustomField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplateVariable" ADD CONSTRAINT "WhatsAppTemplateVariable_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationWorkflowVersion" ADD CONSTRAINT "AutomationWorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunStep" ADD CONSTRAINT "AutomationRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleCondition" ADD CONSTRAINT "AssignmentRuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AssignmentRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleAction" ADD CONSTRAINT "AssignmentRuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AssignmentRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleRunLog" ADD CONSTRAINT "AssignmentRuleRunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AssignmentRuleRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
