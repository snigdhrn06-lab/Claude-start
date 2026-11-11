// CloudAxis — original fictional case. Segment mix, sales incentives and unit economics in B2B SaaS.
const r1 = (n) => Math.round(n * 10) / 10 + 0;
const r2 = (n) => Math.round(n * 100) / 100 + 0;

// ARR in $M, CAC / ACV in $
const SEG = [
  { id: 'ent', name: 'Enterprise', c24: 120, c25: 138, arr24: 19.0, arr25: 23.5, churn24: 0.05, churn25: 0.05, nrr24: 118, nrr25: 116, cac24: 92000, cac25: 95000, acv24: 165000, acv25: 170000, gm24: 0.82, gm25: 0.82 },
  { id: 'mm', name: 'Mid-market', c24: 420, c25: 520, arr24: 13.0, arr25: 17.0, churn24: 0.09, churn25: 0.10, nrr24: 108, nrr25: 106, cac24: 28000, cac25: 30000, acv24: 32000, acv25: 33000, gm24: 0.80, gm25: 0.79 },
  { id: 'smb', name: 'SMB', c24: 1500, c25: 3200, arr24: 6.0, arr25: 13.5, churn24: 0.22, churn25: 0.38, nrr24: 92, nrr25: 71, cac24: 5000, cac25: 7500, acv24: 4000, acv25: 3100, gm24: 0.62, gm25: 0.48 },
];
const newLogos = (s) => Math.round(s.c25 - s.c24 * (1 - s.churn25));
const payback = (s, y) => s['cac' + y] / ((s['acv' + y] * s['gm' + y]) / 12);
const ltv3 = (s) => { const r = 1 - s.churn25; return s.acv25 * s.gm25 * (1 + r + r * r); };
const arr = (y) => SEG.reduce((t, s) => t + s['arr' + y], 0);
const gm = (y) => SEG.reduce((t, s) => t + s['arr' + y] * s['gm' + y], 0) / arr(y);
const smSpend = (s) => (newLogos(s) * s.cac25) / 1e6;
const totalSM = SEG.reduce((t, s) => t + smSpend(s), 0);
const nrr25 = SEG.reduce((t, s) => t + s.arr24 * s.nrr25, 0) / arr(24);
const blendedPayback = (y) => {
  const sp = SEG.reduce((t, s) => t + (y === 25 ? newLogos(s) : s.c24 * 0.3) * s['cac' + y], 0);
  const m = SEG.reduce((t, s) => t + ((y === 25 ? newLogos(s) : s.c24 * 0.3) * s['acv' + y] * s['gm' + y]) / 12, 0);
  return sp / m;
};
const smb = SEG[2], mm = SEG[1];

function scenario(i) {
  const logos = newLogos(smb) * (1 + i.smbLogos / 100);
  const churn = i.smbChurn / 100, acv = i.smbAcv;
  const smbSpend = (logos * smb.cac25) / 1e6;
  const freed = Math.max(0, smSpend(smb) - smbSpend);
  const mmExtra = (freed * (i.redeploy / 100) * 1e6) / (mm.cac25 * 1.6); // marginal mid-market logos cost more
  const smbArr = smb.arr25 * (1 - churn) * 0.97 + (logos * acv) / 1e6;
  const mmArr = mm.arr25 * (mm.nrr25 / 100) + ((newLogos(mm) + mmExtra) * mm.acv25) / 1e6;
  const entArr = SEG[0].arr25 * (SEG[0].nrr25 / 100) + (newLogos(SEG[0]) * SEG[0].acv25) / 1e6;
  const total = smbArr + mmArr + entArr;
  const sm = smbSpend + smSpend(mm) + smSpend(SEG[0]) + freed * (i.redeploy / 100);
  const smbGm = Math.min(0.7, smb.gm25 + (0.38 - churn) * 0.5);
  const gmAll = (entArr * 0.82 + mmArr * 0.79 + smbArr * smbGm) / total;
  const pb = smb.cac25 / ((acv * smbGm) / 12);
  return {
    outputs: [
      { label: 'ARR in 12 months', value: r1(total), unit: '$M' },
      { label: 'ARR growth', value: r1((total / arr(25) - 1) * 100), unit: '%' },
      { label: 'Sales & marketing on new logos', value: r1(sm), unit: '$M' },
      { label: 'Blended gross margin', value: r1(gmAll * 100), unit: '%' },
      { label: 'SMB CAC payback', value: r1(pb), unit: 'months' },
      { label: 'Gross profit less new-logo S&M', value: r1(total * gmAll - sm), unit: '$M', highlight: true },
    ],
    bars: [{ label: 'Enterprise ARR', value: r1(entArr) }, { label: 'Mid-market ARR', value: r1(mmArr) }, { label: 'SMB ARR', value: r1(smbArr) }],
  };
}
const base = scenario({ smbLogos: 0, smbChurn: 38, smbAcv: 3100, redeploy: 0 });

