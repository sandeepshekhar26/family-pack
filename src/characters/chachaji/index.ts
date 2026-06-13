// ============================================================
// Chacha Ji — Token & Cost Guardian (NEW)
//
// Engine: pure deterministic accounting. Before any LLM/enhance
// call, estimate its token cost, record it in a local ledger, and
// warn/block when a configurable budget is exceeded. He runs as a
// pre-call hook around core/llm-pass.ts. Barely any LLM itself.
// The miser voice ("Paisa ped pe ugta hai kya?") is render-time.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Finding } from '../../core/finding.js';
import { estimateBatchTokens, type PromptBatch } from '../../core/llm-pass.js';

export interface LedgerEntry {
  at: string;
  character: string;
  label: string;
  tokens: number;
}

export interface Ledger {
  /** Token budget for the period. */
  budget: number;
  /** Tokens already spent. */
  spent: number;
  entries: LedgerEntry[];
}

const DEFAULT_BUDGET = 50_000;
const LEDGER_FILE = path.join('.family-pack', 'ledger.json');

export function emptyLedger(budget: number = DEFAULT_BUDGET): Ledger {
  return { budget, spent: 0, entries: [] };
}

/** Load the ledger for a project, or start a fresh one. */
export function loadLedger(root: string, budget: number = DEFAULT_BUDGET): Ledger {
  const file = path.join(root, LEDGER_FILE);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Ledger;
    // Allow the caller to override the budget at load time.
    return { ...raw, budget: budget ?? raw.budget };
  } catch {
    return emptyLedger(budget);
  }
}

/** Persist the ledger under <root>/.family-pack/ledger.json. */
export function saveLedger(root: string, ledger: Ledger): void {
  const file = path.join(root, LEDGER_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2));
}

export interface GuardResult {
  allowed: boolean;
  estimatedTokens: number;
  spent: number;
  budget: number;
  remaining: number;
  /** A persona-free finding describing the cost verdict. */
  finding: Finding;
}

/**
 * Estimate the cost of sending a prompt batch and decide whether it fits
 * the remaining budget. Pure: does NOT mutate the ledger (call `record`
 * to commit). This is the pre-LLM-call hook.
 */
export function guard(batch: PromptBatch, ledger: Ledger, now: Date = new Date()): GuardResult {
  const estimatedTokens = estimateBatchTokens(batch);
  const projected = ledger.spent + estimatedTokens;
  const remaining = ledger.budget - ledger.spent;
  const allowed = projected <= ledger.budget;

  const severity = allowed
    ? estimatedTokens > remaining * 0.5
      ? 'warning'
      : 'info'
    : 'critical';

  const finding: Finding = {
    id: `chachaji/budget/${batch.character}-${now.getTime()}`,
    character: 'chachaji',
    category: 'cost',
    severity,
    title: allowed
      ? `LLM pass for "${batch.character}" fits budget (~${estimatedTokens} tokens)`
      : `LLM pass for "${batch.character}" exceeds budget by ${projected - ledger.budget} tokens`,
    detail:
      `Estimated ${estimatedTokens} tokens for ${batch.items.length} item(s). ` +
      `Spent ${ledger.spent}/${ledger.budget}, remaining ${remaining}. ` +
      (allowed ? 'Within budget.' : 'Blocked — over budget.'),
    evidence: [],
    confidence: 1,
    suggestion: allowed
      ? undefined
      : 'Lower top-N in ranking, raise the budget, or skip the LLM pass for low-severity findings.',
    meta: { estimatedTokens, spent: ledger.spent, budget: ledger.budget, items: batch.items.length },
  };

  return { allowed, estimatedTokens, spent: ledger.spent, budget: ledger.budget, remaining, finding };
}

/** Commit a spend to the ledger (returns a new ledger; pure). */
export function record(
  ledger: Ledger,
  character: string,
  label: string,
  tokens: number,
  now: Date = new Date()
): Ledger {
  return {
    ...ledger,
    spent: ledger.spent + tokens,
    entries: [...ledger.entries, { at: now.toISOString(), character, label, tokens }],
  };
}

/**
 * Full vertical slice: given the prompt batches the OTHER characters would
 * send, report Chacha Ji's cost verdict for each against the budget.
 */
export async function runChachaji(
  root: string,
  batches: PromptBatch[],
  budget: number = DEFAULT_BUDGET
): Promise<Finding[]> {
  let ledger = loadLedger(root, budget);
  const findings: Finding[] = [];
  for (const batch of batches) {
    const result = guard(batch, ledger);
    findings.push(result.finding);
    if (result.allowed) {
      ledger = record(ledger, batch.character, `enhance:${batch.items.length}`, result.estimatedTokens);
    }
  }
  return findings;
}
