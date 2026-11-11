// Arena modes. Each mode exposes start(user) -> public puzzle and grade(session, answer) -> result.
// Puzzle truth stays on the server; sessions are held in memory and bound to the user.
import { uid } from '../store.js';
import { clamp } from '../engine/text.js';
import { dayKey } from '../engine/progression.js';

export const MODES = [
  { id: 'daily', name: 'Daily Diagnostic', tagline: 'One short business problem. Allocate, look once, decide.', skills: ['calibration', 'hypothesis'], xp: 60, minRank: 0, minutes: 4 },
  { id: 'issue-tree', name: 'Issue Tree Arena', tagline: 'Build a MECE issue tree and have its logic checked.', skills: ['structuring', 'hypothesis'], xp: 90, minRank: 0, minutes: 8 },
  { id: 'margin', name: 'Margin Detective', tagline: 'Profit moved. Spend four probes finding out why.', skills: ['quant', 'evidence'], xp: 80, minRank: 0, minutes: 6 },
  { id: 'duel', name: 'Hypothesis Duel', tagline: 'Two explanations, five pieces of evidence. Update as you go.', skills: ['calibration', 'hypothesis'], xp: 70, minRank: 1, minutes: 5 },
  { id: 'blitz', name: 'Boardroom Blitz', tagline: 'Three objections, forty-five seconds each.', skills: ['synthesis'], xp: 70, minRank: 1, minutes: 3 },
  { id: 'market', name: 'Market Strategy Challenge', tagline: 'Four quarters against a competitor that reacts.', skills: ['synthesis', 'structuring'], xp: 100, minRank: 2, minutes: 7 },
];

