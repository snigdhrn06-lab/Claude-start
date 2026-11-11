import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api.js';
import { useAuth } from '../App.jsx';
import { ago, DIFF_COLOR, Drawer, Empty, ErrorState, Icon, PageSkeleton, scoreTone, Skeleton, useApi, useToast } from '../components/ui.jsx';
import { LineChart } from '../components/charts.jsx';

const SKILL = { structuring: 'Structuring', hypothesis: 'Hypothesis quality', evidence: 'Evidence efficiency', quant: 'Quantitative accuracy', calibration: 'Calibration', synthesis: 'Synthesis & defence' };
const FILTERS = [['industry', 'Industry'], ['problemType', 'Problem type'], ['func', 'Function'], ['difficultyLabel', 'Difficulty']];

function Difficulty({ n, label }) { return <span className="row gap-6 xs"><span className="row" style={{ gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <i key={i} style={{ width: 4, height: 10, borderRadius: 1, background: i <= n ? DIFF_COLOR[n] : 'var(--surface-3)' }} />)}</span><span className="t2">{label}</span></span>; }

function CaseDrawer({ id, meta, onClose }) {
  const { data, loading } = useApi(`/cases/${id}`); const nav = useNavigate(); const toast = useToast(); const [busy, setBusy] = useState(false); const { user } = useAuth();
  const start = async () => { setBusy(true); try { const d = await post('/attempts', { caseId: id }); nav(`/case/${d.attempt.id}`); } catch (e) { toast(e.message, 'bad'); setBusy(false); } };
  const c = data?.case;
  return (
    <Drawer onClose={onClose} width={600}>
      {loading || !c ? <div style={{ padding: 24 }}><Skeleton h={300} /></div> : <div style={{ padding: '22px 26px 30px' }}>
        <div className="row between"><span className="eyebrow">{c.industry} · {c.problemType}</span><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <div className="small muted mt-12">{c.company}</div><h1 className="mt-4" style={{ fontSize: 28 }}>{c.title}</h1>
        <p className="t2 mt-12" style={{ fontSize: 15 }}>{c.blurb}</p>
        <div className="grid g4 mt-16">{[['Difficulty', c.difficultyLabel], ['Duration', `${c.durationMin} min`], ['Budget', `${c.budgetHours} hours`], ['Reward', `${c.xpReward} XP`]].map(([k, v]) => <div key={k} className="panel pad" style={{ padding: '10px 12px' }}><div className="xs muted">{k}</div><div className="mono mt-4">{v}</div></div>)}</div>
        <div className="grid g4 mt-12">{c.briefing.metrics.map((m) => <div key={m.label}><div className="xs muted">{m.label}</div><div className="mono mt-4" style={{ fontSize: 16 }}>{m.value}</div><div className={`mono xs ${m.tone === 'up' ? 'pos' : m.tone === 'down' ? 'neg' : 'muted'}`}>{m.delta}</div></div>)}</div>
        <div className="panel pad mt-16"><div className="eyebrow mb-8">{c.briefing.trend.label}</div><LineChart categories={c.briefing.trend.x} series={c.briefing.trend.series} height={150} area={false} /></div>
        <div className="eyebrow mt-24 mb-8">What this engagement involves</div>
        <ul className="small t2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}><li>A briefing from {c.briefing.from.name}, {c.briefing.from.role.split(',')[0]}</li><li>{c.datasetCount} datasets and {c.stakeholderCount} stakeholders — more than {c.budgetHours} hours can buy</li><li>A quantitative workbench and scenario model</li><li>A structured recommendation, then a boardroom defence with one twist</li><li>An Evidence Trail Replay against two expert routes</li></ul>
        <div className="row wrap gap-6 mt-16">{c.skills.map((s) => <span key={s} className="chip line">{SKILL[s]}</span>)}</div>
        {data.history.length > 0 && <><div className="eyebrow mt-24 mb-8">Your attempts</div>{data.history.map((h) => <div key={h.id} className="row between small" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}><span className="t2">{h.status === 'completed' ? ago(h.completedAt) : h.status === 'active' ? 'In progress' : 'Abandoned'}{h.seeded ? ' · seeded demo attempt' : ''}</span>{h.status === 'completed' ? <button className="btn ghost sm" onClick={() => nav(`/replay/${h.id}`)}><span className="mono" style={{ color: scoreTone(h.overall) }}>{h.overall}</span> · Replay</button> : h.status === 'active' ? <span className="chip acc">Active</span> : <span className="muted">—</span>}</div>)}
          {data.history.some((h) => h.status === 'completed') && <p className="xs muted mt-8">Repeat attempts earn reduced XP (50%, 25%, then 10%). Skill ratings still update.</p>}</>}
        {user.role === 'professor' ? <div className="callout info mt-24">Professor accounts preview cases here. Assign this case from the Classroom page.</div>
          : meta?.locked ? <div className="callout mt-24"><Icon name="lock" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Unlocks at {meta.unlockRankName}. Keep investigating to rank up.</div>
          : <button className="btn primary lg mt-24" style={{ width: '100%' }} onClick={start} disabled={busy}><Icon name="play" size={14} />{meta?.status === 'active' ? 'Resume investigation' : meta?.status === 'completed' ? 'Investigate again' : 'Accept engagement'}</button>}
      </div>}
    </Drawer>
  );
}

