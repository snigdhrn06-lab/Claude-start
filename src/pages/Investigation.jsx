import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, post } from '../api.js';
import { useAuth } from '../App.jsx';
import { evaluate } from '../../shared/expr.js';
import { AnimatePresence, motion } from 'motion/react';
import { Bar, celebrate, CountUp, Empty, ErrorState, Field, Icon, initials, Modal, PageSkeleton, Presence, Seg, Tip, useToast } from '../components/ui.jsx';
import { CaseArt, caseTheme } from '../components/Art.jsx';
import { useCelebrate } from '../components/Layers.jsx';
import { BarChart, LineChart, PALETTE } from '../components/charts.jsx';

const STAGES = [['brief', 'Client brief', 'doc'], ['hyp', 'Hypotheses', 'target'], ['data', 'The Vault', 'data'], ['bench', 'Workbench', 'calc'], ['people', 'Stakeholders', 'chat'], ['synth', 'Synthesis', 'edit'], ['board', 'Boardroom', 'gavel']];
const fmtCell = (v, f) => (v == null ? '—' : f === 'text' ? v : f === 'pct' ? `${(Math.round(v * 10) / 10).toLocaleString('en-IN')}%` : Number(v).toLocaleString('en-IN', { minimumFractionDigits: f === 'num2' ? 2 : f === 'num1' ? 1 : 0, maximumFractionDigits: f === 'num2' ? 2 : f === 'num1' ? 1 : 0 }));
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export default function Investigation() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast(); const { refresh } = useAuth();
  const [a, setA] = useState(null); const [error, setError] = useState(null); const [stage, setStage] = useState('brief'); const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({}); const [pins, setPins] = useState(() => ls(`cb_pins_${id}`, [])); const [railOpen, setRailOpen] = useState(false); const [confirmExit, setConfirmExit] = useState(false);
  const load = useCallback(() => api(`/attempts/${id}`).then((d) => { if (d.attempt.status === 'completed') return nav(`/replay/${id}`, { replace: true }); if (d.attempt.status !== 'active') return nav('/vault', { replace: true }); setA(d.attempt); if (d.attempt.phase === 'boardroom') setStage('board'); else if (d.attempt.hypotheses.length) setStage(ls(`cb_stage_${id}`, 'hyp')); }).catch(setError), [id, nav]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (a) setDraft({ ...a.alloc }); }, [a && JSON.stringify(a.alloc)]); // eslint-disable-line
  useEffect(() => { localStorage.setItem(`cb_pins_${id}`, JSON.stringify(pins)); }, [pins, id]);
  useEffect(() => { if (a) { localStorage.setItem(`cb_stage_${id}`, JSON.stringify(stage)); document.title = `${a.case.company} — Consult Brain`; } }, [stage, a, id]);

  const act = useCallback(async (type, payload, { quiet } = {}) => {
    setBusy(true);
    try { const d = await post(`/attempts/${id}/action`, { type, payload }); setA(d.attempt); if (d.completed) { await refresh(); nav(`/replay/${id}?fresh=1`); } return d.attempt; }
    catch (e) { if (!quiet) toast(e.message, 'bad'); throw e; } finally { setBusy(false); }
  }, [id, nav, refresh, toast]);

  if (error) return <ErrorState error={error} retry={load} />; if (!a) return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1 }}><div className="col" style={{ alignItems: 'center', gap: 14 }}><svg width="54" height="54" viewBox="0 0 54 54" style={{ animation: 'spin 1.6s linear infinite' }}><circle cx="27" cy="27" r="23" fill="none" stroke="var(--line-2)" strokeWidth="3" /><path d="M27 4a23 23 0 0 1 23 23" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" /></svg><span className="eyebrow acc">Opening case file</span><span className="small muted">Loading your engagement and evidence trail</span></div></div>;
  const c = a.case; const locked = a.phase !== 'investigate'; const left = a.budget - a.hoursUsed;
  const colorOf = (driver) => (driver === 'other' ? 'var(--c7)' : PALETTE[c.drivers.findIndex((d) => d.id === driver) % 8]);
  const total = a.hypotheses.reduce((s, h) => s + (Number(draft[h.id]) || 0), 0);
  const dirty = a.hypotheses.some((h) => (draft[h.id] || 0) !== (a.alloc[h.id] || 0)) || !a.allocCommitted;
  const commit = async () => { try { await act('conf_commit', { alloc: draft }); toast(dirty ? 'Confidence committed to the trail' : 'Position held and logged', 'good'); } catch {} };
  const pin = (value, label) => setPins((p) => { const ex = p.find((x) => x.value === value && x.label === label); if (ex) return p.filter((x) => x !== ex); const n = (p.reduce((m, x) => Math.max(m, Number(x.name.slice(1))), 0) || 0) + 1; toast(`Pinned to workbench as v${n}`, 'good'); return [...p, { name: `v${n}`, value, label }]; });
  const ctx = { a, c, act, busy, locked, left, colorOf, draft, setDraft, total, dirty, commit, pins, pin, setPins, setStage, toast };
  const stageDone = { brief: a.hypotheses.length > 0, hyp: a.allocCommitted, data: a.requested.length > 0, bench: Object.values(a.quant).some((q) => q.correct), people: Object.keys(a.interviews).length > 0, synth: !!a.recommendation, board: false };
  const View = { brief: Brief, hyp: Hypotheses, data: DataRoom, bench: Workbench, people: People, synth: Synthesis, board: Boardroom }[stage];
  const showRail = !['hyp', 'board', 'brief'].includes(stage);
  return (
    <div className="ws">
      <header className="ws-top">
        <div className="ws-bar">
          <button className="btn ghost sm" onClick={() => setConfirmExit(true)}><Icon name="back" size={14} />Exit</button>
          <div style={{ minWidth: 0 }} className="grow"><div className="xs muted truncate">{c.company} · {c.industry}</div><div className="truncate" style={{ fontWeight: 600 }}>{c.title}</div></div>
          <Budget used={a.hoursUsed} budget={a.budget} />
          {!locked && <button className="btn sm" disabled={busy || a.hints.length >= c.hintCount} title="Each hint reduces case XP by 8%" onClick={() => act('hint').then((r) => toast(r.hints.at(-1))).catch(() => {})}><Icon name="bulb" size={14} />Hint {a.hints.length}/{c.hintCount}</button>}
          {showRail && <button className="btn sm icon railbtn" onClick={() => setRailOpen(!railOpen)} aria-label="Beliefs"><Icon name="target" /></button>}
        </div>
        <nav className="ws-stages" aria-label="Investigation stages">{STAGES.map(([sid, label, icon], i) => { const dis = sid === 'board' ? a.phase !== 'boardroom' : false; return <button key={sid} className={`stage ${stage === sid ? 'on' : ''} ${stageDone[sid] ? 'done' : ''}`} disabled={dis} onClick={() => setStage(sid)}><span className="n">{stageDone[sid] ? '✓' : i + 1}</span>{label}</button>; })}</nav>
      </header>
      <div className={`ws-body ${showRail ? '' : 'solo'}`}>
        <main className="ws-main"><AnimatePresence mode="wait" initial={false}><motion.div className="inner" key={stage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.26, ease: [0.22, 0.8, 0.24, 1] }}><View {...ctx} /></motion.div></AnimatePresence></main>
        {showRail && <aside className={`ws-rail ${railOpen ? 'open' : ''}`}><Rail {...ctx} /></aside>}
      </div>
      <Presence>{confirmExit && <Modal key="exit" onClose={() => setConfirmExit(false)}><div style={{ padding: 22 }}><h2>Leave this investigation?</h2><p className="t2 mt-8">Your progress is saved. You can resume from the Case Vault, or abandon the engagement. Repeatedly abandoning cases reduces XP on later ones.</p>
        <div className="row end mt-16"><button className="btn danger" onClick={async () => { try { await post(`/attempts/${id}/abandon`); } catch {} nav('/vault'); }}>Abandon case</button><button className="btn" onClick={() => setConfirmExit(false)}>Keep working</button><button className="btn primary" onClick={() => nav('/vault')}>Save & exit</button></div></div></Modal>}</Presence>
    </div>
  );
}

