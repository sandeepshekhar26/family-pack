// ============================================================
// Family Pack — CLI
//
//   npx family-pack <character> [path] [flags]
//
// characters: buaji | padosi | chachaji | family
// flags:
//   --professional   strip persona, clean technical output
//   --json           machine-readable JSON
//   --top <n>        keep only the top-N findings
//   --budget <n>     Chacha Ji token budget (default 50000)
//   --ci             exit 1 if any critical finding is present
// ============================================================

import type { CharacterId, Finding } from '../core/finding.js';
import { severityCounts } from '../core/rank.js';
import { buildPromptBatch } from '../core/llm-pass.js';
import { runBuaji } from '../characters/buaji/index.js';
import { runPadosi } from '../characters/padosi-aunty/index.js';
import { runChachaji } from '../characters/chachaji/index.js';
import { render } from '../personas/voice.js';

interface CliOptions {
  professional: boolean;
  json: boolean;
  top?: number;
  budget: number;
  ci: boolean;
}

const HELP = `family-pack — desi family code-analysis agents (built on auk)

Usage:
  family-pack <character> [path] [flags]

Characters:
  buaji      Issue finder    — god objects, cycles, long functions, conventions
  padosi     Secrets scanner — API keys, tokens, high-entropy leaks
  chachaji   Cost guardian   — token budget for the LLM pass
  family     Run the starter trio (buaji + padosi + chachaji)

Flags:
  --professional   Strip persona; clean technical output
  --json           Machine-readable JSON
  --top <n>        Keep only the top-N findings
  --budget <n>     Chacha Ji token budget (default 50000)
  --ci             Exit 1 if any critical finding is present
  -h, --help       Show this help
`;

function parseArgs(argv: string[]): { character?: string; target: string; opts: CliOptions } {
  const opts: CliOptions = { professional: false, json: false, budget: 50_000, ci: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--professional') opts.professional = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--ci') opts.ci = true;
    else if (a === '--top') opts.top = Number(argv[++i]);
    else if (a === '--budget') opts.budget = Number(argv[++i]);
    else if (a === '-h' || a === '--help') positional.push('--help');
    else positional.push(a);
  }
  return { character: positional[0], target: positional[1] ?? '.', opts };
}

async function runCharacter(
  character: CharacterId,
  target: string,
  opts: CliOptions
): Promise<Finding[]> {
  const rank = { topN: opts.top };
  if (character === 'buaji') return runBuaji(target, rank);
  if (character === 'padosi-aunty') return runPadosi(target, rank);
  if (character === 'chachaji') {
    // Demonstrate the pre-LLM-call hook: price the enhance pass Bua Ji would
    // trigger over `target` against the budget.
    const buaji = await runBuaji(target, { topN: opts.top ?? 10 });
    const batch = buildPromptBatch(
      'buaji',
      buaji,
      'Explain why each finding matters and propose a fix.'
    );
    return runChachaji(target, [batch], opts.budget);
  }
  throw new Error(`Unknown character "${character}"`);
}

const ALIASES: Record<string, CharacterId> = {
  buaji: 'buaji',
  bua: 'buaji',
  padosi: 'padosi-aunty',
  'padosi-aunty': 'padosi-aunty',
  aunty: 'padosi-aunty',
  chachaji: 'chachaji',
  chacha: 'chachaji',
};

async function main(): Promise<void> {
  const { character, target, opts } = parseArgs(process.argv.slice(2));

  if (!character || character === '--help') {
    process.stdout.write(HELP);
    process.exit(character ? 0 : 1);
  }

  const order: CharacterId[] = character === 'family'
    ? ['buaji', 'padosi-aunty', 'chachaji']
    : ALIASES[character]
      ? [ALIASES[character]]
      : [];

  if (order.length === 0) {
    process.stderr.write(`Unknown character "${character}".\n\n${HELP}`);
    process.exit(1);
  }

  let anyCritical = false;
  const blocks: string[] = [];
  for (const id of order) {
    const findings = await runCharacter(id, target, opts);
    if (findings.some((f) => f.severity === 'critical')) anyCritical = true;
    blocks.push(render(id, findings, { professional: opts.professional, json: opts.json }));
  }

  process.stdout.write(blocks.join(opts.json ? '\n' : '\n\n────────────────────────\n\n') + '\n');

  if (opts.ci && anyCritical) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`family-pack error: ${err?.message ?? err}\n`);
  process.exit(1);
});
