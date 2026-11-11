// Engine smoke test: runs every archetype through every case and prints scores.
process.env.CB_DISABLE_AI = '1';
const { CASES, validateCase } = await import('../server/cases/index.js');
const { simulate, ARCHETYPES } = await import('../server/engine/simulate.js');
let bad = 0;
for (const c of CASES) { const e = validateCase(c); if (e.length) { bad++; console.log('CASE INVALID', c.id, e); } }
for (const [caseId, set] of Object.entries(ARCHETYPES)) for (const [name, p] of Object.entries(set)) {
  const a = await simulate('u_test', caseId, p, { strict: true });
  const r = a.result;
  console.log(caseId.padEnd(10), name.padEnd(10), 'overall', String(r.overall).padStart(3), Object.entries(r.skills).map(([k, v]) => `${k.slice(0, 5)} ${v}`).join(' | '), '| xp', r.xp.total, '| hrs', a.hoursUsed, '| flags', r.flags.join(','));
  if (a.status !== 'completed' || !r.replay.timeline.length) { bad++; console.log('  FAILED'); }
}
console.log(bad ? `${bad} failure(s)` : 'smoke ok');
process.exit(bad ? 1 : 0);
