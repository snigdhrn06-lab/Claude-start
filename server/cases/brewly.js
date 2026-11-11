// Brewly Chai Co. — original fictional case. All tables derive from the model below,
// so every number a learner sees ties out to the same underlying business.
const r1 = (n) => Math.round(n * 10) / 10 + 0;
const r2 = (n) => Math.round(n * 100) / 100;

const Y = {
  FY23: { stores: 62, storeFixed: 49.0, corp: 9.6,
    dine: { rev: 78.0, aov: 175, cogs: 0.30, pack: 2, comm: 0, disc: 0, ads: 0 },
    take: { rev: 24.0, aov: 145, cogs: 0.305, pack: 8, comm: 0, disc: 0, ads: 0 },
    deliv: { rev: 14.0, aov: 220, cogs: 0.31, pack: 15, comm: 0.20, disc: 0.04, ads: 0.01 } },
  FY24: { stores: 74, storeFixed: 58.0, corp: 11.3,
    dine: { rev: 85.2, aov: 178, cogs: 0.305, pack: 2, comm: 0, disc: 0, ads: 0 },
    take: { rev: 28.4, aov: 148, cogs: 0.31, pack: 8.5, comm: 0, disc: 0, ads: 0 },
    deliv: { rev: 28.4, aov: 225, cogs: 0.31, pack: 16, comm: 0.22, disc: 0.06, ads: 0.02 } },
  FY25: { stores: 84, storeFixed: 66.0, corp: 12.8,
    dine: { rev: 83.7, aov: 180, cogs: 0.31, pack: 2, comm: 0, disc: 0, ads: 0 },
    take: { rev: 29.1, aov: 150, cogs: 0.315, pack: 9, comm: 0, disc: 0, ads: 0 },
    deliv: { rev: 69.2, aov: 230, cogs: 0.32, pack: 18, comm: 0.26, disc: 0.12, ads: 0.05 } },
};
const CH = [['dine', 'Dine-in'], ['take', 'Takeaway'], ['deliv', 'Delivery']];
const perOrder = (c) => c.aov * (1 - c.cogs - c.comm - c.disc - c.ads) - c.pack;
const orders = (c) => (c.rev * 1e7) / c.aov; // ₹ cr -> orders
const contrib = (c) => (orders(c) * perOrder(c)) / 1e7;
const yr = (k) => {
  const y = Y[k];
  const rev = y.dine.rev + y.take.rev + y.deliv.rev;
  const con = contrib(y.dine) + contrib(y.take) + contrib(y.deliv);
  const ebitda = con - y.storeFixed - y.corp;
  return { rev, con, ebitda, margin: ebitda / rev };
};
const T = { FY23: yr('FY23'), FY24: yr('FY24'), FY25: yr('FY25') };
const d25 = Y.FY25.deliv;

function scenario(inp) {
  const comm = inp.commission / 100, disc = inp.discount / 100, ads = inp.ads / 100;
  const vol = 1 + inp.volume / 100, recap = inp.recapture / 100;
  const po = d25.aov * (1 - d25.cogs - comm - disc - ads) - d25.pack;
  const baseOrders = orders(d25);
  const newOrders = baseOrders * vol;
  const delivCon = (newOrders * po) / 1e7;
  const lost = Math.max(0, baseOrders - newOrders);
  const recapCon = (lost * recap * perOrder(Y.FY25.dine)) / 1e7;
  const delta = delivCon + recapCon - contrib(d25);
  return {
    outputs: [
      { label: 'Delivery contribution / order', value: r1(po), unit: '₹' },
      { label: 'Delivery contribution', value: r1(delivCon), unit: '₹ cr' },
      { label: 'In-store recapture contribution', value: r1(recapCon), unit: '₹ cr' },
      { label: 'EBITDA change vs FY25', value: r1(delta), unit: '₹ cr', highlight: true },
      { label: 'Pro-forma EBITDA', value: r1(T.FY25.ebitda + delta), unit: '₹ cr' },
    ],
    bars: [
      { label: 'FY25 delivery contribution', value: r1(contrib(d25)) },
      { label: 'Scenario delivery contribution', value: r1(delivCon) },
      { label: 'Recaptured in-store', value: r1(recapCon) },
    ],
  };
}

const pct = (n) => r1(n * 100);

