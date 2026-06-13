// ============================================================
// Family Pack — per-character voice templates (EN + Hinglish)
//
// These are render-time skins ONLY. They receive already-computed,
// persona-free Findings and return display strings. Removing this
// whole folder must not change a single finding — that is the test
// of whether the persona/substance separation holds.
// ============================================================

import type { CharacterId, Finding, Severity } from '../../core/finding.js';

export interface VoiceTemplate {
  id: CharacterId;
  /** Display name, e.g. "Bua Ji". */
  name: string;
  emoji: string;
  /** Neutral label used in --professional mode. */
  professionalLabel: string;
  /** Persona greeting line; gets the finding count. */
  intro(count: number): string;
  /** Persona sign-off line. */
  outro(count: number): string;
  /** Persona one-liner attached to a single finding. */
  line(f: Finding): string;
}

const sevTag: Record<Severity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: 'ℹ️',
};

export const buaji: VoiceTemplate = {
  id: 'buaji',
  name: 'Bua Ji',
  emoji: '👵',
  professionalLabel: 'Issue Finder',
  intro: (n) =>
    n === 0
      ? 'Arre wah beta, aaj toh sab theek hai. Koi kami nahi nikli!'
      : `Beta, idhar aao. Maine ${n} cheezein dhoond li jo theek karni hai.`,
  outro: (n) =>
    n === 0 ? 'Chalo, chai pee lo.' : 'Ab in sabko theek karo, phir baat karenge.',
  line: (f) => {
    if (f.category === 'god-object')
      return `${sevTag[f.severity]} Yeh class itni moti ho gayi hai — isko todho, beta.`;
    if (f.category === 'long-function')
      return `${sevTag[f.severity]} Itna lamba function? Saans le lo, chhote-chhote tukde karo.`;
    if (f.category === 'circular-dependency')
      return `${sevTag[f.severity]} Yeh files ek doosre ko ghuma rahi hai — gol-gol chakkar. Seedha karo.`;
    if (f.category === 'hotspot')
      return `${sevTag[f.severity]} Itne saare log ispe depend karte hai — sambhaal ke chhuna.`;
    return `${sevTag[f.severity]} Yeh dekho beta, theek karne layak hai.`;
  },
};

export const padosiAunty: VoiceTemplate = {
  id: 'padosi-aunty',
  name: 'Padosi Aunty',
  emoji: '🤫',
  professionalLabel: 'Secrets / Leak Scanner',
  intro: (n) =>
    n === 0
      ? 'Hmm. Maine sab dekh liya... abhi tak koi raaz nahi mila. Theek hai.'
      : `Hai hai! Suno suno — ${n} cheezein sabko dikh rahi hai!`,
  outro: (n) =>
    n === 0 ? 'Chalo, koi gossip nahi aaj.' : 'Inko abhi chhupao, warna poora mohalla jaan jayega!',
  line: (f) =>
    `${sevTag[f.severity]} Yeh ${String(f.meta?.kind ?? 'secret')} toh sabko dikh raha hai — turant hatao!`,
};

export const chachaji: VoiceTemplate = {
  id: 'chachaji',
  name: 'Chacha Ji',
  emoji: '🧮',
  professionalLabel: 'Token & Cost Guardian',
  intro: (n) =>
    n === 0
      ? 'Hisaab saaf hai. Ek paisa bekaar nahi gaya. Shabaash.'
      : 'Ruko ruko! Pehle hisaab dekho, phir kharcha karo.',
  outro: () => 'Paisa ped pe ugta hai kya? Soch samajh ke kharch karo.',
  line: (f) =>
    `${sevTag[f.severity]} ${String(f.meta?.estimatedTokens ?? '?')} tokens? Itna kharcha?!`,
};

export const saasuma: VoiceTemplate = {
  id: 'saasuma',
  name: 'Saasu Maa',
  emoji: '😤',
  professionalLabel: 'Quality Gate',
  intro: (n) =>
    n === 0
      ? 'Hmmph. Theek hai... is baar pass kar diya. Lekin agli baar dhyan rakhna.'
      : `Naa naa naa. Itni galtiyan? ${n} cheezein hai — aise toh ghar mein ghusne nahi dungi.`,
  outro: (n) =>
    n === 0 ? 'Chalo, aaj ke liye approve. Ahsaan samjho.' : 'Pehle yeh sab theek karo, phir approval ki baat karna.',
  line: (f) => {
    if (f.category === 'quality-gate')
      return `${sevTag[f.severity]} Mera faisla: ${String(f.meta?.passed ? 'PASS (majburi mein)' : 'FAIL')}.`;
    return `${sevTag[f.severity]} Yeh bhi theek karo — main sab dekhti hoon.`;
  },
};

export const sharmaBeta: VoiceTemplate = {
  id: 'sharma-beta',
  name: 'Sharma Ji Ka Beta',
  emoji: '🎓',
  professionalLabel: 'Benchmarker (idiomatic vs yours)',
  intro: (n) =>
    n === 0
      ? 'Wah! Tumne toh Sharma ji ke bete jaisa code likha. Maa-baap khush honge.'
      : `Dekho beta, Sharma ji ka beta hota toh ${n} jagah aur idiomatic likhta. Seekho usse.`,
  outro: (n) => (n === 0 ? 'Aise hi karte raho.' : 'Apne hi codebase ka pattern follow karo, mushkil nahi hai.'),
  line: (f) =>
    `${sevTag[f.severity]} Yeh "${String(f.meta?.cluster ?? 'family')}" pattern follow nahi karta — Sharma ka beta karta.`,
};

export const chotaCousin: VoiceTemplate = {
  id: 'chota-cousin',
  name: 'Chhota Cousin',
  emoji: '😈',
  professionalLabel: 'Edge-Case / Fuzz Tester',
  intro: (n) =>
    n === 0
      ? 'Maine sab kuch dabaya, ghumaya, toda... par kuch nahi toota. Boring! Solid hai.'
      : `Hehehe. Dekho maine kya kiya — ${n} jagah code phat gaya! Yeh button dabaun? *dabaya*`,
  outro: (n) => (n === 0 ? 'Theek hai, ab khelne jaa raha hoon.' : 'Inko handle karo warna main phir aaunga!'),
  line: (f) => {
    const kind = String(f.meta?.failureKind ?? 'break');
    if (kind === 'timeout') return `${sevTag[f.severity]} Yeh toh atak gaya — infinite loop? Ruk hi nahi raha!`;
    if (kind === 'skipped') return `${sevTag[f.severity]} Yeh chalaun? Side-effects hai... pehle poochta hoon. *waits for opt-in*`;
    return `${sevTag[f.severity]} Yeh input diya aur — dhamaka! Code ro raha hai.`;
  },
};

const REGISTRY: Record<string, VoiceTemplate> = {
  buaji,
  'padosi-aunty': padosiAunty,
  chachaji,
  saasuma,
  'sharma-beta': sharmaBeta,
  'chota-cousin': chotaCousin,
};

export function getTemplate(id: CharacterId): VoiceTemplate {
  const t = REGISTRY[id];
  if (!t) throw new Error(`No voice template registered for character "${id}"`);
  return t;
}
