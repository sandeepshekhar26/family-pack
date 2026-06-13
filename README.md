# Family Pack 👨‍👩‍👧‍👦

A cast of desi family-member code-analysis agents, built **on top of**
[`auk`](https://github.com/sandeepshekhar26/develop-anything)'s deterministic
engine. Each "agent" wraps a real static-analysis engine. The Hinglish
personality is a **render skin only** — the substance is deterministic static
analysis plus an optional, no-API-key LLM pass.

> Family Pack is separate from auk. auk stays serious; Family Pack is the
> playful product built on auk's engine. auk is consumed as an npm dependency
> (`auk-develop`) — never forked, never copy-pasted.

## How it works — three-stage pipeline

```
Stage 1  DETERMINISTIC SCAN   (no LLM, free)   → Finding[]  (file:line + confidence)
Stage 2  FILTER + RANK        (no LLM, cheap)  → dedupe, severity score, top-N
Stage 3  LLM NARRATION        (LLM, top-N only) → why + fix + persona voice
```

Findings are **plain structured data** (`evidence`, `confidence`, `severity`,
aligned with auk's rule shape). The persona is applied only at render time.
`--professional` strips every persona and returns clean technical output — a
hard requirement, not a nice-to-have.

Stage 3 inherits auk's no-API-key pattern: instead of calling an LLM, Family
Pack emits a prompt batch the user's own agent (Claude Code) processes.

## Install

```bash
npm install family-pack       # library + CLI
# requires auk-develop >= 1.2.0 (the library entry point)
```

## Claude Code plugin (primary surface)

Install the plugin from this repo's marketplace, then call the family by name:

```text
/plugin marketplace add sandeepshekhar26/family-pack
/plugin install family-pack@family-pack
```

Then in any project:

```text
/family-pack:buaji      [path] [--professional]   # issue finder
/family-pack:padosi     [path] [--professional]   # secrets scanner
/family-pack:chachaji   [path] [--budget <n>]     # cost guardian
/family-pack:family     [path] [--professional]   # the starter trio
```

If a command doesn't appear after install, run `/reload-plugins`.

Each command runs the deterministic engine (Stage 1/2) via the `family-pack`
CLI, then **your own Claude Code agent** does the Stage 3 narration — explaining
why each finding matters and proposing a concrete fix, in the character's voice.
No API keys, exactly like auk's enhance loop. `--professional` strips the
persona for clean technical output.

## CLI

```bash
npx family-pack <character> [path] [flags]
```

| Character  | Alias    | What it does                                                |
|------------|----------|-------------------------------------------------------------|
| `buaji`    | `bua`    | Issue finder — god objects, cycles, long functions, conventions |
| `padosi`   | `aunty`  | Secrets scanner — API keys, tokens, high-entropy leaks      |
| `chachaji` | `chacha` | Cost guardian — token budget for the LLM pass               |
| `family`   |          | Run the starter trio (Bua Ji + Padosi Aunty + Chacha Ji)    |

Flags: `--professional` (strip persona), `--json`, `--top <n>`,
`--budget <n>` (Chacha Ji, default 50000), `--ci` (exit 1 on any critical).

```bash
npx family-pack buaji ./src --top 5
npx family-pack buaji ./src --professional       # clean technical output
npx family-pack padosi ./src                     # secret scan
npx family-pack chachaji ./src --budget 20000    # price the LLM pass
npx family-pack family ./src --ci                # starter trio as a gate
```

## Library

```ts
import { runBuaji, runPadosi, render } from 'family-pack';

const findings = await runBuaji('./src', { topN: 10 });   // Finding[]
console.log(render('buaji', findings, { professional: true }));
```

## The characters (substance + voice)

- **Bua Ji — Issue Finder.** Engine: auk god-class / hotspot / cycle detection
  + convention miners. Voice: nagging aunty.
- **Padosi Aunty — Secrets Scanner.** Engine: gitleaks-style regex ruleset +
  Shannon-entropy detection. Voice: loud neighbour. (New engine, self-contained.)
- **Chacha Ji — Token & Cost Guardian.** Engine: deterministic token accounting
  with a local ledger + budget gate around the LLM pass. Voice: miser.

## Architecture

```
src/
├── core/
│   ├── auk-adapter.ts   # thin wrapper over auk's exported engine
│   ├── finding.ts       # Finding type (aligned with auk)
│   ├── rank.ts          # dedupe + severity + top-N  (Stage 2)
│   └── llm-pass.ts      # Stage 3 prompt-batch emitter (auk enhance style)
├── characters/
│   ├── buaji/           # wraps auk review + miners
│   ├── padosi-aunty/    # NEW secrets/entropy engine
│   └── chachaji/        # NEW token ledger around llm-pass
├── personas/
│   ├── voice.ts         # applies the skin at render time (+ professional)
│   └── templates/       # per-character voice strings
└── cli/                 # npx family-pack <character> <path>
```

## Roadmap

Shipped: foundation + the recommended launch trio (Bua Ji, Padosi Aunty,
Chacha Ji), as a CLI, a library, and a **Claude Code plugin** (`/family-pack:buaji`,
`:padosi`, `:chachaji`, `:family`). Planned next, in order: Saasu Maa (quality
gate over auk `verify --ci`), Dada Ji (auk `decisions`), Sharma Ji Ka Beta (auk
TF-IDF clusters), Chhota Cousin (sandboxed fuzz/edge-case engine), background
hooks (Padosi on pre-commit, Saasu Maa as a gate), and the MCP tool surface.

## Development

```bash
npm install
npm test          # node:test
npm run typecheck
npm run build     # tsup → dist/
```

## License

MIT © Sandeep Kumar
