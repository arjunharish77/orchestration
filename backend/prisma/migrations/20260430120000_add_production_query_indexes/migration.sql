-- Add indexes used by production list filters, dashboard/report scopes, and recent activity reports.

CREATE INDEX IF NOT EXISTS "Lead_assignedTeamId_idx" ON "Lead"("assignedTeamId");
CREATE INDEX IF NOT EXISTS "Lead_branchCode_idx" ON "Lead"("branchCode");
CREATE INDEX IF NOT EXISTS "Lead_externalLeadId_idx" ON "Lead"("externalLeadId");
CREATE INDEX IF NOT EXISTS "Lead_sourceBatchId_idx" ON "Lead"("sourceBatchId");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX IF NOT EXISTS "Lead_updatedAt_idx" ON "Lead"("updatedAt");

CREATE INDEX IF NOT EXISTS "LeadUploadBatch_status_idx" ON "LeadUploadBatch"("status");
CREATE INDEX IF NOT EXISTS "LeadUploadBatch_createdAt_idx" ON "LeadUploadBatch"("createdAt");

CREATE INDEX IF NOT EXISTS "AutomationRun_leadId_idx" ON "AutomationRun"("leadId");
CREATE INDEX IF NOT EXISTS "AutomationRun_status_idx" ON "AutomationRun"("status");
CREATE INDEX IF NOT EXISTS "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "VoicebotCall_createdAt_idx" ON "VoicebotCall"("createdAt");
CREATE INDEX IF NOT EXISTS "TelephonyCall_createdAt_idx" ON "TelephonyCall"("createdAt");
