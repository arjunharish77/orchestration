import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { AssignmentService } from '../assignment/assignment.service';
import { AuditService } from '../audit/audit.service';
import { requiredEnv } from '../common/env';
import { activityTypeCodes } from '../activities/activity-types';
import { ConnectorsService } from '../connectors/connectors.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkflowDto,
  RunWorkflowDto,
  SaveWorkflowDefinitionDto,
  UpdateWorkflowDto,
  UpsertAutomationEdgeDto,
  UpsertAutomationNodeDto
} from './automation.dto';
import {
  WorkflowDefinition,
  WorkflowNode,
  asRecord,
  assertPublicHttpsUrl,
  buildExecutionGraph,
  buildVariableContext,
  emptyWorkflowDefinition,
  evaluateAutomationConditions,
  getEdges,
  getNodes,
  getPathValue,
  isTruthy,
  nextExecutionNode,
  normalizeDefinition,
  normalizeNodeType,
  orderNodes,
  resolveTemplate,
  sleep,
  toAnyInputJson,
  toInputJson,
  validateAutomationDefinition,
  validateAutomationNode
} from './automation-utils';

@Injectable()
export class AutomationService {
  private readonly automationQueue: Queue;
  private readonly voicebotQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly assignment: AssignmentService,
    private readonly connectors: ConnectorsService
  ) {
    const connection = new IORedis(requiredEnv('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: null
    });
    this.automationQueue = new Queue('automation', {
      connection,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } }
    });
    this.voicebotQueue = new Queue('voicebot-trigger', {
      connection,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 100, removeOnFail: 100 }
    });
  }

  async overview() {
    const [workflows, runs, assignmentRules] = await Promise.all([
      this.prisma.automationWorkflow.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1
          }
        }
      }),
      this.prisma.automationRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 100,
        include: {
          steps: {
            orderBy: { startedAt: 'desc' },
            take: 100
          }
        }
      }),
      this.prisma.assignmentRule.findMany({
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: {
          conditions: true,
          actions: true
        }
      })
    ]);

    return { workflows, runs, assignmentRules };
  }

  async listWorkflows() {
    return this.prisma.automationWorkflow.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });
  }

  async getWorkflow(id: string) {
    const workflow = await this.prisma.automationWorkflow.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        }
      }
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async createWorkflow(input: CreateWorkflowDto, actor = 'system') {
    return this.prisma.automationWorkflow.create({
      data: {
        name: input.name,
        description: input.description,
        status: 'draft',
        createdBy: actor,
        versions: {
          create: {
            version: 1,
            definition: toInputJson(emptyWorkflowDefinition()),
            isPublished: false
          }
        }
      },
      include: { versions: true }
    });
  }

  async updateWorkflow(id: string, input: UpdateWorkflowDto) {
    await this.assertWorkflow(id);
    return this.prisma.automationWorkflow.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });
  }

  async runWorkflow(workflowId: string, input: RunWorkflowDto, actor = 'system', actorRole = ''): Promise<unknown> {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (input.leadIds?.length) {
      return this.runWorkflowForLeadIds(workflowId, input, actor, actorRole);
    }
    const version = input.useDraft ? await this.latestVersion(workflowId) : await this.latestPublishedVersion(workflowId);
    if (!version) {
      throw new BadRequestException(input.useDraft ? 'Workflow draft definition not found' : 'Workflow must be published before it can run');
    }
    const definition = normalizeDefinition(version.definition);
    if (!input.useDraft && workflow.status !== 'active') {
      throw new BadRequestException('Workflow must be active before it can run');
    }
    const runLabel = String(input.runLabel ?? input.context?.runLabel ?? (input.useDraft ? 'Test Run' : '')).trim();
    const exitDecision = input.leadId ? await this.evaluateExitCondition(definition.exitCondition, input.leadId) : null;
    const run = await this.prisma.automationRun.create({
      data: {
        workflowId,
        leadId: input.leadId,
        status: exitDecision?.shouldExit ? 'stopped' : 'running',
        exitReason: exitDecision?.reason
      }
    });
    if (runLabel) {
      await this.audit.write({ moduleName: 'Automation', entityId: run.id, action: 'run_started', newValue: { workflowId, leadId: input.leadId, version: version.version, marker: runLabel }, changedBy: actor });
    }
    if (exitDecision?.shouldExit) return this.getRun(run.id);

    const graph = buildExecutionGraph(definition);
    const resumeFromNodeId = String(input.context?.resumeFromNodeId ?? '').trim();
    let current = resumeFromNodeId ? graph.nodesById.get(resumeFromNodeId) ?? graph.firstNode : graph.firstNode;
    const visited = new Set<string>();
    while (current && !visited.has(current.nodeId)) {
      visited.add(current.nodeId);
      const node = current;
      const startedAt = new Date();
      try {
        const nodeExitDecision = input.leadId ? await this.evaluateExitCondition(definition.exitCondition, input.leadId) : null;
        if (nodeExitDecision?.shouldExit) {
          await this.prisma.automationRunStep.create({
            data: {
              runId: run.id,
              nodeId: node.nodeId,
              nodeType: node.nodeType,
              status: 'stopped',
              startedAt,
              endedAt: new Date(),
              output: toAnyInputJson({ exitReason: nodeExitDecision.reason })
            }
          });
          await this.prisma.automationRun.update({
            where: { id: run.id },
            data: { status: 'stopped', exitReason: nodeExitDecision.reason, completedAt: new Date() }
          });
          await this.audit.write({ moduleName: 'Automation', entityId: run.id, action: 'run_stopped', newValue: { nodeId: node.nodeId, reason: nodeExitDecision.reason, marker: runLabel || undefined }, changedBy: actor });
          return this.getRun(run.id);
        }
        const result = await this.executeNode(run.id, node, input, actor, actorRole);
        await this.prisma.automationRunStep.create({
          data: {
            runId: run.id,
            nodeId: node.nodeId,
            nodeType: node.nodeType,
            status: result.status,
            startedAt,
            endedAt: result.status === 'pending' ? null : new Date(),
            output: toAnyInputJson(result.result ?? {})
          }
        });
        if (['stopped', 'paused', 'failed'].includes(result.status)) {
          await this.prisma.automationRun.update({
            where: { id: run.id },
            data: { status: result.status, exitReason: result.reason, completedAt: result.status === 'paused' ? null : new Date() }
          });
          await this.audit.write({ moduleName: 'Automation', entityId: run.id, action: `run_${result.status}`, newValue: { nodeId: node.nodeId, reason: result.reason, marker: runLabel || undefined }, changedBy: actor });
          return this.getRun(run.id);
        }
        current = nextExecutionNode(graph, node, result);
      } catch (error) {
        await this.prisma.automationRunStep.create({
          data: {
            runId: run.id,
            nodeId: node.nodeId,
            nodeType: node.nodeType,
            status: 'failed',
            startedAt,
            endedAt: new Date(),
            error: error instanceof Error ? error.message : 'Automation node failed'
          }
        });
        await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: 'failed', exitReason: 'node_failed', completedAt: new Date() } });
        return this.getRun(run.id);
      }
    }

    await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: 'completed', completedAt: new Date() } });
    await this.audit.write({ moduleName: 'Automation', entityId: run.id, action: 'run_completed', newValue: { workflowId, leadId: input.leadId, version: version.version, marker: runLabel || undefined }, changedBy: actor });
    return this.getRun(run.id);
  }

  async enqueueWorkflowRun(workflowId: string, input: RunWorkflowDto, actor = 'system', actorRole = '') {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    const version = input.useDraft ? await this.latestVersion(workflowId) : await this.latestPublishedVersion(workflowId);
    if (!version) {
      throw new BadRequestException(input.useDraft ? 'Workflow draft definition not found' : 'Workflow must be published before it can run');
    }
    if (!input.useDraft && workflow.status !== 'active') {
      throw new BadRequestException('Workflow must be active before it can run');
    }
    const run = await this.prisma.automationRun.create({
      data: {
        workflowId,
        leadId: input.leadId,
        status: 'queued'
      }
    });
    const job = await this.automationQueue.add(
      'automation.run-step',
      {
        runId: run.id,
        workflowId,
        input,
        actor,
        actorRole,
        versionId: version.id
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );
    await this.audit.write({ moduleName: 'Automation', entityId: run.id, action: 'run_enqueued', newValue: { workflowId, leadId: input.leadId, queueJobId: job.id, version: version.version, marker: input.runLabel ?? input.context?.runLabel }, changedBy: actor });
    return {
      queued: true,
      queueJobId: job.id,
      run: await this.getRun(run.id)
    };
  }

  async retryFailedRun(runId: string, actor = 'system', actorRole = '') {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
      include: { steps: { orderBy: { startedAt: 'asc' } } }
    });
    if (!run) throw new NotFoundException('Automation run not found');
    const failedStep = run.steps.find((step) => step.status === 'failed');
    if (!failedStep) throw new BadRequestException('Automation run has no failed step to retry');
    const retry = await this.runWorkflow(
      run.workflowId,
      {
        leadId: run.leadId ?? undefined,
        runLabel: 'Retry Failed',
        context: {
          runLabel: 'Retry Failed',
          retryOfRunId: run.id,
          resumeFromNodeId: failedStep.nodeId
        }
      },
      actor,
      actorRole
    );
    await this.audit.write({ moduleName: 'Automation', entityId: run.id, action: 'retry_failed_run', newValue: { retryOfRunId: run.id, failedNodeId: failedStep.nodeId }, changedBy: actor });
    return retry;
  }

  async saveDefinition(id: string, input: SaveWorkflowDefinitionDto, actor = 'system', actorRole = '') {
    await this.assertWorkflow(id);
    const normalized = validateAutomationDefinition(normalizeDefinition(input.definition), actorRole, Boolean(input.publish));
    const latest = await this.latestVersion(id);
    const nextVersion = input.publish || latest?.isPublished ? (latest?.version ?? 0) + 1 : (latest?.version ?? 1);

    if (!latest || input.publish || latest.isPublished) {
      const version = await this.prisma.automationWorkflowVersion.create({
        data: {
          workflowId: id,
          version: nextVersion,
          definition: toInputJson(normalized),
          isPublished: input.publish ?? false
        }
      });
      if (input.publish) await this.markPublished(id, version.id);
      await this.auditApiNodes(id, normalized, actor, 'save_definition');
      return version;
    }

    const version = await this.prisma.automationWorkflowVersion.update({
      where: { id: latest.id },
      data: {
        definition: toInputJson(normalized),
        isPublished: false
      }
    });
    await this.auditApiNodes(id, normalized, actor, 'save_definition');
    return version;
  }

  async upsertNode(workflowId: string, input: UpsertAutomationNodeDto, actor = 'system', actorRole = '') {
    if (normalizeNodeType(input.nodeType) === 'api_call' && actorRole !== 'Administrator') {
      throw new BadRequestException('Only Administrator users can create or edit API-call nodes');
    }
    validateAutomationNode({
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      label: input.label ?? input.nodeType,
      config: input.config ?? {},
      position: input.position ?? {}
    });
    const draft = await this.ensureDraftVersion(workflowId);
    const definition = normalizeDefinition(draft.definition);
    const nodes = getNodes(definition).filter((node) => node.nodeId !== input.nodeId);
    nodes.push({
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      label: input.label ?? input.nodeType,
      config: input.config ?? {},
      position: input.position ?? {}
    });

    definition.nodes = nodes;
    const updated = await this.updateDraftDefinition(draft.id, definition);
    if (normalizeNodeType(input.nodeType) === 'api_call') {
      await this.audit.write({ moduleName: 'Automation', entityId: workflowId, action: 'upsert_api_call_node', newValue: input, changedBy: actor });
    }
    return updated;
  }

  async cloneNode(workflowId: string, nodeId: string) {
    const draft = await this.ensureDraftVersion(workflowId);
    const definition = normalizeDefinition(draft.definition);
    const nodes = getNodes(definition);
    const node = nodes.find((item) => item.nodeId === nodeId);
    if (!node) throw new NotFoundException('Node not found');

    const clone: WorkflowNode = {
      ...node,
      nodeId: `${node.nodeId}_copy_${Date.now()}`,
      label: `${node.label ?? node.nodeType} Copy`
    };
    definition.nodes = [...nodes, clone];
    return this.updateDraftDefinition(draft.id, definition);
  }

  async deleteNode(workflowId: string, nodeId: string) {
    const draft = await this.ensureDraftVersion(workflowId);
    const definition = normalizeDefinition(draft.definition);
    definition.nodes = getNodes(definition).filter((node) => node.nodeId !== nodeId);
    definition.edges = getEdges(definition).filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId);
    return this.updateDraftDefinition(draft.id, definition);
  }

  async upsertEdge(workflowId: string, input: UpsertAutomationEdgeDto) {
    const draft = await this.ensureDraftVersion(workflowId);
    const definition = normalizeDefinition(draft.definition);
    const nodeIds = new Set(getNodes(definition).map((node) => node.nodeId));
    if (!nodeIds.has(input.sourceNodeId) || !nodeIds.has(input.targetNodeId)) {
      throw new BadRequestException('Both sourceNodeId and targetNodeId must exist in the workflow');
    }

    const edges = getEdges(definition).filter((edge) => edge.edgeId !== input.edgeId);
    edges.push({
      edgeId: input.edgeId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      label: input.label,
      condition: input.condition ?? {}
    });

    definition.edges = edges;
    return this.updateDraftDefinition(draft.id, definition);
  }

  async deleteEdge(workflowId: string, edgeId: string) {
    const draft = await this.ensureDraftVersion(workflowId);
    const definition = normalizeDefinition(draft.definition);
    definition.edges = getEdges(definition).filter((edge) => edge.edgeId !== edgeId);
    return this.updateDraftDefinition(draft.id, definition);
  }

  async getRun(id: string, viewerRole = 'Administrator') {
    const run = await this.prisma.automationRun.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { startedAt: 'asc' }
        }
      }
    });
    if (!run) throw new NotFoundException('Automation run not found');

    const [workflow, apiCalls, scheduledJobs] = await Promise.all([
      this.prisma.automationWorkflow.findUnique({ where: { id: run.workflowId } }),
      this.prisma.automationApiCallLog.findMany({ where: { runId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.automationScheduledJob.findMany({ where: { runId: id }, orderBy: { runAt: 'asc' } })
    ]);

    const safeApiCalls = viewerRole === 'Administrator'
      ? apiCalls
      : apiCalls.map((call) => ({
        id: call.id,
        workflowId: call.workflowId,
        runId: call.runId,
        nodeId: call.nodeId,
        status: call.status,
        createdAt: call.createdAt
      }));

    return { ...run, workflow, apiCalls: safeApiCalls, scheduledJobs };
  }

  private async assertWorkflow(id: string) {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id }, select: { id: true } });
    if (!workflow) throw new NotFoundException('Workflow not found');
  }

  private latestVersion(workflowId: string) {
    return this.prisma.automationWorkflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' }
    });
  }

  private latestPublishedVersion(workflowId: string) {
    return this.prisma.automationWorkflowVersion.findFirst({
      where: { workflowId, isPublished: true },
      orderBy: { version: 'desc' }
    });
  }

  private async runWorkflowForLeadIds(workflowId: string, input: RunWorkflowDto, actor: string, actorRole: string): Promise<unknown> {
    const leadIds = [...new Set((input.leadIds ?? []).map(String).filter(Boolean))];
    if (!leadIds.length) throw new BadRequestException('At least one lead is required for a bulk run');
    const runs = [];
    for (const leadId of leadIds) {
      runs.push(await this.runWorkflow(workflowId, { ...input, leadId, leadIds: undefined, useDraft: false, runLabel: input.runLabel ?? 'Manual Run' }, actor, actorRole));
    }
    return { runLabel: input.runLabel ?? 'Manual Run', count: runs.length, runs };
  }

  private async ensureDraftVersion(workflowId: string) {
    await this.assertWorkflow(workflowId);
    const latest = await this.latestVersion(workflowId);
    if (!latest) {
      return this.prisma.automationWorkflowVersion.create({
        data: {
          workflowId,
          version: 1,
          definition: toInputJson(emptyWorkflowDefinition()),
          isPublished: false
        }
      });
    }

    if (!latest.isPublished) return latest;

    return this.prisma.automationWorkflowVersion.create({
      data: {
        workflowId,
        version: latest.version + 1,
        definition: toInputJson(normalizeDefinition(latest.definition)),
        isPublished: false
      }
    });
  }

  private updateDraftDefinition(versionId: string, definition: WorkflowDefinition) {
    return this.prisma.automationWorkflowVersion.update({
      where: { id: versionId },
      data: {
        definition: toInputJson(definition),
        isPublished: false
      }
    });
  }

  private async markPublished(workflowId: string, publishedVersionId: string) {
    await this.prisma.automationWorkflowVersion.updateMany({
      where: { workflowId, id: { not: publishedVersionId } },
      data: { isPublished: false }
    });
    await this.prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: { status: 'active' }
    });
  }

  private async executeNode(runId: string, node: WorkflowNode, input: RunWorkflowDto, actor: string, actorRole: string): Promise<{ status: string; reason?: string; result?: unknown }> {
    const nodeType = normalizeNodeType(node.nodeType);
    const config = node.config ?? {};
    if (nodeType === 'trigger') return { status: 'completed', result: { config } };
    if (nodeType === 'if_else') {
      const variables = input.leadId ? await this.automationVariables(input.leadId, input.context) : input.context ?? {};
      const matched = evaluateAutomationConditions(config, variables);
      return { status: matched ? 'completed' : 'skipped', reason: matched ? 'condition_matched' : 'condition_not_matched', result: { matched } };
    }
    if (nodeType === 'delay') {
      const minutes = Number(config.minutes ?? config.delayMinutes ?? 0);
      const unit = String(config.delayUnit ?? 'minutes');
      const multiplier = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
      const totalMinutes = Math.max(minutes * multiplier, 1);
      await this.prisma.automationScheduledJob.create({
        data: {
          runId,
          nodeId: node.nodeId,
          runAt: new Date(Date.now() + totalMinutes * 60_000),
          status: 'scheduled',
          payload: toAnyInputJson({ nodeId: node.nodeId, nodeType: node.nodeType })
        }
      });
      return { status: 'pending', reason: 'delay_scheduled', result: { minutes: totalMinutes, unit } };
    }
    if (nodeType === 'assignment') {
      if (!input.leadId) return { status: 'skipped', reason: 'lead_required', result: {} };
      const result = await this.assignment.run({
        leadId: input.leadId,
        ruleId: String(config.ruleId ?? '').trim() || undefined,
        mode: 'automation',
        context: { ...(input.context ?? {}), automationRunId: runId, nodeId: node.nodeId }
      }, actor);
      const resultStatus = String((result as { status?: unknown }).status ?? '');
      return {
        status: resultStatus === 'failed' ? 'failed' : 'completed',
        reason: resultStatus || undefined,
        result
      };
    }
    if (nodeType === 'whats_app' || nodeType === 'whatsapp') {
      if (!input.leadId) return { status: 'skipped', reason: 'lead_required', result: {} };
      const variables = await this.automationVariables(input.leadId, input.context);
      const variableContext = buildVariableContext(variables, asRecord(config.variableMapping));
      const templateId = String(config.templateId ?? '').trim();
      const template = templateId ? await this.prisma.whatsAppTemplate.findUnique({ where: { id: templateId } }) : null;
      const contentTemplate = template?.content ?? config.content ?? config.message ?? '';
      const message = await this.connectors.createOutboundWhatsAppMessage({
        leadId: input.leadId,
        templateId: templateId || undefined,
        content: String(resolveTemplate(contentTemplate, variableContext)),
        messageType: templateId ? 'template' : 'text',
        rawPayload: {
          automationRunId: runId,
          nodeId: node.nodeId,
          variableMapping: config.variableMapping ?? {}
        }
      }, actor);
      const status = String((message as { status?: unknown }).status ?? 'queued');
      return {
        status: status === 'blocked' ? 'skipped' : 'completed',
        reason: status === 'blocked' ? 'whatsapp_blocked' : status,
        result: { messageId: (message as { id?: unknown }).id, status }
      };
    }
    if (nodeType === 'voicebot') {
      if (!input.leadId) return { status: 'skipped', reason: 'lead_required', result: {} };
      const templateId = String(config.templateId ?? '').trim();
      if (!templateId) return { status: 'skipped', reason: 'voicebot_template_missing', result: {} };
      const template = await this.prisma.voicebotTriggerTemplate.findUnique({ where: { id: templateId } });
      if (!template) return { status: 'failed', reason: 'voicebot_template_not_found', result: { templateId } };
      const variables = await this.automationVariables(input.leadId, input.context);
      const variableContext = buildVariableContext(variables, asRecord(config.variableMapping));
      const job = await this.voicebotQueue.add('voicebot.trigger', {
        templateId,
        leadId: input.leadId,
        variables: variableContext,
        dryRun: false,
        actor
      });
      await this.prisma.connectorEvent.create({
        data: {
          connectorId: template.connectorId,
          eventType: 'voicebot_automation_trigger_queued',
          rawPayload: toAnyInputJson({ templateId, leadId: input.leadId, automationRunId: runId, nodeId: node.nodeId }),
          normalizedPayload: toAnyInputJson({ queueJobId: job.id, templateName: template.name }),
          status: 'queued'
        }
      });
      await this.prisma.activity.create({
        data: {
          leadId: input.leadId,
          type: activityTypeCodes.voicebot,
          title: 'Voicebot trigger queued',
          notes: template.name,
          metadata: toAnyInputJson({ templateId, queueJobId: job.id, runId, nodeId: node.nodeId }),
          createdBy: actor
        }
      });
      return { status: 'completed', reason: 'voicebot_queued', result: { queueJobId: job.id, templateId } };
    }
    if (nodeType === 'task' || nodeType === 'create_task') {
      if (!input.leadId) return { status: 'skipped', reason: 'lead_required', result: {} };
      const dueInDays = Number(config.dueInDays ?? 1);
      const dueDate = new Date(Date.now() + Math.max(0, dueInDays) * 24 * 60 * 60_000);
      const task = await this.prisma.task.create({
        data: {
          leadId: input.leadId,
          assignedTo: typeof config.assignedTo === 'string' ? config.assignedTo : undefined,
          taskType: String(config.taskType ?? 'Follow-up'),
          priority: String(config.priority ?? 'Medium'),
          dueDate,
          remarks: typeof config.remarks === 'string' ? String(resolveTemplate(config.remarks, input.context ?? {})) : undefined,
          createdBy: actor,
          updatedBy: actor
        }
      });
      return { status: 'completed', result: { taskId: task.id, dueDate: dueDate.toISOString() } };
    }
    if (nodeType === 'lead_update') {
      if (!input.leadId) return { status: 'skipped', reason: 'lead_required', result: {} };
      const existing = await this.prisma.lead.findUnique({ where: { id: input.leadId } });
      if (!existing) return { status: 'failed', reason: 'lead_not_found', result: { leadId: input.leadId } };
      const variables = await this.automationVariables(input.leadId, input.context);
      const updates = normalizeLeadUpdateRows(config);
      const allowedFields = ['status', 'category', 'disposition', 'assignedUserId', 'assignedTeamId', 'automationStatus', 'partnerMapping'];
      const leadPatch: Record<string, unknown> = {};
      const customUpdates: Array<{ fieldKey: string; value: unknown }> = [];
      for (const update of updates) {
        const value = resolveTemplate(update.value ?? '', variables);
        if (allowedFields.includes(update.field)) {
          leadPatch[update.field] = value === '' ? null : value;
          continue;
        }
        const customFieldKey = update.field.startsWith('lead.custom.') ? update.field.replace(/^lead\.custom\./, '') : update.field.startsWith('custom:') ? update.field.replace(/^custom:/, '') : '';
        if (customFieldKey) {
          customUpdates.push({ fieldKey: customFieldKey, value: value === '' ? null : value });
          continue;
        }
        return { status: 'failed', reason: 'lead_update_field_not_allowed', result: { field: update.field } };
      }
      const lead = Object.keys(leadPatch).length
        ? await this.prisma.lead.update({ where: { id: input.leadId }, data: { ...leadPatch, updatedBy: actor } })
        : existing;
      await this.applyLeadCustomFieldUpdates(input.leadId, customUpdates);
      await this.audit.write({
        moduleName: 'Lead',
        entityId: input.leadId,
        action: 'automation_lead_update',
        oldValue: Object.fromEntries(updates.map((update) => [update.field, (existing as unknown as Record<string, unknown>)[update.field]])),
        newValue: { updates, leadPatch, customUpdates, runId, nodeId: node.nodeId },
        changedBy: actor
      });
      return { status: 'completed', result: { leadId: lead.id, updates: updates.length } };
    }
    if (nodeType === 'create_activity' && input.leadId) {
      const variables = await this.automationVariables(input.leadId, input.context);
      const activity = await this.prisma.activity.create({
        data: {
          leadId: input.leadId,
          type: String(config.type ?? 'Automation'),
          title: String(resolveTemplate(config.title ?? node.label ?? 'Automation activity', variables)),
          notes: config.notes ? String(resolveTemplate(config.notes, variables)) : undefined,
          metadata: toAnyInputJson({ runId, nodeId: node.nodeId, context: input.context ?? {} }),
          createdBy: actor
        }
      });
      await this.createActivityCustomValues(activity.id, String(config.type ?? 'Automation'), asRecord(config.customFields), variables);
      return { status: 'completed', result: { activityCreated: true, activityId: activity.id } };
    }
    if (nodeType === 'mark_expired' && input.leadId) {
      await this.prisma.lead.update({ where: { id: input.leadId }, data: { status: 'Expired', updatedBy: actor } });
      return { status: 'completed', result: { status: 'Expired' } };
    }
    if (nodeType === 'notify') {
      return { status: 'completed', result: { notification: config, actorRole } };
    }
    if (nodeType === 'stop') return { status: 'stopped', reason: String(config.reason ?? 'stop_node') };
    if (nodeType === 'pause') return { status: 'paused', reason: String(config.reason ?? 'pause_node') };
    if (nodeType === 'resume') return { status: 'completed', result: { resumed: true } };
    if (nodeType === 'api_call') {
      return this.executeApiCallNode(runId, node, input);
    }
    return {
      status: 'failed',
      reason: `unsupported_node_type:${node.nodeType}`,
      result: {
        supportedNodeTypes: ['trigger', 'if_else', 'delay', 'assignment', 'whatsapp', 'voicebot', 'task', 'lead_update', 'create_activity', 'mark_expired', 'notify', 'stop', 'pause', 'resume', 'api_call']
      }
    };
  }

  private async createActivityCustomValues(activityId: string, activityType: string, customFields: Record<string, unknown>, variables: Record<string, unknown>) {
    const entries = Object.entries(customFields).filter(([fieldKey, mapping]) => fieldKey && mapping !== undefined && mapping !== null && String(mapping).trim());
    if (entries.length === 0) return;
    const normalizedType = activityType.padStart(3, '0');
    const definitions = await this.prisma.activityCustomField.findMany({
      where: {
        isActive: true,
        OR: [
          { activityTypeCode: normalizedType },
          { activityTypeCode: 'ALL' }
        ],
        fieldKey: { in: entries.map(([fieldKey]) => fieldKey) }
      }
    });
    const definitionByKey = new Map(definitions.map((definition) => [definition.fieldKey, definition]));
    await this.prisma.activityCustomFieldValue.createMany({
      data: entries.flatMap(([fieldKey, mapping]) => {
        const definition = definitionByKey.get(fieldKey);
        if (!definition) return [];
        const mappingPath = String(mapping);
        const mappedValue = getPathValue(variables, mappingPath) ?? variables[mappingPath] ?? resolveTemplate(mappingPath, variables);
        return [{
          activityId,
          fieldId: definition.id,
          value: toAnyInputJson(mappedValue)
        }];
      }),
      skipDuplicates: true
    });
  }

  private async applyLeadCustomFieldUpdates(leadId: string, updates: Array<{ fieldKey: string; value: unknown }>) {
    if (updates.length === 0) return;
    const fields = await this.prisma.leadCustomField.findMany({
      where: { isActive: true, fieldKey: { in: updates.map((update) => update.fieldKey) } }
    });
    const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));
    await this.prisma.$transaction(updates.flatMap((update) => {
      const field = fieldByKey.get(update.fieldKey);
      if (!field) return [];
      return this.prisma.leadCustomFieldValue.upsert({
        where: { leadId_fieldId: { leadId, fieldId: field.id } },
        update: { value: toAnyInputJson(update.value) },
        create: { leadId, fieldId: field.id, value: toAnyInputJson(update.value) }
      });
    }));
  }

  private async evaluateExitCondition(exitCondition: Record<string, unknown>, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;
    const stopStatuses = Array.isArray(exitCondition.stopStatuses) ? exitCondition.stopStatuses.map(String) : ['Converted', 'Expired'];
    const stopDispositions = Array.isArray(exitCondition.stopDispositions) ? exitCondition.stopDispositions.map(String) : ['Not Interested', 'Wrong Number'];
    const maxAttempts = Number(exitCondition.maxAttempts ?? 0);
    if (stopStatuses.includes(lead.status)) return { shouldExit: true, reason: `status_${lead.status}` };
    if (lead.disposition && stopDispositions.includes(lead.disposition)) return { shouldExit: true, reason: `disposition_${lead.disposition}` };
    if (await this.isLeadOptedOut(leadId)) return { shouldExit: true, reason: 'lead_opted_out' };
    if (await this.hasActiveHumanConversation(leadId)) return { shouldExit: true, reason: 'active_human_conversation' };
    if (maxAttempts > 0) {
      const runCount = await this.prisma.automationRun.count({ where: { leadId } });
      if (runCount >= maxAttempts) return { shouldExit: true, reason: 'max_attempts_reached' };
    }
    return { shouldExit: false };
  }

  private async executeApiCallNode(runId: string, node: WorkflowNode, input: RunWorkflowDto) {
    const config = node.config ?? {};
    const connectorId = String(config.connectorId ?? '').trim();
    const connector = connectorId ? await this.prisma.connector.findUnique({ where: { id: connectorId } }) : null;
    if (connectorId && !connector) return { status: 'failed', reason: 'api_connector_not_found', result: { connectorId } };
    if (connector && connector.type !== 'api_call') return { status: 'failed', reason: 'invalid_api_connector_type', result: { connectorId } };
    if (connector && connector.isActive === false) return { status: 'failed', reason: 'api_connector_inactive', result: { connectorId } };

    const connectorConfig = asRecord(connector?.config);
    const sourceConfig = connector ? { ...connectorConfig, ...config, connectorId } : config;
    const automationContext = input.leadId ? await this.automationVariables(input.leadId, input.context ?? {}) : input.context ?? {};
    const variableContext = buildVariableContext(automationContext, asRecord(sourceConfig.variableMapping));
    const url = String(resolveTemplate(sourceConfig.url ?? sourceConfig.endpoint ?? '', variableContext));
    if (!url) return { status: 'skipped', reason: 'api_url_missing', result: {} };
    assertPublicHttpsUrl(url);
    const method = String(sourceConfig.method ?? 'POST').toUpperCase();
    const headers = resolveTemplate(asRecord(sourceConfig.headers), variableContext) as Record<string, unknown>;
    const bodyTemplate = sourceConfig.body ?? sourceConfig.bodyTemplate ?? {};
    const body = resolveTemplate(bodyTemplate, variableContext);
    const responseKeyword = String(sourceConfig.responseKeyword ?? '').trim();
    const retries = Math.min(Number(sourceConfig.retries ?? 0), 3);
    const retryDelayMs = Math.min(Math.max(Number(sourceConfig.retryDelayMs ?? 1000), 0), 60000);
    const timeoutMs = Math.min(Math.max(Number(sourceConfig.timeoutMs ?? 10000), 1000), 30000);
    let lastError = '';
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0 && retryDelayMs > 0) await sleep(retryDelayMs);
      const request = { connectorId: connector?.id, connectorName: connector?.name, url, method, headers, body, attempt, timeoutMs, retryDelayMs };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])) },
          body: method === 'GET' ? undefined : JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timer);
        const responseText = await response.text();
        const keywordMissing = response.ok && Boolean(responseKeyword) && !responseText.toLowerCase().includes(responseKeyword.toLowerCase());
        const logStatus = response.ok ? (keywordMissing ? 'completed_with_warning' : 'success') : 'failed';
        await this.prisma.automationApiCallLog.create({
          data: {
            workflowId: undefined,
            runId,
            nodeId: node.nodeId,
            request: toAnyInputJson(request),
            response: toAnyInputJson({ status: response.status, body: responseText.slice(0, 5000), responseKeyword }),
            status: logStatus,
            error: response.ok ? (keywordMissing ? 'response_keyword_missing' : null) : responseText.slice(0, 500)
          }
        });
        if (response.ok) return { status: 'completed', result: { httpStatus: response.status, attempt, warning: keywordMissing ? 'response_keyword_missing' : undefined } };
        lastError = responseText.slice(0, 500);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'API call failed';
        await this.prisma.automationApiCallLog.create({
          data: {
            runId,
            nodeId: node.nodeId,
            request: toAnyInputJson(request),
            status: 'failed',
            error: lastError
          }
        });
      }
    }
    return { status: 'failed', reason: lastError || 'api_call_failed' };
  }

  private async automationVariables(leadId: string, context?: Record<string, unknown>) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        customValues: { include: { field: true } }
      }
    });
    if (!lead) return context ?? {};
    const assignedUser = lead.assignedUserId ? await this.prisma.user.findUnique({ where: { id: lead.assignedUserId } }) : null;
    const leadCustom = Object.fromEntries(lead.customValues.map((entry) => [`lead.custom.${entry.field.fieldKey}`, entry.value]));
    return {
      leadId: lead.id,
      'lead.id': lead.id,
      'lead.customerName': lead.customerName,
      'lead.mobile': lead.mobile,
      'lead.status': lead.status,
      'lead.category': lead.category,
      'lead.disposition': lead.disposition,
      'lead.branchCode': lead.branchCode,
      'lead.branchName': lead.branchName,
      'lead.offerAmount': lead.offerAmount,
      'lead.emiAmount': lead.emiAmount,
      'lead.preferredLanguage': lead.preferredLanguage,
      'user.id': assignedUser?.id,
      'user.name': assignedUser?.name,
      'user.email': assignedUser?.email,
      'user.phone': assignedUser?.phone,
      ...leadCustom,
      ...(context ?? {})
    };
  }

  private async isLeadOptedOut(leadId: string) {
    const values = await this.prisma.leadCustomFieldValue.findMany({
      where: {
        leadId,
        field: { fieldKey: { in: ['whatsapp_opt_out', 'opt_out', 'do_not_contact'] } }
      }
    });
    return values.some((entry) => isTruthy(entry.value));
  }

  private async hasActiveHumanConversation(leadId: string) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: {
        leadId,
        serviceWindowUntil: { gt: new Date() }
      }
    });
    return Boolean(conversation);
  }

  private async auditApiNodes(workflowId: string, definition: WorkflowDefinition, actor: string, action: string) {
    const apiNodes = definition.nodes.filter((node) => normalizeNodeType(node.nodeType) === 'api_call');
    if (apiNodes.length === 0) return;
    await this.audit.write({ moduleName: 'Automation', entityId: workflowId, action, newValue: { apiNodes }, changedBy: actor });
  }

  async listScheduledJobs() {
    return this.prisma.automationScheduledJob.findMany({
      where: { status: { in: ['scheduled', 'processing'] } },
      orderBy: { runAt: 'asc' },
      take: 100
    });
  }
}

function normalizeLeadUpdateRows(config: Record<string, unknown>) {
  const rows = Array.isArray(config.updates) && config.updates.length
    ? config.updates
    : [{ field: config.field ?? 'status', value: config.value ?? 'In Progress' }];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
    .map((row) => ({ field: String(row.field ?? '').trim(), value: row.value ?? '' }))
    .filter((row) => row.field);
}
