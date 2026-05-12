import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { activityTypeCodes } from '../activities/activity-types';
import { AuditService } from '../audit/audit.service';
import { toJsonValue } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';
import { RunAssignmentDto, UpsertAssignmentRuleDto } from './assignment.dto';
import { AssignmentResult, assignmentGlobalConfigKey, evaluateAssignmentRule, pickWeightedUser, userCustomWhere } from './assignment-utils';

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

@Injectable()
export class AssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async run(input: RunAssignmentDto, actor = 'system') {
    if (input.previewOnly) return this.preview(input);
    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
      include: {
        team: true,
        customValues: { include: { field: true } }
      }
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const activity = input.activityId ? await this.prisma.activity.findUnique({ where: { id: input.activityId } }) : null;
    const rules = await this.prisma.assignmentRule.findMany({
      where: {
        isActive: true,
        ...(input.ruleId ? { id: input.ruleId } : {})
      },
      include: {
        conditions: true,
        actions: true
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
    });

    if (rules.length === 0) {
      return this.recordRun({
        leadId: lead.id,
        ruleId: null,
        status: 'no_rule',
        result: { matched: false, reason: 'No active assignment rules found' },
        logs: ['No active assignment rules found']
      });
    }

    const skippedLogs: string[] = [];
    for (const rule of rules) {
      const evaluation = evaluateAssignmentRule(rule.conditions, lead, activity, input.context ?? {});
      if (!evaluation.matched) {
        skippedLogs.push(`Rule "${rule.name}" skipped: ${evaluation.reason}`);
        continue;
      }

      const action = rule.actions[0];
      if (!action) {
        await this.recordRun({
          leadId: lead.id,
          ruleId: rule.id,
          status: 'failed',
          result: { matched: true, reason: 'Rule matched but no action is configured' },
          logs: [`Rule "${rule.name}" matched but has no action`]
        });
        continue;
      }

      const assignment = await this.resolveAction(action.actionType, action.config as Record<string, unknown>, lead);
      if (!assignment.assignedUserId && !assignment.assignedTeamId) {
        const fallback = await this.resolveFallback(rule.actions.slice(1), lead, assignment.reason);
        if (fallback.assignedUserId || fallback.assignedTeamId) {
          if (lead.assignedUserId === fallback.assignedUserId) {
            return { status: 'unchanged', leadId: lead.id, ruleId: rule.id, reason: fallback.reason };
          }
          const updatedLead = await this.applyAssignment(lead, fallback, actor, `Assignment fallback: ${rule.name}`, input.mode ?? 'manual', rule.id, input.context ?? {});
          const result = await this.recordRun({
            leadId: lead.id,
            ruleId: rule.id,
            status: 'assigned',
            result: { matched: true, ruleId: rule.id, assignedUserId: fallback.assignedUserId, assignedTeamId: fallback.assignedTeamId, reason: fallback.reason },
            logs: [`Rule "${rule.name}" matched`, assignment.reason, fallback.reason]
          });
          await this.audit.write({
            moduleName: 'Assignment',
            entityId: lead.id,
            action: 'run_assignment',
            oldValue: { assignedUserId: lead.assignedUserId, assignedTeamId: lead.assignedTeamId },
            newValue: { assignedUserId: updatedLead.assignedUserId, assignedTeamId: updatedLead.assignedTeamId, ruleId: rule.id, runId: result.id },
            changedBy: actor
          });
          return result;
        }
        const globalFallback = await this.resolveGlobalFallback(lead, assignment.reason);
        if (globalFallback.assignedUserId) {
          if (lead.assignedUserId === globalFallback.assignedUserId) {
            return { status: 'unchanged', leadId: lead.id, ruleId: rule.id, reason: globalFallback.reason };
          }
          const updatedLead = await this.applyAssignment(lead, globalFallback, actor, `Assignment global fallback: ${rule.name}`, input.mode ?? 'manual', rule.id, input.context ?? {});
          const result = await this.recordRun({
            leadId: lead.id,
            ruleId: rule.id,
            status: 'assigned',
            result: { matched: true, ruleId: rule.id, assignedUserId: globalFallback.assignedUserId, assignedTeamId: globalFallback.assignedTeamId, reason: globalFallback.reason },
            logs: [`Rule "${rule.name}" matched`, assignment.reason, globalFallback.reason]
          });
          await this.audit.write({
            moduleName: 'Assignment',
            entityId: lead.id,
            action: 'run_assignment',
            oldValue: { assignedUserId: lead.assignedUserId, assignedTeamId: lead.assignedTeamId },
            newValue: { assignedUserId: updatedLead.assignedUserId, assignedTeamId: updatedLead.assignedTeamId, ruleId: rule.id, runId: result.id },
            changedBy: actor
          });
          return result;
        }
        await this.recordRun({
          leadId: lead.id,
          ruleId: rule.id,
          status: 'failed',
          result: { matched: true, reason: assignment.reason },
          logs: [`Rule "${rule.name}" matched but action did not resolve assignee: ${assignment.reason}`]
        });
        continue;
      }

      if (lead.assignedUserId === assignment.assignedUserId) {
        return { status: 'unchanged', leadId: lead.id, ruleId: rule.id, reason: assignment.reason };
      }

      if ((action.config as Record<string, unknown>).allowReassignment === false && (lead.assignedUserId || lead.assignedTeamId)) {
        return this.recordRun({
          leadId: lead.id,
          ruleId: rule.id,
          status: 'skipped',
          result: { matched: true, reason: 'Reassignment disabled and lead is already assigned' },
          logs: [`Rule "${rule.name}" matched but reassignment is disabled`]
        });
      }

      const updatedLead = await this.applyAssignment(lead, assignment, actor, `Assignment rule: ${rule.name}`, input.mode ?? 'manual', rule.id, input.context ?? {});

      const result = await this.recordRun({
        leadId: lead.id,
        ruleId: rule.id,
        status: 'assigned',
        result: {
          matched: true,
          ruleId: rule.id,
          assignedUserId: assignment.assignedUserId,
          assignedTeamId: assignment.assignedTeamId,
          reason: assignment.reason
        },
        logs: [
          `Rule "${rule.name}" matched`,
          assignment.reason,
          `Lead assigned to user=${assignment.assignedUserId ?? '-'} team=${assignment.assignedTeamId ?? '-'}`
        ]
      });

      await this.audit.write({
        moduleName: 'Assignment',
        entityId: lead.id,
        action: 'run_assignment',
        oldValue: {
          assignedUserId: lead.assignedUserId,
          assignedTeamId: lead.assignedTeamId
        },
        newValue: {
          assignedUserId: updatedLead.assignedUserId,
          assignedTeamId: updatedLead.assignedTeamId,
          ruleId: rule.id,
          runId: result.id
        },
        changedBy: actor
      });

      return result;
    }

    return this.recordRun({
      leadId: lead.id,
      ruleId: null,
      status: 'no_match',
      result: { matched: false, reason: 'No assignment rules matched' },
      logs: skippedLogs.length ? [...skippedLogs, 'No assignment rules matched. Lead remains unchanged.'] : ['No assignment rules matched. Lead remains unchanged.']
    });
  }

