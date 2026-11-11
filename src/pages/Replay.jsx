import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bar, CountUp, DemoTag, ErrorState, Icon, PageSkeleton, RankEmblem, rankMeta, scoreTone, Seg, SKILL_COLOR, Tabs, Tip, useApi } from '../components/ui.jsx';
import { useCelebrate } from '../components/Layers.jsx';
import { BeliefStream, PALETTE, Ring } from '../components/charts.jsx';

const V = { strong: ['Strong move', 'pos'], good: ['Sound', 'pos'], neutral: ['Neutral', ''], missed: ['Missed moment', 'neg'], waste: ['Low value', 'acc'] };
const KIND_ICON = { brief: 'doc', hypothesis: 'target', data: 'data', interview: 'chat', calc: 'calc', belief: 'scale', recommend: 'edit', defence: 'gavel', hint: 'bulb' };
const time = (t, t0) => { const m = Math.max(0, Math.round((t - t0) / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

export default function Replay() {
  const { id } = useParams(); const [sp] = useSearchParams(); const fresh = sp.get('fresh'); const nav = useNavigate();
  const { data, loading, error, reload } = useApi(`/attempts/${id}/result`); const [tab, setTab] = useState('trail');
  const { report } = useCelebrate();
  useEffect(() => { document.title = 'Evidence Trail Replay — Consult Brain'; }, []);
  useEffect(() => { if (data && fresh && data.result.applied) report(data.result.applied, { key: `att_${id}`, xp: data.result.xp.total }); }, [data, fresh]); // eslint-disable-line
  if (loading) return <PageSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  const { result: r, case: c, attempt: at, learner } = data; const ap = r.applied; const final = r.override?.score ?? r.overall;
  const ranked = fresh && ap && ap.rankAfter > ap.rankBefore;
  return (
    <div className="page">
      <div className="page-h"><div><div className="eyebrow mb-8">Evidence Trail Replay {at.seeded && <span style={{ marginLeft: 6 }}><DemoTag /></span>}</div><h1>{c.company}: {c.title}</h1>
        <p className="t2 mt-8">{learner.name}'s investigation, replayed against two expert routes. {r.replay.counts.strong} strong moves, {r.replay.counts.missed} missed moments, {r.replay.counts.waste} low-value requests.</p></div>
        <div className="row"><button className="btn" onClick={() => nav('/vault')}>Case Vault</button><button className="btn primary" onClick={() => nav('/')}>Command Centre</button></div></div>

      {ranked && <div className="panel pad mb-16 row gap-16" style={{ borderColor: rankMeta(data.ranks[ap.rankAfter].id).color, animation: 'pop 0.5s var(--ease)' }}><RankEmblem rank={data.ranks[ap.rankAfter].id} size={52} /><div><div className="eyebrow">Rank achieved</div><div className="serif" style={{ fontSize: 24 }}>{data.ranks[ap.rankAfter].name}</div><div className="small muted">A certificate has been issued. <Link to="/certificates" className="acc">View certificates →</Link></div></div></div>}

      <div className="grid g12 mb-16 stagger">
        <div className="panel pad s3 row gap-16"><Ring value={final} size={96} stroke={8} color={scoreTone(final)}><div><div className="mono" style={{ fontSize: 28, lineHeight: 1 }}><CountUp value={final} /></div><div className="xs muted">/ 100</div></div></Ring>
          <div><div className="eyebrow">Investigation score</div><div className="small t2 mt-8">{r.override ? <>Adjusted by {r.override.by}<br /><span className="muted">engine: {r.overall}</span></> : final >= 80 ? 'Rigorous and well defended.' : final >= 60 ? 'Sound, with clear gaps.' : final >= 40 ? 'Partial diagnosis.' : 'The evidence pointed elsewhere.'}</div></div></div>
        <div className="panel pad s3"><div className="eyebrow">XP earned</div><div className="mono acc mt-8" style={{ fontSize: 34, lineHeight: 1 }}>+<CountUp value={r.xp.total} duration={1300} /></div>
          <div className="xs muted mt-8">{r.xp.multipliers.length ? r.xp.multipliers.map((m) => `${m.label} ×${m.factor}`).join(' · ') : `${r.xp.items.length - 1} bonus${r.xp.items.length === 2 ? '' : 'es'} earned`}</div>
          {ap?.achievements.length > 0 && <div className="row wrap gap-6 mt-8">{ap.achievements.map((a) => <span key={a.id} className="chip acc" style={{ animation: 'pop 0.5s var(--ease) 0.6s both' }}><Icon name="star" size={11} />{a.name}</span>)}</div>}</div>
        <div className="panel pad s6"><div className="row between"><span className="eyebrow">Six skills, this case</span>{ap && <span className="xs muted">rating change in brackets</span>}</div>
          <div className="grid g3 mt-12" style={{ gap: '10px 18px' }}>{data.skillsMeta.map((s) => { const dl = ap?.deltas.find((d) => d.skill === s.id); const ch = dl ? Math.round((dl.after - dl.before) * 10) / 10 : null; return <div key={s.id}><div className="row between xs"><span className="t2 truncate">{s.label}</span><span className="row gap-6"><span className="mono" style={{ fontSize: 13 }}>{r.skills[s.id]}</span>{ch != null && <span className={`mono ${ch > 0 ? 'pos' : ch < 0 ? 'neg' : 'muted'}`} style={{ fontSize: 10.5 }}>({ch > 0 ? '+' : ''}{ch})</span>}</span></div><Bar value={r.skills[s.id]} className="thin mt-4" color={SKILL_COLOR[s.id]} /></div>; })}</div></div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'trail', label: 'Evidence trail' }, { id: 'score', label: 'Scorecard & XP' }, { id: 'paths', label: 'Expert routes' }, { id: 'debrief', label: 'Debrief' }]} />
      <div className="mt-16" key={tab} style={{ animation: 'pageIn 0.28s var(--ease)' }}>
        {tab === 'trail' && <Trail r={r} at={at} autoplay={!!fresh} />}
        {tab === 'score' && <Score r={r} data={data} />}
        {tab === 'paths' && <Paths r={r} />}
        {tab === 'debrief' && <Debrief r={r} data={data} />}
      </div>
    </div>
  );
}

