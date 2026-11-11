// Northstar Bank — original fictional case. Acquisition-quality and fee-policy mechanics.
const r1 = (n) => Math.round(n * 10) / 10 + 0;
const r2 = (n) => Math.round(n * 100) / 100 + 0;

// accounts in thousands; CAC and revenue in ₹
const CHN = [
  { id: 'branch', name: 'Branch walk-in', n24: 210, n25: 170, cac24: 1900, cac25: 1900, act: 0.78, ret: 0.88, rev: 3400 },
  { id: 'salary', name: 'Corporate salary tie-ups', n24: 150, n25: 140, cac24: 1100, cac25: 1100, act: 0.92, ret: 0.93, rev: 5200 },
  { id: 'referral', name: 'Customer referral', n24: 60, n25: 70, cac24: 600, cac25: 600, act: 0.85, ret: 0.90, rev: 3800 },
  { id: 'digital', name: 'Paid digital (cashback campaigns)', n24: 120, n25: 260, cac24: 2400, cac25: 3600, act: 0.41, ret: 0.46, rev: 1300 },
  { id: 'dsa', name: 'DSA / aggregator partners', n24: 80, n25: 140, cac24: 2000, cac25: 3100, act: 0.52, ret: 0.58, rev: 1900 },
];
const tot = (k) => CHN.reduce((s, c) => s + c[k], 0);
const spend = (y) => CHN.reduce((s, c) => s + c['n' + y] * c['cac' + y], 0) / 1e4; // ₹ cr
const cac = (y) => (spend(y) * 1e4) / tot('n' + y);
const ltv3 = (c) => c.rev * c.act * (1 + c.ret + c.ret * c.ret);
const FEE = { penalised: 8.9, attrPen: 0.38, attrNot: 0.14, massRev: 2600, income24: 21, income25: 58 };
const excess = FEE.penalised * (FEE.attrPen - FEE.attrNot); // lakh customers
const lostRev = (excess * 1e5 * FEE.massRev) / 1e7; // ₹ cr
const SEG = [
  { s: 'Mass (balance < ₹10k)', b24: 22.5, a24: 13, b25: 24, a25: 23 },
  { s: 'Mid (₹10k–₹2 lakh)', b24: 12.6, a24: 9.5, b25: 13, a25: 10.5 },
  { s: 'Affluent (> ₹2 lakh)', b24: 4.9, a24: 6, b25: 5, a25: 6.5 },
];
const attr = (y) => SEG.reduce((s, x) => s + x['b' + y] * x['a' + y], 0) / SEG.reduce((s, x) => s + x['b' + y], 0);

function scenario(i) {
  const adj = { digital: 1 + i.digital / 100, dsa: 1 + i.dsa / 100, salary: 1 + i.salary / 100, referral: 1 + i.referral / 100, branch: 1 };
  let n = 0, sp = 0, val = 0, base = 0;
  for (const c of CHN) {
    const k = c.n25 * adj[c.id]; n += k; sp += k * c.cac25; val += k * (ltv3(c) - c.cac25); base += c.n25 * (ltv3(c) - c.cac25);
  }
  const exempt = i.waiver / 100;
  const feeIncome = FEE.income25 - (FEE.income25 - FEE.income24) * exempt;
  const retained = lostRev * exempt;
  return {
    outputs: [
      { label: 'New accounts', value: r1(n / 100), unit: 'lakh' },
      { label: 'Blended CAC', value: Math.round(sp / n), unit: '₹' },
      { label: 'Acquisition spend', value: r1(sp / 1e4), unit: '₹ cr' },
      { label: '3-yr value of cohort, net of CAC', value: r1(val / 1e4), unit: '₹ cr' },
      { label: 'Change in cohort value vs FY25', value: r1((val - base) / 1e4), unit: '₹ cr', highlight: true },
      { label: 'Penalty fee income', value: r1(feeIncome), unit: '₹ cr' },
      { label: 'Revenue retained from fewer fee exits', value: r1(retained), unit: '₹ cr / yr' },
    ],
    bars: [{ label: 'FY25 cohort value', value: r1(base / 1e4) }, { label: 'Scenario cohort value', value: r1(val / 1e4) }, { label: 'Net fee effect', value: r1(retained - (FEE.income25 - feeIncome)) }],
  };
}

