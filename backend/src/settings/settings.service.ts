import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type CreateMandatoryRuleInput = {
  moduleName: string;
  fieldKey: string;
  roleId?: string;
  teamId?: string;
  context?: string;
  isRequired?: boolean;
  isActive?: boolean;
};

type UpdateMandatoryRuleInput = {
  moduleName?: 'Lead' | 'User' | 'Activity';
  fieldKey?: string;
  roleId?: string;
  teamId?: string;
  context?: string;
  isRequired?: boolean;
  isActive?: boolean;
};

type LeadListKey = 'status' | 'category' | 'disposition';
export type TaskListKey = 'type' | 'status';
type DispositionFormField = {
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired?: boolean;
  options?: string[];
  isActive?: boolean;
};

export type CsvUploadConfig = {
  requiredColumns: string[];
  duplicateKeyFields: string[];
  defaultMapping: Record<string, string>;
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

const leadListSettingKeys: Record<LeadListKey, string> = {
  status: 'lead.status.values',
  category: 'lead.category.values',
  disposition: 'lead.disposition.values'
};

const defaultLeadListValues: Record<LeadListKey, string[]> = {
  status: ['New', 'Assigned', 'Converted', 'Expired', 'No Response'],
  category: ['Hot Lead', 'Warm Lead', 'Cold Lead', 'Callback Requested', 'Need More Details', 'Not Interested', 'Wrong Number', 'Already Applied', 'Converted', 'Expired', 'No Response'],
  disposition: ['Converted', 'Interested', 'Follow-up Required', 'Callback Scheduled', 'Documents Pending', 'Not Interested', 'Not Reachable', 'Wrong Number', 'Escalated']
};

const taskListSettingKeys: Record<TaskListKey, string> = {
  type: 'task.type.values',
  status: 'task.status.values'
};

const defaultTaskListValues: Record<TaskListKey, string[]> = {
  type: ['Follow-up', 'Callback', 'Document Collection', 'Call', 'Meeting', 'Reminder'],
  status: ['Pending', 'In Progress', 'Completed']
};

const dispositionFormSettingKey = 'lead.disposition.form';
const csvUploadConfigSettingKey = 'csv.upload.config';
const activityTypesSettingKey = 'activity.types.config';
const defaultDispositionFormFields: DispositionFormField[] = [
  { fieldKey: 'disposition', label: 'Disposition', fieldType: 'select', isRequired: true, isActive: true },
  { fieldKey: 'callbackAt', label: 'Callback Date/Time', fieldType: 'datetime', isRequired: false, isActive: true },
  { fieldKey: 'remarks', label: 'Remarks', fieldType: 'text', isRequired: false, isActive: true }
];
const defaultCsvUploadConfig: CsvUploadConfig = {
  requiredColumns: ['customer_name', 'mobile_number', 'loan_id', 'branch_code', 'loan_offer_amount', 'upload_date', 'offer_expiry_date'],
  duplicateKeyFields: ['mobile', 'externalLeadId'],
  defaultMapping: {}
};
const defaultActivityTypes: ActivityTypeConfig[] = [
  { code: '001', label: 'Call', isSystem: true, isActive: true, showInGlobalList: true, showInLeadDetail: true, allowManualCreate: false },
  { code: '002', label: 'Meeting', isSystem: true, isActive: true, showInGlobalList: true, showInLeadDetail: true, allowManualCreate: true },
  { code: '003', label: 'Note', isSystem: true, isActive: true, showInGlobalList: false, showInLeadDetail: true, allowManualCreate: true },
  { code: '004', label: 'Disposition', isSystem: true, isActive: true, showInGlobalList: false, showInLeadDetail: true, allowManualCreate: false },
  { code: '005', label: 'WhatsApp', isSystem: true, isActive: true, showInGlobalList: true, showInLeadDetail: true, allowManualCreate: false },
  { code: '006', label: 'Voicebot', isSystem: true, isActive: true, showInGlobalList: true, showInLeadDetail: true, allowManualCreate: false },
  { code: '007', label: 'Document Shared', isSystem: true, isActive: true, showInGlobalList: true, showInLeadDetail: true, allowManualCreate: true },
  { code: '008', label: 'System', isSystem: true, isActive: true, showInGlobalList: false, showInLeadDetail: true, allowManualCreate: false },
  { code: '009', label: 'Task', isSystem: true, isActive: true, showInGlobalList: false, showInLeadDetail: true, allowManualCreate: false },
  { code: '010', label: 'Upload', isSystem: true, isActive: true, showInGlobalList: false, showInLeadDetail: false, allowManualCreate: false },
  { code: '011', label: 'Assignment', isSystem: true, isActive: true, showInGlobalList: false, showInLeadDetail: true, allowManualCreate: false },
  { code: '012', label: 'Telephony Popup', isSystem: true, isActive: false, showInGlobalList: false, showInLeadDetail: false, allowManualCreate: false },
  { code: '013', label: 'Telephony Call', isSystem: true, isActive: false, showInGlobalList: false, showInLeadDetail: false, allowManualCreate: false }
];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async overview() {
    const [settings, fields, mandatoryRules, leadLists, taskLists, dispositionForm] = await Promise.all([
      this.prisma.appSetting.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.fieldDefinition.findMany({
        where: { isActive: true },
        orderBy: [{ moduleName: 'asc' }, { displayOrder: 'asc' }]
      }),
      this.prisma.fieldMandatoryRule.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.leadLists(),
      this.taskLists(),
      this.dispositionForm()
    ]);

    return {
      settings,
      fields,
      mandatoryRules,
      leadLists,
      taskLists,
      dispositionForm
    };
  }

  async csvUploadConfig(): Promise<CsvUploadConfig> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: csvUploadConfigSettingKey } });
    return normalizeCsvUploadConfig(setting?.value);
  }

  async activityTypes() {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: activityTypesSettingKey } });
    return normalizeActivityTypes(setting?.value);
  }

  async createActivityType(input: Partial<ActivityTypeConfig>, actor = 'system') {
    const oldValue = await this.activityTypes();
    const existingCodes = oldValue.map((type) => type.code);
    const nextCode = nextActivityTypeCode(existingCodes);
    const nextType = normalizeActivityType({
      code: nextCode,
      label: input.label || `Activity ${nextCode}`,
      isSystem: false,
      isActive: input.isActive ?? true,
      showInGlobalList: input.showInGlobalList ?? true,
      showInLeadDetail: input.showInLeadDetail ?? true,
      allowManualCreate: input.allowManualCreate ?? true
    });
    const next = [...oldValue, nextType].sort((a, b) => a.code.localeCompare(b.code));
    await this.saveActivityTypes(next, actor, 'create_activity_type', oldValue);
    return nextType;
  }

  async updateActivityType(code: string, input: Partial<ActivityTypeConfig>, actor = 'system') {
    const oldValue = await this.activityTypes();
    const normalizedCode = normalizeActivityTypeCodeValue(code);
    const existing = oldValue.find((type) => type.code === normalizedCode);
    if (!existing) throw new NotFoundException('Activity type not found');
    const next = oldValue.map((type) => {
      if (type.code !== normalizedCode) return type;
      return normalizeActivityType({
        ...type,
        label: input.label ?? type.label,
        isActive: type.isSystem ? type.isActive : input.isActive ?? type.isActive,
        showInGlobalList: input.showInGlobalList ?? type.showInGlobalList,
        showInLeadDetail: input.showInLeadDetail ?? type.showInLeadDetail,
        allowManualCreate: input.allowManualCreate ?? type.allowManualCreate
      });
    });
    await this.saveActivityTypes(next, actor, 'update_activity_type', oldValue);
    return next.find((type) => type.code === normalizedCode);
  }

  async deactivateActivityType(code: string, actor = 'system') {
    const oldValue = await this.activityTypes();
    const normalizedCode = normalizeActivityTypeCodeValue(code);
    const existing = oldValue.find((type) => type.code === normalizedCode);
    if (!existing) throw new NotFoundException('Activity type not found');
    if (existing.isSystem) throw new BadRequestException('System activity types cannot be deactivated');
    const next = oldValue.map((type) => (type.code === normalizedCode ? { ...type, isActive: false, allowManualCreate: false } : type));
    await this.saveActivityTypes(next, actor, 'deactivate_activity_type', oldValue);
    return next.find((type) => type.code === normalizedCode);
  }

  private async saveActivityTypes(next: ActivityTypeConfig[], actor: string, action: string, oldValue: ActivityTypeConfig[]) {
    const normalized = normalizeActivityTypes(next);
    await this.prisma.appSetting.upsert({
      where: { key: activityTypesSettingKey },
      create: { key: activityTypesSettingKey, value: normalized },
      update: { value: normalized }
    });
    await this.audit.write({ moduleName: 'Settings', entityId: activityTypesSettingKey, action, oldValue, newValue: normalized, changedBy: actor });
  }

  async updateCsvUploadConfig(input: Partial<CsvUploadConfig>, actor = 'system') {
    const oldValue = await this.csvUploadConfig();
    const next = normalizeCsvUploadConfig({ ...oldValue, ...input });
    const setting = await this.prisma.appSetting.upsert({
      where: { key: csvUploadConfigSettingKey },
      create: { key: csvUploadConfigSettingKey, value: next },
      update: { value: next }
    });
    const result = normalizeCsvUploadConfig(setting.value);
    await this.audit.write({ moduleName: 'Settings', entityId: csvUploadConfigSettingKey, action: 'update_csv_upload_config', oldValue, newValue: result, changedBy: actor });
    return result;
  }

  async leadLists() {
    const settings = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: Object.values(leadListSettingKeys)
        }
      }
    });
    const byKey = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      status: parseListValue(byKey.get(leadListSettingKeys.status), defaultLeadListValues.status),
      category: parseListValue(byKey.get(leadListSettingKeys.category), defaultLeadListValues.category),
      disposition: parseListValue(byKey.get(leadListSettingKeys.disposition), defaultLeadListValues.disposition)
    };
  }

  async updateLeadList(type: LeadListKey, values: string[], actor = 'system') {
    const oldValue = await this.leadLists();
    const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    const setting = await this.prisma.appSetting.upsert({
      where: { key: leadListSettingKeys[type] },
      create: {
        key: leadListSettingKeys[type],
        value: normalized
      },
      update: {
        value: normalized
      }
    });

    const result = {
      type,
      values: parseListValue(setting.value, defaultLeadListValues[type])
    };
    await this.audit.write({ moduleName: 'Settings', entityId: leadListSettingKeys[type], action: 'update_lead_list', oldValue, newValue: result, changedBy: actor });
    return result;
  }

  async taskLists() {
    const settings = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: Object.values(taskListSettingKeys)
        }
      }
    });
    const byKey = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      type: parseListValue(byKey.get(taskListSettingKeys.type), defaultTaskListValues.type),
      status: parseListValue(byKey.get(taskListSettingKeys.status), defaultTaskListValues.status)
    };
  }

  async updateTaskList(type: TaskListKey, values: string[], actor = 'system') {
    const oldValue = await this.taskLists();
    const normalized = normalizeListValues(values);
    const setting = await this.prisma.appSetting.upsert({
      where: { key: taskListSettingKeys[type] },
      create: {
        key: taskListSettingKeys[type],
        value: normalized.length > 0 ? normalized : defaultTaskListValues[type]
      },
      update: {
        value: normalized.length > 0 ? normalized : defaultTaskListValues[type]
      }
    });

    const result = {
      type,
      values: parseListValue(setting.value, defaultTaskListValues[type])
    };
    await this.audit.write({ moduleName: 'Settings', entityId: taskListSettingKeys[type], action: 'update_task_list', oldValue, newValue: result, changedBy: actor });
    return result;
  }

  async dispositionForm() {
    const [setting, leadLists] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: dispositionFormSettingKey } }),
      this.leadLists()
    ]);
    const savedFields = parseDispositionFields(setting?.value);
    const fields = savedFields.length > 0 ? savedFields : defaultDispositionFormFields;

    return {
      fields: fields.map((field) =>
        field.fieldKey === 'disposition'
          ? { ...field, options: leadLists.disposition }
          : field
      )
    };
  }

  async updateDispositionForm(fields: DispositionFormField[], actor = 'system') {
    const oldValue = await this.dispositionForm();
    const normalized = normalizeDispositionFields(fields);
    const setting = await this.prisma.appSetting.upsert({
      where: { key: dispositionFormSettingKey },
      create: {
        key: dispositionFormSettingKey,
        value: { fields: normalized }
      },
      update: {
        value: { fields: normalized }
      }
    });

    const result = {
      fields: parseDispositionFields(setting.value)
    };
    await this.audit.write({ moduleName: 'Settings', entityId: dispositionFormSettingKey, action: 'update_disposition_form', oldValue, newValue: result, changedBy: actor });
    return result;
  }

  async addDispositionFormField(field: DispositionFormField, actor = 'system') {
    const current = await this.dispositionForm();
    const fields = current.fields.filter((entry) => entry.fieldKey !== field.fieldKey);
    return this.updateDispositionForm([...fields, field], actor);
  }

  async deactivateDispositionFormField(fieldKey: string, actor = 'system') {
    const current = await this.dispositionForm();
    return this.updateDispositionForm(
      current.fields.map((field) => (field.fieldKey === fieldKey ? { ...field, isActive: false } : field)),
      actor
    );
  }

  async securityOverview() {
    const [setting, users] = await Promise.all([
      this.prisma.appSetting.findUnique({
        where: { key: 'security.twoFactor.accountEnabled' }
      }),
      this.prisma.user.findMany({
        where: { isSystem: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: { select: { name: true } },
          twoFactorEnabled: true,
          twoFactorDisabledByAdmin: true
        },
        orderBy: { name: 'asc' }
      })
    ]);

    return {
      accountTwoFactorEnabled: Boolean((setting?.value as { enabled?: boolean } | null)?.enabled),
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorDisabledByAdmin: user.twoFactorDisabledByAdmin
      }))
    };
  }

  async setAccountTwoFactor(enabled: boolean, actor = 'system') {
    const oldValue = await this.securityOverview();
    const setting = await this.prisma.appSetting.upsert({
      where: { key: 'security.twoFactor.accountEnabled' },
      create: {
        key: 'security.twoFactor.accountEnabled',
        value: { enabled }
      },
      update: {
        value: { enabled }
      }
    });

    const result = {
      accountTwoFactorEnabled: Boolean((setting.value as { enabled?: boolean }).enabled)
    };
    await this.audit.write({ moduleName: 'Settings', entityId: 'security.twoFactor.accountEnabled', action: 'update_account_two_factor', oldValue: { accountTwoFactorEnabled: oldValue.accountTwoFactorEnabled }, newValue: result, changedBy: actor });
    return result;
  }

  async setUserTwoFactor(userId: string, input: { enabled?: boolean; disabledByAdmin?: boolean }, actor = 'system') {
    const oldValue = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true, twoFactorDisabledByAdmin: true }
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.enabled === undefined ? {} : { twoFactorEnabled: input.enabled }),
        ...(input.disabledByAdmin === undefined ? {} : { twoFactorDisabledByAdmin: input.disabledByAdmin })
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { name: true } },
        twoFactorEnabled: true,
        twoFactorDisabledByAdmin: true
      }
    });

    const result = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorDisabledByAdmin: user.twoFactorDisabledByAdmin
    };
    await this.audit.write({ moduleName: 'Settings', entityId: userId, action: 'update_user_two_factor', oldValue, newValue: result, changedBy: actor });
    return result;
  }

  async createMandatoryRule(input: CreateMandatoryRuleInput, actor = 'system') {
    const rule = await this.prisma.fieldMandatoryRule.create({
      data: {
        moduleName: input.moduleName,
        fieldKey: input.fieldKey,
        roleId: input.roleId || null,
        teamId: input.teamId || null,
        context: input.context || null,
        isRequired: input.isRequired ?? true,
        isActive: input.isActive ?? true
      }
    });
    await this.audit.write({ moduleName: 'Settings', entityId: rule.id, action: 'create_mandatory_rule', newValue: rule, changedBy: actor });
    return rule;
  }

  async listMandatoryRules() {
    return this.prisma.fieldMandatoryRule.findMany({
      orderBy: [
        { moduleName: 'asc' },
        { fieldKey: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async updateMandatoryRule(id: string, input: UpdateMandatoryRuleInput, actor = 'system') {
    const oldValue = await this.prisma.fieldMandatoryRule.findUnique({ where: { id } });
    const rule = await this.prisma.fieldMandatoryRule.update({
      where: { id },
      data: {
        ...(input.roleId === undefined ? {} : { roleId: input.roleId || null }),
        ...(input.moduleName === undefined ? {} : { moduleName: input.moduleName }),
        ...(input.fieldKey === undefined ? {} : { fieldKey: input.fieldKey }),
        ...(input.teamId === undefined ? {} : { teamId: input.teamId || null }),
        ...(input.context === undefined ? {} : { context: input.context || null }),
        ...(input.isRequired === undefined ? {} : { isRequired: input.isRequired }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.write({ moduleName: 'Settings', entityId: id, action: 'update_mandatory_rule', oldValue, newValue: rule, changedBy: actor });
    return rule;
  }
}

function parseListValue(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : fallback;
}

function normalizeListValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseDispositionFields(value: unknown): DispositionFormField[] {
  const fields = value && typeof value === 'object' && 'fields' in value ? (value as { fields?: unknown }).fields : value;
  if (!Array.isArray(fields)) return [];
  return normalizeDispositionFields(fields as DispositionFormField[]);
}

function normalizeDispositionFields(fields: DispositionFormField[]) {
  return fields
    .map((field, index) => ({
      fieldKey: String(field.fieldKey || '').trim(),
      label: String(field.label || field.fieldKey || '').trim(),
      fieldType: String(field.fieldType || 'text').trim(),
      isRequired: Boolean(field.isRequired),
      options: Array.isArray(field.options) ? field.options.map((option) => String(option).trim()).filter(Boolean) : undefined,
      isActive: field.isActive ?? true,
      displayOrder: index
    }))
    .filter((field) => field.fieldKey && field.label);
}

function normalizeCsvUploadConfig(value: unknown): CsvUploadConfig {
  const input = value && typeof value === 'object' ? value as Partial<CsvUploadConfig> : {};
  const requiredColumns = Array.isArray(input.requiredColumns)
    ? input.requiredColumns.map((entry) => String(entry).trim()).filter(Boolean)
    : defaultCsvUploadConfig.requiredColumns;
  const duplicateKeyFields = Array.isArray(input.duplicateKeyFields)
    ? input.duplicateKeyFields.map((entry) => String(entry).trim()).filter(Boolean)
    : defaultCsvUploadConfig.duplicateKeyFields;
  const defaultMapping = input.defaultMapping && typeof input.defaultMapping === 'object' && !Array.isArray(input.defaultMapping)
    ? Object.fromEntries(Object.entries(input.defaultMapping).map(([key, source]) => [key, String(source ?? '')]))
    : {};
  return {
    requiredColumns: requiredColumns.length > 0 ? Array.from(new Set(requiredColumns)) : defaultCsvUploadConfig.requiredColumns,
    duplicateKeyFields: duplicateKeyFields.length > 0 ? Array.from(new Set(duplicateKeyFields)) : defaultCsvUploadConfig.duplicateKeyFields,
    defaultMapping
  };
}

function normalizeActivityTypes(value: unknown): ActivityTypeConfig[] {
  const input = Array.isArray(value) ? value : defaultActivityTypes;
  const merged = new Map(defaultActivityTypes.map((type) => [type.code, type]));
  input.forEach((entry) => {
    const normalized = normalizeActivityType(entry as Partial<ActivityTypeConfig>);
    if (normalized.code) {
      const fallback = merged.get(normalized.code);
      merged.set(normalized.code, { ...fallback, ...normalized, isSystem: fallback?.isSystem ?? normalized.isSystem ?? false });
    }
  });
  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function normalizeActivityType(value: Partial<ActivityTypeConfig>): ActivityTypeConfig {
  const code = normalizeActivityTypeCodeValue(value.code ?? '');
  return {
    code,
    label: String(value.label || code || 'Activity').trim(),
    isSystem: Boolean(value.isSystem),
    isActive: value.isActive ?? true,
    showInGlobalList: value.showInGlobalList ?? true,
    showInLeadDetail: value.showInLeadDetail ?? true,
    allowManualCreate: value.allowManualCreate ?? !value.isSystem
  };
}

function normalizeActivityTypeCodeValue(code: string) {
  return String(code || '').trim().padStart(3, '0');
}

function nextActivityTypeCode(existingCodes: string[]) {
  const maxCode = existingCodes
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code))
    .reduce((max, code) => Math.max(max, code), 13);
  return String(maxCode + 1).padStart(3, '0');
}
