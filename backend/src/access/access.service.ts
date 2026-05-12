import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { toJsonValue } from '../common/json';
import { maskPartial } from '../common/masking';
import { assertPasswordPolicy } from '../common/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePermissionTemplateDto,
  CreateSalesGroupDto,
  CreateTeamDto,
  CreateUserDto,
  EvaluatePermissionDto,
  UpdatePermissionTemplateDto,
  UpdateSalesGroupDto,
  UpdateTeamDto,
  UpdateUserDto,
  UpsertFieldPermissionDto,
  UpsertModulePermissionDto
} from './access.dto';

export type ModuleAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'assign'
  | 'bulkUpload'
  | 'configureAutomation'
  | 'manageConnector'
  | 'viewAuditLogs';

export type ActivityTypeAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'playRecording';

const actionColumnMap: Record<ModuleAction, string> = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
  export: 'canExport',
  assign: 'canAssign',
  bulkUpload: 'canBulkUpload',
  configureAutomation: 'canConfigureAutomation',
  manageConnector: 'canManageConnector',
  viewAuditLogs: 'canViewAuditLogs'
};

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, roles, teams, salesGroups, permissionTemplates] = await Promise.all([
      this.prisma.user.findMany({
        where: { isSystem: false },
        orderBy: { createdAt: 'desc' },
        include: {
          role: true,
          team: true,
          permissionTemplate: true,
          salesGroups: {
            include: { salesGroup: true }
          },
          customValues: { include: { field: true } }
        }
      }),
      this.prisma.role.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.team.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.salesGroup.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.permissionTemplate.findMany({
        orderBy: { name: 'asc' },
        include: {
          modules: true,
          fields: true
        }
      })
    ]);

    return {
      users: users.map((user) => ({
        ...user,
        customFields: user.customValues.map((value) => ({
          key: value.field.fieldKey,
          label: value.field.label,
          value: value.value
        }))
      })),
      roles,
      teams,
      salesGroups,
      permissionTemplates
    };
  }

  async listUsers(viewerId?: string) {
    const users = await this.prisma.user.findMany({
      where: { isSystem: false },
      orderBy: { createdAt: 'desc' },
      include: {
        role: true,
        team: true,
        permissionTemplate: true,
        salesGroups: { include: { salesGroup: true } }
      }
    });

    const effective = viewerId ? await this.effectivePermissions(viewerId) : null;
    return users.map((user) => this.applyUserFieldAccess(toUserResponse(user), effective));
  }

  async getUser(userId: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        team: true,
        permissionTemplate: true,
        salesGroups: { include: { salesGroup: true } },
        customValues: { include: { field: true } }
      }
    });

    if (!user || user.isSystem) throw new NotFoundException('User not found');
    const effective = viewerId ? await this.effectivePermissions(viewerId) : null;
    const formatted = this.applyUserFieldAccess(toUserResponse(user), effective);
    return {
      ...formatted,
      customFields: user.customValues.map((value) => ({
        key: value.field.fieldKey,
        label: value.field.label,
        value: effective && this.getFieldAccess(effective, 'User', value.field.fieldKey) === 'masked' ? maskValue(value.value) : value.value
      })).filter((value) => !effective || this.getFieldAccess(effective, 'User', value.key) !== 'hidden')
    };
  }

  async createUser(input: CreateUserDto, actor = 'system') {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already exists');
    if (input.password) assertPasswordPolicy(input.password);
    await this.assertMandatoryFields('User', input, { roleId: input.roleId, teamId: input.teamId, context: 'create' });
    const normalizedPhone = normalizePhone(input.phone);
    await this.assertUniqueUserPhone(normalizedPhone);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          phone: normalizedPhone,
          roleId: input.roleId,
          teamId: input.teamId || null,
          permissionTemplateId: input.permissionTemplateId || null,
          passwordHash: input.password ? await bcrypt.hash(input.password, 12) : null,
          isActive: input.isActive ?? true,
          twoFactorEnabled: input.twoFactorEnabled ?? false
        }
      });

      if (input.salesGroupIds?.length) {
        await tx.userSalesGroup.createMany({
          data: [...new Set(input.salesGroupIds)].map((salesGroupId) => ({
            userId: created.id,
            salesGroupId
          })),
          skipDuplicates: true
        });
      }

      if (input.customFields && Object.keys(input.customFields).length > 0) {
        await this.upsertUserCustomFields(created.id, input.customFields, tx);
      }

      return created;
    });

    await this.writeAudit('User', user.id, 'create', undefined, sanitizeUserAudit(input), actor);
    return this.getUser(user.id);
  }

  async updateUser(userId: string, input: UpdateUserDto, actor = 'system') {
    const oldValue = await this.getUser(userId);
    if (input.password !== undefined) assertPasswordPolicy(input.password);

    if (input.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (existing && existing.id !== userId) throw new ConflictException('Email already exists');
    }
    const normalizedPhone = input.phone === undefined ? undefined : normalizePhone(input.phone);
    if (normalizedPhone !== undefined) await this.assertUniqueUserPhone(normalizedPhone, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.email === undefined ? {} : { email: input.email.toLowerCase() }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.phone === undefined ? {} : { phone: normalizedPhone }),
          ...(input.roleId === undefined ? {} : { roleId: input.roleId }),
          ...(input.teamId === undefined ? {} : { teamId: input.teamId || null }),
          ...(input.permissionTemplateId === undefined ? {} : { permissionTemplateId: input.permissionTemplateId || null }),
          ...(input.password === undefined ? {} : { passwordHash: await bcrypt.hash(input.password, 12) }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          ...(input.twoFactorEnabled === undefined ? {} : { twoFactorEnabled: input.twoFactorEnabled }),
          ...(input.twoFactorDisabledByAdmin === undefined ? {} : { twoFactorDisabledByAdmin: input.twoFactorDisabledByAdmin })
        }
      });

      if (input.salesGroupIds !== undefined) {
        await tx.userSalesGroup.deleteMany({ where: { userId } });
        if (input.salesGroupIds.length) {
          await tx.userSalesGroup.createMany({
            data: [...new Set(input.salesGroupIds)].map((salesGroupId) => ({
              userId,
              salesGroupId
            })),
            skipDuplicates: true
          });
        }
      }

      if (input.customFields && Object.keys(input.customFields).length > 0) {
        await this.upsertUserCustomFields(userId, input.customFields, tx);
      }

      if (shouldRevokeSessionsAfterUserUpdate(input)) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
    });

    const newValue = await this.getUser(userId);
    await this.writeAudit('User', userId, 'update', oldValue, sanitizeUserAudit(newValue), actor);
    return newValue;
  }

  async deactivateUser(userId: string, actor = 'system') {
    const oldValue = await this.getUser(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    const newValue = await this.getUser(userId);
    await this.writeAudit('User', userId, 'deactivate', oldValue, newValue, actor);
    return newValue;
  }

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  private async upsertUserCustomFields(userId: string, values: Record<string, unknown>, tx: Pick<PrismaService, 'userCustomField' | 'userCustomFieldValue'> = this.prisma) {
    const definitions = await tx.userCustomField.findMany({
      where: { isActive: true }
    });
    const definitionByKey = new Map(definitions.map((definition) => [definition.fieldKey, definition]));
    const missingRequired = definitions.filter((definition) => definition.isRequired && isBlank(values[definition.fieldKey]) && isBlank(definition.defaultValue));

    if (missingRequired.length > 0) {
      throw new BadRequestException(`Missing required custom fields: ${missingRequired.map((field) => field.fieldKey).join(', ')}`);
    }

    for (const [fieldKey, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const definition = definitionByKey.get(fieldKey);
      if (!definition) throw new BadRequestException(`Unknown custom field: ${fieldKey}`);
      validateCustomValue(definition, value);
      await tx.userCustomFieldValue.upsert({
        where: {
          userId_fieldId: {
            userId,
            fieldId: definition.id
          }
        },
        update: {
          value: toJsonValue(value)
        },
        create: {
          userId,
          fieldId: definition.id,
          value: toJsonValue(value)
        }
      });
    }
  }

  async listTeams() {
    return this.prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true, leads: true }
        }
      }
    });
  }

  async createTeam(input: CreateTeamDto, actor = 'system') {
    const team = await this.prisma.team.create({
      data: {
        name: input.name,
        code: input.code || null,
        type: input.type || null,
        isActive: input.isActive ?? true
      }
    });
    await this.writeAudit('Team', team.id, 'create', undefined, team, actor);
    return team;
  }

  async updateTeam(teamId: string, input: UpdateTeamDto, actor = 'system') {
    const oldValue = await this.prisma.team.findUnique({ where: { id: teamId } });
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.code === undefined ? {} : { code: input.code || null }),
        ...(input.type === undefined ? {} : { type: input.type || null }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.writeAudit('Team', teamId, 'update', oldValue, team, actor);
    return team;
  }

  async deactivateTeam(teamId: string, actor = 'system') {
    const oldValue = await this.prisma.team.findUnique({ where: { id: teamId } });
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: { isActive: false }
    });
    await this.writeAudit('Team', teamId, 'deactivate', oldValue, team, actor);
    return team;
  }

  async listSalesGroups() {
    return this.prisma.salesGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  async createSalesGroup(input: CreateSalesGroupDto, actor = 'system') {
    const salesGroup = await this.prisma.salesGroup.create({
      data: {
        name: input.name,
        isActive: input.isActive ?? true
      }
    });
    await this.writeAudit('SalesGroup', salesGroup.id, 'create', undefined, salesGroup, actor);
    return salesGroup;
  }

  async updateSalesGroup(salesGroupId: string, input: UpdateSalesGroupDto, actor = 'system') {
    const oldValue = await this.prisma.salesGroup.findUnique({ where: { id: salesGroupId } });
    const salesGroup = await this.prisma.salesGroup.update({
      where: { id: salesGroupId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.writeAudit('SalesGroup', salesGroupId, 'update', oldValue, salesGroup, actor);
    return salesGroup;
  }

  async deactivateSalesGroup(salesGroupId: string, actor = 'system') {
    const oldValue = await this.prisma.salesGroup.findUnique({ where: { id: salesGroupId } });
    const salesGroup = await this.prisma.salesGroup.update({
      where: { id: salesGroupId },
      data: { isActive: false }
    });
    await this.writeAudit('SalesGroup', salesGroupId, 'deactivate', oldValue, salesGroup, actor);
    return salesGroup;
  }

  async listPermissionTemplates() {
    return this.prisma.permissionTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        modules: { orderBy: { moduleName: 'asc' } },
        fields: { orderBy: [{ moduleName: 'asc' }, { fieldKey: 'asc' }] },
        _count: { select: { users: true } }
      }
    });
  }

  async getPermissionTemplate(templateId: string) {
    const template = await this.prisma.permissionTemplate.findUnique({
      where: { id: templateId },
      include: {
        modules: { orderBy: { moduleName: 'asc' } },
        fields: { orderBy: [{ moduleName: 'asc' }, { fieldKey: 'asc' }] },
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!template) throw new NotFoundException('Permission template not found');
    return template;
  }

  async createPermissionTemplate(input: CreatePermissionTemplateDto, actor = 'system') {
    const template = await this.prisma.permissionTemplate.create({
      data: {
        name: input.name,
        description: input.description || null,
        isSystem: false
      },
      include: { modules: true, fields: true }
    });
    await this.writeAudit('PermissionTemplate', template.id, 'create', undefined, template, actor);
    return template;
  }

  async updatePermissionTemplate(templateId: string, input: UpdatePermissionTemplateDto, actor = 'system') {
    const existing = await this.prisma.permissionTemplate.findUnique({ where: { id: templateId } });
    if (!existing) throw new NotFoundException('Permission template not found');
    this.assertPermissionTemplateEditable(existing);

    const template = await this.prisma.permissionTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description || null })
      },
      include: {
        modules: { orderBy: { moduleName: 'asc' } },
        fields: { orderBy: [{ moduleName: 'asc' }, { fieldKey: 'asc' }] }
      }
    });
    await this.writeAudit('PermissionTemplate', templateId, 'update', existing, template, actor);
    return template;
  }

  async deletePermissionTemplate(templateId: string, actor = 'system') {
    const template = await this.prisma.permissionTemplate.findUnique({
      where: { id: templateId },
      include: { _count: { select: { users: true } } }
    });
    if (!template) throw new NotFoundException('Permission template not found');
    if (template.isSystem) throw new ConflictException('System permission templates cannot be deleted');
    if (template._count.users > 0) throw new ConflictException('Permission template is assigned to users');

    await this.prisma.$transaction([
      this.prisma.permissionTemplateField.deleteMany({ where: { permissionTemplateId: templateId } }),
      this.prisma.permissionTemplateModule.deleteMany({ where: { permissionTemplateId: templateId } }),
      this.prisma.permissionTemplate.delete({ where: { id: templateId } })
    ]);

    await this.writeAudit('PermissionTemplate', templateId, 'delete', template, undefined, actor);
    return { status: 'deleted' };
  }

  async upsertModulePermission(templateId: string, input: UpsertModulePermissionDto, actor = 'system') {
    await this.ensureEditablePermissionTemplate(templateId);
    const data = modulePermissionData(input);

    const oldValue = await this.prisma.permissionTemplateModule.findUnique({
      where: {
        permissionTemplateId_moduleName: {
          permissionTemplateId: templateId,
          moduleName: input.moduleName
        }
      }
    });
    const modulePermission = await this.prisma.permissionTemplateModule.upsert({
      where: {
        permissionTemplateId_moduleName: {
          permissionTemplateId: templateId,
          moduleName: input.moduleName
        }
      },
      update: data,
      create: {
        permissionTemplateId: templateId,
        moduleName: input.moduleName,
        ...data
      }
    });
    await this.writeAudit('PermissionTemplate', templateId, 'upsert_module_permission', oldValue, modulePermission, actor);
    return modulePermission;
  }

  async deleteModulePermission(templateId: string, moduleName: string, actor = 'system') {
    await this.ensureEditablePermissionTemplate(templateId);
    const oldValue = await this.prisma.permissionTemplateModule.findUnique({
      where: {
        permissionTemplateId_moduleName: {
          permissionTemplateId: templateId,
          moduleName
        }
      }
    });
    await this.prisma.permissionTemplateModule.deleteMany({
      where: {
        permissionTemplateId: templateId,
        moduleName
      }
    });

    await this.writeAudit('PermissionTemplate', templateId, 'delete_module_permission', oldValue, { moduleName }, actor);
    return { status: 'deleted' };
  }

  async effectivePermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        permissionTemplate: {
          include: {
            modules: true,
            fields: true
          }
        }
      }
    });

    if (!user) throw new NotFoundException('User not found');

    const isAdministrator = user.role.name === 'Administrator';
    const modulePermissions = Object.fromEntries(
      (user.permissionTemplate?.modules ?? []).map((modulePermission) => [
        modulePermission.moduleName,
        {
          view: isAdministrator || modulePermission.canView,
          create: isAdministrator || modulePermission.canCreate,
          edit: isAdministrator || modulePermission.canEdit,
          delete: isAdministrator || modulePermission.canDelete,
          export: isAdministrator || modulePermission.canExport,
          assign: isAdministrator || modulePermission.canAssign,
          bulkUpload: isAdministrator || modulePermission.canBulkUpload,
          configureAutomation: isAdministrator || modulePermission.canConfigureAutomation,
          manageConnector: isAdministrator || modulePermission.canManageConnector,
          viewAuditLogs: isAdministrator || modulePermission.canViewAuditLogs
        }
      ])
    );

    const fieldPermissions = Object.fromEntries(
      (user.permissionTemplate?.fields ?? []).map((fieldPermission) => [
        `${fieldPermission.moduleName}.${fieldPermission.fieldKey}`,
        fieldPermission.access
      ])
    );

    return {
      userId: user.id,
      role: user.role.name,
      permissionTemplateId: user.permissionTemplateId,
      isAdministrator,
      modulePermissions,
      fieldPermissions
    };
  }

  async evaluate(input: EvaluatePermissionDto) {
    const effective = await this.effectivePermissions(input.userId);
    const action = input.action as ModuleAction;
    const modulePermission = this.canModule(effective, input.moduleName, action);
    const fieldAccess = input.fieldKey ? this.getFieldAccess(effective, input.moduleName, input.fieldKey) : undefined;

    return {
      allowed: modulePermission && fieldAccess !== 'hidden',
      moduleAllowed: modulePermission,
      fieldAccess
    };
  }

  async assertModulePermission(userId: string, moduleName: string, action: ModuleAction) {
    const effective = await this.effectivePermissions(userId);
    if (!this.canModule(effective, moduleName, action)) {
      throw new ForbiddenException(`Missing ${action} permission for ${moduleName}`);
    }
    return effective;
  }

  async assertActivityTypePermission(userId: string, typeCode: string, action: ActivityTypeAction) {
    const effective = await this.effectivePermissions(userId);
    if (!this.canActivityType(effective, typeCode, action)) {
      throw new ForbiddenException(`Missing ${action} permission for activity type ${typeCode}`);
    }
    return effective;
  }

  async assertEditableFields(userId: string, moduleName: string, fieldKeys: string[]) {
    const effective = await this.effectivePermissions(userId);
    if (effective.isAdministrator) return effective;

    const blockedFields = [...new Set(fieldKeys)].filter((fieldKey) => this.getFieldAccess(effective, moduleName, fieldKey) !== 'editable');
    if (blockedFields.length > 0) {
      throw new ForbiddenException(`Fields are not editable: ${blockedFields.join(', ')}`);
    }

    return effective;
  }

  async assertEditableActivityTypeFields(userId: string, typeCode: string, fieldKeys: string[]) {
    const effective = await this.effectivePermissions(userId);
    if (effective.isAdministrator) return effective;

    const blockedFields = [...new Set(fieldKeys)].filter((fieldKey) => this.getActivityTypeFieldAccess(effective, typeCode, fieldKey) !== 'editable');
    if (blockedFields.length > 0) {
      throw new ForbiddenException(`Activity type fields are not editable: ${blockedFields.join(', ')}`);
    }

    return effective;
  }

  async assertMandatoryFields(moduleName: string, input: object, options: { roleId?: string | null; teamId?: string | null; context?: string | null } = {}) {
    const scopedConditions = mandatoryRuleScopes(options);
    const rules = await this.prisma.fieldMandatoryRule.findMany({
      where: {
        moduleName,
        isActive: true,
        isRequired: true,
        OR: scopedConditions
      }
    });

    const inputByKey = Object.fromEntries(Object.entries(input));
    const missingFields = [...new Set(rules.map((rule) => rule.fieldKey))].filter((fieldKey) => isBlank(inputByKey[fieldKey]));
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing mandatory fields: ${missingFields.join(', ')}`);
    }
  }

  async upsertFieldPermission(input: UpsertFieldPermissionDto, actor = 'system') {
    await this.ensureEditablePermissionTemplate(input.permissionTemplateId);
    const oldValue = await this.prisma.permissionTemplateField.findUnique({
      where: {
        permissionTemplateId_moduleName_fieldKey: {
          permissionTemplateId: input.permissionTemplateId,
          moduleName: input.moduleName,
          fieldKey: input.fieldKey
        }
      }
    });
    const fieldPermission = await this.prisma.permissionTemplateField.upsert({
      where: {
        permissionTemplateId_moduleName_fieldKey: {
          permissionTemplateId: input.permissionTemplateId,
          moduleName: input.moduleName,
          fieldKey: input.fieldKey
        }
      },
      update: { access: input.access },
      create: {
        permissionTemplateId: input.permissionTemplateId,
        moduleName: input.moduleName,
        fieldKey: input.fieldKey,
        access: input.access
      }
    });
    await this.writeAudit('PermissionTemplate', input.permissionTemplateId, 'upsert_field_permission', oldValue, fieldPermission, actor);
    return fieldPermission;
  }

  private async ensurePermissionTemplate(templateId: string) {
    const template = await this.prisma.permissionTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Permission template not found');
    return template;
  }

  private async ensureEditablePermissionTemplate(templateId: string) {
    const template = await this.ensurePermissionTemplate(templateId);
    this.assertPermissionTemplateEditable(template);
    return template;
  }

  private assertPermissionTemplateEditable(template: { name: string }) {
    if (template.name === 'Administrator Full Access') {
      throw new ConflictException('Administrator Full Access is locked');
    }
  }

  canModule(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, moduleName: string, action: ModuleAction) {
    if (effective.isAdministrator) return true;
    const modulePermission = effective.modulePermissions[moduleName] as Record<string, boolean> | undefined;
    if (!modulePermission) return false;
    return Boolean(modulePermission[action]);
  }

  getFieldAccess(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, moduleName: string, fieldKey: string) {
    if (effective.isAdministrator) return 'editable';
    return effective.fieldPermissions[`${moduleName}.${fieldKey}`] ?? 'visible';
  }

  canActivityType(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, typeCode: string, action: ActivityTypeAction) {
    if (effective.isAdministrator) return true;
    const moduleAction = action === 'playRecording' ? 'view' : action;
    if (!this.canModule(effective, 'Activity', moduleAction)) return false;
    const typeActionAccess = this.getFieldAccess(effective, 'ActivityType', `${typeCode}.${action}`);
    return typeActionAccess !== 'hidden';
  }

  getActivityTypeFieldAccess(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, typeCode: string, fieldKey: string) {
    if (effective.isAdministrator) return 'editable';
    const genericAccess = this.getFieldAccess(effective, 'Activity', fieldKey);
    const typeAccess = effective.fieldPermissions[`ActivityTypeField.${typeCode}.${fieldKey}`];
    if (genericAccess === 'hidden' || typeAccess === 'hidden') return 'hidden';
    if (genericAccess === 'masked' || typeAccess === 'masked') return 'masked';
    if (typeAccess === undefined) return genericAccess;
    return genericAccess === 'editable' && typeAccess === 'editable' ? 'editable' : 'visible';
  }

  hasLeadAllScope(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>) {
    if (effective.isAdministrator) return true;
    return ['visible', 'editable'].includes(effective.fieldPermissions['Lead.__recordScope.allLeads']);
  }

  applyFieldAccessToRecord<T extends Record<string, unknown>>(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, moduleName: string, record: T) {
    if (effective.isAdministrator) return record;
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      const access = this.getFieldAccess(effective, moduleName, key);
      if (access === 'hidden') continue;
      output[key] = access === 'masked' ? maskValue(value) : value;
    }

    return output as Partial<T>;
  }

  private applyUserFieldAccess<T extends Record<string, unknown>>(record: T, effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null) {
    return effective ? this.applyFieldAccessToRecord(effective, 'User', record) : record;
  }

  private async assertUniqueUserPhone(phone: string | null, currentUserId?: string) {
    if (!phone) return;
    const existing = await this.prisma.user.findFirst({
      where: {
        phone,
        ...(currentUserId ? { id: { not: currentUserId } } : {})
      },
      select: { id: true }
    });
    if (existing) throw new ConflictException('Phone number is already assigned to another user');
  }

  private async writeAudit(moduleName: string, entityId: string, action: string, oldValue: unknown, newValue: unknown, changedBy: string) {
    await this.prisma.auditLog.create({
      data: {
        moduleName,
        entityId,
        action,
        oldValue: oldValue === undefined ? undefined : toJsonValue(oldValue),
        newValue: newValue === undefined ? undefined : toJsonValue(newValue),
        changedBy
      }
    });
  }
}

function sanitizeUserAudit(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const output = { ...(value as Record<string, unknown>) };
  delete output.password;
  delete output.passwordHash;
  return output;
}

function maskValue(value: unknown) {
  return maskPartial(value);
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-10);
}

function shouldRevokeSessionsAfterUserUpdate(input: UpdateUserDto) {
  return [
    input.password,
    input.roleId,
    input.teamId,
    input.permissionTemplateId,
    input.isActive === false ? 'inactive' : undefined,
    input.twoFactorEnabled,
    input.twoFactorDisabledByAdmin
  ].some((value) => value !== undefined);
}

function modulePermissionData(input: UpsertModulePermissionDto) {
  return {
    canView: input.canView ?? false,
    canCreate: input.canCreate ?? false,
    canEdit: input.canEdit ?? false,
    canDelete: input.canDelete ?? false,
    canExport: input.canExport ?? false,
    canAssign: input.canAssign ?? false,
    canBulkUpload: input.canBulkUpload ?? false,
    canConfigureAutomation: input.canConfigureAutomation ?? false,
    canManageConnector: input.canManageConnector ?? false,
    canViewAuditLogs: input.canViewAuditLogs ?? false
  };
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === '';
}

function validateCustomValue(definition: { fieldKey: string; fieldType: string; options?: unknown; validation?: unknown }, value: unknown) {
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

function mandatoryRuleScopes(options: { roleId?: string | null; teamId?: string | null; context?: string | null }) {
  const scopes: Array<{ roleId?: string | null; teamId?: string | null; context?: string | null }> = [{ roleId: null, teamId: null, context: null }];

  if (options.roleId) scopes.push({ roleId: options.roleId });
  if (options.teamId) scopes.push({ teamId: options.teamId });
  if (options.context) scopes.push({ context: options.context });
  if (options.roleId && options.teamId) scopes.push({ roleId: options.roleId, teamId: options.teamId });
  if (options.roleId && options.context) scopes.push({ roleId: options.roleId, context: options.context });
  if (options.teamId && options.context) scopes.push({ teamId: options.teamId, context: options.context });
  if (options.roleId && options.teamId && options.context) scopes.push({ roleId: options.roleId, teamId: options.teamId, context: options.context });

  return scopes;
}

function toUserResponse(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorDisabledByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: { id: string; name: string };
  team: { id: string; name: string; code: string | null; type: string | null } | null;
  permissionTemplate: { id: string; name: string } | null;
  salesGroups: Array<{ salesGroup: { id: string; name: string } }>;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorDisabledByAdmin: user.twoFactorDisabledByAdmin,
    role: user.role,
    team: user.team,
    permissionTemplate: user.permissionTemplate,
    salesGroups: user.salesGroups.map((entry) => entry.salesGroup),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