export default {
  id: 'brewly',
  title: 'The Growth That Ate the Margin',
  company: 'Brewly Chai Co.',
  industry: 'Consumer & Retail',
  func: 'Strategy & Finance',
  problemType: 'Profitability decline',
  difficulty: 2, difficultyLabel: 'Intermediate',
  durationMin: 40, xpReward: 400, budgetHours: 36,
  skills: ['evidence', 'quant', 'calibration'],
  tags: ['featured'],
  unlockRank: 0, currency: '₹',
  blurb: `An 84-outlet chai chain grew revenue ${Math.round((T.FY25.rev / T.FY24.rev - 1) * 100)}% in a year while EBITDA roughly halved. The CEO wants to know what is actually happening before the board meets.`,
  briefing: {
    from: { name: 'Meera Krishnan', role: 'Chief Executive Officer, Brewly Chai Co.' },
    subject: 'Why are we growing and getting poorer?',
    memo: [
      `Thank you for taking this on at short notice. Brewly closed FY25 with revenue of ₹${r1(T.FY25.rev)} crore, up from ₹${r1(T.FY24.rev)} crore. By any top-line measure it was our best year.`,
      `Yet EBITDA fell from ₹${r1(T.FY24.ebitda)} crore to ₹${r1(T.FY25.ebitda)} crore. Our margin went from ${pct(T.FY24.margin)}% to ${pct(T.FY25.margin)}%. My leadership team has five explanations and no agreement. Finance blames milk prices. Operations blames the new stores. Growth says this is the cost of scale and will fix itself.`,
      'I do not want another opinion. I want a diagnosis I can defend to the board in three weeks, and a recommendation I can act on. You have a small analyst team and limited hours, so choose what you look at carefully.',
    ],
    background: [
      'Founded 2016 in Bengaluru; premium chai, snacks and light meals in 84 company-owned outlets across Bengaluru, Hyderabad and Pune.',
      'Three channels: dine-in, takeaway and delivery through two food aggregators (QuickDine is ~80% of delivery volume).',
      'Opened 12 outlets in FY24 and 10 in FY25. No franchising. Privately held; a PE investor owns 31%.',
    ],
    objective: 'Identify the root cause(s) of the EBITDA decline and recommend a course of action that restores profitability without destroying the growth story.',
    constraints: [
      'Board meeting in three weeks; the PE investor expects 20%+ revenue growth to continue.',
      '36 analyst hours available for data requests and interviews.',
      'No appetite for store closures in the next two quarters.',
    ],
    context: [
      'The aggregator contract was renewed at the start of FY25.',
      'A competitor, Chai Republic, opened 14 outlets in Brewly cities during FY25.',
      'Milk procurement prices rose during the year.',
    ],
    metrics: [
      { label: 'Revenue FY25', value: `₹${r1(T.FY25.rev)} cr`, delta: `+${pct(T.FY25.rev / T.FY24.rev - 1)}%`, tone: 'up' },
      { label: 'EBITDA FY25', value: `₹${r1(T.FY25.ebitda)} cr`, delta: `${pct(T.FY25.ebitda / T.FY24.ebitda - 1)}%`, tone: 'down' },
      { label: 'EBITDA margin', value: `${pct(T.FY25.margin)}%`, delta: `${r1(pct(T.FY25.margin) - pct(T.FY24.margin))} pts`, tone: 'down' },
      { label: 'Outlets', value: '84', delta: '+10', tone: 'flat' },
    ],
    trend: { label: 'Revenue vs EBITDA (₹ cr)', x: ['FY23', 'FY24', 'FY25'],
      series: [{ label: 'Revenue', values: ['FY23', 'FY24', 'FY25'].map((k) => r1(T[k].rev)) }, { label: 'EBITDA', values: ['FY23', 'FY24', 'FY25'].map((k) => r1(T[k].ebitda)) }] },
  },
  drivers: [
    { id: 'channel_econ', label: 'Channel mix & delivery unit economics', truth: 0.45, side: 'margin' },
    { id: 'cannibal', label: 'Delivery cannibalising in-store demand', truth: 0.2, side: 'revenue' },
    { id: 'expansion', label: 'New-store expansion & fixed cost base', truth: 0.15, side: 'cost' },
    { id: 'labour', label: 'Store labour productivity', truth: 0.08, side: 'cost' },
    { id: 'input', label: 'Ingredient / input cost inflation', truth: 0.07, side: 'cost' },
    { id: 'competition', label: 'Competitive pressure on footfall', truth: 0.05, side: 'revenue' },
    { id: 'pricing', label: 'In-store pricing & discounting', truth: 0, side: 'revenue' },
  ],
  hypothesisSeeds: [
    { text: 'Milk and tea cost inflation has compressed gross margin across all channels.', driver: 'input' },
    { text: 'Growth has shifted to delivery, which earns far less contribution per order than in-store sales.', driver: 'channel_econ' },
    { text: 'New outlets opened in FY24–25 are still ramping and dragging down the fixed cost base.', driver: 'expansion' },
    { text: 'Chai Republic is taking dine-in footfall in overlapping catchments.', driver: 'competition' },
  ],
  datasets: [
    { id: 'pnl', title: 'Consolidated P&L, FY23–FY25', category: 'Financial statements', cost: 4, relevance: 'High', value: 'useful',
      description: 'Company-level income statement with major cost lines.',
      signals: { channel_econ: 1, input: -1, expansion: 1 },
      insight: 'Aggregator fees, promotions and packaging are the fastest-growing cost lines; COGS as a share of revenue barely moved. The P&L tells you where to dig, not why.',
      table: { columns: [{ key: 'line', label: 'Line item (₹ cr)', fmt: 'text' }, { key: 'FY23', label: 'FY23', fmt: 'num1' }, { key: 'FY24', label: 'FY24', fmt: 'num1' }, { key: 'FY25', label: 'FY25', fmt: 'num1' }],
        rows: (() => {
          const row = (line, f) => ({ line, ...Object.fromEntries(Object.keys(Y).map((k) => [k, r1(f(Y[k], T[k]))])) });
          const sum = (y, f) => CH.reduce((s, [c]) => s + f(y[c]), 0);
          return [
            row('Revenue', (y, t) => t.rev),
            row('Cost of goods sold', (y) => sum(y, (c) => c.rev * c.cogs)),
            row('Packaging', (y) => sum(y, (c) => (orders(c) * c.pack) / 1e7)),
            row('Aggregator commission', (y) => y.deliv.rev * y.deliv.comm),
            row('Brewly-funded promotions', (y) => y.deliv.rev * y.deliv.disc),
            row('Platform advertising', (y) => y.deliv.rev * y.deliv.ads),
            row('Channel contribution', (y, t) => t.con),
            row('Store fixed costs (rent, labour, utilities)', (y) => y.storeFixed),
            row('Corporate overhead', (y) => y.corp),
            row('EBITDA', (y, t) => t.ebitda),
            row('EBITDA margin %', (y, t) => t.margin * 100),
          ];
        })() } },
    { id: 'channel_rev', title: 'Revenue and orders by channel', category: 'Sales data', cost: 5, relevance: 'High', value: 'critical',
      description: 'Revenue, order counts and average order value for dine-in, takeaway and delivery.',
      signals: { channel_econ: 2, cannibal: 1, competition: 0, pricing: -1 },
      insight: `Delivery added ₹${r1(Y.FY25.deliv.rev - Y.FY24.deliv.rev)} cr — essentially all of the growth — and is now ${Math.round((Y.FY25.deliv.rev / T.FY25.rev) * 100)}% of revenue. Dine-in revenue fell despite ten new stores.`,
      table: { columns: [{ key: 'ch', label: 'Channel', fmt: 'text' }, { key: 'r24', label: 'Rev FY24 (₹ cr)', fmt: 'num1' }, { key: 'r25', label: 'Rev FY25 (₹ cr)', fmt: 'num1' }, { key: 'g', label: 'Growth %', fmt: 'pct' }, { key: 'o24', label: 'Orders FY24 (lakh)', fmt: 'num1' }, { key: 'o25', label: 'Orders FY25 (lakh)', fmt: 'num1' }, { key: 'aov', label: 'AOV FY25 (₹)', fmt: 'num0' }, { key: 'mix', label: 'Mix FY25 %', fmt: 'pct' }],
        rows: CH.map(([c, n]) => ({ ch: n, r24: Y.FY24[c].rev, r25: Y.FY25[c].rev, g: pct(Y.FY25[c].rev / Y.FY24[c].rev - 1), o24: r1(orders(Y.FY24[c]) / 1e5), o25: r1(orders(Y.FY25[c]) / 1e5), aov: Y.FY25[c].aov, mix: pct(Y.FY25[c].rev / T.FY25.rev) })) },
      chart: { type: 'bar', unit: '₹ cr', categories: CH.map(([, n]) => n), series: [{ label: 'FY24', values: CH.map(([c]) => Y.FY24[c].rev) }, { label: 'FY25', values: CH.map(([c]) => Y.FY25[c].rev) }] } },
    { id: 'channel_econ', title: 'Contribution economics per order, by channel', category: 'Product-level profitability', cost: 8, relevance: 'Medium', value: 'critical',
      description: 'Per-order waterfall from average order value to contribution, FY24 vs FY25. Built by finance on request.',
      signals: { channel_econ: 2, input: -1, pricing: -1 },
      insight: `A delivery order contributed ₹${r1(perOrder(Y.FY24.deliv))} in FY24 and ₹${r1(perOrder(d25))} in FY25. A dine-in order contributes ₹${r1(perOrder(Y.FY25.dine))}. Brewly swapped rich orders for thin ones.`,
      table: { columns: [{ key: 'line', label: 'Per order (₹)', fmt: 'text' }, { key: 'd24', label: 'Dine-in FY24', fmt: 'num1' }, { key: 'd25', label: 'Dine-in FY25', fmt: 'num1' }, { key: 't25', label: 'Takeaway FY25', fmt: 'num1' }, { key: 'v24', label: 'Delivery FY24', fmt: 'num1' }, { key: 'v25', label: 'Delivery FY25', fmt: 'num1' }],
        rows: (() => {
          const cols = { d24: Y.FY24.dine, d25: Y.FY25.dine, t25: Y.FY25.take, v24: Y.FY24.deliv, v25: Y.FY25.deliv };
          const row = (line, f) => ({ line, ...Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, r1(f(c))])) });
          return [row('Average order value', (c) => c.aov), row('Cost of goods', (c) => -c.aov * c.cogs), row('Packaging', (c) => -c.pack),
            row('Aggregator commission', (c) => -c.aov * c.comm), row('Brewly-funded discount', (c) => -c.aov * c.disc), row('Platform ads', (c) => -c.aov * c.ads),
            row('Contribution per order', (c) => perOrder(c)), row('Contribution margin %', (c) => (perOrder(c) / c.aov) * 100)];
        })() },
      chart: { type: 'bar', unit: '₹ / order', categories: ['Dine-in', 'Takeaway', 'Delivery'], series: [{ label: 'FY24', values: CH.map(([c]) => r1(perOrder(Y.FY24[c]))) }, { label: 'FY25', values: CH.map(([c]) => r1(perOrder(Y.FY25[c]))) }] } },
    { id: 'aggregator', title: 'Aggregator contract terms & promotion funding', category: 'Pricing history', cost: 5, relevance: 'Medium', value: 'critical',
      description: 'QuickDine contract summary before and after the FY25 renewal, plus campaign opt-ins.',
      signals: { channel_econ: 2 },
      insight: 'Three separate decisions compounded: commission +4 pts for "Prime placement", opting into co-funded discounting (+6 pts) and tripling platform ads. Each looked small on its own; together they took 13 points of delivery revenue.',
      table: { columns: [{ key: 'term', label: 'Term', fmt: 'text' }, { key: 'a', label: 'FY24 contract', fmt: 'text' }, { key: 'b', label: 'FY25 contract', fmt: 'text' }],
        rows: [
          { term: 'Base commission', a: '22% of order value', b: '26% (includes "Prime placement" tier)' },
          { term: 'Brewly-funded discounts', a: '6% of order value (occasional)', b: '12% (opted into always-on "Chai Hour" campaign)' },
          { term: 'Sponsored listings', a: '2% of delivery sales', b: '5% of delivery sales' },
          { term: 'Minimum order value', a: 'None', b: 'None' },
          { term: 'Exclusivity', a: 'No', b: 'No — a 23% tier is available for exclusivity' },
          { term: 'Delivery menu mark-up vs in-store', a: '12%', b: '12%' },
          { term: 'Term / exit', a: '12 months', b: '12 months; 60-day notice; renewal due in 4 months' },
        ] } },
    { id: 'stores', title: 'Store cohort performance', category: 'Regional performance', cost: 6, relevance: 'Medium', value: 'useful',
      description: 'Per-store revenue by channel for mature stores and the FY24 and FY25 opening cohorts.',
      signals: { expansion: 1, cannibal: 2, competition: -1 },
      insight: 'Mature stores lost 10% of dine-in revenue per store while their delivery revenue more than doubled. New stores are ramping roughly to plan — they add fixed cost, but they are not where the margin went.',
      table: { columns: [{ key: 'c', label: 'Cohort', fmt: 'text' }, { key: 'n', label: 'Stores', fmt: 'num0' }, { key: 'di24', label: 'Dine-in / store FY24 (₹ cr)', fmt: 'num2' }, { key: 'di25', label: 'Dine-in / store FY25', fmt: 'num2' }, { key: 'de24', label: 'Delivery / store FY24', fmt: 'num2' }, { key: 'de25', label: 'Delivery / store FY25', fmt: 'num2' }, { key: 'fx', label: 'Fixed cost / store FY25', fmt: 'num2' }],
        rows: [
          { c: 'Mature (opened before FY24)', n: 62, di24: 1.2, di25: 1.08, de24: 0.37, de25: 0.8, fx: 0.8 },
          { c: 'FY24 cohort', n: 12, di24: 0.9, di25: 0.92, de24: 0.455, de25: 0.95, fx: 0.78 },
          { c: 'FY25 cohort', n: 10, di24: null, di25: 0.57, de24: null, de25: 0.82, fx: 0.7 },
        ] },
      chart: { type: 'bar', unit: '₹ cr / mature store', categories: ['Dine-in', 'Delivery'], series: [{ label: 'FY24', values: [1.2, 0.37] }, { label: 'FY25', values: [1.08, 0.8] }] } },
    { id: 'survey', title: 'Delivery customer survey (n = 2,400)', category: 'Customer feedback', cost: 6, relevance: 'Medium', value: 'useful',
      description: 'Commissioned panel of delivery customers: prior behaviour and discount dependence.',
      signals: { cannibal: 2, channel_econ: 1, competition: -1 },
      insight: '41% of delivery customers used to visit a store at least monthly and now visit less. Over half of delivery orders rode a discount. A large share of "growth" is existing customers moved to a channel that earns a third as much.',
      table: { columns: [{ key: 'q', label: 'Finding', fmt: 'text' }, { key: 'v', label: 'Share of respondents %', fmt: 'pct' }],
        rows: [
          { q: 'Previously visited a Brewly store monthly or more; now visit less often', v: 41 },
          { q: 'New to Brewly (first purchase was delivery)', v: 34 },
          { q: 'Existing customers ordering on additional occasions', v: 25 },
          { q: 'Last order used a Brewly discount', v: 58 },
          { q: 'Would order "much less" without discounts', v: 27 },
          { q: 'Would switch to visiting a store if delivery cost more', v: 31 },
        ] } },
    { id: 'input', title: 'Ingredient cost index & COGS breakdown', category: 'Cost breakdowns', cost: 4, relevance: 'High', value: 'ruleout',
      description: 'Procurement prices for milk, tea, sugar and bakery inputs; blended COGS %.',
      signals: { input: -2 },
      insight: 'Milk rose 6%, but blended COGS moved only ~0.8 points of revenue — about ₹1.3 cr. Real, but nowhere near an ₹8 cr decline. Worth four hours to close the finance team\'s favourite theory.',
      table: { columns: [{ key: 'i', label: 'Input', fmt: 'text' }, { key: 's', label: 'Share of COGS %', fmt: 'pct' }, { key: 'p', label: 'Price change FY25 %', fmt: 'pct' }, { key: 'e', label: 'EBITDA effect (₹ cr)', fmt: 'num1' }],
        rows: [{ i: 'Milk', s: 34, p: 6.0, e: -1.1 }, { i: 'Tea leaves & spices', s: 21, p: 4.0, e: -0.5 }, { i: 'Sugar', s: 6, p: -2.0, e: 0.1 }, { i: 'Bakery & snacks', s: 39, p: 0.5, e: 0.2 }, { i: 'Blended COGS % of revenue: 30.7 → 31.5', s: null, p: null, e: -1.3 }] } },
    { id: 'labour', title: 'Store labour scheduling & productivity', category: 'Operational metrics', cost: 5, relevance: 'Low', value: 'useful',
      description: 'Labour hours per store, orders per labour hour, peak staffing by channel.',
      signals: { labour: 1, channel_econ: 1 },
      insight: 'Labour hours rose 9% per store, almost entirely an extra packer per shift in 38 high-delivery stores (~₹1.2 cr). A symptom of the delivery surge, not an independent productivity problem.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'a', label: 'FY24', fmt: 'num1' }, { key: 'b', label: 'FY25', fmt: 'num1' }],
        rows: [{ m: 'Labour hours per store per week', a: 412, b: 449 }, { m: 'In-store orders per labour hour', a: 6.1, b: 6.0 }, { m: 'Stores with a dedicated delivery packer', a: 6, b: 38 }, { m: 'Incremental delivery staffing cost (₹ cr)', a: 0.2, b: 1.4 }, { m: 'Wage inflation %', a: 4.5, b: 5.0 }] } },
    { id: 'competitor', title: 'Competitor scan: Chai Republic', category: 'Competitor information', cost: 5, relevance: 'High', value: 'noise',
      description: 'Outlet locations, pricing and catchment overlap with Brewly stores.',
      signals: { competition: -2 },
      insight: 'Only 9 Brewly stores overlap a Chai Republic outlet, and their dine-in decline (−11%) matches non-overlap stores (−10%). The competitor is visible, not causal.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'v', label: 'Value', fmt: 'text' }],
        rows: [{ m: 'Chai Republic outlets opened FY25', v: '14' }, { m: 'Brewly stores within 500 m of one', v: '9 of 84' }, { m: 'Dine-in change, overlapping Brewly stores', v: '−11%' }, { m: 'Dine-in change, non-overlapping mature stores', v: '−10%' }, { m: 'Price of masala chai (Brewly / Chai Republic)', v: '₹60 / ₹60' }] } },
    { id: 'pricing', title: 'Menu pricing history', category: 'Pricing history', cost: 3, relevance: 'Medium', value: 'noise',
      description: 'In-store list prices and promotions, last eight quarters.',
      signals: { pricing: -2 },
      insight: 'In-store prices rose 1.1% and there was no in-store discounting. Pricing in stores is not part of this story.',
      table: { columns: [{ key: 'm', label: 'Item', fmt: 'text' }, { key: 'a', label: 'FY24', fmt: 'text' }, { key: 'b', label: 'FY25', fmt: 'text' }],
        rows: [{ m: 'Weighted in-store price change', a: '+2.0%', b: '+1.1%' }, { m: 'In-store discount campaigns', a: 'None', b: 'None' }, { m: 'Loyalty redemptions % of in-store sales', a: '1.8%', b: '1.7%' }] } },
    { id: 'regional', title: 'Performance by city', category: 'Regional performance', cost: 4, relevance: 'Medium', value: 'noise',
      description: 'Revenue, delivery share and EBITDA margin for Bengaluru, Hyderabad and Pune.',
      signals: {},
      insight: 'All three cities show the same pattern. Geography does not discriminate between hypotheses here.',
      table: { columns: [{ key: 'c', label: 'City', fmt: 'text' }, { key: 'r', label: 'Revenue FY25 (₹ cr)', fmt: 'num1' }, { key: 'd', label: 'Delivery share %', fmt: 'pct' }, { key: 'm24', label: 'EBITDA margin FY24 %', fmt: 'pct' }, { key: 'm25', label: 'EBITDA margin FY25 %', fmt: 'pct' }],
        rows: [{ c: 'Bengaluru', r: 96.4, d: 38.6, m24: 11.9, m25: 4.8 }, { c: 'Hyderabad', r: 51.2, d: 37.9, m24: 10.8, m25: 4.3 }, { c: 'Pune', r: 34.4, d: 36.6, m24: 10.4, m25: 3.9 }] } },
  ],
  stakeholders: [
    { id: 'cfo', name: 'Rohit Bansal', role: 'Chief Financial Officer', cost: 3,
      persona: 'Precise, defensive about the finance function, anchored on input costs.',
      bias: 'Believes milk inflation is the main story because it is the variance he reports monthly.',
      opener: 'I have twenty minutes. What do you need from finance?',
      vague: 'That is a broad question. Ask me about a specific cost line, a channel, or how we report margin and I can be useful.',
      outOfScope: 'That is not something finance tracks. Operations or the growth team would know.',
      cards: [
        { id: 'milk', topic: 'Input costs', keywords: ['milk', 'input', 'ingredient', 'cogs', 'inflation', 'raw material', 'tea', 'procurement'], signals: { input: -1 },
          answer: 'Milk went up six percent and I flagged it every month. If you force me to size it, it is a little over a crore at the EBITDA line. I will admit that is smaller than the story I have been telling.' },
        { id: 'reporting', topic: 'How margin is reported', keywords: ['report', 'channel', 'margin', 'contribution', 'p&l', 'profitab', 'track', 'measure', 'allocate'], signals: { channel_econ: 2 },
          answer: 'We report gross margin by store, not contribution by channel. Commission, promotions and platform ads sit in a single "marketing and distribution" line at corporate. Nobody has looked at a delivery order on its own until you asked.' },
        { id: 'fees', topic: 'Aggregator fees', keywords: ['aggregator', 'commission', 'quickdine', 'fee', 'platform', 'promotion', 'discount', 'ads'], signals: { channel_econ: 2 },
          answer: 'The marketing and distribution line roughly tripled. Commission went from 22 to 26 percent at renewal and we started co-funding discounts. Growth signed that off; finance was told it would pay for itself in volume.' },
        { id: 'fixed', topic: 'Fixed costs', keywords: ['fixed', 'rent', 'store cost', 'overhead', 'new store', 'expansion', 'capex'], signals: { expansion: 1 },
          answer: 'Store fixed costs rose eight crore: about five from the ten new outlets, the rest wage inflation and extra delivery staffing. The new stores are tracking close to their business cases.' },
      ] },
    { id: 'growth', name: 'Ananya Rao', role: 'Head of Growth & Delivery', cost: 3,
      persona: 'Energetic, persuasive, measured on revenue and new customers.',
      bias: 'Her bonus is tied to delivery revenue. Frames every cost as an investment in scale.',
      opener: 'Delivery is the best thing that has happened to this company. Happy to walk you through it.',
      vague: 'I can talk about delivery all day — give me something specific. Volumes, the QuickDine deal, discounts, customers?',
      outOfScope: 'Not my area. Rohit or the store ops team would have that.',
      cards: [
        { id: 'deal', topic: 'QuickDine renewal', keywords: ['contract', 'renewal', 'commission', 'quickdine', 'aggregator', 'prime', 'deal', 'terms', 'negotiat'], signals: { channel_econ: 2 },
          answer: 'We took the Prime placement tier at 26 percent because it puts us at the top of search. I did not push back hard on the rate; ranking mattered more. The contract is up for renewal in four months, and they have floated a lower rate for exclusivity.' },
        { id: 'discounts', topic: 'Discounting', keywords: ['discount', 'promo', 'chai hour', 'campaign', 'offer', 'coupon', 'fund'], signals: { channel_econ: 2 },
          answer: 'Chai Hour is always-on and we fund twelve percent of order value. When we paused it for two weeks in Pune, orders dipped about fifteen percent and ranking slipped a little. I read that as proof we need it. I suppose you could read it as eighty-five percent of orders not needing the discount.' },
        { id: 'customers', topic: 'Who orders delivery', keywords: ['customer', 'new', 'incremental', 'cannibal', 'who', 'existing', 'store', 'switch', 'footfall'], signals: { cannibal: 1 },
          answer: 'We report delivery customers as new users on the platform. Whether they were already walking into our stores — honestly, we have never matched that. The platform does not share identities.' },
        { id: 'target', topic: 'Targets & incentives', keywords: ['target', 'bonus', 'incentive', 'kpi', 'measured', 'goal'], signals: { channel_econ: 1 },
          answer: 'My team is measured on delivery revenue and platform ranking. Nobody gave us a contribution target.' },
      ] },
    { id: 'coo', name: 'Farhan Sheikh', role: 'Chief Operating Officer', cost: 3,
      persona: 'Practical, store-first, sceptical of delivery.',
      bias: 'Feels stores are being blamed; tends to over-attribute problems to delivery disruption.',
      opener: 'I run the stores. Ask me what is happening on the floor.',
      vague: 'Be specific — staffing, new stores, kitchen load, footfall? I do not deal in generalities.',
      outOfScope: 'You would need finance or growth for that.',
      cards: [
        { id: 'newstores', topic: 'New stores', keywords: ['new store', 'expansion', 'ramp', 'opening', 'outlet', 'cohort'], signals: { expansion: -1 },
          answer: 'The FY25 stores are at about sixty percent of mature dine-in revenue in year one, which is exactly the ramp curve we planned. They cost money before they earn it, but they are not underperforming.' },
        { id: 'kitchen', topic: 'Kitchen & labour', keywords: ['labour', 'labor', 'staff', 'kitchen', 'packer', 'productivity', 'peak', 'capacity', 'wait'], signals: { labour: 1, cannibal: 1 },
          answer: 'Thirty-eight stores now run a dedicated packer every shift. At peak, delivery tickets jump the queue and dine-in wait times have gone from four minutes to seven. Regulars have noticed.' },
        { id: 'footfall', topic: 'Dine-in footfall', keywords: ['footfall', 'dine', 'walk-in', 'traffic', 'regular', 'competitor', 'chai republic', 'visits'], signals: { cannibal: 2, competition: -1 },
          answer: 'Footfall in mature stores is down about ten percent. It is down everywhere, not only near Chai Republic. My managers say they see their regulars\' names on delivery tickets now.' },
      ] },
    { id: 'manager', name: 'Lakshmi Iyer', role: 'Store Manager, Indiranagar', cost: 2,
      persona: 'Candid, observant, speaks from one store\'s experience.',
      bias: 'Knows her store deeply but generalises from it.',
      opener: 'I have run Indiranagar for five years. What would you like to know?',
      vague: 'I can only tell you what I see in my store. Customers? The delivery rush? Staffing?',
      outOfScope: 'I would not know about that — I only see my own store\'s numbers.',
      cards: [
        { id: 'regulars', topic: 'Regular customers', keywords: ['customer', 'regular', 'footfall', 'dine', 'visit', 'delivery', 'order', 'switch'], signals: { cannibal: 2 },
          answer: 'I know maybe two hundred regulars by name. A good third of them now order in on weekdays. With Chai Hour the delivery price is nearly the same as walking in, so why would they come?' },
        { id: 'rush', topic: 'Delivery rush', keywords: ['rush', 'peak', 'packer', 'staff', 'kitchen', 'wait', 'riders', 'queue'], signals: { labour: 1 },
          answer: 'From four to seven it is chaos. Riders crowd the counter, and we added a packer on both shifts. Tables are emptier but the kitchen is busier than ever.' },
      ] },
  ],
  quant: [
    { id: 'q1', prompt: 'What was the contribution per delivery order in FY25?', unit: '₹', requires: ['channel_econ'], answer: perOrder(d25), tolAbs: 1,
      explain: `AOV ₹230 less COGS (32%), commission (26%), discount (12%), ads (5%) and ₹18 packaging = ₹${r1(perOrder(d25))}.` },
    { id: 'q2', prompt: 'How many delivery orders does Brewly need to earn the contribution of one dine-in order (FY25)?', unit: 'orders', requires: ['channel_econ'], answer: perOrder(Y.FY25.dine) / perOrder(d25), tolAbs: 0.15,
      explain: `₹${r1(perOrder(Y.FY25.dine))} ÷ ₹${r1(perOrder(d25))} = ${r2(perOrder(Y.FY25.dine) / perOrder(d25))}.` },
    { id: 'q3', prompt: 'What share of FY25 revenue came from delivery?', unit: '%', requires: ['channel_rev'], answer: (d25.rev / T.FY25.rev) * 100, tolAbs: 0.6,
      explain: `₹${d25.rev} cr ÷ ₹${r1(T.FY25.rev)} cr = ${pct(d25.rev / T.FY25.rev)}%.` },
    { id: 'q4', prompt: 'By how much did total channel contribution change from FY24 to FY25?', unit: '₹ cr', requires: ['pnl'], answer: T.FY25.con - T.FY24.con, tolAbs: 0.4,
      explain: `₹${r1(T.FY25.con)} cr − ₹${r1(T.FY24.con)} cr = ₹${r1(T.FY25.con - T.FY24.con)} cr, on ₹${r1(T.FY25.rev - T.FY24.rev)} cr of extra revenue.` },
    { id: 'q5', prompt: 'If commission returned to 22% and Brewly-funded discounts halved to 6%, with delivery orders falling 15%, what would annual delivery contribution be?', unit: '₹ cr', requires: ['channel_econ', 'channel_rev'],
      answer: (orders(d25) * 0.85 * (d25.aov * (1 - d25.cogs - 0.22 - 0.06 - d25.ads) - d25.pack)) / 1e7, tolAbs: 0.6,
      explain: 'Per order: 230 × (1 − 0.32 − 0.22 − 0.06 − 0.05) − 18 = ₹62.5. Orders: 300.9 lakh × 0.85 = 255.7 lakh. Contribution ≈ ₹16.0 cr vs ₹11.9 cr today.' },
  ],
  scenario: {
    title: 'Delivery economics simulator', requires: ['channel_econ'],
    note: 'FY25 delivery base. Adjust contract and promotion terms and the volume you expect to lose.',
    levers: [
      { key: 'commission', label: 'Aggregator commission', unit: '%', min: 18, max: 30, step: 1, default: 26 },
      { key: 'discount', label: 'Brewly-funded discount', unit: '%', min: 0, max: 15, step: 1, default: 12 },
      { key: 'ads', label: 'Platform advertising', unit: '%', min: 0, max: 8, step: 1, default: 5 },
      { key: 'volume', label: 'Delivery order volume change', unit: '%', min: -40, max: 20, step: 5, default: 0 },
      { key: 'recapture', label: 'Lost orders recaptured in-store', unit: '%', min: 0, max: 50, step: 5, default: 0 },
    ],
    compute: scenario,
  },
  options: [
    { id: 'A', label: 'Re-engineer delivery economics', detail: 'Renegotiate commission at renewal, cut always-on discount funding, introduce a minimum order value and delivery-specific bundles. Keep the channel.', quality: 1, impact: [4, 13], drivers: ['channel_econ'] },
    { id: 'B', label: 'Rebalance toward in-store', detail: 'Cap delivery promotion, protect dine-in service at peak, and invest in loyalty to win regulars back into stores.', quality: 0.78, impact: [2, 9], drivers: ['cannibal', 'channel_econ'] },
    { id: 'D', label: 'Pause expansion and cut store fixed costs', detail: 'Freeze new openings for four quarters and take out store-level cost.', quality: 0.5, impact: [1.5, 6], drivers: ['expansion', 'labour'] },
    { id: 'C', label: 'Exit aggregators and build an own-delivery app', detail: 'Give notice to QuickDine and move delivery to a first-party app and fleet.', quality: 0.4, impact: [-4, 6], drivers: ['channel_econ'] },
    { id: 'E', label: 'Raise in-store prices by 8%', detail: 'Recover margin through an across-the-board in-store price increase.', quality: 0.2, impact: [1, 6], drivers: ['pricing'] },
    { id: 'F', label: 'Double down on delivery for scale', detail: 'Increase promotion to grow delivery volume and negotiate better terms from scale later.', quality: 0.08, impact: [-6, 2], drivers: [] },
  ],
  diagnoses: [
    { id: 'full', label: 'Delivery-led growth at collapsing unit economics, compounded by cannibalisation', requires: ['channel_econ', 'cannibal'], quality: 1 },
    { id: 'econ', label: 'Delivery unit economics collapsed after the contract renewal', requires: ['channel_econ'], quality: 0.85 },
    { id: 'cann', label: 'Delivery is cannibalising richer in-store demand', requires: ['cannibal'], quality: 0.65 },
    { id: 'fixed', label: 'Fixed-cost growth from expansion outpaced contribution', requires: ['expansion'], quality: 0.4 },
  ],
  concepts: {
    diagnosis: [['deliver'], ['contribution', 'unit economics', 'per order', 'margin'], ['commission', 'discount', 'promo', 'aggregator', 'quickdine'], ['cannibal', 'switch', 'regular', 'dine-in', 'in-store', 'mix']],
    risks: [['volume', 'orders fall', 'lose'], ['ranking', 'visibility', 'aggregator', 'retaliat', 'quickdine'], ['growth', 'investor', 'board', 'revenue'], ['customer', 'churn', 'backlash', 'execution']],
    nextSteps: [['pilot', 'test', 'trial', 'experiment'], ['negotiat', 'renewal', 'contract'], ['track', 'report', 'dashboard', 'kpi', 'measure', 'contribution by channel'], ['week', 'month', 'day', 'quarter', 'owner']],
  },
  boardroom: {
    ceo: { name: 'Meera Krishnan', role: 'CEO' },
    challenges: [
      { id: 'growth', kind: 'Strategic', forOptions: ['A', 'B', 'D', 'C'],
        prompt: 'Delivery accounts for essentially all of our revenue growth this year, and my investor wants twenty percent again. You are asking me to squeeze the one thing that is growing. Why should I accept that?',
        fallbackPrompt: 'Finance tells me delivery orders make almost nothing. You are telling me to lean in further. Convince me that this is not just buying revenue.',
        concepts: [['contribution', 'profit', 'margin', 'ebitda'], ['per order', '39', '40', '122', 'three', '3x', 'third'], ['cannibal', 'existing customers', 'regulars', '41', 'switch'], ['not eliminat', 'keep', 'profitable growth', 'still grow', 'quality of growth', 'reprice', 'not exit']],
        strong: 'That is the distinction I needed: growth in revenue versus growth in contribution. Go on.',
        weak: 'You have told me what you believe, not why the numbers force it. I am not yet persuaded.' },
      { id: 'number', kind: 'Financial',
        prompt: 'Put a number on it. What does your recommendation do to EBITDA next year, and which single assumption is that number most sensitive to?',
        concepts: [['cr', 'crore', '₹'], ['assum', 'sensitiv', 'depends'], ['volume', 'orders', 'elastic', '15', 'commission', 'recapture'], ['range', 'between', 'downside', 'worst', 'scenario', 'if']],
        needsNumber: true,
        strong: 'Good. A number, a range and the assumption that could break it. That is what the board will ask for.',
        weak: 'I heard confidence but not a number I can hold you to, or the assumption underneath it.' },
      { id: 'ops', kind: 'Operational',
        prompt: 'Ananya says the moment we touch discounts or push back on commission, QuickDine buries us in search and volume collapses. What exactly do you do in the first sixty days, and how will we know if she is right?',
        concepts: [['pilot', 'test', 'one city', 'pune', 'phase', 'trial', 'subset'], ['measure', 'track', 'metric', 'contribution', 'ranking', 'monitor'], ['minimum order', 'bundle', 'menu', 'loyalty', 'own channel', 'takeaway'], ['renewal', 'negotiat', 'leverage', 'second aggregator', 'alternative']],
        strong: 'A staged test with a clear read-out. That I can sell to Ananya.',
        weak: 'That is an intention, not a plan. I still do not know what happens on day one.' },
    ],
    twist: {
      title: 'A call from QuickDine',
      prompt: 'I have just come off a call. QuickDine will cut our commission from 26% to 21% if we sign a two-year exclusive, commit to platform ads of at least 6% of delivery sales, and keep Chai Hour running. They want an answer this week. Does this change your recommendation?',
      facts: ['Commission 26% → 21%', 'Two-year exclusivity (drops the second aggregator, ~20% of delivery volume)', 'Minimum ad spend 6% of delivery sales (currently 5%)', 'Chai Hour discount funding must continue at 12%'],
      stances: [
        { id: 'counter', label: 'Counter-propose: use it as leverage, but not on these terms', quality: 1, note: 'The offer proves the rate is negotiable. The net gain is ~4 points before losing 20% of volume and locking in the discount that drives cannibalisation. Countering on term, ad floor and discount freedom is the strongest position.' },
        { id: 'accept', label: 'Accept: the commission cut is worth the lock-in', quality: 0.55, note: 'A 5-point commission cut is real money, but exclusivity removes ~20% of delivery volume and the discount clause preserves the main leak for two years.' },
        { id: 'reject', label: 'Reject outright and hold course', quality: 0.5, note: 'Defensible if your plan depends on optionality, but it leaves a demonstrated negotiating opening unused four months before renewal.' },
      ],
      concepts: [['exclusiv', 'lock', 'two year', 'second aggregator', '20%'], ['discount', 'chai hour', '12'], ['net', 'points', 'ads', '6%', 'offset'], ['leverage', 'negotiab', 'counter', 'shorter', 'term', 'renewal']],
    },
  },
  expertPaths: [
    { id: 'topdown', name: 'Top-down profit tree', summary: 'Start from the P&L, find the line that moved, then decompose it by channel before testing why.',
      steps: [
        { type: 'hypothesis', text: 'Open with 4–5 hypotheses across revenue quality, variable cost and fixed cost. Hold no more than 35 points on any one.' },
        { type: 'data', ref: 'pnl', why: 'Cheap, broad, and shows which cost lines grew faster than revenue.' },
        { type: 'update', text: 'Shift confidence away from input costs and toward channel economics.' },
        { type: 'data', ref: 'channel_rev', why: 'Confirms that growth is almost entirely delivery and that dine-in shrank.' },
        { type: 'data', ref: 'channel_econ', why: 'The decisive cut: contribution per order by channel.' },
        { type: 'calc', ref: 'q1', why: 'Size the gap: ₹39.5 per delivery order against ₹122 dine-in.' },
        { type: 'interview', ref: 'growth', why: 'Understand the renewal and discount decisions, and what is negotiable.' },
        { type: 'data', ref: 'aggregator', why: 'Establishes which terms changed and when the renewal falls due.' },
        { type: 'data', ref: 'survey', why: 'Tests whether delivery is incremental or cannibalising.' },
        { type: 'recommend', ref: 'A', why: 'Reprice the channel rather than abandon it.' },
      ] },
    { id: 'customer', name: 'Customer-back route', summary: 'Begin with where demand moved, then follow the money.',
      steps: [
        { type: 'hypothesis', text: 'Lead with demand-side hypotheses: channel switching, competition, pricing.' },
        { type: 'data', ref: 'channel_rev', why: 'Shows the migration between channels.' },
        { type: 'data', ref: 'stores', why: 'Mature stores lost dine-in as delivery doubled; new stores are on plan.' },
        { type: 'interview', ref: 'manager', why: 'Ground truth on regulars moving to delivery.' },
        { type: 'data', ref: 'survey', why: 'Quantifies cannibalisation at 41%.' },
        { type: 'data', ref: 'channel_econ', why: 'Prices the migration: each switched order loses two-thirds of its contribution.' },
        { type: 'calc', ref: 'q2', why: 'Three delivery orders to replace one dine-in order.' },
        { type: 'recommend', ref: 'B', why: 'Protect in-store demand and stop subsidising the switch.' },
      ] },
  ],
  hints: [
    'Revenue and profit are telling different stories. Which cost lines grew faster than revenue?',
    'Company-level averages hide mix. What does one order earn in each channel?',
    'Ask whether the new delivery customers are new at all.',
  ],
  debrief: {
    headline: 'Brewly bought revenue with its own margin.',
    narrative: [
      `Delivery revenue grew from ₹${Y.FY24.deliv.rev} cr to ₹${d25.rev} cr, while the contribution of a delivery order fell from ₹${r1(perOrder(Y.FY24.deliv))} to ₹${r1(perOrder(d25))} after three decisions at the FY25 renewal: a higher commission tier, always-on co-funded discounts and more platform advertising.`,
      'At the same time, roughly four in ten delivery customers were existing regulars who now visit stores less. Each of those orders moved from a ₹122 contribution to under ₹40. Total contribution barely moved on ₹40 cr of extra revenue, while fixed costs grew ₹9.5 cr to serve it.',
      'Input costs, competition and the new-store ramp are all real and all small. The strongest investigations rule them out cheaply and spend their hours pricing the channel shift.',
    ],
    keyNumbers: [
      { label: 'Delivery contribution / order', value: `₹${r1(perOrder(Y.FY24.deliv))} → ₹${r1(perOrder(d25))}` },
      { label: 'Dine-in contribution / order', value: `₹${r1(perOrder(Y.FY25.dine))}` },
      { label: 'Contribution growth on +₹40 cr revenue', value: `₹${r1(T.FY25.con - T.FY24.con)} cr` },
      { label: 'Delivery customers who were regulars', value: '41%' },
    ],
    lessons: [
      'Revenue growth is not evidence of health. Decompose it by the unit that earns the margin.',
      'A popular hypothesis that is cheap to test is worth testing — to close it.',
      'When stakeholders disagree, look at how each is measured.',
    ],
  },
};