// ---------------------------------------------------------------- Daily Diagnostic
const DAILY = [
  { id: 'd1', title: 'The gym that got busier', scenario: 'A chain of 22 fitness clubs reports membership up 14% year on year. Monthly revenue is flat and member complaints about crowding have doubled.',
    hyps: [['a', 'Growth came from a heavily discounted off-peak plan that members use at peak times'], ['b', 'Existing members are downgrading to cheaper tiers'], ['c', 'Ancillary revenue (classes, training) has collapsed'], ['d', 'Corporate contracts were renegotiated at lower rates']], truth: { a: 55, b: 20, c: 10, d: 15 },
    clues: [['x', 'Revenue per member by plan', 'The new ₹999 "Flex" plan is 31% of members and 12% of revenue. 68% of Flex check-ins are between 6 and 9 pm.'], ['y', 'Member satisfaction survey', 'Overall satisfaction fell from 4.2 to 3.7. Top complaint: equipment wait times.'], ['z', 'Competitor price list', 'Two rivals charge ₹1,400–1,800 for comparable access.']], bestClue: 'x',
    decisions: [['p', 'Restrict the Flex plan to genuine off-peak hours and grandfather existing members for 60 days'], ['q', 'Raise prices 10% across all plans'], ['r', 'Open three new clubs to relieve crowding'], ['s', 'Launch a referral campaign']], best: 'p', ok: [],
    explain: 'Volume grew in the cheapest plan, used at the most expensive time. Revenue per member by plan is the one cut that separates all four hypotheses; satisfaction data only confirms a symptom.' },
  { id: 'd2', title: 'The dashboard nobody opens', scenario: 'A B2B analytics start-up sees trial sign-ups rise 40% after a product-hunt launch. Trial-to-paid conversion fell from 18% to 9%.',
    hyps: [['a', 'The launch attracted hobbyists outside the target customer profile'], ['b', 'A recent onboarding change broke activation'], ['c', 'A competitor undercut on price'], ['d', 'The sales team is overwhelmed and following up late']], truth: { a: 50, b: 20, c: 5, d: 25 },
    clues: [['x', 'Conversion by sign-up source', 'Organic and referral trials still convert at 19%. Launch-sourced trials convert at 3%; 71% use personal email addresses.'], ['y', 'Average first-response time', 'Sales first response rose from 4 hours to 11 hours.'], ['z', 'Pricing page analytics', 'Visits to the pricing page per trial are unchanged.']], bestClue: 'x',
    decisions: [['p', 'Qualify trials by company email and route only qualified ones to sales'], ['q', 'Cut the entry price by 30%'], ['r', 'Hire three more sales reps immediately'], ['s', 'Roll back the onboarding flow']], best: 'p', ok: ['r'],
    explain: 'The blended rate fell because the mix changed, not because the product converts worse. Source-level conversion shows the core funnel is intact.' },
  { id: 'd3', title: 'Late trucks', scenario: 'A regional logistics firm\'s on-time delivery fell from 94% to 86% in one quarter. Fuel costs and headcount are unchanged. A new routing software went live in week 3.',
    hyps: [['a', 'The routing software produces infeasible routes'], ['b', 'One large new customer has delivery windows the network cannot meet'], ['c', 'Driver attrition has left routes with inexperienced drivers'], ['d', 'Seasonal congestion']], truth: { a: 25, b: 50, c: 15, d: 10 },
    clues: [['x', 'On-time rate by customer', 'Excluding one retailer onboarded in week 5, on-time is 93%. That retailer (17% of drops) is at 52%, with 2-hour windows.'], ['y', 'On-time rate by week', 'The decline begins in week 5, not week 3.'], ['z', 'Driver tenure report', 'Average tenure is unchanged at 3.1 years.']], bestClue: 'x',
    decisions: [['p', 'Renegotiate delivery windows or pricing with the new retailer'], ['q', 'Revert to the old routing system'], ['r', 'Launch a driver retention bonus'], ['s', 'Add 10% more trucks across the network']], best: 'p', ok: [],
    explain: 'The obvious suspect — the software — went live two weeks before the decline. Segmenting by customer isolates the cause; timing alone only rules one thing out.' },
  { id: 'd4', title: 'The premium that vanished', scenario: 'A packaged-snacks brand held price while rivals discounted. Volume fell 6%, as expected. But gross margin percentage also fell by 3 points, which was not.',
    hyps: [['a', 'Input costs (edible oil, packaging) rose'], ['b', 'Sales shifted toward large value packs with lower margin per gram'], ['c', 'Trade promotions and retailer rebates increased'], ['d', 'Factory utilisation dropped, raising unit cost']], truth: { a: 15, b: 25, c: 45, d: 15 },
    clues: [['x', 'Gross-to-net bridge', 'List price unchanged; trade spend rose from 11% to 15% of gross sales as the sales team "defended shelf space".'], ['y', 'Commodity index', 'Edible oil +2%, packaging flat.'], ['z', 'Pack-mix report', 'Value-pack share rose from 34% to 37%.']], bestClue: 'x',
    decisions: [['p', 'Put trade spend under a pay-for-performance framework with sell-out targets'], ['q', 'Cut list price to match rivals'], ['r', 'Delist the value packs'], ['s', 'Switch to a cheaper oil supplier']], best: 'p', ok: [],
    explain: 'The company held list price and gave the discount away through the back door. The gross-to-net bridge is where "hidden" price cuts live.' },
  { id: 'd5', title: 'Empty beds, long queues', scenario: 'A 300-bed hospital has average occupancy of 71%, yet emergency patients wait a median of 9 hours for a bed.',
    hyps: [['a', 'Discharges happen late in the day, after admissions peak'], ['b', 'Too few nurses to staff open beds'], ['c', 'Beds are in the wrong specialties'], ['d', 'Emergency demand has surged']], truth: { a: 50, b: 15, c: 25, d: 10 },
    clues: [['x', 'Hourly admissions vs discharges', 'Admissions peak at 11 am; 74% of discharges are completed after 4 pm, waiting on pharmacy and final rounds.'], ['y', 'Nurse-to-bed ratios', 'In line with national norms on all wards.'], ['z', 'Emergency arrivals trend', 'Up 3% year on year.']], bestClue: 'x',
    decisions: [['p', 'Move discharge rounds and pharmacy sign-off to before 10 am with a discharge lounge'], ['q', 'Build a 40-bed extension'], ['r', 'Hire 30 nurses'], ['s', 'Divert ambulances at peak']], best: 'p', ok: [],
    explain: 'Average occupancy hides a timing mismatch. Capacity exists; it becomes available five hours after it is needed.' },
];
const dailyIndex = (t = Date.now()) => Math.floor(t / 86400000) % DAILY.length;