// ------------------------------------------------------------------ Belief rail
function Rail({ a, c, draft, setDraft, total, dirty, commit, busy, colorOf, setStage, locked }) {
  const step = (id, d) => setDraft((x) => ({ ...x, [id]: Math.max(0, Math.min(100, (x[id] || 0) + d)) }));
  return <>
    <div className="row between"><span className="eyebrow">Belief ledger</span><button className="btn ghost sm" onClick={() => setStage('hyp')}>Open board</button></div>
    {a.pendingEvidence.length > 0 && !locked && <div className="callout small" style={{ animation: 'rise 0.3s' }}><b>New evidence in hand.</b> Does it move anything? Re-allocate, or hold — either way, log it before your next request.</div>}
    {a.hypotheses.length === 0 ? <div className="small muted">No hypotheses yet.</div> : a.hypotheses.map((h) => <div key={h.id}>
      <div className="row between gap-6"><span className="small" style={{ lineHeight: 1.35 }}>{h.text.length > 74 ? h.text.slice(0, 72) + '…' : h.text}</span></div>
      <div className="row gap-6 mt-4"><div className="hyp-bar grow"><i style={{ width: `${draft[h.id] || 0}%`, background: colorOf(h.driver) }} /></div>
        {locked ? <span className="mono small">{a.alloc[h.id] || 0}</span> : <span className="stepper"><button onClick={() => step(h.id, -5)} aria-label="Less">−</button><span>{draft[h.id] || 0}</span><button onClick={() => step(h.id, 5)} aria-label="More">+</button></span>}</div></div>)}
    {!locked && a.hypotheses.length >= 2 && <><div className="row between small"><span className="muted">Allocated</span><span className="mono" style={{ color: total === 100 ? 'var(--pos)' : 'var(--neg)' }}>{total} / 100</span></div>
      <button className={`btn ${dirty || a.pendingEvidence.length ? 'primary' : ''}`} disabled={busy || total !== 100} onClick={commit}>{dirty ? 'Commit update' : a.pendingEvidence.length ? 'Hold position' : 'Committed'}</button></>}
    <hr className="rule" style={{ margin: '2px 0' }} />
    <div className="eyebrow">Evidence in hand <span className="mono" style={{ marginLeft: 4 }}>{a.evidence.length}</span></div>
    {a.evidence.length === 0 ? <div className="small muted">Nothing yet. Requests cost analyst hours.</div> : <div className="col" style={{ gap: 5 }}>{a.evidence.map((e) => <div key={e.ref} className="row gap-6 xs t2"><Icon name={e.kind === 'data' ? 'data' : e.kind === 'interview' ? 'chat' : 'calc'} size={12} /><span className="truncate">{e.label}</span></div>)}</div>}
    <div className="xs muted" style={{ marginTop: 'auto' }}>{a.snapshots} belief snapshot{a.snapshots === 1 ? '' : 's'} on your trail</div>
  </>;
}

// ------------------------------------------------------------------ Analyst-hour budget: animates and shows what was just spent
function Budget({ used, budget }) {
  const left = budget - used; const prev = useRef(used); const [delta, setDelta] = useState(null);
  useEffect(() => { if (used > prev.current) { setDelta({ n: used - prev.current, k: Date.now() }); } prev.current = used; }, [used]);
  return <div className="hide-sm budget" style={{ width: 240 }}><div className="row between xs"><span className="muted row gap-6"><Icon name="clock" size={12} />Analyst hours</span><span className="mono"><motion.b key={left} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ color: left <= 6 ? 'var(--neg)' : 'var(--text)', display: 'inline-block' }}>{left}</motion.b> of {budget} left</span></div>
    <div className="meter-seg mt-4">{Array.from({ length: budget / 2 }, (_, i) => <i key={i} className={i < used / 2 ? (left <= 6 ? 'warn' : 'on') : ''} style={{ transitionDelay: `${i * 0.015}s` }} />)}</div>
    {delta && <span key={delta.k} className="float-delta" style={{ right: 0, top: 18, color: 'var(--accent)' }}>−{delta.n}h</span>}</div>;
}

// ------------------------------------------------------------------ Stage 1: Executive briefing
function Brief({ a, c, setStage }) {
  const b = c.briefing; const th = caseTheme(c.id);
  const st = (k) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * k, duration: 0.5, ease: [0.22, 0.8, 0.24, 1] } });
  const pull = b.memo.at(-1).split(/(?<=\.)\s/)[0];
  return <div>
    <motion.div className="case-card" style={{ '--case': th.color, cursor: 'default', marginBottom: 18 }} {...st(0)}>
      <div className="case-art fade-left" style={{ height: 150 }}><CaseArt id={c.id} initials={c.company.split(' ').map((w) => w[0]).join('').slice(0, 2)} />
        <div style={{ position: 'absolute', left: 24, bottom: 18, right: 24, zIndex: 1 }} className="row between wrap"><div><div className="eyebrow" style={{ color: th.color }}>Engagement letter · {c.industry}</div><h1 className="mt-8" style={{ fontSize: 32 }}>{b.subject}</h1></div><span className="chip line" style={{ background: 'var(--surface)' }}><Icon name="clock" size={11} />{a.budget} analyst hours</span></div></div>
    </motion.div>
    <div className="grid g12">
      <div className="s8">
        <motion.div className="row gap-10 mb-16" {...st(1)}><span className="exec-av">{initials(b.from.name)}</span><div><div style={{ fontWeight: 600 }}>{b.from.name}</div><div className="xs muted">{b.from.role}</div></div></motion.div>
        <motion.div className="memo" {...st(2)}>{b.memo.map((p, i) => <p key={i}>{p}</p>)}</motion.div>
        <motion.blockquote className="quote mt-24" style={{ margin: '24px 0 0' }} {...st(3)}>“{pull}”<div className="xs muted mt-8" style={{ fontStyle: 'normal', fontFamily: 'var(--sans)' }}>— {b.from.name}</div></motion.blockquote>
        <motion.div className="panel pad mt-24" style={{ borderColor: 'var(--accent-line)' }} {...st(4)}><div className="eyebrow acc mb-8">Your objective</div><p style={{ fontSize: 16, lineHeight: 1.55 }}>{b.objective}</p></motion.div>
        <motion.div className="grid g3 mt-16" {...st(5)}>{[['Company background', b.background, 'doc'], ['Constraints', b.constraints, 'lock'], ['Things you have heard', b.context, 'chat']].map(([t, xs, ic]) => <div key={t} className="panel pad"><div className="eyebrow mb-8 row gap-6"><Icon name={ic} size={12} />{t}</div><ul className="small t2" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.65 }}>{xs.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</motion.div>
      </div>
      <div className="s4 col" style={{ gap: 14 }}>
        <motion.div className="panel pad" {...st(2)}><div className="eyebrow mb-12">Headline metrics</div><div className="grid g2" style={{ gap: 14 }}>{b.metrics.map((m, i) => <motion.div key={m.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.08 }}><div className="xs muted">{m.label}</div><div className="mono mt-4" style={{ fontSize: 21 }}>{m.value}</div><div className={`mono xs ${m.tone === 'up' ? 'pos' : m.tone === 'down' ? 'neg' : 'muted'}`}>{m.tone === 'up' ? '▲ ' : m.tone === 'down' ? '▼ ' : ''}{m.delta}</div></motion.div>)}</div></motion.div>
        <motion.div className="panel pad" {...st(3)}><div className="eyebrow mb-8">{b.trend.label}</div><LineChart categories={b.trend.x} series={b.trend.series} height={170} area={false} /><div className="row gap-16 xs t2 mt-4">{b.trend.series.map((s, i) => <span key={i} className="row gap-6"><span className="dot" style={{ background: PALETTE[i] }} />{s.label}</span>)}</div></motion.div>
        <motion.div className="panel pad" {...st(4)}><div className="eyebrow mb-12">The engagement, in four moves</div>{[['target', 'Commit to competing hypotheses'], ['data', `Spend ${a.budget} hours on evidence`], ['scale', 'Update as evidence arrives'], ['gavel', 'Recommend, then defend']].map(([ic, t], i) => <div key={t} className="row gap-10 small t2" style={{ padding: '6px 0' }}><span className="mono acc xs">0{i + 1}</span><Icon name={ic} size={14} className="muted" />{t}</div>)}
          <button className="btn primary lg mt-16" style={{ width: '100%' }} onClick={() => setStage('hyp')}>Form hypotheses<Icon name="arrow" size={14} /></button></motion.div>
      </div>
    </div>
  </div>;
}

