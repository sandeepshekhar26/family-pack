import { test } from 'node:test';
import assert from 'node:assert';
import { scanText, shannonEntropy } from '../src/characters/padosi-aunty/index.js';

test('shannonEntropy is low for repetitive and high for random strings', () => {
  assert.ok(shannonEntropy('aaaaaaaa') < 1);
  assert.ok(shannonEntropy('A1b2C3d4E5f6G7h8') > 3.5);
});

test('detects a hard-coded AWS access key', () => {
  const findings = scanText('const k = "AKIAIOSFODNN7EXAMPLE";', 'config.ts');
  const hit = findings.find((f) => f.meta?.rule === 'aws-access-key');
  assert.ok(hit, 'expected an AWS key finding');
  assert.strictEqual(hit!.severity, 'critical');
  assert.strictEqual(hit!.evidence[0].file, 'config.ts');
});

test('detects a private key block', () => {
  const findings = scanText('-----BEGIN RSA PRIVATE KEY-----', 'id_rsa');
  assert.ok(findings.some((f) => f.meta?.rule === 'private-key'));
});

test('flags a high-entropy secret-named assignment', () => {
  const findings = scanText(`const apiSecret = "9f8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d";`, 'a.ts');
  assert.ok(findings.some((f) => f.category === 'secret' && f.meta?.kind === 'high-entropy secret'));
});

test('ignores env-templated / placeholder values', () => {
  const findings = scanText(
    [
      'const apiKey = process.env.API_KEY;',
      'const token = "your-token-here";',
      'const secret = "${SECRET}";',
    ].join('\n'),
    'a.ts'
  );
  assert.strictEqual(findings.length, 0);
});
