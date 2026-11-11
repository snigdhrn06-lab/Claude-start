// Deterministic attempt simulator. Used to (1) smoke-test the engine end to end and
// (2) generate clearly-labelled demo learners whose trails are produced by the real engine.
import { getCase } from '../cases/index.js';
import { newAttempt, act, finalize, evidenceIndex } from './caseEngine.js';

const BREWLY_TEXT = {
  high: { diagnosis: 'Brewly\'s growth came almost entirely from delivery, where contribution per order collapsed from about ₹72 to ₹39.5 after the renewal raised commission, discount funding and platform ads. At the same time roughly 41% of delivery customers are former regulars switching from dine-in orders worth ₹122, so the mix shift cannibalised richer in-store demand while fixed costs kept rising.',
    basis: 'Total contribution rose only ₹1.6 cr on ₹40 cr of extra revenue while fixed costs rose ₹9.5 cr. Restoring commission to 22% and halving discounts lifts delivery contribution by about ₹4 cr even with 15% fewer orders.',
    rationale: 'Delivery should be repriced rather than abandoned: renegotiate commission at the renewal in four months, end always-on discount funding, add a minimum order value and delivery-only bundles so each order earns an acceptable contribution.',
    priorities: ['Report contribution by channel monthly and set a contribution target for the growth team', 'Pilot discount removal and a ₹249 minimum order in Pune for six weeks', 'Open renewal negotiation with QuickDine using the second aggregator as leverage', 'Protect dine-in service at peak with a separate delivery pass'],
    risks: 'Delivery volume could fall more than 15% and QuickDine may reduce our ranking in retaliation; revenue growth will slow, which the investor and board must accept in exchange for profit. Execution risk in stores is moderate.',
    nextSteps: 'Within two weeks build the channel contribution dashboard and name an owner; launch the Pune pilot next month; begin contract renegotiation ahead of renewal and track orders, ranking and contribution weekly.' },
  mid: { diagnosis: 'Delivery has grown a lot but it makes much less margin per order than dine-in because of aggregator commission and discounts, so overall profit fell even though revenue grew strongly this year.',
    basis: 'Delivery contribution is about ₹39 per order against ₹122 in store, so growth added little profit; fixing terms could add ₹5 cr.',
    rationale: 'We should improve the delivery terms and reduce the discounts we fund, while keeping delivery as a channel because customers clearly want it.',
    priorities: ['Renegotiate the aggregator commission', 'Reduce discount funding gradually', 'Monitor delivery orders closely'],
    risks: 'Order volume may fall and the aggregator may not agree to lower commission, which would limit the benefit of the plan.',
    nextSteps: 'Start discussions with the aggregator and test lower discounts in a few stores over the next month to measure the effect.' },
  low: { diagnosis: 'Costs have gone up a lot this year across the business, especially for ingredients and new stores, and that is why profit is lower than last year even though sales are higher.',
    basis: 'Profit fell by around ₹8 cr so we need savings of at least that amount across costs.',
    rationale: 'The company should focus on reducing costs in all areas and be more careful about spending so that margins can recover to previous levels soon.',
    priorities: ['Reduce costs across stores', 'Review supplier contracts'],
    risks: 'There is a risk that cost cutting affects quality and that staff are unhappy with the changes being made.',
    nextSteps: 'Hold a meeting with the leadership team to agree on cost targets and then communicate them to all store managers.' },
};

