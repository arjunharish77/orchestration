import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { AccessService } from '../access/access.service';
import { requiredConfigValue } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private _redis: Redis | null = null;
  private static readonly CACHE_TTL_SECONDS = 45;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService
  ) {}

  async overview(userId: string) {
    const cacheKey = `dashboard:overview:${userId}`;
    const cached = await this.getCachedOverview(cacheKey);
    if (cached) return cached;

    const result = await this.computeOverview(userId);
    await this.setCachedOverview(cacheKey, result);
    return result;
  }

  private async computeOverview(userId: string) {
    const effective = await this.access.effectivePermissions(userId);
    const leadWhere = this.visibleLeadWhere(effective, userId);
    // Instead of fetching up to 10,000 lead IDs into memory, compose
    // the visibility filter directly into each dependent query's WHERE clause.
    const isAllScope = this.access.hasLeadAllScope(effective);
    const automationRunWhere: Prisma.AutomationRunWhereInput = isAllScope
      ? {}
      : { leadId: { not: null } };
    const taskWhere: Prisma.TaskWhereInput = isAllScope
      ? {}
      : { OR: [{ assignedTo: userId }, { lead: { assignedUserId: userId } }] };
    const now = new Date();

    const [
      totalLeads,
      assignedLeads,
      convertedLeads,
      openTasks,
      missedTasks,
      uploadCount,
      automationRunsTotal,
      automationRunsFailed,
      automationStepsPending,
      leads,
      tasks,
      workflows,
      connectors,
      whatsAppConnectors,
      voicebotConnectors
    ] = await Promise.all([
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.lead.count({ where: { AND: [leadWhere, { assignedUserId: { not: null } }] } }),
      this.prisma.lead.count({ where: { AND: [leadWhere, { OR: [{ status: 'Converted' }, { disposition: 'Converted' }] }] } }),
      this.prisma.task.count({ where: { AND: [taskWhere, { status: { not: 'Completed' } }] } }),
      this.prisma.task.count({ where: { AND: [taskWhere, { dueDate: { lt: now }, status: { not: 'Completed' } }] } }),
      this.prisma.leadUploadBatch.count(),
      this.prisma.automationRun.count({ where: automationRunWhere }),
      this.prisma.automationRun.count({ where: { ...automationRunWhere, status: 'failed' } }),
      this.prisma.automationRunStep.count({ where: { status: 'pending', run: automationRunWhere } }),
      this.prisma.lead.findMany({
        where: leadWhere,
        orderBy: { createdAt: 'desc' },
        take: 9,
        include: {
          team: true,
          customValues: { include: { field: true } }
        }
      }),
      this.prisma.task.findMany({
        where: { AND: [taskWhere, { status: { not: 'Completed' } }] },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 8,
        include: { lead: { select: { customerName: true, mobile: true } } }
      }),
      this.prisma.automationWorkflow.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
      }),
      this.prisma.connector.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.prisma.whatsAppConnector.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.prisma.voicebotConnector.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 })
    ]);

    const userNames = await this.userNameMap(leads.map((lead) => lead.assignedUserId));

    return {
      updatedAt: new Date().toISOString(),
      leads: leads.map((lead) => ({
        id: lead.id,
        dbId: lead.id,
        initials: (lead.customerName || '?').slice(0, 1).toUpperCase(),
        name: lead.customerName,
        email: this.fieldValue(effective, 'email', lead.email ?? '-'),
        mobile: this.fieldValue(effective, 'mobile', lead.mobile),
        status: lead.status,
        category: lead.category ?? '-',
        disposition: lead.disposition ?? '-',
        branchCode: lead.branchCode ?? '-',
        branchName: lead.branchName ?? '-',
        ownerName: lead.assignedUserId ? userNames.get(lead.assignedUserId) ?? 'User' : 'System',
        teamName: lead.team?.name ?? '-',
        language: lead.preferredLanguage ?? '-',
        source: lead.sourceBatchId ? 'CSV' : 'Direct',
        created: formatDate(lead.createdAt),
        customFields: lead.customValues.map((value) => ({
          key: value.field.fieldKey,
          label: value.field.label,
          value: value.value
        }))
      })),
      metrics: [
        ['Uploaded Leads', String(uploadCount), 'CSV batches available'],
        ['Assigned Leads', String(assignedLeads), 'Across teams and sales groups'],
        ['Open Tasks', String(openTasks), `${missedTasks} missed`],
        ['Converted', String(convertedLeads), 'Converted leads'],
        ['Automation Runs', String(automationRunsTotal), `${automationRunsFailed} failed, ${automationStepsPending} pending steps`],
        ['Total Leads', String(totalLeads), 'Visible lead records']
      ],
      automation: workflows.map((workflow) => {
        const definition = workflow.versions[0]?.definition as { nodes?: Array<{ label?: string; type?: string }> } | undefined;
        const activeNode = definition?.nodes?.find((node) => node.type && node.type !== 'trigger') ?? definition?.nodes?.[0];
        return [
          workflow.name,
          activeNode?.label ?? 'Draft',
          workflow.status === 'active' ? 'Running' : workflow.status,
          workflow.status === 'active' ? 70 : 25
        ];
      }),
      connectors: this.connectorSummaries(connectors, whatsAppConnectors, voicebotConnectors),
      tasks: tasks.map((task) => ({
        id: task.id,
        leadName: task.lead?.customerName ?? task.lead?.mobile ?? 'Lead',
        taskType: task.taskType,
        priority: task.priority ?? 'Medium',
        dueDate: task.dueDate,
        status: task.status
      }))
    };
  }

  private visibleLeadWhere(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, userId: string): Prisma.LeadWhereInput {
    if (!this.access.canModule(effective, 'Lead', 'view')) return { id: '__no_visible_leads__' };
    if (this.access.hasLeadAllScope(effective)) return {};
    return { assignedUserId: userId };
  }

  private fieldValue(effective: Awaited<ReturnType<AccessService['effectivePermissions']>>, fieldKey: string, value: string) {
    const access = this.access.getFieldAccess(effective, 'Lead', fieldKey);
    if (access === 'hidden') return '-';
    if (access === 'masked') return maskPartial(value);
    return value;
  }

  private async userNameMap(userIds: Array<string | null>) {
    const ids = [...new Set(userIds.filter(Boolean) as string[])];
    if (!ids.length) return new Map<string, string>();
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
    return new Map(users.map((user) => [user.id, user.name || user.email]));
  }

  private connectorSummaries(
    connectors: Array<{ name: string; type: string; provider: string | null; isActive: boolean; updatedAt: Date }>,
    whatsAppConnectors: Array<{ name: string; isActive: boolean; updatedAt: Date }>,
    voicebotConnectors: Array<{ name: string; isActive: boolean; updatedAt: Date }>
  ) {
    const telephony = connectors.filter((connector) => connector.type === 'telephony');
    const apiConnectors = connectors.filter((connector) => connector.type !== 'telephony');
    return [
      this.connectorSummary('MCUBE', telephony),
      this.connectorSummary('WhatsApp', whatsAppConnectors),
      this.connectorSummary('Voicebot', voicebotConnectors),
      this.connectorSummary('Generic API', apiConnectors)
    ];
  }

  private connectorSummary(label: string, rows: Array<{ name: string; isActive: boolean; updatedAt: Date }>) {
    const active = rows.filter((row) => row.isActive).length;
    const latest = rows[0]?.updatedAt;
    return {
      name: label,
      status: active > 0 ? 'Active' : rows.length > 0 ? 'Inactive' : 'Not configured',
      detail: rows.length > 0 ? `${active}/${rows.length} active` : 'No configuration',
      updated: latest ? latest.toISOString() : null
    };
  }

  private async getRedis(): Promise<Redis | null> {
    try {
      if (this._redis && this._redis.status === 'ready') return this._redis;
      if (this._redis) {
        try { this._redis.disconnect(); } catch { /* ignore */ }
      }
      this._redis = new Redis(requiredConfigValue('REDIS_URL', this.config.get<string>('REDIS_URL'), 'redis://localhost:6379'), {
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });
      await this._redis.connect();
      return this._redis;
    } catch {
      return null;
    }
  }

  private async getCachedOverview(key: string): Promise<Record<string, unknown> | null> {
    try {
      const redis = await this.getRedis();
      if (!redis) return null;
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private async setCachedOverview(key: string, value: Record<string, unknown>): Promise<void> {
    try {
      const redis = await this.getRedis();
      if (!redis) return;
      await redis.set(key, JSON.stringify(value), 'EX', DashboardService.CACHE_TTL_SECONDS);
    } catch {
      // Cache write failure is non-critical — log and continue
    }
  }
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-GB');
}

function maskPartial(value: string) {
  if (!value) return value;
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}
