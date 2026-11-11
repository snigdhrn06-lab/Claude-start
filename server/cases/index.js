import brewly from './brewly.js';
import northstar from './northstar.js';
import cloudaxis from './cloudaxis.js';

// Case registry. To add a case: create a module exporting the schema used by the three
// cases here (see README "Adding a case") and append it to this list.
export const CASES = [brewly, northstar, cloudaxis];
export const getCase = (id) => CASES.find((c) => c.id === id);

export function validateCase(c) {
  const errs = [];
  const sum = c.drivers.reduce((s, d) => s + d.truth, 0);
  if (Math.abs(sum - 1) > 0.011) errs.push(`driver truth weights sum to ${sum}`);
  const dsIds = new Set(c.datasets.map((d) => d.id));
  const drIds = new Set(c.drivers.map((d) => d.id));
  for (const d of c.datasets) for (const k of Object.keys(d.signals || {})) if (!drIds.has(k)) errs.push(`dataset ${d.id}: unknown driver ${k}`);
  for (const s of c.stakeholders) for (const card of s.cards) for (const k of Object.keys(card.signals || {})) if (!drIds.has(k)) errs.push(`card ${s.id}/${card.id}: unknown driver ${k}`);
  for (const q of c.quant) { if (!Number.isFinite(q.answer)) errs.push(`quant ${q.id}: non-finite answer`); for (const r of q.requires) if (!dsIds.has(r)) errs.push(`quant ${q.id}: unknown dataset ${r}`); }
  for (const p of c.expertPaths) for (const st of p.steps) { if (st.type === 'data' && !dsIds.has(st.ref)) errs.push(`path ${p.id}: unknown dataset ${st.ref}`); }
  const cost = c.datasets.reduce((s, d) => s + d.cost, 0) + c.stakeholders.reduce((s, d) => s + d.cost, 0);
  if (cost <= c.budgetHours) errs.push('budget does not force a choice');
  return errs;
}
