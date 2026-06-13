import { test } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runSaasuma } from '../src/characters/saasuma/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

test('Saasu Maa FAILS the gate when a secret is present', async () => {
  const result = await runSaasuma(path.join(fixtures, 'saasuma-project'));
  assert.strictEqual(result.passed, false);
  const verdict = result.findings[0];
  assert.strictEqual(verdict.category, 'quality-gate');
  assert.strictEqual(verdict.severity, 'critical');
  assert.strictEqual(verdict.meta?.passed, false);
});

test('Saasu Maa PASSES a clean project (grudgingly)', async () => {
  const result = await runSaasuma(path.join(fixtures, 'buaji-project'));
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.findings[0].meta?.passed, true);
});
