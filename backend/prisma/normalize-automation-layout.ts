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
  const branchByTarget = new Map<string, { sourceNodeId: string; branchLabel: 'Yes' | 'No' }>();
  edges.forEach((edge) => {
    const sourceNodeId = String(edge.sourceNodeId ?? '');
    const targetNodeId = String(edge.targetNodeId ?? '');
    const branchLabel = branchLabelForEdge(edge);
    if (sourceNodeId && targetNodeId && branchLabel) {
      branchByTarget.set(targetNodeId, { sourceNodeId, branchLabel });
    }
  });

  const nextNodes = nodes.map((node, index) => {
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
        x: branchPath === 'Yes' ? 120 : branchPath === 'No' ? 560 : 340,
        y: index * 132
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
