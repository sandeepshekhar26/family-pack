import { test } from 'node:test';
import assert from 'node:assert';
import { guard, record, emptyLedger } from '../src/characters/chachaji/index.js';
import { buildPromptBatch } from '../src/core/llm-pass.js';
import type { Finding } from '../src/core/finding.js';

function sampleBatch(items: number) {
  const findings: Finding[] = Array.from({ length: items }, (_, i) => ({
    id: `buaji/x/${i}`,
    character: 'buaji' as const,
    category: 'x',
    severity: 'warning' as const,
    title: 'A reasonably long finding title to consume some tokens here',
    detail: 'A reasonably long detail string repeated to consume tokens. '.repeat(4),
    evidence: [{ file: `src/file-${i}.ts`, line: i + 1 }],
    confidence: 0.8,
  }));
  return buildPromptBatch('buaji', findings, 'Explain and fix each finding.');
}

test('guard allows a batch that fits the budget', () => {
  const ledger = emptyLedger(100_000);
  const res = guard(sampleBatch(3), ledger);
  assert.strictEqual(res.allowed, true);
  assert.ok(res.estimatedTokens > 0);
  assert.strictEqual(res.finding.severity !== 'critical', true);
});

test('guard blocks a batch that exceeds the budget', () => {
  const ledger = emptyLedger(5);
  const res = guard(sampleBatch(3), ledger);
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.finding.severity, 'critical');
  assert.ok(res.finding.suggestion);
});

test('record accumulates spend and entries immutably', () => {
  const ledger = emptyLedger(100_000);
  const next = record(ledger, 'buaji', 'enhance:3', 1234);
  assert.strictEqual(ledger.spent, 0, 'original ledger is untouched');
  assert.strictEqual(next.spent, 1234);
  assert.strictEqual(next.entries.length, 1);
  assert.strictEqual(next.entries[0].tokens, 1234);
});
