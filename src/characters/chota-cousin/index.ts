// ============================================================
// Chhota Cousin — Edge-Case / Fuzz Tester (NEW engine)
//
// The destructive little cousin: generates inputs designed to BREAK a
// function and reports the ones that do. Real property/fuzz testing
// under the persona. Safety rails are non-negotiable:
//   - default scope = pure/unit functions,
//   - static side-effect detection skips effectful targets (opt-in only),
//   - every execution runs in an isolated child process with a hard
//     timeout and a memory cap (no real network/FS by default).
// ============================================================

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import type { Finding, Severity } from '../../core/finding.js';
import { findingScore } from '../../core/finding.js';
import { harvestSignatures, type Signature } from './signature.js';
import { generateCases, type Case, type ValueSpec } from './generate.js';

export interface FuzzOptions {
  /** Only fuzz this function (by name). */
  fn?: string;
  /** Opt in to executing effectful targets (default false → skipped). */
  unsafe?: boolean;
  /** Per-case execution timeout in ms (default 1000). */
  timeoutMs?: number;
  /** Max cases generated per function (default 60). */
  maxCases?: number;
  /** Keep at most this many findings. */
  topN?: number;
}

// Static side-effect signals — if a body matches, we do NOT auto-execute it.
const SIDE_EFFECT_RE =
  /\bfetch\s*\(|\bfs\.|\brequire\s*\(|\bprocess\.(?!env\b)|child_process|\bexec(Sync)?\s*\(|\bspawn\s*\(|\.query\s*\(|\baxios\b|https?:\/\/|writeFile|readFile|\bunlink\b|new\s+Database|\.connect\s*\(/;

// The sandbox runner, materialised to a temp .mjs file at runtime. It
// imports the target, builds args from value-specs, calls the function,
// and prints a one-line JSON verdict. Kept dependency-free on purpose.
const RUNNER_SRC = `
import { pathToFileURL } from 'node:url';
function decode(s) {
  switch (s.t) {
    case 'lit': return s.v;
    case 'undef': return undefined;
    case 'nan': return NaN;
    case 'pinf': return Infinity;
    case 'ninf': return -Infinity;
    case 'negzero': return -0;
    case 'bigstr': return 'a'.repeat(s.n);
    case 'unicode': return '𝕏🙂\\u202Eabc\\u0000';
    case 'bigarr': return new Array(s.n).fill(0);
    case 'holes': return new Array(s.n);
    case 'circular': { const o = {}; o.self = o; return o; }
    case 'nullproto': return Object.create(null);
    default: return undefined;
  }
}
function out(v) { process.stdout.write(JSON.stringify(v)); }
const [target, fnName, specsJson] = process.argv.slice(2);
let mod;
try { mod = await import(pathToFileURL(target).href); }
catch (e) { out({ status: 'loaderror', message: String(e && e.message || e) }); process.exit(0); }
const fn = mod[fnName] ?? (mod.default && mod.default[fnName]);
if (typeof fn !== 'function') { out({ status: 'nofn' }); process.exit(0); }
const args = JSON.parse(specsJson).map(decode);
try {
  const r = fn(...args);
  if (r && typeof r.then === 'function') {
    try { await r; out({ status: 'ok' }); }
    catch (e) { out({ status: 'reject', name: e && e.name, message: String(e && e.message || e) }); }
  } else { out({ status: 'ok' }); }
} catch (e) {
  out({ status: 'throw', name: e && e.name, message: String(e && e.message || e) });
}
process.exit(0);
`;

let runnerPath: string | null = null;
function ensureRunner(): string {
  if (runnerPath && fs.existsSync(runnerPath)) return runnerPath;
  const p = path.join(os.tmpdir(), `family-pack-cousin-${process.pid}.mjs`);
  fs.writeFileSync(p, RUNNER_SRC);
  runnerPath = p;
  return p;
}

type RunStatus = 'ok' | 'throw' | 'reject' | 'timeout' | 'crash' | 'loaderror' | 'nofn';
interface RunResult {
  status: RunStatus;
  name?: string;
  message?: string;
}

function runCase(targetFile: string, fnName: string, specs: ValueSpec[], isTs: boolean, timeoutMs: number): RunResult {
  const nodeArgs = [
    '--no-warnings',
    '--max-old-space-size=128',
    ...(isTs ? ['--experimental-strip-types'] : []),
    ensureRunner(),
    targetFile,
    fnName,
    JSON.stringify(specs),
  ];
  const res = spawnSync(process.execPath, nodeArgs, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
  if (res.error && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') return { status: 'timeout' };
  if (res.signal === 'SIGTERM') return { status: 'timeout' };
  const stdout = (res.stdout?.toString() || '').trim();
  if (stdout) {
    try {
      const parsed = JSON.parse(stdout) as RunResult;
      return parsed;
    } catch {
      /* fall through to crash */
    }
  }
  if (res.status !== 0) return { status: 'crash', message: (res.stderr?.toString() || '').slice(0, 200) };
  return { status: 'ok' };
}

const FAIL_STATUSES = new Set<RunStatus>(['throw', 'reject', 'timeout', 'crash']);

/** Shrink huge inputs to the smallest size that still reproduces the failure. */
function shrink(targetFile: string, fnName: string, c: Case, isTs: boolean, timeoutMs: number): { specs: ValueSpec[]; label: string } {
  const spec = c.specs[c.paramIndex];
  if (!spec || (spec.t !== 'bigstr' && spec.t !== 'bigarr')) return { specs: c.specs, label: c.label };
  let n = spec.n;
  let best = n;
  while (n > 1) {
    const half = Math.floor(n / 2);
    const trial = c.specs.slice();
    trial[c.paramIndex] = { ...spec, n: half } as ValueSpec;
    const r = runCase(targetFile, fnName, trial, isTs, timeoutMs);
    if (FAIL_STATUSES.has(r.status)) {
      best = half;
      n = half;
    } else break;
  }
  const specs = c.specs.slice();
  specs[c.paramIndex] = { ...spec, n: best } as ValueSpec;
  const unit = spec.t === 'bigstr' ? 'char string' : 'element array';
  return { specs, label: c.label.replace(/=.*/, `=${best}-${unit} (minimised)`) };
}

const SEVERITY_BY_STATUS: Record<string, Severity> = {
  throw: 'warning',
  reject: 'warning',
  timeout: 'critical',
  crash: 'critical',
  skipped: 'info',
  loaderror: 'info',
};

const KIND_LABEL: Record<string, string> = {
  throw: 'unhandled exception',
  reject: 'unhandled promise rejection',
  timeout: 'timeout (possible infinite loop)',
  crash: 'process crash (likely OOM)',
};

/** Fuzz the functions in a single source file. */
export function fuzzFile(filePath: string, opts: FuzzOptions = {}): Finding[] {
  const { unsafe = false, timeoutMs = 1000, maxCases = 60 } = opts;
  const src = fs.readFileSync(filePath, 'utf-8');
  const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.mts');
  const rel = path.relative(process.cwd(), filePath) || filePath;
  const abs = path.resolve(filePath);

  let sigs = harvestSignatures(src);
  if (opts.fn) sigs = sigs.filter((s) => s.name === opts.fn);

  const findings: Finding[] = [];

  for (const sig of sigs) {
    // Safety rail: effectful targets are skipped unless opted in.
    if (!unsafe && SIDE_EFFECT_RE.test(sig.body)) {
      findings.push(skippedFinding(sig, rel));
      continue;
    }

    const cases = generateCases(sig.params, maxCases);
    const seen = new Set<string>(); // dedupe by paramIndex + status
    for (const c of cases) {
      const r = runCase(abs, sig.name, c.specs, isTs, timeoutMs);
      if (r.status === 'loaderror') {
        findings.push(loadErrorFinding(sig, rel, r.message));
        break; // module won't load — no point trying more cases
      }
      if (r.status === 'nofn' || r.status === 'ok') continue;
      if (!FAIL_STATUSES.has(r.status)) continue;

      const key = `${c.paramIndex}:${r.status}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const shrunk = shrink(abs, sig.name, c, isTs, timeoutMs);
      findings.push(failureFinding(sig, rel, r, shrunk.label));
    }
  }

  let ranked = findings.sort((a, b) => findingScore(b) - findingScore(a));
  if (opts.topN != null) ranked = ranked.slice(0, opts.topN);
  return ranked;
}

function skippedFinding(sig: Signature, file: string): Finding {
  return {
    id: `chota-cousin/skipped/${file}-${sig.name}`,
    character: 'chota-cousin',
    category: 'fuzz',
    severity: 'info',
    title: `${sig.name}() skipped — has side effects (needs manual opt-in)`,
    detail: `${sig.name}() touches I/O, the filesystem, the network, a process, or a DB. Chhota Cousin will not auto-execute effectful code. Re-run with --unsafe to fuzz it deliberately.`,
    evidence: [{ file, line: sig.line, note: 'effectful target' }],
    confidence: 0.9,
    suggestion: 'Extract the pure logic into a separate function, or opt in with --unsafe.',
    meta: { failureKind: 'skipped', fn: sig.name },
  };
}

function loadErrorFinding(sig: Signature, file: string, message?: string): Finding {
  return {
    id: `chota-cousin/loaderror/${file}-${sig.name}`,
    character: 'chota-cousin',
    category: 'fuzz',
    severity: 'info',
    title: `Could not load ${file} to fuzz ${sig.name}() — static analysis only`,
    detail: `The module failed to import in the sandbox (${message || 'unknown error'}). Chhota Cousin fuzzes self-contained units best; targets with unresolved local imports can't be executed.`,
    evidence: [{ file, line: sig.line }],
    confidence: 0.5,
    meta: { failureKind: 'loaderror', fn: sig.name },
  };
}

function failureFinding(sig: Signature, file: string, r: RunResult, inputLabel: string): Finding {
  const kind = r.status;
  return {
    id: `chota-cousin/${kind}/${file}-${sig.name}-${inputLabel}`,
    character: 'chota-cousin',
    category: 'fuzz',
    severity: SEVERITY_BY_STATUS[kind] ?? 'warning',
    title: `${sig.name}() — ${KIND_LABEL[kind] ?? kind} on input ${inputLabel}`,
    detail:
      `Calling ${sig.name}() with ${inputLabel} caused a ${KIND_LABEL[kind] ?? kind}` +
      (r.name || r.message ? `: ${[r.name, r.message].filter(Boolean).join(' — ')}` : '') +
      `. The minimised input above reproduces it.`,
    evidence: [{ file, line: sig.line, note: inputLabel }],
    confidence: kind === 'throw' || kind === 'reject' ? 0.8 : 0.7,
    suggestion: 'Add a guard / validation for this input shape, or narrow the parameter type.',
    meta: { failureKind: kind, fn: sig.name, input: inputLabel, error: r.message },
  };
}

/** Full vertical slice: fuzz a file (or every .ts/.js file under a dir). */
export async function runChotaCousin(target: string, opts: FuzzOptions = {}): Promise<Finding[]> {
  const stat = fs.statSync(target);
  const files: string[] = [];
  if (stat.isFile()) files.push(target);
  else collectSourceFiles(target, files);

  const all: Finding[] = [];
  for (const f of files) all.push(...fuzzFile(f, opts));

  let ranked = all.sort((a, b) => findingScore(b) - findingScore(a));
  if (opts.topN != null) ranked = ranked.slice(0, opts.topN);
  return ranked;
}

const SRC_EXT = new Set(['.ts', '.js', '.mjs', '.mts']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.family-pack', '.auk']);

function collectSourceFiles(dir: string, out: string[]): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIR.has(ent.name)) collectSourceFiles(path.join(dir, ent.name), out);
    } else if (SRC_EXT.has(path.extname(ent.name)) && !ent.name.endsWith('.d.ts') && !ent.name.endsWith('.test.ts')) {
      out.push(path.join(dir, ent.name));
    }
  }
}
