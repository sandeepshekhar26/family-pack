// ============================================================
// Chhota Cousin — input generation (Stage 1, deterministic)
//
// Per-type strategy table producing boundary & adversarial values.
// Values are emitted as JSON-serialisable *specs* so the sandbox
// runner can materialise things JSON can't carry (NaN, Infinity,
// circular refs, huge strings, sparse arrays, null-proto objects).
// ============================================================

import type { Param } from './signature.js';

export type ValueSpec =
  | { t: 'lit'; v: unknown }
  | { t: 'undef' }
  | { t: 'nan' }
  | { t: 'pinf' }
  | { t: 'ninf' }
  | { t: 'negzero' }
  | { t: 'bigstr'; n: number }
  | { t: 'unicode' }
  | { t: 'bigarr'; n: number }
  | { t: 'holes'; n: number }
  | { t: 'circular' }
  | { t: 'nullproto' };

export interface Candidate {
  spec: ValueSpec;
  label: string;
}

/** A single fuzz case: one value spec per parameter, plus a description. */
export interface Case {
  specs: ValueSpec[];
  /** Which parameter is being stressed (-1 = all-adversarial combo). */
  paramIndex: number;
  label: string;
}

function baseType(type: string): string {
  let t = type.replace(/\s/g, '').toLowerCase();
  // strip nullable unions for the base decision
  t = t.replace(/\|null|\|undefined|null\||undefined\|/g, '');
  if (t.endsWith('[]') || t.startsWith('array<') || t.startsWith('readonlyarray<')) return 'array';
  if (t.startsWith('record<') || t.startsWith('{') || t === 'object') return 'object';
  if (t === 'number') return 'number';
  if (t === 'string') return 'string';
  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t.includes('|')) return 'union';
  if (t === '' || t === 'any' || t === 'unknown') return 'any';
  return 'other';
}

const NUMBER_CANDS: Candidate[] = [
  { spec: { t: 'lit', v: 0 }, label: '0' },
  { spec: { t: 'lit', v: -1 }, label: '-1' },
  { spec: { t: 'negzero' }, label: '-0' },
  { spec: { t: 'lit', v: Number.MAX_SAFE_INTEGER }, label: 'MAX_SAFE_INTEGER' },
  { spec: { t: 'lit', v: Number.MIN_SAFE_INTEGER }, label: 'MIN_SAFE_INTEGER' },
  { spec: { t: 'nan' }, label: 'NaN' },
  { spec: { t: 'pinf' }, label: 'Infinity' },
  { spec: { t: 'ninf' }, label: '-Infinity' },
  { spec: { t: 'lit', v: 1e308 }, label: '1e308' },
];

const STRING_CANDS: Candidate[] = [
  { spec: { t: 'lit', v: '' }, label: '"" (empty)' },
  { spec: { t: 'lit', v: ' ' }, label: '" " (space)' },
  { spec: { t: 'unicode' }, label: 'unicode/RTL/NUL' },
  { spec: { t: 'bigstr', n: 100_000 }, label: '100k-char string' },
  { spec: { t: 'lit', v: "'; DROP TABLE users;--" }, label: 'SQL-injection-shaped' },
  { spec: { t: 'lit', v: '<script>alert(1)</script>' }, label: 'HTML-injection-shaped' },
  { spec: { t: 'lit', v: '{{constructor}}' }, label: 'template-injection-shaped' },
  { spec: { t: 'lit', v: 'a\nb\r\n' }, label: 'newlines' },
];

const BOOL_CANDS: Candidate[] = [
  { spec: { t: 'lit', v: true }, label: 'true' },
  { spec: { t: 'lit', v: false }, label: 'false' },
];

const ARRAY_CANDS: Candidate[] = [
  { spec: { t: 'lit', v: [] }, label: '[] (empty)' },
  { spec: { t: 'lit', v: [1] }, label: '[1]' },
  { spec: { t: 'lit', v: [1, 'x', null] }, label: 'mixed-type array' },
  { spec: { t: 'holes', n: 10 }, label: 'sparse array (holes)' },
  { spec: { t: 'bigarr', n: 100_000 }, label: '100k-element array' },
];

const OBJECT_CANDS: Candidate[] = [
  { spec: { t: 'lit', v: {} }, label: '{} (empty)' },
  { spec: { t: 'lit', v: { a: 1 } }, label: '{a:1}' },
  { spec: { t: 'nullproto' }, label: 'null-proto object' },
  { spec: { t: 'circular' }, label: 'circular reference' },
];

const ANY_CANDS: Candidate[] = [
  { spec: { t: 'undef' }, label: 'undefined' },
  { spec: { t: 'lit', v: null }, label: 'null' },
  { spec: { t: 'lit', v: 0 }, label: '0' },
  { spec: { t: 'lit', v: '' }, label: '"" ' },
  { spec: { t: 'lit', v: {} }, label: '{}' },
  { spec: { t: 'nan' }, label: 'NaN' },
];

const NULLISH: Candidate[] = [
  { spec: { t: 'undef' }, label: 'undefined' },
  { spec: { t: 'lit', v: null }, label: 'null' },
];

/** Candidate adversarial values for one parameter. */
export function candidatesFor(param: Param): Candidate[] {
  const base = baseType(param.type);
  let cands: Candidate[];
  switch (base) {
    case 'number': cands = NUMBER_CANDS; break;
    case 'string': cands = STRING_CANDS; break;
    case 'boolean': cands = BOOL_CANDS; break;
    case 'array': cands = ARRAY_CANDS; break;
    case 'object': cands = OBJECT_CANDS; break;
    case 'union': cands = [...NUMBER_CANDS.slice(0, 3), ...STRING_CANDS.slice(0, 3), ...NULLISH]; break;
    default: cands = ANY_CANDS; break;
  }
  // Optional / nullable params always also get null + undefined.
  if (param.optional) cands = [...cands, ...NULLISH];
  return cands;
}

/** A benign baseline value so we can vary one parameter at a time. */
function baseline(param: Param): ValueSpec {
  switch (baseType(param.type)) {
    case 'number': return { t: 'lit', v: 1 };
    case 'string': return { t: 'lit', v: 'x' };
    case 'boolean': return { t: 'lit', v: true };
    case 'array': return { t: 'lit', v: [1] };
    case 'object': return { t: 'lit', v: { a: 1 } };
    default: return { t: 'lit', v: 0 };
  }
}

/**
 * Generate fuzz cases by varying one parameter at a time over its
 * adversarial candidates (others held at a benign baseline), capped at
 * `max` total cases — the ranking/cost discipline of Stage 2 applies here too.
 */
export function generateCases(params: Param[], max = 60): Case[] {
  const cases: Case[] = [];
  const base = params.map(baseline);

  if (params.length === 0) {
    return [{ specs: [], paramIndex: -1, label: 'no-arg call' }];
  }

  for (let p = 0; p < params.length; p++) {
    for (const cand of candidatesFor(params[p])) {
      const specs = base.slice();
      specs[p] = cand.spec;
      cases.push({ specs, paramIndex: p, label: `${params[p].name}=${cand.label}` });
      if (cases.length >= max) return cases;
    }
  }
  return cases;
}
