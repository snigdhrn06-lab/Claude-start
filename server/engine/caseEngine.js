// Investigation engine: a server-side state machine over a structured case definition.
// The client only ever receives view(attempt); hidden case fields never leave the server.
import { getCase } from '../cases/index.js';
import { uid } from '../store.js';
import { evaluate } from '../../shared/expr.js';
import { clean, wc, coverage, hasNumber, clamp } from './text.js';
import { stakeholderVoice, rubricGrade, aiEnabled } from './ai.js';
import { scoreAttempt } from './scoring.js';

export class ActionError extends Error { constructor(msg, fields) { super(msg); this.fields = fields; this.status = 400; } }
const fail = (msg, fields) => { throw new ActionError(msg, fields); };
const MAX_HYP = 8, MAX_QUESTIONS = 6, MAX_TRIES = 3;

export function newAttempt(userId, caseId, opts = {}) {
  const c = getCase(caseId);
  if (!c) fail('Unknown case');
  const now = opts.now || Date.now();
  return {
    id: uid('att_'), userId, caseId, status: 'active', phase: 'investigate', startedAt: now, completedAt: null,
    classroomId: opts.classroomId || null, seeded: Boolean(opts.seeded),
    hoursUsed: 0, hypotheses: [], alloc: {}, allocCommitted: false, pendingEvidence: [],
    requested: [], interviews: {}, cards: [], quant: {}, calcs: [], scenarioRuns: [], hintsUsed: 0,
    recommendation: null, defence: null, events: [{ t: now, type: 'start' }], result: null, _clock: now,
  };
}
const log = (a, type, data = {}) => { const t = a._sim ? (a._clock += a._sim) : Date.now(); a.events.push({ t, type, ...data }); return t; };
const activeHyps = (a) => a.hypotheses.filter((h) => !h.deleted);

export function evidenceIndex(a, c) {
  const out = [];
  for (const id of a.requested) { const d = c.datasets.find((x) => x.id === id); out.push({ ref: `ds:${id}`, kind: 'data', label: d.title, signals: d.signals || {} }); }
  for (const ref of a.cards) {
    const [sid, cid] = ref.split(':'); const s = c.stakeholders.find((x) => x.id === sid); const card = s.cards.find((x) => x.id === cid);
    out.push({ ref: `iv:${ref}`, kind: 'interview', label: `${s.name} — ${card.topic}`, signals: card.signals || {} });
  }
  for (const [qid, q] of Object.entries(a.quant)) if (q.correct) {
    const def = c.quant.find((x) => x.id === qid); const d = c.datasets.find((x) => x.id === def.requires[0]);
    out.push({ ref: `q:${qid}`, kind: 'calc', label: `Calculation — ${def.prompt.slice(0, 60)}${def.prompt.length > 60 ? '…' : ''}`, signals: d?.signals || {} });
  }
  return out;
}

function publicCase(c) {
  return {
    id: c.id, title: c.title, company: c.company, industry: c.industry, func: c.func, problemType: c.problemType,
    difficulty: c.difficulty, difficultyLabel: c.difficultyLabel, durationMin: c.durationMin, xpReward: c.xpReward,
    budgetHours: c.budgetHours, skills: c.skills, tags: c.tags, blurb: c.blurb, currency: c.currency, briefing: c.briefing,
    drivers: c.drivers.map((d) => ({ id: d.id, label: d.label })), hypothesisSeeds: c.hypothesisSeeds.map((s) => ({ text: s.text, driver: s.driver })),
    datasets: c.datasets.map((d) => ({ id: d.id, title: d.title, category: d.category, cost: d.cost, relevance: d.relevance, description: d.description })),
    stakeholders: c.stakeholders.map((s) => ({ id: s.id, name: s.name, role: s.role, cost: s.cost, persona: s.persona, topics: s.cards.length })),
    quant: c.quant.map((q) => ({ id: q.id, prompt: q.prompt, unit: q.unit, requires: q.requires })),
    scenario: { title: c.scenario.title, note: c.scenario.note, levers: c.scenario.levers, requires: c.scenario.requires },
    options: c.options.map((o) => ({ id: o.id, label: o.label, detail: o.detail })), hintCount: c.hints.length,
    impactUnit: c.currency === '$' ? '$M per year' : '₹ cr per year',
  };
}
export const caseCard = (c) => { const p = publicCase(c); return { id: p.id, title: p.title, company: p.company, industry: p.industry, func: p.func, problemType: p.problemType, difficulty: p.difficulty, difficultyLabel: p.difficultyLabel, durationMin: p.durationMin, xpReward: p.xpReward, skills: p.skills, tags: p.tags, blurb: p.blurb, budgetHours: p.budgetHours, unlockRank: c.unlockRank || 0 }; };
export const caseBrief = (c) => publicCase(c);

