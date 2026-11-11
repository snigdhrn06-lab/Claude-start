// Explainable scoring. Deterministic checks for arithmetic, budget, evidence access, references,
// required components and confidence; anchored rubrics (concept coverage) for written reasoning.
// Produces six skill scores, an XP breakdown and the Evidence Trail Replay.
import { coverage, specificity, clamp, wc } from './text.js';

export const SKILLS = [
  { id: 'structuring', label: 'Structuring', weight: 0.12 },
  { id: 'hypothesis', label: 'Hypothesis quality', weight: 0.16 },
  { id: 'evidence', label: 'Evidence efficiency', weight: 0.2 },
  { id: 'quant', label: 'Quantitative accuracy', weight: 0.16 },
  { id: 'calibration', label: 'Calibration', weight: 0.16 },
  { id: 'synthesis', label: 'Synthesis & defence', weight: 0.2 },
];
const VALUE_W = { critical: 1, useful: 0.4, ruleout: 0.3, noise: 0 };
const pctOf = (x) => Math.round(clamp(x) * 100);

function signalMap(c) {
  const m = {};
  for (const d of c.datasets) m[`ds:${d.id}`] = { signals: d.signals || {}, label: d.title, value: d.value, insight: d.insight };
  for (const s of c.stakeholders) for (const k of s.cards) m[`iv:${s.id}:${k.id}`] = { signals: k.signals || {}, label: `${s.name} — ${k.topic}`, value: 'useful', insight: k.answer };
  for (const q of c.quant) m[`q:${q.id}`] = { signals: c.datasets.find((d) => d.id === q.requires[0])?.signals || {}, label: q.prompt, value: 'useful', insight: q.explain };
  return m;
}

function analyseUpdates(a, c, sig) {
  let prev = null; const batches = []; const snaps = [];
  const label = (refs) => (refs.length ? `After ${sig[refs[0]]?.label.split(',')[0].slice(0, 34) || 'evidence'}${refs.length > 1 ? ` +${refs.length - 1}` : ''}` : 'Opening view');
  for (const [i, e] of a.events.entries()) {
    if (!['conf_commit', 'conf_hold', 'implicit_hold'].includes(e.type)) continue;
    const after = e.type === 'implicit_hold' ? prev : e.byDriver;
    if (e.type !== 'implicit_hold') snaps.push({ t: e.t, label: label(e.after || []), byDriver: { ...after }, eventIndex: i });
    if (prev && e.after?.length) {
      const S = {}; for (const r of e.after) for (const [d, v] of Object.entries(sig[r]?.signals || {})) S[d] = (S[d] || 0) + v;
      const onBoard = new Set([...Object.keys(prev), ...Object.keys(after)]);
      const rel = Object.entries(S).filter(([d, v]) => v !== 0 && onBoard.has(d));
      const off = Object.entries(S).filter(([d, v]) => v >= 2 && !onBoard.has(d)).map(([d]) => d);
      let ok = 0; const moves = [];
      for (const [d, v] of rel) {
        const before = prev[d] || 0, now = after[d] || 0, delta = now - before;
        const good = v > 0 ? delta > 0 || before >= 60 : delta < 0 || before === 0;
        if (good) ok++; moves.push({ driver: d, signal: v, before, after: now, good });
      }
      const rate = rel.length ? ok / rel.length : null;
      batches.push({ eventIndex: i, refs: e.after, type: e.type, rate, moves, off,
        verdict: rate == null ? 'neutral' : rate >= 0.5 ? 'updated' : e.type === 'conf_commit' ? 'against' : 'held' });
    }
    if (e.type !== 'implicit_hold') prev = { ...after };
  }
  const judged = batches.filter((b) => b.rate != null);
  return { batches, snaps, updateRate: judged.length ? judged.reduce((s, b) => s + b.rate, 0) / judged.length : null, final: prev };
}

