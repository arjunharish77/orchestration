'use client';

export type LeadLike = {
  id: string;
  dbId?: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  branchName: string;
  amount: string;
  emi: string;
  status: string;
  category: string;
  source: string;
  created: string;
  owner: string;
  team?: string;
  language: string;
  customFields?: Array<{ key: string; label: string; value: unknown }>;
};

export type LeadActivityRow = {
  id: string;
  leadId?: string | null;
  type: string;
  title: string;
  notes?: string | null;
  disposition?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  createdBy?: string | null;
  customFields?: Array<{ key: string; label: string; value: unknown }>;
};

export type LeadTaskRow = {
  id: string;
  taskType: string;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  remarks?: string | null;
  createdAt?: string;
  comments?: Array<{ id: string; comment: string; createdAt?: string; createdBy?: string | null }>;
};

export type LeadAuditRow = {
  id: string;
  moduleName: string;
  entityId?: string | null;
  action: string;
  changedBy?: string | null;
  changedByType?: string | null;
  createdAt?: string;
};

export type LeadAutomationRun = {
  id: string;
  workflowId?: string | null;
  status: string;
  currentStep?: string | null;
  startedAt?: string;
  finishedAt?: string | null;
  steps?: Array<{ nodeName?: string | null; status: string }>;
};

export type LeadDetailData = {
  assignments?: Array<{ id: string; assignedUserId?: string | null; assignedTeamId?: string | null; reason?: string | null; createdAt?: string }>;
  automationRuns?: LeadAutomationRun[];
};

export type LeadFieldDefinition = {
  id: string;
  activityTypeCode?: string | null;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired?: boolean;
  options?: unknown[] | null;
};

export type LeadDispositionField = {
  fieldKey: string;
  label: string;
  fieldType?: string;
  isRequired?: boolean;
  options?: string[];
};

export type LeadActivityForm = {
  type: string;
  title: string;
  notes: string;
  disposition: string;
};

export type LeadTaskForm = {
  taskType: string;
  priority: string;
  dueDate: string;
  assignedTo: string;
  remarks: string;
};