// Logic map: hypotheses (left) linked to the evidence you tied to them (right).
function LogicMap({ a, c, colorOf, draft }) {
  const hs = a.hypotheses; const evRefs = [...new Set(hs.flatMap((h) => h.links.map((l) => l.ref)))]; const ev = evRefs.map((r) => a.evidence.find((e) => e.ref === r)).filter(Boolean);
  if (!hs.length) return null; const H = Math.max(hs.length, ev.length, 2) * 38 + 20; const W = 300;
  const hy = (i) => 20 + i * ((H - 40) / Math.max(1, hs.length - 1)) ; const ey = (i) => 20 + i * ((H - 40) / Math.max(1, ev.length - 1));
  return <div className="panel pad"><div className="row between mb-8"><span className="eyebrow">Investigation logic</span><span className="xs muted">{hs.reduce((n, h) => n + h.links.length, 0)} links</span></div>
    {ev.length === 0 ? <p className="small muted">Link evidence to hypotheses ("Link evidence" on each card) and the logic of your investigation appears here.</p> :
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {hs.map((h, i) => h.links.map((l) => { const k = ev.findIndex((e) => e.ref === l.ref); if (k < 0) return null; const y1 = hs.length === 1 ? H / 2 : hy(i), y2 = ev.length === 1 ? H / 2 : ey(k);
        return <motion.path key={h.id + l.ref} d={`M70 ${y1} C 150 ${y1}, 150 ${y2}, 226 ${y2}`} fill="none" stroke={l.stance === 'supports' ? 'var(--pos)' : 'var(--neg)'} strokeOpacity="0.7" strokeWidth={1 + (draft[h.id] || 0) / 30} strokeDasharray={l.stance === 'supports' ? '' : '4 3'} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />; }))}
      {hs.map((h, i) => { const y = hs.length === 1 ? H / 2 : hy(i); return <g key={h.id}><circle cx="62" cy={y} r={5 + (draft[h.id] || 0) / 12} fill={colorOf(h.driver)} fillOpacity="0.85" /><text x="50" y={y + 4} textAnchor="end" fontSize="10.5" fill="var(--text-2)" fontFamily="var(--mono)">H{i + 1}</text></g>; })}
      {ev.map((e, k) => { const y = ev.length === 1 ? H / 2 : ey(k); return <g key={e.ref}><rect x="226" y={y - 7} width="14" height="14" rx="3" fill="var(--surface-3)" stroke="var(--line-hi)" /><text x="246" y={y + 4} fontSize="10" fill="var(--muted)">{e.label.slice(0, 9)}…</text></g>; })}
    </svg>}
    <div className="row gap-16 xs muted mt-8"><span className="row gap-6"><i style={{ width: 14, height: 2, background: 'var(--pos)', display: 'inline-block' }} />supports</span><span className="row gap-6"><i style={{ width: 14, height: 2, borderTop: '2px dashed var(--neg)', display: 'inline-block' }} />contradicts</span><span>node size = confidence</span></div></div>;
}

// ------------------------------------------------------------------ Stage 2: Hypothesis board
function Hypotheses({ a, c, act, busy, locked, colorOf, draft, setDraft, total, dirty, commit, setStage }) {
  const [text, setText] = useState(''); const [driver, setDriver] = useState(''); const [edit, setEdit] = useState(null); const [linking, setLinking] = useState(null);
  const add = async (t = text, d = driver) => { try { await act('hyp_add', { text: t, driver: d }); setText(''); setDriver(''); } catch {} };
  const seeds = c.hypothesisSeeds.filter((s) => !a.hypotheses.some((h) => h.text === s.text));
  const even = () => { const n = a.hypotheses.length; const base = Math.floor(100 / n); setDraft(Object.fromEntries(a.hypotheses.map((h, i) => [h.id, base + (i < 100 - base * n ? 1 : 0)]))); };
  const byArea = {}; a.hypotheses.forEach((h) => (byArea[h.driver] = (byArea[h.driver] || 0) + (draft[h.id] || 0)));
  return <div>
    <div className="row between wrap gap-16 mb-16"><div><div className="eyebrow acc mb-8">Hypothesis board</div><h1>What could explain this?</h1><p className="t2 mt-8" style={{ maxWidth: 640 }}>Write competing explanations and split 100 confidence points between them. You are scored on how well you structure and update them — not on guessing the answer first.</p></div>
      {a.allocCommitted && !locked && <button className="btn primary" onClick={() => setStage('data')}>Enter The Vault<Icon name="arrow" size={14} /></button>}</div>
    <div className="grid g12">
      <div className="s8 col" style={{ gap: 10 }}>
        {a.hypotheses.length === 0 && <div className="panel"><Empty icon="target" title="The board is empty">Start with three or more explanations that could each, on their own, account for what the client is seeing. Cover different parts of the business.</Empty></div>}
        {a.hypotheses.map((h, i) => <div key={h.id} className="hyp" style={{ borderLeft: `3px solid ${colorOf(h.driver)}`, animation: 'rise 0.3s both' }}>
          {edit?.id === h.id ? <div className="col"><textarea className="textarea" style={{ minHeight: 60 }} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
            <div className="row"><select className="select" value={edit.driver} onChange={(e) => setEdit({ ...edit, driver: e.target.value })}>{c.drivers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}<option value="other">Other / not listed</option></select>
              <button className="btn sm primary" disabled={busy} onClick={() => act('hyp_edit', edit).then(() => setEdit(null)).catch(() => {})}>Save</button><button className="btn sm ghost" onClick={() => setEdit(null)}>Cancel</button></div></div>
          : <><div className="row between" style={{ alignItems: 'flex-start' }}><div><div className="row gap-6 xs"><span className="mono muted">H{i + 1}</span><span style={{ color: colorOf(h.driver), fontWeight: 600 }}>{c.drivers.find((d) => d.id === h.driver)?.label || 'Other'}</span>{!h.preData && <span className="chip">added after evidence</span>}</div><div className="mt-4" style={{ fontSize: 14.5 }}>{h.text}</div></div>
            {!locked && <div className="row gap-4"><button className="btn ghost sm icon" aria-label="Edit" onClick={() => setEdit({ id: h.id, text: h.text, driver: h.driver })}><Icon name="edit" size={14} /></button><button className="btn ghost sm icon" aria-label="Delete" disabled={busy} onClick={() => act('hyp_delete', { id: h.id }).catch(() => {})}><Icon name="trash" size={14} /></button></div>}</div>
            <div className="row gap-10 mt-12"><input type="range" min="0" max="100" step="5" disabled={locked} value={draft[h.id] || 0} onChange={(e) => setDraft({ ...draft, [h.id]: Number(e.target.value) })} aria-label={`Confidence in hypothesis ${i + 1}`} style={{ accentColor: colorOf(h.driver) }} /><span className="mono" style={{ width: 44, textAlign: 'right', fontSize: 16 }}>{draft[h.id] || 0}</span></div>
            <div className="row wrap gap-6 mt-8">{h.links.map((l) => <span key={l.ref} className={`chip ${l.stance === 'supports' ? 'pos' : 'neg'}`} title={l.label}>{l.stance === 'supports' ? '▲' : '▼'} {l.label.length > 34 ? l.label.slice(0, 32) + '…' : l.label}{!locked && <button onClick={() => act('link', { hypId: h.id, ref: l.ref, stance: null }).catch(() => {})} style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }} aria-label="Remove link">×</button>}</span>)}
              {a.evidence.length > 0 && <button className="chip line btnlike" onClick={() => setLinking(linking === h.id ? null : h.id)}><Icon name="link" size={11} />Link evidence</button>}</div>
            {linking === h.id && <div className="panel pad mt-8" style={{ background: 'var(--bg-2)', padding: 10 }}>{a.evidence.filter((e) => !h.links.some((l) => l.ref === e.ref)).map((e) => <div key={e.ref} className="row between small" style={{ padding: '5px 0' }}><span className="truncate t2">{e.label}</span><span className="row gap-4"><button className="btn sm" disabled={busy} onClick={() => act('link', { hypId: h.id, ref: e.ref, stance: 'supports' }).catch(() => {})}>Supports</button><button className="btn sm" disabled={busy} onClick={() => act('link', { hypId: h.id, ref: e.ref, stance: 'contradicts' }).catch(() => {})}>Contradicts</button></span></div>)}{a.evidence.every((e) => h.links.some((l) => l.ref === e.ref)) && <div className="small muted">All evidence in hand is already linked.</div>}</div>}</>}
        </div>)}
        {!locked && <div className="panel pad"><div className="eyebrow mb-8">Add a hypothesis</div>
          <textarea className="textarea" style={{ minHeight: 56 }} placeholder="A testable statement: what is happening, and why. e.g. “Growth has shifted to a channel that earns less per order.”" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row mt-8 wrap"><select className="select" style={{ flex: 1, minWidth: 220 }} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label="Area"><option value="">Which area of the business is this about?</option>{c.drivers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}<option value="other">Other / not listed</option></select>
            <button className="btn primary" disabled={busy || !text.trim() || !driver} onClick={() => add()}><Icon name="plus" size={14} />Add to board</button></div>
          {seeds.length > 0 && <><div className="xs muted mt-12 mb-8">Heard in the corridor — adopt, rewrite or ignore:</div><div className="col" style={{ gap: 6 }}>{seeds.map((s) => <button key={s.text} className="ds" disabled={busy} onClick={() => add(s.text, s.driver)}><span className="small t2">“{s.text}”</span><Icon name="plus" size={14} className="muted" /></button>)}</div></>}</div>}
      </div>
      <div className="s4 col" style={{ gap: 14 }}>
        <div className="panel pad" style={{ position: 'sticky', top: 0 }}>
          <div className="row between"><span className="eyebrow">Confidence</span><span className="mono" style={{ fontSize: 18, color: total === 100 ? 'var(--pos)' : 'var(--neg)' }}>{total}<span className="muted xs"> / 100</span></span></div>
          <div className="row mt-12" style={{ height: 14, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-3)', gap: 1 }}>{a.hypotheses.map((h) => <i key={h.id} title={h.text} style={{ display: 'block', height: '100%', flex: 'none', width: `calc(${draft[h.id] || 0}% - 1px)`, background: colorOf(h.driver), transition: 'width 0.4s var(--ease)' }} />)}</div>
          <div className="col mt-12" style={{ gap: 6 }}>{Object.entries(byArea).map(([k, v]) => <div key={k} className="row between small"><span className="row gap-6 t2"><span className="dot" style={{ background: colorOf(k) }} />{c.drivers.find((d) => d.id === k)?.label || 'Other'}</span><span className="mono">{v}</span></div>)}</div>
          {!locked && <><div className="row mt-16"><button className="btn sm" disabled={a.hypotheses.length < 2} onClick={even}>Split evenly</button><button className={`btn sm grow ${dirty ? 'primary' : ''}`} disabled={busy || total !== 100 || a.hypotheses.length < 2} onClick={commit}>{dirty ? 'Commit allocation' : a.pendingEvidence.length ? 'Hold position' : 'Committed ✓'}</button></div>
            <p className="xs muted mt-12">{a.hypotheses.length < 2 ? 'Hold at least two competing hypotheses.' : total !== 100 ? `Allocate exactly 100 points (${100 - total > 0 ? `${100 - total} left` : `${total - 100} over`}).` : a.allocCommitted && !dirty ? 'Committed. Every commit is recorded on your evidence trail.' : 'Committing records a snapshot on your evidence trail.'}</p></>}
        </div>
        <LogicMap a={a} c={c} colorOf={colorOf} draft={draft} />
        <div className="panel pad small t2"><div className="eyebrow mb-8">What good looks like</div><ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}><li>Three or more hypotheses before any data.</li><li>Different parts of the business: revenue quality, variable cost, fixed cost.</li><li>A mechanism, not a topic: “X rose because Y”.</li><li>No more than half your points on one idea at the start.</li></ul></div>
      </div>
    </div>
  </div>;
}

