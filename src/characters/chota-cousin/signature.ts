// ============================================================
// Chhota Cousin — signature harvest (Stage 1, deterministic)
//
// Pulls each target function's name, typed parameter list, async-ness
// and body text from source. We parse signatures directly (auk's
// tree-sitter visitor does not emit typed params) but stay within the
// same "read the AST shape, emit structured data" spirit.
// ============================================================

export interface Param {
  name: string;
  /** Lower-cased TS type annotation, or 'any' when absent. */
  type: string;
  /** True when optional (`?`, a default value, or `| null/undefined`). */
  optional: boolean;
}

export interface Signature {
  name: string;
  params: Param[];
  async: boolean;
  exported: boolean;
  line: number;
  /** Source text of the function body (best-effort), for side-effect scan. */
  body: string;
}

/** Split a parameter list on top-level commas (depth- and string-aware). */
function splitParams(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let str: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (str) {
      cur += c;
      if (c === str && src[i - 1] !== '\\') str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c;
      cur += c;
      continue;
    }
    if (c === '(' || c === '[' || c === '{' || c === '<') depth++;
    else if (c === ')' || c === ']' || c === '}' || c === '>') depth--;
    if (c === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseParam(raw: string): Param {
  let optional = false;
  let s = raw.trim();
  // strip default value
  const eq = s.indexOf('=');
  if (eq !== -1) {
    optional = true;
    s = s.slice(0, eq).trim();
  }
  // name?: type
  let name = s;
  let type = 'any';
  const colon = s.indexOf(':');
  if (colon !== -1) {
    name = s.slice(0, colon).trim();
    type = s.slice(colon + 1).trim();
  }
  if (name.endsWith('?')) {
    optional = true;
    name = name.slice(0, -1).trim();
  }
  const t = type.toLowerCase();
  if (/\bnull\b|\bundefined\b/.test(t)) optional = true;
  // strip rest/destructuring noise from the name for labeling
  name = name.replace(/^\.\.\./, '').replace(/[{}[\]]/g, '').trim() || 'arg';
  return { name, type: t || 'any', optional };
}

/** Find the matching close paren for the open paren at `open`. */
function matchParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Roughly capture a brace-delimited body starting at/after `from`. */
function captureBody(src: string, from: number): string {
  const open = src.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open, Math.min(src.length, open + 4000));
}

const FN_DECL = /(?:^|\n)\s*(export\s+)?(?:default\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/g;
const FN_CONST = /(?:^|\n)\s*(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s+)?\(/g;

/** Harvest all named function signatures from a source string. */
export function harvestSignatures(src: string): Signature[] {
  const sigs: Signature[] = [];
  const lineAt = (idx: number) => src.slice(0, idx).split('\n').length;

  for (const m of src.matchAll(FN_DECL)) {
    const open = m.index! + m[0].length - 1;
    const close = matchParen(src, open);
    if (close === -1) continue;
    const params = splitParams(src.slice(open + 1, close)).map(parseParam);
    sigs.push({
      name: m[3],
      params,
      async: !!m[2],
      exported: !!m[1],
      line: lineAt(m.index!),
      body: captureBody(src, close),
    });
  }

  for (const m of src.matchAll(FN_CONST)) {
    const open = m.index! + m[0].length - 1;
    const close = matchParen(src, open);
    if (close === -1) continue;
    // Must look like an arrow function after the params.
    const after = src.slice(close + 1, close + 40);
    if (!/^\s*(:[^=]+)?=>/.test(after)) continue;
    const params = splitParams(src.slice(open + 1, close)).map(parseParam);
    sigs.push({
      name: m[2],
      params,
      async: !!m[3],
      exported: !!m[1],
      line: lineAt(m.index!),
      body: captureBody(src, close),
    });
  }

  return sigs;
}