function Trail({ r, at, autoplay }) {
  const rp = r.replay; const T = rp.timeline; const [sel, setSel] = useState(() => { const i = T.findIndex((x) => x.verdict === 'missed'); return i >= 0 ? i : T.length - 1; });
  const [cursor, setCursor] = useState(null); const [playing, setPlaying] = useState(false); const [filter, setFilter] = useState('all'); const listRef = useRef(null);
  useEffect(() => { if (autoplay) { setCursor(0); setPlaying(true); } }, [autoplay]);
  useEffect(() => { if (!playing) return; const t = setInterval(() => setCursor((c) => { const n = (c ?? -1) + 1; if (n >= T.length - 1) { setPlaying(false); return null; } return n; }), 850); return () => clearInterval(t); }, [playing, T.length]);
  useEffect(() => { if (cursor != null) { setSel(cursor); listRef.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, [cursor]);
  const t0 = T[0].t; const cur = cursor ?? T.length - 1;
  const upto = useMemo(() => rp.snapshots.filter((s) => s.t <= T[cur].t).length - 1, [cur, rp.snapshots, T]);
  const activeSnap = useMemo(() => { const e = T[sel]; if (e.kind !== 'belief') return null; return rp.snapshots.findIndex((s) => s.t === e.t); }, [sel, T, rp.snapshots]);
  const shown = T.filter((x) => filter === 'all' || (filter === 'key' && x.verdict !== 'neutral') || (filter === 'missed' && (x.verdict === 'missed' || x.verdict === 'waste')));
  const e = T[sel]; const best = [...rp.paths].sort((a, b) => b.match - a.match)[0];
  const colorOf = (label) => PALETTE[Object.values(rp.drivers).indexOf(label) % 8];
  const spent = T.filter((x) => x.cost); const byV = (v) => spent.filter((x) => (v === 'waste' ? x.verdict === 'waste' : v === 'strong' ? x.verdict === 'strong' : x.verdict !== 'waste' && x.verdict !== 'strong')).reduce((n, x) => n + x.cost, 0);
  return <div className="col" style={{ gap: 14 }}>
    <div className="panel" style={{ overflow: 'hidden' }}>
      <div className="panel-h"><div><span className="eyebrow acc">The trail</span><div className="xs muted mt-4">Every move in order. Colour shows how it served the investigation; numbers above show hours spent.</div></div>
        <div className="row gap-16 xs t2 hide-sm"><span className="row gap-6"><i className="dot" style={{ background: 'var(--pos)' }} />strong</span><span className="row gap-6"><i className="dot" style={{ border: '1.5px solid var(--pos)' }} />sound</span><span className="row gap-6"><i className="dot" style={{ background: 'var(--neg)' }} />missed moment</span><span className="row gap-6"><i className="dot" style={{ background: 'var(--warn)' }} />low value</span></div></div>
      <div className="trail-strip">{T.map((x, k) => <React.Fragment key={x.i}>{k > 0 && <motion.span className="trail-link" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.02 * k }} style={{ transformOrigin: 'left', background: cursor != null && x.i > cursor ? 'var(--line)' : 'var(--line-hi)' }} />}
        <Tip label={x.title}><button className={`trail-node v-${x.verdict} ${sel === x.i ? 'on' : ''} ${cursor != null && x.i > cursor ? 'dim' : ''}`} onClick={() => { setPlaying(false); setSel(x.i); }} aria-label={x.title}>
          {x.cost ? <span className="trail-cost">{x.cost}h</span> : null}<motion.span className="n" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.03 * k, type: 'spring', stiffness: 300, damping: 18 }}><Icon name={KIND_ICON[x.kind]} size={12} /></motion.span></button></Tip></React.Fragment>)}</div>
      <div style={{ padding: '0 18px 14px' }}><div className="row between xs muted mb-8"><span>Where the {rp.hours.used} analyst hours went</span><span className="mono">{rp.hours.budget - rp.hours.used}h unspent</span></div>
        <div className="row" style={{ height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, background: 'var(--surface-3)' }}>{[['strong', 'var(--pos)', 'Decisive evidence'], ['ok', 'color-mix(in srgb, var(--pos) 45%, var(--surface-3))', 'Useful or neutral'], ['waste', 'var(--warn)', 'Could not discriminate']].map(([v, col, lab]) => { const h = byV(v); return h ? <Tip key={v} label={`${lab}: ${h}h`}><motion.i initial={{ width: 0 }} animate={{ width: `${(h / rp.hours.budget) * 100}%` }} transition={{ duration: 1 }} style={{ display: 'block', height: 10, background: col, minWidth: 6 }} /></Tip> : null; })}</div></div>
    </div>
    <div className="panel">
      <div className="panel-h"><div><span className="eyebrow">How your beliefs moved</span><div className="xs muted mt-4">Each column is a committed confidence allocation. The dashed column is where the full evidence points.</div></div>
        <div className="row"><button className="btn sm" onClick={() => { if (playing) setPlaying(false); else { setCursor(cursor == null || cursor >= T.length - 2 ? 0 : cursor); setPlaying(true); } }}><Icon name={playing ? 'pause' : 'play'} size={12} />{playing ? 'Pause' : 'Play investigation'}</button>{cursor != null && <button className="btn ghost sm" onClick={() => { setPlaying(false); setCursor(null); }}>Show all</button>}</div></div>
      <div className="panel-b">{rp.snapshots.length ? <BeliefStream snapshots={rp.snapshots} drivers={rp.drivers} truth={rp.truth} upto={cursor == null ? null : Math.max(0, upto)} active={activeSnap >= 0 ? activeSnap : undefined} onPick={(i) => { const k = T.findIndex((x) => x.t === rp.snapshots[i].t && x.kind === 'belief'); if (k >= 0) { setPlaying(false); setSel(k); } }} height={250} /> : <div className="small muted">No confidence allocation was committed.</div>}
        <input type="range" className="mt-12" min="0" max={T.length - 1} value={cur} onChange={(ev) => { setPlaying(false); setCursor(Number(ev.target.value)); }} aria-label="Scrub through the investigation" />
        <div className="row between xs muted mt-4"><span>Engagement opened</span><span className="mono">step {cur + 1} of {T.length} · {time(T[cur].t, t0)} elapsed · {rp.hours.used}/{rp.hours.budget} analyst hours used</span><span>Final answer</span></div></div>
    </div>
    <div className="grid g12">
      <div className="s5 panel"><div className="panel-h"><span className="eyebrow">Your trail</span><Seg value={filter} onChange={setFilter} options={[{ id: 'all', label: `All ${T.length}` }, { id: 'key', label: 'Key moments' }, { id: 'missed', label: 'To improve' }]} /></div>
        <div className="panel-b" ref={listRef} style={{ maxHeight: 620, overflowY: 'auto' }}><div className="tl">{shown.map((x) => <div key={x.i} data-i={x.i} className={`tl-item v-${x.verdict} ${sel === x.i ? 'on' : ''} ${cursor != null && x.i > cursor ? 'dim' : ''}`} onClick={() => { setPlaying(false); setSel(x.i); }} role="button" tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && setSel(x.i)}>
          <div className="row between gap-6"><span className="row gap-6" style={{ minWidth: 0 }}><Icon name={KIND_ICON[x.kind]} size={13} className="muted" /><span className="truncate small" style={{ fontWeight: 500 }}>{x.title}</span></span><span className="mono xs muted">{x.cost ? `${x.cost}h · ` : ''}{time(x.t, t0)}</span></div>
          {x.verdict !== 'neutral' && <div className={`xs mt-4 ${V[x.verdict][1]}`}>{V[x.verdict][0]}</div>}</div>)}{shown.length === 0 && <div className="small muted">Nothing in this view.</div>}</div></div></div>
      <div className="s7 col" style={{ gap: 14 }}>
        <div className="panel" key={sel} style={{ animation: 'fadeIn 0.25s' }}>
          <div className="panel-h"><span className="row gap-6"><Icon name={KIND_ICON[e.kind]} size={15} className="acc" /><span className="eyebrow">Step {e.i + 1} · {e.kind}</span></span><span className={`chip ${V[e.verdict][1]}`}>{V[e.verdict][0]}</span></div>
          <div className="panel-b"><h2 style={{ fontSize: 19 }}>{e.title}</h2>
            {e.detail && <p className="t2 mt-8" style={{ fontSize: 14 }}>{e.kind === 'data' && <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>What it showed</span>}{e.detail}</p>}
            {e.response && <div className="panel pad mt-12 small" style={{ background: 'var(--bg-2)' }}><span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Your answer</span>{e.response}</div>}
            {e.byDriver && <div className="col mt-12" style={{ gap: 5 }}>{Object.entries(e.byDriver).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="row gap-10 small"><span className="t2 truncate" style={{ width: 230 }}>{rp.drivers[k] || 'Other'}</span><div className="bar grow"><i style={{ width: `${v}%`, background: colorOf(rp.drivers[k]) }} /></div><span className="mono" style={{ width: 24, textAlign: 'right' }}>{v}</span></div>)}</div>}
            {e.signals?.length > 0 && <div className="mt-12"><span className="eyebrow">Bears on</span><div className="row wrap gap-6 mt-8">{e.signals.map((s) => <span key={s.driver} className={`chip ${s.v > 0 ? 'pos' : 'neg'}`}>{s.v > 0 ? '▲ supports' : '▼ undercuts'} · {s.driver}{Math.abs(s.v) >= 2 ? ' (strongly)' : ''}</span>)}</div></div>}
            {e.impact && <div className={`callout mt-16 ${e.verdict === 'missed' ? 'neg' : e.verdict === 'strong' || e.verdict === 'good' ? 'pos' : ''}`}><span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>{e.kind === 'defence' ? 'The response' : 'Why it mattered'}</span>{e.impact}</div>}
          </div></div>
        <div className="grid g2">
          <div className="panel"><div className="panel-h"><span className="eyebrow">Evidence you did not see</span><span className="mono xs muted">{rp.missed.length}</span></div><div className="panel-b col" style={{ gap: 12 }}>{rp.missed.length === 0 ? <div className="small muted">You obtained every material dataset.</div> : rp.missed.slice(0, 5).map((m) => <div key={m.title}><div className="row between small"><b>{m.title}</b><span className={`chip ${m.value === 'critical' ? 'neg' : ''}`}>{m.value === 'critical' ? 'Decisive' : 'Useful'} · {m.cost}h</span></div><p className="xs t2 mt-4">{m.insight}</p></div>)}</div></div>
          <div className="panel"><div className="panel-h"><span className="eyebrow">Closest expert route</span><span className="mono xs acc">{best.match}% overlap</span></div><div className="panel-b"><b>{best.name}</b><p className="xs t2 mt-4">{best.summary}</p>
            <div className="mt-8">{best.steps.filter((s) => !s.done).slice(0, 4).map((s, i) => <div key={i} className="row gap-6 xs t2" style={{ padding: '4px 0', alignItems: 'flex-start' }}><Icon name="minus" size={12} className="neg" style={{ marginTop: 2, flex: 'none' }} /><span>{s.label}{s.why ? ` — ${s.why}` : ''}</span></div>)}{best.steps.every((s) => s.done) && <div className="xs pos">You covered every step of this route.</div>}</div>
            {rp.unnecessary.length > 0 && <><hr className="rule" /><span className="eyebrow">Hours that bought little</span>{rp.unnecessary.map((u) => <div key={u.title} className="row between xs t2 mt-4"><span className="truncate">{u.title}</span><span className="mono">{u.cost}h</span></div>)}</>}</div></div>
        </div>
      </div>
    </div>
  </div>;
}

