import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { toJsonValue } from '../common/json';
import { maskPartial } from '../common/masking';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeActivityTypeCode } from './activity-types';
import { CreateActivityDto, UpdateActivityDto } from './activities.dto';

const telephonyManagedActivityTypes = new Set(['001', '013']);
const defaultManualActivityTypes = new Set(['002', '003', '007']);

function isTelephonyManagedActivityType(type?: string | null) {
  return type ? telephonyManagedActivityTypes.has(normalizeActivityTypeCode(type)) : false;
}

function maskValue(value: unknown) {
  return maskPartial(value);
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly customFields: CustomFieldsService
  ) {}

  async list(query: { leadId?: string; type?: string } = {}, userId?: string) {
    const normalizedQueryType = query.type ? normalizeActivityTypeCode(query.type) : undefined;
    const effective = userId ? await this.access.effectivePermissions(userId) : null;
    const activities = await this.prisma.activity.findMany({
      where: {
        ...(query.leadId ? { leadId: query.leadId } : {}),
        ...(normalizedQueryType ? { type: normalizedQueryType } : {}),
        ...(effective && !this.access.hasLeadAllScope(effective) ? { lead: { assignedUserId: userId } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        lead: {
          select: {
            id: true,
            externalLeadId: true,
            customerName: true,
            mobile: true,
            status: true,
            category: true
          }
        },
        customValues: {
          include: { field: true }
        }
      }
    });

    return activities.filter((activity) => !effective || this.access.canActivityType(effective, normalizeActivityTypeCode(activity.type), 'view')).map((activity) => {
      const { customValues, ...activityRecord } = activity;
      const typeCode = normalizeActivityTypeCode(activity.type);
      const response = {
        ...activityRecord,
        customFields: customValues
          .filter((value) => !effective || this.access.getActivityTypeFieldAccess(effective, typeCode, value.field.fieldKey) !== 'hidden')
          .map((value) => {
            const access = effective ? this.access.getActivityTypeFieldAccess(effective, typeCode, value.field.fieldKey) : 'editable';
            return {
              key: value.field.fieldKey,
              label: value.field.label,
              value: access === 'masked' ? maskValue(value.value) : value.value
            };
          })
      };

      return effective ? this.access.applyFieldAccessToRecord(effective, 'Activity', response) : response;
    });
  }

  async create(input: CreateActivityDto, actor = 'system') {
    const normalizedType = normalizeActivityTypeCode(input.type);
    await this.access.assertActivityTypePermission(actor, normalizedType, 'create');
    if (input.customFields && Object.keys(input.customFields).length > 0) {
      await this.access.assertEditableActivityTypeFields(actor, normalizedType, Object.keys(input.customFields));
    }
    if (isTelephonyManagedActivityType(normalizedType)) {
      throw new BadRequestException('Call activities are created only from telephony call logs');
    }
    const activityType = await this.configuredActivityType(normalizedType);
    if (!activityType?.isActive || !activityType.allowManualCreate) {
      throw new BadRequestException('This activity type is not available for manual creation');
    }

    if (input.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: input.leadId } });
      if (!lead) throw new NotFoundException('Lead not found');
      await this.assertLeadVisible(input.leadId, actor);
    }

    const activity = await this.prisma.activity.create({
      data: {
        leadId: input.leadId,
        type: normalizedType,
        title: input.title,
        notes: input.notes,
        disposition: input.disposition,
        metadata: toJsonValue(input.metadata ?? {}),
        createdBy: actor
      }
    });

    await this.audit.write({
      moduleName: 'Activity',
      entityId: activity.id,
      action: 'create',
      newValue: activity,
      changedBy: actor
    });

    if (input.customFields && Object.keys(input.customFields).length > 0) {
      await this.customFields.upsertValues('Activity', activity.id, { values: input.customFields });
    }

    return input.customFields && Object.keys(input.customFields).length > 0
      ? this.prisma.activity.findUnique({
          where: { id: activity.id },
          include: {
            customValues: {
              include: { field: true }
            }
          }
        })
      : activity;
  }

  async update(id: string, input: UpdateActivityDto, actor = 'system') {
    const existing = await this.prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');
    await this.access.assertActivityTypePermission(actor, normalizeActivityTypeCode(existing.type), 'edit');
    await this.assertLeadVisible(existing.leadId, actor);
    if (input.leadId !== undefined && input.leadId !== existing.leadId) {
      await this.assertLeadVisible(input.leadId, actor);
    }
    if (input.type !== undefined && normalizeActivityTypeCode(input.type) !== normalizeActivityTypeCode(existing.type)) {
      await this.access.assertActivityTypePermission(actor, normalizeActivityTypeCode(input.type), 'create');
    }
    const targetType = input.type === undefined ? normalizeActivityTypeCode(existing.type) : normalizeActivityTypeCode(input.type);
    if (input.customFields && Object.keys(input.customFields).length > 0) {
      await this.access.assertEditableActivityTypeFields(actor, targetType, Object.keys(input.customFields));
    }
    if (isTelephonyManagedActivityType(existing.type) || isTelephonyManagedActivityType(input.type)) {
      throw new BadRequestException('Call activities are managed by telephony call logs');
    }

    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        type: input.type === undefined ? undefined : normalizeActivityTypeCode(input.type),
        leadId: input.leadId,
        title: input.title,
        notes: input.notes,
        disposition: input.disposition,
        metadata: input.metadata === undefined ? undefined : toJsonValue(input.metadata)
      }
    });

    if (input.customFields && Object.keys(input.customFields).length > 0) {
      await this.customFields.upsertValues('Activity', activity.id, { values: input.customFields });
    }

    await this.audit.write({
      moduleName: 'Activity',
      entityId: id,
      action: 'update',
      oldValue: existing,
      newValue: activity,
      changedBy: actor
    });

    return this.prisma.activity.findUnique({
      where: { id },
      include: {
        customValues: {
          include: { field: true }
        }
      }
    });
  }

  async delete(id: string, actor = 'system') {
    const existing = await this.prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');
    await this.access.assertActivityTypePermission(actor, normalizeActivityTypeCode(existing.type), 'delete');
    await this.assertLeadVisible(existing.leadId, actor);
    if (isTelephonyManagedActivityType(existing.type)) {
      throw new BadRequestException('Call activities are managed by telephony call logs');
    }

    await this.prisma.activityCustomFieldValue.deleteMany({ where: { activityId: id } });
    await this.prisma.activity.delete({ where: { id } });
    await this.audit.write({
      moduleName: 'Activity',
      entityId: id,
      action: 'delete',
      oldValue: existing,
      changedBy: actor
    });

    return { deleted: true };
  }

  private async configuredActivityType(code: string) {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: 'activity.types.config' } });
    const types = Array.isArray(setting?.value) ? setting.value as Array<Record<string, unknown>> : [];
    const configured = types.find((type) => String(type.code) === code) as { isActive?: boolean; allowManualCreate?: boolean } | undefined;
    return configured ?? { isActive: !['012', '013'].includes(code), allowManualCreate: defaultManualActivityTypes.has(code) };
  }

  private async assertLeadVisible(leadId: string | null | undefined, userId: string) {
    if (!leadId) return;
    const effective = await this.access.effectivePermissions(userId);
    if (this.access.hasLeadAllScope(effective)) return;
    const visibleLead = await this.prisma.lead.findFirst({ where: { id: leadId, assignedUserId: userId }, select: { id: true } });
    if (!visibleLead) throw new ForbiddenException('Lead is outside your assigned scope');
  }
}