  listRuns(leadId?: string) {
    return this.prisma.assignmentRuleRun.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { logs: true }
    });
  }

  listRules() {
    return this.prisma.assignmentRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        conditions: true,
        actions: true
      }
    });
  }

  async preview(input: RunAssignmentDto) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
      include: { team: true, customValues: { include: { field: true } } }
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const activity = input.activityId ? await this.prisma.activity.findUnique({ where: { id: input.activityId } }) : null;
    const rules = await this.prisma.assignmentRule.findMany({
      where: { isActive: true, ...(input.ruleId ? { id: input.ruleId } : {}) },
      include: { conditions: true, actions: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
    });
    const evaluations = [];
    for (const rule of rules) {
      const evaluation = evaluateAssignmentRule(rule.conditions, lead, activity, input.context ?? {});
      const action = rule.actions[0];
      const assignment = evaluation.matched && action ? await this.resolveAction(action.actionType, action.config as Record<string, unknown>, lead) : null;
      evaluations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        matched: evaluation.matched,
        reason: evaluation.reason,
        actionType: action?.actionType ?? null,
        assignment
      });
      if (evaluation.matched && assignment && assignment.assignedUserId) break;
    }
    return { leadId: lead.id, evaluations };
  }

  async metadata() {
    const [users, teams, leadFields, userFields, activityFields] = await Promise.all([
      this.prisma.user.findMany({ where: { isActive: true, isSystem: false }, select: { id: true, name: true, email: true, phone: true, teamId: true } }),
      this.prisma.team.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } }),
      this.prisma.leadCustomField.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.userCustomField.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.activityCustomField.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } })
    ]);
    return {
      users,
      teams,
      conditionFields: [
        'lead.status',
        'lead.category',
        'lead.disposition',
        'lead.branchCode',
        'lead.branchName',
        'lead.location',
        'lead.preferredLanguage',
        ...leadFields.map((field) => `lead.custom.${field.fieldKey}`),
        ...activityFields.map((field) => `activity.custom.${field.fieldKey}`),
        ...userFields.map((field) => `user.custom.${field.fieldKey}`)
      ],
      operators: ['equals', 'not_equals', 'contains', 'in', 'exists', 'not_exists'],
      actionTypes: ['assign_user', 'assign_team', 'assign_team_by_branch', 'round_robin_team', 'assign_user_by_custom_field', 'fallback_team']
    };
  }

  async createRule(input: UpsertAssignmentRuleDto, actor = 'system') {
    const rule = await this.prisma.assignmentRule.create({
      data: {
        name: input.name,
        priority: input.priority ?? 100,
        targetType: input.targetType ?? 'Lead',
        isActive: input.isActive ?? true,
        conditions: {
          create: (input.conditions ?? []).map((condition) => ({
            fieldPath: condition.fieldPath,
            operator: condition.operator,
            value: toJsonValue(condition.value)
          }))
        },
        actions: {
          create: (input.actions ?? []).map((action) => ({
            actionType: action.actionType,
            config: toJsonValue(action.config)
          }))
        }
      },
      include: { conditions: true, actions: true }
    });

    await this.audit.write({ moduleName: 'Assignment', entityId: rule.id, action: 'create_rule', newValue: rule, changedBy: actor });
    return rule;
  }

  async updateRule(id: string, input: UpsertAssignmentRuleDto, actor = 'system') {
    const existing = await this.prisma.assignmentRule.findUnique({ where: { id }, include: { conditions: true, actions: true } });
    if (!existing) throw new NotFoundException('Assignment rule not found');

    await this.prisma.$transaction([
      this.prisma.assignmentRuleCondition.deleteMany({ where: { ruleId: id } }),
      this.prisma.assignmentRuleAction.deleteMany({ where: { ruleId: id } }),
      this.prisma.assignmentRule.update({
        where: { id },
        data: {
          name: input.name,
          priority: input.priority ?? existing.priority,
          targetType: input.targetType ?? existing.targetType,
          isActive: input.isActive ?? existing.isActive,
          conditions: {
            create: (input.conditions ?? []).map((condition) => ({
              fieldPath: condition.fieldPath,
              operator: condition.operator,
              value: toJsonValue(condition.value)
            }))
          },
          actions: {
            create: (input.actions ?? []).map((action) => ({
              actionType: action.actionType,
              config: toJsonValue(action.config)
            }))
          }
        }
      })
    ]);

    const updated = await this.prisma.assignmentRule.findUnique({ where: { id }, include: { conditions: true, actions: true } });
    await this.audit.write({ moduleName: 'Assignment', entityId: id, action: 'update_rule', oldValue: existing, newValue: updated, changedBy: actor });
    return updated;
  }

  async deleteRule(id: string, actor = 'system') {
    const existing = await this.prisma.assignmentRule.findUnique({ where: { id }, include: { conditions: true, actions: true } });
    if (!existing) throw new NotFoundException('Assignment rule not found');
    await this.prisma.$transaction([
      this.prisma.assignmentRuleCondition.deleteMany({ where: { ruleId: id } }),
      this.prisma.assignmentRuleAction.deleteMany({ where: { ruleId: id } }),
      this.prisma.assignmentRule.delete({ where: { id } })
    ]);
    await this.audit.write({ moduleName: 'Assignment', entityId: id, action: 'delete_rule', oldValue: existing, changedBy: actor });
    return { deleted: true };
  }

  private async resolveAction(actionType: string, config: Record<string, unknown>, lead: Record<string, unknown>): Promise<AssignmentResult> {
    if (actionType === 'assign_user') {
      const assignedUserId = typeof config.userId === 'string' ? config.userId : null;
      if (!assignedUserId) return { matched: true, reason: 'assign_user action missing userId' };
      const user = await this.prisma.user.findUnique({ where: { id: assignedUserId } });
      if (!user || !user.isActive) return { matched: true, reason: 'configured user not found or inactive' };
      return { matched: true, assignedUserId, assignedTeamId: user.teamId, reason: `Assigned to configured user ${user.name}` };
    }

    if (actionType === 'assign_team') {
      const assignedTeamId = typeof config.teamId === 'string' ? config.teamId : null;
      if (!assignedTeamId) return { matched: true, reason: 'assign_team action missing teamId' };
      const team = await this.prisma.team.findUnique({ where: { id: assignedTeamId } });
      if (!team || !team.isActive) return { matched: true, reason: 'configured team not found or inactive' };
      return this.resolveUserPoolAssignment({ teamId: assignedTeamId, config, reason: `Assigned through configured team ${team.name}` });
    }

    if (actionType === 'assign_team_by_branch') {
      const branchCode = optionalString(lead.branchCode);
      if (!branchCode) return { matched: true, reason: 'lead branchCode is empty' };
      const team = await this.prisma.team.findFirst({ where: { code: branchCode, isActive: true } });
      if (!team) return { matched: true, reason: `no active team found for branch ${branchCode}` };
      return this.resolveUserPoolAssignment({ teamId: team.id, config, reason: `Assigned through branch ${branchCode}` });
    }

    if (actionType === 'round_robin_team') {
      const teamId = typeof config.teamId === 'string' ? config.teamId : optionalString(lead.teamId);
      if (!teamId) return { matched: true, reason: 'round_robin_team has no teamId and lead has no team' };
      return this.resolveUserPoolAssignment({ teamId, config, reason: 'Round-robin selected user' });
    }

    if (actionType === 'assign_user_by_custom_field') {
      const fieldKey = typeof config.fieldKey === 'string' ? config.fieldKey : null;
      const value = config.value;
      if (!fieldKey) return { matched: true, reason: 'assign_user_by_custom_field missing fieldKey' };
      const users = await this.prisma.user.findMany({
        where: { isActive: true, isSystem: false, ...userCustomWhere(fieldKey, value) },
        orderBy: { createdAt: 'asc' }
      });
      const eligibleUsers = await this.filterByCapacity(users, Number(config.maxOpenLeads ?? 0), config);
      const user = pickWeightedUser(eligibleUsers, await this.assignmentCounter('custom_field', config), config);
      if (!user) return { matched: true, reason: `no active user found with custom field ${fieldKey}=${String(value)}` };
      return { matched: true, assignedUserId: user.id, assignedTeamId: user.teamId, reason: `Assigned by user custom field ${fieldKey}` };
    }

    if (actionType === 'fallback_team') {
      const teamId = typeof config.teamId === 'string' ? config.teamId : optionalString(lead.teamId);
      if (!teamId) return { matched: true, reason: 'fallback_team missing teamId' };
      return this.resolveUserPoolAssignment({ teamId, config, reason: 'Assigned through fallback team' });
    }

    throw new BadRequestException(`Unsupported assignment action: ${actionType}`);
  }

  private async resolveFallback(actions: Array<{ actionType: string; config: unknown }>, lead: Record<string, unknown>, previousReason: string) {
    for (const action of actions) {
      const config = action.config as Record<string, unknown>;
      if (config.isFallback !== true && !action.actionType.includes('fallback')) continue;
      const resolved = await this.resolveAction(action.actionType, config, lead);
      if (resolved.assignedUserId || resolved.assignedTeamId) {
        return { ...resolved, reason: `${previousReason}; fallback applied: ${resolved.reason}` };
      }
    }
    return { matched: true, reason: previousReason };
  }

  private async resolveGlobalFallback(lead: Record<string, unknown>, previousReason: string): Promise<AssignmentResult> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: assignmentGlobalConfigKey } });
    const value = setting?.value && typeof setting.value === 'object' ? setting.value as Record<string, unknown> : {};
    const fallbackUserId = typeof value.fallbackUserId === 'string' ? value.fallbackUserId : null;
    if (!fallbackUserId) return { matched: true, reason: previousReason };
    const user = await this.prisma.user.findUnique({ where: { id: fallbackUserId } });
    if (!user || !user.isActive || user.isSystem) return { matched: true, reason: `${previousReason}; global fallback user unavailable` };
    return { matched: true, assignedUserId: user.id, assignedTeamId: user.teamId ?? optionalString(lead.teamId), reason: `${previousReason}; global fallback applied: ${user.name}` };
  }

  private async resolveUserPoolAssignment(input: { teamId: string; config: Record<string, unknown>; reason: string }): Promise<AssignmentResult> {
    const users = await this.prisma.user.findMany({
      where: {
        teamId: input.teamId,
        isActive: true,
        isSystem: false,
        ...(input.config.userCustomFieldKey && input.config.userCustomFieldValue !== undefined ? userCustomWhere(String(input.config.userCustomFieldKey), input.config.userCustomFieldValue) : {})
      },
      orderBy: { createdAt: 'asc' }
    });
    const eligibleUsers = await this.filterByCapacity(users, Number(input.config.maxOpenLeads ?? 0), input.config);
    if (eligibleUsers.length === 0) return { matched: true, reason: 'no active users under configured capacity found' };
    const user = pickWeightedUser(eligibleUsers, await this.assignmentCounter(input.teamId, input.config), input.config);
    if (!user) return { matched: true, reason: 'no eligible user found' };
    return { matched: true, assignedUserId: user.id, assignedTeamId: input.teamId, reason: `${input.reason}: ${user.name}` };
  }

  private async filterByCapacity<T extends { id: string }>(users: T[], maxOpenLeads: number, config: Record<string, unknown> = {}): Promise<T[]> {
    const userCapacities = config.userCapacities && typeof config.userCapacities === 'object' ? config.userCapacities as Record<string, unknown> : {};
    const limits = new Map(users.map((user) => [user.id, Number(userCapacities[user.id] ?? maxOpenLeads ?? 0)]));
    const limitedUserIds = users.flatMap((user) => {
      const limit = limits.get(user.id) ?? 0;
      return Number.isFinite(limit) && limit > 0 ? [user.id] : [];
    });

    if (limitedUserIds.length === 0) return users;

    const openLeadCounts = await this.prisma.lead.groupBy({
      by: ['assignedUserId'],
      where: {
        assignedUserId: { in: limitedUserIds },
        status: { notIn: ['Converted', 'Expired', 'Not Interested'] }
      },
      _count: { _all: true }
    });
    const openLeadCountByUser = new Map(openLeadCounts.map((row) => [row.assignedUserId, row._count._all]));

    return users.filter((user) => {
      const limit = limits.get(user.id) ?? 0;
      if (!Number.isFinite(limit) || limit <= 0) return true;
      return (openLeadCountByUser.get(user.id) ?? 0) < limit;
    });
  }

  private async assignmentCounter(scope: string, config: Record<string, unknown>) {
    const resetKey = typeof config.counterResetKey === 'string' && config.counterResetKey.trim() ? config.counterResetKey.trim() : null;
    const where = resetKey ? { reason: { contains: resetKey } } : { assignedTeamId: scope };
    return this.prisma.leadAssignment.count({ where });
  }

  private async applyAssignment(lead: Record<string, unknown>, assignment: AssignmentResult, actor: string, reason: string, mode: string, ruleId: string, context: Record<string, unknown> = {}) {
    const leadId = optionalString(lead.id);
    if (!leadId) throw new BadRequestException('Cannot apply assignment without a lead id');
    const assignedUserId = assignment.assignedUserId ?? null;
    const previousAssignedUserId = optionalString(lead.assignedUserId);
    const leadStatus = optionalString(lead.status);
    const ownerChanged = previousAssignedUserId !== assignedUserId;
    const updatedLead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedUserId,
        assignedTeamId: assignment.assignedTeamId,
        status: assignedUserId && (leadStatus === 'New' || leadStatus === 'Valid') ? 'Assigned' : leadStatus ?? undefined,
        updatedBy: actor
      }
    });

    if (!ownerChanged) return updatedLead;

    const userNameMap = await this.userNameMap([previousAssignedUserId, updatedLead.assignedUserId, actor]);
    const fromOwner = previousAssignedUserId ? userNameMap.get(previousAssignedUserId) ?? 'User' : 'System';
    const toOwner = updatedLead.assignedUserId ? userNameMap.get(updatedLead.assignedUserId) ?? 'User' : 'System';
    const changedBy = userNameMap.get(actor) ?? (actor === 'system' || actor === 'system@unnatify.local' ? 'System' : actor);
    const title = `Owner changed from ${fromOwner} to ${toOwner} by ${changedBy}`;

    await this.prisma.leadAssignment.create({
      data: {
        leadId,
        assignedUserId: updatedLead.assignedUserId,
        assignedTeamId: assignment.assignedTeamId,
        reason,
        createdBy: actor
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId,
        type: activityTypeCodes.assignment,
        title,
        notes: assignment.reason,
        metadata: toJsonValue({
          ruleId,
          fromOwner,
          toOwner,
          changedBy,
          assignedUserId: updatedLead.assignedUserId,
          assignedTeamId: assignment.assignedTeamId,
          mode,
          automationRunId: context.automationRunId,
          workflowId: context.workflowId,
          nodeId: context.nodeId
        }),
        createdBy: actor
      }
    });

    return updatedLead;
  }

  private async userNameMap(ids: Array<string | null | undefined>) {
    const userIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id) && id !== 'system' && id !== 'system@unnatify.local')));
    if (userIds.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    return new Map(users.map((user) => [user.id, user.name || user.email || user.id]));
  }

  private async recordRun(input: { leadId: string; ruleId: string | null; status: string; result: unknown; logs: string[] }) {
    return this.prisma.assignmentRuleRun.create({
      data: {
        leadId: input.leadId,
        ruleId: input.ruleId,
        status: input.status,
        result: toJsonValue(input.result),
        logs: {
          create: input.logs.map((message) => ({ message }))
        }
      },
      include: { logs: true }
    });
  }
}