function genericText(c, q) {
  const kw = (groups, n) => groups.slice(0, n).map((g) => g[0]).join(', ');
  const n = q === 'high' ? 9 : q === 'mid' ? 2 : 0; const cur = c.currency;
  return {
    diagnosis: n ? `${c.debrief.headline} The evidence points to ${kw(c.concepts.diagnosis, n)} as the mechanism, and the pattern is concentrated rather than company-wide, which rules out the broader explanations offered by management.` : 'Performance has deteriorated because of several external pressures in the market this year, including competitors and rising costs, which management could not fully control or anticipate in advance.',
    basis: `The affected area accounts for most of the deterioration; correcting it is worth roughly ${cur}${q === 'low' ? '2' : '30'} ${cur === '$' ? 'M' : 'cr'} a year on our estimate from the unit economics.`,
    rationale: 'This direction addresses the mechanism the evidence identifies rather than its symptoms, and can be sequenced so that early results are measurable before the larger commitments are made.',
    priorities: q === 'low' ? ['Review the situation with management', 'Set up a task force'] : ['Change the incentive and reporting that created the problem', 'Run a controlled pilot before full rollout', 'Redeploy spend toward the healthy segments'],
    risks: n ? `The main risks are ${kw(c.concepts.risks, n)}; each is manageable with a phased approach and clear thresholds.` : 'There may be some resistance internally and results could take longer than expected to appear in the numbers.',
    nextSteps: n ? `Immediately: ${kw(c.concepts.nextSteps, n)}; assign an owner for each and review progress every week for the first quarter.` : 'Arrange follow-up meetings with each department head and prepare a more detailed plan over the coming period.',
  };
}
const defenceText = (ch, q) => {
  const g = ch.concepts; const pick = (n) => g.slice(0, n).map((x) => x[0]).join(', ');
  if (q === 'high') return `I understand the concern. The answer rests on ${pick(4)}. On our numbers the effect is about 6 cr in a range between 3 and 9, and the assumption that matters most is how much volume we lose. If that assumption fails we stop, measure and adjust before scaling further.`;
  if (q === 'mid') return `That is a fair challenge. The key points are ${pick(2)}, and I believe the plan holds because the current path is clearly not sustainable for the business over the medium term.`;
  return 'I believe the recommendation is correct and the team should support it because the analysis shows it is the best available option for the company at this point in time.';
};

function rebalance(alloc, hyps, S, step) {
  const raw = {}; for (const h of hyps) raw[h.id] = Math.max(0, (alloc[h.id] || 0) + step * (S[h.driver] || 0));
  const tot = Object.values(raw).reduce((s, v) => s + v, 0) || 1; const out = {}; let sum = 0;
  for (const h of hyps) { out[h.id] = Math.floor((raw[h.id] / tot) * 100); sum += out[h.id]; }
  const order = [...hyps].sort((x, y) => (raw[y.id] / tot) * 100 % 1 - (raw[x.id] / tot) * 100 % 1);
  for (let i = 0; sum < 100; i++, sum++) out[order[i % order.length].id] += 1;
  return out;
}

