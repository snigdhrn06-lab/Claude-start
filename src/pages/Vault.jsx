import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { post } from '../api.js';
import { useAuth } from '../App.jsx';
import { ago, DIFF_COLOR, Drawer, Empty, ErrorState, Icon, Modal, Presence, scoreTone, Seg, Skeleton, spotlight, Tip, useApi, useToast } from '../components/ui.jsx';
import { LineChart } from '../components/charts.jsx';
import { CaseArt, caseTheme } from '../components/Art.jsx';

const SKILL = { structuring: 'Structuring', hypothesis: 'Hypothesis quality', evidence: 'Evidence efficiency', quant: 'Quantitative accuracy', calibration: 'Calibration', synthesis: 'Synthesis & defence' };
const ini = (s) => s.split(' ').map((w) => w[0]).join('').slice(0, 2);
export function Difficulty({ n, label }) { return <span className="row gap-6 xs"><span className="diff-pips">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} style={i <= n ? { background: DIFF_COLOR[n], animationDelay: `${i * 0.06}s`, boxShadow: `0 0 6px ${DIFF_COLOR[n]}` } : null} />)}</span><span className="t2">{label}</span></span>; }
const STATUS = { completed: ['Completed', 'pos', 'check'], active: ['In progress', 'acc', 'play'], new: ['New', 'info', 'spark'] };

function Launch({ c, onClose, onGo, busy }) {
  return <Modal onClose={onClose} width={520} label="Start investigation">
    <div className="case-art" style={{ '--case': caseTheme(c.id).color, height: 130 }}><CaseArt id={c.id} initials={ini(c.company)} /></div>
    <div style={{ padding: '20px 24px 22px' }}>
      <div className="eyebrow acc">Engagement letter received</div><h2 className="mt-8" style={{ fontSize: 24 }}>{c.company}: {c.title}</h2>
      <div className="grid g3 mt-16" style={{ gap: 10 }}>{[['Budget', `${c.budgetHours} analyst hours`], ['Duration', `~${c.durationMin} min`], ['Reward', `up to ${c.xpReward} XP`]].map(([k, v]) => <div key={k} className="panel pad" style={{ padding: '10px 12px' }}><div className="eyebrow">{k}</div><div className="mono small mt-4">{v}</div></div>)}</div>
      <ul className="small t2 mt-16" style={{ paddingLeft: 18, lineHeight: 1.7, margin: '16px 0 0' }}><li>Commit confidence to at least two hypotheses before the data room opens.</li><li>Every dataset and interview spends hours you cannot get back.</li><li>Your progress saves automatically; you can leave and resume.</li></ul>
      <div className="row end mt-24"><button className="btn" onClick={onClose}>Not yet</button><button className="btn primary lg" disabled={busy} onClick={onGo}><Icon name="play" size={14} />{busy ? 'Preparing case file…' : 'Begin engagement'}</button></div>
    </div></Modal>;
}

