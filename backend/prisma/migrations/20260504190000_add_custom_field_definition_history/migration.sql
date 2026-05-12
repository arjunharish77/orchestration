CREATE TABLE "CustomFieldDefinitionHistory" (
  "id" TEXT NOT NULL,
  "moduleName" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "changedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomFieldDefinitionHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomFieldDefinitionHistory_moduleName_fieldKey_idx" ON "CustomFieldDefinitionHistory"("moduleName", "fieldKey");
CREATE INDEX "CustomFieldDefinitionHistory_fieldId_idx" ON "CustomFieldDefinitionHistory"("fieldId");
