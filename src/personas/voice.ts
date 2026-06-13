// ============================================================
// Family Pack — voice renderer (the render skin)
//
// Applies the Hinglish persona to Finding[] AT RENDER TIME ONLY.
// `professional: true` strips every persona and returns clean,
// technical output — a HARD requirement that protects auk's
// credibility and keeps the engine reusable.
// ============================================================

import type { CharacterId, Finding, Severity } from '../core/finding.js';
import { getTemplate } from './templates/index.js';

export interface RenderOptions {
  /** When true, strip all persona and emit clean technical output. */
  professional?: boolean;
  /** When true, return machine-readable JSON instead of text. */
  json?: boolean;
}

const sevLabel: Record<Severity, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO',
};

function evidenceStr(f: Finding): string {
  return f.evidence
    .map((e) => (e.line != null ? `${e.file}:${e.line}` : e.file))
    .join(', ');
}

/** Clean, persona-free technical report. */
function renderProfessional(character: CharacterId, findings: Finding[]): string {
  const t = getTemplate(character);
  const lines: string[] = [];
  lines.push(`# ${t.professionalLabel} (${character})`);
  lines.push(`${findings.length} finding${findings.length === 1 ? '' : 's'}`);
  lines.push('');
  for (const f of findings) {
    lines.push(`[${sevLabel[f.severity]}] ${f.title}`);
    lines.push(`  where:      ${evidenceStr(f)}`);
    lines.push(`  confidence: ${f.confidence.toFixed(2)}`);
    lines.push(`  detail:     ${f.detail}`);
    if (f.suggestion) lines.push(`  fix:        ${f.suggestion}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/** Hinglish persona report — the same findings, skinned. */
function renderPersona(character: CharacterId, findings: Finding[]): string {
  const t = getTemplate(character);
  const lines: string[] = [];
  lines.push(`${t.emoji}  ${t.name}`);
  lines.push(t.intro(findings.length));
  lines.push('');
  for (const f of findings) {
    lines.push(t.line(f));
    lines.push(`   → ${f.title} (${evidenceStr(f)})`);
    if (f.suggestion) lines.push(`   → ${f.suggestion}`);
    lines.push('');
  }
  lines.push(t.outro(findings.length));
  return lines.join('\n').trimEnd();
}

/**
 * Render findings for a character. Persona by default; clean technical
 * output when `professional` is set; raw JSON when `json` is set.
 */
export function render(
  character: CharacterId,
  findings: Finding[],
  opts: RenderOptions = {}
): string {
  if (opts.json) {
    return JSON.stringify({ character, findings }, null, 2);
  }
  return opts.professional
    ? renderProfessional(character, findings)
    : renderPersona(character, findings);
}