// ------------------------------------------------------------------ Stage 3: The Vault (data room)
const REL = { High: 'acc', Medium: 'info', Low: '' };
function Gate({ a, setStage, what }) { return <div className="panel"><Empty icon="lock" title={`Commit your hypotheses before ${what}`} action={<button className="btn primary sm mt-8" onClick={() => setStage('hyp')}>Go to hypothesis board</button>}>Form a view before you look. Hold at least two hypotheses and commit 100 confidence points; the room opens as soon as you do.</Empty></div>; }
function DataRoom({ a, c, act, busy, locked, left, pins, pin, setStage, toast }) {
  const [sel, setSel] = useState(a.requested.at(-1) || c.datasets[0].id); const [mode, setMode] = useState('table'); const [show, setShow] = useState('all'); const [fq, setFq] = useState('');
  const d = c.datasets.find((x) => x.id === sel); const got = a.datasets[sel];
  const cats = [...new Set(c.datasets.map((x) => x.category))];
  if (!a.allocCommitted && !a.requested.length) return <Gate a={a} setStage={setStage} what="opening The Vault" />;
  return <div>
    <div className="row between wrap gap-16 mb-16"><div><div className="eyebrow acc mb-8">The Vault</div><h1>Investigative data room</h1><p className="t2 mt-8" style={{ maxWidth: 640 }}>{c.datasets.length} datasets are available for {c.datasets.reduce((s, x) => s + x.cost, 0)} analyst hours. You have {a.budget}. Decide what is worth knowing.</p></div>
      <div className="row gap-16"><div className="kpi"><span className="v">{a.requested.length}</span><span className="xs muted">received</span></div><div className="kpi"><span className="v" style={{ color: left <= 6 ? 'var(--neg)' : 'inherit' }}>{left}h</span><span className="xs muted">remaining</span></div></div></div>
    <div className="grid g12">
      <div className="s4 col" style={{ gap: 14 }}><div className="col" style={{ gap: 8 }}><Seg value={show} onChange={setShow} options={[{ id: 'all', label: 'All' }, { id: 'open', label: 'Not requested' }, { id: 'got', label: `Received ${a.requested.length}` }]} /><input className="input" placeholder="Filter datasets" value={fq} onChange={(e) => setFq(e.target.value)} aria-label="Filter datasets" /></div>
        {cats.map((cat) => { const xs = c.datasets.filter((x) => x.category === cat && (show === 'all' || (show === 'got') === a.requested.includes(x.id)) && (!fq || `${x.title} ${x.description}`.toLowerCase().includes(fq.toLowerCase()))); return xs.length === 0 ? null : <div key={cat}><div className="eyebrow mb-8">{cat}</div><div className="col" style={{ gap: 6 }}>{xs.map((x) => { const have = a.requested.includes(x.id); return (
        <button key={x.id} className={`ds ${sel === x.id ? 'on' : ''} ${have ? 'got' : ''}`} onClick={() => setSel(x.id)}>
          <span style={{ fontWeight: 500 }}>{x.title}</span><span className="mono small" style={{ color: have ? 'var(--pos)' : !locked && x.cost > left ? 'var(--neg)' : 'var(--text-2)' }}>{have ? '✓' : `${x.cost}h`}</span>
          <span className="xs muted" style={{ gridColumn: '1 / -1' }}>{have ? `Received · request #${a.requested.indexOf(x.id) + 1}` : `Expected relevance: ${x.relevance}`}</span></button>); })}</div></div>; })}</div>
      <div className="s8"><motion.div key={sel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="panel terminal" style={{ position: 'sticky', top: 0 }}>
        <div className="panel-h"><div style={{ minWidth: 0 }}><div className="truncate" style={{ fontWeight: 600 }}>{d.title}</div><div className="xs muted">{d.category}</div></div>{got ? got.chart && <Seg value={mode} onChange={setMode} options={[{ id: 'table', label: 'Table' }, { id: 'chart', label: 'Chart' }]} /> : <span className={`chip ${REL[d.relevance]}`}>Expected relevance: {d.relevance}</span>}</div>
        {!got ? <div className="panel-b"><p className="t2">{d.description}</p>
          <div className="grid g3 mt-16"><div><div className="xs muted">Cost</div><div className="mono mt-4" style={{ fontSize: 20 }}>{d.cost}h</div></div><div><div className="xs muted">Hours after request</div><div className="mono mt-4" style={{ fontSize: 20, color: left - d.cost < 0 ? 'var(--neg)' : 'inherit' }}>{left - d.cost}h</div></div><div><div className="xs muted">Status</div><div className="mt-4">Not requested</div></div></div>
          <p className="xs muted mt-16">“Expected relevance” is the analyst team's guess before pulling the data. It is sometimes wrong.</p>
          {locked ? <div className="callout mt-12">The investigation closed when you submitted your recommendation.</div> : a.pendingEvidence.length > 0 ? <div className="callout mt-12 small">You have evidence you have not responded to. Requesting now records that you moved on without updating. <b>Update or hold in the belief ledger first</b> — or proceed.</div> : null}
          {!locked && <button className="btn primary mt-16" disabled={busy || d.cost > left} onClick={() => act('data_request', { datasetId: d.id }).then(() => { setMode('table'); toast(`Received: ${d.title} · −${d.cost}h`, 'good'); }).catch(() => {})}><Icon name="data" size={14} />{d.cost > left ? 'Not enough hours' : `Request for ${d.cost} analyst hours`}</button>}</div>
        : mode === 'chart' && got.chart ? <div className="panel-b">{got.chart.type === 'line' ? <LineChart categories={got.chart.categories} series={got.chart.series} unit="" height={260} yMin={Math.floor(Math.min(...got.chart.series.flatMap((s) => s.values)) * 0.9)} /> : <BarChart categories={got.chart.categories} series={got.chart.series} unit={got.chart.unit} height={280} />}</div>
        : <><div className="scroll-x"><table className="table"><thead><tr>{got.table.columns.map((col) => <th key={col.key} className={col.fmt === 'text' ? '' : 'n'}>{col.label}</th>)}</tr></thead>
          <tbody>{got.table.rows.map((r, ri) => <motion.tr key={ri} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ri * 0.03 }}>{got.table.columns.map((col, ci) => { const v = r[col.key]; const numeric = col.fmt !== 'text' && typeof v === 'number'; const label = `${r[got.table.columns[0].key]} · ${col.label}`; const on = numeric && pins.some((p) => p.value === v && p.label === label);
            return <td key={col.key} className={`${col.fmt === 'text' ? '' : 'n'} ${numeric ? 'pin' : ''} ${on ? 'pinned' : ''}`} style={ci === 0 ? { fontWeight: 500 } : null} title={numeric ? 'Click to pin to the workbench' : undefined} onClick={() => numeric && pin(v, label)}>{fmtCell(v, col.fmt)}</td>; })}</motion.tr>)}</tbody></table></div>
          <div className="row between xs muted" style={{ padding: '9px 14px', borderTop: '1px solid var(--line)' }}><span><Icon name="pin" size={12} style={{ verticalAlign: -2 }} /> Click any number to pin it to the workbench as a variable.</span><button className="btn ghost sm" onClick={() => setStage('bench')}>Workbench<Icon name="arrow" size={12} /></button></div></>}
      </motion.div></div>
    </div>
  </div>;
}

