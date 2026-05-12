export type AuditLogRow = {
  id: string;
  moduleName: string;
  entityId?: string | null;
  action: string;
  changedBy?: string | null;
  changedByType?: string | null;
  createdAt?: string;
};

export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ReportCollectionRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReportsOverview = {
  metrics?: Record<string, number | string>;
  uploadBatches?: ReportCollectionRow[];
  automationRuns?: ReportCollectionRow[];
  telephonyCalls?: ReportCollectionRow[];
  whatsAppMessages?: ReportCollectionRow[];
  voicebotCalls?: ReportCollectionRow[];
  assignmentRuns?: ReportCollectionRow[];
  invalidUploadRows?: ReportCollectionRow[];
  teamDistribution?: ReportCollectionRow[];
  expiredLeads?: ReportCollectionRow[];
  recentLeadJourneys?: ReportCollectionRow[];
};

export type SavedReportRow = {
  id: string;
  name: string;
  reportType: string;
  filters?: ReportFilters;
  visibility?: string;
  updatedAt?: string;
};

export type ScheduledReportRow = {
  id: string;
  name: string;
  reportType: string;
  frequency: string;
  isActive: boolean;
  nextRunAt?: string | null;
  savedReport?: { name?: string | null } | null;
};

export type ReportExportRow = {
  id: string;
  reportType?: string;
  status?: string;
  fileId?: string | null;
  fileName?: string | null;
  rowCount?: number;
  requestedByName?: string | null;
  requestedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
};

export type AuditFilters = {
  module: string;
  action: string;
  entityId: string;
  changedBy: string;
  dateFrom: string;
  dateTo: string;
};

export type ReportFilters = {
  dateFrom: string;
  dateTo: string;
  teamId: string;
  ownerId: string;
  salesGroupId: string;
  status: string;
  category: string;
  disposition: string;
  connector: string;
};
