export type AutomationNode = {
  nodeId: string;
  nodeType: string;
  label?: string;
  config: Record<string, unknown>;
};

export type AutomationEdge = {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition: Record<string, unknown>;
};

export type AutomationGraph = {
  nodesById: Map<string, AutomationNode>;
  edgesBySource: Map<string, AutomationEdge[]>;
  firstNode?: AutomationNode;
};

export function buildAutomationGraph(definition: { nodes: unknown[]; edges: unknown[] }): AutomationGraph {
  const nodes = definition.nodes
    .filter((n): n is Record<string, unknown> => n != null && typeof n === 'object' && !Array.isArray(n))
    .map((node, index) => ({
      nodeId: String(node.nodeId ?? node.id ?? `node_${index}`),
      nodeType: String(node.nodeType ?? node.type ?? 'action'),
      label: typeof node.label === 'string' ? node.label : undefined,
      config: node.config && typeof node.config === 'object' && !Array.isArray(node.config) ? node.config as Record<string, unknown> : {}
    }));
  const edges = definition.edges
    .filter((edge) => edge && typeof edge === 'object')
    .map((edge, index) => {
      const record = edge as Record<string, unknown>;
      return {
        edgeId: String(record.edgeId ?? record.id ?? `edge_${index}`),
        sourceNodeId: String(record.sourceNodeId ?? record.source ?? ''),
        targetNodeId: String(record.targetNodeId ?? record.target ?? ''),
        label: typeof record.label === 'string' ? record.label : undefined,
        condition: record.condition && typeof record.condition === 'object' && !Array.isArray(record.condition) ? record.condition as Record<string, unknown> : {}
      };
    })
    .filter((edge) => edge.sourceNodeId && edge.targetNodeId);
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const edgesBySource = new Map<string, AutomationEdge[]>();
  edges.forEach((edge) => edgesBySource.set(edge.sourceNodeId, [...(edgesBySource.get(edge.sourceNodeId) ?? []), edge]));
  const targets = new Set(edges.map((edge) => edge.targetNodeId));
  const firstNode = nodes.find((node) => !targets.has(node.nodeId)) ?? nodes[0];
  return { nodesById, edgesBySource, firstNode };
}

export function nextAutomationNode(graph: AutomationGraph, node: AutomationNode, result: { status: string; output?: Record<string, unknown> }) {
  const edges = graph.edgesBySource.get(node.nodeId) ?? [];
  if (!edges.length) return undefined;
  const type = node.nodeType.toLowerCase();
  const matched = Boolean(result.output?.matched);
  const preferred = type.includes('if') || type.includes('condition')
    ? edges.find((edge) => edgeMatchesConditionBranch(edge, matched))
    : edges[0];
  return preferred ? graph.nodesById.get(preferred.targetNodeId) : undefined;
}

export function edgeMatchesConditionBranch(edge: AutomationEdge, matched: boolean) {
  const label = String(edge.label ?? edge.condition.branch ?? edge.condition.result ?? '').toLowerCase();
  if (matched) return ['true', 'yes', 'matched', 'then', 'success', ''].includes(label);
  return ['false', 'no', 'unmatched', 'else', 'otherwise'].includes(label);
}

export function evaluateAutomationConditions(config: Record<string, unknown>, variables: Record<string, unknown>) {
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const conditions = [
    { fieldPath: config.fieldPath, operator: config.operator, value: config.value },
    ...groups
  ].filter((condition) => condition.fieldPath);
  if (!conditions.length) return true;
  const results = conditions.map((condition) => evaluateAutomationCondition(condition, variables));
  return config.branchMode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export function evaluateAutomationCondition(condition: Record<string, unknown>, variables: Record<string, unknown>) {
  const fieldPath = String(condition.fieldPath ?? '');
  const operator = String(condition.operator ?? 'equals');
  const actual = variables[fieldPath] ?? variables[fieldPath.replace(/^lead\./, '')] ?? variables[fieldPath.replace(/^user\./, '')];
  const expected = condition.value;
  const actualText = actual === undefined || actual === null ? '' : String(actual);
  const expectedText = expected === undefined || expected === null ? '' : String(expected);
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
