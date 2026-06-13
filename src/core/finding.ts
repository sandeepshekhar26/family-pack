// ============================================================
// Family Pack — core Finding type
//
// A Finding is PLAIN STRUCTURED DATA with evidence (file:line),
// confidence and severity. It deliberately carries NO persona.
// The Hinglish voice is applied only at render time
// (see ../personas/voice.ts). This shape aligns with auk's
// RuleEvidence / RuleSeverity so the two interoperate cleanly.
// ============================================================

/** Severity, aligned with auk's RuleSeverity. */
export type Severity = 'critical' | 'warning' | 'info';

/** The family members. */
export type CharacterId =
  | 'buaji'
  | 'chachaji'
  | 'dadaji'
  | 'sharma-beta'
  | 'padosi-aunty'
  | 'saasuma'
  | 'chota-cousin';

/** A pointer to real code — mirrors auk's RuleEvidence. */
export interface Evidence {
  file: string;
  line?: number;
  note?: string;
}

/** A single deterministic finding, persona-free. */
export interface Finding {
  /** Stable, deterministic id: `${character}/${category}/${slug}`. */
  id: string;
  character: CharacterId;
  /** Engine-level kind, e.g. 'god-object', 'secret', 'cost'. */
  category: string;
  severity: Severity;
  /** Short technical summary. No persona. */
  title: string;
  /** Technical explanation of WHY this was flagged. No persona. */
  detail: string;
  evidence: Evidence[];
  /** 0..1 — how confident the deterministic analysis is. */
  confidence: number;
  /** Optional technical remediation hint. */
  suggestion?: string;
  /** Free-form structured extras (metrics, matched rule id, etc.). */
  meta?: Record<string, unknown>;
}

/** Severity ordering used for ranking. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 100,
  warning: 50,
  info: 10,
};

/** Composite score = severity weight × confidence. Higher = more urgent. */
export function findingScore(f: Finding): number {
  return SEVERITY_WEIGHT[f.severity] * f.confidence;
}