function CaseDrawer({ id, meta, onClose }) {
  const { data, loading } = useApi(`/cases/${id}`); const nav = useNavigate(); const toast = useToast(); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const { user } = useAuth();
  const start = async () => { setBusy(true); try { const d = await post('/attempts', { caseId: id }); nav(`/case/${d.attempt.id}`); } catch (e) { toast(e.message, 'bad'); setBusy(false); } };
  const c = data?.case; const th = caseTheme(id);
  return (
    <Drawer onClose={onClose} width={620}>
      {loading || !c ? <div style={{ padding: 24 }}><Skeleton h={170} /><Skeleton h={40} className="mt-16" /><Skeleton h={220} className="mt-16" /></div> : <div style={{ '--case': th.color }}>
        <div className="case-art" style={{ height: 190 }}><CaseArt id={id} initials={ini(c.company)} /><button className="btn ghost sm icon" style={{ position: 'absolute', top: 12, right: 12, background: 'var(--surface)' }} onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <div style={{ padding: '20px 26px 30px' }}>
          <div className="row between"><span className="eyebrow" style={{ color: th.color }}>{c.industry} · {c.problemType}</span><Difficulty n={c.difficulty} label={c.difficultyLabel} /></div>
          <div className="small muted mt-12">{c.company}</div><h1 className="mt-4" style={{ fontSize: 30 }}>{c.title}</h1>
          <p className="t2 mt-12" style={{ fontSize: 15, lineHeight: 1.6 }}>{c.blurb}</p>
          <div className="grid g4 mt-16">{c.briefing.metrics.map((m, i) => <motion.div key={m.label} className="panel pad" style={{ padding: '10px 12px' }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}><div className="xs muted">{m.label}</div><div className="mono mt-4" style={{ fontSize: 16 }}>{m.value}</div><div className={`mono xs ${m.tone === 'up' ? 'pos' : m.tone === 'down' ? 'neg' : 'muted'}`}>{m.delta}</div></motion.div>)}</div>
          <div className="panel pad mt-12"><div className="eyebrow mb-8">{c.briefing.trend.label}</div><LineChart categories={c.briefing.trend.x} series={c.briefing.trend.series} height={140} area={false} /></div>
          <div className="eyebrow mt-24 mb-8">The engagement</div>
          <div className="grid g2" style={{ gap: 8 }}>{[['doc', `Brief from ${c.briefing.from.name}`], ['data', `${c.datasetCount} datasets, ${c.stakeholderCount} stakeholders`], ['calc', 'Workbench and scenario model'], ['gavel', 'Boardroom defence + one twist'], ['clock', `${c.budgetHours} analyst hours to spend`], ['replay', 'Evidence Trail Replay']].map(([ic, t]) => <div key={t} className="row gap-10 small t2"><Icon name={ic} size={14} style={{ color: th.color }} />{t}</div>)}</div>
          <div className="row wrap gap-6 mt-16">{c.skills.map((s) => <span key={s} className="chip line">{SKILL[s]}</span>)}</div>
          {data.history.length > 0 && <><div className="eyebrow mt-24 mb-8">Your attempts</div>{data.history.map((h) => <div key={h.id} className="row between small" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}><span className="t2">{h.status === 'completed' ? ago(h.completedAt) : h.status === 'active' ? 'In progress' : 'Abandoned'}{h.seeded ? ' · seeded demo attempt' : ''}</span>{h.status === 'completed' ? <button className="btn ghost sm" onClick={() => nav(`/replay/${h.id}`)}><span className="mono" style={{ color: scoreTone(h.overall) }}>{h.overall}</span> · Replay</button> : h.status === 'active' ? <span className="chip acc">Active</span> : <span className="muted">—</span>}</div>)}
            {data.history.some((h) => h.status === 'completed') && <p className="xs muted mt-8">Repeat attempts earn reduced XP (50%, 25%, then 10%). Skill ratings still update.</p>}</>}
          {user.role === 'professor' ? <div className="callout info mt-24">Professor accounts preview cases here. Assign this case from the Classroom page.</div>
            : meta?.locked ? <div className="callout mt-24"><Icon name="lock" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Unlocks at <b>{meta.unlockRankName}</b>. Keep investigating to rank up — you can preview the brief above.</div>
            : <button className="btn primary xl mt-24" style={{ width: '100%' }} onClick={() => (meta?.status === 'active' ? start() : setConfirm(true))} disabled={busy}><Icon name="play" size={14} />{meta?.status === 'active' ? 'Resume investigation' : meta?.status === 'completed' ? 'Investigate again' : 'Start investigation'}</button>}
        </div>
      </div>}
      <Presence>{confirm && c && <Launch key="l" c={{ ...c, id }} busy={busy} onClose={() => setConfirm(false)} onGo={start} />}</Presence>
    </Drawer>
  );
}

