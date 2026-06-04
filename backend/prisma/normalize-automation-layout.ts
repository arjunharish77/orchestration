import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type NodeRow = Record<string, unknown>;
type EdgeRow = {
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  label?: string | null;
  condition?: Record<string, unknown> | null;
};

function nodeId(node: NodeRow) {
  return String(node.id ?? node.nodeId ?? '');
}

function normalizeBranchLabel(value: unknown): 'Yes' | 'No' | undefined {
  const text = String(value ?? '').trim().toLowerCase();
  if (['yes', 'true', 'matched', 'success'].includes(text)) return 'Yes';
  if (['no', 'false', 'unmatched', 'else', 'otherwise'].includes(text)) return 'No';
  return undefined;
}

function branchLabelForEdge(edge: EdgeRow) {
  return normalizeBranchLabel(edge.label ?? edge.condition?.branch ?? edge.condition?.result);
}

function normalizeDefinitionLayout(definition: Prisma.JsonValue) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return definition;
  const record = definition as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes) ? record.nodes.filter((node): node is NodeRow => Boolean(node && typeof node === 'object' && !Array.isArray(node))) : [];
  const edges = Array.isArray(record.edges) ? record.edges.filter((edge): edge is EdgeRow => Boolean(edge && typeof edge === 'object' && !Array.isArray(edge))) : [];
  const nodeIds = new Set(nodes.map(nodeId).filter(Boolean));
  const outgoing = new Map<string, EdgeRow[]>();
  const incomingTargets = new Set<string>();

  edges.forEach((edge) => {
    const sourceNodeId = String(edge.sourceNodeId ?? '');
    const targetNodeId = String(edge.targetNodeId ?? '');
    if (!sourceNodeId || !targetNodeId || !nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) return;
    outgoing.set(sourceNodeId, [...(outgoing.get(sourceNodeId) ?? []), edge]);
    incomingTargets.add(targetNodeId);
  });

  const branchByTarget = new Map<string, { sourceNodeId: string; branchLabel: 'Yes' | 'No' }>();
  edges.forEach((edge) => {
    const sourceNodeId = String(edge.sourceNodeId ?? '');
    const targetNodeId = String(edge.targetNodeId ?? '');
    const branchLabel = branchLabelForEdge(edge);
    if (sourceNodeId && targetNodeId && branchLabel) {
      branchByTarget.set(targetNodeId, { sourceNodeId, branchLabel });
    }
  });

  const rootNode = nodes.find((node) => !incomingTargets.has(nodeId(node))) ?? nodes[0];
  const orderedIds: string[] = [];
  const depthById = new Map<string, number>();
  const laneById = new Map<string, number>();
  const visited = new Set<string>();

  function visit(currentId: string, depth: number, lane: number) {
    if (!currentId || visited.has(currentId)) return;
    visited.add(currentId);
    orderedIds.push(currentId);
    depthById.set(currentId, depth);
    laneById.set(currentId, lane);

    const nextEdges = [...(outgoing.get(currentId) ?? [])].sort((a, b) => {
      const aBranch = branchLabelForEdge(a);
      const bBranch = branchLabelForEdge(b);
      if (aBranch === bBranch) return 0;
      if (aBranch === 'Yes') return -1;
      if (bBranch === 'Yes') return 1;
      return 0;
    });

    nextEdges.forEach((edge, index) => {
      const branch = branchLabelForEdge(edge);
      const nextLane = branch === 'Yes' ? lane - 1 : branch === 'No' ? lane + 1 : lane + (nextEdges.length > 1 ? index - 0.5 : 0);
      visit(String(edge.targetNodeId ?? ''), depth + 1, nextLane);
    });
  }

  visit(nodeId(rootNode), 0, 0);
  nodes.forEach((node) => {
    const id = nodeId(node);
    if (!visited.has(id)) {
      orderedIds.push(id);
      depthById.set(id, orderedIds.length);
      laneById.set(id, 0);
    }
  });

  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  const nextNodes = [...nodes].sort((a, b) => (orderById.get(nodeId(a)) ?? 0) - (orderById.get(nodeId(b)) ?? 0)).map((node, index) => {
    const id = nodeId(node);
    const branch = branchByTarget.get(id);
    const branchPath = branch?.branchLabel;
    const { branchFromId: _branchFromId, branchLabel: _branchLabel, branchRootId: _branchRootId, branchPath: _branchPath, ...rest } = node;
    void _branchFromId;
    void _branchLabel;
    void _branchRootId;
    void _branchPath;
    return {
      ...rest,
      ...(branch ? { branchFromId: branch.sourceNodeId, branchLabel: branch.branchLabel, branchRootId: branch.sourceNodeId, branchPath } : {}),
      position: {
        x: 360 + (laneById.get(id) ?? 0) * 420,
        y: 80 + (depthById.get(id) ?? index) * 150
      }
    };
  });
  return { ...record, nodes: nextNodes };
}

async function main() {
  const versions = await prisma.automationWorkflowVersion.findMany({
    include: { workflow: { select: { name: true } } },
    orderBy: [{ workflowId: 'asc' }, { version: 'asc' }]
  });
  for (const version of versions) {
    await prisma.automationWorkflowVersion.update({
      where: { id: version.id },
      data: { definition: normalizeDefinitionLayout(version.definition) as Prisma.InputJsonValue }
    });
  }
  console.log(JSON.stringify({ ok: true, normalizedVersions: versions.length }, null, 2));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