// ---------------------------------------------------------------- Issue Tree Arena
const TREES = [
  { id: 't1', prompt: 'A national cinema chain\'s operating profit has fallen 30% in two years. Structure the problem.', root: 'Why has operating profit fallen?',
    ref: [
      { id: 'rev', label: 'Revenue', kw: ['revenue', 'sales', 'top line', 'income'], parent: null },
      { id: 'cost', label: 'Costs', kw: ['cost', 'expense', 'opex'], parent: null },
      { id: 'tix', label: 'Ticket revenue', kw: ['ticket', 'box office', 'admission'], parent: 'rev', priority: true },
      { id: 'fnb', label: 'Food & beverage', kw: ['food', 'f&b', 'concession', 'beverage', 'popcorn', 'snack'], parent: 'rev' },
      { id: 'ads', label: 'Advertising & other', kw: ['advertis', 'other revenue', 'ancillary', 'events', 'rental'], parent: 'rev' },
      { id: 'vol', label: 'Footfall / occupancy', kw: ['footfall', 'occupancy', 'attendance', 'volume', 'visitors', 'admissions'], parent: 'tix', priority: true },
      { id: 'price', label: 'Average ticket price', kw: ['price', 'yield', 'atp', 'discount'], parent: 'tix' },
      { id: 'film', label: 'Film hire / content cost', kw: ['film hire', 'distributor', 'content', 'revenue share'], parent: 'cost' },
      { id: 'rent', label: 'Rent & occupancy cost', kw: ['rent', 'lease', 'property'], parent: 'cost', priority: true },
      { id: 'staff', label: 'Staff cost', kw: ['staff', 'labour', 'labor', 'wage', 'payroll', 'people'], parent: 'cost' },
      { id: 'util', label: 'Utilities & other', kw: ['utilit', 'energy', 'electric', 'maintenance', 'marketing'], parent: 'cost' },
    ] },
  { id: 't2', prompt: 'A mid-sized Indian paint manufacturer is considering entering the waterproofing-chemicals market. Structure the decision.', root: 'Should we enter waterproofing chemicals?',
    ref: [
      { id: 'mkt', label: 'Market attractiveness', kw: ['market', 'attractive', 'industry', 'demand'], parent: null },
      { id: 'cap', label: 'Our ability to win', kw: ['capabilit', 'ability', 'win', 'fit', 'advantage', 'right to'], parent: null },
      { id: 'eco', label: 'Economics', kw: ['economic', 'financ', 'return', 'profitab', 'investment', 'business case'], parent: null },
      { id: 'risk', label: 'Risks & entry mode', kw: ['risk', 'entry mode', 'how to enter', 'build', 'acqui', 'partner'], parent: null },
      { id: 'size', label: 'Size & growth', kw: ['size', 'growth', 'tam', 'volume'], parent: 'mkt', priority: true },
      { id: 'comp', label: 'Competitive intensity', kw: ['compet', 'rival', 'incumbent', 'share'], parent: 'mkt', priority: true },
      { id: 'cust', label: 'Customers & channels', kw: ['customer', 'segment', 'contractor', 'applicator', 'buyer'], parent: 'mkt' },
      { id: 'dist', label: 'Distribution overlap', kw: ['distribut', 'dealer', 'channel', 'network'], parent: 'cap', priority: true },
      { id: 'tech', label: 'Product & technology', kw: ['technolog', 'product', 'r&d', 'formulation', 'manufactur'], parent: 'cap' },
      { id: 'brand', label: 'Brand permission', kw: ['brand', 'trust', 'reputation'], parent: 'cap' },
      { id: 'margin', label: 'Margins & pricing', kw: ['margin', 'pricing', 'price'], parent: 'eco' },
      { id: 'capex', label: 'Investment & payback', kw: ['capex', 'payback', 'npv', 'investment required', 'break-even', 'breakeven'], parent: 'eco' },
    ] },
  { id: 't3', prompt: 'A subscription meal-kit company\'s monthly customer churn has risen from 6% to 10%. Structure the problem.', root: 'Why has churn increased?',
    ref: [
      { id: 'who', label: 'Who is churning (mix)', kw: ['who', 'segment', 'cohort', 'mix', 'acquisition channel', 'new customers'], parent: null, priority: true },
      { id: 'prod', label: 'Product & experience', kw: ['product', 'experience', 'quality', 'service'], parent: null },
      { id: 'value', label: 'Price & value', kw: ['price', 'value', 'afford', 'cost to customer'], parent: null },
      { id: 'ext', label: 'External factors', kw: ['external', 'compet', 'market', 'macro', 'season'], parent: null },
      { id: 'promo', label: 'Promotion-acquired customers', kw: ['promo', 'discount', 'trial', 'coupon', 'offer'], parent: 'who', priority: true },
      { id: 'tenure', label: 'Tenure / cohort age', kw: ['tenure', 'cohort', 'early', 'first month', 'lifecycle'], parent: 'who' },
      { id: 'food', label: 'Recipe & ingredient quality', kw: ['recipe', 'ingredient', 'food', 'menu', 'variety', 'taste'], parent: 'prod' },
      { id: 'deliv', label: 'Delivery reliability', kw: ['deliver', 'late', 'logistic', 'packag'], parent: 'prod', priority: true },
      { id: 'flex', label: 'Flexibility (skip, pause)', kw: ['skip', 'pause', 'flexib', 'cancel', 'plan'], parent: 'prod' },
      { id: 'pricechg', label: 'Price changes', kw: ['price increase', 'price change', 'pricing', 'hike'], parent: 'value' },
      { id: 'alt', label: 'Substitutes & competitors', kw: ['competitor', 'substitute', 'grocery', 'quick commerce', 'alternative', 'restaurant'], parent: 'ext' },
    ] },
];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim();
function gradeTree(def, nodes) {
  nodes = (Array.isArray(nodes) ? nodes : []).slice(0, 60).map((n) => ({ id: String(n.id), parentId: n.parentId == null ? null : String(n.parentId), label: String(n.label || '').slice(0, 80), priority: Boolean(n.priority) }));
  const root = nodes.find((n) => n.parentId == null); const kids = (id) => nodes.filter((n) => n.parentId === id);
  if (!root || nodes.length < 3) return { score: 0, parts: [], matched: [], missed: def.ref.map((r) => r.label), issues: ['Build at least two branches under the root.'], reference: refTree(def) };
  const match = (n) => def.ref.find((r) => r.kw.some((k) => norm(n.label).includes(k)));
  const m = new Map(); for (const n of nodes) if (n !== root) { const r = match(n); if (r) m.set(n.id, r); }
  const hitIds = new Set([...m.values()].map((r) => r.id));
  const l1 = def.ref.filter((r) => !r.parent), l2 = def.ref.filter((r) => r.parent);
  const completeness = 0.6 * (l1.filter((r) => hitIds.has(r.id)).length / l1.length) + 0.4 * (l2.filter((r) => hitIds.has(r.id)).length / l2.length);
  let hOk = 0, hN = 0; const issues = [];
  for (const n of nodes) { const r = m.get(n.id); if (!r?.parent) continue; hN++; const p = nodes.find((x) => x.id === n.parentId); if (p && m.get(p.id)?.id === r.parent) hOk++; else issues.push(`"${n.label}" would sit more naturally under ${def.ref.find((x) => x.id === r.parent).label}.`); }
  let parents = 0, bad = 0;
  for (const n of nodes) { const ch = kids(n.id); if (!ch.length) continue; parents++;
    const seen = new Set(); let flagged = false;
    for (const c of ch) { const key = m.get(c.id)?.id || norm(c.label); if (seen.has(key)) { flagged = true; issues.push(`Under "${n.label}", "${c.label}" overlaps a sibling — not mutually exclusive.`); } seen.add(key); }
    if (ch.length === 1) { flagged = true; issues.push(`"${n.label}" has a single child — a branch should split into at least two.`); }
    if (ch.length > 6) { flagged = true; issues.push(`"${n.label}" has ${ch.length} children — group them.`); }
    if (flagged) bad++; }
  const mece = parents ? 1 - bad / parents : 0;
  const depth = (id, d = 0) => Math.max(d, ...kids(id).map((k) => depth(k.id, d + 1)));
  const structure = (kids(root.id).length >= 2 ? 0.5 : 0) + (depth(root.id) >= 2 ? 0.5 : 0);
  const pr = def.ref.filter((r) => r.priority); const flagged = nodes.filter((n) => n.priority).slice(0, 3);
  const prio = flagged.length ? flagged.filter((n) => m.get(n.id)?.priority).length / Math.min(3, pr.length) : 0;
  if (!flagged.length) issues.push('Flag up to three branches you would investigate first.');
  const parts = [['Completeness', completeness, 30], ['Logical hierarchy', hN ? hOk / hN : 0, 20], ['MECE quality', mece, 25], ['Depth & structure', structure, 10], ['Prioritisation', prio, 15]].map(([label, s, w]) => ({ label, score: Math.round(clamp(s) * 100), weight: w }));
  return { score: Math.round(parts.reduce((t, p) => t + (p.score * p.weight) / 100, 0)), parts, matched: def.ref.filter((r) => hitIds.has(r.id)).map((r) => r.label), missed: def.ref.filter((r) => !hitIds.has(r.id)).map((r) => r.label), issues: issues.slice(0, 6), reference: refTree(def) };
}
const refTree = (def) => ({ root: def.root, nodes: def.ref.map((r) => ({ id: r.id, label: r.label, parent: r.parent, priority: Boolean(r.priority) })) });