export default function Vault() {
  const { data, loading, error, reload } = useApi('/cases'); const [sp, setSp] = useSearchParams(); const open = sp.get('open');
  const [q, setQ] = useState(''); const [f, setF] = useState({}); const [status, setStatus] = useState('all'); const [skill, setSkill] = useState(''); const [sort, setSort] = useState('featured');
  const cases = data?.cases || [];
  const opts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, [...new Set(cases.map((c) => c[k]))]])), [cases]);
  const list = useMemo(() => {
    let l = cases.filter((c) => (!q || `${c.title} ${c.company} ${c.blurb} ${c.industry} ${c.problemType}`.toLowerCase().includes(q.toLowerCase())) && FILTERS.every(([k]) => !f[k] || c[k] === f[k]) && (status === 'all' || c.status === status) && (!skill || c.skills.includes(skill)));
    const by = { featured: (a, b) => (b.tags.includes('featured') - a.tags.includes('featured')) || a.difficulty - b.difficulty, difficulty: (a, b) => a.difficulty - b.difficulty, duration: (a, b) => a.durationMin - b.durationMin, xp: (a, b) => b.xpReward - a.xpReward };
    return [...l].sort(by[sort]);
  }, [cases, q, f, status, skill, sort]);
  useEffect(() => { document.title = 'Case Vault — ConsultBrain'; }, []);
  if (loading) return <PageSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  const active = Object.values(f).filter(Boolean).length + (status !== 'all') + (skill ? 1 : 0) + (q ? 1 : 0);
  return (
    <div className="page">
      <div className="page-h"><div><div className="eyebrow mb-8">Case Vault</div><h1>Engagements</h1><p className="t2 mt-8">Original fictional cases built on consistent numeric models. Each supports more than one defensible route.</p></div>
        <div className="row gap-6" style={{ position: 'relative' }}><Icon name="search" size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} /><input className="input" style={{ width: 260, paddingLeft: 32 }} placeholder="Search cases, companies, problems" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cases" /></div></div>
      <div className="panel pad mb-16"><div className="row wrap gap-10">
        {FILTERS.map(([k, label]) => <select key={k} className="select" style={{ width: 'auto', minWidth: 150 }} value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={label}><option value="">{label}: all</option>{opts[k].map((o) => <option key={o}>{o}</option>)}</select>)}
        <select className="select" style={{ width: 'auto' }} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill focus"><option value="">Skill focus: all</option>{Object.entries(SKILL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="all">Status: all</option><option value="new">Not started</option><option value="active">In progress</option><option value="completed">Completed</option></select>
        <span className="grow" /><select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="featured">Sort: featured</option><option value="difficulty">Difficulty</option><option value="duration">Shortest first</option><option value="xp">Highest XP</option></select>
        {active > 0 && <button className="btn ghost sm" onClick={() => { setF({}); setQ(''); setStatus('all'); setSkill(''); }}>Clear {active}</button>}
      </div></div>
      {list.length === 0 ? <div className="panel"><Empty icon="search" title="No cases match these filters" action={<button className="btn sm mt-8" onClick={() => { setF({}); setQ(''); setStatus('all'); setSkill(''); }}>Clear filters</button>}>The vault currently holds {cases.length} playable cases. New cases are added as structured definitions.</Empty></div>
        : <div className="grid g3 stagger">{list.map((c) => { const rec = data.recommended.case.id === c.id; return (
          <article key={c.id} className="panel hover" onClick={() => setSp({ open: c.id })} style={rec ? { borderColor: 'var(--accent)' } : null} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSp({ open: c.id })}>
            <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
              <div className="row between"><span className="xs muted">{c.industry}</span><span className="row gap-6">{rec && <span className="chip acc">Recommended</span>}{c.tags.includes('featured') && <span className="chip">Featured</span>}{c.tags.includes('new') && <span className="chip info">New</span>}{c.tags.includes('competitive') && <span className="chip neg">Tournament</span>}{c.locked && <Icon name="lock" size={14} className="muted" />}</span></div>
              <div><div className="small t2">{c.company}</div><h2 className="mt-4" style={{ fontSize: 22 }}>{c.title}</h2></div>
              <p className="small t2" style={{ flex: 1 }}>{c.blurb}</p>
              <div className="row wrap gap-6"><span className="chip line">{c.problemType}</span>{c.skills.map((s) => <span key={s} className="chip">{SKILL[s].split(' ')[0]}</span>)}</div>
              <hr className="rule" style={{ margin: '2px 0' }} />
              <div className="row between"><Difficulty n={c.difficulty} label={c.difficultyLabel} /><span className="row gap-16 xs muted"><span className="row gap-4"><Icon name="clock" size={13} />{c.durationMin} min</span><span className="mono acc">+{c.xpReward} XP</span></span></div>
              <div className="row between small">{c.status === 'completed' ? <span className="row gap-6"><Icon name="check" size={13} className="pos" /><span className="t2">Completed · best</span><span className="mono" style={{ color: scoreTone(c.best) }}>{c.best}</span></span> : c.status === 'active' ? <span className="row gap-6 acc"><span className="live-dot" style={{ background: 'var(--accent)' }} />In progress</span> : c.locked ? <span className="muted">Unlocks at {c.unlockRankName}</span> : <span className="muted">Not started</span>}<span className="acc row gap-4">Open<Icon name="arrow" size={13} /></span></div>
            </div></article>); })}</div>}
      {open && <CaseDrawer id={open} meta={cases.find((c) => c.id === open)} onClose={() => setSp({})} />}
    </div>
  );
}
