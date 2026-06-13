// ============================================================
// Family Pack — auk adapter (Stage 1 entry point)
//
// A thin wrapper around auk's exported deterministic engine.
// We consume auk as an npm dependency (`auk-develop`) — we never
// fork it, copy it, or touch its verification core. Everything
// here is a re-export or a tiny convenience over auk's library API.
// ============================================================

import { analyzeProject } from 'auk-develop';
import type { ProjectAnalysis } from 'auk-develop';

export type { ProjectAnalysis } from 'auk-develop';
export type {
  Rule,
  RuleEvidence,
  DetectedPattern,
  SymbolNode,
  ParsedFile,
  ExtractedSymbol,
} from 'auk-develop';

/**
 * Run auk's full deterministic pass on a project, in-process, with no
 * file writes. Returns scanned files, parsed symbols, the import + call
 * graph, mined conventions, import cycles, god-object candidates and
 * hotspots — the raw material every character ranks and narrates.
 */
export async function analyze(root: string): Promise<ProjectAnalysis> {
  return analyzeProject(root);
}