// ---------------------------------------------------------------- Margin Detective
const MARGIN = [
  { id: 'm1', company: 'Halden Appliances', unit: '₹ cr', context: 'A kitchen-appliance maker. Operating profit fell although revenue rose 6%.', from: 84, to: 61, revFrom: 620, revTo: 657,
    drivers: [['vol', 'Volume', 14], ['price', 'Net price realisation', -19], ['mix', 'Product mix', -11], ['mat', 'Material costs', -6], ['lab', 'Labour & conversion', -2], ['log', 'Freight & logistics', -3], ['oh', 'Overheads & marketing', 4]],
    lesson: 'Volume growth was bought with deeper dealer discounts and a shift to entry-level models. Material costs — the usual suspect — were a minor factor.' },
  { id: 'm2', company: 'Verano Hotels', unit: '$M', context: 'A 14-property hotel group. EBITDA rose despite flat occupancy.', from: 41, to: 52, revFrom: 210, revTo: 224,
    drivers: [['occ', 'Occupancy', -1], ['rate', 'Average daily rate', 12], ['fnb', 'Food & beverage', 2], ['lab', 'Labour cost', -7], ['energy', 'Energy', -3], ['dist', 'Distribution commissions', 6], ['oh', 'Overheads', 2]],
    lesson: 'Rate did most of the work, but the quieter win was shifting bookings from online travel agents to direct channels, which cut commissions.' },
  { id: 'm3', company: 'Kestrel Diagnostics', unit: '₹ cr', context: 'A pathology lab chain. Profit fell sharply in a year when test volumes grew 18%.', from: 96, to: 58, revFrom: 540, revTo: 571,
    drivers: [['vol', 'Test volume', 31], ['price', 'Price per test', -44], ['mix', 'Test mix', -8], ['reag', 'Reagent costs', -5], ['net', 'New collection centres', -13], ['lab', 'Staff cost', -4], ['oh', 'Overheads', 5]],
    lesson: 'Aggregator-led price competition erased more than the volume gained, and new centres added fixed cost ahead of demand.' },
];
const PROBES = 4;