export function scoreAttempt(a, c, ctx = {}) {
  const sig = signalMap(c);
  const hyps = a.hypotheses.filter((h) => !h.deleted);
  const truth = Object.fromEntries(c.drivers.map((d) => [d.id, d.truth]));
  const dLabel = (id) => c.drivers.find((d) => d.id === id)?.label || 'Other';
  const rec = a.recommendation; const upd = analyseUpdates(a, c, sig);
  const comp = {}; const add = (skill, label, score, weight, detail) => (comp[skill] ||= []).push({ label, score: clamp(score), weight, detail });

  // ---- Structuring
  const pre = a.hypotheses.filter((h) => h.preData);
  const distinct = new Set(hyps.map((h) => h.driver).filter((d) => d !== 'other')).size;
  const sides = new Set(hyps.map((h) => c.drivers.find((d) => d.id === h.driver)?.side).filter(Boolean)).size;
  add('structuring', 'Hypotheses formed before any data', pre.length / 3, 0.3, `${pre.length} formed before the first request (3+ expected).`);
  add('structuring', 'Breadth across distinct areas', distinct / 4, 0.25, `${distinct} distinct areas covered (4 for full marks).`);
  add('structuring', 'Covers revenue, cost and margin sides', sides >= 2 ? 1 : sides * 0.5, 0.2, `${sides} of 3 sides of the profit tree represented.`);
  add('structuring', 'Structured recommendation', rec ? (rec.priorities.length >= 3 ? 1 : 0.6) : 0, 0.25, rec ? `${rec.priorities.length} sequenced priorities; all eight sections completed.` : 'No recommendation submitted.');

  // ---- Hypothesis quality
  const spec = hyps.length ? hyps.reduce((s, h) => s + specificity(h.text), 0) / hyps.length : 0;
  const early = pre.some((h) => (truth[h.driver] || 0) >= 0.2);
  const links = hyps.flatMap((h) => h.links.map((l) => ({ ...l, driver: h.driver })));
  const goodLinks = links.filter((l) => { const s = sig[l.ref]?.signals[l.driver] || 0; return l.stance === 'supports' ? s > 0 : s < 0; }).length;
  const leadDrivers = rec ? [...new Set(rec.leadHypIds.map((id) => hyps.find((h) => h.id === id)?.driver).filter(Boolean))] : [];
  const matched = c.diagnoses.filter((d) => d.requires.every((r) => leadDrivers.includes(r))).sort((x, y) => y.quality - x.quality)[0];
  const diagQ = matched ? matched.quality : leadDrivers.length ? clamp(Math.max(...leadDrivers.map((d) => truth[d] || 0)) * 2, 0, 0.45) : 0;
  add('hypothesis', 'Specific, testable statements', spec, 0.3, 'Scored on length, a stated mechanism or direction, and quantification.');
  add('hypothesis', 'A major driver on the opening board', early ? 1 : 0, 0.2, early ? 'Your opening hypotheses included a driver that proved material.' : 'None of your opening hypotheses addressed a driver that proved material.');
  add('hypothesis', 'Evidence correctly linked to hypotheses', goodLinks / Math.max(3, links.length), 0.25, `${goodLinks} of ${links.length} links consistent with what the evidence shows (3+ expected).`);
  add('hypothesis', 'Diagnosis rests on a defensible cause', diagQ, 0.25, matched ? `Matches a recognised diagnosis: "${matched.label}".` : 'Lead hypotheses do not map to a diagnosis the evidence supports.');

  // ---- Evidence efficiency
  const got = a.requested.map((id) => c.datasets.find((d) => d.id === id));
  const target = c.datasets.filter((d) => d.value === 'critical').length + 0.8;
  const ivUseful = Object.keys(a.interviews).filter((sid) => a.cards.some((r) => r.startsWith(sid + ':'))).length;
  const gotW = got.reduce((s, d) => s + VALUE_W[d.value], 0) + ivUseful * 0.3;
  const onBoardDrivers = new Set(a.hypotheses.map((h) => h.driver));
  const noiseH = got.filter((d) => d.value === 'noise' || (d.value === 'ruleout' && !Object.keys(d.signals).some((k) => onBoardDrivers.has(k)))).reduce((s, d) => s + d.cost, 0)
    + Object.keys(a.interviews).filter((sid) => !a.cards.some((r) => r.startsWith(sid + ':'))).reduce((s, sid) => s + c.stakeholders.find((x) => x.id === sid).cost, 0);
  const firstCrit = got.findIndex((d) => d.value === 'critical');
  const critGot = got.filter((d) => d.value === 'critical').length, critAll = c.datasets.filter((d) => d.value === 'critical').length;
  add('evidence', 'Coverage of decisive evidence', gotW / target, 0.45, `${critGot} of ${critAll} decisive datasets obtained; ${ivUseful} productive interview(s).`);
  add('evidence', 'Hours not spent on low-value requests', a.hoursUsed ? 1 - clamp(noiseH / a.hoursUsed / 0.4) : 0, 0.25, `${noiseH}h of ${a.hoursUsed}h went to requests that could not move your hypotheses.`);
  add('evidence', 'Sequencing', firstCrit < 0 ? 0 : firstCrit <= 1 ? 1 : firstCrit === 2 ? 0.7 : 0.4, 0.15, firstCrit < 0 ? 'No decisive dataset requested.' : `First decisive dataset was request #${firstCrit + 1}.`);
  add('evidence', 'Depth of investigation', a.hoursUsed / (c.budgetHours * 0.5), 0.15, `${a.hoursUsed} of ${c.budgetHours} analyst hours used.`);

  // ---- Quantitative accuracy
  const qs = c.quant.map((q) => ({ q, r: a.quant[q.id] }));
  const qScore = qs.reduce((s, { r }) => s + (r?.correct ? (r.tries === 1 ? 1 : r.tries === 2 ? 0.6 : 0.3) : 0), 0) / qs.length;
  const opt = rec ? c.options.find((o) => o.id === rec.optionId) : null;
  let impactScore = 0, impactNote = 'No estimate submitted.';
  if (rec && opt) { const [lo, hi] = opt.impact; const span = hi - lo; impactScore = rec.impact >= lo && rec.impact <= hi ? 1 : rec.impact >= lo - span * 0.5 && rec.impact <= hi + span * 0.5 ? 0.5 : 0;
    impactNote = impactScore === 1 ? 'Your impact estimate is within the range the case model supports for this option.' : impactScore ? 'Your impact estimate is outside, but near, the range the case model supports.' : 'Your impact estimate is not supportable from the case model for this option.'; }
  add('quant', 'Workbench calculations', qScore, 0.7, `${qs.filter((x) => x.r?.correct).length} of ${qs.length} correct (full credit on first attempt). Checked in code against the case model.`);
  add('quant', 'Plausible financial impact', impactScore, 0.3, impactNote);

  // ---- Calibration
  const fin = upd.final || {}; const tot = Object.values(fin).reduce((s, v) => s + v, 0) || 1;
  const tv = 0.5 * [...new Set([...Object.keys(truth), ...Object.keys(fin)])].reduce((s, d) => s + Math.abs((fin[d] || 0) / tot - (truth[d] || 0)), 0);
  const first = upd.snaps[0]?.byDriver || {}; const maxInit = Math.max(0, ...Object.values(first));
  add('calibration', 'Final confidence matches the weight of evidence', (1 - tv) / 0.85, 0.5, `Your final distribution overlaps ${Math.round((1 - tv) * 100)}% with the evidence-weighted view.`);
  add('calibration', 'Beliefs updated in the direction of evidence', upd.updateRate ?? 0.4, 0.35, upd.updateRate == null ? 'No update opportunities recorded.' : `${Math.round(upd.updateRate * 100)}% of evidence-driven updates moved the right way.`);
  add('calibration', 'No premature certainty', maxInit <= 50 ? 1 : maxInit <= 70 ? 0.5 : 0, 0.15, `Largest opening allocation: ${maxInit} points.`);

  // ---- Synthesis & defence
  let recScore = 0, board = 0; const cited = rec ? rec.evidence : [];
  if (rec) {
    const valid = cited.filter((r) => leadDrivers.some((d) => (sig[r]?.signals[d] || 0) > 0)).length;
    const evScore = clamp(valid / 3) * (cited.length && valid / cited.length >= 0.5 ? 1 : 0.7);
    const cov = [coverage(rec.diagnosis, c.concepts.diagnosis), coverage(rec.risks, c.concepts.risks), coverage(rec.nextSteps, c.concepts.nextSteps)];
    const textScore = cov.reduce((s, x) => s + x.score, 0) / 3;
    const consistent = !opt.drivers.length || opt.drivers.some((d) => leadDrivers.includes(d));
    const optScore = opt.quality * (consistent ? 1 : 0.8);
    add('synthesis', 'Diagnosis quality', diagQ, 0.14, matched ? matched.label : 'Diagnosis not supported by the case evidence.');
    add('synthesis', 'Evidence cited actually supports the diagnosis', evScore, 0.11, `${valid} of ${cited.length} cited items bear on your lead hypotheses.`);
    add('synthesis', 'Reasoning covers the essential ideas', textScore, 0.11, `Diagnosis ${cov[0].hit.length}/${c.concepts.diagnosis.length}, risks ${cov[1].hit.length}/${c.concepts.risks.length}, next steps ${cov[2].hit.length}/${c.concepts.nextSteps.length} rubric concepts addressed.`);
    add('synthesis', 'Strategic judgement', optScore, 0.14, `${opt.label}${consistent ? '' : ' — not consistent with your own diagnosis'}. Several directions are defensible; they are not equally strong.`);
    add('synthesis', 'Implementation priorities', rec.priorities.length >= 3 ? 1 : 0.6, 0.05, `${rec.priorities.length} priorities.`);
    recScore = 1;
  }
  if (a.defence) {
    const ds = a.defence.done; const dAvg = ds.length ? ds.reduce((s, x) => s + x.score, 0) / ds.length : 0;
    board = a.defence.twist ? 0.7 * dAvg + 0.3 * a.defence.twist.score : dAvg * 0.7;
    add('synthesis', 'Boardroom challenges', dAvg, 0.31, ds.map((x) => `${x.kind}: ${Math.round(x.score * 100)}`).join(' · ') || 'Not attempted.');
    add('synthesis', 'Response to the twist', a.defence.twist?.score || 0, 0.14, a.defence.twist ? a.defence.twist.note : 'Not reached.');
  }

  const skills = {};
  for (const s of SKILLS) { const items = comp[s.id] || []; const w = items.reduce((t, x) => t + x.weight, 0) || 1; skills[s.id] = Math.round((items.reduce((t, x) => t + x.score * x.weight, 0) / w) * 100); }
  if (!recScore) skills.synthesis = Math.min(skills.synthesis, 10);
  const overall = Math.round(SKILLS.reduce((t, s) => t + skills[s.id] * s.weight, 0));

  // ---- XP (explainable)
  const elapsedMin = ((a.completedAt || Date.now()) - a.startedAt) / 60000;
  const lowEffort = !a.seeded && (overall < 30 || (elapsedMin < 2.5 && !a._sim));
  const items = [{ label: `Case performance (${overall}/100 × ${c.xpReward} XP)`, amount: Math.round((c.xpReward * overall) / 100) }];
  const bonus = (cond, label, pct) => cond && items.push({ label, amount: Math.round(c.xpReward * pct) });
  bonus((upd.updateRate ?? 0) >= 0.75, 'Disciplined belief updating', 0.08);
  bonus(skills.evidence >= 80, 'Efficient investigation', 0.08);
  bonus(board >= 0.7, 'Held the boardroom', 0.08);
  bonus(qs.every((x) => x.r?.firstTry), 'Quant clean sheet', 0.06);
  bonus(skills.hypothesis >= 80, 'Strong hypothesis structuring', 0.05);
  const mult = [];
  const prior = ctx.priorCompletions || 0;
  if (prior >= 1) mult.push({ label: `Repeat attempt #${prior + 1} on this case`, factor: prior === 1 ? 0.5 : prior === 2 ? 0.25 : 0.1 });
  if (a.hintsUsed) mult.push({ label: `${a.hintsUsed} hint${a.hintsUsed > 1 ? 's' : ''} used`, factor: Math.max(0.6, 1 - 0.08 * a.hintsUsed) });
  if ((ctx.recentAbandons || 0) >= 3) mult.push({ label: 'Three or more abandoned cases this week', factor: 0.85 });
  if (lowEffort) mult.push({ label: 'Low-effort submission', factor: 0.2 });
  const subtotal = items.reduce((s, x) => s + x.amount, 0);
  const total = Math.round(mult.reduce((s, m) => s * m.factor, subtotal));

  // ---- Narrative feedback
  const flat = Object.entries(comp).flatMap(([skill, xs]) => xs.map((x) => ({ ...x, skill })));
  const strengths = flat.filter((x) => x.score >= 0.8 && x.weight >= 0.14).sort((x, y) => y.weight - x.weight).slice(0, 4).map((x) => ({ skill: x.skill, label: x.label, detail: x.detail }));
  const weaknesses = flat.filter((x) => x.score < 0.5 && x.weight >= 0.14).sort((x, y) => x.score - y.score).slice(0, 4).map((x) => ({ skill: x.skill, label: x.label, detail: x.detail }));
  const missedCrit = c.datasets.filter((d) => d.value === 'critical' && !a.requested.includes(d.id));
  const flags = [];
  if (upd.batches.filter((b) => b.verdict === 'held').length >= 2) flags.push('anchoring');
  if (maxInit > 60) flags.push('premature_certainty');
  if (noiseH >= 8) flags.push('unfocused_requests');
  if (missedCrit.length >= 2) flags.push('missed_decisive_evidence');
  if (rec && qs.filter((x) => x.r?.correct).length <= 1) flags.push('unquantified_recommendation');
  if (pre.length < 2) flags.push('data_before_hypotheses');
  if (rec && opt.quality < 0.5) flags.push('weak_strategic_choice');
  const suggestions = [];
  if (flags.includes('anchoring')) suggestions.push('After each piece of evidence, ask which hypothesis it should move — and move it, even by a few points.');
  if (flags.includes('unfocused_requests')) suggestions.push('Before requesting data, name the hypothesis it would confirm or kill. If you cannot, it is probably not worth the hours.');
  if (flags.includes('missed_decisive_evidence')) suggestions.push(`You did not see: ${missedCrit.map((d) => d.title).join('; ')}. Look for the cut that separates your top two hypotheses.`);
  if (flags.includes('unquantified_recommendation')) suggestions.push('Size the problem before recommending. A recommendation without a number is an opinion.');
  if (flags.includes('premature_certainty')) suggestions.push('Open wider. Holding more than 60 points on one hypothesis before seeing data makes later evidence harder to hear.');
  if (flags.includes('data_before_hypotheses')) suggestions.push('Write at least three competing hypotheses before opening the data room.');
  if (!suggestions.length) suggestions.push('Strong investigation. Try the alternative expert route in the replay to see a different defensible path.');

  return {
    overall, skills, components: comp, xp: { subtotal, total, items, multipliers: mult }, strengths, weaknesses, suggestions, flags,
    diagnosis: matched ? { id: matched.id, label: matched.label, quality: matched.quality } : null, option: opt ? { id: opt.id, label: opt.label, quality: opt.quality } : null,
    updateRate: upd.updateRate, boardroom: Math.round(board * 100), lowEffort, gradedBy: 'engine', override: null,
    replay: buildReplay(a, c, sig, upd, { dLabel, truth, leadDrivers, opt }),
  };
}

