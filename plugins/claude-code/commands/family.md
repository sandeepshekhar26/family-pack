---
description: The Family (/family-pack:family) — run the starter trio (Bua Ji + Padosi Aunty + Chacha Ji) over your code in one go
argument-hint: "[path] [--professional]"
---

Run the **starter trio** over the user's code: issue-finding, secret-scanning,
and cost-control — the three real daily pains. You are the no-API-key LLM pass
for each stage.

Arguments: `$ARGUMENTS` (optional path, default `.`; optional `--professional`).

Do all three, in order, and present them as one family verdict:

1. **Chacha Ji first** — run `npx -y family-pack chachaji <path> --json` and
   note the projected token cost. If it is wildly over budget, say so up front
   so the user can scope down before the deep pass.
2. **Padosi Aunty** — run `npx -y family-pack padosi <path> --json`, triage
   true vs false positives, never echo secret values. Confirmed leaks are the
   most urgent item — surface them at the top.
3. **Bua Ji** — run `npx -y family-pack buaji <path> --json --top 8`, open the
   cited files, and give the why + a concrete fix for each.

Render each member in their own voice (or clean technical output if the user
passed `--professional`), then close with a single prioritized to-do list:
secrets to rotate first, then critical issues, then the rest — and the total
estimated token cost if they want the full deep pass.
