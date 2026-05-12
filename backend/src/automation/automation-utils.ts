import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type WorkflowNode = {
  nodeId: string;
  nodeType: string;
  label?: string;
  config?: Record<string, unknown>;
  position?: Record<string, unknown>;
};

export type WorkflowEdge = {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: Record<string, unknown>;
};

export type WorkflowDefinition = Record<string, unknown> & {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  exitCondition: Record<string, unknown>;
};

export type ExecutionGraph = {
  nodesById: Map<string, WorkflowNode>;
  edgesBySource: Map<string, WorkflowEdge[]>;
  firstNode?: WorkflowNode;
};

export function emptyWorkflowDefinition(): WorkflowDefinition {
  return {
    nodes: [],
    edges: [],
    exitCondition: {}
  };
}

export function normalizeDefinition(definition: unknown): WorkflowDefinition {
  const base = typeof definition === 'object' && definition !== null && !Array.isArray(definition) ? { ...(definition as Record<string, unknown>) } : {};
  return {
    ...base,
    nodes: getNodes(base),
    edges: getEdges(base),
    exitCondition:
      typeof base.exitCondition === 'object' && base.exitCondition !== null && !Array.isArray(base.exitCondition)
        ? (base.exitCondition as Record<string, unknown>)
        : {}
  };
}

function getArray(definition: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = definition[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item));
}

export function getNodes(definition: Record<string, unknown>): WorkflowNode[] {
  return getArray(definition, 'nodes')
    .filter((node) => typeof node.nodeId === 'string' && typeof node.nodeType === 'string')
    .map((node) => ({
      ...node,
      nodeId: String(node.nodeId),
      nodeType: String(node.nodeType),
      label: typeof node.label === 'string' ? node.label : undefined,
      config: typeof node.config === 'object' && node.config !== null && !Array.isArray(node.config) ? (node.config as Record<string, unknown>) : {},
      position: typeof node.position === 'object' && node.position !== null && !Array.isArray(node.position) ? (node.position as Record<string, unknown>) : {}
    }));
}

export function getEdges(definition: Record<string, unknown>): WorkflowEdge[] {
  return getArray(definition, 'edges')
    .filter((edge) => typeof edge.edgeId === 'string' && typeof edge.sourceNodeId === 'string' && typeof edge.targetNodeId === 'string')
    .map((edge) => ({
      ...edge,
      edgeId: String(edge.edgeId),
      sourceNodeId: String(edge.sourceNodeId),
      targetNodeId: String(edge.targetNodeId),
      label: typeof edge.label === 'string' ? edge.label : undefined,
      condition:
        typeof edge.condition === 'object' && edge.condition !== null && !Array.isArray(edge.condition)
          ? (edge.condition as Record<string, unknown>)
          : {}
    }));
}

export function orderNodes(definition: WorkflowDefinition) {
  const nodes = getNodes(definition);
  const edges = getEdges(definition);
  if (nodes.length <= 1 || edges.length === 0) return nodes;
  const targets = new Set(edges.map((edge) => edge.targetNodeId));
  const first = nodes.find((node) => !targets.has(node.nodeId)) ?? nodes[0];
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const ordered: WorkflowNode[] = [];
  const seen = new Set<string>();
  let current: WorkflowNode | undefined = first;
  while (current && !seen.has(current.nodeId)) {
    ordered.push(current);
    seen.add(current.nodeId);
    const nextEdge = edges.find((edge) => edge.sourceNodeId === current?.nodeId);
    current = nextEdge ? byId.get(nextEdge.targetNodeId) : undefined;
  }
  nodes.forEach((node) => {
    if (!seen.has(node.nodeId)) ordered.push(node);
  });
  return ordered;
}

export function buildExecutionGraph(definition: WorkflowDefinition): ExecutionGraph {
  const nodes = getNodes(definition);
  const edges = getEdges(definition);
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const edgesBySource = new Map<string, WorkflowEdge[]>();
  edges.forEach((edge) => edgesBySource.set(edge.sourceNodeId, [...(edgesBySource.get(edge.sourceNodeId) ?? []), edge]));
  const targets = new Set(edges.map((edge) => edge.targetNodeId));
  const firstNode = nodes.find((node) => !targets.has(node.nodeId)) ?? nodes[0];
  return { nodesById, edgesBySource, firstNode };
}

export function nextExecutionNode(graph: ExecutionGraph, node: WorkflowNode, result: { status: string; result?: unknown }) {
  const edges = graph.edgesBySource.get(node.nodeId) ?? [];
  if (!edges.length) return undefined;
  const nodeType = normalizeNodeType(node.nodeType);
  const output = result.result && typeof result.result === 'object' ? result.result as Record<string, unknown> : {};
  const matched = Boolean(output.matched);
  const nextEdge = nodeType === 'if_else'
    ? edges.find((edge) => edgeMatchesResult(edge, matched))
    : edges[0];
  return nextEdge ? graph.nodesById.get(nextEdge.targetNodeId) : undefined;
}

function edgeMatchesResult(edge: WorkflowEdge, matched: boolean) {
  const label = String(edge.label ?? edge.condition?.branch ?? edge.condition?.result ?? '').toLowerCase();
  if (matched) return ['true', 'yes', 'matched', 'then', 'success', ''].includes(label);
  return ['false', 'no', 'unmatched', 'else', 'otherwise'].includes(label);
}

