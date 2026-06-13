import { test } from 'node:test';
import assert from 'node:assert';
import { render } from '../src/personas/voice.js';
import type { Finding } from '../src/core/finding.js';

const findings: Finding[] = [
  {
    id: 'buaji/god-object/foo',
    character: 'buaji',
    category: 'god-object',
    severity: 'critical',
    title: 'Foo is a god object (20 methods)',
    detail: 'Too much responsibility.',
    evidence: [{ file: 'src/foo.ts', line: 10 }],
    confidence: 0.9,
    suggestion: 'Split it.',
  },
];

test('professional mode strips all persona', () => {
  const out = render('buaji', findings, { professional: true });
  assert.ok(out.includes('Issue Finder'), 'has neutral label');
  assert.ok(out.includes('src/foo.ts:10'), 'has evidence');
  assert.ok(!out.includes('Beta'), 'no Hinglish');
  assert.ok(!out.includes('👵'), 'no persona emoji');
});

test('persona mode applies the Hinglish skin', () => {
  const out = render('buaji', findings, {});
  assert.ok(out.includes('Bua Ji'));
  assert.ok(out.includes('Beta'), 'has Hinglish');
  // The underlying technical title is still present beneath the skin.
  assert.ok(out.includes('god object'));
});

test('json mode returns parseable structured data, no persona', () => {
  const out = render('buaji', findings, { json: true });
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.character, 'buaji');
  assert.strictEqual(parsed.findings.length, 1);
  assert.ok(!out.includes('Beta'));
});
