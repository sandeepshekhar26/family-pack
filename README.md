# Family Pack 👨‍👩‍👧‍👦

> Your code just moved in with a desi joint family. Everyone has opinions.
> Everyone is, annoyingly, correct.

Family Pack is a cast of family-member "agents" who roast your codebase — a
nagging Bua Ji, a gossiping Padosi Aunty, a miserly Chacha Ji, a never-pleased
Saasu Maa, the insufferable Sharma-ji-ka-beta, and a chaos-gremlin Chhota
Cousin. The Hinglish drama is just a **render skin**. Underneath, each one wraps
a real, deterministic code-analysis engine (built on
[`auk`](https://github.com/sandeepshekhar26/develop-anything)) — AST parsing,
graph analysis, secret scanning, sandboxed fuzzing.

So yes, Bua Ji says *"Beta, yeh function 174 line ka hai, isko todho"* — but
she's pointing at a real god function with a real line number. Want the drama
gone? Pass `--professional` and the whole family puts on a tie.

```
$ npx family-pack family ./src

👵  Bua Ji
Beta, idhar aao. Maine 3 cheezein dhoond li jo theek karni hai.

🔴 Yeh class itni moti ho gayi hai — isko todho, beta.
   → Command is a god object (18 methods, 12 inbound calls) (utils/cli.ts:46)
   → Split it into smaller, single-responsibility units.
...

🤫  Padosi Aunty
Hai hai! Suno suno — 1 cheezein sabko dikh rahi hai!

🔴 Yeh AWS access key toh sabko dikh raha hai — turant hatao!
   → AWS access key found in source (config.ts:3)
```

---

## Meet the family

| Member | Who they are | What they actually do (the real engine) | Command |
|--------|--------------|------------------------------------------|---------|
| 👵 **Bua Ji** | The aunty who finds fault with everything "for your own good" | God objects, import cycles, over-long functions, hotspots, convention breaks (auk review + miners) | `buaji` |
| 🤫 **Padosi Aunty** | The neighbour who somehow knows all your secrets | Secret/leak scanner — gitleaks-style regex + Shannon-entropy detection | `padosi` |
| 🧮 **Chacha Ji** | The uncle who reuses tea bags | Deterministic token accounting + budget gate around the LLM pass | `chachaji` |
| 😤 **Saasu Maa** | The mother-in-law who approves *nothing* on the first try | Quality gate over issues + secrets → pass/fail, CI-ready | `saasuma` |
| 🎓 **Sharma Ji Ka Beta** | The neighbour's kid your parents keep comparing you to | "Idiomatic vs yours" — TF-IDF clusters your code against your *own* codebase's shape | `sharmabeta` |
| 😈 **Chhota Cousin** | The cousin who presses every button to see what breaks | Real sandboxed fuzz/edge-case testing with input minimisation | `chotacousin` |

*(Dada Ji — the memory keeper who recalls "pichli baar bhi yahi galti ki thi"
from git history — is moving in next. See [Roadmap](#roadmap).)*

Whole family in one go: **`family`** runs the starter trio (Bua Ji + Padosi
Aunty + Chacha Ji).

---

## Install

### As a Claude Code plugin (the fun way)

```text
/plugin marketplace add https://github.com/sandeepshekhar26/family-pack
/plugin install family-pack@family-pack
```

> Use the full **HTTPS URL** above. The `owner/repo` shorthand defaults to SSH
> and will fail if you don't have GitHub SSH keys set up. If commands don't show
> up after install, run `/reload-plugins`.

Then summon any family member by name:

```text
/family-pack:buaji        [path] [--professional]
/family-pack:padosi       [path] [--professional]
/family-pack:chachaji     [path] [--budget <n>]
/family-pack:saasuma      [path] [--professional]
/family-pack:sharmabeta   [path] [--professional]
/family-pack:chotacousin  <file> [--fn <name>] [--unsafe]
/family-pack:family       [path] [--professional]
```

In Claude Code, the deterministic scan runs via the CLI and **your own agent**
does the explain-and-fix narration — no API keys, just like auk's enhance loop.

### As a CLI / library

```bash
npm install family-pack        # needs auk-develop >= 1.2.0 (pulled automatically)
npx family-pack family ./src
```

---

## Using each member (with real output)

### 👵 Bua Ji — "what is this mess, beta"

Finds god objects, cycles, functions that have eaten too much, and files that
break your own conventions.

```bash
npx family-pack buaji ./src --top 5
```
```
👵  Bua Ji
Beta, idhar aao. Maine 3 cheezein dhoond li jo theek karni hai.

🟡 Itna lamba function? Saans le lo, chhote-chhote tukde karo.
   → parseTypeScriptJavaScript() is 174 lines long (analyzer/regex-parser.ts:55)
   → Extract helpers instead of growing the body.
```

Tie-on version:
```bash
npx family-pack buaji ./src --professional
```
```
[CRITICAL] Command is a god object (18 methods, 12 inbound calls)
  where:      utils/cli.ts:46
  confidence: 0.90
  detail:     Command concentrates too much responsibility...
  fix:        Split it into smaller, single-responsibility units.
```

### 🤫 Padosi Aunty — "guess what I found"

Scans for hard-coded API keys, tokens, private keys, and suspiciously
high-entropy strings. Never prints the secret back at you — just the location
and a stern order to rotate it.

```bash
npx family-pack padosi ./src
```
```
🤫  Padosi Aunty
Hai hai! Suno suno — 2 cheezein sabko dikh rahi hai!

🔴 Yeh AWS access key toh sabko dikh raha hai — turant hatao!
   → AWS access key found in source (config.ts:1)
🟡 Yeh high-entropy secret toh sabko dikh raha hai — turant hatao!
   → High-entropy value assigned to "apiSecret" (config.ts:2)
```

### 🧮 Chacha Ji — "paisa ped pe ugta hai kya?"

Before you spend tokens on an LLM pass, Chacha Ji prices it against a budget and
clutches his chest accordingly.

```bash
npx family-pack chachaji ./src --budget 200
```
```
🧮  Chacha Ji
Ruko ruko! Pehle hisaab dekho, phir kharcha karo.

🔴 442 tokens? Itna kharcha?!
   → LLM pass for "buaji" exceeds budget by 242 tokens
   → Lower top-N in ranking, raise the budget, or skip low-severity findings.
```

### 😤 Saasu Maa — the gate that approves nothing

Aggregates the issues and secrets into a single pass/fail verdict. CI-ready:
`--ci` exits non-zero on failure, so she slots straight into a pre-commit hook.

```bash
npx family-pack saasuma ./src --ci
```
```
😤  Saasu Maa
Naa naa naa. Itni galtiyan? 2 cheezein hai — aise toh ghar mein ghusne nahi dungi.

🔴 Mera faisla: FAIL.
   → Quality gate: FAIL — 1 critical (max 0), 1 exposed secret(s)
```

### 🎓 Sharma Ji Ka Beta — "he would've done it idiomatically"

Clusters your files into structural "families" and flags the ones that drift
from the shape your *own* codebase already established. It's a comparison to
your conventions, not some external style guide.

```bash
npx family-pack sharmabeta ./src
```
```
🎓  Sharma Ji Ka Beta
Dekho beta, Sharma ji ka beta hota toh 2 jagah aur idiomatic likhta. Seekho usse.

ℹ️ Yeh "config-auk" pattern follow nahi karta — Sharma ka beta karta.
   → src/odd-one-out.ts drifts from the "config-auk" family shape
   → Align with the family: it conventionally imports ../utils/config.js, ...
```

### 😈 Chhota Cousin — "yeh button dabaun? *dabaya*"

Real fuzz testing wearing a gremlin costume. It harvests a function's signature,
generates boundary & adversarial inputs by type, runs each in an **isolated
child process with a hard timeout + memory cap**, and shrinks any failing input
to the minimal reproducer.

```bash
npx family-pack chotacousin ./src/utils/parse.ts --fn parseDate
```
```
😈  Chhota Cousin
Hehehe. Dekho maine kya kiya — 1 jagah code phat gaya! Yeh button dabaun? *dabaya*

🟡 Yeh input diya aur — dhamaka! Code ro raha hai.
   → needsObj() — unhandled exception on input o={} (empty) (parse.ts:1)
   → Add a guard / validation for this input shape, or narrow the parameter type.
```

**Safety rails (the chaos is contained):**
- Default scope is **pure/unit functions**. Functions that do I/O, network, FS,
  or DB work are statically detected and **skipped** — reported as "needs manual
  opt-in", never auto-run. The joke is the cousin actually asks first: *"Yeh
  chalaun? *waits for opt-in*"*. Pass `--unsafe` to fuzz them deliberately.
- Every execution is sandboxed in a separate process with a timeout (infinite
  loops are caught and reported) and a memory cap.

---

## The `--professional` switch

Every command takes `--professional` to strip all persona and emit clean,
technical output — same findings, no drama. Use it in CI, in shared logs, or
when Bua Ji is simply Too Much today. Add `--json` for machine-readable output.

This is a hard guarantee: the persona is applied **only at render time**.
Findings are plain structured data (`evidence` with `file:line`, `confidence`,
`severity`) — delete the entire persona layer and not one finding changes.

---

## How it works

Three stages per character:

```
Stage 1  DETERMINISTIC SCAN   (no LLM, free)   → Finding[]  with file:line + confidence
Stage 2  FILTER + RANK        (no LLM, cheap)  → dedupe, severity score, top-N   ← Chacha Ji's domain
Stage 3  LLM NARRATION        (LLM, top-N only) → explain why + fix + persona voice
```

Stage 1 does ~90% of the work for free. Stage 3 only ever sees what static
analysis already flagged — and in Claude Code it runs on *your* agent, so
there's no API key and no cost. Family Pack consumes auk as an npm dependency
(`auk-develop`); it never forks or modifies auk's engine.

---

## Library usage

```ts
import { runBuaji, runChotaCousin, render } from 'family-pack';

const issues = await runBuaji('./src', { topN: 10 });   // Finding[]
console.log(render('buaji', issues, { professional: true }));

const crashes = await runChotaCousin('./src/parse.ts', { fn: 'parseDate' });
console.log(render('chota-cousin', crashes, {}));        // in-character
```

Every `run*` returns plain `Finding[]`; `render(character, findings, opts)`
applies (or strips) the voice.

---

## Architecture

```
src/
├── core/
│   ├── auk-adapter.ts   # thin wrapper over auk's exported engine (consumed via npm)
│   ├── finding.ts       # the persona-free Finding type
│   ├── rank.ts          # dedupe + severity + top-N   (Stage 2)
│   └── llm-pass.ts      # no-API-key prompt-batch emitter + token estimation (Stage 3)
├── characters/
│   ├── buaji/           # auk review + miners
│   ├── padosi-aunty/    # NEW secrets/entropy engine
│   ├── chachaji/        # NEW token ledger + budget gate
│   ├── saasuma/         # orchestrated quality gate
│   ├── sharma-beta/     # auk TF-IDF clusters → idiomatic drift
│   └── chota-cousin/    # NEW sandboxed fuzz engine (signature → generate → run → shrink)
├── personas/
│   ├── voice.ts         # applies/strips the skin at render time
│   └── templates/       # per-character Hinglish strings
├── cli/                 # npx family-pack <character> [path]
└── ../plugins/claude-code/   # the Claude Code plugin (slash commands)
```

---

## Roadmap

Shipped: **6 of 7 characters** (Bua Ji, Padosi Aunty, Chacha Ji, Saasu Maa,
Sharma Ji Ka Beta, Chhota Cousin) as a CLI, a library, and a Claude Code plugin.

Coming next:
- 👴 **Dada Ji** — memory keeper over auk's `decisions` (git archaeology:
  who/when/why), surfacing *"pichli baar bhi yahi galti ki thi."*
- Background **hooks** — Padosi on pre-commit, Saasu Maa as the commit gate.
- **MCP tools** — each member exposed as an MCP tool (`fuzz_function`, …)
  alongside auk's existing nine.
- Property-based mode + LLM "creative edge case" suggestions for Chhota Cousin.

---

## Development

```bash
npm install
npm test          # node:test — 23 cases incl. real sandboxed fuzzing
npm run typecheck
npm run build     # tsup → dist/
```

Built to mirror auk's toolchain: TypeScript, Node ≥ 20, tsup, `node:test`,
minimal dependencies.

## License

MIT © Sandeep Kumar — now go fix what Bua Ji found.
