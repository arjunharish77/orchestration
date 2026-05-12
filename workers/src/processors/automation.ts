import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { assignmentRunner, prisma, systemActor } from '../context';
import { asRecord, resolveVariables, sleep, toJson, validatePublicHttpsUrl } from '../utils';
import { processVoicebotTrigger } from './voicebot';
import { processWhatsAppSend } from './whatsapp';
import {
  AutomationNode,
  AutomationEdge,
  AutomationGraph,
  buildAutomationGraph,
  nextAutomationNode,
  edgeMatchesConditionBranch,
  evaluateAutomationCondition,
  evaluateAutomationConditions
} from './automation-pure';

export { buildAutomationGraph, evaluateAutomationCondition, evaluateAutomationConditions } from './automation-pure';

export async function processAutomationRun(job: Job<{ runId?: string; workflowId: string; versionId?: string; input?: { leadId?: string; context?: Record<string, unknown>; useDraft?: boolean; runLabel?: string }; actor?: string; resumeFromNodeId?: string }>) {
  const { workflowId, input = {}, actor = systemActor } = job.data;
  let runId = job.data.runId;
  const latest = job.data.versionId
    ? await prisma.automationWorkflowVersion.findUnique({ where: { id: job.data.versionId } })
    : await prisma.automationWorkflowVersion.findFirst({
      where: { workflowId, isPublished: input.useDraft ? undefined : true },
      orderBy: { version: 'desc' }
    });
  if (!latest) throw new Error(`Automation workflow definition not found: ${workflowId}`);

  if (!runId) {
    const run = await prisma.automationRun.create({ data: { workflowId, leadId: input.leadId, status: 'running' } });
    runId = run.id;
  } else {
    await prisma.automationRun.update({ where: { id: runId }, data: { status: 'running' } });
  }

  const definition = normalizeAutomationDefinition(latest.definition);
  const exitDecision = input.leadId ? await evaluateExitCondition(definition.exitCondition, input.leadId, workflowId) : null;
  if (exitDecision?.shouldExit) {
    await prisma.automationRun.update({ where: { id: runId }, data: { status: 'stopped', exitReason: exitDecision.reason, completedAt: new Date() } });
    return { ok: true, runId, status: 'stopped', reason: exitDecision.reason };
  }
  const graph = buildAutomationGraph(definition);
  let current = graph.firstNode;
  const visited = new Set<string>();

  if (job.data.resumeFromNodeId) {
    const delayNode = graph.nodesById.get(job.data.resumeFromNodeId);
    if (delayNode) {
      visited.add(delayNode.nodeId);
      current = nextAutomationNode(graph, delayNode, { status: 'completed' });
    }
  }

  while (current && !visited.has(current.nodeId)) {
    visited.add(current.nodeId);
    const node = current;
    const startedAt = new Date();
    const nodeExitDecision = input.leadId ? await evaluateExitCondition(definition.exitCondition, input.leadId, workflowId) : null;
    if (nodeExitDecision?.shouldExit) {
      await prisma.automationRunStep.create({
        data: {
          runId,
          nodeId: node.nodeId,
          nodeType: node.nodeType,
          status: 'stopped',
          startedAt,
          endedAt: new Date(),
          output: { exitReason: nodeExitDecision.reason } as Prisma.InputJsonValue
        }
      });
      await prisma.automationRun.update({ where: { id: runId }, data: { status: 'stopped', exitReason: nodeExitDecision.reason, completedAt: new Date() } });
      return { ok: true, runId, status: 'stopped', reason: nodeExitDecision.reason };
    }
    const result = await executeAutomationNode(runId, node, input, actor);
    await prisma.automationRunStep.create({
      data: {
        runId,
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        status: result.status,
        startedAt,
        endedAt: result.status === 'pending' ? null : new Date(),
        output: (result.output ?? {}) as Prisma.InputJsonValue,
        error: result.error
      }
    });

    if (result.status === 'pending') {
      await prisma.automationRun.update({ where: { id: runId }, data: { status: 'waiting', exitReason: result.reason } });
      return { ok: true, runId, status: 'waiting' };
    }
    if (['paused', 'stopped', 'failed'].includes(result.status)) {
      await prisma.automationRun.update({ where: { id: runId }, data: { status: result.status, exitReason: result.reason, completedAt: result.status === 'paused' ? null : new Date() } });
      return { ok: result.status !== 'failed', runId, status: result.status };
    }
    current = nextAutomationNode(graph, node, result);
  }

  await prisma.automationRun.update({ where: { id: runId }, data: { status: 'completed', completedAt: new Date() } });
  return { ok: true, runId, status: 'completed' };
}

