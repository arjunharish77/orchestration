/**
 * Unit tests for pure-function logic.
 * Run with: cd backend && npx ts-node test/unit.ts
 * No running server required.
 */

import { advancedLeadCondition, leadWhere } from '../src/leads/leads.filters';
import { csvCell, sanitizeBulkLeadPatch } from '../src/leads/leads.export';
import { clampInt, parseDate } from '../src/tasks/tasks.service';

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

// --- 1. csvCell escaping ---
console.log('\n[1] csvCell — CSV cell escaping');
test('wraps value in double quotes', () => {
  assertEqual(csvCell('hello'), '"hello"');
});
test('escapes internal double quotes', () => {
  assertEqual(csvCell('say "hi"'), '"say ""hi"""');
});
test('handles null/undefined as empty string', () => {
  assertEqual(csvCell(null), '');
  assertEqual(csvCell(undefined), '');
});
test('serializes objects as JSON with escaped quotes', () => {
  const result = csvCell({ a: 1 });
  assert(result.startsWith('"') && result.endsWith('"'), 'should be wrapped in double quotes');
  // Internal quotes are doubled per RFC 4180: {"a":1} → "{""a"":1}"
  assert(result.includes('""a""'), 'internal quotes should be CSV-escaped (doubled)');
});

// --- 2. sanitizeBulkLeadPatch ---
console.log('\n[2] sanitizeBulkLeadPatch — bulk patch sanitization');
test('allows status, category, disposition, teamId, assignedUserId', () => {
  const patch = sanitizeBulkLeadPatch({ status: 'New', category: 'A', disposition: 'Interested', teamId: 't1', assignedUserId: 'u1' });
  assertEqual(patch.status, 'New');
  assertEqual(patch.category, 'A');
  assertEqual(patch.disposition, 'Interested');
  assertEqual(patch.teamId, 't1');
  assertEqual(patch.assignedUserId, 'u1');
});
test('maps system/System/__system__ assignedUserId to null', () => {
  assertEqual(sanitizeBulkLeadPatch({ assignedUserId: 'system' }).assignedUserId, null);
  assertEqual(sanitizeBulkLeadPatch({ assignedUserId: 'System' }).assignedUserId, null);
  assertEqual(sanitizeBulkLeadPatch({ assignedUserId: '__system__' }).assignedUserId, null);
});
test('returns empty patch for empty input', () => {
  assertEqual(Object.keys(sanitizeBulkLeadPatch({})).length, 0);
});

// --- 3. advancedLeadCondition — filter conditions ---
console.log('\n[3] advancedLeadCondition — Prisma filter building');
test('returns null for empty condition', () => {
  assertEqual(advancedLeadCondition({}), null);
});
test('builds equals filter for supported field', () => {
  const result = advancedLeadCondition({ field: 'status', operator: 'equals', value: 'New' });
  assert(result !== null, 'should not be null');
});
test('builds contains filter with insensitive mode', () => {
  const result = advancedLeadCondition({ field: 'customerName', operator: 'contains', value: 'Raj' }) as Record<string, unknown>;
  assert(result !== null, 'should not be null');
  const nameFilter = result?.customerName as Record<string, unknown>;
  assert(nameFilter?.mode === 'insensitive', 'should be case-insensitive');
});
test('builds in-list filter for status', () => {
  const result = advancedLeadCondition({ field: 'status', operator: 'in', value: 'New,Assigned' }) as Record<string, unknown>;
  assert(result !== null, 'should not be null');
  const statusFilter = result?.status as Record<string, unknown>;
  assert(Array.isArray(statusFilter?.in), 'should be an array');
  assertEqual((statusFilter.in as string[]).length, 2);
});
test('returns null for unknown field', () => {
  assertEqual(advancedLeadCondition({ field: 'nonExistentField', operator: 'equals', value: 'x' }), null);
});

// --- 4. leadWhere — basic filter composition ---
console.log('\n[4] leadWhere — query filter composition');
test('empty query returns empty where', () => {
  const result = leadWhere({});
  assertEqual(Object.keys(result).length, 0);
});
test('status filter is passed through', () => {
  const result = leadWhere({ status: 'New' }) as Record<string, unknown>;
  assert('status' in result, 'status key should be present');
});
test('search filter adds OR clause', () => {
  const result = leadWhere({ search: 'test' }) as Record<string, unknown>;
  assert(Array.isArray(result.OR), 'should have OR search clause');
  assert((result.OR as unknown[]).length > 0, 'OR clause should be non-empty');
});
test('date range filters are added', () => {
  const result = leadWhere({ createdFrom: '2025-01-01', createdTo: '2025-12-31' }) as Record<string, unknown>;
  assert('createdAt' in result, 'createdAt filter should be present');
});

// --- 5. clampInt ---
console.log('\n[5] clampInt — bounded integer parsing');
test('clamps value to min', () => {
  assertEqual(clampInt('0', 1, 500, 200), 1);
});
test('clamps value to max', () => {
  assertEqual(clampInt('999', 1, 500, 200), 500);
});
test('returns value within range unchanged', () => {
  assertEqual(clampInt('50', 1, 500, 200), 50);
});
test('returns fallback for NaN input', () => {
  assertEqual(clampInt('abc', 1, 500, 200), 200);
  assertEqual(clampInt(undefined, 1, 500, 200), 200);
});
test('handles float strings by truncating', () => {
  assertEqual(clampInt('42.9', 1, 500, 200), 42);
});

// --- 6. parseDate ---
console.log('\n[6] parseDate — date string parsing');
test('returns null for undefined', () => {
  assertEqual(parseDate(undefined), null);
  assertEqual(parseDate(''), null);
});
test('returns null for invalid date string', () => {
  assertEqual(parseDate('not-a-date'), null);
  assertEqual(parseDate('2025-13-99'), null);
});
test('parses valid ISO date string', () => {
  const result = parseDate('2025-06-15');
  assert(result instanceof Date, 'should be a Date');
  assert(!Number.isNaN(result?.getTime()), 'should be a valid date');
});
test('parses valid ISO datetime string', () => {
  const result = parseDate('2025-06-15T10:30:00.000Z');
  assert(result instanceof Date, 'should be a Date');
  assertEqual(result?.toISOString().startsWith('2025-06-15'), true);
});

// --- Summary ---
console.log(`\n[unit] ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
