CREATE TABLE "SavedReport" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "filters" JSONB,
  "columns" JSONB,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledReport" (
  "id" TEXT NOT NULL,
  "savedReportId" TEXT,
  "name" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "filters" JSONB,
  "frequency" TEXT NOT NULL,
  "recipients" JSONB,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportExport" (
  "id" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "filters" JSONB,
  "fileId" TEXT,
  "fileName" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadedFile_fileType_idx" ON "UploadedFile"("fileType");
CREATE INDEX "UploadedFile_uploadedBy_idx" ON "UploadedFile"("uploadedBy");
CREATE INDEX "UploadedFile_createdAt_idx" ON "UploadedFile"("createdAt");

CREATE INDEX "SavedReport_reportType_idx" ON "SavedReport"("reportType");
CREATE INDEX "SavedReport_visibility_idx" ON "SavedReport"("visibility");
CREATE INDEX "SavedReport_createdBy_idx" ON "SavedReport"("createdBy");

CREATE INDEX "ScheduledReport_savedReportId_idx" ON "ScheduledReport"("savedReportId");
CREATE INDEX "ScheduledReport_isActive_idx" ON "ScheduledReport"("isActive");
CREATE INDEX "ScheduledReport_nextRunAt_idx" ON "ScheduledReport"("nextRunAt");
CREATE INDEX "ScheduledReport_createdBy_idx" ON "ScheduledReport"("createdBy");

CREATE INDEX "ReportExport_reportType_idx" ON "ReportExport"("reportType");
CREATE INDEX "ReportExport_status_idx" ON "ReportExport"("status");
CREATE INDEX "ReportExport_requestedBy_idx" ON "ReportExport"("requestedBy");
CREATE INDEX "ReportExport_requestedAt_idx" ON "ReportExport"("requestedAt");

ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_savedReportId_fkey" FOREIGN KEY ("savedReportId") REFERENCES "SavedReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