function Score({ r, data }) {
  return <div className="grid g12">
    <div className="s8 col" style={{ gap: 14 }}>{data.skillsMeta.map((s) => <div key={s.id} className="panel"><div className="panel-h"><span className="row gap-10"><span className="dot" style={{ background: SKILL_COLOR[s.id], width: 9, height: 9 }} /><b>{s.label}</b><span className="xs muted">{Math.round(s.weight * 100)}% of the score</span></span><span className="mono" style={{ fontSize: 20, color: scoreTone(r.skills[s.id]) }}>{r.skills[s.id]}</span></div>
      <div>{(r.components[s.id] || []).map((x, i) => <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}><div className="row between small"><span>{x.label}</span><span className="mono">{Math.round(x.score * 100)}</span></div><Bar value={x.score * 100} className="thin mt-4" color={SKILL_COLOR[s.id]} /><div className="xs muted mt-4">{x.detail}</div></div>)}</div></div>)}</div>
    <div className="s4 col" style={{ gap: 14 }}>
      <div className="panel"><div className="panel-h"><span className="eyebrow">XP breakdown</span></div><div className="panel-b col" style={{ gap: 7 }}>
        {r.xp.items.map((x) => <div key={x.label} className="row between small"><span className="t2">{x.label}</span><span className="mono">+{x.amount}</span></div>)}
        {r.xp.multipliers.length > 0 && <><hr className="rule" style={{ margin: '4px 0' }} /><div className="row between small"><span className="muted">Subtotal</span><span className="mono">{r.xp.subtotal}</span></div>{r.xp.multipliers.map((m) => <div key={m.label} className="row between small"><span className="t2">{m.label}</span><span className="mono neg">× {m.factor}</span></div>)}</>}
        <hr className="rule" style={{ margin: '4px 0' }} /><div className="row between"><b>Awarded</b><span className="mono acc" style={{ fontSize: 18 }}>+{r.xp.total} XP</span></div></div></div>
      {r.override && <div className="callout info"><b>Score adjusted to {r.override.score} by {r.override.by}.</b><br />{r.override.note}</div>}
      <div className="panel"><div className="panel-h"><span className="eyebrow">Strengths</span></div><div className="panel-b col" style={{ gap: 10 }}>{r.strengths.length ? r.strengths.map((x, i) => <div key={i}><div className="row gap-6 small"><Icon name="check" size={13} className="pos" /><b>{x.label}</b></div><div className="xs muted mt-4">{x.detail}</div></div>) : <div className="small muted">No component scored above 80 this time.</div>}</div></div>
      <div className="panel"><div className="panel-h"><span className="eyebrow">Weaknesses</span></div><div className="panel-b col" style={{ gap: 10 }}>{r.weaknesses.length ? r.weaknesses.map((x, i) => <div key={i}><div className="row gap-6 small"><Icon name="minus" size={13} className="neg" /><b>{x.label}</b></div><div className="xs muted mt-4">{x.detail}</div></div>) : <div className="small muted">No major component scored below 50.</div>}</div></div>
      <div className="panel"><div className="panel-h"><span className="eyebrow">What to do differently</span></div><div className="panel-b col" style={{ gap: 10 }}>{r.suggestions.map((x, i) => <div key={i} className="row gap-10 small" style={{ alignItems: 'flex-start' }}><span className="mono acc">{i + 1}</span><span className="t2">{x}</span></div>)}</div></div>
      <p className="xs muted">Arithmetic, budget, evidence access and confidence are checked in code. Written reasoning is scored against anchored rubrics{data.defence?.done.some((d) => d.mode.includes('AI')) ? ', with AI assistance on the boardroom answers' : ''}. A professor can review and override.</p>
    </div>
  </div>;
}