export function view(a) {
  const c = getCase(a.caseId);
  const datasets = {};
  for (const id of a.requested) { const d = c.datasets.find((x) => x.id === id); datasets[id] = { table: d.table, chart: d.chart || null }; }
  const quant = {};
  for (const [qid, q] of Object.entries(a.quant)) { const def = c.quant.find((x) => x.id === qid); quant[qid] = { ...q, explain: q.correct || q.tries >= MAX_TRIES ? def.explain : null }; }
  let boardroom = null;
  if (a.defence) {
    const d = a.defence; const next = d.queue[0];
    const ch = next ? c.boardroom.challenges.find((x) => x.id === next) : null;
    boardroom = {
      ceo: c.boardroom.ceo, total: d.done.length + d.queue.length, done: d.done,
      current: ch ? { id: ch.id, kind: ch.kind, prompt: challengePrompt(ch, a) } : null,
      twist: !next ? { title: c.boardroom.twist.title, prompt: c.boardroom.twist.prompt, facts: c.boardroom.twist.facts, stances: c.boardroom.twist.stances.map((s) => ({ id: s.id, label: s.label })), answer: d.twist } : null,
    };
  }
  return {
    id: a.id, caseId: a.caseId, status: a.status, phase: a.phase, startedAt: a.startedAt, completedAt: a.completedAt,
    hoursUsed: a.hoursUsed, budget: c.budgetHours, case: publicCase(c),
    hypotheses: activeHyps(a), alloc: a.alloc, allocCommitted: a.allocCommitted, pendingEvidence: a.pendingEvidence,
    snapshots: a.events.filter((e) => e.type === 'conf_commit' || e.type === 'conf_hold').length,
    requested: a.requested, datasets, interviews: a.interviews, quant, calcs: a.calcs.slice(-12), scenarioRuns: a.scenarioRuns.slice(-6),
    hints: c.hints.slice(0, a.hintsUsed), evidence: evidenceIndex(a, c).map(({ signals, ...e }) => e),
    recommendation: a.recommendation, boardroom, aiAssisted: aiEnabled(),
    result: a.result ? { overall: a.result.overall, xp: a.result.xp.total } : null,
  };
}
const challengePrompt = (ch, a) => (ch.forOptions && ch.fallbackPrompt && !ch.forOptions.includes(a.recommendation?.optionId) ? ch.fallbackPrompt : ch.prompt);

function spend(a, c, hours) {
  if (a.hoursUsed + hours > c.budgetHours) fail(`Not enough analyst hours: ${c.budgetHours - a.hoursUsed}h remaining, ${hours}h needed.`);
  a.hoursUsed += hours;
}
function noteEvidence(a, ref) {
  if (a.pendingEvidence.length && a._implicit !== false) log(a, 'implicit_hold', { after: [...a.pendingEvidence] });
  a.pendingEvidence = [ref];
}
function addPending(a, ref) { if (!a.pendingEvidence.includes(ref)) a.pendingEvidence.push(ref); }

