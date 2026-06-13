import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { harvestSignatures } from '../src/characters/chota-cousin/signature.js';
import { generateCases, candidatesFor } from '../src/characters/chota-cousin/generate.js';
import { fuzzFile } from '../src/characters/chota-cousin/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fix = (f: string) => path.join(here, 'fixtures', 'cousin', f);

test('harvestSignatures extracts names, typed params and async', () => {
  const sigs = harvestSignatures(
    `export async function foo(a: number, b?: string) { return a; }
     const bar = (x: string[]) => x.length;`
  );
  const foo = sigs.find((s) => s.name === 'foo')!;
  assert.ok(foo, 'found foo');
  assert.strictEqual(foo.async, true);
  assert.strictEqual(foo.exported, true);
  assert.deepStrictEqual(foo.params.map((p) => p.name), ['a', 'b']);
  assert.strictEqual(foo.params[0].type, 'number');
  assert.strictEqual(foo.params[1].optional, true);

  const bar = sigs.find((s) => s.name === 'bar')!;
  assert.ok(bar, 'found arrow const bar');
  assert.strictEqual(bar.params[0].type, 'string[]');
});

test('generateCases produces adversarial values per type', () => {
  const numberCands = candidatesFor({ name: 'n', type: 'number', optional: false });
  assert.ok(numberCands.some((c) => c.spec.t === 'nan'));
  assert.ok(numberCands.some((c) => c.spec.t === 'pinf'));

  const cases = generateCases([{ name: 'n', type: 'number', optional: false }]);
  assert.ok(cases.length > 1);
  assert.ok(cases.every((c) => c.specs.length === 1));
});

test('fuzzFile finds an unhandled exception in a brittle pure function', () => {
  const findings = fuzzFile(fix('pure.ts'), { fn: 'needsObj', timeoutMs: 2000 });
  const thrown = findings.find((f) => f.meta?.failureKind === 'throw');
  assert.ok(thrown, 'expected needsObj() to throw on a degenerate object');
  assert.match(thrown!.title, /needsObj/);
  assert.strictEqual(thrown!.evidence[0].file.endsWith('pure.ts'), true);
});

test('fuzzFile does NOT execute effectful targets (safety rail)', () => {
  const findings = fuzzFile(fix('effectful.ts'), { fn: 'persist', timeoutMs: 2000 });
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].meta?.failureKind, 'skipped');
  // The side-effect file must not have been written.
  assert.strictEqual(
    fs.existsSync('/tmp/family-pack-should-not-run'),
    false,
    'effectful target must not run'
  );
});
