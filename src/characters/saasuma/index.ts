// ============================================================
// Saasu Maa — Quality Gate
//
// Engine: an orchestrator over the other characters' deterministic
// findings (Bua Ji's issues + Padosi Aunty's secrets), turned into a
// pass/fail gate with configurable thresholds. Wires cleanly to a
// pre-commit hook or CI. She is never satisfied on the first try —
// that's the joke; the substance is an honest severity gate.
// ============================================================

import { runBuaji } from '../buaji/index.js';
import { runPadosi } from '../padosi-aunty/index.js';
import type { Finding } from '../../core/finding.js';
import { severityCounts } from '../../core/rank.js';

export interface GateConfig {
  /** Max critical findings allowed before the gate fails. Default 0. */
  maxCritical?: number;
  /** Max warning findings allowed. Default Infinity (warnings don't block). */
  maxWarning?: number;
  /** Any confirmed secret fails the gate outright. Default true. */
  failOnSecrets?: boolean;
}

export interface GateResult {
  passed: boolean;
  /** Verdict finding first, then every underlying reason. */
  findings: Finding[];
  counts: { critical: number; warning: number; info: number; total: number };
}

/**
 * Run the gate over a project: collect Bua Ji + Padosi Aunty findings,
 * apply the thresholds, and emit a verdict. Deterministic.
 */
export async function runSaasuma(root: string, config: GateConfig = {}): Promise<GateResult> {
  const { maxCritical = 0, maxWarning = Infinity, failOnSecrets = true } = config;

  const [issues, secrets] = await Promise.all([runBuaji(root), runPadosi(root)]);
  const reasons = [...secrets, ...issues];
  const counts = severityCounts(reasons);

  const secretCount = secrets.length;
  const reasonsToFail: string[] = [];
  if (counts.critical > maxCritical) reasonsToFail.push(`${counts.critical} critical (max ${maxCritical})`);
  if (counts.warning > maxWarning) reasonsToFail.push(`${counts.warning} warnings (max ${maxWarning})`);
  if (failOnSecrets && secretCount > 0) reasonsToFail.push(`${secretCount} exposed secret(s)`);

  const passed = reasonsToFail.length === 0;

  const verdict: Finding = {
    id: `saasuma/quality-gate/${passed ? 'pass' : 'fail'}`,
    character: 'saasuma',
    category: 'quality-gate',
    severity: passed ? 'info' : 'critical',
    title: passed ? 'Quality gate: PASS' : `Quality gate: FAIL — ${reasonsToFail.join(', ')}`,
    detail: passed
      ? `Nothing blocking: ${counts.critical} critical, ${counts.warning} warning, ${secretCount} secret(s).`
      : `Blocked by: ${reasonsToFail.join('; ')}. Fix the items below to pass.`,
    evidence: [],
    confidence: 1,
    suggestion: passed ? undefined : 'Resolve the critical issues and exposed secrets, then re-run.',
    meta: { passed, secretCount, ...counts },
  };

  return { passed, findings: [verdict, ...reasons], counts };
}
