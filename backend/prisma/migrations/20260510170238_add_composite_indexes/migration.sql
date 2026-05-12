-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_disposition_idx" ON "Activity"("disposition");

-- CreateIndex
CREATE INDEX "Activity_leadId_type_idx" ON "Activity"("leadId", "type");

-- CreateIndex
CREATE INDEX "Activity_leadId_createdAt_idx" ON "Activity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_status_idx" ON "Lead"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "Lead_teamId_status_idx" ON "Lead"("teamId", "status");

-- CreateIndex
CREATE INDEX "Task_updatedAt_idx" ON "Task"("updatedAt");

-- CreateIndex
CREATE INDEX "Task_assignedTo_status_idx" ON "Task"("assignedTo", "status");