// ---------------------------------------------------------------- Hypothesis Duel
const DUELS = [
  { id: 'h1', scenario: 'An online furniture retailer\'s return rate rose from 8% to 14% in six months.', A: 'Product quality declined after switching to a new supplier', B: 'Listings misrepresent products, so customers receive something different from what they expected',
    cards: [['Return reasons: "damaged or defective" is unchanged at 22% of returns.', 0.45], ['The new supplier covers only 15% of SKUs.', 0.6], ['"Not as described" rose from 31% to 52% of return reasons.', 0.3], ['A new photo-rendering tool replaced studio photography in the same month returns began rising.', 0.35], ['Returns rose equally on SKUs from old and new suppliers.', 0.25]] },
  { id: 'h2', scenario: 'A food-delivery app\'s orders per active user fell 12% in Mumbai but not elsewhere.', A: 'A local competitor launched an aggressive loyalty scheme', B: 'A delivery-fee change rolled out in Mumbai first reduced order frequency',
    cards: [['The competitor\'s scheme launched nationally, not only in Mumbai.', 0.4], ['The fee change raised fees on orders under ₹300.', 0.6], ['Orders under ₹300 fell 31% in Mumbai; orders above ₹300 are flat.', 0.2], ['App-store data shows the competitor\'s Mumbai downloads rose 8%, similar to other cities.', 0.5], ['A two-week fee rollback in three Mumbai pin codes restored order frequency.', 0.15]] },
  { id: 'h3', scenario: 'A manufacturer\'s defect rate doubled on Line 3 after a maintenance shutdown.', A: 'The line was recalibrated incorrectly during maintenance', B: 'A new batch of raw material is out of specification',
    cards: [['The same raw-material batch runs on Lines 1 and 2 with normal defect rates.', 3.5], ['Defects are concentrated in one dimension: bore diameter.', 1.8], ['The incoming-material inspection passed, but only samples 1 in 200 units.', 0.8], ['Night shift and day shift show the same defect rate.', 1.2], ['A spindle alignment check finds a 0.04 mm offset against a 0.01 mm tolerance.', 6]] },
];
const posterior = (cards) => { let odds = 1; return cards.map(([, lr]) => { odds *= lr; return Math.round((odds / (1 + odds)) * 100); }); };

// ---------------------------------------------------------------- Boardroom Blitz
const BLITZ = [
  { id: 'b1', setup: 'You recommended closing 12 loss-making stores out of 140.', objection: '"Those stores cover their own rent. Close them and head-office costs just land on fewer stores."',
    opts: [['The test is cash contribution after store-level costs. Eight of the twelve are negative even before any allocation; the other four I would put on a 2-quarter watch instead.', 1], ['Head-office costs should also be cut in proportion, so the allocation problem goes away.', 0.5], ['The analysis is clear that these stores lose money.', 0.1], ['We could reallocate head-office costs differently to make the remaining stores look better.', 0]], why: 'It separates avoidable from allocated cost, concedes the valid part of the objection and adjusts the recommendation.' },
  { id: 'b2', setup: 'You recommended a 6% price increase on the premium range.', objection: '"Our largest retailer will delist us if we move on price."',
    opts: [['That retailer is 18% of premium volume. Even losing half of it, the increase is profit-positive; and I would pre-wire it with a joint promotion calendar so they keep margin.', 1], ['Retailers always say that. They will not actually delist a brand customers ask for.', 0.25], ['We could exempt that retailer from the increase.', 0.4], ['Then we should not raise prices.', 0]], why: 'It sizes the downside, shows the decision survives it, and offers a way to reduce the risk.' },
  { id: 'b3', setup: 'You recommended outsourcing last-mile delivery.', objection: '"We tried outsourcing in 2021 and service levels collapsed."',
    opts: [['What failed in 2021 was a single national vendor paid per drop. I am proposing regional partners on service-level contracts, piloted in two cities with an exit clause.', 1], ['The market has matured since 2021, so it will be different this time.', 0.3], ['Service levels matter less than the 22% cost saving.', 0.1], ['We can keep delivery in-house if you prefer.', 0]], why: 'It engages with why the earlier attempt failed and shows what is structurally different.' },
  { id: 'b4', setup: 'You recommended exiting the low-margin export business.', objection: '"Exports absorb 20% of factory overhead. Exit and domestic margins fall."',
    opts: [['Correct, which is why I net it off: exports contribute ₹6 cr before overhead and tie up ₹40 cr of working capital. Exiting only makes sense with the plan to fill 60% of that capacity domestically within a year.', 1], ['Overhead absorption is an accounting concept, not a cash cost.', 0.45], ['We would reduce overhead at the same time.', 0.4], ['Export margins are simply too low to justify.', 0.1]], why: 'It accepts the mechanism, quantifies it, and makes the condition for the recommendation explicit.' },
  { id: 'b5', setup: 'You recommended investing in a customer data platform.', objection: '"Give me one decision we would make differently with this that we cannot make today."',
    opts: [['Today we send every lapsed customer the same 20% voucher. With purchase history joined to margin, we stop discounting the 40% who would return anyway — roughly ₹9 cr a year.', 1], ['It would give us a single view of the customer across all channels.', 0.2], ['Our competitors all have one.', 0], ['Many decisions; personalisation is the future of retail.', 0.1]], why: 'It answers the actual question with one concrete decision and a number.' },
  { id: 'b6', setup: 'You recommended delaying the new plant by a year.', objection: '"Demand is growing 15%. If we wait, we will run out of capacity and lose share."',
    opts: [['At 15% we hit capacity in month 19. De-bottlenecking Line 2 buys nine more months for a tenth of the capex, which lets us commit after we see whether the new contract renews.', 1], ['Demand forecasts are usually too optimistic.', 0.3], ['We can outsource overflow production if needed.', 0.5], ['Capital is expensive right now.', 0.2]], why: 'It uses the challenger\'s own growth figure, shows the timeline and offers a cheaper option that preserves the decision.' },
];