async function executeAutomationNode(runId: string, node: AutomationNode, input: { leadId?: string; context?: Record<string, unknown> }, actor: string): Promise<{ status: string; reason?: string; output?: Record<string, unknown>; error?: string }> {
  const type = node.nodeType.toLowerCase();
  if (type.includes('delay')) {
    const delayMinutes = Number((node.config.delayMinutes ?? node.config.minutes ?? 15));
    const runAt = new Date(Date.now() + Math.max(1, delayMinutes) * 60_000);
    await prisma.automationScheduledJob.create({ data: { runId, nodeId: node.nodeId, runAt, status: 'scheduled' } });
    return { status: 'pending', reason: 'delay_scheduled', output: { runAt: runAt.toISOString() } };
  }
  if (type.includes('if') || type.includes('condition')) {
    const variables = input.leadId ? await automationVariables(input.leadId, input.context) : input.context ?? {};
    const matched = evaluateAutomationConditions(node.config, variables);
    return { status: matched ? 'completed' : 'skipped', reason: matched ? 'condition_matched' : 'condition_not_matched', output: { matched } };
  }
  if (type.includes('pause')) return { status: 'paused', reason: 'pause_node', output: { nodeId: node.nodeId } };
  if (type.includes('stop')) return { status: 'stopped', reason: 'stop_node', output: { nodeId: node.nodeId } };
  if (type.includes('mark_expired') && input.leadId) {
    await prisma.lead.update({ where: { id: input.leadId }, data: { status: 'Expired', updatedBy: actor } });
  }
  if (type.includes('assignment') && input.leadId) {
    const result = await assignmentRunner.runAssignmentForLead(input.leadId, {
      ruleId: typeof node.config.ruleId === 'string' ? node.config.ruleId : undefined,
      actor,
      context: { ...(input.context ?? {}), automationRunId: runId, nodeId: node.nodeId },
      mode: 'automation'
    });
    return { status: result.ok ? 'completed' : 'failed', output: result as Record<string, unknown>, error: result.ok ? undefined : String(result.status ?? 'assignment_failed') };
  }
  if (type.includes('whatsapp') && input.leadId) {
    const variables = await automationVariables(input.leadId, input.context);
    const templateId = String(node.config.templateId ?? '');
    const template = templateId ? await prisma.whatsAppTemplate.findUnique({ where: { id: templateId } }) : null;
    const mappedVariables = resolveMappedVariables(node.config.variableMapping, variables);
    const content = template?.content ? String(resolveVariables(template.content, mappedVariables)) : String(node.config.content ?? '');
    const result = await processWhatsAppSend({ data: { leadId: input.leadId, content, templateId: templateId || undefined, actor } } as Job<{ leadId?: string; content?: string; templateId?: string; actor?: string }>);
    const resultStatus = String((result as Record<string, unknown>).status ?? '');
    if (['not_configured', 'dry_run'].includes(resultStatus)) {
      return { status: 'skipped', reason: resultStatus, output: result as Record<string, unknown> };
    }
    return { status: 'completed', output: result as Record<string, unknown> };
  }
  if (type.includes('voicebot') && input.leadId) {
    const variables = await automationVariables(input.leadId, input.context);
    const templateId = String(node.config.templateId ?? '');
    if (!templateId) return { status: 'skipped', reason: 'voicebot_template_missing', output: {} };
    const mappedVariables = resolveMappedVariables(node.config.variableMapping, variables);
    const result = await processVoicebotTrigger({ data: { templateId, leadId: input.leadId, variables: mappedVariables, dryRun: false, actor } } as Job<{ templateId: string; leadId?: string; variables?: Record<string, unknown>; dryRun?: boolean; actor?: string }>);
    const resultStatus = String((result as Record<string, unknown>).status ?? '');
    if (['not_configured', 'dry_run'].includes(resultStatus)) {
      return { status: 'skipped', reason: resultStatus, output: result as Record<string, unknown> };
    }
    return { status: 'completed', output: result as Record<string, unknown> };
  }
  if ((type.includes('task') || type.includes('create_task')) && input.leadId) {
    const dueInDays = Number(node.config.dueInDays ?? 1);
    const dueDate = new Date(Date.now() + Math.max(0, dueInDays) * 24 * 60 * 60_000);
    const task = await prisma.task.create({
      data: {
        leadId: input.leadId,
        taskType: String(node.config.taskType ?? 'Follow-up'),
        priority: String(node.config.priority ?? 'Medium'),
        dueDate,
        remarks: typeof node.config.remarks === 'string' ? node.config.remarks : undefined,
        createdBy: actor,
        updatedBy: actor
      }
    });
    return { status: 'completed', output: { taskId: task.id } };
  }
  if (type.includes('lead_update') && input.leadId) {
    const field = String(node.config.field ?? '');
    const allowedFields = ['status', 'category', 'disposition', 'assignedUserId'];
    if (!allowedFields.includes(field)) return { status: 'skipped', reason: 'lead_update_field_not_allowed', output: { field } };
    const lead = await prisma.lead.update({ where: { id: input.leadId }, data: { [field]: node.config.value ?? null, updatedBy: actor } });
    return { status: 'completed', output: { leadId: lead.id, field, value: node.config.value } };
  }
  if (type.includes('api_call')) {
    return executeWorkerApiCall(runId, node, input);
  }
  if (type.includes('create_activity') && input.leadId) {
    await prisma.activity.create({
      data: {
        leadId: input.leadId,
        type: String(node.config.type ?? 'Automation'),
        title: String(node.config.title ?? node.label ?? 'Automation activity'),
        notes: typeof node.config.notes === 'string' ? node.config.notes : undefined,
        metadata: { runId, nodeId: node.nodeId } as Prisma.InputJsonValue,
        createdBy: actor
      }
    });
  }
  return { status: 'completed', output: { nodeId: node.nodeId } };
}

