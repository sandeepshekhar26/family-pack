// ============================================================
// Family Pack — Stage 3: LLM NARRATION (prompt-batch emitter)
//
// Inherits auk's no-API-key pattern: instead of calling an LLM
// ourselves, we EMIT a prompt batch that the user's own agent
// (Claude Code) processes. No API keys, no cost, no privacy issue.
// The CLI MAY optionally use a direct API key for standalone use,
// but the Claude Code surface always routes through the agent.
//
// Chacha Ji (the token guardian) wraps this module to estimate and
// gate cost BEFORE a batch is ever sent.
// ============================================================

import type { Finding } from './finding.js';

export interface PromptItem {
  id: string;
  title: string;
  detail: string;
  evidence: Array<{ file: string; line?: number }>;
  suggestion?: string;
}

export interface PromptBatch {
  version: 1;
  character: string;
  createdAt: string;
  /** The system-style instruction the agent should follow per item. */
  instructions: string;
  items: PromptItem[];
}

/**
 * Rough token estimate. Deterministic and provider-agnostic: ~4 chars
 * per token is the standard heuristic. Chacha Ji uses this for budgeting.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Build a no-API-key prompt batch from ranked findings (Stage 2 output). */
export function buildPromptBatch(
  character: string,
  findings: Finding[],
  instructions: string,
  now: Date = new Date()
): PromptBatch {
  return {
    version: 1,
    character,
    createdAt: now.toISOString(),
    instructions,
    items: findings.map((f) => ({
      id: f.id,
      title: f.title,
      detail: f.detail,
      evidence: f.evidence.map((e) => ({ file: e.file, line: e.line })),
      suggestion: f.suggestion,
    })),
  };
}

/** Render a batch to the plain-text prompt an agent would receive. */
export function promptBatchText(batch: PromptBatch): string {
  const lines: string[] = [];
  lines.push(batch.instructions.trim());
  lines.push('');
  for (const item of batch.items) {
    const where = item.evidence
      .map((e) => (e.line != null ? `${e.file}:${e.line}` : e.file))
      .join(', ');
    lines.push(`### ${item.id}`);
    lines.push(`Finding: ${item.title}`);
    lines.push(`Where: ${where}`);
    lines.push(`Context: ${item.detail}`);
    if (item.suggestion) lines.push(`Current hint: ${item.suggestion}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Total estimated token cost of sending this batch to an LLM. */
export function estimateBatchTokens(batch: PromptBatch): number {
  return estimateTokens(promptBatchText(batch));
}
