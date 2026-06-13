// ============================================================
// Family Pack — Stage 2: FILTER + RANK (no LLM, cheap)
//
// This is the cost-control choke point. It dedupes findings,
// scores them by severity × confidence, and picks the top-N.
// Only what survives here is ever shown to the LLM (Stage 3),
// so keeping N small keeps cost down. Chacha Ji lives next door.
// ============================================================

import type { Finding } from './finding.js';
import { findingScore } from './finding.js';

export interface RankOptions {
  /** Keep at most this many findings (after dedupe + sort). */
  topN?: number;
  /** Drop findings below this confidence (0..1). Default 0. */
  minConfidence?: number;
}

/** Dedupe key: same character + category + primary evidence location. */
function dedupeKey(f: Finding): string {
  const e = f.evidence[0];
  return `${f.character}|${f.category}|${e?.file ?? ''}:${e?.line ?? ''}`;
}

/**
 * Dedupe, filter by confidence, sort by score (desc), and slice to topN.
 * Deterministic: ties broken by id so output order is stable.
 */
export function rankFindings(findings: Finding[], opts: RankOptions = {}): Finding[] {
  const { topN, minConfidence = 0 } = opts;

  const byKey = new Map<string, Finding>();
  for (const f of findings) {
    const key = dedupeKey(f);
    const existing = byKey.get(key);
    if (!existing || findingScore(f) > findingScore(existing)) {
      byKey.set(key, f);
    }
  }

  let ranked = [...byKey.values()].filter((f) => f.confidence >= minConfidence);

  ranked.sort((a, b) => {
    const ds = findingScore(b) - findingScore(a);
    if (ds !== 0) return ds;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  if (topN != null && topN >= 0) ranked = ranked.slice(0, topN);
  return ranked;
}

/** Summary counts by severity — handy for gates and headers. */
export function severityCounts(findings: Finding[]): {
  critical: number;
  warning: number;
  info: number;
  total: number;
} {
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === 'critical') critical++;
    else if (f.severity === 'warning') warning++;
    else info++;
  }
  return { critical, warning, info, total: findings.length };
}