async function automationVariables(leadId?: string, context: Record<string, unknown> = {}) {
  const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
  const user = lead?.assignedUserId ? await prisma.user.findUnique({ where: { id: lead.assignedUserId } }) : null;
  const [leadCustomValues, userCustomValues] = await Promise.all([
    lead?.id ? prisma.leadCustomFieldValue.findMany({ where: { leadId: lead.id }, include: { field: true } }) : Promise.resolve([]),
    user?.id ? prisma.userCustomFieldValue.findMany({ where: { userId: user.id }, include: { field: true } }) : Promise.resolve([])
  ]);
  const customVariables = {
    ...Object.fromEntries(leadCustomValues.map((entry) => [`lead.custom.${entry.field.fieldKey}`, entry.value])),
    ...Object.fromEntries(userCustomValues.map((entry) => [`user.custom.${entry.field.fieldKey}`, entry.value]))
  };
  return {
    ...context,
    ...customVariables,
    'lead.id': lead?.id,
    'lead.customerName': lead?.customerName,
    'lead.mobile': lead?.mobile,
    'lead.status': lead?.status,
    'lead.category': lead?.category,
    'lead.disposition': lead?.disposition,
    'lead.branchCode': lead?.branchCode,
    'lead.branchName': lead?.branchName,
    'lead.offerAmount': lead?.offerAmount,
    'lead.emiAmount': lead?.emiAmount,
    'lead.preferredLanguage': lead?.preferredLanguage,
    'user.id': user?.id,
    'user.name': user?.name,
    'user.phone': user?.phone,
    'user.email': user?.email,
    leadId: lead?.id,
    leadName: lead?.customerName,
    agentPhone: user?.phone
  };
}

