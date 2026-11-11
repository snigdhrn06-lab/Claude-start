// Deterministic rubric helpers for free text. No model calls here.
export const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean);
export const wc = (t) => words(t).length;
export const hasNumber = (t) => /\d/.test(String(t || ''));
export function coverage(text, groups) {
  const t = String(text || '').toLowerCase();
  if (!groups?.length) return { score: 0, hit: [], miss: [] };
  const hit = [], miss = [];
  groups.forEach((g, i) => (g.some((k) => t.includes(k.toLowerCase())) ? hit : miss).push(i));
  return { score: hit.length / groups.length, hit, miss };
}
const MECH = /(because|due to|driven|leading|caus|result|which|than|shift|rise|rising|fall|declin|increas|decreas|lower|higher|erod|compress|outpac|cannibal|churn)/i;
export function specificity(text) {
  const n = wc(text);
  return (n >= 7 ? 0.45 : n >= 4 ? 0.2 : 0) + (MECH.test(text) ? 0.35 : 0) + (n >= 12 || hasNumber(text) ? 0.2 : 0);
}
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const clean = (s, max = 2000) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max).trim();
