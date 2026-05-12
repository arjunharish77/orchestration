/**
 * Unit tests for pure automation logic.
 * Run with: cd workers && npx ts-node test/unit.ts
 * No running server or DB required.
 */

import { buildAutomationGraph, evaluateAutomationCondition, evaluateAutomationConditions } from '../src/processors/automation-pure';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label ? label + ': ' : ''}expected ${e}, got ${a}`);
}

// --- 1. evaluateAutomationCondition ---
console.log('\n[1] evaluateAutomationCondition — single condition evaluation');

test('equals match (case-insensitive)', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.status', operator: 'equals', value: 'New' }, { 'lead.status': 'new' }), true);
});
test('equals no match', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.status', operator: 'equals', value: 'New' }, { 'lead.status': 'Assigned' }), false);
});
test('not_equals returns true when different', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.status', operator: 'not_equals', value: 'Converted' }, { 'lead.status': 'New' }), true);
});
test('contains match', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.customerName', operator: 'contains', value: 'raj' }, { 'lead.customerName': 'Rajesh Kumar' }), true);
});
test('in match', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.status', operator: 'in', value: 'New,Assigned,In Progress' }, { 'lead.status': 'Assigned' }), true);
});
test('in no match', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.status', operator: 'in', value: 'New,Assigned' }, { 'lead.status': 'Converted' }), false);
});
test('exists returns true for non-empty value', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.mobile', operator: 'exists' }, { 'lead.mobile': '9876543210' }), true);
});
test('exists returns false for empty value', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.mobile', operator: 'exists' }, { 'lead.mobile': '' }), false);
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.mobile', operator: 'exists' }, {}), false);
});
test('gt numeric comparison', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.offerAmount', operator: 'gt', value: 100000 }, { 'lead.offerAmount': 200000 }), true);
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.offerAmount', operator: 'gt', value: 200000 }, { 'lead.offerAmount': 100000 }), false);
});
test('falls back from lead.x to x variable path', () => {
  assertEqual(evaluateAutomationCondition({ fieldPath: 'lead.status', operator: 'equals', value: 'New' }, { status: 'New' }), true);
});

// --- 2. evaluateAutomationConditions ---
console.log('\n[2] evaluateAutomationConditions — multi-condition group evaluation');

test('single condition group — match', () => {
  const result = evaluateAutomationConditions(
    { fieldPath: 'lead.status', operator: 'equals', value: 'New', groups: [] },
    { 'lead.status': 'New' }
  );
  assertEqual(result, true);
});
test('empty conditions default to true', () => {
  assertEqual(evaluateAutomationConditions({ groups: [] }, {}), true);
});
test('all mode — all must match', () => {
  const result = evaluateAutomationConditions(
    { fieldPath: 'lead.status', operator: 'equals', value: 'New', branchMode: 'all', groups: [{ fieldPath: 'lead.mobile', operator: 'exists' }] },
    { 'lead.status': 'New', 'lead.mobile': '9999999999' }
  );
  assertEqual(result, true);
});
test('all mode — fails if any condition fails', () => {
  const result = evaluateAutomationConditions(
    { fieldPath: 'lead.status', operator: 'equals', value: 'New', branchMode: 'all', groups: [{ fieldPath: 'lead.mobile', operator: 'exists' }] },
    { 'lead.status': 'New', 'lead.mobile': '' }
  );
  assertEqual(result, false);
});
test('any mode — passes if one condition matches', () => {
  const result = evaluateAutomationConditions(
    { fieldPath: 'lead.status', operator: 'equals', value: 'Assigned', branchMode: 'any', groups: [{ fieldPath: 'lead.status', operator: 'equals', value: 'New' }] },
    { 'lead.status': 'New' }
  );
  assertEqual(result, true);
});

// --- 3. buildAutomationGraph ---
console.log('\n[3] buildAutomationGraph — graph construction');

test('builds graph from nodes and edges', () => {
  const graph = buildAutomationGraph({
    nodes: [
      { nodeId: 'a', nodeType: 'Trigger', config: {} },
      { nodeId: 'b', nodeType: 'Task', config: {} }
    ],
    edges: [{ edgeId: 'e1', sourceNodeId: 'a', targetNodeId: 'b', label: 'Then' }]
  });
  assert(graph.nodesById.size === 2, 'should have 2 nodes');
  assert(graph.firstNode?.nodeId === 'a', 'first node should be the one with no incoming edges');
  assert((graph.edgesBySource.get('a') ?? []).length === 1, 'node a should have one outgoing edge');
});

test('first node is the one with no incoming edges', () => {
  const graph = buildAutomationGraph({
    nodes: [{ nodeId: 'b', nodeType: 'Task', config: {} }, { nodeId: 'a', nodeType: 'Trigger', config: {} }],
    edges: [{ edgeId: 'e1', sourceNodeId: 'a', targetNodeId: 'b' }]
  });
  assertEqual(graph.firstNode?.nodeId, 'a');
});

test('handles empty definition gracefully', () => {
  const graph = buildAutomationGraph({ nodes: [], edges: [] });
  assertEqual(graph.firstNode, undefined);
  assertEqual(graph.nodesById.size, 0);
});

test('normalizes alternate id field names (id vs nodeId)', () => {
  const graph = buildAutomationGraph({
    nodes: [{ id: 'x', type: 'Trigger', config: {} }],
    edges: []
  });
  assert(graph.nodesById.has('x'), 'should accept id as nodeId');
});

// --- Summary ---
console.log(`\n[workers/unit] ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