function resolveMappedVariables(mapping: unknown, variables: Record<string, unknown>) {
  const record = mapping && typeof mapping === 'object' && !Array.isArray(mapping) ? mapping as Record<string, string> : {};
  const resolved: Record<string, unknown> = { ...variables };
  for (const [variableKey, fieldPath] of Object.entries(record)) {
    resolved[variableKey] = variables[fieldPath] ?? variables[fieldPath.replace(/^lead\./, '')] ?? '';
  }
  return resolved;
}


async function executeWorkerApiCall(runId: string, node: AutomationNode, input: { leadId?: string; context?: Record<string, unknown> }) {
  const config = node.config ?? {};
  const url = String(config.url ?? config.endpoint ?? '');
  if (!url) return { status: 'skipped', reason: 'api_url_missing', output: {} };
  const urlValidationError = validatePublicHttpsUrl(url);
  if (urlValidationError) return { status: 'failed', error: urlValidationError, output: { url } };
  const variables = input.leadId ? await automationVariables(input.leadId, input.context) : input.context ?? {};
  const method = String(config.method ?? 'POST').toUpperCase();
  const headers = Object.fromEntries(Object.entries(asRecord(config.headers)).map(([key, value]) => [key, String(value)]));
  const body = resolveVariables(config.body ?? {}, variables);
  const retries = Math.min(Math.max(Number(config.retries ?? 0), 0), 3);
  const timeoutMs = Math.min(Math.max(Number(config.timeoutMs ?? 10000), 1000), 30000);
  const retryDelayMs = Math.min(Math.max(Number(config.retryDelayMs ?? 1000), 0), 60000);
  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0 && retryDelayMs > 0) await sleep(retryDelayMs);
    const request = { url, method, headers, body, attempt, timeoutMs, retryDelayMs };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: method === 'GET' ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      const responseText = await response.text();
      await prisma.automationApiCallLog.create({
        data: {
          runId,
          nodeId: node.nodeId,
          request: toJson(request),
          response: toJson({ status: response.status, body: responseText.slice(0, 5000) }),
          status: response.ok ? 'success' : 'failed',
          error: response.ok ? null : responseText.slice(0, 500)
        }
      });
      if (response.ok) return { status: 'completed', output: { httpStatus: response.status, attempt } };
      lastError = responseText.slice(0, 500);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'API call failed';
      await prisma.automationApiCallLog.create({
        data: { runId, nodeId: node.nodeId, request: toJson(request), status: 'failed', error: lastError }
      });
    }
  }
  return { status: 'failed', error: lastError || 'API call failed', output: {} };
}

async function evaluateExitCondition(exitCondition: Record<string, unknown>, leadId: string, workflowId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const stopStatuses = Array.isArray(exitCondition.stopStatuses) ? exitCondition.stopStatuses.map(String) : ['Converted', 'Expired'];
  const stopDispositions = Array.isArray(exitCondition.stopDispositions) ? exitCondition.stopDispositions.map(String) : ['Not Interested', 'Wrong Number'];
  const maxAttempts = Number(exitCondition.maxAttempts ?? 0);
  if (stopStatuses.includes(lead.status)) return { shouldExit: true, reason: `status_${lead.status}` };
  if (lead.disposition && stopDispositions.includes(lead.disposition)) return { shouldExit: true, reason: `disposition_${lead.disposition}` };
  if (maxAttempts > 0) {
    const runCount = await prisma.automationRun.count({ where: { leadId, workflowId } });
    if (runCount >= maxAttempts) return { shouldExit: true, reason: 'max_attempts_reached' };
  }
  return { shouldExit: false };
}

function normalizeAutomationDefinition(value: import('@prisma/client').Prisma.JsonValue) {
  const definition = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const edges = Array.isArray(definition.edges) ? definition.edges : [];
  const exitCondition = definition.exitCondition && typeof definition.exitCondition === 'object' && !Array.isArray(definition.exitCondition)
    ? definition.exitCondition as Record<string, unknown>
    : {};
  return { nodes, edges, exitCondition };
}