export function normalizeNodeType(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function evaluateAutomationConditions(config: Record<string, unknown>, variables: Record<string, unknown>) {
  const conditions = [
    { fieldPath: config.fieldPath, operator: config.operator, value: config.value },
    ...(Array.isArray(config.groups) ? config.groups : [])
  ].filter((condition) => condition.fieldPath);
  if (!conditions.length) return true;
  const results = conditions.map((condition) => evaluateAutomationCondition(condition as Record<string, unknown>, variables));
  return config.branchMode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function evaluateAutomationCondition(condition: Record<string, unknown>, variables: Record<string, unknown>) {
  const fieldPath = String(condition.fieldPath ?? '');
  const operator = String(condition.operator ?? 'equals');
  const actual = variables[fieldPath];
  const expected = condition.value;
  const actualText = String(actual ?? '');
  const expectedText = String(expected ?? '');
  const expectedList = expectedText.split(',').map((item) => item.trim()).filter(Boolean);
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);

  if (operator === 'exists') return actualText.trim().length > 0;
  if (operator === 'equals') return actualText.toLowerCase() === expectedText.toLowerCase();
  if (operator === 'not_equals') return actualText.toLowerCase() !== expectedText.toLowerCase();
  if (operator === 'contains') return actualText.toLowerCase().includes(expectedText.toLowerCase());
  if (operator === 'in') return expectedList.some((item) => item.toLowerCase() === actualText.toLowerCase());
  if (operator === 'not_in') return expectedList.every((item) => item.toLowerCase() !== actualText.toLowerCase());
  if (operator === 'gt') return Number.isFinite(actualNumber) && actualNumber > expectedNumber;
  if (operator === 'gte') return Number.isFinite(actualNumber) && actualNumber >= expectedNumber;
  if (operator === 'lt') return Number.isFinite(actualNumber) && actualNumber < expectedNumber;
  if (operator === 'lte') return Number.isFinite(actualNumber) && actualNumber <= expectedNumber;
  return false;
}

export function validateAutomationDefinition(definition: WorkflowDefinition, actorRole = '', publishing = false) {
  if (publishing && definition.nodes.length === 0) {
    throw new BadRequestException('Workflow must contain at least one node before publishing');
  }
  definition.nodes.forEach((node) => {
    if (normalizeNodeType(node.nodeType) === 'api_call' && actorRole !== 'Administrator') {
      throw new BadRequestException('Only Administrator users can create or edit API-call nodes');
    }
    validateAutomationNode(node, publishing);
  });
  return definition;
}

export function validateAutomationNode(node: WorkflowNode, publishing = false) {
  const nodeType = normalizeNodeType(node.nodeType);
  const config = node.config ?? {};
  if (nodeType === 'api_call') {
    const connectorId = String(config.connectorId ?? '').trim();
    const url = String(config.url ?? config.endpoint ?? '');
    if (publishing && !connectorId && !url) {
      throw new BadRequestException(`API Call node "${node.label ?? node.nodeId}" must select a connector or define a URL before publishing`);
    }
    if (url) assertPublicHttpsUrl(url);
  }
  if (!publishing) return;
  if (nodeType === 'delay' && Number(config.minutes ?? config.delayMinutes ?? 0) <= 0) {
    throw new BadRequestException(`Delay node "${node.label ?? node.nodeId}" must define a delay before publishing`);
  }
  if (nodeType === 'create_activity') {
    if (!String(config.type ?? '').trim()) throw new BadRequestException(`Create Activity node "${node.label ?? node.nodeId}" must choose an activity type before publishing`);
    if (!String(config.title ?? '').trim()) throw new BadRequestException(`Create Activity node "${node.label ?? node.nodeId}" must define a title before publishing`);
  }
  if (nodeType === 'whats_app' || nodeType === 'whatsapp') {
    if (!String(config.templateId ?? '').trim()) throw new BadRequestException(`WhatsApp node "${node.label ?? node.nodeId}" must choose a template before publishing`);
  }
  if (nodeType === 'voicebot') {
    if (!String(config.templateId ?? '').trim()) throw new BadRequestException(`Voicebot node "${node.label ?? node.nodeId}" must choose a template before publishing`);
  }
  if (nodeType === 'lead_update') {
    if (!String(config.field ?? '').trim()) throw new BadRequestException(`Lead Update node "${node.label ?? node.nodeId}" must choose a field before publishing`);
  }
}

export function assertPublicHttpsUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('API-call node URL is invalid');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('API-call node URL must use HTTPS');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    throw new BadRequestException('API-call node URL cannot target localhost or private network addresses');
  }
}

export function toInputJson(value: WorkflowDefinition): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function toAnyInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function buildVariableContext(baseContext: Record<string, unknown>, variableMapping: Record<string, unknown>) {
  const mappedVariables = Object.fromEntries(
    Object.entries(variableMapping)
      .map(([variable, fieldPath]) => [variable, getPathValue(baseContext, String(fieldPath)) ?? baseContext[String(fieldPath)]])
      .filter(([, value]) => value !== undefined)
  );
  return {
    ...baseContext,
    ...mappedVariables
  };
}

export function resolveTemplate(value: unknown, context: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolveTemplate(entry, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveTemplate(entry, context)]));
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g, (_, key) => String(getPathValue(context, key) ?? ''));
}

export function isTruthy(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'opted_out'].includes(value.toLowerCase());
  return Boolean(value);
}

export function getPathValue(source: unknown, path: string) {
  if (!source) return undefined;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) return (current as Record<string, unknown>)[segment];
    return undefined;
  }, source);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