function Compare({ r }) {
  const yours = r.replay.timeline.filter((x) => ['data', 'interview', 'calc', 'recommend'].includes(x.kind) && x.title && !x.title.startsWith('Miscalculated') && !x.title.startsWith('Ran a'));
  const label = (t) => t.replace(/^(Requested|Interviewed|Calculated|Recommended): /, '').replace(/ disclosed:.*/, '');
  return <div className="panel mb-16"><div className="panel-h"><span className="eyebrow acc">Route comparison</span><span className="xs muted">your sequence vs each expert route</span></div>
    <div className="panel-b col" style={{ gap: 18, overflowX: 'auto' }}>
      {[{ name: 'Your investigation', nodes: yours.map((x) => ({ label: label(x.title), done: true, v: x.verdict, kind: x.kind })) }, ...r.replay.paths.map((p) => ({ name: p.name, match: p.match, nodes: p.steps.filter((s) => s.type !== 'hypothesis' && s.type !== 'update').map((s) => ({ label: s.label, done: s.done, kind: s.type === 'data' ? 'data' : s.type === 'interview' ? 'interview' : s.type === 'calc' ? 'calc' : 'recommend' })) }))].map((row, ri) =>
        <div key={row.name} className="row gap-16" style={{ alignItems: 'flex-start', minWidth: 'max-content' }}>
          <div style={{ width: 170, flex: 'none' }}><div style={{ fontWeight: 600 }} className={ri === 0 ? 'acc' : ''}>{row.name}</div>{row.match != null && <div className="xs muted">{row.match}% overlap with you</div>}</div>
          <div className="row" style={{ gap: 0, alignItems: 'flex-start' }}>{row.nodes.map((n, k) => <React.Fragment key={k}>{k > 0 && <span style={{ width: 18, height: 1.5, background: 'var(--line-hi)', marginTop: 13 }} />}
            <Tip label={n.label}><motion.div className="col" style={{ alignItems: 'center', gap: 4, width: 62 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ri * 0.15 + k * 0.04 }}>
              <span className="avatar" style={{ width: 28, height: 28, color: ri === 0 ? (n.v === 'waste' ? 'var(--warn)' : n.v === 'missed' ? 'var(--neg)' : 'var(--accent)') : n.done ? 'var(--pos)' : 'var(--muted)', borderColor: ri === 0 ? 'var(--accent-line)' : n.done ? 'var(--pos)' : 'var(--line-2)', background: ri > 0 && n.done ? 'var(--pos-soft)' : undefined, borderStyle: ri > 0 && !n.done ? 'dashed' : 'solid' }}><Icon name={KIND_ICON[n.kind]} size={12} /></span>
              <span className="xs t2" style={{ textAlign: 'center', lineHeight: 1.2, maxWidth: 62, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: 10 }}>{n.label}</span></motion.div></Tip></React.Fragment>)}</div></div>)}
      <div className="xs muted">Expert-route nodes are solid where your investigation included the step, dashed where it did not.</div>
    </div></div>;
}
function Paths({ r }) {
  return <div><Compare r={r} /><p className="t2 mb-16" style={{ maxWidth: 720 }}>There is more than one defensible way through this case. These are two. A tick means your investigation included that step.</p>
    <div className="grid g2">{r.replay.paths.map((p) => <div key={p.id} className="panel"><div className="panel-h"><div><b>{p.name}</b><div className="xs muted mt-4">{p.summary}</div></div><div className="kpi" style={{ alignItems: 'flex-end' }}><span className="v" style={{ fontSize: 22, color: scoreTone(p.match) }}>{p.match}%</span><span className="xs muted">overlap</span></div></div>
      <div className="panel-b">{p.steps.map((s, i) => <div key={i} className="path-step"><span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: s.done ? 'var(--pos-soft)' : 'transparent', color: s.done ? 'var(--pos)' : 'var(--faint)', borderColor: s.done ? 'transparent' : 'var(--line-2)' }}>{s.done ? '✓' : i + 1}</span><div><div className="small" style={{ fontWeight: 500 }}><span className="eyebrow" style={{ marginRight: 6 }}>{s.type}</span>{s.label}</div>{s.why && <div className="xs muted mt-4">{s.why}</div>}</div></div>)}</div></div>)}</div></div>;
}

