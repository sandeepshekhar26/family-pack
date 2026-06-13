// ============================================================
// Family Pack — library entry point
//
// A cast of desi family-member code-analysis agents built on auk's
// deterministic engine. Persona is a render skin; the substance is
// real static analysis. Importing this module has no side effects.
// ============================================================

// Core (foundation)
export * from './core/finding.js';
export * from './core/rank.js';
export * from './core/llm-pass.js';
export { analyze } from './core/auk-adapter.js';
export type { ProjectAnalysis } from './core/auk-adapter.js';

// Characters (the launch trio)
export { runBuaji, findIssues } from './characters/buaji/index.js';
export {
  runPadosi,
  scanText,
  scanTree,
  shannonEntropy,
} from './characters/padosi-aunty/index.js';
export {
  runChachaji,
  guard,
  record,
  loadLedger,
  saveLedger,
  emptyLedger,
} from './characters/chachaji/index.js';
export type { Ledger, LedgerEntry, GuardResult } from './characters/chachaji/index.js';

// Characters (the rest of the family)
export { runSaasuma } from './characters/saasuma/index.js';
export type { GateConfig, GateResult } from './characters/saasuma/index.js';
export { runSharmaBeta, benchmark } from './characters/sharma-beta/index.js';
export { runChotaCousin, fuzzFile } from './characters/chota-cousin/index.js';
export type { FuzzOptions } from './characters/chota-cousin/index.js';
export { harvestSignatures } from './characters/chota-cousin/signature.js';
export { generateCases, candidatesFor } from './characters/chota-cousin/generate.js';

// Persona render layer
export { render } from './personas/voice.js';
export type { RenderOptions } from './personas/voice.js';
export { getTemplate } from './personas/templates/index.js';