// ---------------------------------------------------------------- Market Strategy Challenge
const PRICE = { cut: 0.9, hold: 1.0, premium: 1.1 }, MKT = { low: [2, 0], medium: [6, 0.018], high: [12, 0.032] };
export function runMarket(decisions) {
  let share = 0.3, comp = 1.0, cap = 350, pendingCap = 0, fixed = 6, market = 1000, cum = 0, expanded = false; const rows = [];
  for (const [q, d] of decisions.entries()) {
    cap += pendingCap; pendingCap = 0;
    const p = PRICE[d.price] ?? 1, [spend, lift] = MKT[d.marketing] ?? MKT.low;
    let oneOff = 0; if (d.expand && !expanded) { expanded = true; pendingCap = 150; oneOff = 8; fixed += 2; }
    share = clamp(share + 0.28 * (comp - p) + lift * (1 - share) * 2 - 0.008, 0.08, 0.6);
    const demand = share * market, sales = Math.min(cap, demand);
    const profit = (sales * (100 * p - 60)) / 1000 - spend - fixed - oneOff; cum += profit;
    let note = sales < demand ? `Capacity-constrained: ${Math.round(demand - sales)} units of demand went unserved.` : '';
    const prevComp = comp;
    if (p < comp) comp = p; else if (share > 0.38) comp = Math.max(0.85, comp - 0.05); else if (p > comp && comp < 1) comp = Math.min(1, comp + 0.05);
    if (comp < prevComp) note += (note ? ' ' : '') + (p < prevComp ? 'Competitor will match your price next quarter.' : 'Competitor responds to your share gain with a promotion.');
    rows.push({ q: q + 1, price: Math.round(100 * p), competitorPrice: Math.round(100 * prevComp), share: Math.round(share * 1000) / 10, demand: Math.round(demand), sales: Math.round(sales), capacity: cap, profit: Math.round(profit * 10) / 10, cumulative: Math.round(cum * 10) / 10, note });
    market *= 1.03;
  }
  return { rows, cumulative: Math.round(cum * 10) / 10 };
}
let marketBench = null;
function bench() {
  if (marketBench) return marketBench;
  const opts = []; for (const price of Object.keys(PRICE)) for (const marketing of Object.keys(MKT)) for (const expand of [false, true]) opts.push({ price, marketing, expand });
  const all = []; const rec = (seq) => { if (seq.length === 4) { all.push(runMarket(seq).cumulative); return; } for (const o of opts) rec([...seq, o]); }; rec([]);
  all.sort((a, b) => a - b); marketBench = { best: all.at(-1), median: all[Math.floor(all.length / 2)], p90: all[Math.floor(all.length * 0.9)], worst: all[0] };
  return marketBench;
}

// ---------------------------------------------------------------- Sessions
const sessions = new Map();
const open = (userId, mode, data) => { const s = { id: uid('gs_'), userId, mode, t: Date.now(), done: false, ...data }; sessions.set(s.id, s); if (sessions.size > 2000) sessions.delete(sessions.keys().next().value); return s; };
export const getSession = (id, userId) => { const s = sessions.get(id); return s && s.userId === userId ? s : null; };
const pickFor = (list, userId, salt = 0) => list[(Math.floor(Date.now() / 86400000) + [...userId].reduce((s, c) => s + c.charCodeAt(0), 0) + salt) % list.length];