function Debrief({ r, data }) {
  const d = r.replay.debrief; const rec = data.recommendation;
  return <div className="grid g12">
    <div className="s7"><div className="eyebrow acc mb-8">What was actually happening</div><h1 style={{ fontSize: 28 }}>{d.headline}</h1><div className="memo mt-16" style={{ fontSize: 16 }}>{d.narrative.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div className="panel pad mt-24"><div className="eyebrow mb-12">What this case teaches</div>{d.lessons.map((l, i) => <div key={i} className="row gap-10 mb-8" style={{ alignItems: 'flex-start' }}><span className="mono acc">{i + 1}</span><span>{l}</span></div>)}</div></div>
    <div className="s5 col" style={{ gap: 14 }}>
      <div className="panel pad"><div className="eyebrow mb-12">The numbers that mattered</div><div className="col" style={{ gap: 10 }}>{d.keyNumbers.map((k) => <div key={k.label} className="row between"><span className="small t2">{k.label}</span><span className="mono acc">{k.value}</span></div>)}</div></div>
      {rec && <div className="panel"><div className="panel-h"><span className="eyebrow">Your recommendation</span><span className="chip">{rec.optionLabel}</span></div><div className="panel-b small t2 col" style={{ gap: 10 }}><div><span className="eyebrow">Diagnosis</span><p className="mt-4">{rec.diagnosis}</p></div>{r.diagnosis ? <div className="callout pos">Recognised as: {r.diagnosis.label}</div> : <div className="callout neg">Your lead hypotheses did not map to a diagnosis the evidence supports.</div>}<div><span className="eyebrow">Expected impact</span><p className="mono mt-4" style={{ color: 'var(--text)' }}>{rec.impact} {data.case.currency === '$' ? '$M' : '₹ cr'} / year</p></div><div><span className="eyebrow">Hypotheses at close</span>{data.hypotheses.map((h) => <div key={h.id} className="row between mt-4"><span className="truncate">{h.driverLabel}</span><span className="mono">{h.final}</span></div>)}</div></div></div>}
      {data.defence?.twist && <div className="panel pad small"><div className="eyebrow mb-8">On the twist</div><b>{data.defence.twist.stanceLabel}</b><p className="t2 mt-4">{data.defence.twist.note}</p></div>}
    </div>
  </div>;
}
