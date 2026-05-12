ALTER TABLE "ActivityCustomField"
ADD COLUMN "activityTypeCode" TEXT NOT NULL DEFAULT 'ALL';

DROP INDEX IF EXISTS "ActivityCustomField_fieldKey_key";

CREATE UNIQUE INDEX "ActivityCustomField_activityTypeCode_fieldKey_key"
ON "ActivityCustomField"("activityTypeCode", "fieldKey");

CREATE INDEX "ActivityCustomField_activityTypeCode_idx"
ON "ActivityCustomField"("activityTypeCode");
