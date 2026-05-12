import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { activityTypeCodes } from '../activities/activity-types';
import { AuditService } from '../audit/audit.service';
import { toJsonValue } from '../common/json';
import { maskPartial } from '../common/masking';
import { pagination } from '../common/pagination';
import { normalizeTenDigitPhone } from '../common/phone';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignLeadDto, BulkAssignLeadDto, BulkUpdateLeadDto, CreateLeadDto, ListLeadsQueryDto, SaveLeadViewDto, UpdateDispositionDto, UpdateLeadDto } from './leads.dto';
import { changedKeys, csvCell, isExportableFieldAccess, leadExportColumns, pickKeys, sanitizeBulkLeadPatch, uniqueNonEmpty } from './leads.export';
import { humanizeLeadField, isLeadDuplicateField, leadDuplicateFieldValue, LeadDuplicateValues, leadOrderBy, leadSearchFields, leadWhere } from './leads.filters';
import { formatSavedLeadView, savedLeadViewData } from './leads.views';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly customFields: CustomFieldsService
  ) {}

  async list(query: ListLeadsQueryDto = {}, userId?: string) {
    const pageInfo = pagination(query);
    const where = await this.visibleLeadWhere(query, userId);
    const orderBy = leadOrderBy(query.sortBy, query.sortOrder);

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy,
        skip: pageInfo.skip,
        take: pageInfo.take,
        include: {
          team: true,
          uploadBatch: true,
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 3
          },
          customValues: {
            include: { field: true }
          }
        }
      }),
      this.prisma.lead.count({ where })
    ]);

    const [assignedUserMap, effective] = await Promise.all([
      this.userNameMap(leads.map((lead) => lead.assignedUserId)),
      userId ? this.access.effectivePermissions(userId) : null
    ]);
    return {
      items: leads.map((lead) => this.formatLead(lead, effective, assignedUserMap)),
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageInfo.pageSize))
    };
  }

  async get(id: string, userId?: string) {
    const visibleWhere = await this.visibleLeadWhere({}, userId);
    const lead = await this.prisma.lead.findFirst({
      where: { AND: [{ OR: [{ id }, { externalLeadId: id }] }, visibleWhere] },
      include: {
        team: true,
        uploadBatch: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 200
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 200
        },
        customValues: {
          include: { field: true }
        }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const [assignments, automationRuns, assignedUserMap, effective] = await Promise.all([
      this.prisma.leadAssignment.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.prisma.automationRun.findMany({
        where: { leadId: lead.id },
        orderBy: { startedAt: 'desc' },
        take: 50,
        include: {
          steps: {
            orderBy: { startedAt: 'desc' },
            take: 100
          }
        }
      }),
      this.userNameMap([lead.assignedUserId]),
      userId ? this.access.effectivePermissions(userId) : null
    ]);
    const response = {
      ...lead,
      assignedUserName: lead.assignedUserId ? assignedUserMap.get(lead.assignedUserId) ?? null : null,
      offerAmount: lead.offerAmount?.toString() ?? null,
      emiAmount: lead.emiAmount?.toString() ?? null,
      customFields: this.formatCustomFields(lead.customValues, effective),
      assignments,
      automationRuns
    };

    return effective ? this.access.applyFieldAccessToRecord(effective, 'Lead', response) : response;
  }

  async summary(userId?: string) {
    const visibleWhere = await this.visibleLeadWhere({}, userId);
    const [total, assigned, converted, uploads] = await Promise.all([
      this.prisma.lead.count({ where: visibleWhere }),
      this.prisma.lead.count({ where: { AND: [visibleWhere, { assignedUserId: { not: null } }] } }),
      this.prisma.lead.count({ where: { AND: [visibleWhere, { OR: [{ status: 'Converted' }, { disposition: 'Converted' }] }] } }),
      this.prisma.leadUploadBatch.count()
    ]);

    return { total, assigned, converted, uploads };
  }

  async exportCsv(userId: string, query: ListLeadsQueryDto = {}) {
    const effective = await this.access.effectivePermissions(userId);
    const where = await this.visibleLeadWhere(query, userId);
    const orderBy = leadOrderBy(query.sortBy, query.sortOrder);
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy,
      take: 5000,
      include: {
        team: true,
        uploadBatch: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 3
        },
        customValues: {
          include: { field: true }
        }
      }
    });

    const baseColumns = leadExportColumns.filter((column) => isExportableFieldAccess(this.access.getFieldAccess(effective, 'Lead', column.key)));
    const customFieldKeys = [
      ...new Map(
        leads
          .flatMap((lead) => lead.customValues.map((value) => [value.field.fieldKey, value.field.label] as const))
          .filter(([fieldKey]) => isExportableFieldAccess(this.access.getFieldAccess(effective, 'Lead', fieldKey)))
      ).entries()
    ];
    const headers = [...baseColumns.map((column) => column.label), ...customFieldKeys.map(([, label]) => label)];
    const assignedUserMap = await this.userNameMap(leads.map((lead) => lead.assignedUserId));
    const rows = leads.map((lead) => {
      const formatted = this.formatLead(lead, effective, assignedUserMap) as Record<string, unknown>;
      const customByKey = new Map(lead.customValues.map((value) => [value.field.fieldKey, value.value]));
      return [
        ...baseColumns.map((column) => formatted[column.key] ?? ''),
        ...customFieldKeys.map(([fieldKey]) => customByKey.get(fieldKey) ?? '')
      ];
    });

    await this.audit.write({
      moduleName: 'Lead',
      entityId: 'lead-export',
      action: 'export_download',
      newValue: { rowCount: rows.length, columnCount: headers.length, filters: query },
      changedBy: userId
    });

    return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  }

  async savedViews(userId: string) {
    const views = await this.prisma.savedLeadView.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
    return views.map(formatSavedLeadView);
  }

  async createSavedView(userId: string, input: SaveLeadViewDto) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Saved view name is required');

    const makeDefault = input.isDefault ?? (await this.prisma.savedLeadView.count({ where: { userId } })) === 0;
    const view = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.savedLeadView.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.savedLeadView.create({
        data: savedLeadViewData(userId, { ...input, name, isDefault: makeDefault }) as Prisma.SavedLeadViewUncheckedCreateInput
      });
    });
    return formatSavedLeadView(view);
  }

  async updateSavedView(userId: string, id: string, input: SaveLeadViewDto) {
    const existing = await this.prisma.savedLeadView.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Saved view not found');
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Saved view name is required');

    const view = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.savedLeadView.updateMany({ where: { userId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.savedLeadView.update({
        where: { id },
        data: savedLeadViewData(userId, { ...input, name }, false) as Prisma.SavedLeadViewUncheckedUpdateInput
      });
    });
    return formatSavedLeadView(view);
  }

  async deleteSavedView(userId: string, id: string) {
    const existing = await this.prisma.savedLeadView.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Saved view not found');
    await this.prisma.savedLeadView.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await this.prisma.savedLeadView.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });
      if (next) {
        await this.prisma.savedLeadView.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    return { deleted: true };
  }

  async create(input: CreateLeadDto, actor = 'system') {
    const mobile = normalizeTenDigitPhone(input.mobile);
    if (!mobile) {
      throw new BadRequestException('Lead mobile must be a valid 10-digit number');
    }
    await this.assertNoDuplicateLead({
      mobile,
      externalLeadId: input.externalLeadId,
      customerName: input.customerName,
      branchCode: input.branchCode,
      branchName: input.branchName,
      customFields: input.customFields ?? {}
    });

    const lead = await this.prisma.lead.create({
      data: {
        externalLeadId: input.externalLeadId,
        customerName: input.customerName,
        mobile,
        email: input.email,
        branchCode: input.branchCode,
        branchName: input.branchName,
        teamId: input.teamId,
        assignedUserId: input.assignedUserId,
        offerAmount: input.offerAmount,
        emiAmount: input.emiAmount,
        preferredLanguage: input.preferredLanguage,
        location: input.location,
        uploadDate: input.uploadDate ? new Date(input.uploadDate) : undefined,
        offerExpiryDate: input.offerExpiryDate ? new Date(input.offerExpiryDate) : undefined,
        status: input.status ?? 'New',
        category: input.category,
        createdBy: actor,
        updatedBy: actor
      }
    });

    await Promise.all([
      this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: activityTypeCodes.system,
          title: 'Lead created',
          metadata: { source: 'api' },
          createdBy: actor
        }
      }),
      this.audit.write({
        moduleName: 'Lead',
        entityId: lead.id,
        action: 'create',
        newValue: lead,
        changedBy: actor
      })
    ]);

    if (input.customFields && Object.keys(input.customFields).length > 0) {
      await this.customFields.upsertValues('Lead', lead.id, { values: input.customFields });
      await this.audit.write({
        moduleName: 'Lead',
        entityId: lead.id,
        action: 'custom_fields_create',
        newValue: { customFields: input.customFields },
        changedBy: actor
      });
    }

    return this.get(lead.id, actor);
  }

  async update(id: string, input: UpdateLeadDto, actor = 'system') {
    const existing = await this.resolveLeadForMutation(id, actor);
    const leadId = existing.id;

    const nextMobile = input.mobile === undefined ? undefined : normalizeTenDigitPhone(input.mobile);
    if (input.mobile !== undefined && !nextMobile) {
      throw new BadRequestException('Lead mobile must be a valid 10-digit number');
    }
    const existingCustomFields = await this.leadCustomFieldSnapshot(leadId);
    await this.assertNoDuplicateLead(
      {
        mobile: nextMobile ?? existing.mobile,
        externalLeadId: input.externalLeadId ?? existing.externalLeadId,
        customerName: input.customerName ?? existing.customerName,
        branchCode: input.branchCode ?? existing.branchCode,
        branchName: input.branchName ?? existing.branchName,
        customFields: { ...existingCustomFields, ...(input.customFields ?? {}) }
      },
      leadId
    );

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        externalLeadId: input.externalLeadId,
        customerName: input.customerName,
        mobile: nextMobile ?? undefined,
        email: input.email,
        branchCode: input.branchCode,
        branchName: input.branchName,
        teamId: input.teamId,
        assignedUserId: input.assignedUserId,
        offerAmount: input.offerAmount,
        emiAmount: input.emiAmount,
        preferredLanguage: input.preferredLanguage,
        location: input.location,
        status: input.status,
        category: input.category,
        updatedBy: actor
      }
    });

    await this.audit.write({
      moduleName: 'Lead',
      entityId: leadId,
      action: 'update',
      oldValue: existing,
      newValue: updated,
      changedBy: actor
    });

    const statusChanged = input.status !== undefined && input.status !== existing.status;
    const categoryChanged = input.category !== undefined && input.category !== existing.category;
    if (statusChanged || categoryChanged) {
      const userNameMap = await this.userNameMap([actor]);
      const changedBy = userNameMap.get(actor) ?? (actor === 'system' ? 'System' : actor);
      const title = [
        statusChanged ? `Status changed from ${existing.status ?? '-'} to ${updated.status ?? '-'}` : null,
        categoryChanged ? `Category changed from ${existing.category ?? '-'} to ${updated.category ?? '-'}` : null
      ].filter(Boolean).join('; ');
      await Promise.all([
        this.prisma.leadStatusHistory.create({
          data: {
            leadId,
            oldStatus: existing.status,
            newStatus: updated.status,
            oldCategory: existing.category,
            newCategory: updated.category,
            oldDisposition: existing.disposition,
            newDisposition: updated.disposition,
            remarks: 'Lead status/category updated',
            createdBy: actor
          }
        }),
        this.prisma.activity.create({
          data: {
            leadId,
            type: activityTypeCodes.system,
            title: `${title} by ${changedBy}`,
            metadata: toJsonValue({
              oldStatus: existing.status,
              newStatus: updated.status,
              oldCategory: existing.category,
              newCategory: updated.category,
              changedBy
            }),
            createdBy: actor
          }
        })
      ]);
    }

    if (input.customFields && Object.keys(input.customFields).length > 0) {
      const oldCustomFields = existingCustomFields;
      await this.customFields.upsertValues('Lead', leadId, { values: input.customFields });
      const newCustomFields = await this.leadCustomFieldSnapshot(leadId);
      const changed = changedKeys(input.customFields, oldCustomFields, newCustomFields);
      if (changed.length > 0) {
        await this.audit.write({
          moduleName: 'Lead',
          entityId: leadId,
          action: 'custom_fields_update',
          oldValue: pickKeys(oldCustomFields, changed),
          newValue: pickKeys(newCustomFields, changed),
          changedBy: actor
        });
      }
    }

    return this.get(leadId, actor);
  }

  async updateDisposition(id: string, input: UpdateDispositionDto, actor = 'system') {
    const existing = await this.resolveLeadForMutation(id, actor);
    const leadId = existing.id;

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        disposition: input.disposition,
        status: input.status ?? existing.status,
        category: input.category ?? existing.category,
        updatedBy: actor
      }
    });
    const userNameMap = await this.userNameMap([actor]);
    const changedBy = userNameMap.get(actor) ?? (actor === 'system' ? 'System' : actor);
    const changeSummary = [
      existing.disposition !== updated.disposition ? `Disposition changed from ${existing.disposition ?? '-'} to ${updated.disposition ?? '-'}` : null,
      existing.status !== updated.status ? `Status changed from ${existing.status ?? '-'} to ${updated.status ?? '-'}` : null,
      existing.category !== updated.category ? `Category changed from ${existing.category ?? '-'} to ${updated.category ?? '-'}` : null
    ].filter(Boolean).join('; ') || `Disposition updated to ${input.disposition}`;

    const [, activity] = await Promise.all([
      this.prisma.leadStatusHistory.create({
        data: {
          leadId,
          oldStatus: existing.status,
          newStatus: updated.status,
          oldCategory: existing.category,
          newCategory: updated.category,
          oldDisposition: existing.disposition,
          newDisposition: updated.disposition,
          remarks: input.remarks,
          createdBy: actor
        }
      }),
      this.prisma.activity.create({
        data: {
          leadId,
          type: activityTypeCodes.disposition,
          title: `${changeSummary} by ${changedBy}`,
          notes: input.remarks,
          disposition: input.disposition,
          metadata: toJsonValue({
            callbackAt: input.callbackAt,
            extraFields: input.extraFields ?? {},
            changedBy
          }),
          createdBy: actor
        }
      }),
      this.audit.write({
        moduleName: 'Lead',
        entityId: leadId,
        action: 'disposition_update',
        oldValue: { status: existing.status, category: existing.category, disposition: existing.disposition },
        newValue: {
          status: updated.status,
          category: updated.category,
          disposition: updated.disposition,
          remarks: input.remarks,
          callbackAt: input.callbackAt,
          extraFields: input.extraFields
        },
        changedBy: actor
      })
    ]);

    if (input.extraFields && Object.keys(input.extraFields).length > 0) {
      await this.customFields.upsertValues('Activity', activity.id, { values: input.extraFields });
    }

    return this.get(leadId, actor);
  }

  async assign(id: string, input: AssignLeadDto, actor = 'system') {
    const existing = await this.resolveLeadForMutation(id, actor);
    const leadId = existing.id;

    const isSystemOwner = ['system', 'System', '__system__'].includes(input.assignedUserId ?? '');
    const assignedUserId = isSystemOwner ? null : input.assignedUserId ?? null;
    if (!isSystemOwner && !assignedUserId) {
      throw new BadRequestException('assignedUserId is required');
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedUserId,
        status: assignedUserId && existing.status === 'New' ? 'Assigned' : existing.status,
        updatedBy: actor
      }
    });

    if (existing.assignedUserId === updated.assignedUserId) {
      return this.get(leadId, actor);
    }

    const userNameMap = await this.userNameMap([existing.assignedUserId, updated.assignedUserId, actor]);
    const fromOwner = existing.assignedUserId ? userNameMap.get(existing.assignedUserId) ?? 'User' : 'System';
    const toOwner = updated.assignedUserId ? userNameMap.get(updated.assignedUserId) ?? 'User' : 'System';
    const changedBy = userNameMap.get(actor) ?? (actor === 'system' ? 'System' : actor);
    const title = `Owner changed from ${fromOwner} to ${toOwner} by ${changedBy}`;

    await Promise.all([
      this.prisma.leadAssignment.create({
        data: {
          leadId,
          assignedUserId: updated.assignedUserId,
          assignedTeamId: updated.assignedTeamId,
          reason: input.reason,
          createdBy: actor
        }
      }),
      this.prisma.activity.create({
        data: {
          leadId,
          type: activityTypeCodes.assignment,
          title,
          notes: input.reason,
          metadata: { fromOwner, toOwner, changedBy, assignedUserId: updated.assignedUserId, assignedTeamId: updated.assignedTeamId },
          createdBy: actor
        }
      }),
      this.audit.write({
        moduleName: 'Lead',
        entityId: leadId,
        action: 'assign',
        oldValue: { assignedUserId: existing.assignedUserId, assignedTeamId: existing.assignedTeamId },
        newValue: { assignedUserId: updated.assignedUserId, assignedTeamId: updated.assignedTeamId, reason: input.reason },
        changedBy: actor
      })
    ]);

    return this.get(leadId, actor);
  }

  async bulkAssign(input: BulkAssignLeadDto, actor = 'system') {
    const leadIds = uniqueNonEmpty(input.leadIds);
    if (leadIds.length === 0) throw new BadRequestException('At least one lead is required');

    const isSystemOwner = ['system', 'System', '__system__'].includes(input.assignedUserId ?? '');
    const assignedUserId = isSystemOwner ? null : input.assignedUserId ?? null;
    if (!isSystemOwner && !assignedUserId) {
      throw new BadRequestException('assignedUserId is required');
    }

    const visibleWhere = await this.visibleLeadWhere({}, actor);
    const existingLeads = await this.prisma.lead.findMany({
      where: { AND: [visibleWhere, { id: { in: leadIds } }] }
    });
    if (existingLeads.length !== leadIds.length) {
      throw new NotFoundException('One or more selected leads were not found or are not visible');
    }

    const changedLeads = existingLeads.filter((lead) => lead.assignedUserId !== assignedUserId);
    if (changedLeads.length === 0) {
      return { updated: 0, requested: leadIds.length };
    }

    const userNameMap = await this.userNameMap([
      ...changedLeads.flatMap((lead) => [lead.assignedUserId]),
      assignedUserId,
      actor
    ]);
    const changedBy = userNameMap.get(actor) ?? (actor === 'system' ? 'System' : actor);

    await this.prisma.$transaction(async (tx) => {
      for (const lead of changedLeads) {
        const fromOwner = lead.assignedUserId ? userNameMap.get(lead.assignedUserId) ?? 'User' : 'System';
        const toOwner = assignedUserId ? userNameMap.get(assignedUserId) ?? 'User' : 'System';
        const txTitle = `Owner changed from ${fromOwner} to ${toOwner} by ${changedBy}`;
        const txUpdated = await tx.lead.update({
          where: { id: lead.id },
          data: {
            assignedUserId,
            status: assignedUserId && lead.status === 'New' ? 'Assigned' : lead.status,
            updatedBy: actor
          }
        });
        await tx.leadAssignment.create({
          data: {
            leadId: lead.id,
            assignedUserId: txUpdated.assignedUserId,
            assignedTeamId: txUpdated.assignedTeamId,
            reason: input.reason,
            createdBy: actor
          }
        });
        await tx.activity.create({
          data: {
            leadId: lead.id,
            type: activityTypeCodes.assignment,
            title: txTitle,
            notes: input.reason,
            metadata: toJsonValue({ fromOwner, toOwner, changedBy, assignedUserId: txUpdated.assignedUserId, assignedTeamId: txUpdated.assignedTeamId }),
            createdBy: actor
          }
        });
        await tx.auditLog.create({
          data: {
            moduleName: 'Lead',
            entityId: lead.id,
            action: 'assign',
            oldValue: toJsonValue({ assignedUserId: lead.assignedUserId, assignedTeamId: lead.assignedTeamId }),
            newValue: toJsonValue({ assignedUserId: txUpdated.assignedUserId, assignedTeamId: txUpdated.assignedTeamId, reason: input.reason }),
            changedBy: actor
          }
        });
      }
    });

    return { updated: changedLeads.length, requested: leadIds.length };
  }

  async bulkUpdate(input: BulkUpdateLeadDto, actor = 'system') {
    const leadIds = uniqueNonEmpty(input.leadIds);
    if (leadIds.length === 0) throw new BadRequestException('At least one lead is required');
    const patch = sanitizeBulkLeadPatch(input.patch);
    if (Object.keys(patch).length === 0) throw new BadRequestException('No supported bulk update fields were provided');

    const visibleWhere = await this.visibleLeadWhere({}, actor);
    const existingLeads = await this.prisma.lead.findMany({
      where: { AND: [visibleWhere, { id: { in: leadIds } }] }
    });
    if (existingLeads.length !== leadIds.length) {
      throw new NotFoundException('One or more selected leads were not found or are not visible');
    }

    const userNameMap = await this.userNameMap([actor]);
    const changedBy = userNameMap.get(actor) ?? (actor === 'system' ? 'System' : actor);

    await this.prisma.$transaction(async (tx) => {
      for (const lead of existingLeads) {
        const txUpdated = await tx.lead.update({ where: { id: lead.id }, data: { ...patch, updatedBy: actor } });
        const statusChanged = patch.status !== undefined && patch.status !== lead.status;
        const categoryChanged = patch.category !== undefined && patch.category !== lead.category;
        const dispositionChanged = patch.disposition !== undefined && patch.disposition !== lead.disposition;
        if (statusChanged || categoryChanged || dispositionChanged) {
          const txTitle = [
            statusChanged ? `Status changed from ${lead.status ?? '-'} to ${txUpdated.status ?? '-'}` : null,
            categoryChanged ? `Category changed from ${lead.category ?? '-'} to ${txUpdated.category ?? '-'}` : null,
            dispositionChanged ? `Disposition changed from ${lead.disposition ?? '-'} to ${txUpdated.disposition ?? '-'}` : null
          ].filter(Boolean).join('; ');
          await tx.leadStatusHistory.create({
            data: {
              leadId: lead.id,
              oldStatus: lead.status,
              newStatus: txUpdated.status,
              oldCategory: lead.category,
              newCategory: txUpdated.category,
              oldDisposition: lead.disposition,
              newDisposition: txUpdated.disposition,
              remarks: 'Bulk lead update',
              createdBy: actor
            }
          });
          await tx.activity.create({
            data: {
              leadId: lead.id,
              type: activityTypeCodes.system,
              title: `${txTitle} by ${changedBy}`,
              metadata: toJsonValue({
                oldStatus: lead.status,
                newStatus: txUpdated.status,
                oldCategory: lead.category,
                newCategory: txUpdated.category,
                oldDisposition: lead.disposition,
                newDisposition: txUpdated.disposition,
                changedBy
              }),
              createdBy: actor
            }
          });
        }
        await tx.auditLog.create({
          data: {
            moduleName: 'Lead',
            entityId: lead.id,
            action: 'bulk_update',
            oldValue: toJsonValue(lead),
            newValue: toJsonValue(txUpdated),
            changedBy: actor
          }
        });
      }
    });

    return { updated: existingLeads.length, requested: leadIds.length };
  }

  private formatLead(lead: Record<string, unknown> & {
    id: string;
    customValues?: Array<{ field: { fieldKey: string; label: string }; value: unknown }>;
    offerAmount?: { toString(): string } | null;
    emiAmount?: { toString(): string } | null;
    assignedUserId?: string | null;
  }, effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null, assignedUserMap = new Map<string, string>()) {
    const response = {
      id: lead.id,
      externalLeadId: lead.externalLeadId,
      customerName: lead.customerName,
      mobile: lead.mobile,
      email: lead.email,
      branchCode: lead.branchCode,
      branchName: lead.branchName,
      offerAmount: lead.offerAmount?.toString() ?? null,
      emiAmount: lead.emiAmount?.toString() ?? null,
      preferredLanguage: lead.preferredLanguage,
      location: lead.location,
      uploadDate: lead.uploadDate,
      offerExpiryDate: lead.offerExpiryDate,
      status: lead.status,
      category: lead.category,
      disposition: lead.disposition,
      assignedUserId: lead.assignedUserId,
      assignedUserName: lead.assignedUserId ? assignedUserMap.get(lead.assignedUserId) ?? null : null,
      assignedTeamId: lead.assignedTeamId,
      team: lead.team,
      uploadBatch: lead.uploadBatch,
      activities: lead.activities,
      customFields: this.formatCustomFields(lead.customValues ?? [], effective),
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt
    };

    return effective ? this.access.applyFieldAccessToRecord(effective, 'Lead', response) : response;
  }

  private async userNameMap(userIds: Array<string | null | undefined>) {
    const ids = [...new Set(userIds.filter(Boolean) as string[])];
    if (ids.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true }
    });
    return new Map(users.map((user) => [user.id, user.name || user.email || user.id]));
  }

  private formatCustomFields(
    values: Array<{ field: { fieldKey: string; label: string }; value: unknown }>,
    effective: Awaited<ReturnType<AccessService['effectivePermissions']>> | null
  ) {
    return values.flatMap((value) => {
      const access = effective ? this.access.getFieldAccess(effective, 'Lead', value.field.fieldKey) : 'editable';
      if (access === 'hidden') return [];
      return [{
        key: value.field.fieldKey,
        label: value.field.label,
        value: access === 'masked' ? maskPartial(value.value) : value.value
      }];
    });
  }

  private async leadCustomFieldSnapshot(leadId: string) {
    const values = await this.prisma.leadCustomFieldValue.findMany({
      where: { leadId },
      include: { field: true }
    });
    return Object.fromEntries(values.map((value) => [value.field.fieldKey, value.value]));
  }

  private async resolveLeadForMutation(id: string, userId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { OR: [{ id }, { externalLeadId: id }] } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.assertLeadVisibleForMutation(lead.id, userId);
    return lead;
  }

  private async assertLeadVisibleForMutation(leadId: string, userId: string) {
    const effective = await this.access.effectivePermissions(userId);
    if (this.access.hasLeadAllScope(effective)) return;
    const visibleLead = await this.prisma.lead.findFirst({ where: { id: leadId, assignedUserId: userId }, select: { id: true } });
    if (!visibleLead) throw new NotFoundException('Lead not found');
  }

  private async assertNoDuplicateLead(values: LeadDuplicateValues, ignoreLeadId?: string) {
    const duplicateFields = await this.leadDuplicateKeyFields();
    const missing = duplicateFields.filter((field) => !String(leadDuplicateFieldValue(values, field) ?? '').trim());
    if (missing.length > 0) {
      throw new BadRequestException(`Duplicate key field is blank: ${missing.map(humanizeLeadField).join(', ')}`);
    }

    const duplicateConditions: Prisma.LeadWhereInput[] = [];
    if (duplicateFields.includes('mobile') && values.mobile) duplicateConditions.push({ mobile: values.mobile });
    if (duplicateFields.includes('externalLeadId') && values.externalLeadId?.trim()) duplicateConditions.push({ externalLeadId: values.externalLeadId.trim() });
    if (duplicateFields.includes('customerName') && values.customerName?.trim()) duplicateConditions.push({ customerName: values.customerName.trim() });
    if (duplicateFields.includes('branchCode') && values.branchCode?.trim()) duplicateConditions.push({ branchCode: values.branchCode.trim() });
    if (duplicateFields.includes('branchName') && values.branchName?.trim()) duplicateConditions.push({ branchName: values.branchName.trim() });
    duplicateConditions.push(...duplicateFields
      .filter((field) => field.startsWith('custom:'))
      .flatMap((field) => {
        const fieldKey = field.slice('custom:'.length);
        const value = values.customFields?.[fieldKey];
        return String(value ?? '').trim()
          ? [{
              customValues: {
                some: {
                  field: { fieldKey },
                  value: { equals: value as Prisma.InputJsonValue }
                }
              }
            } satisfies Prisma.LeadWhereInput]
          : [];
      }));
    if (duplicateConditions.length === 0) return;

    const candidates = await this.prisma.lead.findMany({
      where: {
        OR: duplicateConditions,
        ...(ignoreLeadId ? { NOT: { id: ignoreLeadId } } : {})
      },
      select: {
        id: true,
        mobile: true,
        externalLeadId: true,
        customerName: true,
        branchCode: true,
        branchName: true,
        customValues: { include: { field: { select: { fieldKey: true } } } }
      },
      take: 20
    });
    const duplicate = candidates.find((lead) => duplicateFields.every((field) => (
      String(leadDuplicateFieldValue(values, field) ?? '').trim().toLowerCase() === String(leadDuplicateFieldValue(lead, field) ?? '').trim().toLowerCase()
    )));
    if (!duplicate) return;

    throw new BadRequestException(`Duplicate lead by ${duplicateFields.map(humanizeLeadField).join(' + ')} already exists`);
  }

  private async leadDuplicateKeyFields() {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: 'csv.upload.config' } });
    const value = setting?.value && typeof setting.value === 'object' ? setting.value as { duplicateKeyFields?: unknown[] } : {};
    const fields = Array.isArray(value.duplicateKeyFields)
      ? value.duplicateKeyFields.map(String).filter(isLeadDuplicateField)
      : ['mobile', 'externalLeadId'];
    return fields.length > 0 ? Array.from(new Set(fields)) : ['mobile', 'externalLeadId'];
  }

  private async visibleLeadWhere(query: ListLeadsQueryDto, userId?: string): Promise<Prisma.LeadWhereInput> {
    const effective = userId ? await this.access.effectivePermissions(userId) : null;
    const filters = leadWhere(query, effective, this.access);
    if (!userId || !effective) return filters;

    if (!this.access.canModule(effective, 'Lead', 'view')) return { AND: [filters, { id: '__no_visible_leads__' }] };
    if (this.access.hasLeadAllScope(effective)) return filters;

    return { AND: [filters, { assignedUserId: userId }] };
  }
}