export function start(mode, user, params = {}) {
  const n = Number(params.n) || 0;
  if (mode === 'daily') { const d = DAILY[dailyIndex()]; const s = open(user.id, mode, { puzzle: d.id, clue: null });
    return { sessionId: s.id, day: dayKey(), title: d.title, scenario: d.scenario, hyps: d.hyps.map(([id, text]) => ({ id, text })), clues: d.clues.map(([id, label]) => ({ id, label })), decisions: d.decisions.map(([id, text]) => ({ id, text })) }; }
  if (mode === 'issue-tree') { const t = pickFor(TREES, user.id, n); const s = open(user.id, mode, { puzzle: t.id }); return { sessionId: s.id, prompt: t.prompt, root: t.root }; }
  if (mode === 'margin') { const m = pickFor(MARGIN, user.id, n); const s = open(user.id, mode, { puzzle: m.id, probed: [] });
    return { sessionId: s.id, company: m.company, context: m.context, unit: m.unit, from: m.from, to: m.to, revFrom: m.revFrom, revTo: m.revTo, probes: PROBES, drivers: m.drivers.map(([id, label]) => ({ id, label })) }; }
  if (mode === 'duel') { const d = pickFor(DUELS, user.id, n); const s = open(user.id, mode, { puzzle: d.id }); return { sessionId: s.id, scenario: d.scenario, A: d.A, B: d.B, cards: d.cards.map(([text]) => text) }; }
  if (mode === 'blitz') { const off = (Math.floor(Date.now() / 86400000) + n) % BLITZ.length; const picks = [0, 1, 2].map((i) => BLITZ[(off + i * 2) % BLITZ.length]);
    const orders = Object.fromEntries(picks.map((p, k) => [p.id, [0, 1, 2, 3].map((i) => (i + p.id.charCodeAt(1) + k + off) % 4)]));
    const s = open(user.id, mode, { puzzle: picks.map((p) => p.id), orders });
    return { sessionId: s.id, seconds: 45, rounds: picks.map((p) => ({ id: p.id, setup: p.setup, objection: p.objection, opts: orders[p.id].map((orig, pos) => ({ id: pos, text: p.opts[orig][0] })) })) }; }
  if (mode === 'market') { const s = open(user.id, mode, { puzzle: 'mk1' });
    return { sessionId: s.id, brief: 'You run Aurel, a premium bottled-beverage brand with 30% share of a 1,000-unit quarterly market growing 3% a quarter. Unit cost is 60 and list price 100. Your plant makes 350 units a quarter. One competitor holds most of the rest and reacts to what you do. Maximise cumulative profit over four quarters.', quarters: 4,
      choices: { price: [['cut', 'Cut price 10%'], ['hold', 'Hold price'], ['premium', 'Raise price 10%']], marketing: [['low', 'Low (2)'], ['medium', 'Medium (6)'], ['high', 'High (12)']], expand: 'Expand plant (+150 units from next quarter; 8 one-off, +2 per quarter)' } }; }
  throw Object.assign(new Error('Unknown mode'), { status: 404 });
}

export function step(s, body) {
  if (s.done) throw Object.assign(new Error('Session finished'), { status: 400 });
  if (s.mode === 'daily') { const d = DAILY.find((x) => x.id === s.puzzle); if (s.clue) throw Object.assign(new Error('You have already used your one look.'), { status: 400 }); const c = d.clues.find(([id]) => id === body.clueId); if (!c) throw Object.assign(new Error('Unknown clue'), { status: 400 }); s.clue = c[0]; return { clue: { id: c[0], label: c[1], text: c[2] } }; }
  if (s.mode === 'margin') { const m = MARGIN.find((x) => x.id === s.puzzle); const d = m.drivers.find(([id]) => id === body.driverId); if (!d) throw Object.assign(new Error('Unknown driver'), { status: 400 }); if (s.probed.includes(d[0])) return { probe: { id: d[0], effect: d[2] }, left: PROBES - s.probed.length }; if (s.probed.length >= PROBES) throw Object.assign(new Error('No probes left.'), { status: 400 }); s.probed.push(d[0]); return { probe: { id: d[0], effect: d[2] }, left: PROBES - s.probed.length }; }
  if (s.mode === 'market') { const ds = (Array.isArray(body.decisions) ? body.decisions : []).slice(0, 4); return runMarket(ds); }
  throw Object.assign(new Error('Nothing to do'), { status: 400 });
}

