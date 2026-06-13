// ============================================================
// Sharma Ji Ka Beta — Benchmarker ("idiomatic vs yours")
//
// Engine: auk's TF-IDF structural clustering, re-run over the parsed
// files. Each cluster is a "family" of structurally similar files that
// share a set of imports (the idiomatic recipe). A file that belongs to
// a family but skips the family's shared imports is deviating from the
// idiomatic shape the codebase already established. That's the benchmark
// — your code vs the idiomatic shape of your OWN codebase, no external
// style guide. The "Sharma ji ka beta does it better" voice is a skin.
// ============================================================

import { TfidfProvider } from 'auk-develop';
import { analyze } from '../../core/auk-adapter.js';
import type { ProjectAnalysis } from '../../core/auk-adapter.js';
import type { Finding } from '../../core/finding.js';
import { rankFindings, type RankOptions } from '../../core/rank.js';

/** A shared import is "idiomatic" when this fraction of the family uses it. */
const SHARED_THRESHOLD = 0.6;

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** Compare each file to the idiomatic shape of its structural cluster. */
export function benchmark(analysis: ProjectAnalysis): Finding[] {
  const tf = new TfidfProvider();
  tf.index(analysis.parsedFiles);
  const clusters = tf.clusters(4);

  const byPath = new Map(analysis.parsedFiles.map((pf) => [pf.entry.path, pf]));
  const findings: Finding[] = [];

  for (const cluster of clusters) {
    const members = cluster.files
      .map((f) => byPath.get(f))
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (members.length < 4) continue;

    // Which imports does the family share?
    const importCounts = new Map<string, number>();
    for (const m of members) {
      for (const src of new Set(m.imports.map((i) => i.source))) {
        importCounts.set(src, (importCounts.get(src) ?? 0) + 1);
      }
    }
    const sharedImports = [...importCounts.entries()]
      .filter(([, c]) => c >= members.length * SHARED_THRESHOLD)
      .map(([src]) => src)
      .sort();
    if (sharedImports.length === 0) continue;

    // Which members break the family recipe?
    for (const m of members) {
      const own = new Set(m.imports.map((i) => i.source));
      const missing = sharedImports.filter((src) => !own.has(src));
      if (missing.length === 0) continue;
      // Only flag a real deviation: skipping at least half of the shared recipe.
      if (missing.length < Math.ceil(sharedImports.length / 2)) continue;

      const confidence = Math.min(0.8, 0.4 + cluster.cohesion * 0.5);
      findings.push({
        id: `sharma-beta/idiomatic-drift/${slug(m.entry.path)}`,
        character: 'sharma-beta',
        category: 'idiomatic-drift',
        severity: missing.length === sharedImports.length ? 'warning' : 'info',
        title: `${m.entry.path} drifts from the "${cluster.label}" family shape`,
        detail:
          `${m.entry.path} clusters with ${members.length} structurally similar files ` +
          `(key terms: ${cluster.topTerms.slice(0, 4).join(', ')}), but skips imports the ` +
          `family treats as idiomatic: ${missing.join(', ')}. The codebase already has an ` +
          `idiomatic shape for this kind of file — this one diverges.`,
        evidence: [{ file: m.entry.path, note: `missing: ${missing.join(', ')}` }],
        confidence,
        suggestion: `Align with the family: it conventionally imports ${sharedImports.join(', ')}.`,
        meta: { cluster: cluster.label, missing, sharedImports, cohesion: cluster.cohesion },
      });
    }
  }

  return findings;
}

/** Full vertical slice: analyze a project and return ranked drift findings. */
export async function runSharmaBeta(root: string, rank: RankOptions = {}): Promise<Finding[]> {
  const analysis = await analyze(root);
  return rankFindings(benchmark(analysis), rank);
}
