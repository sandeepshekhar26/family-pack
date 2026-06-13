// ============================================================
// Padosi Aunty — Secrets / Leak Scanner (NEW engine)
//
// Engine: regex ruleset (gitleaks-style) + Shannon-entropy
// detection over a file walk. Fully deterministic, self-contained
// (no auk dependency). LLM's only later job is true/false-positive
// triage. The loud-aunty voice is applied at render time.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Finding, Severity } from '../../core/finding.js';
import { rankFindings, type RankOptions } from '../../core/rank.js';

interface SecretRule {
  id: string;
  kind: string;
  regex: RegExp;
  severity: Severity;
  confidence: number;
}

/** Well-known, low-false-positive secret signatures. */
const RULES: SecretRule[] = [
  { id: 'aws-access-key', kind: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/, severity: 'critical', confidence: 0.97 },
  { id: 'github-token', kind: 'GitHub token', regex: /\bghp_[0-9A-Za-z]{36}\b/, severity: 'critical', confidence: 0.97 },
  { id: 'github-pat', kind: 'GitHub fine-grained PAT', regex: /\bgithub_pat_[0-9A-Za-z_]{40,}\b/, severity: 'critical', confidence: 0.95 },
  { id: 'slack-token', kind: 'Slack token', regex: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/, severity: 'critical', confidence: 0.95 },
  { id: 'stripe-key', kind: 'Stripe secret key', regex: /\bsk_(live|test)_[0-9A-Za-z]{16,}\b/, severity: 'critical', confidence: 0.96 },
  { id: 'google-api-key', kind: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: 'critical', confidence: 0.92 },
  { id: 'openai-key', kind: 'OpenAI API key', regex: /\bsk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}\b/, severity: 'critical', confidence: 0.95 },
  { id: 'anthropic-key', kind: 'Anthropic API key', regex: /\bsk-ant-[0-9A-Za-z-]{20,}\b/, severity: 'critical', confidence: 0.95 },
  { id: 'private-key', kind: 'Private key block', regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, severity: 'critical', confidence: 0.98 },
  { id: 'jwt', kind: 'JSON Web Token', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, severity: 'warning', confidence: 0.7 },
];

/** key = "value" / key: 'value' assignments whose name smells secret. */
const ASSIGNMENT_RE =
  /\b([A-Za-z_][A-Za-z0-9_]*(?:key|token|secret|passwd|password|api[_-]?key|access[_-]?key|auth)[A-Za-z0-9_]*)\s*[:=]\s*['"]([^'"]{12,})['"]/i;

const DIR_SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', 'vendor',
  '.next', '.cache', 'out', '.turbo', '.venv', '__pycache__',
]);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
  '.tar', '.wasm', '.lock', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3',
  '.so', '.dylib', '.node', '.bin', '.map',
]);

const MAX_FILE_BYTES = 1_000_000;

/** Shannon entropy (bits/char) of a string — high for random secrets. */
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** Scan a single blob of text. `file` is only used to label evidence. */
export function scanText(text: string, file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 4000) continue; // skip minified blobs
    const lineNo = i + 1;

    // a) Known signatures.
    for (const rule of RULES) {
      if (rule.regex.test(line)) {
        findings.push({
          id: `padosi-aunty/${rule.id}/${file}:${lineNo}`,
          character: 'padosi-aunty',
          category: 'secret',
          severity: rule.severity,
          title: `${rule.kind} found in source`,
          detail: `A ${rule.kind} appears to be hard-coded here. Committed secrets are visible to anyone with repo access and in git history forever.`,
          evidence: [{ file, line: lineNo, note: rule.kind }],
          confidence: rule.confidence,
          suggestion: 'Move it to an environment variable / secret manager and rotate the exposed value.',
          meta: { kind: rule.kind, rule: rule.id },
        });
      }
    }

    // b) Secret-shaped assignments with high-entropy values.
    const m = ASSIGNMENT_RE.exec(line);
    if (m) {
      const name = m[1];
      const value = m[2];
      const entropy = shannonEntropy(value);
      const looksTemplated = /\$\{|process\.env|os\.environ|<[^>]+>|example|changeme|xxxx|your[_-]?/i.test(value);
      if (entropy >= 3.5 && !looksTemplated) {
        const confidence = Math.min(0.85, 0.3 + (entropy - 3.5) / 4);
        findings.push({
          id: `padosi-aunty/high-entropy-assignment/${file}:${lineNo}`,
          character: 'padosi-aunty',
          category: 'secret',
          severity: 'warning',
          title: `High-entropy value assigned to "${name}"`,
          detail: `"${name}" is set to a ${value.length}-char high-entropy string (entropy ${entropy.toFixed(2)} bits/char) — this looks like a hard-coded credential.`,
          evidence: [{ file, line: lineNo, note: `entropy ${entropy.toFixed(2)}` }],
          confidence,
          suggestion: 'Load it from configuration/secret storage instead of hard-coding.',
          meta: { kind: 'high-entropy secret', name, entropy: Number(entropy.toFixed(2)) },
        });
      }
    }
  }

  return findings;
}

function walk(dir: string, root: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (DIR_SKIP.has(ent.name)) continue;
      walk(full, root, out);
    } else if (ent.isFile()) {
      if (BINARY_EXT.has(path.extname(ent.name).toLowerCase())) continue;
      out.push(full);
    }
  }
}

/** Walk a directory tree and scan every text file for secrets. */
export function scanTree(root: string): Finding[] {
  const files: string[] = [];
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    files.push(root);
  } else {
    walk(root, root, files);
  }

  const findings: Finding[] = [];
  for (const file of files) {
    let text: string;
    try {
      if (fs.statSync(file).size > MAX_FILE_BYTES) continue;
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) continue; // binary
    const rel = path.relative(process.cwd(), file) || file;
    findings.push(...scanText(text, rel));
  }
  return findings;
}

/** Full vertical slice: scan a path and return ranked secret findings. */
export async function runPadosi(target: string, rank: RankOptions = {}): Promise<Finding[]> {
  const findings = scanTree(target);
  return rankFindings(findings, rank);
}
