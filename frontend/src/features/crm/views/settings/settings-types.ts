export type AccessRole = {
  id: string;
  name: string;
};

export type CountSummary = {
  users?: number;
  leads?: number;
};

export type AccessTeam = {
  id: string;
  name: string;
  code?: string | null;
  type?: string | null;
  isActive?: boolean;
  _count?: CountSummary;
};

export type AccessSalesGroup = {
  id: string;
  name: string;
  isActive?: boolean;
  _count?: CountSummary;
};

export type AccessPermissionTemplate = {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  modules?: unknown[];
  fields?: unknown[];
};

export type AccessUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  roleId?: string | null;
  teamId?: string | null;
  permissionTemplateId?: string | null;
  isActive?: boolean;
  role?: { id?: string; name?: string | null } | null;
  team?: { id?: string; name?: string | null } | null;
  permissionTemplate?: { id?: string; name?: string | null } | null;
  salesGroups?: Array<{ id?: string; name?: string | null; salesGroup?: { id?: string; name?: string | null } | null }>;
  customFields?: Array<{ key: string; value: unknown }>;
};

export type AccessOverview = {
  users?: AccessUser[];
  roles?: AccessRole[];
  teams?: AccessTeam[];
  salesGroups?: AccessSalesGroup[];
  permissionTemplates?: AccessPermissionTemplate[];
};

export type SecurityUserRow = {
  id: string;
  email: string;
  name: string;
  role?: string;
  twoFactorEnabled?: boolean;
  twoFactorDisabledByAdmin?: boolean;
};

export type SecurityOverview = {
  accountTwoFactorEnabled?: boolean;
  users?: SecurityUserRow[];
};

export type SettingsUploadRow = {
  id: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  status: string;
  createdAt?: string;
};

export type SettingsUploadDetailRow = {
  id: string;
  rowNumber: number;
  rawData?: Record<string, unknown>;
  uploadStatus: string;
  errorMessage?: string | null;
};

export type DispositionFormField = {
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired?: boolean;
  options?: string[];
  isActive?: boolean;
};

export type MandatoryRule = {
  id: string;
  moduleName: CustomFieldModule;
  fieldKey: string;
  roleId?: string | null;
  teamId?: string | null;
  context?: string | null;
  isRequired: boolean;
  isActive: boolean;
};

export type CustomFieldModule = 'Lead' | 'User' | 'Activity';

export type CustomFieldDefinition = {
  id: string;
  moduleName: CustomFieldModule;
  activityTypeCode?: string | null;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multi_select' | 'boolean' | 'json';
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  defaultValue?: unknown;
  validation?: Record<string, unknown> | null;
  options?: unknown[] | null;
};

export type FieldForm = {
  activityTypeCode: string;
  label: string;
  fieldKey: string;
  fieldType: CustomFieldDefinition['fieldType'];
  isRequired: boolean;
  displayOrder: string;
  defaultValue: string;
  options: string;
  validation: string;
};

export type DispositionFieldForm = {
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  options: string;
};

export type MandatoryRuleForm = {
  moduleName: CustomFieldModule;
  fieldKey: string;
  roleId: string;
  teamId: string;
  context: string;
  isRequired: boolean;
  isActive: boolean;
};

export type CsvUploadConfig = {
  requiredColumns: string[];
  duplicateKeyFields: string[];
  defaultMapping: Record<string, string>;
};

export type TaskLists = {
  type: string[];
  status: string[];
};

export type ActivityTypeConfig = {
  code: string;
  label: string;
  isSystem?: boolean;
  isActive?: boolean;
  showInGlobalList?: boolean;
  showInLeadDetail?: boolean;
  allowManualCreate?: boolean;
};
