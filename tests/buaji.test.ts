import { test } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runBuaji } from '../src/characters/buaji/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'fixtures', 'buaji-project');

// Integration: exercises the real auk engine via the adapter. Confirms the
// full Stage 1 → Stage 2 vertical slice produces persona-free findings.
test('runBuaji finds the over-long function in the fixture', async () => {
  const findings = await runBuaji(fixture);
  assert.ok(Array.isArray(findings));
  const long = findings.find((f) => f.category === 'long-function');
  assert.ok(long, 'expected a long-function finding for tangledReport()');
  assert.match(long!.title, /tangledReport/);
  assert.strictEqual(long!.evidence[0].file.endsWith('long.ts'), true);
  assert.ok(long!.confidence > 0 && long!.confidence <= 1);
  // Findings carry no persona text.
  assert.ok(!long!.title.includes('Beta'));
});