function pickCards(s, question) {
  const q = question.toLowerCase();
  const scored = s.cards.map((card) => ({ card, n: card.keywords.filter((k) => q.includes(k)).length })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
  return scored.slice(0, wc(question) >= 12 ? 2 : 1).map((x) => x.card);
}

const handlers = {
  hyp_add(a, c, p) {
    if (a.phase !== 'investigate') fail('The investigation is closed.');
    if (activeHyps(a).length >= MAX_HYP) fail(`A board holds at most ${MAX_HYP} hypotheses. Merge or remove one first.`);
    const text = clean(p.text, 280);
    if (wc(text) < 4) fail('State the hypothesis as a testable sentence (at least four words).');
    if (!c.drivers.some((d) => d.id === p.driver) && p.driver !== 'other') fail('Choose the area this hypothesis belongs to.');
    const h = { id: uid('h_'), text, driver: p.driver, createdAt: log(a, 'hyp_add', { text, driver: p.driver }), links: [], preData: a.requested.length === 0 && a.cards.length === 0 };
    a.events[a.events.length - 1].hypId = h.id;
    a.hypotheses.push(h); a.alloc[h.id] = 0;
    if (activeHyps(a).length > 1) a.allocCommitted = false;
  },
  hyp_edit(a, c, p) {
    const h = activeHyps(a).find((x) => x.id === p.id) || fail('Hypothesis not found');
    const text = clean(p.text, 280);
    if (wc(text) < 4) fail('State the hypothesis as a testable sentence (at least four words).');
    if (!c.drivers.some((d) => d.id === p.driver) && p.driver !== 'other') fail('Choose the area this hypothesis belongs to.');
    h.text = text; h.driver = p.driver; log(a, 'hyp_edit', { hypId: h.id, text, driver: p.driver });
  },
  hyp_delete(a, c, p) {
    const h = activeHyps(a).find((x) => x.id === p.id) || fail('Hypothesis not found');
    h.deleted = true; const freed = a.alloc[h.id] || 0; delete a.alloc[h.id];
    if (freed > 0) a.allocCommitted = false;
    log(a, 'hyp_delete', { hypId: h.id, text: h.text });
  },
  conf_commit(a, c, p) {
    const hyps = activeHyps(a);
    if (hyps.length < 2) fail('Hold at least two competing hypotheses before allocating confidence.');
    const alloc = {}; let sum = 0;
    for (const h of hyps) { const v = Math.round(Number(p.alloc?.[h.id])); if (!Number.isFinite(v) || v < 0 || v > 100) fail('Each allocation must be between 0 and 100.'); alloc[h.id] = v; sum += v; }
    if (sum !== 100) fail(`Confidence must total 100 points (currently ${sum}).`);
    const same = a.allocCommitted && hyps.every((h) => a.alloc[h.id] === alloc[h.id]);
    a.alloc = alloc; a.allocCommitted = true;
    log(a, same ? 'conf_hold' : 'conf_commit', { alloc: { ...alloc }, byDriver: byDriver(a), after: [...a.pendingEvidence], note: clean(p.note, 200) });
    a.pendingEvidence = [];
  },
  data_request(a, c, p) {
    if (a.phase !== 'investigate') fail('The investigation is closed.');
    if (!a.allocCommitted) fail('Commit a confidence allocation across at least two hypotheses before requesting data.');
    const d = c.datasets.find((x) => x.id === p.datasetId) || fail('Unknown dataset');
    if (a.requested.includes(d.id)) fail('Already received.');
    spend(a, c, d.cost); noteEvidence(a, `ds:${d.id}`); a.requested.push(d.id);
    log(a, 'data_request', { datasetId: d.id, cost: d.cost });
  },
  interview_start(a, c, p) {
    if (a.phase !== 'investigate') fail('The investigation is closed.');
    if (!a.allocCommitted) fail('Commit a confidence allocation before scheduling interviews.');
    const s = c.stakeholders.find((x) => x.id === p.stakeholderId) || fail('Unknown stakeholder');
    if (a.interviews[s.id]) fail('Interview already scheduled.');
    spend(a, c, s.cost);
    a.interviews[s.id] = { turns: [{ role: 'them', text: s.opener }], questions: 0 };
    log(a, 'interview_start', { stakeholderId: s.id, cost: s.cost });
  },
  async interview_ask(a, c, p) {
    if (a.phase !== 'investigate') fail('The investigation is closed.');
    const s = c.stakeholders.find((x) => x.id === p.stakeholderId) || fail('Unknown stakeholder');
    const iv = a.interviews[s.id] || fail('Schedule the interview first.');
    if (iv.questions >= MAX_QUESTIONS) fail(`${s.name} has run out of time. Each interview allows ${MAX_QUESTIONS} questions.`);
    const question = clean(p.question, 400);
    if (wc(question) < 2) fail('Ask a question.');
    const vague = wc(question) < 4;
    const cards = vague ? [] : pickCards(s, question);
    const fresh = cards.filter((card) => !a.cards.includes(`${s.id}:${card.id}`));
    const fallback = cards.length ? cards.map((x) => x.answer).join(' ') : vague || /\b(what|tell|everything|anything|problem|wrong|think|opinion|going on)\b/i.test(question) ? s.vague : s.outOfScope;
    const text = a._sim ? fallback : await stakeholderVoice({ stakeholder: s, company: c.company, question, cards, fallback });
    iv.questions += 1;
    iv.turns.push({ role: 'you', text: question }, { role: 'them', text, cards: cards.map((x) => x.topic), grounded: cards.length > 0 });
    for (const card of fresh) { const ref = `${s.id}:${card.id}`; a.cards.push(ref); if (Object.keys(card.signals || {}).length) { if (a.pendingEvidence.length && !a.pendingEvidence.some((r) => r.startsWith(`iv:${s.id}:`))) noteEvidence(a, `iv:${ref}`); else addPending(a, `iv:${ref}`); } }
    log(a, 'interview_q', { stakeholderId: s.id, question, cardIds: fresh.map((x) => x.id), hit: cards.length > 0 });
  },
  link(a, c, p) {
    const h = activeHyps(a).find((x) => x.id === p.hypId) || fail('Hypothesis not found');
    const ev = evidenceIndex(a, c).find((e) => e.ref === p.ref) || fail('You do not hold that evidence.');
    h.links = h.links.filter((l) => l.ref !== ev.ref);
    if (p.stance === 'supports' || p.stance === 'contradicts') h.links.push({ ref: ev.ref, stance: p.stance, label: ev.label });
    log(a, 'link', { hypId: h.id, ref: ev.ref, stance: p.stance || null });
  },
  calc(a, c, p) {
    const expr = clean(p.expr, 300); const vars = {};
    for (const [k, v] of Object.entries(p.vars || {}).slice(0, 40)) if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) && Number.isFinite(Number(v))) vars[k] = Number(v);
    let result; try { result = evaluate(expr, vars); } catch (e) { fail(e.message); }
    const entry = { id: uid('c_'), expr, vars, result, label: clean(p.label, 80), t: log(a, 'calc', { expr, result, label: clean(p.label, 80) }) };
    a.calcs.push(entry);
  },
  quant_answer(a, c, p) {
    if (a.phase !== 'investigate') fail('The investigation is closed.');
    const q = c.quant.find((x) => x.id === p.qid) || fail('Unknown question');
    const missing = q.requires.filter((r) => !a.requested.includes(r));
    if (missing.length) fail('You do not yet hold the data needed for this calculation.');
    const cur = a.quant[q.id] || { tries: 0, correct: false };
    if (cur.correct) fail('Already answered correctly.');
    if (cur.tries >= MAX_TRIES) fail('No attempts remaining for this question.');
    const value = Number(p.value); if (!Number.isFinite(value)) fail('Enter a number.');
    const correct = Math.abs(value - q.answer) <= q.tolAbs;
    a.quant[q.id] = { value, correct, tries: cur.tries + 1, firstTry: correct && cur.tries === 0 };
    log(a, 'quant_answer', { qid: q.id, value, correct, tries: cur.tries + 1 });
  },
  scenario(a, c, p) {
    const missing = c.scenario.requires.filter((r) => !a.requested.includes(r));
    if (missing.length) fail('The simulator needs data you have not requested yet.');
    const inputs = {};
    for (const l of c.scenario.levers) { const v = Number(p.inputs?.[l.key]); inputs[l.key] = Number.isFinite(v) ? clamp(v, l.min, l.max) : l.default; }
    const out = c.scenario.compute(inputs);
    a.scenarioRuns.push({ inputs, ...out }); if (a.scenarioRuns.length > 12) a.scenarioRuns.shift();
    log(a, 'scenario', { inputs, headline: out.outputs.find((o) => o.highlight) });
  },
  hint(a, c) {
    if (a.hintsUsed >= c.hints.length) fail('No more hints for this case.');
    a.hintsUsed += 1; log(a, 'hint', { n: a.hintsUsed });
  },
  submit_rec(a, c, p) {
    if (a.phase !== 'investigate') fail('Recommendation already submitted.');
    const held = evidenceIndex(a, c); const hyps = activeHyps(a); const f = {};
    const lead = [...new Set(Array.isArray(p.leadHypIds) ? p.leadHypIds : [])].filter((id) => hyps.some((h) => h.id === id)).slice(0, 2);
    if (!lead.length) f.leadHypIds = 'Select the one or two hypotheses your diagnosis rests on.';
    const diagnosis = clean(p.diagnosis, 1500); if (wc(diagnosis) < 20) f.diagnosis = 'State the diagnosis in at least 20 words: what is happening and why.';
    const evidence = [...new Set(Array.isArray(p.evidence) ? p.evidence : [])].filter((r) => held.some((e) => e.ref === r)).slice(0, 8);
    if (evidence.length < 2) f.evidence = 'Cite at least two pieces of evidence you actually hold.';
    const basis = clean(p.basis, 1000); if (wc(basis) < 10 || !hasNumber(basis)) f.basis = 'Explain the financial implication in at least 10 words, with numbers.';
    const impact = Number(p.impact); if (p.impact === '' || p.impact == null || !Number.isFinite(impact)) f.impact = 'Enter your estimate of annual profit impact.';
    const option = c.options.find((o) => o.id === p.optionId); if (!option) f.optionId = 'Choose a strategic direction.';
    const rationale = clean(p.rationale, 1500); if (wc(rationale) < 15) f.rationale = 'Justify the recommendation in at least 15 words.';
    const priorities = (Array.isArray(p.priorities) ? p.priorities : []).map((x) => clean(x, 200)).filter((x) => wc(x) >= 3).slice(0, 5);
    if (priorities.length < 2) f.priorities = 'List at least two implementation priorities.';
    const risks = clean(p.risks, 1000); if (wc(risks) < 10) f.risks = 'Describe the main risks and trade-offs (10+ words).';
    const nextSteps = clean(p.nextSteps, 1000); if (wc(nextSteps) < 10) f.nextSteps = 'Describe the immediate next steps (10+ words).';
    if (!a.allocCommitted) f.leadHypIds = 'Commit your final confidence allocation on the hypothesis board first.';
    if (Object.keys(f).length) fail('The recommendation is incomplete.', f);
    if (a.pendingEvidence.length) { log(a, 'implicit_hold', { after: [...a.pendingEvidence] }); a.pendingEvidence = []; }
    a.recommendation = { leadHypIds: lead, diagnosis, evidence, basis, impact, optionId: option.id, optionLabel: option.label, rationale, priorities, risks, nextSteps };
    a.phase = 'boardroom'; a.defence = { queue: c.boardroom.challenges.map((x) => x.id), done: [], twist: null };
    log(a, 'submit_rec', { optionId: option.id, leadHypIds: lead, evidence });
  },
  async defend(a, c, p) {
    if (a.phase !== 'boardroom' || !a.defence.queue.length) fail('No challenge is open.');
    const ch = c.boardroom.challenges.find((x) => x.id === a.defence.queue[0]);
    const response = clean(p.response, 1500);
    if (wc(response) < 12) fail('Answer the challenge properly — at least a couple of sentences.');
    const cov = coverage(response, ch.concepts);
    let det = cov.score; if (ch.needsNumber && !hasNumber(response)) det *= 0.6; if (wc(response) < 25) det *= 0.8;
    let score = det, reaction = det >= 0.6 ? ch.strong : det >= 0.35 ? `Partly. ${ch.weak}` : ch.weak, mode = 'deterministic rubric';
    const prompt = challengePrompt(ch, a);
    if (!a._sim) {
      const g = await rubricGrade({ role: `${c.boardroom.ceo.name}, ${c.boardroom.ceo.role} of ${c.company}`, prompt, response,
        criteria: ['Directly addresses the concern raised rather than restating the recommendation', 'Uses specific evidence or numbers from the case', 'Acknowledges the trade-off or risk honestly', 'Is concrete about what would be done or measured'] });
      if (g) { const ai = g.scores.reduce((s, x) => s + x, 0) / g.scores.length; score = 0.5 * det + 0.5 * ai; if (g.reaction) reaction = g.reaction; mode = 'rubric + AI-assisted'; }
    }
    a.defence.queue.shift();
    a.defence.done.push({ id: ch.id, kind: ch.kind, prompt, response, score: Math.round(score * 100) / 100, covered: cov.hit.length, of: ch.concepts.length, reaction, mode });
    log(a, 'defence', { challengeId: ch.id, score });
  },
  twist(a, c, p) {
    if (a.phase !== 'boardroom' || a.defence.queue.length) fail('Finish the challenges first.');
    if (a.defence.twist) fail('Already answered.');
    const st = c.boardroom.twist.stances.find((s) => s.id === p.stance) || fail('Choose how you respond.');
    const text = clean(p.text, 1500); if (wc(text) < 12) fail('Explain your position in at least a couple of sentences.');
    const cov = coverage(text, c.boardroom.twist.concepts);
    const score = 0.6 * st.quality + 0.4 * cov.score;
    a.defence.twist = { stance: st.id, stanceLabel: st.label, text, score: Math.round(score * 100) / 100, note: st.note };
    log(a, 'twist', { stance: st.id, score });
    a.status = 'completed'; a.phase = 'done'; a.completedAt = a._sim ? a._clock : Date.now(); log(a, 'complete');
  },
};

function byDriver(a) { const out = {}; for (const h of activeHyps(a)) out[h.driver] = (out[h.driver] || 0) + (a.alloc[h.id] || 0); return out; }

export async function act(attempt, type, payload = {}) {
  const c = getCase(attempt.caseId);
  if (attempt.status !== 'active') fail('This attempt is closed.');
  const h = handlers[type]; if (!h) fail('Unknown action');
  await h(attempt, c, payload || {});
  return attempt;
}
export function finalize(attempt, ctx) { attempt.result = scoreAttempt(attempt, getCase(attempt.caseId), ctx); return attempt.result; }
