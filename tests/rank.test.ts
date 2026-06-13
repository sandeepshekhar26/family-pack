import { test } from 'node:test';
import assert from 'node:assert';
import { rankFindings, severityCounts } from '../src/core/rank.js';
import type { Finding } from '../src/core/finding.js';

function f(over: Partial<Finding>): Finding {
  return {
    id: 'x/cat/1',
    character: 'buaji',
    category: 'cat',
    severity: 'info',
    title: 't',
    detail: 'd',
    evidence: [{ file: 'a.ts', line: 1 }],
    confidence: 0.5,
    ...over,
  };
}

test('rankFindings sorts by severity × confidence', () => {
  const ranked = rankFindings([
    f({ id: 'a', severity: 'info', confidence: 0.9, evidence: [{ file: 'a.ts', line: 1 }] }),
    f({ id: 'b', severity: 'critical', confidence: 0.5, evidence: [{ file: 'b.ts', line: 1 }] }),
    f({ id: 'c', severity: 'warning', confidence: 0.9, evidence: [{ file: 'c.ts', line: 1 }] }),
  ]);
  assert.deepStrictEqual(ranked.map((x) => x.id), ['b', 'c', 'a']);
});

test('rankFindings dedupes by character+category+primary evidence, keeping higher score', () => {
  const ranked = rankFindings([
    f({ id: 'low', confidence: 0.2, evidence: [{ file: 'a.ts', line: 5 }] }),
    f({ id: 'high', confidence: 0.9, evidence: [{ file: 'a.ts', line: 5 }] }),
  ]);
  assert.strictEqual(ranked.length, 1);
  assert.strictEqual(ranked[0].id, 'high');
});

test('rankFindings respects topN and minConfidence', () => {
  const all = [
    f({ id: 'a', confidence: 0.9, evidence: [{ file: 'a.ts', line: 1 }] }),
    f({ id: 'b', confidence: 0.8, evidence: [{ file: 'b.ts', line: 1 }] }),
    f({ id: 'c', confidence: 0.1, evidence: [{ file: 'c.ts', line: 1 }] }),
  ];
  assert.strictEqual(rankFindings(all, { topN: 2 }).length, 2);
  assert.strictEqual(rankFindings(all, { minConfidence: 0.5 }).length, 2);
});

test('severityCounts tallies correctly', () => {
  const counts = severityCounts([
    f({ id: '1', severity: 'critical', evidence: [{ file: '1' }] }),
    f({ id: '2', severity: 'warning', evidence: [{ file: '2' }] }),
    f({ id: '3', severity: 'info', evidence: [{ file: '3' }] }),
    f({ id: '4', severity: 'info', evidence: [{ file: '4' }] }),
  ]);
  assert.deepStrictEqual(counts, { critical: 1, warning: 1, info: 2, total: 4 });
});
