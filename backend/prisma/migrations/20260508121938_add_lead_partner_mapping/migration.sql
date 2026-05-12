-- DropForeignKey
ALTER TABLE "ActivityCustomFieldValue" DROP CONSTRAINT "ActivityCustomFieldValue_activityId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityCustomFieldValue" DROP CONSTRAINT "ActivityCustomFieldValue_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRuleAction" DROP CONSTRAINT "AssignmentRuleAction_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRuleCondition" DROP CONSTRAINT "AssignmentRuleCondition_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRuleRunLog" DROP CONSTRAINT "AssignmentRuleRunLog_runId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationRunStep" DROP CONSTRAINT "AutomationRunStep_runId_fkey";

-- DropForeignKey
ALTER TABLE "LeadCustomFieldValue" DROP CONSTRAINT "LeadCustomFieldValue_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "LeadCustomFieldValue" DROP CONSTRAINT "LeadCustomFieldValue_leadId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "UserCustomFieldValue" DROP CONSTRAINT "UserCustomFieldValue_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "UserCustomFieldValue" DROP CONSTRAINT "UserCustomFieldValue_userId_fkey";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "partnerMapping" TEXT;

-- CreateIndex
CREATE INDEX "VoicebotCall_callStatus_idx" ON "VoicebotCall"("callStatus");

-- CreateIndex
CREATE INDEX "VoicebotCall_startedAt_idx" ON "VoicebotCall"("startedAt");

-- AddForeignKey
ALTER TABLE "UserCustomFieldValue" ADD CONSTRAINT "UserCustomFieldValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomFieldValue" ADD CONSTRAINT "UserCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "UserCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCustomFieldValue" ADD CONSTRAINT "LeadCustomFieldValue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCustomFieldValue" ADD CONSTRAINT "LeadCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "LeadCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCustomFieldValue" ADD CONSTRAINT "ActivityCustomFieldValue_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCustomFieldValue" ADD CONSTRAINT "ActivityCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ActivityCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunStep" ADD CONSTRAINT "AutomationRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleCondition" ADD CONSTRAINT "AssignmentRuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AssignmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleAction" ADD CONSTRAINT "AssignmentRuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AssignmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleRunLog" ADD CONSTRAINT "AssignmentRuleRunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AssignmentRuleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