function CaseCard({ c, rec, featured, onOpen, i }) {
  const th = caseTheme(c.id); const st = STATUS[c.status] || STATUS.new;
  return <motion.article layout initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.45, delay: i * 0.05, ease: [0.22, 0.8, 0.24, 1] }}
    className={`case-card spot ${featured ? 'featured' : ''} ${c.locked ? 'locked' : ''}`} style={{ '--case': th.color }} onMouseMove={spotlight} onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()} aria-label={`${c.company}: ${c.title}`}>
    <div className="case-art"><CaseArt id={c.id} initials={ini(c.company)} />
      <span className="status-ribbon row gap-6"><span className={`chip ${st[1]}`}><Icon name={st[2]} size={10} />{st[0]}{c.status === 'completed' && <b className="mono" style={{ marginLeft: 2 }}>{c.best}</b>}</span>{rec && <span className="chip acc">Recommended</span>}</span>
      <span style={{ position: 'absolute', top: 12, right: 12 }} className="row gap-6">{c.tags.includes('featured') && <span className="chip line" style={{ background: 'var(--surface)' }}>Featured</span>}{c.tags.includes('competitive') && <span className="chip neg">Tournament</span>}</span>
      {c.locked && <div className="case-lock"><span className="col" style={{ alignItems: 'center', gap: 6 }}><span className="empty-ico" style={{ margin: 0 }}><Icon name="lock" size={18} /></span><span className="small">Unlocks at <b>{c.unlockRankName}</b></span></span></div>}
      <span className="xs mono" style={{ position: 'absolute', bottom: 10, left: 14, color: th.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{th.tag}</span>
    </div>
    <div className="case-body">
      <div className="row between"><span className="xs muted">{c.company} · {c.industry}</span><Difficulty n={c.difficulty} label={c.difficultyLabel} /></div>
      <h2 style={{ fontSize: featured ? 30 : 22 }}>{c.title}</h2>
      <p className="small t2" style={{ flex: 1, fontSize: featured ? 14.5 : 13 }}>{c.blurb}</p>
      <div className="case-reveal"><div className="row wrap gap-6"><span className="chip line">{c.problemType}</span>{c.skills.map((s) => <span key={s} className="chip">{SKILL[s].split(' ')[0]}</span>)}</div></div>
      <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="row gap-16 xs muted"><Tip label="Estimated completion time"><span className="row gap-4"><Icon name="clock" size={13} />{c.durationMin} min</span></Tip><Tip label="Analyst-hour budget"><span className="row gap-4"><Icon name="data" size={13} />{c.budgetHours}h</span></Tip><span className="mono acc">+{c.xpReward} XP</span></span>
        {c.locked ? <span className="xs muted">Preview</span> : <span className="btn sm primary" style={{ pointerEvents: 'none' }}>{c.status === 'active' ? 'Resume' : c.status === 'completed' ? 'Replay or retry' : 'Start investigation'}<Icon name="arrow" size={12} /></span>}
      </div>
    </div></motion.article>;
}

export default function Vault() {
  const { data, loading, error, reload } = useApi('/cases'); const [sp, setSp] = useSearchParams(); const open = sp.get('open');
  const [q, setQ] = useState(''); const [ind, setInd] = useState('All'); const [status, setStatus] = useState('all'); const [diff, setDiff] = useState(''); const [skill, setSkill] = useState(''); const [sort, setSort] = useState('featured');
  const cases = data?.cases || [];
  const industries = useMemo(() => ['All', ...new Set(cases.map((c) => c.industry))], [cases]);
  const list = useMemo(() => {
    const l = cases.filter((c) => (!q || `${c.title} ${c.company} ${c.blurb} ${c.industry} ${c.problemType} ${c.func}`.toLowerCase().includes(q.toLowerCase())) && (ind === 'All' || c.industry === ind) && (status === 'all' || c.status === status) && (!diff || c.difficultyLabel === diff) && (!skill || c.skills.includes(skill)));
    const by = { featured: (a, b) => (b.tags.includes('featured') - a.tags.includes('featured')) || a.difficulty - b.difficulty, difficulty: (a, b) => a.difficulty - b.difficulty, duration: (a, b) => a.durationMin - b.durationMin, xp: (a, b) => b.xpReward - a.xpReward };
    return [...l].sort(by[sort]);
  }, [cases, q, ind, status, diff, skill, sort]);
  useEffect(() => { document.title = 'Case Vault — Consult Brain'; }, []);
  if (loading && !data) return <div className="page"><Skeleton h={60} /><Skeleton h={340} className="mt-16" /><div className="grid g3 mt-16"><Skeleton h={360} /><Skeleton h={360} /><Skeleton h={360} /></div></div>;
  if (error) return <ErrorState error={error} retry={reload} />;
  const active = (q ? 1 : 0) + (ind !== 'All') + (status !== 'all') + (diff ? 1 : 0) + (skill ? 1 : 0);
  const clear = () => { setQ(''); setInd('All'); setStatus('all'); setDiff(''); setSkill(''); };
  const featured = !active && sort === 'featured' ? list[0] : null; const rest = featured ? list.slice(1) : list;
  const counts = { all: cases.length, new: cases.filter((c) => c.status === 'new').length, active: cases.filter((c) => c.status === 'active').length, completed: cases.filter((c) => c.status === 'completed').length };
  return (
    <div className="page">
      <motion.div className="page-h" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div><div className="eyebrow acc mb-8">Case Vault</div><h1 className="display" style={{ fontSize: 'clamp(32px, 3.6vw, 48px)' }}>Choose your <em>engagement</em>.</h1><p className="t2 mt-8">Original fictional cases on consistent numeric models. Each supports more than one defensible route.</p></div>
        <div className="row gap-16"><div className="kpi"><span className="v">{counts.completed}<span className="muted xs">/{counts.all}</span></span><span className="xs muted">completed</span></div><div className="kpi"><span className="v acc">{cases.filter((c) => !c.locked && c.status !== 'completed').reduce((s, c) => s + c.xpReward, 0)}</span><span className="xs muted">XP available</span></div></div>
      </motion.div>
      <div className="panel mb-16" style={{ padding: 12 }}>
        <div className="row wrap gap-10">
          <div style={{ position: 'relative', flex: '1 1 260px' }}><Icon name="search" size={15} style={{ position: 'absolute', left: 11, top: 10, color: 'var(--muted)' }} /><input className="input" style={{ paddingLeft: 34 }} placeholder="Search companies, problems, functions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cases" /></div>
          <Seg value={status} onChange={setStatus} options={[{ id: 'all', label: `All ${counts.all}` }, { id: 'new', label: `New ${counts.new}` }, { id: 'active', label: `Active ${counts.active}` }, { id: 'completed', label: `Done ${counts.completed}` }]} />
          <select className="select" style={{ width: 'auto' }} value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Difficulty"><option value="">Any difficulty</option>{[...new Set(cases.map((c) => c.difficultyLabel))].map((d) => <option key={d}>{d}</option>)}</select>
          <select className="select" style={{ width: 'auto' }} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill focus"><option value="">Any skill focus</option>{Object.entries(SKILL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="featured">Featured first</option><option value="difficulty">Easiest first</option><option value="duration">Shortest first</option><option value="xp">Highest XP</option></select>
        </div>
        <div className="row wrap gap-6 mt-12">{industries.map((x) => <button key={x} className={`chip line btnlike ${ind === x ? 'on' : ''}`} style={{ height: 28, position: 'relative' }} onClick={() => setInd(x)}>{x}</button>)}
          <AnimatePresence>{active > 0 && <motion.button initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={clear}><Icon name="x" size={12} />Clear {active} filter{active > 1 ? 's' : ''}</motion.button>}</AnimatePresence></div>
      </div>
      {list.length === 0 ? <div className="panel"><Empty icon="search" title="No engagements match" action={<button className="btn sm mt-8" onClick={clear}>Clear filters</button>}>The vault holds {cases.length} playable cases. Try a different industry or status.</Empty></div> : <>
        {featured && <div className="mb-16"><CaseCard c={featured} featured rec={data.recommended.case.id === featured.id} onOpen={() => setSp({ open: featured.id })} i={0} /></div>}
        <motion.div layout className="grid g3"><AnimatePresence mode="popLayout">{rest.map((c, i) => <CaseCard key={c.id} c={c} rec={data.recommended.case.id === c.id} onOpen={() => setSp({ open: c.id })} i={i + 1} />)}</AnimatePresence>
          {!active && <motion.div layout className="panel flat" style={{ border: '1px dashed var(--line-2)', borderRadius: 'var(--r-xl)', display: 'grid', placeItems: 'center', minHeight: 300, padding: 24, textAlign: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div><span className="empty-ico" style={{ margin: '0 auto 10px' }}><Icon name="plus" size={18} /></span><div className="serif" style={{ fontSize: 19 }}>More engagements in preparation</div><p className="small muted mt-8" style={{ maxWidth: 260 }}>Cases are added as structured, independently validated definitions. See the README for how to author one.</p></div></motion.div>}
        </motion.div></>}
      <Presence>{open && <CaseDrawer key={open} id={open} meta={cases.find((c) => c.id === open)} onClose={() => setSp({})} />}</Presence>
    </div>
  );
}
