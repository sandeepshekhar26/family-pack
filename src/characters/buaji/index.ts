// ============================================================
// Bua Ji — Issue Finder
//
// Engine: auk `review` signals + convention miners (god classes,
// hotspots, import cycles, long functions, convention violations).
// Stage 1 is 100% deterministic; we only emit persona-free Findings.
// The nagging-aunty voice is applied later in personas/voice.ts.
// ============================================================

import { analyze } from '../../core/auk-adapter.js';
import type { ProjectAnalysis } from '../../core/auk-adapter.js';
import type { Finding } from '../../core/finding.js';
import { rankFindings, type RankOptions } from '../../core/rank.js';

/** Functions longer than this (in body lines) get flagged. */
const LONG_FN_LINES = 52;

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** Turn one deterministic auk analysis into Bua Ji's persona-free findings. */
export function findIssues(analysis: ProjectAnalysis): Finding[] {
  const findings: Finding[] = [];

  // 1. God objects — high confidence, high severity.
  for (const g of analysis.godClasses) {
    findings.push({
      id: `buaji/god-object/${slug(g.cls.id)}`,
      character: 'buaji',
      category: 'god-object',
      severity: 'critical',
      title: `${g.cls.name} is a god object (${g.methodCount} methods, ${g.totalFanIn} inbound calls)`,
      detail:
        `${g.cls.name} concentrates too much responsibility: ${g.methodCount} methods and ` +
        `${g.totalFanIn} inbound calls. Changes here ripple widely and it is hard to test.`,
      evidence: [{ file: g.cls.file, line: g.cls.line, note: `${g.methodCount} methods` }],
      confidence: 0.9,
      suggestion: 'Split it into smaller, single-responsibility units.',
      meta: { methodCount: g.methodCount, totalFanIn: g.totalFanIn },
    });
  }

  // 2. Import cycles — circular dependencies.
  for (const cycle of analysis.cycles) {
    if (cycle.length === 0) continue;
    findings.push({
      id: `buaji/circular-dependency/${slug(cycle.join('->'))}`,
      character: 'buaji',
      category: 'circular-dependency',
      severity: 'warning',
      title: `Circular dependency across ${cycle.length} files`,
      detail: `These files import each other in a loop: ${cycle.join(' → ')}. Cycles make the build order fragile and modules impossible to reason about in isolation.`,
      evidence: cycle.map((file) => ({ file })),
      confidence: 0.8,
      suggestion: 'Break the loop by extracting the shared piece into a third module.',
      meta: { cycleLength: cycle.length },
    });
  }

  // 3. Long functions — from tree-sitter body spans.
  for (const pf of analysis.parsedFiles) {
    for (const sym of pf.symbols) {
      if (sym.type !== 'function' && sym.type !== 'method') continue;
      const body = sym.bodySize ?? 0;
      if (body <= LONG_FN_LINES) continue;
      // Confidence scales with how far over the line it is, capped at 0.85.
      const confidence = Math.min(0.85, 0.4 + (body - LONG_FN_LINES) / 200);
      findings.push({
        id: `buaji/long-function/${slug(pf.entry.path)}-${slug(sym.name)}-${sym.line}`,
        character: 'buaji',
        category: 'long-function',
        severity: body > LONG_FN_LINES * 2 ? 'warning' : 'info',
        title: `${sym.name}() is ${body} lines long`,
        detail: `${sym.name}() spans ${body} lines — above the ${LONG_FN_LINES}-line house style. Long functions hide multiple responsibilities and are hard to test.`,
        evidence: [{ file: pf.entry.path, line: sym.line, note: `${body} lines` }],
        confidence,
        suggestion: 'Extract helpers instead of growing the body.',
        meta: { bodySize: body },
      });
    }
  }

  // 4. Hotspots — high blast-radius symbols.
  for (const h of analysis.hotspots) {
    findings.push({
      id: `buaji/hotspot/${slug(h.id)}`,
      character: 'buaji',
      category: 'hotspot',
      severity: 'info',
      title: `${h.name}() is a hotspot (${h.metrics.fanIn} inbound calls)`,
      detail: `${h.name}() is called from ${h.metrics.fanIn} places — high blast radius. Keep its signature and behavior stable.`,
      evidence: [{ file: h.file, line: h.line, note: `fan-in ${h.metrics.fanIn}` }],
      confidence: 0.6,
      meta: { fanIn: h.metrics.fanIn },
    });
  }

  // 5. Convention violations — files that break a strong mined convention.
  for (const p of analysis.patterns) {
    if (p.prevalence < 0.8 || p.counterExamples.length === 0) continue;
    for (const ce of p.counterExamples.slice(0, 5)) {
      findings.push({
        id: `buaji/convention-violation/${slug(p.id)}-${slug(ce.file)}`,
        character: 'buaji',
        category: 'convention-violation',
        severity: 'info',
        title: `Breaks convention "${p.name}"`,
        detail: `${ce.note || p.description} (${Math.round(p.prevalence * 100)}% of the codebase follows "${p.name}").`,
        evidence: [{ file: ce.file, line: ce.line, note: ce.note }],
        confidence: Math.min(0.7, p.prevalence),
        meta: { patternId: p.id, prevalence: p.prevalence },
      });
    }
  }

  return findings;
}

/** Full vertical slice: analyze a project and return ranked findings. */
export async function runBuaji(root: string, rank: RankOptions = {}): Promise<Finding[]> {
  const analysis = await analyze(root);
  const findings = findIssues(analysis);
  return rankFindings(findings, rank);
}
