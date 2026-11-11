import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { post } from '../api.js';
import { useAuth } from '../App.jsx';
import { Bar, CountUp, DemoTag, Empty, ErrorState, Icon, PageSkeleton, RankEmblem, scoreTone, Skeleton, useApi, useToast } from '../components/ui.jsx';
import { LineChart, PALETTE, Ring, Waterfall } from '../components/charts.jsx';

const MODE_ICON = { daily: 'daily', 'issue-tree': 'tree', margin: 'search', duel: 'scale', blitz: 'bolt', market: 'chess' };

export function Arena() {
  const { data: d, loading, error, reload } = useApi('/games'); const nav = useNavigate();
  const { data: ch, reload: reCh } = useApi('/challenges'); const toast = useToast();
  if (loading) return <PageSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  const t = d.tournament;
  return (
    <div className="page">
      <div className="page-h"><div><div className="eyebrow mb-8">Arena</div><h1>Short drills, real skills</h1><p className="t2 mt-8">Each mode trains named skills and feeds the same ratings as full cases. XP is paid in full on the first play of the day and tapers after, so repetition is for practice, not points.</p></div></div>
      <div className="grid g3 stagger">{d.modes.map((m) => <article key={m.id} className={`panel ${m.locked ? '' : 'hover'}`} onClick={() => !m.locked && nav(m.id === 'daily' ? '/daily' : `/arena/${m.id}`)} style={m.locked ? { opacity: 0.62 } : null}>
        <div className="panel-b col" style={{ height: '100%' }}>
          <div className="row between"><span className="avatar" style={{ width: 36, height: 36, background: 'var(--accent-soft)', borderColor: 'transparent', color: 'var(--accent)' }}><Icon name={MODE_ICON[m.id]} size={18} /></span>{m.locked ? <span className="chip"><Icon name="lock" size={11} />{m.minRankName}</span> : m.best != null ? <span className="chip">Best <b className="mono" style={{ color: scoreTone(m.best) }}>{m.best}</b></span> : <span className="chip acc">New</span>}</div>
          <h2 style={{ fontSize: 20 }}>{m.name}</h2><p className="small t2" style={{ flex: 1 }}>{m.tagline}</p>
          <div className="row wrap gap-6">{m.skillLabels.map((s) => <span key={s} className="chip line">{s}</span>)}</div>
          <div className="row between xs muted"><span className="row gap-4"><Icon name="clock" size={12} />{m.minutes} min</span><span>{m.playsToday === 0 ? <span className="acc mono">up to +{m.xp} XP</span> : m.playsToday < 3 ? `reduced XP today (${m.playsToday} played)` : 'practice only today'}</span></div>
        </div></article>)}</div>

      <div className="grid g12 mt-24">
        <div className="panel s5"><div className="panel-h"><span className="eyebrow">Weekly tournament</span><span className="xs muted">ends {new Date(t.endsAt).toLocaleDateString('en-GB', { weekday: 'long' })}</span></div><div className="panel-b">
          <div className="xs muted">{t.company}</div><h2 className="mt-4" style={{ fontSize: 20 }}>{t.title}</h2><p className="small t2 mt-8">One case, one week. Your best completed score counts; top ten earn +{t.bonusXp} XP at the close. Open from Gold.</p>
          <table className="table mt-12"><tbody>{t.top.map((r) => <tr key={r.userId} className={r.you ? 'you' : ''}><td className="n muted" style={{ width: 30 }}>{r.pos}</td><td><span className="row gap-6"><span className="truncate">{r.name}</span>{r.demo && !r.you && <DemoTag />}<RankEmblem rank={r.rank} size={15} /></span></td><td className="n">{r.value}</td></tr>)}
            {t.you && !t.top.some((r) => r.you) && <tr className="you"><td className="n muted">{t.you.value ? t.you.pos : '—'}</td><td>You</td><td className="n">{t.you.value || 'not entered'}</td></tr>}</tbody></table>
          <button className="btn primary mt-12" onClick={() => nav(`/vault?open=${t.caseId}`)}>{t.entered ? 'Improve your score' : 'Enter tournament'}</button></div></div>
        <div className="panel s4"><div className="panel-h"><span className="eyebrow">{d.season.name}</span><span className="mono small">{d.season.complete}/{d.season.quests.length}</span></div><div className="panel-b col" style={{ gap: 12 }}>
          {d.season.quests.map((q) => <div key={q.label}><div className="row between small"><span className="row gap-6" style={{ color: q.done ? 'var(--text)' : 'var(--text-2)' }}><Icon name={q.done ? 'check' : 'minus'} size={13} className={q.done ? 'pos' : 'muted'} />{q.label}</span><span className="mono xs muted">{Math.min(q.cur, q.target)}/{q.target}</span></div><Bar value={q.cur} max={q.target} className="thin mt-4" color={q.done ? 'var(--pos)' : undefined} /></div>)}
          <p className="xs muted">Season ends {new Date(d.season.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. Quests reward how you investigate, not how often you log in.</p></div></div>
        <div className="panel s3"><div className="panel-h"><span className="eyebrow">Challenges</span></div><div className="panel-b col" style={{ gap: 12 }}>
          {!ch ? <Skeleton h={80} /> : ch.challenges.length === 0 ? <div className="small muted">No challenges yet. Open a learner's profile from any leaderboard to challenge them on a case you have completed.</div> : ch.challenges.map((x) => <div key={x.id} className="small"><div className="row gap-6"><Icon name="swords" size={13} className="acc" /><b>{x.direction === 'received' ? x.from.name : `You → ${x.to.name}`}</b>{x.demoOpponent && <DemoTag />}</div>
            <div className="t2 mt-4">{x.caseTitle}</div><div className="row between mt-4"><span className="xs muted">Score to beat <b className="mono" style={{ color: 'var(--text)' }}>{x.bar}</b></span>{x.status === 'open' ? (x.direction === 'received' ? <button className="btn sm" onClick={() => nav(`/vault?open=${x.caseId}`)}>Accept</button> : <span className="chip">{x.demoOpponent ? 'Demo users do not respond' : 'Waiting'}</span>) : <span className={`chip ${(x.status === 'beaten') === (x.direction === 'received') ? 'pos' : 'neg'}`}>{x.status === 'beaten' ? `Beaten with ${x.answer}` : `Defended (${x.answer})`}</span>}</div></div>)}
          <Link to="/leaderboards" className="xs acc">Find someone to challenge →</Link></div></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shared play frame
function Frame({ mode, title, sub, children, onRestart }) {
  return <div className="page" style={{ maxWidth: 1040 }}><div className="page-h"><div><Link to="/arena" className="xs muted row gap-4 mb-8"><Icon name="back" size={12} />Arena</Link><div className="eyebrow acc mb-8">{title}</div>{sub && <h1 style={{ fontSize: 26 }}>{sub}</h1>}</div>{onRestart && <button className="btn sm" onClick={onRestart}><Icon name="replay" size={13} />New puzzle</button>}</div>{children}</div>;
}
function Result({ res, onAgain, children }) {
  const ap = res.applied;
  return <div style={{ animation: 'rise 0.4s var(--ease)' }}>
    <div className="panel pad row gap-24 wrap mb-16"><Ring value={res.score} size={104} color={scoreTone(res.score)}><div><div className="mono" style={{ fontSize: 30, lineHeight: 1 }}><CountUp value={res.score} /></div><div className="xs muted">/ 100</div></div></Ring>
      <div className="grow"><div className="row gap-16 wrap"><div className="kpi"><span className="eyebrow">XP earned</span><span className="v acc">+{ap.earned + ap.streakBonus}</span></div>{ap.streakBonus > 0 && <div className="kpi"><span className="eyebrow">Streak</span><span className="v row gap-6"><Icon name="flame" size={18} style={{ color: 'var(--warn)' }} />{ap.streak} days</span></div>}
        {ap.deltas.map((d) => { const ch = Math.round((d.after - d.before) * 10) / 10; return <div key={d.skill} className="kpi"><span className="eyebrow">{d.label}</span><span className="v" style={{ fontSize: 20 }}>{Math.round(d.after)} <span className={`xs ${ch >= 0 ? 'pos' : 'neg'}`}>{ch >= 0 ? '+' : ''}{ch}</span></span></div>; })}</div>
        <p className="xs muted mt-12">{ap.factor === 1 ? 'First play of this mode today: full XP.' : ap.factor > 0 ? `Play ${ap.plays} of this mode today: XP at ${Math.round(ap.factor * 100)}%.` : 'Fourth or later play today: practice only, no XP.'}{ap.achievements.map((a) => ` Achievement: ${a.name}.`)}</p></div>
      <div className="col"><button className="btn primary" onClick={onAgain}>Play another</button><Link to="/arena" className="btn">Back to Arena</Link></div></div>
    {res.feedback.parts && <div className="panel mb-16"><div className="panel-h"><span className="eyebrow">How this was scored</span></div>{res.feedback.parts.map((p) => <div key={p.label} style={{ padding: '9px 16px', borderBottom: '1px solid var(--line)' }}><div className="row between small"><span>{p.label} <span className="muted xs">· {p.weight}%</span></span><span className="mono">{p.score}</span></div><Bar value={p.score} className="thin mt-4" color={scoreTone(p.score)} /></div>)}</div>}
    {children}</div>;
}
function useGame(mode) {
  const [p, setP] = useState(null); const [err, setErr] = useState(null); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const n = useRef(0); const { refresh } = useAuth(); const toast = useToast();
  const start = () => { setP(null); setRes(null); setErr(null); post(`/games/${mode}/start`, { n: n.current++ }).then((d) => setP(d.puzzle)).catch(setErr); };
  useEffect(start, [mode]); // eslint-disable-line
  const submit = async (answer) => { setBusy(true); try { const d = await post(`/games/${mode}/submit`, { sessionId: p.sessionId, answer }); setRes(d); refresh(); } catch (e) { toast(e.message, 'bad'); } setBusy(false); };
  const step = (body) => post(`/games/${mode}/step`, { sessionId: p.sessionId, ...body });
  return { p, err, res, busy, start, submit, step, toast };
}

export function Daily() { return <DailyGame />; }
export function Play() {
  const { mode } = useParams();
  const G = { 'issue-tree': IssueTree, margin: Margin, duel: Duel, blitz: Blitz, market: Market, daily: DailyGame }[mode];
  return G ? <G /> : <Navigate to="/arena" replace />;
}
const Guard = ({ g, title, children }) => (g.err ? <Frame title={title}><div className="panel"><Empty icon="lock" title={g.err.message} action={<Link className="btn sm mt-8" to="/arena">Back to Arena</Link>} /></div></Frame> : !g.p ? <PageSkeleton /> : children);

// ------------------------------------------------------------------ Daily Diagnostic
function AllocRow({ items, alloc, setAlloc, disabled, truth }) {
  const total = items.reduce((s, h) => s + (alloc[h.id] || 0), 0);
  return <div className="col" style={{ gap: 10 }}>{items.map((h, i) => <div key={h.id}><div className="row between small"><span><span className="mono muted" style={{ marginRight: 6 }}>{String.fromCharCode(65 + i)}</span>{h.text}</span><span className="mono" style={{ fontSize: 15 }}>{alloc[h.id] || 0}{truth && <span className="muted xs"> / {truth[h.id]}</span>}</span></div>
    <input type="range" className="mt-8" min="0" max="100" step="5" disabled={disabled} value={alloc[h.id] || 0} onChange={(e) => setAlloc({ ...alloc, [h.id]: Number(e.target.value) })} aria-label={`Confidence in ${h.text}`} />{truth && <div className="bar thin mt-4"><i style={{ width: `${truth[h.id]}%`, background: 'var(--pos)' }} /></div>}</div>)}
    <div className="row between small"><span className="muted">{truth ? 'Your allocation / evidence-weighted view' : 'Allocate exactly 100 points'}</span><span className="mono" style={{ color: total === 100 ? 'var(--pos)' : 'var(--neg)' }}>{total} / 100</span></div></div>;
}
function DailyGame() {
  const g = useGame('daily'); const [alloc, setAlloc] = useState({}); const [clue, setClue] = useState(null); const [dec, setDec] = useState(''); const [phase, setPhase] = useState(0);
  useEffect(() => { if (g.p) { const n = g.p.hyps.length; setAlloc(Object.fromEntries(g.p.hyps.map((h) => [h.id, 100 / n]))); setClue(null); setDec(''); setPhase(0); } }, [g.p]);
  const total = g.p ? g.p.hyps.reduce((s, h) => s + (alloc[h.id] || 0), 0) : 0;
  return <Guard g={g} title="Daily Diagnostic">{g.p && <Frame title={`Daily Diagnostic · ${g.p.day}`} sub={g.p.title}>
    {g.res ? <Result res={g.res} onAgain={g.start}><div className="grid g2"><div className="panel pad"><div className="eyebrow mb-12">Confidence vs the evidence</div><AllocRow items={g.p.hyps} alloc={alloc} setAlloc={() => {}} disabled truth={g.res.feedback.truth} /></div>
      <div className="panel pad"><div className="eyebrow mb-8">Debrief</div><p>{g.res.feedback.explain}</p><div className="callout pos mt-12 small"><b>Most diagnostic look:</b> {g.res.feedback.bestClue}</div><div className="callout mt-8 small"><b>Strongest decision:</b> {g.res.feedback.bestDecision}</div>
        <div className="eyebrow mt-16 mb-8">What each look would have shown</div>{g.res.feedback.clues.map((c) => <div key={c.id} className="small t2 mb-8"><b style={{ color: 'var(--text)' }}>{c.label}.</b> {c.text}</div>)}</div></div></Result>
    : <div className="grid g12"><div className="s7 col" style={{ gap: 14 }}>
        <div className="panel pad"><div className="eyebrow mb-8">Situation</div><p className="memo" style={{ fontSize: 17 }}>{g.p.scenario}</p></div>
        <div className="panel pad"><div className="row between mb-12"><span className="eyebrow">1 · {phase === 0 ? 'Where is your confidence?' : 'Update your confidence'}</span></div><AllocRow items={g.p.hyps} alloc={alloc} setAlloc={setAlloc} />
          {phase === 0 && <button className="btn primary mt-12" disabled={total !== 100} onClick={() => setPhase(1)}>Lock opening view</button>}</div></div>
      <div className="s5 col" style={{ gap: 14 }}>
        <div className="panel pad" style={{ opacity: phase >= 1 ? 1 : 0.45 }}><div className="eyebrow mb-8">2 · You may look at one thing</div>{clue ? <div className="callout" style={{ animation: 'rise 0.3s' }}><b>{clue.label}</b><p className="mt-4">{clue.text}</p></div> : <div className="col" style={{ gap: 6 }}>{g.p.clues.map((c) => <button key={c.id} className="ds" disabled={phase < 1} onClick={() => g.step({ clueId: c.id }).then((d) => { setClue(d.clue); setPhase(2); }).catch((e) => g.toast(e.message, 'bad'))}><span>{c.label}</span><Icon name="arrow" size={13} className="muted" /></button>)}</div>}</div>
        <div className="panel pad" style={{ opacity: phase >= 2 ? 1 : 0.45 }}><div className="eyebrow mb-8">3 · What do you do?</div><div className="col" style={{ gap: 6 }}>{g.p.decisions.map((d) => <label key={d.id} className={`ds ${dec === d.id ? 'on' : ''}`} style={{ cursor: 'pointer' }}><span className="row gap-10"><input type="radio" disabled={phase < 2} checked={dec === d.id} onChange={() => setDec(d.id)} /><span className="small">{d.text}</span></span></label>)}</div>
          <button className="btn primary mt-12" style={{ width: '100%' }} disabled={g.busy || phase < 2 || !dec || total !== 100} onClick={() => g.submit({ alloc, decision: dec })}>Submit diagnosis</button>{phase >= 2 && total !== 100 && <p className="xs neg mt-8">Confidence must total 100.</p>}</div></div></div>}
  </Frame>}</Guard>;
}

// ------------------------------------------------------------------ Issue Tree Arena
let nid = 1;
function IssueTree() {
  const g = useGame('issue-tree'); const [nodes, setNodes] = useState([]); const [drag, setDrag] = useState(null); const [over, setOver] = useState(null);
  useEffect(() => { if (g.p) setNodes([{ id: 'root', parentId: null, label: g.p.root }]); }, [g.p]);
  const kids = (id) => nodes.filter((n) => n.parentId === id);
  const isDesc = (id, anc) => { let n = nodes.find((x) => x.id === id); while (n) { if (n.parentId === anc) return true; n = nodes.find((x) => x.id === n.parentId); } return false; };
  const add = (pid) => setNodes((ns) => [...ns, { id: `n${nid++}`, parentId: pid, label: '', fresh: true }]);
  const remove = (id) => setNodes((ns) => ns.filter((n) => n.id !== id && !isDescIn(ns, n.id, id)));
  const isDescIn = (ns, id, anc) => { let n = ns.find((x) => x.id === id); while (n) { if (n.parentId === anc) return true; n = ns.find((x) => x.id === n.parentId); } return false; };
  const drop = (target) => { if (drag && drag !== target && !isDesc(target, drag) && drag !== 'root') setNodes((ns) => ns.map((n) => (n.id === drag ? { ...n, parentId: target } : n))); setDrag(null); setOver(null); };
  const prioCount = nodes.filter((n) => n.priority).length;
  const renderNode = (n, depth) => <li key={n.id}>
    <div className={`tnode ${over === n.id ? 'over' : ''} ${n.priority ? 'prio' : ''}`} draggable={n.id !== 'root' && !g.res} onDragStart={(e) => { setDrag(n.id); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { e.preventDefault(); setOver(n.id); }} onDragLeave={() => setOver((o) => (o === n.id ? null : o))} onDrop={(e) => { e.preventDefault(); drop(n.id); }}>
      {n.id === 'root' ? <b className="small" style={{ padding: '3px 4px' }}>{n.label}</b> : <input value={n.label} autoFocus={n.fresh} disabled={!!g.res} placeholder={depth === 1 ? 'Branch…' : 'Sub-issue…'} onChange={(e) => setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, label: e.target.value, fresh: false } : x)))} onKeyDown={(e) => { if (e.key === 'Enter') add(n.parentId); if (e.key === 'Tab') { e.preventDefault(); add(n.id); } }} aria-label="Issue label" />}
      {!g.res && <>{depth < 3 && <button className="btn ghost sm icon" title="Add sub-issue (Tab)" onClick={() => add(n.id)}><Icon name="plus" size={13} /></button>}
        {n.id !== 'root' && <><button className="btn ghost sm icon" title="Flag as a priority to investigate first" style={n.priority ? { color: 'var(--accent)' } : null} onClick={() => (n.priority || prioCount < 3) && setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, priority: !x.priority } : x)))}><Icon name="star" size={13} /></button><button className="btn ghost sm icon" title="Remove" onClick={() => remove(n.id)}><Icon name="x" size={13} /></button></>}</>}</div>
    {kids(n.id).length > 0 && <ul>{kids(n.id).map((k) => renderNode(k, depth + 1))}</ul>}</li>;
  const fb = g.res?.feedback;
  return <Guard g={g} title="Issue Tree Arena">{g.p && <Frame title="Issue Tree Arena" sub={g.p.prompt} onRestart={!g.res ? g.start : null}>
    {g.res && <Result res={g.res} onAgain={g.start}><div className="grid g2"><div className="panel pad"><div className="eyebrow mb-8">Logic notes</div>{fb.issues.length ? fb.issues.map((x, i) => <div key={i} className="row gap-6 small t2 mb-8" style={{ alignItems: 'flex-start' }}><Icon name="minus" size={13} className="neg" style={{ marginTop: 3, flex: 'none' }} />{x}</div>) : <div className="small pos">No structural issues found.</div>}
      <div className="eyebrow mt-16 mb-8">Covered</div><div className="row wrap gap-6">{fb.matched.map((x) => <span key={x} className="chip pos">{x}</span>)}</div><div className="eyebrow mt-16 mb-8">Not covered</div><div className="row wrap gap-6">{fb.missed.map((x) => <span key={x} className="chip">{x}</span>)}{!fb.missed.length && <span className="small muted">Nothing material.</span>}</div></div>
      <div className="panel pad"><div className="eyebrow mb-8">One strong reference structure</div><div className="tree"><ul><li><div className="tnode"><b className="small" style={{ padding: '3px 4px' }}>{fb.reference.root}</b></div><ul>{fb.reference.nodes.filter((n) => !n.parent).map((n) => <li key={n.id}><div className={`tnode ${n.priority ? 'prio' : ''}`}><span className="small" style={{ padding: '3px 4px' }}>{n.label}</span></div><ul>{fb.reference.nodes.filter((k) => k.parent === n.id).map((k) => <li key={k.id}><div className={`tnode ${k.priority ? 'prio' : ''}`}><span className="small" style={{ padding: '3px 4px' }}>{k.label}{k.priority && <Icon name="star" size={11} className="acc" style={{ marginLeft: 6, verticalAlign: -1 }} />}</span></div></li>)}</ul></li>)}</ul></li></ul></div><p className="xs muted mt-12">Other structures can be equally valid. Labels are matched on meaning, not exact wording.</p></div></div></Result>}
    <div className="grid g12 mt-16"><div className="s8 panel"><div className="panel-h"><span className="eyebrow">{g.res ? 'Your tree' : 'Build your tree'}</span><span className="xs muted">{nodes.length - 1} nodes · {prioCount}/3 priorities flagged</span></div><div className="panel-b tree scroll-x" style={{ minHeight: 280 }}><ul>{renderNode(nodes[0] || { id: 'root', label: '' }, 0)}</ul></div></div>
      <div className="s4 col" style={{ gap: 14 }}><div className="panel pad small t2"><div className="eyebrow mb-8">How to build</div><ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}><li><b>+</b> adds a sub-issue; <b>Enter</b> adds a sibling; <b>Tab</b> adds a child.</li><li>Drag a node onto another to move it.</li><li><b>★</b> flags up to three branches you would investigate first.</li></ul>
        <div className="eyebrow mt-16 mb-8">Scored on</div><ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}><li>MECE: siblings do not overlap, and together cover the parent</li><li>Hierarchy: issues sit under the right parent</li><li>Completeness and depth</li><li>Prioritisation</li></ul></div>
        {!g.res && <button className="btn primary lg" disabled={g.busy || nodes.filter((n) => n.label.trim()).length < 4} onClick={() => g.submit({ nodes: nodes.filter((n) => n.id === 'root' || n.label.trim()).map(({ id, parentId, label, priority }) => ({ id, parentId, label, priority })) })}>Submit tree for review</button>}</div></div>
  </Frame>}</Guard>;
}

