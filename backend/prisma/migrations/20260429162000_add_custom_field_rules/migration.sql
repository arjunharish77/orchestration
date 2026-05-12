-- AlterTable
ALTER TABLE "UserCustomField" ADD COLUMN "defaultValue" JSONB;
ALTER TABLE "UserCustomField" ADD COLUMN "validation" JSONB;
ALTER TABLE "UserCustomField" ADD COLUMN "options" JSONB;

-- AlterTable
ALTER TABLE "LeadCustomField" ADD COLUMN "defaultValue" JSONB;
ALTER TABLE "LeadCustomField" ADD COLUMN "validation" JSONB;
ALTER TABLE "LeadCustomField" ADD COLUMN "options" JSONB;

-- AlterTable
ALTER TABLE "ActivityCustomField" ADD COLUMN "defaultValue" JSONB;
ALTER TABLE "ActivityCustomField" ADD COLUMN "validation" JSONB;
ALTER TABLE "ActivityCustomField" ADD COLUMN "options" JSONB;
