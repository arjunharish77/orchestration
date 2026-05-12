import { PrismaClient, Prisma } from '@prisma/client';
import { Job } from 'bullmq';

type AssignmentActivityCodes = {
  assignment: string;
};

type AssignmentResult = {
  matched: boolean;
  ruleId?: string;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  reason: string;
};

type AssignmentRunnerDeps = {
  prisma: PrismaClient;
  systemActor: string;
  activityTypeCodes: AssignmentActivityCodes;
  toJson: (value: unknown) => Prisma.InputJsonValue;
};

type AssignmentJobData = {
  leadId: string;
  ruleId?: string;
  actor?: string;
  activityId?: string;
  context?: Record<string, unknown>;
  mode?: string;
};

const assignmentGlobalConfigKey = 'assignment.global.config';

export function createAssignmentRunner(deps: AssignmentRunnerDeps) {
  const { prisma, systemActor, activityTypeCodes, toJson } = deps;

  async function processAssignmentRun(job: Job<AssignmentJobData>) {
    return runAssignmentForLead(job.data.leadId, {
      ruleId: job.data.ruleId,
      actor: job.data.actor ?? systemActor,
      activityId: job.data.activityId,
      context: job.data.context,
      mode: job.data.mode
    });
  }

  async function runAssignmentForLead(leadId: string, options: Omit<AssignmentJobData, 'leadId'> = {}) {
    const actor = options.actor ?? systemActor;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        team: true,
        customValues: { include: { field: true } }
      }
    });
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    const activity = options.activityId ? await prisma.activity.findUnique({ where: { id: options.activityId } }) : null;
    const rules = await prisma.assignmentRule.findMany({
      where: {
        isActive: true,
        ...(options.ruleId ? { id: options.ruleId } : {})
      },
      include: {
        conditions: true,
        actions: true
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
    });

    if (rules.length === 0) {
      const run = await recordAssignmentRun(lead.id, null, 'no_rule', { matched: false, reason: 'No active assignment rules found', source: 'worker' }, ['No active assignment rules found']);
      return { ok: false, runId: run.id, status: 'no_rule' };
    }

    for (const rule of rules) {
      const evaluation = evaluateAssignmentRule(rule.conditions, lead, activity, options.context ?? {});
      if (!evaluation.matched) {
        await recordAssignmentRun(lead.id, rule.id, 'skipped', { matched: false, reason: evaluation.reason, source: 'worker' }, [`Rule "${rule.name}" skipped: ${evaluation.reason}`]);
        continue;
      }

      const action = rule.actions[0];
      if (!action) {
        await recordAssignmentRun(lead.id, rule.id, 'failed', { matched: true, reason: 'Rule matched but no action is configured', source: 'worker' }, [`Rule "${rule.name}" matched but has no action`]);
        continue;
      }

      const primary = await resolveAssignmentAction(action.actionType, action.config as Record<string, unknown>, lead);
      const assignment = primary.assignedUserId || primary.assignedTeamId
        ? primary
        : await resolveAssignmentFallback(rule.actions.slice(1), lead, primary.reason);
      const finalAssignment = assignment.assignedUserId || assignment.assignedTeamId
        ? assignment
        : await resolveGlobalAssignmentFallback(lead, assignment.reason);

      if (!finalAssignment.assignedUserId && !finalAssignment.assignedTeamId) {
        await recordAssignmentRun(lead.id, rule.id, 'failed', { matched: true, reason: finalAssignment.reason, source: 'worker' }, [`Rule "${rule.name}" matched but action did not resolve assignee: ${finalAssignment.reason}`]);
        continue;
      }

      if ((action.config as Record<string, unknown>).allowReassignment === false && (lead.assignedUserId || lead.assignedTeamId)) {
        const run = await recordAssignmentRun(lead.id, rule.id, 'skipped', { matched: true, reason: 'Reassignment disabled and lead is already assigned', source: 'worker' }, [`Rule "${rule.name}" matched but reassignment is disabled`]);
        return { ok: false, runId: run.id, status: 'skipped' };
      }

      const updatedLead = await applyWorkerAssignment(lead, finalAssignment, actor, `Assignment rule: ${rule.name}`, options.mode ?? 'worker', rule.id, options.context ?? {});
      const run = await recordAssignmentRun(
        lead.id,
        rule.id,
        'assigned',
        {
          matched: true,
          ruleId: rule.id,
          assignedUserId: finalAssignment.assignedUserId,
          assignedTeamId: finalAssignment.assignedTeamId,
          reason: finalAssignment.reason,
          source: 'worker'
        },
        [`Rule "${rule.name}" matched`, finalAssignment.reason, `Lead assigned to user=${finalAssignment.assignedUserId ?? '-'} team=${finalAssignment.assignedTeamId ?? '-'}`]
      );
      await prisma.auditLog.create({
        data: {
          moduleName: 'Assignment',
          entityId: lead.id,
          action: 'run_assignment',
          oldValue: toJson({ assignedUserId: lead.assignedUserId, assignedTeamId: lead.assignedTeamId }),
          newValue: toJson({ assignedUserId: updatedLead.assignedUserId, assignedTeamId: updatedLead.assignedTeamId, ruleId: rule.id, runId: run.id, source: 'worker' }),
          changedBy: actor
        }
      });
      return { ok: true, runId: run.id, assignedUserId: finalAssignment.assignedUserId, assignedTeamId: finalAssignment.assignedTeamId };
    }

    const run = await recordAssignmentRun(lead.id, null, 'no_match', { matched: false, reason: 'No assignment rules matched', source: 'worker' }, ['No assignment rules matched. Lead remains unchanged.']);
    return { ok: false, runId: run.id, status: 'no_match' };
  }

  function evaluateAssignmentRule(conditions: Array<{ fieldPath: string; operator: string; value: unknown }>, lead: Record<string, unknown>, activity: Record<string, unknown> | null, context: Record<string, unknown>) {
    if (conditions.length === 0) return { matched: true, reason: 'Rule has no conditions' };
    const failed: string[] = [];
    for (const condition of conditions) {
      const actual = resolveAssignmentField(condition.fieldPath, lead, activity, context);
      if (!compareAssignmentValue(actual, condition.operator, condition.value)) {
        failed.push(`${condition.fieldPath} ${condition.operator} ${JSON.stringify(condition.value)} failed; actual=${JSON.stringify(actual)}`);
      }
    }
    return failed.length === 0 ? { matched: true, reason: 'All conditions matched' } : { matched: false, reason: failed.join('; ') };
  }

  function resolveAssignmentField(fieldPath: string, lead: Record<string, unknown>, activity: Record<string, unknown> | null, context: Record<string, unknown>) {
    if (fieldPath.startsWith('lead.custom.')) {
      const key = fieldPath.replace('lead.custom.', '');
      const customValues = Array.isArray(lead.customValues) ? lead.customValues : [];
      const match = customValues.find((v: unknown) => {
        const entry = v as Record<string, unknown> | undefined;
        const field = entry?.field as Record<string, unknown> | undefined;
        return field?.fieldKey === key;
      }) as Record<string, unknown> | undefined;
      return match?.value;
    }
    if (fieldPath.startsWith('lead.')) return getPathValue(lead, fieldPath.replace('lead.', ''));
    if (fieldPath.startsWith('activity.')) return getPathValue(activity, fieldPath.replace('activity.', ''));
    if (fieldPath.startsWith('user.custom.')) return getPathValue(context, fieldPath);
    if (fieldPath.startsWith('context.')) return getPathValue(context, fieldPath.replace('context.', ''));
    return getPathValue(lead, fieldPath);
  }

  function compareAssignmentValue(actual: unknown, operator: string, expected: unknown) {
    if (operator === 'equals') return String(actual ?? '') === String(expected ?? '');
    if (operator === 'not_equals') return String(actual ?? '') !== String(expected ?? '');
    if (operator === 'contains') return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    if (operator === 'in') return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ''));
    if (operator === 'exists') return actual !== null && actual !== undefined && actual !== '';
    if (operator === 'not_exists') return actual === null || actual === undefined || actual === '';
    return false;
  }

  async function resolveAssignmentAction(actionType: string, config: Record<string, unknown>, lead: Record<string, unknown>): Promise<AssignmentResult> {
    if (actionType === 'assign_user') {
      const assignedUserId = typeof config.userId === 'string' ? config.userId : null;
      if (!assignedUserId) return { matched: true, reason: 'assign_user action missing userId' };
      const user = await prisma.user.findUnique({ where: { id: assignedUserId } });
      if (!user || !user.isActive) return { matched: true, reason: 'configured user not found or inactive' };
      return { matched: true, assignedUserId, assignedTeamId: user.teamId, reason: `Assigned to configured user ${user.name}` };
    }

    if (actionType === 'assign_team') {
      const assignedTeamId = typeof config.teamId === 'string' ? config.teamId : null;
      if (!assignedTeamId) return { matched: true, reason: 'assign_team action missing teamId' };
      const team = await prisma.team.findUnique({ where: { id: assignedTeamId } });
      if (!team || !team.isActive) return { matched: true, reason: 'configured team not found or inactive' };
      return resolveWorkerUserPoolAssignment(assignedTeamId, config, `Assigned through configured team ${team.name}`);
    }

    if (actionType === 'assign_team_by_branch') {
      if (!lead.branchCode) return { matched: true, reason: 'lead branchCode is empty' };
      const team = await prisma.team.findFirst({ where: { code: String(lead.branchCode), isActive: true } });
      if (!team) return { matched: true, reason: `no active team found for branch ${lead.branchCode}` };
      return resolveWorkerUserPoolAssignment(team.id, config, `Assigned through branch ${lead.branchCode}`);
    }

    if (actionType === 'round_robin_team') {
      const teamId = typeof config.teamId === 'string' ? config.teamId : typeof lead.teamId === 'string' ? lead.teamId : undefined;
      if (!teamId) return { matched: true, reason: 'round_robin_team has no teamId and lead has no team' };
      return resolveWorkerUserPoolAssignment(teamId, config, 'Round-robin selected user');
    }

    if (actionType === 'assign_user_by_custom_field') {
      const fieldKey = typeof config.fieldKey === 'string' ? config.fieldKey : null;
      if (!fieldKey) return { matched: true, reason: 'assign_user_by_custom_field missing fieldKey' };
      const users = await prisma.user.findMany({
        where: { isActive: true, isSystem: false, ...userCustomWhere(fieldKey, config.value) },
        orderBy: { createdAt: 'asc' }
      });
      const eligibleUsers = await filterUsersByCapacity(users, Number(config.maxOpenLeads ?? 0), config);
      const user = pickWeightedUser(eligibleUsers, await assignmentCounter('custom_field', config), config);
      if (!user) return { matched: true, reason: `no active user found with custom field ${fieldKey}=${String(config.value)}` };
      return { matched: true, assignedUserId: user.id, assignedTeamId: user.teamId, reason: `Assigned by user custom field ${fieldKey}` };
    }

    if (actionType === 'fallback_team') {
      const teamId = typeof config.teamId === 'string' ? config.teamId : typeof lead.teamId === 'string' ? lead.teamId : undefined;
      if (!teamId) return { matched: true, reason: 'fallback_team missing teamId' };
      return resolveWorkerUserPoolAssignment(teamId, config, 'Assigned through fallback team');
    }

    return { matched: true, reason: `Unsupported assignment action: ${actionType}` };
  }

  async function resolveWorkerUserPoolAssignment(teamId: string, config: Record<string, unknown>, reason: string): Promise<AssignmentResult> {
    const users = await prisma.user.findMany({
      where: {
        teamId,
        isActive: true,
        isSystem: false,
        ...(config.userCustomFieldKey && config.userCustomFieldValue !== undefined ? userCustomWhere(String(config.userCustomFieldKey), config.userCustomFieldValue) : {})
      },
      orderBy: { createdAt: 'asc' }
    });
    const eligibleUsers = await filterUsersByCapacity(users, Number(config.maxOpenLeads ?? 0), config);
    if (eligibleUsers.length === 0) return { matched: true, reason: 'no active users under configured capacity found' };
    const user = pickWeightedUser(eligibleUsers, await assignmentCounter(teamId, config), config);
    if (!user) return { matched: true, reason: 'no eligible user found' };
    return { matched: true, assignedUserId: user.id, assignedTeamId: teamId, reason: `${reason}: ${user.name}` };
  }

  async function resolveAssignmentFallback(actions: Array<{ actionType: string; config: unknown }>, lead: Record<string, unknown>, previousReason: string) {
    for (const action of actions) {
      const config = action.config as Record<string, unknown>;
      if (config.isFallback !== true && !action.actionType.includes('fallback')) continue;
      const resolved = await resolveAssignmentAction(action.actionType, config, lead);
      if (resolved.assignedUserId || resolved.assignedTeamId) return { ...resolved, reason: `${previousReason}; fallback applied: ${resolved.reason}` };
    }
    return { matched: true, reason: previousReason };
  }

  async function resolveGlobalAssignmentFallback(lead: Record<string, unknown>, previousReason: string): Promise<AssignmentResult> {
    const setting = await prisma.appSetting.findUnique({ where: { key: assignmentGlobalConfigKey } });
    const value = setting?.value && typeof setting.value === 'object' ? setting.value as Record<string, unknown> : {};
    const fallbackUserId = typeof value.fallbackUserId === 'string' ? value.fallbackUserId : null;
    if (!fallbackUserId) return { matched: true, reason: previousReason };
    const user = await prisma.user.findUnique({ where: { id: fallbackUserId } });
    if (!user || !user.isActive || user.isSystem) return { matched: true, reason: `${previousReason}; global fallback user unavailable` };
    return { matched: true, assignedUserId: user.id, assignedTeamId: user.teamId ?? (typeof lead.teamId === 'string' ? lead.teamId : undefined), reason: `${previousReason}; global fallback applied: ${user.name}` };
  }

  async function filterUsersByCapacity<T extends { id: string }>(users: T[], maxOpenLeads: number, config: Record<string, unknown> = {}): Promise<T[]> {
    const eligible: T[] = [];
    const userCapacities = config.userCapacities && typeof config.userCapacities === 'object' ? config.userCapacities as Record<string, unknown> : {};
    for (const user of users) {
      const userLimit = Number(userCapacities[user.id] ?? maxOpenLeads ?? 0);
      if (!userLimit) {
        eligible.push(user);
        continue;
      }
      const openLeadCount = await prisma.lead.count({
        where: {
          assignedUserId: user.id,
          status: { notIn: ['Converted', 'Expired', 'Not Interested'] }
        }
      });
      if (openLeadCount < userLimit) eligible.push(user);
    }
    return eligible;
  }

  function pickWeightedUser<T extends { id: string }>(users: T[], counter: number, config: Record<string, unknown>) {
    const weights = config.userWeights && typeof config.userWeights === 'object' ? config.userWeights as Record<string, unknown> : {};
    const weightedUsers = users.flatMap((user) => {
      const weight = Math.max(1, Math.min(100, Number(weights[user.id] ?? 1) || 1));
      return Array.from({ length: weight }, () => user);
    });
    return weightedUsers.length ? weightedUsers[counter % weightedUsers.length] : users[counter % users.length];
  }

  function assignmentCounter(scope: string, config: Record<string, unknown>) {
    const resetKey = typeof config.counterResetKey === 'string' && config.counterResetKey.trim() ? config.counterResetKey.trim() : null;
    const where = resetKey ? { reason: { contains: resetKey } } : { assignedTeamId: scope };
    return prisma.leadAssignment.count({ where });
  }

  async function applyWorkerAssignment(lead: Record<string, unknown>, assignment: AssignmentResult, actor: string, reason: string, mode: string, ruleId: string, context: Record<string, unknown> = {}) {
    const leadId = String(lead.id);
    const leadStatus = String(lead.status ?? '');
    const assignedUserId = assignment.assignedUserId ?? null;
    const ownerChanged = lead.assignedUserId !== assignedUserId;
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedUserId,
        assignedTeamId: assignment.assignedTeamId,
        status: assignedUserId && (leadStatus === 'New' || leadStatus === 'Valid') ? 'Assigned' : leadStatus,
        updatedBy: actor
      }
    });
    if (!ownerChanged) return updatedLead;

    const prevUserId = typeof lead.assignedUserId === 'string' ? lead.assignedUserId : undefined;
    const userNames = await userNameMap([prevUserId, updatedLead.assignedUserId, actor]);
    const fromOwner = prevUserId ? userNames.get(prevUserId) ?? 'User' : 'System';
    const toOwner = updatedLead.assignedUserId ? userNames.get(updatedLead.assignedUserId) ?? 'User' : 'System';
    const changedBy = userNames.get(actor) ?? (actor === 'system' || actor === systemActor ? 'System' : actor);
    const title = `Owner changed from ${fromOwner} to ${toOwner} by ${changedBy}`;

    await prisma.leadAssignment.create({
      data: {
        leadId,
        assignedUserId: updatedLead.assignedUserId,
        assignedTeamId: assignment.assignedTeamId,
        createdBy: actor,
        reason
      }
    });
    await prisma.activity.create({
      data: {
        leadId,
        type: activityTypeCodes.assignment,
        title,
        notes: assignment.reason,
        metadata: toJson({
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

  async function userNameMap(ids: Array<string | null | undefined>) {
    const userIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id) && id !== 'system' && id !== systemActor)));
    if (userIds.length === 0) return new Map<string, string>();
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    return new Map(users.map((user) => [user.id, user.name || user.email || user.id]));
  }

  function recordAssignmentRun(leadId: string, ruleId: string | null, status: string, result: unknown, logs: string[]) {
    return prisma.assignmentRuleRun.create({
      data: {
        leadId,
        ruleId,
        status,
        result: toJson(result),
        logs: {
          create: logs.map((message) => ({ message }))
        }
      },
      include: { logs: true }
    });
  }

  function getPathValue(source: unknown, path: string) {
    if (!source) return undefined;
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, source);
  }

  function userCustomWhere(fieldKey: string, value: unknown): Prisma.UserWhereInput {
    return {
      customValues: {
        some: {
          field: { fieldKey },
          ...(value === undefined ? {} : { value: { equals: toJson(value) } })
        }
      }
    };
  }

  return {
    processAssignmentRun,
    runAssignmentForLead
  };
}