export async function simulate(userId, caseId, p, opts = {}) {
  const c = getCase(caseId);
  const a = newAttempt(userId, caseId, { now: opts.startAt || Date.now() - 86400000, classroomId: opts.classroomId, seeded: true });
  a._sim = opts.stepMs || 95000;
  for (const d of p.hyps) { const seed = c.hypothesisSeeds.find((s) => s.driver === d); await act(a, 'hyp_add', { driver: d, text: seed?.text || `${c.drivers.find((x) => x.id === d).label} has deteriorated and is driving the decline in performance.` }); }
  const hyps = () => a.hypotheses.filter((h) => !h.deleted);
  await act(a, 'conf_commit', { alloc: Object.fromEntries(hyps().map((h, i) => [h.id, p.init[i]])) });
  let n = 0;
  const maybeUpdate = async (refs) => {
    n++; if (p.update === 'none') return; if (p.update === 'partial' && n % 2) return;
    const S = {}; const idx = evidenceIndex(a, c); for (const r of refs) for (const [k, v] of Object.entries(idx.find((e) => e.ref === r)?.signals || {})) S[k] = (S[k] || 0) + v;
    await act(a, 'conf_commit', { alloc: rebalance(a.alloc, hyps(), S, p.update === 'partial' ? 5 : 9) });
  };
  for (const st of p.steps) {
    try {
      if (st.ds) { await act(a, 'data_request', { datasetId: st.ds }); await maybeUpdate([`ds:${st.ds}`]); }
      else if (st.iv) { await act(a, 'interview_start', { stakeholderId: st.iv }); const before = a.cards.length; for (const q of st.qs) await act(a, 'interview_ask', { stakeholderId: st.iv, question: q }); if (a.cards.length > before) await maybeUpdate(a.cards.slice(before).map((r) => `iv:${r}`)); }
      else if (st.add) { await act(a, 'hyp_add', { driver: st.add, text: c.hypothesisSeeds.find((s) => s.driver === st.add)?.text || `${c.drivers.find((x) => x.id === st.add).label} explains the deterioration better than my earlier hypotheses.` }); await act(a, 'conf_commit', { alloc: rebalance({ ...a.alloc, [hyps().at(-1).id]: 25 }, hyps(), {}, 0) }); }
      else if (st.q) { const def = c.quant.find((x) => x.id === st.q); await act(a, 'quant_answer', { qid: st.q, value: st.ok === false ? def.answer * 1.4 + 3 : def.answer }); }
      else if (st.scn) await act(a, 'scenario', { inputs: st.scn });
    } catch (e) { if (opts.strict) throw e; }
  }
  const idx = evidenceIndex(a, c);
  if (p.links) for (const h of hyps()) for (const e of idx) { const s = e.signals[h.driver] || 0; if (Math.abs(s) >= 2 && h.links.length < 2) await act(a, 'link', { hypId: h.id, ref: e.ref, stance: s > 0 ? 'supports' : 'contradicts' }); }
  if (!a.allocCommitted) await act(a, 'conf_commit', { alloc: rebalance(a.alloc, hyps(), {}, 0) });
  if (opts.stopBeforeRec) { delete a._sim; return a; }
  const lead = p.lead.map((d) => hyps().find((h) => h.driver === d)?.id).filter(Boolean);
  const txt = caseId === 'brewly' ? BREWLY_TEXT[p.text] : genericText(c, p.text);
  const opt = c.options.find((o) => o.id === p.option);
  const cites = idx.filter((e) => p.text === 'low' ? true : p.lead.some((d) => (e.signals[d] || 0) > 0)).slice(0, 4).map((e) => e.ref);
  await act(a, 'submit_rec', { leadHypIds: lead.length ? lead : [hyps()[0].id], ...txt, evidence: cites.length >= 2 ? cites : idx.slice(0, 2).map((e) => e.ref), impact: p.impact ?? (opt.impact[0] + opt.impact[1]) / 2, optionId: p.option });
  for (const ch of c.boardroom.challenges) await act(a, 'defend', { response: defenceText(ch, p.defence || p.text) });
  await act(a, 'twist', { stance: p.stance || c.boardroom.twist.stances[0].id, text: defenceText({ concepts: c.boardroom.twist.concepts }, p.defence || p.text) });
  delete a._sim;
  finalize(a, { priorCompletions: 0 });
  return a;
}

