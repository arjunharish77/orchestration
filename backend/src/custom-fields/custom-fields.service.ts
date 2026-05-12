import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { maskPartial } from '../common/masking';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomFieldDefinitionDto,
  CustomFieldModule,
  customFieldModules,
  UpdateCustomFieldDefinitionDto,
  UpsertCustomFieldValuesDto
} from './custom-fields.dto';

type CustomFieldDefinition = {
  id: string;
  activityTypeCode?: string | null;
  fieldKey: string;
  label: string;
  fieldType: string;
  defaultValue?: Prisma.JsonValue | null;
  validation?: Prisma.JsonValue | null;
  options?: Prisma.JsonValue | null;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
};

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService
  ) {}

  async listDefinitions(moduleName?: string, userId?: string, activityTypeCode?: string) {
    const module = moduleName ? parseModule(moduleName) : undefined;
    if (!module) {
      const effective = userId ? await this.access.effectivePermissions(userId) : null;
      const [lead, user, activity] = await Promise.all([
        this.listLeadDefinitions(),
        this.listUserDefinitions(),
        this.listActivityDefinitions(false, activityTypeCode)
      ]);

      return {
        Lead: this.applyDefinitionAccess('Lead', lead, effective),
        User: this.applyDefinitionAccess('User', user, effective),
        Activity: this.applyDefinitionAccess('Activity', activity, effective)
      };
    }

    const [definitions, effective] = await Promise.all([
      this.listModuleDefinitions(module, false, activityTypeCode),
      userId ? this.access.effectivePermissions(userId) : Promise.resolve(null)
    ]);
    return this.applyDefinitionAccess(module, definitions, effective);
  }

  async createDefinition(input: CreateCustomFieldDefinitionDto, actor = 'system') {
    const baseData = {
      fieldKey: normalizeFieldKey(input.fieldKey),
      label: input.label,
      fieldType: input.fieldType,
      defaultValue: toNullableJson(input.defaultValue),
      validation: toNullableJson(input.validation),
      options: toNullableJson(input.options),
      isRequired: input.isRequired ?? false,
      isActive: input.isActive ?? true,
      displayOrder: input.displayOrder ?? 0
    };

    const field = input.moduleName === 'Lead'
      ? await this.prisma.leadCustomField.create({ data: baseData })
      : input.moduleName === 'User'
        ? await this.prisma.userCustomField.create({ data: baseData })
        : await this.prisma.activityCustomField.create({
            data: {
              ...baseData,
              activityTypeCode: normalizeActivityTypeCode(input.activityTypeCode)
            }
          });
    await this.writeDefinitionHistory(input.moduleName, field.id, field.fieldKey, 'create', null, field, actor);
    return field;
  }

  async updateDefinition(moduleName: string, id: string, input: UpdateCustomFieldDefinitionDto, actor = 'system') {
    const module = parseModule(moduleName);
    const existing = await this.getDefinition(module, id);
    if (!existing) throw new NotFoundException('Custom field definition not found');
    const impact = await this.definitionImpact(module, id);
    const riskyChange = (input.fieldType && input.fieldType !== existing.fieldType) || (input.options !== undefined && JSON.stringify(input.options ?? null) !== JSON.stringify(existing.options ?? null));
    if (riskyChange && impact.valueCount > 0 && input.confirmImpact !== true) {
      throw new BadRequestException({
        message: 'Changing field type or options can affect existing custom-field values. Review impact and retry with confirmImpact=true.',
        impact
      });
    }
    if (input.isActive === false && impact.activeMandatoryRules > 0) {
      throw new BadRequestException({
        message: 'Deactivate mandatory rules before deactivating this custom field.',
        impact
      });
    }

    const baseData = {
      label: input.label,
      fieldType: input.fieldType,
      defaultValue: input.defaultValue === undefined ? undefined : toNullableJson(input.defaultValue),
      validation: input.validation === undefined ? undefined : toNullableJson(input.validation),
      options: input.options === undefined ? undefined : toNullableJson(input.options),
      isRequired: input.isRequired,
      isActive: input.isActive,
      displayOrder: input.displayOrder
    };

    const updated = module === 'Lead'
      ? await this.prisma.leadCustomField.update({ where: { id }, data: baseData })
      : module === 'User'
        ? await this.prisma.userCustomField.update({ where: { id }, data: baseData })
        : await this.prisma.activityCustomField.update({
            where: { id },
            data: {
              ...baseData,
              ...(input.activityTypeCode !== undefined ? { activityTypeCode: normalizeActivityTypeCode(input.activityTypeCode) } : {})
            }
          });
    await this.writeDefinitionHistory(module, id, updated.fieldKey, 'update', existing, updated, actor);
    return updated;
  }

  async definitionImpact(moduleName: string, id: string) {
    const module = parseModule(moduleName);
    const definition = await this.getDefinition(module, id);
    if (!definition) throw new NotFoundException('Custom field definition not found');
    const fieldPath = `${module.toLowerCase()}.custom.${definition.fieldKey}`;
    const [valueCount, mandatoryRules, permissionTemplates, assignmentRuleConditions, history, roles, teams] = await Promise.all([
      this.valueCount(module, id),
      this.prisma.fieldMandatoryRule.findMany({ where: { moduleName: module, fieldKey: definition.fieldKey }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.permissionTemplateField.findMany({ where: { moduleName: module, fieldKey: definition.fieldKey }, include: { permissionTemplate: true } }),
      this.prisma.assignmentRuleCondition.findMany({ where: { fieldPath }, include: { rule: true } }),
      this.prisma.customFieldDefinitionHistory.findMany({ where: { moduleName: module, fieldKey: definition.fieldKey }, orderBy: { createdAt: 'desc' }, take: 25 }),
      this.prisma.role.findMany({ select: { id: true, name: true } }),
      this.prisma.team.findMany({ select: { id: true, name: true, code: true } })
    ]);
    const roleById = new Map(roles.map((role) => [role.id, role]));
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const warnings = [
      valueCount > 0 ? `This field has ${valueCount} stored value${valueCount === 1 ? '' : 's'}.` : '',
      mandatoryRules.some((rule) => rule.isActive) ? 'Active mandatory rules depend on this field.' : '',
      permissionTemplates.length > 0 ? 'Permission templates reference this field.' : '',
      assignmentRuleConditions.length > 0 ? 'Assignment rules reference this field.' : ''
    ].filter(Boolean);
    return {
      moduleName: module,
      fieldId: definition.id,
      fieldKey: definition.fieldKey,
      label: definition.label,
      valueCount,
      activeMandatoryRules: mandatoryRules.filter((rule) => rule.isActive).length,
      mandatoryRules: mandatoryRules.map((rule) => ({
        id: rule.id,
        isActive: rule.isActive,
        isRequired: rule.isRequired,
        context: rule.context,
        role: rule.roleId ? roleById.get(rule.roleId) ?? { id: rule.roleId, name: rule.roleId } : null,
        team: rule.teamId ? teamById.get(rule.teamId) ?? { id: rule.teamId, name: rule.teamId, code: null } : null
      })),
      permissionTemplates: permissionTemplates.map((permission) => ({
        templateId: permission.permissionTemplateId,
        templateName: permission.permissionTemplate.name,
        access: permission.access
      })),
      assignmentRules: assignmentRuleConditions.map((condition) => ({
        ruleId: condition.ruleId,
        ruleName: condition.rule.name,
        operator: condition.operator,
        value: condition.value
      })),
      history,
      warnings
    };
  }

  async listValues(moduleName: string, entityId: string, userId?: string) {
    const module = parseModule(moduleName);
    await this.assertEntityExists(module, entityId);

    const definitions = await this.listEntityDefinitions(module, entityId, true);
    const values =
      module === 'Lead'
        ? await this.prisma.leadCustomFieldValue.findMany({
            where: { leadId: entityId },
            include: { field: true }
          })
        : module === 'User'
          ? await this.prisma.userCustomFieldValue.findMany({
              where: { userId: entityId },
              include: { field: true }
            })
          : await this.prisma.activityCustomFieldValue.findMany({
              where: { activityId: entityId },
              include: { field: true }
            });

    const valueByFieldId = new Map(values.map((value) => [value.fieldId, value]));
    const effective = userId ? await this.access.effectivePermissions(userId) : null;

    return definitions
      .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
      .flatMap((definition) => {
        const access = effective ? this.access.getFieldAccess(effective, module, definition.fieldKey) : 'editable';
        if (access === 'hidden') return [];
        const stored = valueByFieldId.get(definition.id);
        const rawValue = stored?.value ?? definition.defaultValue ?? null;

        return [
          {
            fieldId: definition.id,
            fieldKey: definition.fieldKey,
            label: definition.label,
            fieldType: definition.fieldType,
            isRequired: definition.isRequired,
            defaultValue: definition.defaultValue,
            validation: definition.validation,
            options: definition.options,
            access,
            value: access === 'masked' ? maskCustomValue(rawValue) : rawValue
          }
        ];
      });
  }

  async upsertValues(moduleName: string, entityId: string, input: UpsertCustomFieldValuesDto) {
    const module = parseModule(moduleName);
    await this.assertEntityExists(module, entityId);
    const definitions = await this.listEntityDefinitions(module, entityId, true);
    const definitionByKey = new Map(definitions.map((definition) => [definition.fieldKey, definition]));
    const incoming = input.values ?? {};
    const missingRequired = definitions
      .filter((definition) => definition.isRequired)
      .filter((definition) => isBlank(incoming[definition.fieldKey]) && isBlank(definition.defaultValue));

    if (missingRequired.length > 0) {
      throw new BadRequestException(`Missing required custom fields: ${missingRequired.map((field) => field.fieldKey).join(', ')}`);
    }

    for (const fieldKey of Object.keys(incoming)) {
      const definition = definitionByKey.get(fieldKey);
      if (!definition) {
        throw new BadRequestException(`Unknown custom field: ${fieldKey}`);
      }
      validateCustomValue(definition, incoming[fieldKey]);
    }

    await Promise.all(
      Object.entries(incoming).map(([fieldKey, value]) => {
        const definition = definitionByKey.get(fieldKey);
        if (!definition) throw new BadRequestException(`Unknown custom field: ${fieldKey}`);
        return this.upsertOneValue(module, entityId, definition.id, value as Prisma.InputJsonValue);
      })
    );

    return this.listValues(module, entityId);
  }

  private async listModuleDefinitions(module: CustomFieldModule, activeOnly = false, activityTypeCode?: string): Promise<CustomFieldDefinition[]> {
    if (module === 'Lead') return this.listLeadDefinitions(activeOnly);
    if (module === 'User') return this.listUserDefinitions(activeOnly);
    return this.listActivityDefinitions(activeOnly, activityTypeCode);
  }

  private async listEntityDefinitions(module: CustomFieldModule, entityId: string, activeOnly = false) {
    if (module !== 'Activity') return this.listModuleDefinitions(module, activeOnly);
    const activity = await this.prisma.activity.findUnique({ where: { id: entityId }, select: { type: true } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.listActivityDefinitions(activeOnly, activity.type);
  }

  private applyDefinitionAccess(module: CustomFieldModule, definitions: CustomFieldDefinition[], effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null) {
    if (!effective) return definitions;
    return definitions
      .map((definition) => ({
        ...definition,
        access: module === 'Activity' && definition.activityTypeCode && definition.activityTypeCode !== 'ALL'
          ? this.access.getActivityTypeFieldAccess(effective, definition.activityTypeCode, definition.fieldKey)
          : this.access.getFieldAccess(effective, module, definition.fieldKey)
      }))
      .filter((definition) => definition.access !== 'hidden');
  }

  private listLeadDefinitions(activeOnly = false) {
    return this.prisma.leadCustomField.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
  }

  private listUserDefinitions(activeOnly = false) {
    return this.prisma.userCustomField.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
  }

  private listActivityDefinitions(activeOnly = false, activityTypeCode?: string) {
    const normalizedType = activityTypeCode ? normalizeActivityTypeCode(activityTypeCode) : undefined;
    return this.prisma.activityCustomField.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(normalizedType ? { activityTypeCode: { in: ['ALL', normalizedType] } } : {})
      },
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
  }

  private async upsertOneValue(module: CustomFieldModule, entityId: string, fieldId: string, value: Prisma.InputJsonValue) {
    if (module === 'Lead') {
      return this.prisma.leadCustomFieldValue.upsert({
        where: { leadId_fieldId: { leadId: entityId, fieldId } },
        update: { value },
        create: { leadId: entityId, fieldId, value }
      });
    }

    if (module === 'User') {
      return this.prisma.userCustomFieldValue.upsert({
        where: { userId_fieldId: { userId: entityId, fieldId } },
        update: { value },
        create: { userId: entityId, fieldId, value }
      });
    }

    return this.prisma.activityCustomFieldValue.upsert({
      where: { activityId_fieldId: { activityId: entityId, fieldId } },
      update: { value },
      create: { activityId: entityId, fieldId, value }
    });
  }

  private async assertEntityExists(module: CustomFieldModule, entityId: string) {
    const entity =
      module === 'Lead'
        ? await this.prisma.lead.findUnique({ where: { id: entityId }, select: { id: true } })
        : module === 'User'
          ? await this.prisma.user.findUnique({ where: { id: entityId }, select: { id: true } })
          : await this.prisma.activity.findUnique({ where: { id: entityId }, select: { id: true } });

    if (!entity) throw new NotFoundException(`${module} not found`);
  }

  private async getDefinition(module: CustomFieldModule, id: string) {
    if (module === 'Lead') return this.prisma.leadCustomField.findUnique({ where: { id } });
    if (module === 'User') return this.prisma.userCustomField.findUnique({ where: { id } });
    return this.prisma.activityCustomField.findUnique({ where: { id } });
  }

  private async valueCount(module: CustomFieldModule, fieldId: string) {
    if (module === 'Lead') return this.prisma.leadCustomFieldValue.count({ where: { fieldId } });
    if (module === 'User') return this.prisma.userCustomFieldValue.count({ where: { fieldId } });
    return this.prisma.activityCustomFieldValue.count({ where: { fieldId } });
  }

  private writeDefinitionHistory(module: CustomFieldModule, fieldId: string, fieldKey: string, action: string, oldValue: unknown, newValue: unknown, actor: string) {
    return this.prisma.customFieldDefinitionHistory.create({
      data: {
        moduleName: module,
        fieldId,
        fieldKey,
        action,
        oldValue: toNullableJson(oldValue),
        newValue: toNullableJson(newValue),
        changedBy: actor
      }
    });
  }
}

function parseModule(moduleName: string): CustomFieldModule {
  if (customFieldModules.includes(moduleName as CustomFieldModule)) return moduleName as CustomFieldModule;
  throw new BadRequestException('moduleName must be Lead, User, or Activity');
}

function normalizeFieldKey(fieldKey: string) {
  const normalized = fieldKey.trim().replace(/\s+/g, '_');
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(normalized)) {
    throw new BadRequestException('fieldKey must start with a letter and contain only letters, numbers, or underscores');
  }
  return normalized;
}

function normalizeActivityTypeCode(activityTypeCode?: string | null) {
  const normalized = (activityTypeCode ?? 'ALL').trim().toUpperCase();
  if (normalized === '' || normalized === 'ALL') return 'ALL';
  if (!/^\d{3}$/.test(normalized)) {
    throw new BadRequestException('activityTypeCode must be ALL or a 3-digit activity type code');
  }
  return normalized;
}

function toNullableJson(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return value as Prisma.InputJsonValue;
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === '';
}

function validateCustomValue(definition: CustomFieldDefinition, value: unknown) {
  if (isBlank(value)) return;
  const validation = (definition.validation ?? {}) as Record<string, unknown>;
  const options = Array.isArray(definition.options) ? definition.options : [];

  if (definition.fieldType === 'number' && Number.isNaN(Number(value))) {
    throw new BadRequestException(`${definition.fieldKey} must be a number`);
  }

  if ((definition.fieldType === 'date' || definition.fieldType === 'datetime') && Number.isNaN(new Date(String(value)).getTime())) {
    throw new BadRequestException(`${definition.fieldKey} must be a valid date`);
  }

  if (definition.fieldType === 'boolean' && typeof value !== 'boolean') {
    throw new BadRequestException(`${definition.fieldKey} must be true or false`);
  }

  if (definition.fieldType === 'select' && options.length > 0 && !options.includes(value)) {
    throw new BadRequestException(`${definition.fieldKey} must be one of: ${options.join(', ')}`);
  }

  if (definition.fieldType === 'multi_select') {
    if (!Array.isArray(value)) throw new BadRequestException(`${definition.fieldKey} must be a list`);
    const invalid = options.length > 0 ? value.filter((entry) => !options.includes(entry)) : [];
    if (invalid.length > 0) throw new BadRequestException(`${definition.fieldKey} has invalid options: ${invalid.join(', ')}`);
  }

  const text = String(value);
  if (typeof validation.minLength === 'number' && text.length < validation.minLength) {
    throw new BadRequestException(`${definition.fieldKey} must have at least ${validation.minLength} characters`);
  }
  if (typeof validation.maxLength === 'number' && text.length > validation.maxLength) {
    throw new BadRequestException(`${definition.fieldKey} must have at most ${validation.maxLength} characters`);
  }
  if (typeof validation.pattern === 'string' && !new RegExp(validation.pattern).test(text)) {
    throw new BadRequestException(`${definition.fieldKey} format is invalid`);
  }
  if (definition.fieldType === 'number' && typeof validation.min === 'number' && Number(value) < validation.min) {
    throw new BadRequestException(`${definition.fieldKey} must be at least ${validation.min}`);
  }
  if (definition.fieldType === 'number' && typeof validation.max === 'number' && Number(value) > validation.max) {
    throw new BadRequestException(`${definition.fieldKey} must be at most ${validation.max}`);
  }
}

function maskCustomValue(value: Prisma.JsonValue) {
  return maskPartial(value) as Prisma.JsonValue;
}
