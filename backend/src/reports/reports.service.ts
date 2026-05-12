import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportExportDto, SaveReportDto, ScheduleReportDto } from './reports.dto';

const REPORT_RELATED_LEAD_ID_LIMIT = 10000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService
  ) {}

  async overview(userId?: string, filters: ReportFilters = {}) {
    const scope = await this.reportScope(userId);
    const normalizedFilters = await this.resolveReportFilters(filters);
    const leadWhere = buildLeadWhere(scope, normalizedFilters);
    const scopedLeadIds = await this.visibleLeadIds(scope, leadWhere);
    const relatedLeadWhere = scopedLeadIds ? { leadId: { in: scopedLeadIds } } : {};
    const rowCreatedAt = dateRangeFilter(filters.dateFrom, filters.dateTo);
    const createdAtWhere = rowCreatedAt ? { createdAt: rowCreatedAt } : {};
    const uploadBatchWhere = { ...(scope.isAdministrator ? {} : { uploadedBy: scope.userEmail }), ...createdAtWhere };
    const uploadRowWhere = scope.isAdministrator
      ? { uploadStatus: { not: 'imported' }, ...createdAtWhere }
      : { uploadStatus: { not: 'imported' }, ...createdAtWhere, OR: [{ leadId: { in: scopedLeadIds ?? [] } }, { batch: { uploadedBy: scope.userEmail } }] };
    const taskScopeWhere: Prisma.TaskWhereInput = scope.isAdministrator ? {} : { OR: [{ assignedTo: userId }, { lead: { is: leadWhere } }] };
    const communicationWhere = { ...relatedLeadWhere, ...createdAtWhere };

    const [
      totalLeads,
      convertedLeads,
      openTasks,
      missedTasks,
      uploadBatches,
      automationRuns,
      telephonyCalls,
      whatsAppMessages,
      voicebotCalls,
      assignmentRuns,
      invalidUploadRows,
      teamDistribution,
      expiredLeads,
      recentLeadJourneys,
      automationRunsTotal,
      automationRunsCompleted,
      automationRunsFailed,
      automationRunsRunning,
      automationRunsStopped,
      automationStepsCompleted,
      automationStepsPending,
      automationStepsFailed,
      automationStepsSkipped
    ] = await Promise.all([
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.lead.count({ where: { AND: [leadWhere, { OR: [{ status: 'Converted' }, { disposition: 'Converted' }] }] } }),
      this.prisma.task.count({ where: { AND: [taskScopeWhere, { status: { not: 'Completed' } }] } }),
      this.prisma.task.count({ where: { AND: [taskScopeWhere, { dueDate: { lt: new Date() }, status: { not: 'Completed' } }] } }),
      this.prisma.leadUploadBatch.findMany({ where: uploadBatchWhere, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.automationRun.findMany({
        where: { ...relatedLeadWhere, ...(rowCreatedAt ? { startedAt: rowCreatedAt } : {}) },
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: { steps: true }
      }),
      this.prisma.telephonyCall.findMany({ where: connectorMatches(filters.connector, 'telephony') ? communicationWhere : { id: '__filtered_out__' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.whatsAppMessage.findMany({ where: connectorMatches(filters.connector, 'whatsapp') ? communicationWhere : { id: '__filtered_out__' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.voicebotCall.findMany({ where: connectorMatches(filters.connector, 'voicebot') ? communicationWhere : { id: '__filtered_out__' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.assignmentRuleRun.findMany({
        where: { ...relatedLeadWhere, ...createdAtWhere },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { logs: true }
      }),
      this.prisma.leadUploadRow.findMany({
        where: uploadRowWhere,
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      this.prisma.team.findMany({
        where: scope.isAdministrator ? {} : { id: scope.teamId ?? '__no_team__' },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { leads: { where: scope.leadWhere } }
          }
        }
      }),
      this.prisma.lead.findMany({
        where: {
          AND: [
            leadWhere,
            {
              OR: [
                { status: { equals: 'Expired', mode: 'insensitive' } },
                { offerExpiryDate: { lt: new Date() } }
              ]
            }
          ]
        },
        orderBy: { offerExpiryDate: 'desc' },
        take: 50
      }),
      this.prisma.lead.findMany({
        where: leadWhere,
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          activities: { orderBy: { createdAt: 'desc' }, take: 5 },
          tasks: { orderBy: { createdAt: 'desc' }, take: 5 }
        }
      }),
      this.prisma.automationRun.count({ where: relatedLeadWhere }),
      this.prisma.automationRun.count({ where: { ...relatedLeadWhere, status: 'completed' } }),
      this.prisma.automationRun.count({ where: { ...relatedLeadWhere, status: 'failed' } }),
      this.prisma.automationRun.count({ where: { ...relatedLeadWhere, status: 'running' } }),
      this.prisma.automationRun.count({ where: { ...relatedLeadWhere, status: 'stopped' } }),
      this.prisma.automationRunStep.count({ where: { status: 'completed', run: relatedLeadWhere } }),
      this.prisma.automationRunStep.count({ where: { status: 'pending', run: relatedLeadWhere } }),
      this.prisma.automationRunStep.count({ where: { status: 'failed', run: relatedLeadWhere } }),
      this.prisma.automationRunStep.count({ where: { status: 'skipped', run: relatedLeadWhere } })
    ]);

    const leadIds = uniqueStrings([
      ...automationRuns.map((row) => row.leadId),
      ...telephonyCalls.map((row) => row.leadId),
      ...whatsAppMessages.map((row) => row.leadId),
      ...voicebotCalls.map((row) => row.leadId),
      ...assignmentRuns.map((row) => row.leadId),
      ...invalidUploadRows.map((row) => row.leadId)
    ]);
    const workflowIds = uniqueStrings(automationRuns.map((row) => row.workflowId));
    const ruleIds = uniqueStrings(assignmentRuns.map((row) => row.ruleId));
    const userIds = uniqueStrings(uploadBatches.map((row) => row.uploadedBy));
    const [leadNames, workflowNames, ruleNames, userNames] = await Promise.all([
      leadIds.length ? this.prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, customerName: true, mobile: true } }) : [],
      workflowIds.length ? this.prisma.automationWorkflow.findMany({ where: { id: { in: workflowIds } }, select: { id: true, name: true } }) : [],
      ruleIds.length ? this.prisma.assignmentRule.findMany({ where: { id: { in: ruleIds } }, select: { id: true, name: true } }) : [],
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : []
    ]);
    const leadMap = new Map(leadNames.map((lead) => [lead.id, `${lead.customerName}${lead.mobile ? ` (${lead.mobile})` : ''}`]));
    const workflowMap = new Map(workflowNames.map((workflow) => [workflow.id, workflow.name]));
    const ruleMap = new Map(ruleNames.map((rule) => [rule.id, rule.name]));
    const userMap = new Map(userNames.map((user) => [user.id, user.name || user.email]));

    return {
      metrics: {
        totalLeads,
        convertedLeads,
        openTasks,
        missedTasks,
        conversionRate: totalLeads === 0 ? 0 : Number(((convertedLeads / totalLeads) * 100).toFixed(2)),
        automationRunsTotal,
        automationRunsCompleted,
        automationRunsFailed,
        automationRunsRunning,
        automationRunsStopped,
        automationStepsCompleted,
        automationStepsPending,
        automationStepsFailed,
        automationStepsSkipped,
        automationSuccessRate: automationRunsTotal === 0 ? 0 : Number(((automationRunsCompleted / automationRunsTotal) * 100).toFixed(2))
      },
      uploadBatches: uploadBatches.map((row) => ({ ...row, uploadedByName: row.uploadedBy ? userMap.get(row.uploadedBy) ?? row.uploadedBy : null })),
      automationRuns: automationRuns.map((row) => ({ ...row, leadName: row.leadId ? leadMap.get(row.leadId) ?? row.leadId : null, workflowName: workflowMap.get(row.workflowId) ?? row.workflowId })),
      telephonyCalls: telephonyCalls.map((row) => ({ ...row, leadName: row.leadId ? leadMap.get(row.leadId) ?? row.leadId : null })),
      whatsAppMessages: whatsAppMessages.map((row) => ({ ...row, leadName: row.leadId ? leadMap.get(row.leadId) ?? row.leadId : null })),
      voicebotCalls: voicebotCalls.map((row) => ({ ...row, leadName: row.leadId ? leadMap.get(row.leadId) ?? row.leadId : null })),
      assignmentRuns: assignmentRuns.map((row) => ({ ...row, leadName: row.leadId ? leadMap.get(row.leadId) ?? row.leadId : null, ruleName: row.ruleId ? ruleMap.get(row.ruleId) ?? row.ruleId : null })),
      invalidUploadRows: invalidUploadRows.map((row) => ({ ...row, leadName: row.leadId ? leadMap.get(row.leadId) ?? row.leadId : null })),
      teamDistribution: teamDistribution.map((team) => ({
        id: team.id,
        name: team.name,
        code: team.code,
        type: team.type,
        leadCount: team._count.leads
      })),
      expiredLeads,
      recentLeadJourneys
    };
  }

  async exportCsv(userId: string, type = 'lead-summary') {
    const result = await this.generateLeadSummaryExport(userId, type);
    await this.prisma.reportExport.create({
      data: {
        reportType: result.reportType,
        status: 'completed',
        fileId: result.file.id,
        fileName: result.file.fileName,
        rowCount: result.rowCount,
        requestedBy: userId,
        completedAt: new Date()
      }
    });
    return result.csv;
  }

  async createExport(userId: string, input: CreateReportExportDto) {
    const reportType = input.reportType ?? 'lead-summary';
    const scope = await this.reportScope(userId);
    const normalizedFilters = await this.resolveReportFilters((input.filters ?? {}) as ReportFilters);
    const rowCount = await this.prisma.lead.count({ where: buildLeadWhere(scope, normalizedFilters) });
    if (rowCount > 10000) {
      return this.prisma.reportExport.create({
        data: {
          reportType,
          status: 'queued',
          filters: toInputJson(input.filters ?? {}),
          requestedBy: userId,
          rowCount,
          error: 'Large report queued for asynchronous export'
        }
      });
    }
    const pending = await this.prisma.reportExport.create({
      data: {
        reportType,
        status: 'running',
        filters: toInputJson(input.filters ?? {}),
        requestedBy: userId
      }
    });
    try {
      const result = await this.generateLeadSummaryExport(userId, reportType, input.filters ?? {});
      const exportRow = await this.prisma.reportExport.update({
        where: { id: pending.id },
        data: {
          status: 'completed',
          fileId: result.file.id,
          fileName: result.file.fileName,
          rowCount: result.rowCount,
          completedAt: new Date()
        }
      });
      return { ...exportRow, message: 'Report export completed' };
    } catch (error) {
      const exportRow = await this.prisma.reportExport.update({
        where: { id: pending.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Report export failed',
          completedAt: new Date()
        }
      });
      return exportRow;
    }
  }

  async savedReports(userId: string) {
    const effective = await this.access.effectivePermissions(userId);
    return this.prisma.savedReport.findMany({
      where: effective.isAdministrator ? {} : { OR: [{ createdBy: userId }, { visibility: 'all' }] },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
  }

  async createSavedReport(userId: string, input: SaveReportDto) {
    const report = await this.prisma.savedReport.create({
      data: {
        name: input.name,
        reportType: input.reportType ?? 'lead-summary',
        filters: toInputJson(input.filters ?? {}),
        columns: toInputJson(input.columns ?? []),
        visibility: input.visibility ?? 'private',
        createdBy: userId,
        updatedBy: userId
      }
    });
    await this.audit.write({ moduleName: 'Report', entityId: report.id, action: 'create_saved_report', newValue: report, changedBy: userId });
    return report;
  }

  async updateSavedReport(userId: string, id: string, input: SaveReportDto) {
    const existing = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Saved report not found');
    await this.assertCanMutateReport(userId, existing.createdBy);
    const report = await this.prisma.savedReport.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        reportType: input.reportType ?? existing.reportType,
        filters: input.filters === undefined ? existing.filters as Prisma.InputJsonValue : toInputJson(input.filters),
        columns: input.columns === undefined ? existing.columns as Prisma.InputJsonValue : toInputJson(input.columns),
        visibility: input.visibility ?? existing.visibility,
        updatedBy: userId
      }
    });
    await this.audit.write({ moduleName: 'Report', entityId: report.id, action: 'update_saved_report', oldValue: existing, newValue: report, changedBy: userId });
    return report;
  }

  async deleteSavedReport(userId: string, id: string) {
    const existing = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Saved report not found');
    await this.assertCanMutateReport(userId, existing.createdBy);
    await this.prisma.savedReport.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Report', entityId: id, action: 'delete_saved_report', oldValue: existing, changedBy: userId });
    return { deleted: true };
  }

  async scheduledReports(userId: string) {
    const effective = await this.access.effectivePermissions(userId);
    return this.prisma.scheduledReport.findMany({
      where: effective.isAdministrator ? {} : { createdBy: userId },
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
      take: 100,
      include: { savedReport: { select: { id: true, name: true } } }
    });
  }

  async createScheduledReport(userId: string, input: ScheduleReportDto) {
    const schedule = await this.prisma.scheduledReport.create({
      data: {
        savedReportId: input.savedReportId,
        name: input.name,
        reportType: input.reportType ?? 'lead-summary',
        filters: toInputJson(input.filters ?? {}),
        frequency: input.frequency,
        recipients: toInputJson(input.recipients ?? []),
        nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : nextRunFromFrequency(input.frequency),
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedBy: userId
      }
    });
    await this.audit.write({ moduleName: 'Report', entityId: schedule.id, action: 'create_scheduled_report', newValue: schedule, changedBy: userId });
    return schedule;
  }

  async updateScheduledReport(userId: string, id: string, input: ScheduleReportDto) {
    const existing = await this.prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Scheduled report not found');
    await this.assertCanMutateReport(userId, existing.createdBy);
    const schedule = await this.prisma.scheduledReport.update({
      where: { id },
      data: {
        savedReportId: input.savedReportId ?? existing.savedReportId,
        name: input.name ?? existing.name,
        reportType: input.reportType ?? existing.reportType,
        filters: input.filters === undefined ? existing.filters as Prisma.InputJsonValue : toInputJson(input.filters),
        frequency: input.frequency ?? existing.frequency,
        recipients: input.recipients === undefined ? existing.recipients as Prisma.InputJsonValue : toInputJson(input.recipients),
        nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : existing.nextRunAt,
        isActive: input.isActive ?? existing.isActive,
        updatedBy: userId
      }
    });
    await this.audit.write({ moduleName: 'Report', entityId: schedule.id, action: 'update_scheduled_report', oldValue: existing, newValue: schedule, changedBy: userId });
    return schedule;
  }

  async deleteScheduledReport(userId: string, id: string) {
    const existing = await this.prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Scheduled report not found');
    await this.assertCanMutateReport(userId, existing.createdBy);
    await this.prisma.scheduledReport.delete({ where: { id } });
    await this.audit.write({ moduleName: 'Report', entityId: id, action: 'delete_scheduled_report', oldValue: existing, changedBy: userId });
    return { deleted: true };
  }

  async drilldown(userId: string, metric: string, filters: ReportFilters = {}) {
    const scope = await this.reportScope(userId);
    const leadWhere = buildLeadWhere(scope, await this.resolveReportFilters(filters));
    if (metric === 'convertedLeads') {
      const rows = await this.prisma.lead.findMany({ where: { AND: [leadWhere, { OR: [{ status: 'Converted' }, { disposition: 'Converted' }] }] }, orderBy: { updatedAt: 'desc' }, take: 100 });
      return this.applyLeadFieldAccess(userId, rows);
    }
    if (metric === 'openTasks') {
      return this.prisma.task.findMany({
        where: { AND: [scope.isAdministrator ? {} : { OR: [{ assignedTo: userId }, { lead: { is: leadWhere } }] }, { status: { not: 'Completed' } }] },
        orderBy: { dueDate: 'asc' },
        take: 100
      });
    }
    if (metric === 'automationRunsFailed') {
      const scopedLeadIds = await this.visibleLeadIds(scope, leadWhere);
      return this.prisma.automationRun.findMany({ where: { status: 'failed', ...(scopedLeadIds ? { leadId: { in: scopedLeadIds } } : {}) }, orderBy: { startedAt: 'desc' }, take: 100, include: { steps: true } });
    }
    const rows = await this.prisma.lead.findMany({ where: leadWhere, orderBy: { updatedAt: 'desc' }, take: 100 });
    return this.applyLeadFieldAccess(userId, rows);
  }

  private async generateLeadSummaryExport(userId: string, type = 'lead-summary', filters: ReportFilters = {}) {
    const scope = await this.reportScope(userId);
    const effective = await this.access.effectivePermissions(userId);
    const reportType = type;
    const columns = leadReportColumns.filter((column) => isReportExportableField(this.access.getFieldAccess(effective, 'Lead', column.key)));
    const leads = await this.prisma.lead.findMany({
      where: buildLeadWhere(scope, await this.resolveReportFilters(filters)),
      orderBy: { updatedAt: 'desc' },
      take: 10000,
      include: {
        team: true
      }
    });
    const rows = leads.map((lead) => columns.map((column) => leadReportValue(lead, column.key)));
    const csv = [columns.map((column) => column.label), ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const fileName = `${reportType}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    const reportDir = join(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), 'reports');
    const filePath = join(reportDir, fileName);
    await mkdir(reportDir, { recursive: true });
    await writeFile(filePath, csv);
    const file = await this.prisma.uploadedFile.create({
      data: {
        fileName,
        filePath,
        fileType: `report/${reportType}`,
        uploadedBy: userId
      }
    });
    await this.audit.write({
      moduleName: 'Report',
      entityId: fileName,
      action: 'export_download',
      newValue: {
        type: reportType,
        rowCount: rows.length,
        columnCount: columns.length,
        fileName
      },
      changedBy: userId
    });
    return { csv, file, reportType, rowCount: rows.length, columnCount: columns.length };
  }

  async exportHistory(userId: string) {
    const effective = await this.access.effectivePermissions(userId);
    const exportRows = await this.prisma.reportExport.findMany({
      where: effective.isAdministrator ? {} : { requestedBy: userId },
      orderBy: { requestedAt: 'desc' },
      take: 100
    });
    if (exportRows.length) return exportRows;

    const rows = await this.prisma.uploadedFile.findMany({
      where: {
        fileType: { startsWith: 'report/' },
        ...(effective.isAdministrator ? {} : { uploadedBy: userId })
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        uploadedBy: true,
        createdAt: true
      }
    });
    const userIds = uniqueStrings(rows.map((row) => row.uploadedBy));
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const userMap = new Map(users.map((user) => [user.id, user.name || user.email]));
    return rows.map((row) => ({
      id: row.id,
      reportType: row.fileType?.replace(/^report\//, '') ?? 'lead-summary',
      status: 'completed',
      fileId: row.id,
      fileName: row.fileName,
      requestedBy: row.uploadedBy,
      requestedByName: row.uploadedBy ? userMap.get(row.uploadedBy) ?? row.uploadedBy : null,
      requestedAt: row.createdAt,
      completedAt: row.createdAt,
      rowCount: 0
    }));
  }

  private async assertCanMutateReport(userId: string, ownerId?: string | null) {
    const effective = await this.access.effectivePermissions(userId);
    if (effective.isAdministrator || ownerId === userId) return;
    throw new ForbiddenException('You can only modify your own report configuration');
  }

  private async reportScope(userId?: string): Promise<{ leadWhere: Prisma.LeadWhereInput; isAdministrator: boolean; teamId?: string | null; userEmail?: string | null }> {
    if (!userId) return { leadWhere: {}, isAdministrator: true };

    const effective = await this.access.effectivePermissions(userId);
    if (!this.access.canModule(effective, 'Lead', 'view')) {
      return { leadWhere: { id: '__no_visible_leads__' }, isAdministrator: false };
    }
    if (this.access.hasLeadAllScope(effective)) return { leadWhere: {}, isAdministrator: effective.isAdministrator };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true, email: true }
    });

    return {
      leadWhere: { assignedUserId: userId },
      isAdministrator: false,
      teamId: user?.teamId,
      userEmail: user?.email
    };
  }

  private async resolveReportFilters(filters: ReportFilters = {}): Promise<ReportFilters> {
    if (!filters.salesGroupId) return filters;
    const users = await this.prisma.userSalesGroup.findMany({
      where: { salesGroupId: filters.salesGroupId },
      select: { userId: true }
    });
    return { ...filters, salesGroupUserIds: users.map((user) => user.userId) };
  }

  private async visibleLeadIds(scope: { isAdministrator: boolean }, leadWhere: Prisma.LeadWhereInput) {
    if (scope.isAdministrator) return null;
    const leads = await this.prisma.lead.findMany({ where: leadWhere, select: { id: true }, take: REPORT_RELATED_LEAD_ID_LIMIT });
    return leads.map((lead) => lead.id);
  }

  private async applyLeadFieldAccess(userId: string, rows: Array<Record<string, unknown>>) {
    const effective = await this.access.effectivePermissions(userId);
    return rows.map((row) => this.access.applyFieldAccessToRecord(effective, 'Lead', row));
  }
}

const leadReportColumns = [
  { key: 'externalLeadId', label: 'Lead ID' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'branchCode', label: 'Branch Code' },
  { key: 'branchName', label: 'Branch Name' },
  { key: 'team', label: 'Team' },
  { key: 'offerAmount', label: 'Loan Offer Amount' },
  { key: 'emiAmount', label: 'EMI Amount' },
  { key: 'status', label: 'Lead Status' },
  { key: 'category', label: 'Lead Category' },
  { key: 'disposition', label: 'Lead Disposition' },
  { key: 'preferredLanguage', label: 'Preferred Language' },
  { key: 'location', label: 'Customer Location' },
  { key: 'uploadDate', label: 'Upload Date' },
  { key: 'offerExpiryDate', label: 'Offer Expiry Date' },
  { key: 'createdAt', label: 'Created' },
  { key: 'updatedAt', label: 'Updated' }
] as const;

type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  teamId?: string;
  ownerId?: string;
  salesGroupId?: string;
  salesGroupUserIds?: string[];
  status?: string;
  category?: string;
  disposition?: string;
  connector?: string;
};

function dateRangeFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!Number.isNaN(from.getTime())) range.gte = from;
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      range.lte = to;
    }
  }
  return Object.keys(range).length ? range : undefined;
}

function connectorMatches(filter: string | undefined, connector: string) {
  return !filter || filter === 'all' || filter.toLowerCase() === connector.toLowerCase();
}

function buildLeadWhere(scope: { leadWhere: Prisma.LeadWhereInput }, filters: ReportFilters = {}) {
  const createdAt = dateRangeFilter(filters.dateFrom, filters.dateTo);
  const leadFilters: Prisma.LeadWhereInput[] = [];
  if (filters.teamId) leadFilters.push({ OR: [{ teamId: filters.teamId }, { assignedTeamId: filters.teamId }] });
  if (filters.ownerId) leadFilters.push({ assignedUserId: filters.ownerId === '__system__' ? null : filters.ownerId });
  if (filters.salesGroupUserIds) leadFilters.push(filters.salesGroupUserIds.length ? { assignedUserId: { in: filters.salesGroupUserIds } } : { id: '__no_sales_group_users__' });
  if (filters.status) leadFilters.push({ status: filters.status });
  if (filters.category) leadFilters.push({ category: filters.category });
  if (filters.disposition) leadFilters.push({ disposition: filters.disposition });
  if (createdAt) leadFilters.push({ createdAt });
  return leadFilters.length ? { AND: [scope.leadWhere, ...leadFilters] } : scope.leadWhere;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function leadReportValue(lead: Record<string, any>, key: string) {
  if (key === 'team') return lead.team?.name ?? '';
  const value = lead[key];
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return String(value);
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isReportExportableField(access: string) {
  return access !== 'hidden' && access !== 'masked';
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function nextRunFromFrequency(frequency: string) {
  const date = new Date();
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  else if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  else date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}