export default {
  id: 'northstar',
  title: 'The Leaking Balance Sheet',
  company: 'Northstar Bank',
  industry: 'Banking & Financial Services',
  func: 'Marketing & Customer',
  problemType: 'Customer churn',
  difficulty: 3, difficultyLabel: 'Advanced',
  durationMin: 45, xpReward: 550, budgetHours: 34,
  skills: ['hypothesis', 'quant', 'synthesis'],
  tags: ['new'], unlockRank: 0, currency: '₹',
  blurb: 'A retail bank opened a record 7.8 lakh accounts, yet attrition jumped six points and the cost of acquiring a customer rose 43%. Two different mechanisms are hiding inside one number.',
  briefing: {
    from: { name: 'Vikram Suri', role: 'Managing Director & CEO, Northstar Bank' },
    subject: 'Record acquisition, record attrition',
    memo: [
      `Northstar opened ${r1(tot('n25') / 100)} lakh savings accounts in FY25, the most in our history. In the same year annual attrition rose from ${r1(attr(24))}% to ${r1(attr(25))}%, and what we pay to acquire an account went from ₹${Math.round(cac(24)).toLocaleString('en-IN')} to ₹${Math.round(cac(25)).toLocaleString('en-IN')}.`,
      'My marketing head says we are winning. My retail head says fintechs are stealing deposits with rates we cannot match. The branches say customers are angry about the app. I suspect each of them is describing a different corner of the same problem.',
      'Tell me where customers are actually leaving from, why, and what I should change first. I would rather hear an uncomfortable answer now than explain a third bad quarter to the board.',
    ],
    background: [
      'Mid-sized private retail bank: 42 lakh savings customers, 310 branches across western and southern India.',
      'Five acquisition channels: branch walk-in, corporate salary tie-ups, referral, paid digital campaigns and direct selling agents (DSAs).',
      'In Q1 FY25 the bank revised its savings-account minimum balance and penalty schedule.',
    ],
    objective: 'Diagnose the rise in attrition and acquisition cost, and recommend where the bank should act first.',
    constraints: ['34 analyst hours for data requests and interviews.', 'No change to deposit rates without treasury approval.', 'The board has set a new-to-bank customer target of 8 lakh for FY26.'],
    context: ['Fintech Zeno launched a 6.5% savings product during the year.', 'The mobile app suffered two outages in FY25.', 'Fourteen low-traffic branches were closed.'],
    metrics: [
      { label: 'New accounts FY25', value: `${r1(tot('n25') / 100)} lakh`, delta: `+${r1((tot('n25') / tot('n24') - 1) * 100)}%`, tone: 'up' },
      { label: 'Annual attrition', value: `${r1(attr(25))}%`, delta: `+${r1(attr(25) - attr(24))} pts`, tone: 'down' },
      { label: 'Blended CAC', value: `₹${Math.round(cac(25)).toLocaleString('en-IN')}`, delta: `+${r1((cac(25) / cac(24) - 1) * 100)}%`, tone: 'down' },
      { label: 'Acquisition spend', value: `₹${r1(spend(25))} cr`, delta: `+${r1((spend(25) / spend(24) - 1) * 100)}%`, tone: 'down' },
    ],
    trend: { label: 'New accounts (lakh) vs attrition (%)', x: ['FY23', 'FY24', 'FY25'], series: [{ label: 'New accounts', values: [5.7, 6.2, 7.8] }, { label: 'Attrition %', values: [10.6, r1(attr(24)), r1(attr(25))] }] },
  },
  drivers: [
    { id: 'acq', label: 'Acquisition channel mix & account quality', truth: 0.4, side: 'revenue' },
    { id: 'fees', label: 'Fee & minimum-balance policy', truth: 0.33, side: 'revenue' },
    { id: 'service', label: 'Digital experience & service reliability', truth: 0.1, side: 'cost' },
    { id: 'rates', label: 'Competitor deposit rates / fintechs', truth: 0.07, side: 'revenue' },
    { id: 'branches', label: 'Branch network changes', truth: 0.05, side: 'cost' },
    { id: 'product', label: 'Product gaps & weak cross-sell', truth: 0.05, side: 'revenue' },
  ],
  hypothesisSeeds: [
    { text: 'Fintechs offering higher savings rates are pulling deposits and customers away.', driver: 'rates' },
    { text: 'Growth has come from channels that deliver accounts which never become active, raising CAC and early attrition.', driver: 'acq' },
    { text: 'App outages and poor digital experience are driving customers to close accounts.', driver: 'service' },
    { text: 'The new minimum-balance penalty is pushing mass-segment customers out.', driver: 'fees' },
  ],
  datasets: [
    { id: 'kpi', title: 'Customer & financial summary, FY23–FY25', category: 'Financial statements', cost: 4, relevance: 'High', value: 'useful',
      description: 'Customer base, openings, closures, deposits, fee income and acquisition spend.',
      signals: { acq: 1, fees: 1 },
      insight: 'Fee income and acquisition spend both rose sharply in the same year attrition rose. Two levers were pulled at once; the summary cannot tell you which one bit.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'a', label: 'FY23', fmt: 'num1' }, { key: 'b', label: 'FY24', fmt: 'num1' }, { key: 'c', label: 'FY25', fmt: 'num1' }],
        rows: [{ m: 'Savings customers, start of year (lakh)', a: 38.2, b: 40, c: 42 }, { m: 'New accounts (lakh)', a: 5.7, b: 6.2, c: 7.8 }, { m: 'Accounts closed or dormant (lakh)', a: 4.0, b: 4.4, c: 7.2 }, { m: 'Attrition %', a: 10.6, b: r1(attr(24)), c: r1(attr(25)) },
          { m: 'Acquisition spend (₹ cr)', a: 92.0, b: r1(spend(24)), c: r1(spend(25)) }, { m: 'Minimum-balance penalty income (₹ cr)', a: 19, b: FEE.income24, c: FEE.income25 }, { m: 'Average savings balance (₹ 000)', a: 41.5, b: 42.8, c: 39.6 }] } },
    { id: 'channels', title: 'Acquisition by channel: volume and cost', category: 'Sales data', cost: 5, relevance: 'High', value: 'critical',
      description: 'New accounts and cost per account for each acquisition channel.',
      signals: { acq: 2, branches: -1 },
      insight: 'Paid digital and DSAs went from 32% to 51% of new accounts, and their cost per account rose ~50% as the bank bid for volume. The mix shift alone explains the CAC increase.',
      table: { columns: [{ key: 'ch', label: 'Channel', fmt: 'text' }, { key: 'n24', label: 'Accounts FY24 (000)', fmt: 'num0' }, { key: 'n25', label: 'Accounts FY25 (000)', fmt: 'num0' }, { key: 'c24', label: 'CAC FY24 (₹)', fmt: 'num0' }, { key: 'c25', label: 'CAC FY25 (₹)', fmt: 'num0' }, { key: 'sp', label: 'Spend FY25 (₹ cr)', fmt: 'num1' }],
        rows: CHN.map((c) => ({ ch: c.name, n24: c.n24, n25: c.n25, c24: c.cac24, c25: c.cac25, sp: r1((c.n25 * c.cac25) / 1e4) })) },
      chart: { type: 'bar', unit: 'accounts (000)', categories: CHN.map((c) => c.name.split(' (')[0]), series: [{ label: 'FY24', values: CHN.map((c) => c.n24) }, { label: 'FY25', values: CHN.map((c) => c.n25) }] } },
    { id: 'cohort', title: 'Cohort quality by acquisition channel', category: 'Customer cohorts', cost: 7, relevance: 'Medium', value: 'critical',
      description: '90-day activation, 12-month retention and annual revenue per active customer for FY24 cohorts, by channel.',
      signals: { acq: 2, rates: -1 },
      insight: 'Fewer than half of paid-digital accounts ever activate and fewer than half of those survive a year. A paid-digital account returns about a quarter of its acquisition cost over three years; a salary account returns twelve times.',
      table: { columns: [{ key: 'ch', label: 'Channel', fmt: 'text' }, { key: 'act', label: '90-day activation %', fmt: 'pct' }, { key: 'ret', label: '12-month retention %', fmt: 'pct' }, { key: 'rev', label: 'Revenue / active customer (₹)', fmt: 'num0' }, { key: 'cac', label: 'CAC FY25 (₹)', fmt: 'num0' }],
        rows: CHN.map((c) => ({ ch: c.name, act: c.act * 100, ret: c.ret * 100, rev: c.rev, cac: c.cac25 })) },
      chart: { type: 'bar', unit: '%', categories: CHN.map((c) => c.name.split(' (')[0]), series: [{ label: 'Activation', values: CHN.map((c) => c.act * 100) }, { label: '12-mo retention', values: CHN.map((c) => c.ret * 100) }] } },
    { id: 'segments', title: 'Attrition by segment and tenure', category: 'Customer cohorts', cost: 5, relevance: 'High', value: 'critical',
      description: 'Closures and dormancy split by balance segment and by customer tenure.',
      signals: { fees: 2, acq: 1, rates: -2, service: -1 },
      insight: 'Attrition rose ten points in the mass segment and barely moved for affluent customers — the ones a rate-chasing fintech would take first. Leavers are both brand-new accounts and long-tenured mass customers: two mechanisms.',
      table: { columns: [{ key: 's', label: 'Segment / tenure', fmt: 'text' }, { key: 'b25', label: 'Customers FY25 (lakh)', fmt: 'num1' }, { key: 'a24', label: 'Attrition FY24 %', fmt: 'pct' }, { key: 'a25', label: 'Attrition FY25 %', fmt: 'pct' }, { key: 'l', label: 'Leavers FY25 (lakh)', fmt: 'num2' }],
        rows: [...SEG.map((x) => ({ s: x.s, b25: x.b25, a24: x.a24, a25: x.a25, l: r2((x.b25 * x.a25) / 100) })),
          { s: 'Tenure under 12 months', b25: null, a24: null, a25: null, l: 2.6 }, { s: 'Tenure 1–3 years', b25: null, a24: null, a25: null, l: 2.0 }, { s: 'Tenure over 3 years', b25: null, a24: null, a25: null, l: 2.61 }] },
      chart: { type: 'bar', unit: 'attrition %', categories: ['Mass', 'Mid', 'Affluent'], series: [{ label: 'FY24', values: SEG.map((x) => x.a24) }, { label: 'FY25', values: SEG.map((x) => x.a25) }] } },
    { id: 'fees', title: 'Minimum-balance policy change & penalty incidence', category: 'Pricing history', cost: 6, relevance: 'Medium', value: 'critical',
      description: 'Old and new fee schedule, number of customers penalised and what happened to them.',
      signals: { fees: 2 },
      insight: `${FEE.penalised} lakh mass customers were penalised at least once; 38% of them left within the year against 14% of those who were not. The policy earned ₹${FEE.income25 - FEE.income24} cr of extra fees and drove out about ${r1(excess)} lakh customers worth ₹${r1(lostRev)} cr a year.`,
      table: { columns: [{ key: 'm', label: 'Item', fmt: 'text' }, { key: 'a', label: 'Before (FY24)', fmt: 'text' }, { key: 'b', label: 'After (FY25)', fmt: 'text' }],
        rows: [{ m: 'Minimum average balance', a: '₹5,000', b: '₹10,000' }, { m: 'Monthly penalty for shortfall', a: '₹150', b: '₹350' }, { m: 'Mass customers penalised at least once (lakh)', a: '4.1', b: String(FEE.penalised) },
          { m: 'Attrition among penalised mass customers', a: '17%', b: '38%' }, { m: 'Attrition among non-penalised mass customers', a: '12%', b: '14%' }, { m: 'Penalty income (₹ cr)', a: String(FEE.income24), b: String(FEE.income25) }, { m: 'Annual revenue per mass customer (₹)', a: '2,600', b: '2,600' }] } },
    { id: 'marketing', title: 'Campaign & partner payout detail', category: 'Cost breakdowns', cost: 5, relevance: 'Medium', value: 'useful',
      description: 'How paid digital campaigns and DSA partners are briefed and paid.',
      signals: { acq: 2 },
      insight: 'Digital campaigns pay a ₹500 cashback on account opening; DSAs are paid per account opened, with a volume accelerator. Nobody is paid for an account that is funded or used.',
      table: { columns: [{ key: 'm', label: 'Item', fmt: 'text' }, { key: 'v', label: 'Detail', fmt: 'text' }],
        rows: [{ m: 'Paid digital offer', v: '₹500 cashback on opening; no funding requirement' }, { m: 'Media cost per opened account', v: '₹3,100 (up from ₹1,900 as bids rose)' }, { m: 'DSA payout basis', v: 'Per account opened; +25% accelerator above monthly quota' },
          { m: 'DSA clawback for inactive accounts', v: 'None' }, { m: 'Marketing team KPI', v: 'New-to-bank accounts' }, { m: 'Accounts with zero balance at day 90 (paid digital)', v: '59%' }] } },
    { id: 'complaints', title: 'Complaints and exit-survey themes', category: 'Customer feedback', cost: 4, relevance: 'Medium', value: 'useful',
      description: 'Coded reasons from 18,000 complaints and 3,200 exit surveys.',
      signals: { fees: 2, service: -1, rates: -1 },
      insight: 'Charges are cited by 46% of leavers; the app by 12% and "better rate elsewhere" by 9%. The loudest internal theories are the quietest in the customer data.',
      table: { columns: [{ key: 'r', label: 'Stated reason for leaving', fmt: 'text' }, { key: 'v', label: 'Share of exit surveys %', fmt: 'pct' }],
        rows: [{ r: 'Unexpected charges / minimum balance', v: 46 }, { r: 'Opened for an offer, never intended to use', v: 19 }, { r: 'App or service problems', v: 12 }, { r: 'Better interest rate elsewhere', v: 9 }, { r: 'Branch closed or too far', v: 5 }, { r: 'Other', v: 9 }] } },
    { id: 'app', title: 'Mobile app performance & outage log', category: 'Operational metrics', cost: 4, relevance: 'High', value: 'ruleout',
      description: 'App rating, monthly active users, incident log and attrition around outages.',
      signals: { service: -2 },
      insight: 'Two outages, a rating dip from 4.3 to 4.1, and no visible attrition spike in the following weeks. Worth fixing; not the cause.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'a', label: 'FY24', fmt: 'text' }, { key: 'b', label: 'FY25', fmt: 'text' }],
        rows: [{ m: 'App store rating', a: '4.3', b: '4.1' }, { m: 'Outages over 2 hours', a: '1', b: '2' }, { m: 'Closures in 30 days after an outage vs baseline', a: '+1%', b: '+2%' }, { m: 'Monthly active users (lakh)', a: '21.4', b: '22.9' }] } },
    { id: 'rates', title: 'Competitor deposit-rate benchmark', category: 'Competitor information', cost: 4, relevance: 'High', value: 'ruleout',
      description: 'Savings rates of peers and fintechs; balance outflows by segment.',
      signals: { rates: -2 },
      insight: 'Zeno pays 6.5% against Northstar\'s 3.5%, but affluent balances — the money most sensitive to rates — fell only 3%. Rate competition is a slow leak, not this year\'s break.',
      table: { columns: [{ key: 'm', label: 'Item', fmt: 'text' }, { key: 'v', label: 'Value', fmt: 'text' }],
        rows: [{ m: 'Northstar savings rate', v: '3.5%' }, { m: 'Peer private banks', v: '3.0–4.0%' }, { m: 'Zeno (fintech)', v: '6.5% up to ₹2 lakh' }, { m: 'Affluent balance outflow FY25', v: '−3%' }, { m: 'Affluent attrition FY24 → FY25', v: '6.0% → 6.5%' }] } },
    { id: 'branches', title: 'Branch network changes', category: 'Regional performance', cost: 3, relevance: 'Low', value: 'noise',
      description: 'Closed branches and attrition in their catchments.',
      signals: { branches: -2 },
      insight: 'Attrition in closed-branch catchments was 18.1% against 17.1% elsewhere, across 14 small branches. Immaterial.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'v', label: 'Value', fmt: 'text' }],
        rows: [{ m: 'Branches closed FY25', v: '14 of 324' }, { m: 'Customers in affected catchments', v: '0.9 lakh' }, { m: 'Attrition, affected catchments', v: '18.1%' }, { m: 'Attrition, all other customers', v: '17.1%' }] } },
  ],
  stakeholders: [
    { id: 'cmo', name: 'Priya Malhotra', role: 'Chief Marketing Officer', cost: 3, persona: 'Confident, data-fluent, proud of record acquisition.', bias: 'Measured on new-to-bank accounts; treats activation as someone else\'s problem.',
      opener: 'We delivered the best acquisition year in the bank\'s history. What would you like to see?', vague: 'Can you narrow that down? Channels, campaign economics, partner payouts, targets?', outOfScope: 'That sits with retail product or the branches, not marketing.',
      cards: [
        { id: 'kpi', topic: 'Targets', keywords: ['target', 'kpi', 'measure', 'goal', 'bonus', 'incentive'], signals: { acq: 2 }, answer: 'My scorecard is new-to-bank accounts and cost per account. Activation is tracked by the product team. I have asked for a combined view twice.' },
        { id: 'digital', topic: 'Paid digital', keywords: ['digital', 'cashback', 'campaign', 'performance', 'media', 'online', 'bid', 'cac', 'cost'], signals: { acq: 2 }, answer: 'The cashback offer converts extremely well. We doubled volume. Cost per account went up because we pushed past our best audiences — the marginal account now costs nearly twice the first one.' },
        { id: 'dsa', topic: 'DSA partners', keywords: ['dsa', 'partner', 'aggregator', 'agent', 'payout', 'commission', 'clawback'], signals: { acq: 2 }, answer: 'DSAs are paid per opened account with an accelerator above quota. There is no clawback. A few partners have told us privately that an activation-linked payout would halve their volume.' },
        { id: 'quality', topic: 'Account quality', keywords: ['quality', 'activation', 'active', 'retention', 'churn', 'dormant', 'funded', 'attrition'], signals: { acq: 1 }, answer: 'I know digital accounts activate less. I have not seen the number by channel. If it is as bad as you are implying, I would rather know.' },
      ] },
    { id: 'retail', name: 'Suresh Nair', role: 'Head of Retail Liabilities', cost: 3, persona: 'Veteran banker, cautious, owns the fee schedule.', bias: 'Sponsored the minimum-balance change; attributes attrition to fintech rates.',
      opener: 'Deposits are a rates game now. But go ahead.', vague: 'You will need to be more specific — fees, balances, segments, rates?', outOfScope: 'Marketing owns that. I only see accounts once they are open.',
      cards: [
        { id: 'fee', topic: 'Minimum-balance change', keywords: ['fee', 'minimum', 'balance', 'penalty', 'charge', 'policy', 'mab'], signals: { fees: 2 }, answer: 'We doubled the minimum balance and raised the penalty to ₹350. The business case assumed five percent of penalised customers would leave. We never went back to check that assumption.' },
        { id: 'income', topic: 'Fee income', keywords: ['income', 'revenue', 'earn', 'crore', 'profit', 'p&l'], signals: { fees: 1 }, answer: 'Penalty income went from twenty-one to fifty-eight crore. It is one of the few lines that beat budget, which is why nobody wants to touch it.' },
        { id: 'rates', topic: 'Rates & fintechs', keywords: ['rate', 'fintech', 'zeno', 'interest', 'competitor', 'deposit'], signals: { rates: -1 }, answer: 'Zeno pays six and a half. I assumed that was where customers were going. If you ask me whether our high-balance customers are leaving — no, not really. That does surprise me, now that I say it.' },
        { id: 'regulator', topic: 'Regulation', keywords: ['regulat', 'rbi', 'compliance', 'rule', 'cap'], signals: { fees: 1 }, answer: 'There has been talk of the regulator looking at minimum-balance penalties industry-wide. Nothing formal yet.' },
      ] },
    { id: 'branch', name: 'Kavita Deshmukh', role: 'Regional Branch Head, Pune', cost: 2, persona: 'Direct, customer-facing, tired of head-office theories.', bias: 'Sees only her region; over-weights what customers say at the counter.',
      opener: 'I will tell you what customers tell my tellers.', vague: 'Ask me about what I see at the branches — closures, complaints, who is leaving.', outOfScope: 'Head office would have that. I only see my region.',
      cards: [
        { id: 'counter', topic: 'Why customers close', keywords: ['close', 'leave', 'leaving', 'complain', 'customer', 'reason', 'why', 'attrition', 'angry'], signals: { fees: 2, service: -1 }, answer: 'Nine out of ten closures at my counters start with a passbook and a ₹350 line on it. Some of these people have banked with us for ten years. They are not leaving for an app.' },
        { id: 'digitalaccts', topic: 'Digital accounts', keywords: ['digital', 'online', 'new account', 'dsa', 'cashback', 'dormant', 'zero'], signals: { acq: 1 }, answer: 'We get customers walking in to close accounts they opened on their phone for the cashback. They never deposited a rupee beyond the opening amount.' },
      ] },
    { id: 'customer', name: 'Imran Qureshi', role: 'Former customer (mass segment)', cost: 2, persona: 'Shopkeeper, eleven years with the bank, left in FY25.', bias: 'One customer\'s experience.',
      opener: 'I closed my account in October. What do you want to know?', vague: 'I am not sure what you are asking. Do you want to know why I left?', outOfScope: 'I would not know anything about that.',
      cards: [
        { id: 'why', topic: 'Why he left', keywords: ['why', 'left', 'leave', 'close', 'reason', 'fee', 'charge', 'penalty', 'balance'], signals: { fees: 2 }, answer: 'My balance dips before stock purchases every month. Three months in a row I was charged ₹350. Nobody called, nobody explained. I moved to a bank with no minimum.' },
        { id: 'app', topic: 'App & rates', keywords: ['app', 'rate', 'interest', 'online', 'service', 'fintech'], signals: { service: -1, rates: -1 }, answer: 'The app was fine. I do not keep enough in the account to care about interest.' },
      ] },
  ],
  quant: [
    { id: 'q1', prompt: 'What was the blended cost of acquiring an account in FY25?', unit: '₹', requires: ['channels'], answer: cac(25), tolAbs: 30, explain: `Total spend ₹${r1(spend(25))} cr ÷ 7.8 lakh accounts = ₹${Math.round(cac(25))}.` },
    { id: 'q2', prompt: 'What share of FY25 new accounts came from paid digital and DSA combined?', unit: '%', requires: ['channels'], answer: ((260 + 140) / 780) * 100, tolAbs: 0.6, explain: '(260 + 140) ÷ 780 = 51.3%, up from 32.3% in FY24.' },
    { id: 'q3', prompt: 'Three-year LTV-to-CAC for a paid-digital account. Use LTV = revenue × activation × (1 + r + r²), where r is 12-month retention.', unit: 'x', requires: ['cohort'], answer: ltv3(CHN[3]) / CHN[3].cac25, tolAbs: 0.04, explain: `1,300 × 0.41 × (1 + 0.46 + 0.2116) = ₹${Math.round(ltv3(CHN[3]))}; ÷ ₹3,600 = ${r2(ltv3(CHN[3]) / 3600)}x.` },
    { id: 'q4', prompt: 'Annual revenue lost from attrition attributable to the penalty: penalised customers × (attrition penalised − attrition not penalised) × revenue per mass customer.', unit: '₹ cr', requires: ['fees'], answer: lostRev, tolAbs: 2.5, explain: `8.9 lakh × (38% − 14%) × ₹2,600 = ₹${r1(lostRev)} cr a year.` },
    { id: 'q5', prompt: 'Net annual effect of the fee change: extra penalty income minus revenue lost to fee-attributable attrition.', unit: '₹ cr', requires: ['fees'], answer: FEE.income25 - FEE.income24 - lostRev, tolAbs: 2.5, explain: `₹${FEE.income25 - FEE.income24} cr − ₹${r1(lostRev)} cr = ₹${r1(FEE.income25 - FEE.income24 - lostRev)} cr, before the cost of replacing those customers.` },
  ],
  scenario: {
    title: 'Acquisition mix & fee simulator', requires: ['cohort'], note: 'FY25 base. Re-weight channels and exempt a share of penalised customers from the fee.',
    levers: [
      { key: 'digital', label: 'Paid digital volume', unit: '%', min: -90, max: 20, step: 10, default: 0 },
      { key: 'dsa', label: 'DSA volume', unit: '%', min: -90, max: 20, step: 10, default: 0 },
      { key: 'salary', label: 'Salary tie-up volume', unit: '%', min: 0, max: 60, step: 10, default: 0 },
      { key: 'referral', label: 'Referral volume', unit: '%', min: 0, max: 100, step: 10, default: 0 },
      { key: 'waiver', label: 'Penalised customers exempted', unit: '%', min: 0, max: 100, step: 10, default: 0 },
    ], compute: scenario,
  },
  options: [
    { id: 'A', label: 'Rebuild acquisition around account quality', detail: 'Move budget from cashback campaigns and volume-paid DSAs to salary tie-ups and referral; pay partners on funded, active accounts.', quality: 1, impact: [40, 140], drivers: ['acq'] },
    { id: 'B', label: 'Redesign the minimum-balance fee', detail: 'Tier or waive the penalty for active long-tenure customers, add pre-penalty alerts, and run a win-back for recent leavers.', quality: 0.85, impact: [10, 60], drivers: ['fees'] },
    { id: 'E', label: 'Cut all marketing spend by 40%', detail: 'Across-the-board reduction in acquisition budgets.', quality: 0.4, impact: [20, 80], drivers: ['acq'] },
    { id: 'D', label: 'Rebuild the mobile app', detail: 'Multi-year investment in app reliability and features.', quality: 0.3, impact: [0, 25], drivers: ['service'] },
    { id: 'C', label: 'Match fintech deposit rates', detail: 'Raise savings rates toward 6% to defend deposits.', quality: 0.12, impact: [-80, 10], drivers: ['rates'] },
    { id: 'F', label: 'Reopen and expand the branch network', detail: 'Reverse closures and add branches in growth markets.', quality: 0.1, impact: [-30, 5], drivers: ['branches'] },
  ],
  diagnoses: [
    { id: 'full', label: 'Two mechanisms: low-quality acquisition and fee-driven exits of established customers', requires: ['acq', 'fees'], quality: 1 },
    { id: 'acq', label: 'Volume-incentivised channels deliver accounts that never activate', requires: ['acq'], quality: 0.8 },
    { id: 'fees', label: 'The minimum-balance penalty is driving out mass customers', requires: ['fees'], quality: 0.75 },
  ],
  concepts: {
    diagnosis: [['channel', 'digital', 'dsa', 'acquisition'], ['activation', 'retention', 'quality', 'dormant', 'ltv'], ['fee', 'penalty', 'minimum balance', 'charge'], ['mass', 'segment', 'tenure', 'two', 'both']],
    risks: [['target', 'board', '8 lakh', 'volume'], ['partner', 'dsa', 'agency', 'walk'], ['fee income', '37', 'income', 'revenue'], ['regulat', 'execution', 'timing', 'customer']],
    nextSteps: [['pilot', 'test', 'trial'], ['payout', 'activation-linked', 'clawback', 'contract'], ['alert', 'waiver', 'tier', 'win-back'], ['track', 'kpi', 'dashboard', 'week', 'month', 'quarter', 'owner']],
  },
  boardroom: {
    ceo: { name: 'Vikram Suri', role: 'MD & CEO' },
    challenges: [
      { id: 'volume', kind: 'Strategic', prompt: 'The board celebrated 7.8 lakh new accounts and has asked for 8 lakh next year. You appear to be telling me to acquire fewer customers. How do I take that into the boardroom?',
        concepts: [['activ', 'funded', 'quality', 'retain'], ['ltv', 'value', '0.25', 'quarter', 'return', 'payback'], ['salary', 'referral', 'reallocat', 'shift', 'mix'], ['redefine', 'target', 'active accounts', 'metric', 'kpi']],
        strong: 'Changing what we count — active customers rather than opened accounts — is an argument I can make.', weak: 'I still hear "do less". The board will not accept that without a better target to replace the old one.' },
      { id: 'fee', kind: 'Financial', needsNumber: true, prompt: 'The fee change brings in thirty-seven crore of extra income, one of the few lines ahead of budget. Size what you want me to give up and what I get back for it.',
        concepts: [['cr', 'crore', '₹'], ['55', '56', '2.1', 'lost revenue', 'attrit'], ['net', 'negative', 'destroy', 'replace', 'cac'], ['tier', 'waive', 'partial', 'not all', 'active', 'tenure']],
        strong: 'So the income is real and the loss behind it is larger. That reframes the line entirely.', weak: 'You have not shown me the trade in rupees. I cannot give up budgeted income on principle.' },
      { id: 'ops', kind: 'Operational', prompt: 'Priya warns that DSAs will walk away if we pay on activation, and digital volume will halve. What do the first ninety days look like, and what would make you stop?',
        concepts: [['pilot', 'phase', 'region', 'test', 'subset'], ['activation', 'funded', 'payout', 'clawback'], ['salary', 'corporate', 'referral', 'replace'], ['stop', 'threshold', 'trigger', 'measure', 'track', 'if']],
        strong: 'A phased payout change with an explicit stop rule. Good.', weak: 'That is a direction, not a ninety-day plan with a read-out.' },
    ],
    twist: {
      title: 'A draft circular', prompt: 'Compliance has just forwarded a draft from the banking regulator: minimum-balance penalties would be capped at ₹100 a month, effective in six months, with public consultation open now. Does this change what you would do first?',
      facts: ['Penalty cap: ₹100 / month (currently ₹350)', 'Effective in ~6 months if finalised', 'Applies industry-wide', 'Northstar penalty income at risk: roughly ₹40 cr'],
      stances: [
        { id: 'preempt', label: 'Move first: redesign the fee now and tell customers', quality: 1, note: 'The income is going away regardless. Acting before the rule converts a forced loss into a retention and reputation gain, and stops six more months of fee-driven exits.' },
        { id: 'wait', label: 'Wait for the final rule, keep collecting meanwhile', quality: 0.4, note: 'Preserves six months of income but continues losing customers worth more than the fees, and forfeits any goodwill.' },
        { id: 'offset', label: 'Replace the income with other charges', quality: 0.15, note: 'Repeats the original mistake under a different name.' },
      ],
      concepts: [['regardless', 'anyway', 'going away', 'inevitable', 'at risk'], ['first', 'pre-empt', 'ahead', 'before'], ['retain', 'win-back', 'goodwill', 'trust', 'reputation'], ['acquisition', 'still', 'both', 'priority', 'sequence']],
    },
  },
  expertPaths: [
    { id: 'split', name: 'Split the leavers first', summary: 'Find out who is leaving before asking why.', steps: [
      { type: 'hypothesis', text: 'Spread confidence across acquisition quality, fees, rates and service. Avoid anchoring on the fintech story.' },
      { type: 'data', ref: 'segments', why: 'Shows attrition is a mass-segment and new-account problem, not an affluent one.' },
      { type: 'update', text: 'Cut confidence in rates; raise fees and acquisition quality.' },
      { type: 'data', ref: 'fees', why: 'Quantifies penalty-linked attrition.' }, { type: 'calc', ref: 'q5', why: 'The fee change is net negative.' },
      { type: 'data', ref: 'channels', why: 'Explains the CAC rise through mix.' }, { type: 'data', ref: 'cohort', why: 'Prices the quality gap by channel.' },
      { type: 'interview', ref: 'cmo', why: 'Confirms incentives reward opened accounts.' }, { type: 'recommend', ref: 'A', why: 'Largest value pool; pair with a fee redesign.' } ] },
    { id: 'money', name: 'Follow the acquisition rupee', summary: 'Start from spend and work forward to value.', steps: [
      { type: 'hypothesis', text: 'Lead with acquisition economics; keep a fee hypothesis alive.' },
      { type: 'data', ref: 'channels', why: 'Where the extra ₹84 cr went.' }, { type: 'data', ref: 'cohort', why: 'What those accounts became.' }, { type: 'calc', ref: 'q3', why: 'Paid digital returns 0.25x.' },
      { type: 'data', ref: 'marketing', why: 'Why: payouts on opening, not activity.' }, { type: 'data', ref: 'complaints', why: 'Surfaces charges as the top exit reason — the second mechanism.' },
      { type: 'data', ref: 'fees', why: 'Confirms and sizes it.' }, { type: 'recommend', ref: 'A', why: 'Fix what is bought; then fix what drives established customers out.' } ] },
  ],
  hints: ['One attrition number can hide more than one population of leavers. Who is leaving?', 'What is an account worth by the channel that produced it?', 'Compare what a policy earns with what it costs in customers.'],
  debrief: {
    headline: 'Northstar paid more for customers who never arrived, and charged loyal ones until they left.',
    narrative: [
      'Paid digital and DSA channels grew from 32% to 51% of new accounts. They are paid on accounts opened, so they delivered accounts: 41–52% activation and under 60% retention, at a CAC that rose 50% as the bank bid deeper. That mix shift accounts for the whole CAC increase and a wave of first-year closures.',
      `Separately, the Q1 minimum-balance change penalised ${FEE.penalised} lakh mass customers. They left at 38% against 14% for peers — about ${r1(excess)} lakh customers and ₹${r1(lostRev)} cr of annual revenue for ₹${FEE.income25 - FEE.income24} cr of fees.`,
      'Fintech rates, the app and branch closures are all visible and all minor. Affluent attrition barely moved — the single cheapest fact that deflates the rate story.',
    ],
    keyNumbers: [{ label: 'Paid digital 3-yr LTV / CAC', value: `${r2(ltv3(CHN[3]) / 3600)}x` }, { label: 'Salary tie-up 3-yr LTV / CAC', value: `${r1(ltv3(CHN[1]) / 1100)}x` }, { label: 'Net effect of fee change', value: `₹${r1(FEE.income25 - FEE.income24 - lostRev)} cr / yr` }, { label: 'Mass attrition', value: '13% → 23%' }],
    lessons: ['Segment the outcome before theorising about the cause.', 'People deliver what they are paid for; read the incentive before the dashboard.', 'A revenue line that beats budget can still destroy value.'],
  },
};