// ------------------------------------------------------------------ Stage 4: Quantitative workbench
function Workbench({ a, c, act, busy, locked, pins, setPins, setStage, toast }) {
  const reward = (r, q) => { const st = r.quant[q.id]; if (st.correct) { toast(st.tries === 1 ? 'Correct on the first attempt — full credit' : 'Correct', 'good'); if (st.tries === 1) celebrate({ count: 36, origin: { x: 0.72, y: 0.4 } }); } else toast(st.tries >= 3 ? 'Out of attempts — the working is shown' : `Not within tolerance · ${3 - st.tries} left`, 'bad'); };
  const [expr, setExpr] = useState(''); const [label, setLabel] = useState(''); const [ans, setAns] = useState({});
  const [lev, setLev] = useState(() => Object.fromEntries(c.scenario.levers.map((l) => [l.key, l.default])));
  const vars = Object.fromEntries(pins.map((p) => [p.name, p.value]));
  const live = useMemo(() => { if (!expr.trim()) return null; try { return { v: evaluate(expr, vars) }; } catch (e) { return { e: e.message }; } }, [expr, pins]); // eslint-disable-line
  const scnReady = c.scenario.requires.every((r) => a.requested.includes(r)); const last = a.scenarioRuns.at(-1);
  const ref = useRef(null);
  if (!a.requested.length) return <div className="panel"><Empty icon="calc" title="Nothing to calculate yet" action={<button className="btn sm mt-8" onClick={() => setStage('data')}>Open The Vault</button>}>The workbench works on data you have requested. Pin numbers from any table and they appear here as variables.</Empty></div>;
  return <div>
    <div className="mb-16"><div className="eyebrow acc mb-8">Quantitative workbench</div><h1>Size it</h1><p className="t2 mt-8" style={{ maxWidth: 640 }}>Arithmetic here is evaluated and checked in code against the case's underlying model, not by a language model.</p></div>
    <div className="grid g12">
      <div className="s7 col" style={{ gap: 14 }}>
        <div className="panel"><div className="panel-h"><span className="eyebrow">Calculator</span><span className="xs muted">+ − × ÷ ^ ( ) and % are supported</span></div><div className="panel-b">
          <div className="row wrap gap-6 mb-12">{pins.length === 0 ? <span className="small muted">No pinned values. Click numbers in a data table to pin them.</span> : pins.map((p) => <span key={p.name} className="chip line btnlike" title={p.label} onClick={() => { setExpr((e) => e + p.name); ref.current?.focus(); }}><b className="acc mono">{p.name}</b><span className="mono">{p.value.toLocaleString('en-IN')}</span><span className="muted truncate" style={{ maxWidth: 130 }}>{p.label}</span><button aria-label="Unpin" onClick={(e) => { e.stopPropagation(); setPins(pins.filter((x) => x !== p)); }} style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>×</button></span>)}</div>
          <input ref={ref} className="input num" style={{ fontSize: 16, height: 42 }} placeholder="e.g. v1 * (1 - 0.32 - 0.26) - 18" value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && live?.v != null && act('calc', { expr, vars, label }).then(() => { setExpr(''); setLabel(''); }).catch(() => {})} aria-label="Expression" />
          <div className="row between mt-8"><span className="mono" style={{ fontSize: 22, color: live?.e ? 'var(--neg)' : 'var(--accent)', minHeight: 30 }}>{live == null ? <span className="muted small">Result appears here</span> : live.e ? <span className="small">{live.e}</span> : `= ${Number(live.v.toFixed(4)).toLocaleString('en-IN')}`}</span>
            <span className="row"><input className="input" style={{ width: 170 }} placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} /><button className="btn" disabled={busy || live?.v == null} onClick={() => act('calc', { expr, vars, label }).then(() => { setExpr(''); setLabel(''); }).catch(() => {})}>Log to trail</button></span></div>
          {a.calcs.length > 0 && <><hr className="rule" /><div className="col" style={{ gap: 4 }}>{[...a.calcs].reverse().slice(0, 6).map((k) => <div key={k.id} className="row between small"><span className="mono t2 truncate">{k.label ? `${k.label}: ` : ''}{k.expr}</span><span className="mono">{Number(k.result.toFixed(4)).toLocaleString('en-IN')}</span></div>)}</div></>}
        </div></div>
        <div className="panel"><div className="panel-h"><span className="eyebrow">{c.scenario.title}</span>{!scnReady && <span className="chip"><Icon name="lock" size={11} />needs data</span>}</div><div className="panel-b">
          {!scnReady ? <p className="small muted">This model unlocks when you hold: {c.scenario.requires.map((r) => c.datasets.find((d) => d.id === r).title).join('; ')}.</p> : <>
            <p className="small t2 mb-12">{c.scenario.note}</p>
            <div className="grid g2">{c.scenario.levers.map((l) => <div key={l.key}><div className="row between small"><span className="t2">{l.label}</span><span className="mono">{l.unit === '$' ? '$' : ''}{lev[l.key].toLocaleString('en-IN')}{l.unit === '%' ? '%' : ''}</span></div><input type="range" className="mt-8" min={l.min} max={l.max} step={l.step} value={lev[l.key]} onChange={(e) => setLev({ ...lev, [l.key]: Number(e.target.value) })} aria-label={l.label} /></div>)}</div>
            <div className="row mt-16"><button className="btn primary" disabled={busy} onClick={() => act('scenario', { inputs: lev }).catch(() => {})}>Run scenario</button><button className="btn ghost" onClick={() => setLev(Object.fromEntries(c.scenario.levers.map((l) => [l.key, l.default])))}>Reset to base</button><span className="xs muted">{a.scenarioRuns.length} run{a.scenarioRuns.length === 1 ? '' : 's'} logged</span></div>
            {last && <div className="mt-16" key={a.scenarioRuns.length} style={{ animation: 'rise 0.3s' }}><div className="grid g3">{last.outputs.map((o) => <div key={o.label} className="panel pad" style={{ padding: '9px 11px', borderColor: o.highlight ? 'var(--accent)' : undefined }}><div className="xs muted">{o.label}</div><div className="mono mt-4" style={{ fontSize: 17, color: o.highlight ? (o.value >= 0 ? 'var(--pos)' : 'var(--neg)') : 'inherit' }}>{o.highlight && o.value > 0 ? '+' : ''}{o.value.toLocaleString('en-IN')} <span className="xs muted">{o.unit}</span></div></div>)}</div>
              <div className="mt-12"><BarChart categories={last.bars.map((b) => b.label)} series={[{ label: 'Scenario', values: last.bars.map((b) => b.value) }]} height={170} /></div></div>}</>}
        </div></div>
      </div>
      <div className="s5"><div className="panel"><div className="panel-h"><span className="eyebrow">Required analyses</span><span className="mono small">{Object.values(a.quant).filter((q) => q.correct).length}/{c.quant.length}</span></div>
        <div>{c.quant.map((q, i) => { const st = a.quant[q.id]; const missing = q.requires.filter((r) => !a.requested.includes(r)); const closed = st?.correct || st?.tries >= 3; return (
          <motion.div key={q.id} animate={st?.correct ? { backgroundColor: ['rgba(76,192,141,0.18)', 'rgba(76,192,141,0)'] } : {}} transition={{ duration: 1.2 }} style={{ padding: '12px 16px', borderBottom: i < c.quant.length - 1 ? '1px solid var(--line)' : 0, opacity: missing.length ? 0.6 : 1 }}>
            <div className="row gap-6" style={{ alignItems: 'flex-start' }}><span className="mono xs muted" style={{ paddingTop: 2 }}>Q{i + 1}</span><span className="small" style={{ lineHeight: 1.45 }}>{q.prompt}</span></div>
            {missing.length ? <div className="xs muted mt-8"><Icon name="lock" size={11} style={{ verticalAlign: -1 }} /> Needs: {missing.map((r) => c.datasets.find((d) => d.id === r).title).join('; ')}</div>
              : closed ? <div className={`callout ${st.correct ? 'pos' : 'neg'} small mt-8`}><b>{st.correct ? `Correct${st.tries === 1 ? ' on the first attempt' : ''}.` : `Not within tolerance (you entered ${st.value}).`}</b> {st.explain}</div>
              : <div className="row mt-8"><input className="input num" style={{ width: 130 }} inputMode="decimal" placeholder={q.unit} value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && ans[q.id] && act('quant_answer', { qid: q.id, value: Number(String(ans[q.id]).replace(/[,%₹$]/g, '')) }).then((r) => reward(r, q)).catch(() => {})} aria-label={`Answer to question ${i + 1}`} /><span className="xs muted">{q.unit}</span>
                <button className="btn sm" disabled={busy || locked || !ans[q.id]} onClick={() => act('quant_answer', { qid: q.id, value: Number(String(ans[q.id]).replace(/[,%₹$]/g, '')) }).then((r) => reward(r, q)).catch(() => {})}>Check</button>
                <span className="xs muted" style={{ marginLeft: 'auto' }}>{st ? `${3 - st.tries} attempt${3 - st.tries === 1 ? '' : 's'} left` : '3 attempts'}</span></div>}
          </motion.div>); })}</div></div>
        <p className="xs muted mt-12">Full credit on the first attempt, 60% on the second, 30% on the third. Correct answers become citable evidence.</p></div>
    </div>
  </div>;
}