function buildReplay(a, c, sig, upd, { dLabel, truth, leadDrivers, opt }) {
  const T = []; const push = (e, x) => T.push({ i: T.length, t: e.t, ...x });
  const batchAt = Object.fromEntries(upd.batches.map((b) => [b.eventIndex, b]));
  const fmtMoves = (b) => b.moves.map((m) => `${dLabel(m.driver)}: ${m.before} → ${m.after} (evidence ${m.signal > 0 ? 'supported' : 'undercut'} it)`).join('; ');
  let reqN = 0;
  a.events.forEach((e, idx) => {
    if (e.type === 'start') push(e, { kind: 'brief', title: 'Engagement opened', detail: 'Client briefing received.', verdict: 'neutral' });
    else if (e.type === 'hyp_add') {
      const w = truth[e.driver] || 0; const before = reqN === 0;
      push(e, { kind: 'hypothesis', title: `Hypothesis: ${dLabel(e.driver)}`, detail: e.text, verdict: w >= 0.2 ? 'strong' : 'neutral',
        impact: w >= 0.2 ? (before ? 'This area proved material. Having it on the board before any data meant the evidence had somewhere to land.' : 'You added this after seeing data — a sign you let evidence reshape the board.') : w >= 0.05 ? 'A reasonable candidate that turned out to be a minor contributor. Worth holding; worth closing cheaply.' : 'Plausible at the outset, not supported by the case. The skill is in how quickly you let it go.' });
    } else if (e.type === 'hyp_delete') push(e, { kind: 'hypothesis', title: 'Hypothesis removed', detail: e.text, verdict: 'neutral' });
    else if (e.type === 'data_request') {
      reqN++; const d = c.datasets.find((x) => x.id === e.datasetId);
      const onBoard = Object.keys(d.signals).some((k) => a.hypotheses.some((h) => h.driver === k && h.createdAt <= e.t));
      const verdict = d.value === 'critical' ? 'strong' : d.value === 'useful' ? 'good' : d.value === 'ruleout' ? (onBoard ? 'good' : 'waste') : 'waste';
      push(e, { kind: 'data', ref: `ds:${d.id}`, title: `Requested: ${d.title}`, cost: d.cost, detail: d.insight, verdict,
        impact: d.value === 'critical' ? 'Decisive evidence. This separates the leading explanations from the rest.' : d.value === 'useful' ? 'Useful corroboration.' : d.value === 'ruleout' ? (onBoard ? 'A cheap way to close a hypothesis you were holding. Elimination is progress.' : 'This could only eliminate a hypothesis that was not on your board.') : `These ${d.cost} hours could not discriminate between your hypotheses.`,
        signals: Object.entries(d.signals).map(([k, v]) => ({ driver: dLabel(k), v })) });
    } else if (e.type === 'interview_start') { const s = c.stakeholders.find((x) => x.id === e.stakeholderId); push(e, { kind: 'interview', title: `Interviewed ${s.name}, ${s.role}`, cost: s.cost, detail: `Perspective to keep in mind: ${s.bias}`, verdict: 'neutral' }); }
    else if (e.type === 'interview_q' && e.cardIds?.length) {
      const s = c.stakeholders.find((x) => x.id === e.stakeholderId); const cards = e.cardIds.map((id) => s.cards.find((k) => k.id === id));
      push(e, { kind: 'interview', title: `${s.name} disclosed: ${cards.map((k) => k.topic).join(', ')}`, detail: `You asked: "${e.question}"`, verdict: cards.some((k) => Object.values(k.signals).some((v) => Math.abs(v) >= 2)) ? 'strong' : 'good', impact: 'A specific question earned a specific answer.' });
    } else if (e.type === 'quant_answer') { const q = c.quant.find((x) => x.id === e.qid); push(e, { kind: 'calc', title: e.correct ? `Calculated: ${q.prompt}` : `Miscalculated: ${q.prompt}`, detail: e.correct ? q.explain : `You entered ${Math.round(e.value * 100) / 100}${q.unit === '%' ? '%' : ''}. ${e.tries >= 3 ? q.explain : 'Attempt ' + e.tries + ' of 3.'}`, verdict: e.correct ? 'good' : 'missed' }); }
    else if (e.type === 'scenario') push(e, { kind: 'calc', title: 'Ran a scenario', detail: e.headline ? `${e.headline.label}: ${e.headline.value} ${e.headline.unit}` : '', verdict: 'good', impact: 'Testing the recommendation against the model before committing to it.' });
    else if (e.type === 'hint') push(e, { kind: 'hint', title: 'Used a hint', detail: c.hints[e.n - 1], verdict: 'neutral' });
    else if (['conf_commit', 'conf_hold', 'implicit_hold'].includes(e.type)) {
      const b = batchAt[idx];
      if (!b) { if (e.type !== 'implicit_hold') push(e, { kind: 'belief', title: e.after?.length ? 'Confidence re-committed' : 'Opening confidence allocation', byDriver: e.byDriver, detail: e.note || '', verdict: 'neutral' }); return; }
      const names = b.refs.map((r) => sig[r]?.label).filter(Boolean).join('; ');
      if (b.verdict === 'updated') push(e, { kind: 'belief', title: 'Updated beliefs', byDriver: e.byDriver, detail: fmtMoves(b), verdict: 'strong', impact: `You moved confidence in the direction ${names} pointed.` });
      else if (b.verdict === 'against') push(e, { kind: 'belief', title: 'Updated against the evidence', byDriver: e.byDriver, detail: fmtMoves(b), verdict: 'missed', impact: `${names} pointed the other way. Re-read what it showed.` });
      else if (b.verdict === 'held') push(e, { kind: 'belief', title: e.type === 'implicit_hold' ? 'Moved on without updating' : 'Held position', byDriver: e.byDriver, detail: fmtMoves(b), verdict: 'missed', impact: `This was a moment to update: ${names} carried a clear signal for hypotheses on your board.` });
      else push(e, { kind: 'belief', title: e.type === 'conf_commit' ? 'Re-allocated confidence' : 'Held position', byDriver: e.byDriver, detail: b.off.length ? `The evidence pointed at an area not on your board: ${b.off.map(dLabel).join(', ')}.` : 'The evidence in hand did not bear on your hypotheses; holding was reasonable.', verdict: b.off.length ? 'missed' : 'neutral' });
    } else if (e.type === 'submit_rec') push(e, { kind: 'recommend', title: `Recommended: ${opt?.label}`, detail: a.recommendation.diagnosis, verdict: opt?.quality >= 0.75 ? 'strong' : opt?.quality >= 0.45 ? 'good' : 'missed', impact: opt?.quality >= 0.75 ? 'A direction the evidence supports.' : opt?.quality >= 0.45 ? 'Defensible, though it addresses a smaller part of the problem.' : 'This direction does not address what the evidence shows is driving the problem.' });
    else if (e.type === 'defence') { const d = a.defence.done.find((x) => x.id === e.challengeId); push(e, { kind: 'defence', title: `Boardroom: ${d.kind} challenge`, detail: d.prompt, response: d.response, verdict: d.score >= 0.6 ? 'strong' : d.score >= 0.35 ? 'good' : 'missed', impact: d.reaction }); }
    else if (e.type === 'twist') push(e, { kind: 'defence', title: `Twist: ${c.boardroom.twist.title}`, detail: a.defence.twist.stanceLabel, response: a.defence.twist.text, verdict: a.defence.twist.score >= 0.7 ? 'strong' : a.defence.twist.score >= 0.45 ? 'good' : 'missed', impact: a.defence.twist.note });
  });
  const paths = c.expertPaths.map((p) => {
    const steps = p.steps.map((s) => {
      let done = false, label = s.text;
      if (s.type === 'data') { const d = c.datasets.find((x) => x.id === s.ref); label = d.title; done = a.requested.includes(s.ref); }
      else if (s.type === 'interview') { const st = c.stakeholders.find((x) => x.id === s.ref); label = `Interview ${st.name} (${st.role})`; done = Boolean(a.interviews[s.ref]); }
      else if (s.type === 'calc') { label = c.quant.find((x) => x.id === s.ref).prompt; done = Boolean(a.quant[s.ref]?.correct); }
      else if (s.type === 'hypothesis') done = a.hypotheses.filter((h) => h.preData).length >= 3;
      else if (s.type === 'update') done = (upd.updateRate ?? 0) >= 0.5;
      else if (s.type === 'recommend') { label = c.options.find((o) => o.id === s.ref).label; done = a.recommendation?.optionId === s.ref; }
      return { type: s.type, label, why: s.why || null, done };
    });
    return { id: p.id, name: p.name, summary: p.summary, steps, match: Math.round((steps.filter((s) => s.done).length / steps.length) * 100) };
  });
  const order = Object.fromEntries(c.drivers.map((d) => [d.id, d.label]));
  return {
    timeline: T, snapshots: upd.snaps.map((s) => ({ ...s, eventIndex: undefined })), drivers: order,
    truth: Object.fromEntries(c.drivers.map((d) => [d.id, Math.round(d.truth * 100)])), paths,
    missed: c.datasets.filter((d) => (d.value === 'critical' || d.value === 'useful') && !a.requested.includes(d.id)).map((d) => ({ title: d.title, cost: d.cost, value: d.value, insight: d.insight })),
    unnecessary: T.filter((x) => x.kind === 'data' && x.verdict === 'waste').map((x) => ({ title: x.title.replace('Requested: ', ''), cost: x.cost })),
    debrief: c.debrief, hours: { used: a.hoursUsed, budget: c.budgetHours },
    counts: { strong: T.filter((x) => x.verdict === 'strong').length, missed: T.filter((x) => x.verdict === 'missed').length, waste: T.filter((x) => x.verdict === 'waste').length },
  };
}