// Learner archetypes. Each yields a recognisably different trail through the same case.
export const ARCHETYPES = {
  brewly: {
    expert: { hyps: ['channel_econ', 'input', 'expansion', 'cannibal', 'competition'], init: [25, 20, 20, 20, 15], update: 'good', links: true, text: 'high', lead: ['channel_econ', 'cannibal'], option: 'A', stance: 'counter', impact: 8,
      steps: [{ ds: 'pnl' }, { ds: 'channel_rev' }, { ds: 'channel_econ' }, { q: 'q1' }, { q: 'q2' }, { q: 'q3' }, { q: 'q4' }, { iv: 'growth', qs: ['What changed in the QuickDine contract at renewal and the commission?', 'How are the Chai Hour discounts funded?'] }, { ds: 'aggregator' }, { ds: 'survey' }, { q: 'q5' }, { scn: { commission: 22, discount: 6, ads: 5, volume: -15, recapture: 20 } }] },
    customer: { hyps: ['cannibal', 'competition', 'pricing', 'channel_econ'], init: [35, 25, 15, 25], update: 'good', links: true, text: 'high', lead: ['cannibal', 'channel_econ'], option: 'B', stance: 'counter', impact: 6,
      steps: [{ ds: 'channel_rev' }, { ds: 'stores' }, { iv: 'manager', qs: ['Are your regular customers switching to delivery orders?'] }, { ds: 'survey' }, { ds: 'channel_econ' }, { q: 'q1' }, { q: 'q2' }, { q: 'q3' }] },
    anchored: { hyps: ['input', 'expansion', 'channel_econ'], init: [70, 20, 10], update: 'none', links: false, text: 'low', lead: ['input'], option: 'E', stance: 'accept', impact: 9, defence: 'low',
      steps: [{ ds: 'input' }, { ds: 'pnl' }, { ds: 'pricing' }, { ds: 'regional' }, { iv: 'cfo', qs: ['Tell me about milk and ingredient cost inflation'] }, { q: 'q4', ok: false }] },
    hoarder: { hyps: ['channel_econ', 'competition', 'input', 'expansion'], init: [25, 25, 25, 25], update: 'partial', links: false, text: 'mid', lead: ['channel_econ'], option: 'A', stance: 'accept', impact: 5, defence: 'mid',
      steps: [{ ds: 'pnl' }, { ds: 'regional' }, { ds: 'competitor' }, { ds: 'pricing' }, { ds: 'input' }, { ds: 'channel_rev' }, { ds: 'channel_econ' }, { q: 'q1' }, { q: 'q3' }] },
    quantweak: { hyps: ['channel_econ', 'cannibal', 'labour', 'input'], init: [30, 30, 20, 20], update: 'good', links: true, text: 'mid', lead: ['channel_econ'], option: 'A', stance: 'counter', impact: 25, defence: 'mid',
      steps: [{ ds: 'channel_rev' }, { ds: 'channel_econ' }, { q: 'q1', ok: false }, { q: 'q2', ok: false }, { ds: 'aggregator' }, { iv: 'coo', qs: ['What is happening to dine-in footfall in mature stores?'] }, { ds: 'survey' }, { q: 'q3' }] },
    fixedcost: { hyps: ['expansion', 'labour', 'input', 'competition'], init: [40, 25, 20, 15], update: 'partial', links: true, text: 'mid', lead: ['expansion'], option: 'D', stance: 'reject', impact: 4, defence: 'mid',
      steps: [{ ds: 'pnl' }, { ds: 'stores' }, { ds: 'labour' }, { iv: 'coo', qs: ['Are the new stores ramping to plan after opening?', 'How has kitchen labour and staffing changed?'] }, { ds: 'input' }, { q: 'q4' }] },
    latecomer: { hyps: ['input', 'competition', 'pricing'], init: [40, 35, 25], update: 'good', links: true, text: 'high', lead: ['channel_econ'], option: 'A', stance: 'counter', impact: 7,
      steps: [{ ds: 'pnl' }, { ds: 'input' }, { add: 'channel_econ' }, { ds: 'channel_rev' }, { ds: 'channel_econ' }, { q: 'q1' }, { q: 'q2' }, { q: 'q3' }, { q: 'q4' }, { ds: 'aggregator' }] },
  },
  northstar: {
    solid: { hyps: ['acq', 'fees', 'rates', 'service'], init: [30, 25, 25, 20], update: 'good', links: true, text: 'high', lead: ['acq', 'fees'], option: 'A', stance: 'preempt', impact: 90,
      steps: [{ ds: 'segments' }, { ds: 'fees' }, { q: 'q4' }, { q: 'q5' }, { ds: 'channels' }, { q: 'q1' }, { q: 'q2' }, { ds: 'cohort' }, { q: 'q3', ok: false }, { iv: 'cmo', qs: ['What targets and KPI is marketing measured on?', 'How are DSA partners paid — is there a clawback?'] }] },
    ratesfirst: { hyps: ['rates', 'service', 'fees'], init: [50, 30, 20], update: 'partial', links: false, text: 'mid', lead: ['fees'], option: 'B', stance: 'preempt', impact: 35, defence: 'mid',
      steps: [{ ds: 'rates' }, { ds: 'app' }, { ds: 'complaints' }, { ds: 'fees' }, { q: 'q4' }, { ds: 'kpi' }] },
  },
  cloudaxis: {
    solid: { hyps: ['mix', 'competition', 'reliability', 'onboarding'], init: [30, 30, 20, 20], update: 'good', links: true, text: 'mid', lead: ['mix'], option: 'A', stance: 'hybrid', impact: 9, defence: 'mid',
      steps: [{ ds: 'segments' }, { ds: 'unit' }, { q: 'q1' }, { q: 'q2' }, { q: 'q3', ok: false }, { ds: 'churn' }, { ds: 'cohorts' }, { iv: 'cs', qs: ['How does onboarding and activation work for small customers?'] }, { q: 'q4', ok: false }] },
  },
};