// ------------------------------------------------------------------ Stage 5: Stakeholders
function People({ a, c, act, busy, locked, left, setStage }) {
  const [sel, setSel] = useState(Object.keys(a.interviews)[0] || c.stakeholders[0].id); const [q, setQ] = useState(''); const end = useRef(null);
  const s = c.stakeholders.find((x) => x.id === sel); const iv = a.interviews[sel];
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [iv?.turns.length]);
  if (!a.allocCommitted && !Object.keys(a.interviews).length) return <Gate a={a} setStage={setStage} what="scheduling interviews" />;
  const ask = () => { const text = q.trim(); if (!text) return; setQ(''); act('interview_ask', { stakeholderId: sel, question: text }).catch(() => setQ(text)); };
  return <div>
    <div className="mb-16"><div className="eyebrow acc mb-8">Stakeholder intelligence</div><h1>Who knows what?</h1><p className="t2 mt-8" style={{ maxWidth: 660 }}>Each person sees part of the picture and has a stake in the answer. They respond to specific questions; vague ones get vague answers. Six questions per interview.</p></div>
    <div className="grid g12">
      <div className="s4 col" style={{ gap: 8 }}>{c.stakeholders.map((x) => { const have = a.interviews[x.id]; return <button key={x.id} className={`ds ${sel === x.id ? 'on' : ''} ${have ? 'got' : ''}`} onClick={() => setSel(x.id)}>
        <span className="row gap-10"><span className="avatar">{initials(x.name)}</span><span><span style={{ fontWeight: 500, display: 'block' }}>{x.name}</span><span className="xs muted">{x.role}</span></span></span>
        <span className="mono small" style={{ color: have ? 'var(--pos)' : 'var(--text-2)' }}>{have ? `${have.questions}/6` : `${x.cost}h`}</span></button>; })}
        <p className="xs muted mt-8">{a.aiAssisted ? 'Replies are phrased by an AI model but restricted to this case\'s knowledge cards; numbers outside them are rejected.' : 'Replies come from this case\'s knowledge cards (deterministic mode). Set ANTHROPIC_API_KEY on the server for AI-phrased dialogue.'}</p></div>
      <div className="s8"><div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 440 }}>
        <div className="panel-h"><div className="row gap-10"><span className="avatar" style={{ width: 34, height: 34 }}>{initials(s.name)}</span><div><div style={{ fontWeight: 600 }}>{s.name}</div><div className="xs muted">{s.role}</div></div></div>{iv && <span className="chip">{6 - iv.questions} question{6 - iv.questions === 1 ? '' : 's'} left</span>}</div>
        {!iv ? <div className="panel-b"><p className="t2">{s.persona}</p><p className="small muted mt-8">Knows about {s.topics} topic{s.topics === 1 ? '' : 's'} relevant to this engagement. You will not be told which.</p>
          {locked ? <div className="callout mt-16">The investigation is closed.</div> : <button className="btn primary mt-16" disabled={busy || s.cost > left} onClick={() => act('interview_start', { stakeholderId: s.id }).catch(() => {})}><Icon name="chat" size={14} />{s.cost > left ? 'Not enough hours' : `Schedule interview for ${s.cost} analyst hours`}</button>}</div>
        : <><div className="panel-b col grow" style={{ gap: 10, overflowY: 'auto', maxHeight: '52vh' }}>{iv.turns.map((t, i) => <div key={i} className={`bubble ${t.role}`}>{t.text}{t.role === 'them' && t.cards?.length > 0 && <div className="row wrap gap-6 mt-8">{t.cards.map((k) => <span key={k} className="chip pos"><Icon name="check" size={10} />On record: {k}</span>)}</div>}</div>)}{busy && <div className="bubble them muted" style={{ animation: 'pulse 1.2s infinite' }}>…</div>}<div ref={end} /></div>
          <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>{locked ? <div className="small muted">The investigation is closed.</div> : iv.questions >= 6 ? <div className="small muted">{s.name} has to leave for another meeting.</div> : <div className="row"><input className="input" placeholder={`Ask ${s.name.split(' ')[0]} a specific question…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && ask()} aria-label="Question" /><button className="btn primary" disabled={busy || !q.trim()} onClick={ask}>Ask</button></div>}</div></>}
      </div></div>
    </div>
  </div>;
}

// ------------------------------------------------------------------ Stage 6: Synthesis
const Sec = ({ n, title, hint, children, err }) => <section className="panel pad" style={err ? { borderColor: 'var(--neg)' } : null}><div className="row gap-10 mb-12" style={{ alignItems: 'baseline' }}><span className="mono acc">{n}</span><div><h3 style={{ fontSize: 14.5 }}>{title}</h3>{hint && <div className="xs muted mt-4">{hint}</div>}</div></div>{children}{err && <div className="small neg mt-8">{err}</div>}</section>;
function Synthesis({ a, c, act, busy, locked, setStage }) {
  // eslint-disable-next-line
  const key = `cb_rec_${a.id}`; const [f, setF] = useState(() => a.recommendation ? { ...a.recommendation, priorities: [...a.recommendation.priorities] } : ls(key, { leadHypIds: [], diagnosis: '', evidence: [], basis: '', impact: '', optionId: '', rationale: '', priorities: ['', '', ''], risks: '', nextSteps: '' }));
  const [errs, setErrs] = useState({}); const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!locked) localStorage.setItem(key, JSON.stringify(f)); }, [f, key, locked]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); const toggle = (k, v, max) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : max && f[k].length >= max ? [...f[k].slice(1), v] : [...f[k], v] });
  const submit = async () => { setConfirm(false); try { await act('submit_rec', f, { quiet: true }); localStorage.removeItem(key); setStage('board'); } catch (e) { setErrs(e.fields || { _: e.message }); window.scrollTo(0, 0); } };
  const wc = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
  if (a.evidence.length < 2 && !locked) return <div className="panel"><Empty icon="edit" title="You need evidence before you can recommend" action={<button className="btn sm mt-8" onClick={() => setStage('data')}>Open The Vault</button>}>A recommendation must cite at least two pieces of evidence you actually hold.</Empty></div>;
  return <div>
    <div className="row between wrap gap-16 mb-16"><div><div className="eyebrow acc mb-8">Synthesis</div><h1>Diagnosis and recommendation</h1><p className="t2 mt-8" style={{ maxWidth: 640 }}>Eight parts, each scored. Evidence you cite is checked against what it actually shows; your impact estimate is checked against the case model.</p></div></div>
    {Object.keys(errs).length > 0 && <div className="callout neg mb-16"><b>The recommendation is incomplete.</b> {errs._ || 'Fix the highlighted sections.'}</div>}
    <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}><div className="col" style={{ gap: 12 }}>
      <Sec n="1" title="Core diagnosis" hint="Select the one or two hypotheses your diagnosis rests on, then state what is happening and why." err={errs.leadHypIds || errs.diagnosis}>
        <div className="col mb-12" style={{ gap: 6 }}>{a.hypotheses.map((h) => <label key={h.id} className={`ds ${f.leadHypIds.includes(h.id) ? 'on' : ''}`} style={{ cursor: locked ? 'default' : 'pointer' }}><span className="row gap-10"><input type="checkbox" checked={f.leadHypIds.includes(h.id)} onChange={() => toggle('leadHypIds', h.id, 2)} /><span className="small">{h.text}</span></span><span className="mono small">{a.alloc[h.id] || 0}</span></label>)}</div>
        <textarea className="textarea" placeholder="What is actually happening at this company, and what is causing it?" value={f.diagnosis} onChange={set('diagnosis')} /><div className="xs muted mt-4">{wc(f.diagnosis)} words · 20 minimum</div></Sec>
      <Sec n="2" title="Evidence supporting the diagnosis" hint="Cite at least two items you hold. Each is checked for whether it actually bears on your lead hypotheses." err={errs.evidence}>
        <div className="row wrap gap-6">{a.evidence.map((e) => <button type="button" key={e.ref} className={`chip line btnlike ${f.evidence.includes(e.ref) ? 'on' : ''}`} style={{ height: 28 }} onClick={() => toggle('evidence', e.ref)}><Icon name={e.kind === 'data' ? 'data' : e.kind === 'interview' ? 'chat' : 'calc'} size={12} />{e.label.length > 56 ? e.label.slice(0, 54) + '…' : e.label}</button>)}</div></Sec>
      <Sec n="3" title="Financial implications" hint="Size the problem with numbers from your analysis." err={errs.basis}><textarea className="textarea" style={{ minHeight: 64 }} placeholder="e.g. Contribution per order fell from … to …, which on … orders is worth …" value={f.basis} onChange={set('basis')} /></Sec>
      <Sec n="4" title="Strategic recommendation" hint="Several directions are defensible. They are not equally strong." err={errs.optionId || errs.rationale}>
        <div className="grid g2 mb-12">{c.options.map((o) => <label key={o.id} className={`ds ${f.optionId === o.id ? 'on' : ''}`} style={{ cursor: locked ? 'default' : 'pointer', alignItems: 'start' }}><span><span className="row gap-6"><input type="radio" name="opt" checked={f.optionId === o.id} onChange={() => setF({ ...f, optionId: o.id })} /><b>{o.label}</b></span><span className="xs muted" style={{ display: 'block', marginTop: 4 }}>{o.detail}</span></span></label>)}</div>
        <textarea className="textarea" style={{ minHeight: 64 }} placeholder="Why this direction, given your diagnosis?" value={f.rationale} onChange={set('rationale')} /></Sec>
      <div className="grid g2">
        <Sec n="5" title="Implementation priorities" hint="In order. At least two; three or more for full credit." err={errs.priorities}><div className="col" style={{ gap: 6 }}>{f.priorities.map((p, i) => <div key={i} className="row"><span className="mono muted small" style={{ width: 14 }}>{i + 1}</span><input className="input" value={p} placeholder={['First', 'Then', 'Then', 'Then', 'Then'][i]} onChange={(e) => setF({ ...f, priorities: f.priorities.map((x, k) => (k === i ? e.target.value : x)) })} /></div>)}{f.priorities.length < 5 && !locked && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, priorities: [...f.priorities, ''] })}><Icon name="plus" size={12} />Add priority</button>}</div></Sec>
        <Sec n="6" title="Risks and trade-offs" hint="What could go wrong, and what are you giving up?" err={errs.risks}><textarea className="textarea" style={{ minHeight: 118 }} value={f.risks} onChange={set('risks')} /></Sec>
        <Sec n="7" title="Expected impact" hint={`Your estimate of annual profit improvement, in ${c.impactUnit}. Negative if you expect a cost.`} err={errs.impact}><div className="row"><input className="input num" style={{ width: 160, fontSize: 18, height: 42 }} inputMode="decimal" value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} placeholder="0.0" aria-label="Expected impact" /><span className="small muted">{c.impactUnit}</span></div><p className="xs muted mt-8">Use the scenario model in the workbench to ground this number.</p></Sec>
        <Sec n="8" title="Immediate next steps" hint="What happens in the first weeks, and who owns it?" err={errs.nextSteps}><textarea className="textarea" style={{ minHeight: 86 }} value={f.nextSteps} onChange={set('nextSteps')} /></Sec>
      </div>
    </div></fieldset>
    {!locked ? <div className="panel pad mt-16 row between wrap" style={{ position: 'sticky', bottom: 0, boxShadow: '0 -12px 30px var(--bg)' }}><div className="small t2"><b>{a.budget - a.hoursUsed} analyst hours unspent.</b> Submitting closes the investigation and takes you into the boardroom.</div><button className="btn primary lg" disabled={busy} onClick={() => setConfirm(true)}>Submit to the client<Icon name="arrow" size={14} /></button></div>
      : <div className="callout mt-16">Submitted. <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setStage('board')}>Go to the boardroom</button></div>}
    <Presence>{confirm && <Modal key="prev" width={720} onClose={() => setConfirm(false)} label="Recommendation preview"><div style={{ padding: '22px 26px' }}>
      <div className="row between"><span className="eyebrow acc">Preview · what the client will read</span><span className="chip line">{a.budget - a.hoursUsed}h unspent</span></div>
      <h2 className="mt-12" style={{ fontSize: 26 }}>{c.options.find((o) => o.id === f.optionId)?.label || 'No direction chosen'}</h2>
      <div className="mono acc mt-4">{f.impact === '' ? '—' : f.impact} {c.impactUnit}</div>
      <div className="col mt-16" style={{ gap: 12 }}>{[['Diagnosis', f.diagnosis], ['Financial implications', f.basis], ['Why this direction', f.rationale], ['Risks and trade-offs', f.risks], ['Next steps', f.nextSteps]].map(([k, v]) => <div key={k}><div className="eyebrow mb-4">{k}</div><p className="small t2" style={{ lineHeight: 1.6 }}>{v || <span className="neg">Missing</span>}</p></div>)}
        <div><div className="eyebrow mb-4">Priorities</div><ol className="small t2" style={{ margin: 0, paddingLeft: 18 }}>{f.priorities.filter((x) => x.trim()).map((x, k) => <li key={k}>{x}</li>)}</ol></div>
        <div><div className="eyebrow mb-4">Evidence cited · confidence at close</div><div className="row wrap gap-6">{f.evidence.map((r) => <span key={r} className="chip line">{a.evidence.find((e) => e.ref === r)?.label.slice(0, 40)}</span>)}{f.leadHypIds.map((id) => <span key={id} className="chip acc">{a.alloc[id] || 0} pts on lead hypothesis</span>)}</div></div></div>
      {a.pendingEvidence.length > 0 && <div className="callout mt-16 small">You have evidence you have not responded to on the belief ledger. Commit or hold first if you want that recorded.</div>}
      <div className="callout info mt-16 small">Submitting closes the investigation: no more data, interviews or hypothesis changes.</div>
      <div className="row end mt-16"><button className="btn" onClick={() => setConfirm(false)}>Keep editing</button><button className="btn primary lg" onClick={submit}><Icon name="gavel" size={14} />Submit and face the board</button></div></div></Modal>}</Presence>
  </div>;
}

// ------------------------------------------------------------------ Stage 7: Boardroom defence
function Typewriter({ text, speed = 14, onDone }) {
  const [n, setN] = useState(0); const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { if (reduce) { setN(text.length); onDone?.(); return; } setN(0); let k = 0; const t = setInterval(() => { k += 2; setN(k); if (k >= text.length) { clearInterval(t); onDone?.(); } }, speed); return () => clearInterval(t); }, [text]); // eslint-disable-line
  return <>{text.slice(0, n)}{n < text.length && <span style={{ opacity: 0.5 }}>▍</span>}</>;
}
function Ceo({ children, name }) { return <motion.div className="exec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><span className="exec-av">{initials(name)}</span><div className="bubble them" style={{ maxWidth: '86%' }}>{children}</div></motion.div>; }
function You({ children }) { return <motion.div className="row" style={{ justifyContent: 'flex-end' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><div className="bubble you">{children}</div></motion.div>; }
function Boardroom({ a, c, act, busy }) {
  const b = a.boardroom; const [text, setText] = useState(''); const [stance, setStance] = useState(''); const [typed, setTyped] = useState(false); const end = useRef(null); const ta = useRef(null);
  const cur = b?.current?.id || (b?.twist && !b.twist.answer ? 'twist' : 'done');
  useEffect(() => { setTyped(false); setText(''); }, [cur]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [b?.done.length, busy, typed]);
  if (!b) return <div className="panel"><Empty icon="gavel" title="The boardroom opens after you submit a recommendation" /></div>;
  const ceo = b.ceo; const wc = text.trim().split(/\s+/).filter(Boolean).length; const tone = (s) => (s >= 0.6 ? 'var(--pos)' : s >= 0.35 ? 'var(--accent)' : 'var(--neg)');
  const cite = (label) => { setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${label} `); ta.current?.focus(); };
  return <div className="boardroom" style={{ maxWidth: 880, margin: '0 auto' }}>
    <div className="hero" style={{ padding: '18px 22px', marginBottom: 18 }}>
      <div className="row between wrap gap-16" style={{ position: 'relative' }}><div className="row gap-16"><span className="exec-av" style={{ width: 56, height: 56, fontSize: 20 }}>{initials(ceo.name)}</span><div><div className="eyebrow acc">Boardroom defence</div><div className="serif" style={{ fontSize: 22 }}>{ceo.name}</div><div className="xs muted">{ceo.role}, {c.company}</div></div></div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}><span className="xs muted">Challenge {Math.min(b.done.length + 1, b.total)} of {b.total} · then one twist</span><div className="row gap-4">{Array.from({ length: b.total + 1 }, (_, i) => { const d = b.done[i]; const done = i < b.done.length || (i === b.total && b.twist?.answer); return <motion.i key={i} animate={{ width: i === b.done.length ? 34 : 22 }} style={{ height: 5, borderRadius: 3, display: 'block', background: d ? tone(d.score) : done ? 'var(--accent)' : i === b.done.length ? 'var(--text-2)' : 'var(--surface-3)' }} />; })}</div></div></div>
      <div className="small t2 mt-12" style={{ position: 'relative' }}><span className="eyebrow" style={{ marginRight: 8 }}>On the table</span><b style={{ color: 'var(--text)' }}>{a.recommendation.optionLabel}</b> · {a.recommendation.impact} {c.impactUnit}</div>
    </div>
    <div className="col" style={{ gap: 14 }}>
      {b.done.map((d, i) => <React.Fragment key={d.id}>
        <Ceo key={'q' + i} name={ceo.name}><div className="eyebrow mb-4">{d.kind} challenge</div><span className="serif" style={{ fontSize: 16.5 }}>“{d.prompt}”</span></Ceo>
        <You>{d.response}</You>
        <Ceo key={'r' + i} name={ceo.name}><span className="serif" style={{ fontSize: 16 }}>“{d.reaction}”</span><div className="row gap-10 mt-8"><div className="bar thin grow"><motion.i initial={{ width: 0 }} animate={{ width: `${d.score * 100}%` }} transition={{ duration: 0.9 }} style={{ background: tone(d.score) }} /></div><span className="mono xs" style={{ color: tone(d.score) }}>{Math.round(d.score * 100)}</span><Tip label={`Covered ${d.covered} of ${d.of} points a strong answer makes · ${d.mode}`}><Icon name="info" size={13} className="muted" /></Tip></div></Ceo>
      </React.Fragment>)}
      {busy && <motion.div className="exec" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span className="exec-av">{initials(ceo.name)}</span><div className="bubble them"><span className="xs muted" style={{ marginRight: 8 }}>{ceo.name.split(' ')[0]} is weighing your answer</span><span className="typing"><i /><i /><i /></span></div></motion.div>}
      {!busy && b.current && <Ceo key={'cur' + b.current.id} name={ceo.name}><div className="eyebrow acc mb-4">{b.current.kind} challenge · {b.done.length + 1} of {b.total}</div><span className="board-q" style={{ fontSize: 20 }}>“<Typewriter text={b.current.prompt} onDone={() => setTyped(true)} />”</span></Ceo>}
      {!busy && !b.current && b.twist && !b.twist.answer && <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="row gap-10 mb-12" style={{ justifyContent: 'center' }}><span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, var(--neg))' }} /><span className="chip neg"><Icon name="bolt" size={11} />{b.twist.title}</span><span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, var(--neg), transparent)' }} /></div>
        <Ceo key="twist" name={ceo.name}><span className="board-q" style={{ fontSize: 20 }}>“<Typewriter text={b.twist.prompt} onDone={() => setTyped(true)} />”</span>
          <div className="panel pad mt-12" style={{ background: 'var(--bg-2)', padding: 12 }}><div className="eyebrow mb-8">New facts on the table</div>{b.twist.facts.map((x) => <div key={x} className="row gap-6 small t2" style={{ padding: '3px 0' }}><Icon name="arrow" size={11} className="neg" />{x}</div>)}</div></Ceo></motion.div>}
    </div>
    {(b.current || (b.twist && !b.twist.answer)) && !busy && <motion.div className="panel pad mt-16" style={{ borderColor: typed ? 'var(--accent-line)' : undefined }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: typed ? 1 : 0.55, y: 0 }}>
      {!b.current && <div className="col mb-12" style={{ gap: 6 }}>{b.twist.stances.map((s) => <label key={s.id} className={`ds ${stance === s.id ? 'on' : ''}`} style={{ cursor: 'pointer' }}><span className="row gap-10"><input type="radio" name="st" checked={stance === s.id} onChange={() => setStance(s.id)} /><span className="small">{s.label}</span></span></label>)}</div>}
      <div className="row wrap gap-6 mb-8"><span className="xs muted">Cite your evidence:</span>{a.evidence.slice(0, 8).map((e) => <button key={e.ref} type="button" className="chip line btnlike" onClick={() => cite(e.label.split(',')[0].split(' — ').slice(-1)[0])}><Icon name={e.kind === 'data' ? 'data' : e.kind === 'interview' ? 'chat' : 'calc'} size={10} />{e.label.split(',')[0].slice(0, 30)}</button>)}</div>
      <textarea ref={ta} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && wc >= 12 && !busy) { if (b.current) act('defend', { response: text }).catch(() => {}); else if (stance) act('twist', { stance, text }).catch(() => {}); } }} className="textarea" style={{ minHeight: 120, fontSize: 14.5 }} placeholder={b.current ? 'Answer as you would in the room. Use your evidence and your numbers.' : 'What does this change, and what does it not?'} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row between mt-8"><span className="xs muted">{wc} words{wc < 25 ? ' · aim for 40–120' : ''} · ⌘↵ to send</span>
        {b.current ? <button className="btn primary lg" disabled={busy || wc < 12} onClick={() => act('defend', { response: text }).catch(() => {})}><Icon name="arrow" size={14} />Respond</button>
          : <button className="btn primary lg" disabled={busy || !stance || wc < 12} onClick={() => act('twist', { stance, text }).catch(() => {})}><Icon name="gavel" size={14} />Give final answer</button>}</div>
    </motion.div>}
    {busy && !b.current && b.twist && <div className="panel pad mt-16 row gap-10"><span className="typing"><i /><i /><i /></span><span className="small t2">Scoring your investigation and building your evidence trail…</span></div>}
    <div ref={end} style={{ height: 1 }} />
  </div>;
}