export default {
  id: 'cloudaxis',
  title: 'Forty-Two Percent and Sinking',
  company: 'CloudAxis',
  industry: 'Technology & SaaS',
  func: 'Go-to-market',
  problemType: 'Growth strategy',
  difficulty: 4, difficultyLabel: 'Expert',
  durationMin: 50, xpReward: 700, budgetHours: 34,
  skills: ['structuring', 'quant', 'synthesis'],
  tags: ['competitive'], unlockRank: 1, currency: '$',
  blurb: 'A data-pipeline SaaS company grew ARR 42% to $54M. Net revenue retention, gross margin and CAC payback all deteriorated in the same year. The board wants to know whether this is a growth company or a leaky one.',
  briefing: {
    from: { name: 'Dana Whitfield', role: 'Co-founder & CEO, CloudAxis' },
    subject: 'Is our growth real?',
    memo: [
      `We ended FY25 at $${r1(arr(25))}M ARR, up from $${r1(arr(24))}M. On a slide that looks like a company ready for its Series C.`,
      `Underneath, net revenue retention slid from 112% to ${Math.round(nrr25)}%, gross margin fell from ${r1(gm(24) * 100)}% to ${r1(gm(25) * 100)}%, and CAC payback went from ${Math.round(blendedPayback(24))} to ${Math.round(blendedPayback(25))} months. My CRO says we are landing logos faster than ever and the metrics will catch up. My CFO says we are filling a bucket with a hole in it.`,
      'I need to know which of them is right, what is causing it, and what you would change before we open the data room to investors next quarter.',
    ],
    background: ['CloudAxis sells a data-pipeline platform to enterprise, mid-market and SMB customers on annual contracts.', 'In January FY25 the company launched a low-priced "Starter" tier and revised its sales compensation plan to accelerate new-logo growth.', '310 employees; $41M raised; roughly 20 months of runway at current burn.'],
    objective: 'Determine why retention and unit economics deteriorated while ARR grew, and recommend a go-to-market course correction.',
    constraints: ['34 analyst hours for data requests and interviews.', 'Series C process is expected to open in one quarter.', 'Engineering roadmap is committed for the next two quarters.'],
    context: ['A lower-priced competitor, Datavane, entered the SMB market.', 'There were two notable platform incidents during the year.', 'Cloud hosting list prices rose about 4%.'],
    metrics: [
      { label: 'ARR FY25', value: `$${r1(arr(25))}M`, delta: `+${r1((arr(25) / arr(24) - 1) * 100)}%`, tone: 'up' },
      { label: 'Net revenue retention', value: `${Math.round(nrr25)}%`, delta: `${Math.round(nrr25) - 112} pts`, tone: 'down' },
      { label: 'Gross margin', value: `${r1(gm(25) * 100)}%`, delta: `${r1((gm(25) - gm(24)) * 100)} pts`, tone: 'down' },
      { label: 'CAC payback', value: `${Math.round(blendedPayback(25))} mo`, delta: `+${Math.round(blendedPayback(25)) - Math.round(blendedPayback(24))} mo`, tone: 'down' },
    ],
    trend: { label: 'ARR ($M) vs net revenue retention (%)', x: ['FY23', 'FY24', 'FY25'], series: [{ label: 'ARR', values: [27.5, arr(24), arr(25)] }, { label: 'NRR %', values: [114, 112, Math.round(nrr25)] }] },
  },
  drivers: [
    { id: 'mix', label: 'Segment mix shift toward low-retention SMB', truth: 0.38, side: 'revenue' },
    { id: 'incentives', label: 'Sales incentives & discounting', truth: 0.25, side: 'revenue' },
    { id: 'onboarding', label: 'Onboarding & time-to-value', truth: 0.2, side: 'cost' },
    { id: 'infra', label: 'Hosting & support cost inflation', truth: 0.07, side: 'cost' },
    { id: 'competition', label: 'Competitive displacement', truth: 0.07, side: 'revenue' },
    { id: 'reliability', label: 'Product reliability', truth: 0.03, side: 'cost' },
  ],
  hypothesisSeeds: [
    { text: 'Datavane is displacing CloudAxis in existing accounts with a cheaper product.', driver: 'competition' },
    { text: 'Growth has shifted to SMB customers who churn faster and cost more to serve.', driver: 'mix' },
    { text: 'Platform incidents have damaged trust and driven churn.', driver: 'reliability' },
    { text: 'The new comp plan rewards discounted new logos regardless of whether they stay.', driver: 'incentives' },
  ],
  datasets: [
    { id: 'metrics', title: 'SaaS metrics summary, FY23–FY25', category: 'Financial statements', cost: 4, relevance: 'High', value: 'useful',
      description: 'Company-level ARR bridge, retention, margin and efficiency metrics.', signals: { mix: 1, incentives: 1 },
      insight: 'New-logo ARR nearly doubled while churned ARR tripled. The company-level view shows a leak; it cannot show where.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'a', label: 'FY23', fmt: 'num1' }, { key: 'b', label: 'FY24', fmt: 'num1' }, { key: 'c', label: 'FY25', fmt: 'num1' }],
        rows: [{ m: 'Ending ARR ($M)', a: 27.5, b: arr(24), c: arr(25) }, { m: 'New-logo ARR ($M)', a: 7.1, b: 8.6, c: 15.8 }, { m: 'Expansion ARR ($M)', a: 4.6, b: 5.9, c: 6.1 }, { m: 'Churned & contracted ARR ($M)', a: -1.4, b: -4.0, c: -5.9 },
          { m: 'Net revenue retention %', a: 114, b: 112, c: Math.round(nrr25) }, { m: 'Gross margin %', a: 78.5, b: r1(gm(24) * 100), c: r1(gm(25) * 100) }, { m: 'Sales & marketing ($M)', a: 14.2, b: 19.5, c: 33.4 }, { m: 'Customers', a: 1480, b: 2040, c: 3858 }] } },
    { id: 'segments', title: 'ARR, customers and retention by segment', category: 'Customer cohorts', cost: 6, relevance: 'High', value: 'critical',
      description: 'Customer counts, ARR, logo churn and net revenue retention for enterprise, mid-market and SMB.', signals: { mix: 2, reliability: -1, competition: -1 },
      insight: 'Enterprise and mid-market are healthy and stable. SMB customers more than doubled, logo churn went from 22% to 38% and NRR to 71%. The deterioration is one segment.',
      table: { columns: [{ key: 's', label: 'Segment', fmt: 'text' }, { key: 'c24', label: 'Customers FY24', fmt: 'num0' }, { key: 'c25', label: 'Customers FY25', fmt: 'num0' }, { key: 'a24', label: 'ARR FY24 ($M)', fmt: 'num1' }, { key: 'a25', label: 'ARR FY25 ($M)', fmt: 'num1' }, { key: 'ch24', label: 'Logo churn FY24 %', fmt: 'pct' }, { key: 'ch25', label: 'Logo churn FY25 %', fmt: 'pct' }, { key: 'n25', label: 'NRR FY25 %', fmt: 'num0' }],
        rows: SEG.map((s) => ({ s: s.name, c24: s.c24, c25: s.c25, a24: s.arr24, a25: s.arr25, ch24: s.churn24 * 100, ch25: s.churn25 * 100, n25: s.nrr25 })) },
      chart: { type: 'bar', unit: 'logo churn %', categories: SEG.map((s) => s.name), series: [{ label: 'FY24', values: SEG.map((s) => s.churn24 * 100) }, { label: 'FY25', values: SEG.map((s) => s.churn25 * 100) }] } },
    { id: 'unit', title: 'Unit economics by segment', category: 'Product-level profitability', cost: 7, relevance: 'Medium', value: 'critical',
      description: 'CAC per new logo, average contract value of new deals, and gross margin, FY24 vs FY25.', signals: { mix: 2, incentives: 1, infra: -1 },
      insight: `An SMB logo now costs $7,500 to land, pays $3,100 a year at 48% gross margin, and has a 38% chance of leaving within twelve months. Payback is ${Math.round(payback(smb, 25))} months on a customer who stays, on average, well under three years.`,
      table: { columns: [{ key: 's', label: 'Segment', fmt: 'text' }, { key: 'cac24', label: 'CAC FY24 ($)', fmt: 'num0' }, { key: 'cac25', label: 'CAC FY25 ($)', fmt: 'num0' }, { key: 'acv24', label: 'New ACV FY24 ($)', fmt: 'num0' }, { key: 'acv25', label: 'New ACV FY25 ($)', fmt: 'num0' }, { key: 'gm24', label: 'Gross margin FY24 %', fmt: 'pct' }, { key: 'gm25', label: 'Gross margin FY25 %', fmt: 'pct' }],
        rows: SEG.map((s) => ({ s: s.name, cac24: s.cac24, cac25: s.cac25, acv24: s.acv24, acv25: s.acv25, gm24: s.gm24 * 100, gm25: s.gm25 * 100 })) },
      chart: { type: 'bar', unit: 'CAC payback (months)', categories: SEG.map((s) => s.name), series: [{ label: 'FY24', values: SEG.map((s) => r1(payback(s, 24))) }, { label: 'FY25', values: SEG.map((s) => r1(payback(s, 25))) }] } },
    { id: 'comp', title: 'Sales compensation plan & discount approvals', category: 'Pricing history', cost: 5, relevance: 'Medium', value: 'critical',
      description: 'FY24 and FY25 commission plans, discount authority and approval logs.', signals: { incentives: 2 },
      insight: 'From January, reps earn on first-year bookings with a per-logo accelerator and no clawback, and can discount 40% without approval. The plan pays most for exactly the deals that churn.',
      table: { columns: [{ key: 'm', label: 'Term', fmt: 'text' }, { key: 'a', label: 'FY24 plan', fmt: 'text' }, { key: 'b', label: 'FY25 plan', fmt: 'text' }],
        rows: [{ m: 'Commission basis', a: 'ARR, paid 50% at signing / 50% at month 6', b: 'First-year bookings, 100% at signing' }, { m: 'New-logo accelerator', a: 'None', b: '+$400 per logo above 12 / quarter' }, { m: 'Clawback on churn within 12 months', a: 'Yes', b: 'No' },
          { m: 'Rep discount authority', a: '15%', b: '40%' }, { m: 'Average SMB discount', a: '11%', b: '34%' }, { m: 'SMB deals closed in last week of quarter', a: '31%', b: '58%' }] } },
    { id: 'cohorts', title: 'SMB cohort retention by signup quarter', category: 'Customer cohorts', cost: 6, relevance: 'Medium', value: 'useful',
      description: 'Six-month logo retention for each SMB signup cohort across eight quarters.', signals: { incentives: 2, mix: 1, competition: -1 },
      insight: 'Six-month retention held at 83–86% through FY24 and stepped down to 74%, 70%, 66% from the first cohort sold under the new plan. The break is dated.',
      table: { columns: [{ key: 'q', label: 'Signup quarter', fmt: 'text' }, { key: 'n', label: 'New SMB logos', fmt: 'num0' }, { key: 'r', label: '6-month retention %', fmt: 'pct' }, { key: 'd', label: 'Average discount %', fmt: 'pct' }],
        rows: [{ q: 'FY24 Q1', n: 150, r: 86, d: 10 }, { q: 'FY24 Q2', n: 160, r: 85, d: 11 }, { q: 'FY24 Q3', n: 170, r: 84, d: 11 }, { q: 'FY24 Q4', n: 180, r: 83, d: 12 }, { q: 'FY25 Q1', n: 430, r: 74, d: 29 }, { q: 'FY25 Q2', n: 540, r: 70, d: 33 }, { q: 'FY25 Q3', n: 620, r: 66, d: 36 }, { q: 'FY25 Q4', n: 680, r: null, d: 37 }] },
      chart: { type: 'line', unit: '6-month retention %', categories: ['24Q1', '24Q2', '24Q3', '24Q4', '25Q1', '25Q2', '25Q3'], series: [{ label: 'Retention', values: [86, 85, 84, 83, 74, 70, 66] }] } },
    { id: 'onboarding', title: 'Activation & time-to-value', category: 'Operational metrics', cost: 5, relevance: 'Medium', value: 'useful',
      description: 'Onboarding model and activation milestones by segment.', signals: { onboarding: 2 },
      insight: 'SMB customers get no implementation help; median time to a first live pipeline is 41 days against 9 for enterprise, and 57% of SMB churners never connected a data source at all.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'e', label: 'Enterprise', fmt: 'text' }, { key: 'm2', label: 'Mid-market', fmt: 'text' }, { key: 's', label: 'SMB', fmt: 'text' }],
        rows: [{ m: 'Onboarding model', e: 'Dedicated engineer', m2: 'Pooled CSM', s: 'Self-serve docs' }, { m: 'Median days to first live pipeline', e: '9', m2: '16', s: '41' }, { m: 'Activated within 30 days', e: '94%', m2: '81%', s: '38%' }, { m: 'Churned customers who never connected a source', e: '4%', m2: '12%', s: '57%' }, { m: 'Support tickets per $1k ARR', e: '0.4', m2: '0.9', s: '2.6' }] } },
    { id: 'churn', title: 'Churn reason codes', category: 'Customer feedback', cost: 4, relevance: 'High', value: 'useful',
      description: 'Coded cancellation reasons for FY25, SMB segment.', signals: { onboarding: 2, competition: -1, reliability: -2 },
      insight: '"Never got it working" is 44% of SMB churn; "switched to a competitor" is 11% and reliability 3%. Customers are not being taken; they are not arriving.',
      table: { columns: [{ key: 'r', label: 'Reason (SMB cancellations)', fmt: 'text' }, { key: 'v', label: 'Share %', fmt: 'pct' }],
        rows: [{ r: 'Never got it working / no value realised', v: 44 }, { r: 'Too expensive at renewal (discount expired)', v: 18 }, { r: 'Company closed or project ended', v: 14 }, { r: 'Switched to a competitor', v: 11 }, { r: 'Missing integration', v: 10 }, { r: 'Reliability / incidents', v: 3 }] } },
    { id: 'cogs', title: 'Hosting & support cost detail', category: 'Cost breakdowns', cost: 4, relevance: 'High', value: 'useful',
      description: 'Cost of revenue by component and by segment.', signals: { infra: -1, mix: 1, onboarding: 1 },
      insight: 'Hosting unit prices rose 4%, worth under a point of margin. The margin decline is support and idle infrastructure for SMB accounts: a mix effect, not a price effect.',
      table: { columns: [{ key: 'm', label: 'Cost of revenue ($M)', fmt: 'text' }, { key: 'a', label: 'FY24', fmt: 'num1' }, { key: 'b', label: 'FY25', fmt: 'num1' }],
        rows: [{ m: 'Hosting — enterprise & mid-market', a: 3.9, b: 4.9 }, { m: 'Hosting — SMB (incl. idle provisioned capacity)', a: 1.0, b: 3.4 }, { m: 'Support & success — enterprise & mid-market', a: 2.1, b: 2.9 }, { m: 'Support & success — SMB', a: 1.3, b: 3.6 }, { m: 'Total cost of revenue', a: 8.3, b: 14.8 }] } },
    { id: 'reliability', title: 'Uptime & incident log', category: 'Operational metrics', cost: 3, relevance: 'Medium', value: 'ruleout',
      description: 'Platform availability and incident post-mortems.', signals: { reliability: -2 },
      insight: 'Uptime was 99.95% in both years; the two incidents affected 3% of customers for under an hour. Not a factor.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'a', label: 'FY24', fmt: 'text' }, { key: 'b', label: 'FY25', fmt: 'text' }], rows: [{ m: 'Uptime', a: '99.96%', b: '99.95%' }, { m: 'Sev-1 incidents', a: '2', b: '2' }, { m: 'Customers affected by Sev-1', a: '2%', b: '3%' }] } },
    { id: 'competitor', title: 'Win / loss analysis vs Datavane', category: 'Competitor information', cost: 5, relevance: 'High', value: 'noise',
      description: 'Competitive win rates and displacement in the installed base.', signals: { competition: -2 },
      insight: 'SMB win rate against Datavane moved from 31% to 29% and installed-base displacement is negligible. The competitor is real and largely irrelevant to this year\'s numbers.',
      table: { columns: [{ key: 'm', label: 'Metric', fmt: 'text' }, { key: 'a', label: 'FY24', fmt: 'text' }, { key: 'b', label: 'FY25', fmt: 'text' }], rows: [{ m: 'SMB win rate when Datavane is in the deal', a: '31%', b: '29%' }, { m: 'Deals where Datavane appears', a: '18%', b: '22%' }, { m: 'Existing customers lost to Datavane', a: '0.6%', b: '0.9%' }, { m: 'Datavane list price vs CloudAxis Starter', a: 'n/a', b: '−15%' }] } },
  ],
  stakeholders: [
    { id: 'cro', name: 'Marcus Bell', role: 'Chief Revenue Officer', cost: 3, persona: 'Charismatic, quota-driven, designed the FY25 comp plan.', bias: 'Sees logo count as the leading indicator of everything.',
      opener: 'We tripled SMB logos in a year. I assume you are here to help us do it again.', vague: 'Give me something concrete — pipeline, comp, discounting, the Starter tier?', outOfScope: 'Ask finance or customer success. I sell.',
      cards: [
        { id: 'plan', topic: 'Comp plan', keywords: ['comp', 'commission', 'incentive', 'plan', 'quota', 'accelerator', 'clawback', 'paid'], signals: { incentives: 2 }, answer: 'I simplified the plan: bookings, paid at signing, with a logo accelerator. Clawbacks were demoralising, so we dropped them. Reps responded exactly the way I hoped.' },
        { id: 'discount', topic: 'Discounting', keywords: ['discount', 'price', 'pricing', 'starter', 'deal', 'authority'], signals: { incentives: 2 }, answer: 'Reps can go to forty percent without asking. Most SMB deals land around a third off. They renew at list — in theory. I have not looked at how many actually do.' },
        { id: 'smb', topic: 'SMB strategy', keywords: ['smb', 'small', 'segment', 'logo', 'land', 'expand', 'strategy'], signals: { mix: 1 }, answer: 'Land and expand. SMBs grow into mid-market accounts. I do not have data on how many have, but that is the thesis.' },
        { id: 'competitor', topic: 'Datavane', keywords: ['datavane', 'competitor', 'competition', 'win', 'loss'], signals: { competition: -1 }, answer: 'Datavane shows up in maybe a fifth of deals. We win about as often as we did. They are annoying, not dangerous.' },
      ] },
    { id: 'cfo', name: 'Hannah Okafor', role: 'Chief Financial Officer', cost: 3, persona: 'Rigorous, blunt, worried about the Series C data room.', bias: 'Inclined to cut rather than fix; may understate what SMB could become.',
      opener: 'Tell me what you need. I have been trying to get this conversation started for two quarters.', vague: 'Be specific: retention, margin, CAC, runway?', outOfScope: 'I do not have that. Customer success or sales operations would.',
      cards: [
        { id: 'payback', topic: 'CAC & payback', keywords: ['cac', 'payback', 'efficien', 'unit economics', 'ltv', 'magic'], signals: { mix: 2 }, answer: 'Blended payback hides it. Enterprise pays back in eight months. SMB, on my numbers, takes five years on customers who stay less than three.' },
        { id: 'margin', topic: 'Gross margin', keywords: ['margin', 'gross', 'hosting', 'support', 'cogs', 'cost'], signals: { infra: -1, mix: 1 }, answer: 'Hosting prices are a rounding error. We provision an environment for every Starter account at signing, and more than half are never used. Add support tickets and SMB runs at forty-eight percent gross margin.' },
        { id: 'investors', topic: 'Series C', keywords: ['series', 'investor', 'raise', 'runway', 'board', 'valuation', 'diligence'], signals: { mix: 1 }, answer: 'Investors will cohort this in an afternoon. A hundred and five percent NRR with a seventy-one percent segment inside it is a worse story than slower growth with clean retention.' },
      ] },
    { id: 'cs', name: 'Ines Carvalho', role: 'VP Customer Success', cost: 3, persona: 'Thoughtful, under-resourced, close to customers.', bias: 'Believes more CS headcount fixes most things.',
      opener: 'My team is drowning. Where shall I start?', vague: 'Happy to help — onboarding, churn reasons, support load?', outOfScope: 'That is a sales or finance question.',
      cards: [
        { id: 'onboard', topic: 'Onboarding', keywords: ['onboard', 'implement', 'activation', 'time to value', 'setup', 'live', 'adopt'], signals: { onboarding: 2 }, answer: 'Starter customers get a link to the docs. Connecting a first source takes most of them six weeks, if they manage it. More than half of those who churn never got a pipeline running.' },
        { id: 'fit', topic: 'Customer fit', keywords: ['fit', 'who', 'customer', 'profile', 'ideal', 'qualif', 'smb', 'small'], signals: { mix: 2, incentives: 1 }, answer: 'We are signing companies with no data engineer. The product assumes one. Sales knows; the comp plan pays them anyway.' },
        { id: 'why', topic: 'Why customers churn', keywords: ['churn', 'cancel', 'leave', 'reason', 'why', 'renew'], signals: { onboarding: 1, competition: -1 }, answer: 'Mostly they never got value, or the renewal quote at list price shocked them after a third off in year one. Very few say they are going to a competitor.' },
      ] },
    { id: 'customer', name: 'Tom Reyes', role: 'Founder, 14-person e-commerce company (churned)', cost: 2, persona: 'Friendly, busy, not technical.', bias: 'One customer\'s experience.',
      opener: 'Sure, I can tell you what happened with us.', vague: 'Sorry, what do you want to know exactly — why we cancelled?', outOfScope: 'No idea, honestly.',
      cards: [
        { id: 'story', topic: 'Why he cancelled', keywords: ['why', 'cancel', 'churn', 'leave', 'left', 'happened', 'experience', 'value', 'setup', 'onboard'], signals: { onboarding: 2, incentives: 1 }, answer: 'The rep gave us forty percent off if we signed before quarter-end, so we did. Then nobody could get it connected to our store. We are a team of fourteen with no engineer. We paid for a year and never ran a single pipeline.' },
        { id: 'alt', topic: 'Alternatives', keywords: ['competitor', 'datavane', 'alternative', 'switch', 'instead', 'now'], signals: { competition: -1 }, answer: 'We did not switch to anyone. We went back to spreadsheets.' },
      ] },
  ],
  quant: [
    { id: 'q1', prompt: 'SMB CAC payback in FY25, in months: CAC ÷ (new ACV × gross margin ÷ 12).', unit: 'months', requires: ['unit'], answer: payback(smb, 25), tolAbs: 2, explain: `7,500 ÷ (3,100 × 0.48 ÷ 12) = ${r1(payback(smb, 25))} months, up from ${r1(payback(smb, 24))}.` },
    { id: 'q2', prompt: 'How many new SMB logos were acquired in FY25? (Ending customers − opening customers × (1 − FY25 logo churn))', unit: 'logos', requires: ['segments'], answer: newLogos(smb), tolAbs: 30, explain: `3,200 − 1,500 × 0.62 = ${newLogos(smb)}.` },
    { id: 'q3', prompt: 'Blended gross margin in FY25 (ARR-weighted across segments).', unit: '%', requires: ['segments', 'unit'], answer: gm(25) * 100, tolAbs: 0.6, explain: `(23.5 × 82% + 17.0 × 79% + 13.5 × 48%) ÷ 54 = ${r1(gm(25) * 100)}%.` },
    { id: 'q4', prompt: 'Three-year LTV-to-CAC for an SMB logo: ACV × gross margin × (1 + r + r²) ÷ CAC, where r = 1 − logo churn.', unit: 'x', requires: ['unit', 'segments'], answer: ltv3(smb) / smb.cac25, tolAbs: 0.04, explain: `3,100 × 0.48 × (1 + 0.62 + 0.3844) = $${Math.round(ltv3(smb))}; ÷ $7,500 = ${r2(ltv3(smb) / smb.cac25)}x.` },
    { id: 'q5', prompt: 'What share of new-logo sales & marketing spend went to SMB in FY25? (new logos × CAC, by segment)', unit: '%', requires: ['unit', 'segments'], answer: (smSpend(smb) / totalSM) * 100, tolAbs: 2, explain: `SMB $${r1(smSpend(smb))}M of $${r1(totalSM)}M = ${r1((smSpend(smb) / totalSM) * 100)}%, for a segment that is 25% of ARR.` },
  ],
  scenario: {
    title: 'Go-to-market reallocation model', requires: ['unit'], note: 'Twelve-month projection from the FY25 base. Change SMB volume, price and churn, and redeploy freed spend to mid-market.',
    levers: [
      { key: 'smbLogos', label: 'New SMB logos vs FY25', unit: '%', min: -100, max: 20, step: 10, default: 0 },
      { key: 'smbAcv', label: 'SMB new-deal ACV', unit: '$', min: 2500, max: 5000, step: 100, default: 3100 },
      { key: 'smbChurn', label: 'SMB logo churn', unit: '%', min: 15, max: 40, step: 1, default: 38 },
      { key: 'redeploy', label: 'Freed S&M redeployed to mid-market', unit: '%', min: 0, max: 100, step: 10, default: 0 },
    ], compute: scenario,
  },
  options: [
    { id: 'A', label: 'Refocus up-market; make SMB self-serve with a price floor', detail: 'Redirect sales capacity to mid-market and enterprise; serve SMB through a product-led, low-touch motion with qualification and a discount ceiling.', quality: 1, impact: [4, 16], drivers: ['mix'] },
    { id: 'B', label: 'Fix the incentives', detail: 'Restore clawbacks, pay part of commission on month-6 activation or renewal, cap discount authority at 15%.', quality: 0.85, impact: [3, 12], drivers: ['incentives'] },
    { id: 'C', label: 'Invest in SMB onboarding and success', detail: 'Add guided setup and a pooled onboarding team for Starter customers.', quality: 0.6, impact: [1, 7], drivers: ['onboarding'] },
    { id: 'E', label: 'Exit SMB immediately', detail: 'Stop selling Starter and sunset the segment.', quality: 0.5, impact: [2, 14], drivers: ['mix'] },
    { id: 'F', label: 'Raise capital and grow through it', detail: 'Keep the current motion; use the Series C to fund scale.', quality: 0.1, impact: [-10, 2], drivers: [] },
    { id: 'D', label: 'Cut price to beat Datavane', detail: 'Reduce Starter list price by 20%.', quality: 0.06, impact: [-8, 1], drivers: ['competition'] },
  ],
  diagnoses: [
    { id: 'full', label: 'Incentive-driven SMB land-grab: poor-fit, discounted logos that never activate', requires: ['mix', 'incentives'], quality: 1 },
    { id: 'mix', label: 'Growth shifted to a segment with broken unit economics', requires: ['mix'], quality: 0.82 },
    { id: 'inc', label: 'The comp plan and discount authority reward deals that churn', requires: ['incentives'], quality: 0.78 },
    { id: 'onb', label: 'SMB customers fail to reach first value', requires: ['onboarding'], quality: 0.6 },
  ],
  concepts: {
    diagnosis: [['smb', 'segment', 'mix'], ['churn', 'retention', 'nrr'], ['comp', 'incentive', 'discount', 'clawback', 'commission'], ['payback', 'unit economics', 'cac', 'ltv', 'margin'], ['onboard', 'activation', 'value', 'fit']],
    risks: [['growth', 'arr', 'slow', 'headline'], ['series c', 'investor', 'raise', 'valuation', 'runway'], ['sales', 'rep', 'attrition', 'morale', 'cro'], ['pipeline', 'mid-market', 'capacity', 'execution']],
    nextSteps: [['comp', 'clawback', 'plan', 'discount cap', 'approval'], ['qualif', 'icp', 'criteria', 'price floor', 'self-serve'], ['cohort', 'track', 'dashboard', 'measure', 'metric'], ['week', 'month', 'quarter', 'days', 'owner']],
  },
  boardroom: {
    ceo: { name: 'Dana Whitfield', role: 'CEO' },
    challenges: [
      { id: 'growth', kind: 'Strategic', prompt: 'SMB delivered nearly half of our net new ARR this year. If I do what you suggest, our growth rate drops just as we walk into a fundraise. Why is that the right trade?',
        concepts: [['retention', 'nrr', 'churn', 'quality'], ['payback', '60', 'five years', 'ltv', '0.4', 'unit economics'], ['investor', 'cohort', 'diligence', 'efficien', 'durable'], ['mid-market', 'enterprise', 'redeploy', 'reallocat']],
        strong: 'Durable growth over headline growth, with the spend redeployed rather than cut. That is a story I can tell.', weak: 'I still hear "grow slower". I need to understand what I get in exchange.' },
      { id: 'number', kind: 'Financial', needsNumber: true, prompt: 'Give me numbers. Where does ARR land in twelve months under your plan, what happens to burn, and what is the assumption most likely to be wrong?',
        concepts: [['$', 'm', 'million', 'arr'], ['assum', 'sensitiv', 'depends', 'risk'], ['mid-market', 'ramp', 'pipeline', 'capacity', 'churn'], ['range', 'between', 'downside', 'scenario', 'if']],
        strong: 'A number, a range, and the weak assumption named. Good.', weak: 'That was conviction, not a forecast.' },
      { id: 'ops', kind: 'Operational', prompt: 'Marcus will tell me that changing the comp plan mid-year loses us our best reps. What do you change, in what order, and how do we know within a quarter that it is working?',
        concepts: [['clawback', 'month 6', 'activation', 'renewal', 'split'], ['discount', 'cap', 'approval', '15'], ['phase', 'next quarter', 'grandfather', 'transition', 'pilot'], ['measure', 'cohort', 'retention', 'leading', 'track', 'activation rate']],
        strong: 'Sequenced, with a leading indicator. I can take that to Marcus.', weak: 'I do not yet see the order of operations or how we would know.' },
    ],
    twist: {
      title: 'A message from the lead investor', prompt: 'Our lead investor just wrote: "To price a Series C at the level you want, we need to see $75M ARR in twelve months." Marcus says SMB is the only motion that gets us there. Does this change your recommendation?',
      facts: ['Investor threshold: $75M ARR in 12 months (39% growth)', `Current motion projects roughly $${base.outputs[0].value}M with NRR falling further`, 'Enterprise and mid-market pipeline is capacity-constrained, not demand-constrained', 'Runway: ~20 months'],
      stances: [
        { id: 'hold', label: 'Hold course and reframe the raise around efficient growth', quality: 1, note: 'Buying $75M with logos that churn at 38% produces a number that fails diligence. A smaller, cleaner ARR with rising NRR and falling payback is the stronger raise — and redeployed spend closes much of the gap.' },
        { id: 'hybrid', label: 'Keep SMB volume but add guardrails', quality: 0.7, note: 'Workable if guardrails are real (qualification, discount cap, activation-linked comp), but risks preserving the leak under pressure to hit the number.' },
        { id: 'reverse', label: 'Chase $75M with the current motion', quality: 0.15, note: 'Optimises the one metric investors will look through first.' },
      ],
      concepts: [['diligence', 'cohort', 'look through', 'quality'], ['nrr', 'retention', 'payback', 'efficien', 'burn'], ['mid-market', 'enterprise', 'redeploy', 'capacity'], ['reframe', 'alternative', 'smaller', 'valuation', 'runway', 'bridge']],
    },
  },
  expertPaths: [
    { id: 'segment', name: 'Segment before you explain', summary: 'Find where the deterioration lives, then when it started, then why.', steps: [
      { type: 'hypothesis', text: 'Structure across who (segment), how sold (incentives), how served (onboarding), and external (competition, reliability).' },
      { type: 'data', ref: 'segments', why: 'Isolates the problem to SMB.' }, { type: 'update', text: 'Collapse reliability and competition; they would hit every segment.' },
      { type: 'data', ref: 'unit', why: 'Prices the damage.' }, { type: 'calc', ref: 'q1', why: 'Five-year payback on a sub-three-year customer.' },
      { type: 'data', ref: 'cohorts', why: 'Dates the break to the first cohort under the new plan.' }, { type: 'data', ref: 'comp', why: 'Identifies the mechanism.' },
      { type: 'interview', ref: 'cs', why: 'Explains why these customers fail: no engineer, no onboarding.' }, { type: 'recommend', ref: 'A', why: 'Move capacity to segments that pay back; make SMB earn its place.' } ] },
    { id: 'when', name: 'Start from the break date', summary: 'Ask what changed in January and test each change.', steps: [
      { type: 'hypothesis', text: 'Hypotheses keyed to what changed: Starter tier, comp plan, competitor entry.' },
      { type: 'data', ref: 'cohorts', why: 'Shows a step change, not a drift.' }, { type: 'data', ref: 'comp', why: 'The plan changed in the same month.' },
      { type: 'interview', ref: 'cro', why: 'Confirms intent and blind spots.' }, { type: 'data', ref: 'segments', why: 'Scopes the damage.' }, { type: 'data', ref: 'churn', why: 'Rules out competition; points to activation.' },
      { type: 'data', ref: 'unit', why: 'Sizes it.' }, { type: 'recommend', ref: 'B', why: 'Fix the incentive that caused it; pair with qualification.' } ] },
  ],
  hints: ['If a problem were company-wide, every segment would show it. Do they?', 'A step change usually has a date. What changed then?', 'Ask what salespeople are paid for, and when.'],
  debrief: {
    headline: 'CloudAxis paid its sales team to sign customers who could not use the product.',
    narrative: [
      'In January FY25 the company launched a Starter tier, gave reps 40% discount authority, and moved commission to bookings paid at signing with a logo accelerator and no clawback. SMB logos tripled.',
      `Those customers cost $7,500 to acquire, pay $3,100 at 48% gross margin, and churn at 38% — a ${Math.round(payback(smb, 25))}-month payback and a three-year LTV/CAC of ${r2(ltv3(smb) / smb.cac25)}x. ${Math.round((smSpend(smb) / totalSM) * 100)}% of new-logo spend went to a quarter of ARR. More than half of churners never connected a data source.`,
      'Enterprise and mid-market are healthy. Competition, reliability and hosting prices are visible and immaterial. The cohort data dates the break to the month the plan changed.',
    ],
    keyNumbers: [{ label: 'SMB CAC payback', value: `${Math.round(payback(smb, 24))} → ${Math.round(payback(smb, 25))} months` }, { label: 'SMB 3-yr LTV / CAC', value: `${r2(ltv3(smb) / smb.cac25)}x` }, { label: 'SMB share of new-logo S&M', value: `${Math.round((smSpend(smb) / totalSM) * 100)}%` }, { label: '6-month retention, pre vs post plan', value: '84% → 66%' }],
    lessons: ['Blended metrics average a healthy business with a broken one. Segment first.', 'Look for the date. Step changes have causes you can name.', 'Growth that fails diligence is not an asset in a fundraise.'],
  },
};