export function grade(s, ans = {}) {
  if (s.done) throw Object.assign(new Error('Already submitted'), { status: 400 });
  s.done = true; const mode = MODES.find((m) => m.id === s.mode); let score = 0, feedback = {};
  if (s.mode === 'daily') {
    const d = DAILY.find((x) => x.id === s.puzzle); const alloc = {}; let sum = 0; for (const [id] of d.hyps) { alloc[id] = clamp(Math.round(Number(ans.alloc?.[id]) || 0), 0, 100); sum += alloc[id]; }
    if (sum !== 100) { s.done = false; throw Object.assign(new Error('Confidence must total 100.'), { status: 400 }); }
    const tv = 0.5 * d.hyps.reduce((t, [id]) => t + Math.abs(alloc[id] - d.truth[id]) / 100, 0);
    const cl = s.clue === d.bestClue ? 1 : s.clue ? 0.4 : 0, dec = ans.decision === d.best ? 1 : d.ok.includes(ans.decision) ? 0.5 : 0;
    const parts = [{ label: 'Chose the most diagnostic information', score: Math.round(cl * 100), weight: 25 }, { label: 'Final confidence allocation', score: Math.round(clamp((1 - tv) / 0.85) * 100), weight: 40 }, { label: 'Decision', score: dec * 100, weight: 35 }];
    score = Math.round(parts.reduce((t, p) => t + (p.score * p.weight) / 100, 0));
    feedback = { parts, truth: d.truth, bestClue: d.clues.find(([id]) => id === d.bestClue)[1], clues: d.clues.map(([id, label, text]) => ({ id, label, text })), bestDecision: d.decisions.find(([id]) => id === d.best)[1], explain: d.explain };
  } else if (s.mode === 'issue-tree') { const g = gradeTree(TREES.find((x) => x.id === s.puzzle), ans.nodes); score = g.score; feedback = g; }
  else if (s.mode === 'margin') {
    const m = MARGIN.find((x) => x.id === s.puzzle); const ranked = [...m.drivers].sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])); const [top, second] = ranked;
    const est = Number(ans.estimate); const err = Number.isFinite(est) ? Math.abs(est - top[2]) / Math.abs(top[2]) : 9;
    const parts = [{ label: 'Largest driver identified', score: ans.top === top[0] ? 100 : ans.top === second[0] ? 40 : 0, weight: 40 }, { label: 'Second driver identified', score: ans.second === second[0] ? 100 : ans.second === top[0] || ans.second === ranked[2][0] ? 40 : 0, weight: 25 },
      { label: 'Size of the largest driver', score: ans.top === top[0] ? (err <= 0.15 ? 100 : err <= 0.3 ? 50 : 0) : 0, weight: 20 }, { label: 'Probes spent on what mattered', score: Math.round(([top[0], second[0]].filter((x) => s.probed.includes(x)).length / 2) * 100), weight: 15 }];
    score = Math.round(parts.reduce((t, p) => t + (p.score * p.weight) / 100, 0));
    feedback = { parts, bridge: m.drivers.map(([id, label, effect]) => ({ id, label, effect, probed: s.probed.includes(id) })), from: m.from, to: m.to, unit: m.unit, lesson: m.lesson };
  } else if (s.mode === 'duel') {
    const d = DUELS.find((x) => x.id === s.puzzle); const ref = posterior(d.cards); const ps = (Array.isArray(ans.path) ? ans.path : []).slice(0, ref.length).map((x) => clamp(Number(x) || 0, 0, 100));
    while (ps.length < ref.length) ps.push(50);
    const mae = ps.reduce((t, p, i) => t + Math.abs(p - ref[i]), 0) / ref.length / 100; const right = (ref.at(-1) >= 50 ? 'A' : 'B') === ans.pick;
    const parts = [{ label: 'Confidence tracked the evidence', score: Math.round(clamp(1 - 2.4 * mae) * 100), weight: 75 }, { label: 'Final verdict', score: right ? 100 : 0, weight: 25 }];
    score = Math.round(parts.reduce((t, p) => t + (p.score * p.weight) / 100, 0));
    feedback = { parts, reference: ref, yours: ps, verdict: ref.at(-1) >= 50 ? 'A' : 'B', strengths: d.cards.map(([text, lr]) => ({ text, favours: lr > 1 ? 'A' : 'B', strength: Math.max(lr, 1 / lr) >= 3 ? 'strong' : Math.max(lr, 1 / lr) >= 1.6 ? 'moderate' : 'weak' })) };
  } else if (s.mode === 'blitz') {
    const rounds = s.puzzle.map((id) => BLITZ.find((b) => b.id === id)); const picks = ans.picks || {};
    const res = rounds.map((r) => { const pos = picks[r.id]; const i = Number.isInteger(pos) ? s.orders[r.id][pos] : null; const q = Number.isInteger(i) && r.opts[i] ? r.opts[i][1] : 0; return { id: r.id, objection: r.objection, chosen: Number.isInteger(i) && r.opts[i] ? r.opts[i][0] : null, quality: q, best: r.opts[0][0], why: r.why }; });
    score = Math.round((res.reduce((t, r) => t + r.quality, 0) / res.length) * 100); feedback = { rounds: res };
  } else if (s.mode === 'market') {
    const ds = (Array.isArray(ans.decisions) ? ans.decisions : []).slice(0, 4); if (ds.length < 4) { s.done = false; throw Object.assign(new Error('Play all four quarters.'), { status: 400 }); }
    const out = runMarket(ds); const b = bench();
    score = Math.round(out.cumulative >= b.median ? 50 + 50 * clamp((out.cumulative - b.median) / (b.best - b.median)) : 50 * clamp((out.cumulative - b.worst) / (b.median - b.worst)));
    feedback = { ...out, benchmark: b, lesson: 'Price cuts are matched within a quarter, so they buy little lasting share. Capacity only pays if demand arrives; marketing compounds but saturates. The strongest policies hold or raise price, invest in demand early and expand only when constrained.' };
  }
  return { score, xp: mode.xp, skills: mode.skills, label: mode.name, feedback };
}
export const dailyMeta = () => { const d = DAILY[dailyIndex()]; return { title: d.title, scenario: d.scenario, day: dayKey() }; };
