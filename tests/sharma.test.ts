import { test } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runSharmaBeta } from '../src/characters/sharma-beta/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Integration: runs the real auk TF-IDF clustering over family-pack's own
// source. We assert the pipeline runs and produces well-formed drift findings
// (exact membership depends on clustering, so we don't over-assert content).
test('runSharmaBeta returns well-formed idiomatic-drift findings', async () => {
  const findings = await runSharmaBeta(path.join(here, '..', 'src'));
  assert.ok(Array.isArray(findings));
  for (const f of findings) {
    assert.strictEqual(f.character, 'sharma-beta');
    assert.strictEqual(f.category, 'idiomatic-drift');
    assert.ok(Array.isArray(f.meta?.missing));
    assert.ok(f.confidence > 0 && f.confidence <= 1);
  }
});