// ------------------------------------------------------------------ Margin Detective
function Margin() {
  const g = useGame('margin'); const [probed, setProbed] = useState({}); const [left, setLeft] = useState(4); const [top, setTop] = useState(''); const [second, setSecond] = useState(''); const [est, setEst] = useState('');
  useEffect(() => { if (g.p) { setProbed({}); setLeft(g.p.probes); setTop(''); setSecond(''); setEst(''); } }, [g.p]);
  const probe = (id) => g.step({ driverId: id }).then((d) => { setProbed((p) => ({ ...p, [id]: d.probe.effect })); setLeft(d.left); }).catch((e) => g.toast(e.message, 'bad'));
  return <Guard g={g} title="Margin Detective">{g.p && (() => { const p = g.p; const fb = g.res?.feedback;
    const items = [{ label: 'Prior-year profit', value: p.from, total: true }, ...(fb ? fb.bridge : p.drivers).map((d) => ({ id: d.id, label: d.label, value: fb ? d.effect : probed[d.id] ?? 0, hidden: !fb && !(d.id in probed) })), { label: 'This-year profit', value: p.to, total: true }];
    const known = Object.values(probed).reduce((s, v) => s + v, 0);
    return <Frame title="Margin Detective" sub={`${p.company}: operating profit ${p.from} → ${p.to} ${p.unit}`} onRestart={!g.res ? g.start : null}>
      {g.res && <Result res={g.res} onAgain={g.start}><div className="callout mb-16"><b>What happened.</b> {fb.lesson}</div></Result>}
      <div className="grid g12"><div className="s8 panel"><div className="panel-h"><span className="eyebrow">Profit bridge</span>{!g.res && <span className="chip acc">{left} probe{left === 1 ? '' : 's'} left</span>}</div><div className="panel-b"><p className="small t2 mb-12">{p.context} Revenue {p.revFrom} → {p.revTo} {p.unit}. {!g.res && 'Click a hidden bar to spend a probe on it.'}</p>
        <Waterfall items={items} unit={p.unit} height={270} onPick={(b) => !g.res && b.hidden && left > 0 && probe(b.id)} />
        {!g.res && <div className="row between small mt-8"><span className="muted">Explained so far</span><span className="mono">{known > 0 ? '+' : ''}{known} of {p.to - p.from} {p.unit}</span></div>}</div></div>
        <div className="s4 col" style={{ gap: 14 }}>{!g.res ? <div className="panel pad"><div className="eyebrow mb-12">Your verdict</div>
          <div className="field mb-12"><label>Largest driver of the change</label><select className="select" value={top} onChange={(e) => setTop(e.target.value)}><option value="">Choose…</option>{p.drivers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
          <div className="field mb-12"><label>Second largest</label><select className="select" value={second} onChange={(e) => setSecond(e.target.value)}><option value="">Choose…</option>{p.drivers.filter((d) => d.id !== top).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
          <div className="field mb-12"><label>Size of the largest driver ({p.unit}, signed)</label><input className="input num" inputMode="decimal" value={est} onChange={(e) => setEst(e.target.value)} placeholder="e.g. -15" /></div>
          <button className="btn primary" style={{ width: '100%' }} disabled={g.busy || !top || !second || est === ''} onClick={() => g.submit({ top, second, estimate: Number(est) })}>Submit verdict</button>
          <p className="xs muted mt-12">Seven possible drivers, four probes. Use the unexplained remainder to reason about what you have not looked at.</p></div>
          : <div className="panel pad"><div className="eyebrow mb-8">Full bridge</div>{fb.bridge.map((d) => <div key={d.id} className="row between small" style={{ padding: '4px 0' }}><span className="row gap-6 t2">{d.probed && <Icon name="search" size={11} className="acc" />}{d.label}</span><span className={`mono ${d.effect >= 0 ? 'pos' : 'neg'}`}>{d.effect > 0 ? '+' : ''}{d.effect}</span></div>)}</div>}</div></div>
    </Frame>; })()}</Guard>;
}

// ------------------------------------------------------------------ Hypothesis Duel
function Duel() {
  const g = useGame('duel'); const [i, setI] = useState(0); const [p, setP] = useState(50); const [path, setPath] = useState([]); const [pick, setPick] = useState('');
  useEffect(() => { if (g.p) { setI(0); setP(50); setPath([]); setPick(''); } }, [g.p]);
  return <Guard g={g} title="Hypothesis Duel">{g.p && (() => { const d = g.p; const n = d.cards.length; const fb = g.res?.feedback; const done = path.length === n;
    return <Frame title="Hypothesis Duel" sub={d.scenario} onRestart={!g.res ? g.start : null}>
      {g.res && <Result res={g.res} onAgain={g.start}><div className="grid g2"><div className="panel pad"><div className="eyebrow mb-8">Your confidence in A vs a Bayesian reference</div><LineChart categories={['Start', ...d.cards.map((_, k) => `E${k + 1}`)]} series={[{ label: 'You', values: [50, ...fb.yours] }, { label: 'Reference', values: [50, ...fb.reference], dashed: true, color: 'var(--c2)' }]} yMax={100} area={false} unit="%" height={200} /><div className="row gap-16 xs t2 mt-4"><span className="row gap-6"><span className="dot" style={{ background: PALETTE[0] }} />You</span><span className="row gap-6"><span className="dot" style={{ background: 'var(--c2)' }} />Reference</span></div></div>
        <div className="panel pad"><div className="eyebrow mb-8">What each piece of evidence was worth</div>{fb.strengths.map((s, k) => <div key={k} className="small mb-8"><span className={`chip ${s.strength === 'strong' ? 'acc' : ''}`} style={{ marginRight: 6 }}>{s.strength} for {s.favours}</span><span className="t2">{s.text}</span></div>)}<div className="callout pos mt-12">The evidence favours hypothesis <b>{fb.verdict}</b>.</div></div></div></Result>}
      <div className="grid g2 mb-16">{[['A', d.A, 'var(--c1)'], ['B', d.B, 'var(--c4)']].map(([k, t, col]) => <div key={k} className="panel pad" style={{ borderTop: `2px solid ${col}` }}><div className="eyebrow mb-8" style={{ color: col }}>Hypothesis {k}</div><p style={{ fontSize: 15 }}>{t}</p></div>)}</div>
      {!g.res && <div className="grid g12"><div className="s7 panel"><div className="panel-h"><span className="eyebrow">Evidence</span><span className="mono xs muted">{Math.min(i + 1, n)} / {n}</span></div><div className="panel-b col" style={{ gap: 8 }}>{d.cards.slice(0, i + 1).map((c, k) => <div key={k} className="panel pad small" style={{ background: k === i && !done ? 'var(--accent-soft)' : 'var(--bg-2)', animation: 'rise 0.3s', padding: '10px 12px' }}><span className="mono muted" style={{ marginRight: 8 }}>E{k + 1}</span>{c}{path[k] != null && <span className="mono xs muted" style={{ float: 'right' }}>you: {path[k]}% A</span>}</div>)}</div></div>
        <div className="s5 panel pad"><div className="eyebrow mb-12">{done ? 'Final verdict' : `After evidence ${i + 1}, how likely is A?`}</div>
          {!done ? <><div className="row between"><span className="small" style={{ color: 'var(--c4)' }}>B certain</span><span className="mono" style={{ fontSize: 30 }}>{p}%</span><span className="small" style={{ color: 'var(--c1)' }}>A certain</span></div><input type="range" className="mt-12" min="0" max="100" step="1" value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Probability of A" />
            <button className="btn primary mt-16" style={{ width: '100%' }} onClick={() => { setPath([...path, p]); if (i < n - 1) setI(i + 1); }}>{i < n - 1 ? 'Lock in and see next evidence' : 'Lock in'}</button><p className="xs muted mt-12">Move as far as the evidence warrants and no further. Weak evidence should move you a little; decisive evidence a lot.</p></>
          : <><div className="row">{['A', 'B'].map((k) => <button key={k} className={`btn lg grow ${pick === k ? 'primary' : ''}`} onClick={() => setPick(k)}>Hypothesis {k}</button>)}</div><button className="btn primary mt-16" style={{ width: '100%' }} disabled={g.busy || !pick} onClick={() => g.submit({ path, pick })}>Submit</button></>}</div></div>}
    </Frame>; })()}</Guard>;
}

// ------------------------------------------------------------------ Boardroom Blitz
function Blitz() {
  const g = useGame('blitz'); const [i, setI] = useState(0); const [picks, setPicks] = useState({}); const [t, setT] = useState(45); const [go, setGo] = useState(false);
  useEffect(() => { if (g.p) { setI(0); setPicks({}); setT(g.p.seconds); setGo(false); } }, [g.p]);
  const next = (choice) => { const r = g.p.rounds[i]; const np = { ...picks, [r.id]: choice }; setPicks(np); if (i < g.p.rounds.length - 1) { setI(i + 1); setT(g.p.seconds); } else { setGo(false); g.submit({ picks: np }); } };
  useEffect(() => { if (!go || g.res) return; if (t <= 0) { next(null); return; } const k = setTimeout(() => setT((x) => x - 1), 1000); return () => clearTimeout(k); }, [go, t, g.res]); // eslint-disable-line
  return <Guard g={g} title="Boardroom Blitz">{g.p && (() => { const r = g.p.rounds[i]; const fb = g.res?.feedback;
    return <Frame title="Boardroom Blitz" sub={g.res ? 'Debrief' : go ? `Objection ${i + 1} of ${g.p.rounds.length}` : 'Three objections. Forty-five seconds each.'}>
      {g.res ? <Result res={g.res} onAgain={g.start}><div className="col" style={{ gap: 12 }}>{fb.rounds.map((x, k) => <div key={x.id} className="panel pad"><div className="row between"><span className="eyebrow">Objection {k + 1}</span><span className="mono" style={{ color: scoreTone(x.quality * 100) }}>{Math.round(x.quality * 100)}</span></div><p className="serif mt-8" style={{ fontSize: 17 }}>{x.objection}</p>
        <div className={`callout mt-12 small ${x.quality === 1 ? 'pos' : 'neg'}`}><b>You said:</b> {x.chosen || 'Nothing — time ran out.'}</div>{x.quality < 1 && <div className="callout pos mt-8 small"><b>Strongest reply:</b> {x.best}</div>}<p className="xs muted mt-8">{x.why}</p></div>)}</div></Result>
      : !go ? <div className="panel pad" style={{ maxWidth: 620 }}><p className="t2">A board member objects to a recommendation you have made. Choose the reply that best holds the room. The strongest replies concede what is true, bring a number and adjust rather than retreat. Running out of time scores zero for that round.</p><button className="btn primary lg mt-16" onClick={() => setGo(true)}><Icon name="play" size={14} />Start the clock</button></div>
      : <div key={r.id} style={{ animation: 'rise 0.3s', maxWidth: 820 }}><div className="row between mb-12"><span className="small muted">{r.setup}</span><span className="mono" style={{ fontSize: 26, color: t <= 10 ? 'var(--neg)' : 'var(--text)' }}>{t}s</span></div><Bar value={t} max={g.p.seconds} color={t <= 10 ? 'var(--neg)' : undefined} className="mb-16" />
        <p className="board-q">{r.objection}</p><div className="col mt-16" style={{ gap: 8 }}>{r.opts.map((o) => <button key={o.id} className="ds" style={{ padding: '13px 15px' }} disabled={g.busy} onClick={() => next(o.id)}><span style={{ fontSize: 14 }}>{o.text}</span></button>)}</div></div>}
    </Frame>; })()}</Guard>;
}

// ------------------------------------------------------------------ Market Strategy Challenge
function Market() {
  const g = useGame('market'); const [ds, setDs] = useState([]); const [rows, setRows] = useState([]); const [cur, setCur] = useState({ price: 'hold', marketing: 'medium', expand: false });
  useEffect(() => { if (g.p) { setDs([]); setRows([]); setCur({ price: 'hold', marketing: 'medium', expand: false }); } }, [g.p]);
  const play = async () => { const nd = [...ds, cur]; try { const out = await g.step({ decisions: nd }); setDs(nd); setRows(out.rows); setCur({ ...cur, expand: false }); } catch (e) { g.toast(e.message, 'bad'); } };
  const expanded = ds.some((d) => d.expand);
  return <Guard g={g} title="Market Strategy Challenge">{g.p && (() => { const p = g.p; const fb = g.res?.feedback; const q = ds.length + 1; const last = rows.at(-1);
    return <Frame title="Market Strategy Challenge" sub={g.res ? `Cumulative profit: ${fb.cumulative}` : q <= p.quarters ? `Quarter ${q} of ${p.quarters}` : 'Four quarters played'} onRestart={!g.res ? g.start : null}>
      {g.res && <Result res={g.res} onAgain={g.start}><div className="panel pad mb-16"><div className="grid g4"><div className="kpi"><span className="eyebrow">You</span><span className="v">{fb.cumulative}</span></div><div className="kpi"><span className="eyebrow">Median policy</span><span className="v">{fb.benchmark.median}</span></div><div className="kpi"><span className="eyebrow">Top-decile policy</span><span className="v">{fb.benchmark.p90}</span></div><div className="kpi"><span className="eyebrow">Best possible</span><span className="v">{fb.benchmark.best}</span></div></div><p className="small t2 mt-12">Scored against every one of the 104,976 possible four-quarter policies in the same deterministic model. {fb.lesson}</p></div></Result>}
      <div className="grid g12"><div className="s5 col" style={{ gap: 14 }}>
        <div className="panel pad small t2">{p.brief}</div>
        {!g.res && q <= p.quarters && <div className="panel pad"><div className="eyebrow mb-12">Decisions for quarter {q}</div>
          <div className="field mb-12"><label>Price</label><div className="seg">{p.choices.price.map(([id, l]) => <button key={id} className={cur.price === id ? 'on' : ''} onClick={() => setCur({ ...cur, price: id })}>{l}</button>)}</div></div>
          <div className="field mb-12"><label>Marketing investment</label><div className="seg">{p.choices.marketing.map(([id, l]) => <button key={id} className={cur.marketing === id ? 'on' : ''} onClick={() => setCur({ ...cur, marketing: id })}>{l}</button>)}</div></div>
          <label className="row gap-10 small" style={{ opacity: expanded ? 0.5 : 1 }}><input type="checkbox" disabled={expanded} checked={cur.expand} onChange={(e) => setCur({ ...cur, expand: e.target.checked })} />{expanded ? 'Plant already expanded' : p.choices.expand}</label>
          <button className="btn primary mt-16" style={{ width: '100%' }} onClick={play}>Commit quarter {q}</button></div>}
        {!g.res && q > p.quarters && <button className="btn primary lg" disabled={g.busy} onClick={() => g.submit({ decisions: ds })}>Submit result</button>}
        {last?.note && <div className="callout small" key={rows.length} style={{ animation: 'rise 0.3s' }}><b>Market intelligence.</b> {last.note}</div>}</div>
        <div className="s7 col" style={{ gap: 14 }}><div className="panel"><div className="panel-h"><span className="eyebrow">Results</span>{last && <span className="mono small">Cumulative profit <b className={last.cumulative >= 0 ? 'pos' : 'neg'}>{last.cumulative}</b></span>}</div>
          {rows.length === 0 ? <Empty icon="chess" title="No quarters played yet">Your competitor starts at the same price as you. It reacts to price cuts and to share gains.</Empty> : <><div className="scroll-x"><table className="table"><thead><tr><th>Q</th><th className="n">Your price</th><th className="n">Rival price</th><th className="n">Share %</th><th className="n">Demand</th><th className="n">Sold</th><th className="n">Capacity</th><th className="n">Profit</th></tr></thead><tbody>{rows.map((r) => <tr key={r.q}><td>Q{r.q}</td><td className="n">{r.price}</td><td className="n">{r.competitorPrice}</td><td className="n">{r.share}</td><td className="n">{r.demand}</td><td className="n" style={{ color: r.sales < r.demand ? 'var(--neg)' : 'inherit' }}>{r.sales}</td><td className="n">{r.capacity}</td><td className={`n ${r.profit >= 0 ? 'pos' : 'neg'}`}>{r.profit}</td></tr>)}</tbody></table></div>
            <div className="panel-b"><LineChart categories={rows.map((r) => `Q${r.q}`)} series={[{ label: 'Share %', values: rows.map((r) => r.share) }, { label: 'Profit', values: rows.map((r) => r.profit), color: 'var(--c2)' }]} height={170} area={false} yMin={Math.min(0, ...rows.map((r) => r.profit))} /></div></>}</div></div></div>
    </Frame>; })()}</Guard>;
}
