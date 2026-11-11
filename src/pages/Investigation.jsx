import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, post } from '../api.js';
import { useAuth } from '../App.jsx';
import { evaluate } from '../../shared/expr.js';
import { Bar, Empty, ErrorState, Field, Icon, initials, Modal, PageSkeleton, Seg, useToast } from '../components/ui.jsx';
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
  useEffect(() => { if (a) { localStorage.setItem(`cb_stage_${id}`, JSON.stringify(stage)); document.title = `${a.case.company} — ConsultBrain`; } }, [stage, a, id]);

  const act = useCallback(async (type, payload, { quiet } = {}) => {
    setBusy(true);
    try { const d = await post(`/attempts/${id}/action`, { type, payload }); setA(d.attempt); if (d.completed) { await refresh(); nav(`/replay/${id}?fresh=1`); } return d.attempt; }
    catch (e) { if (!quiet) toast(e.message, 'bad'); throw e; } finally { setBusy(false); }
  }, [id, nav, refresh, toast]);

  if (error) return <ErrorState error={error} retry={load} />; if (!a) return <PageSkeleton />;
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
          <div className="hide-sm" style={{ width: 230 }}><div className="row between xs"><span className="muted">Analyst hours</span><span className="mono"><b style={{ color: left <= 6 ? 'var(--neg)' : 'var(--text)' }}>{left}</b> of {a.budget} left</span></div>
            <div className="meter-seg mt-4">{Array.from({ length: a.budget / 2 }, (_, i) => <i key={i} className={i < a.hoursUsed / 2 ? (left <= 6 ? 'warn' : 'on') : ''} />)}</div></div>
          {!locked && <button className="btn sm" disabled={busy || a.hints.length >= c.hintCount} title="Each hint reduces case XP by 8%" onClick={() => act('hint').then((r) => toast(r.hints.at(-1))).catch(() => {})}><Icon name="bulb" size={14} />Hint {a.hints.length}/{c.hintCount}</button>}
          {showRail && <button className="btn sm icon railbtn" onClick={() => setRailOpen(!railOpen)} aria-label="Beliefs"><Icon name="target" /></button>}
        </div>
        <nav className="ws-stages" aria-label="Investigation stages">{STAGES.map(([sid, label, icon], i) => { const dis = sid === 'board' ? a.phase !== 'boardroom' : false; return <button key={sid} className={`stage ${stage === sid ? 'on' : ''} ${stageDone[sid] ? 'done' : ''}`} disabled={dis} onClick={() => setStage(sid)}><span className="n">{stageDone[sid] ? '✓' : i + 1}</span>{label}</button>; })}</nav>
      </header>
      <div className={`ws-body ${showRail ? '' : 'solo'}`}>
        <main className="ws-main"><div className="inner" key={stage}><View {...ctx} /></div></main>
        {showRail && <aside className={`ws-rail ${railOpen ? 'open' : ''}`}><Rail {...ctx} /></aside>}
      </div>
      {confirmExit && <Modal onClose={() => setConfirmExit(false)}><div style={{ padding: 22 }}><h2>Leave this investigation?</h2><p className="t2 mt-8">Your progress is saved. You can resume from the Case Vault, or abandon the engagement. Repeatedly abandoning cases reduces XP on later ones.</p>
        <div className="row end mt-16"><button className="btn danger" onClick={async () => { try { await post(`/attempts/${id}/abandon`); } catch {} nav('/vault'); }}>Abandon case</button><button className="btn" onClick={() => setConfirmExit(false)}>Keep working</button><button className="btn primary" onClick={() => nav('/vault')}>Save & exit</button></div></div></Modal>}
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

// ------------------------------------------------------------------ Stage 1: Brief
function Brief({ a, c, setStage }) {
  const b = c.briefing;
  return <div className="grid g12">
    <div className="s8">
      <div className="eyebrow acc mb-8">Engagement letter</div><h1>{b.subject}</h1>
      <div className="row gap-10 mt-16 mb-16"><span className="avatar" style={{ width: 38, height: 38, fontSize: 13 }}>{initials(b.from.name)}</span><div><div style={{ fontWeight: 600 }}>{b.from.name}</div><div className="xs muted">{b.from.role}</div></div></div>
      <div className="memo">{b.memo.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div className="panel pad mt-24"><div className="eyebrow mb-8">Engagement objective</div><p style={{ fontSize: 15 }}>{b.objective}</p></div>
      <div className="grid g2 mt-16"><div className="panel pad"><div className="eyebrow mb-8">Company background</div><ul className="small t2" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.65 }}>{b.background.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="panel pad"><div className="eyebrow mb-8">Constraints</div><ul className="small t2" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.65 }}>{b.constraints.map((x) => <li key={x}>{x}</li>)}</ul>
          <div className="eyebrow mt-16 mb-8">Things you have heard</div><ul className="small t2" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.65 }}>{b.context.map((x) => <li key={x}>{x}</li>)}</ul></div></div>
    </div>
    <div className="s4 col" style={{ gap: 14 }}>
      <div className="panel pad"><div className="eyebrow mb-12">Headline metrics</div><div className="grid g2">{b.metrics.map((m) => <div key={m.label}><div className="xs muted">{m.label}</div><div className="mono mt-4" style={{ fontSize: 20 }}>{m.value}</div><div className={`mono xs ${m.tone === 'up' ? 'pos' : m.tone === 'down' ? 'neg' : 'muted'}`}>{m.delta}</div></div>)}</div></div>
      <div className="panel pad"><div className="eyebrow mb-8">{b.trend.label}</div><LineChart categories={b.trend.x} series={b.trend.series} height={170} area={false} /><div className="row gap-16 xs t2 mt-4">{b.trend.series.map((s, i) => <span key={i} className="row gap-6"><span className="dot" style={{ background: PALETTE[i] }} />{s.label}</span>)}</div></div>
      <div className="panel pad"><div className="eyebrow mb-8">How this works</div><ol className="small t2" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.65 }}><li>Form competing hypotheses and commit 100 confidence points.</li><li>Spend {a.budget} analyst hours on data and interviews. You cannot afford everything.</li><li>Update your confidence as evidence arrives.</li><li>Submit a recommendation and defend it.</li></ol>
        <button className="btn primary mt-16" style={{ width: '100%' }} onClick={() => setStage('hyp')}>Form hypotheses<Icon name="arrow" size={14} /></button></div>
    </div>
  </div>;
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
        <div className="panel pad small t2"><div className="eyebrow mb-8">What good looks like</div><ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}><li>Three or more hypotheses before any data.</li><li>Different parts of the business: revenue quality, variable cost, fixed cost.</li><li>A mechanism, not a topic: “X rose because Y”.</li><li>No more than half your points on one idea at the start.</li></ul></div>
      </div>
    </div>
  </div>;
}

// ------------------------------------------------------------------ Stage 3: The Vault (data room)
const REL = { High: 'acc', Medium: 'info', Low: '' };
function Gate({ a, setStage, what }) { return <div className="panel"><Empty icon="lock" title={`Commit your hypotheses before ${what}`} action={<button className="btn primary sm mt-8" onClick={() => setStage('hyp')}>Go to hypothesis board</button>}>Form a view before you look. Hold at least two hypotheses and commit 100 confidence points; the room opens as soon as you do.</Empty></div>; }
function DataRoom({ a, c, act, busy, locked, left, pins, pin, setStage }) {
  const [sel, setSel] = useState(a.requested.at(-1) || c.datasets[0].id); const [mode, setMode] = useState('table');
  const d = c.datasets.find((x) => x.id === sel); const got = a.datasets[sel];
  const cats = [...new Set(c.datasets.map((x) => x.category))];
  if (!a.allocCommitted && !a.requested.length) return <Gate a={a} setStage={setStage} what="opening The Vault" />;
  return <div>
    <div className="row between wrap gap-16 mb-16"><div><div className="eyebrow acc mb-8">The Vault</div><h1>Investigative data room</h1><p className="t2 mt-8" style={{ maxWidth: 640 }}>{c.datasets.length} datasets are available for {c.datasets.reduce((s, x) => s + x.cost, 0)} analyst hours. You have {a.budget}. Decide what is worth knowing.</p></div>
      <div className="row gap-16"><div className="kpi"><span className="v">{a.requested.length}</span><span className="xs muted">received</span></div><div className="kpi"><span className="v" style={{ color: left <= 6 ? 'var(--neg)' : 'inherit' }}>{left}h</span><span className="xs muted">remaining</span></div></div></div>
    <div className="grid g12">
      <div className="s4 col" style={{ gap: 14 }}>{cats.map((cat) => <div key={cat}><div className="eyebrow mb-8">{cat}</div><div className="col" style={{ gap: 6 }}>{c.datasets.filter((x) => x.category === cat).map((x) => { const have = a.requested.includes(x.id); return (
        <button key={x.id} className={`ds ${sel === x.id ? 'on' : ''} ${have ? 'got' : ''}`} onClick={() => setSel(x.id)}>
          <span style={{ fontWeight: 500 }}>{x.title}</span><span className="mono small" style={{ color: have ? 'var(--pos)' : !locked && x.cost > left ? 'var(--neg)' : 'var(--text-2)' }}>{have ? '✓' : `${x.cost}h`}</span>
          <span className="xs muted" style={{ gridColumn: '1 / -1' }}>{have ? `Received · request #${a.requested.indexOf(x.id) + 1}` : `Expected relevance: ${x.relevance}`}</span></button>); })}</div></div>)}</div>
      <div className="s8"><div className="panel" style={{ position: 'sticky', top: 0 }}>
        <div className="panel-h"><div style={{ minWidth: 0 }}><div className="truncate" style={{ fontWeight: 600 }}>{d.title}</div><div className="xs muted">{d.category}</div></div>{got ? got.chart && <Seg value={mode} onChange={setMode} options={[{ id: 'table', label: 'Table' }, { id: 'chart', label: 'Chart' }]} /> : <span className={`chip ${REL[d.relevance]}`}>Expected relevance: {d.relevance}</span>}</div>
        {!got ? <div className="panel-b"><p className="t2">{d.description}</p>
          <div className="grid g3 mt-16"><div><div className="xs muted">Cost</div><div className="mono mt-4" style={{ fontSize: 20 }}>{d.cost}h</div></div><div><div className="xs muted">Hours after request</div><div className="mono mt-4" style={{ fontSize: 20, color: left - d.cost < 0 ? 'var(--neg)' : 'inherit' }}>{left - d.cost}h</div></div><div><div className="xs muted">Status</div><div className="mt-4">Not requested</div></div></div>
          <p className="xs muted mt-16">“Expected relevance” is the analyst team's guess before pulling the data. It is sometimes wrong.</p>
          {locked ? <div className="callout mt-12">The investigation closed when you submitted your recommendation.</div> : a.pendingEvidence.length > 0 ? <div className="callout mt-12 small">You have evidence you have not responded to. Requesting now records that you moved on without updating. <b>Update or hold in the belief ledger first</b> — or proceed.</div> : null}
          {!locked && <button className="btn primary mt-16" disabled={busy || d.cost > left} onClick={() => act('data_request', { datasetId: d.id }).then(() => setMode('table')).catch(() => {})}><Icon name="data" size={14} />{d.cost > left ? 'Not enough hours' : `Request for ${d.cost} analyst hours`}</button>}</div>
        : mode === 'chart' && got.chart ? <div className="panel-b">{got.chart.type === 'line' ? <LineChart categories={got.chart.categories} series={got.chart.series} unit="" height={260} yMin={Math.floor(Math.min(...got.chart.series.flatMap((s) => s.values)) * 0.9)} /> : <BarChart categories={got.chart.categories} series={got.chart.series} unit={got.chart.unit} height={280} />}</div>
        : <><div className="scroll-x"><table className="table"><thead><tr>{got.table.columns.map((col) => <th key={col.key} className={col.fmt === 'text' ? '' : 'n'}>{col.label}</th>)}</tr></thead>
          <tbody>{got.table.rows.map((r, ri) => <tr key={ri}>{got.table.columns.map((col, ci) => { const v = r[col.key]; const numeric = col.fmt !== 'text' && typeof v === 'number'; const label = `${r[got.table.columns[0].key]} · ${col.label}`; const on = numeric && pins.some((p) => p.value === v && p.label === label);
            return <td key={col.key} className={`${col.fmt === 'text' ? '' : 'n'} ${numeric ? 'pin' : ''} ${on ? 'pinned' : ''}`} style={ci === 0 ? { fontWeight: 500 } : null} title={numeric ? 'Click to pin to the workbench' : undefined} onClick={() => numeric && pin(v, label)}>{fmtCell(v, col.fmt)}</td>; })}</tr>)}</tbody></table></div>
          <div className="row between xs muted" style={{ padding: '9px 14px', borderTop: '1px solid var(--line)' }}><span><Icon name="pin" size={12} style={{ verticalAlign: -2 }} /> Click any number to pin it to the workbench as a variable.</span><button className="btn ghost sm" onClick={() => setStage('bench')}>Workbench<Icon name="arrow" size={12} /></button></div></>}
      </div></div>
    </div>
  </div>;
}

// ------------------------------------------------------------------ Stage 4: Quantitative workbench
function Workbench({ a, c, act, busy, locked, pins, setPins, setStage, toast }) {
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
          <div key={q.id} style={{ padding: '12px 16px', borderBottom: i < c.quant.length - 1 ? '1px solid var(--line)' : 0, opacity: missing.length ? 0.6 : 1 }}>
            <div className="row gap-6" style={{ alignItems: 'flex-start' }}><span className="mono xs muted" style={{ paddingTop: 2 }}>Q{i + 1}</span><span className="small" style={{ lineHeight: 1.45 }}>{q.prompt}</span></div>
            {missing.length ? <div className="xs muted mt-8"><Icon name="lock" size={11} style={{ verticalAlign: -1 }} /> Needs: {missing.map((r) => c.datasets.find((d) => d.id === r).title).join('; ')}</div>
              : closed ? <div className={`callout ${st.correct ? 'pos' : 'neg'} small mt-8`}><b>{st.correct ? `Correct${st.tries === 1 ? ' on the first attempt' : ''}.` : `Not within tolerance (you entered ${st.value}).`}</b> {st.explain}</div>
              : <div className="row mt-8"><input className="input num" style={{ width: 130 }} inputMode="decimal" placeholder={q.unit} value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && ans[q.id] && act('quant_answer', { qid: q.id, value: Number(String(ans[q.id]).replace(/[,%₹$]/g, '')) }).then((r) => toast(r.quant[q.id].correct ? 'Correct' : 'Not within tolerance', r.quant[q.id].correct ? 'good' : 'bad')).catch(() => {})} aria-label={`Answer to question ${i + 1}`} /><span className="xs muted">{q.unit}</span>
                <button className="btn sm" disabled={busy || locked || !ans[q.id]} onClick={() => act('quant_answer', { qid: q.id, value: Number(String(ans[q.id]).replace(/[,%₹$]/g, '')) }).then((r) => toast(r.quant[q.id].correct ? 'Correct' : 'Not within tolerance', r.quant[q.id].correct ? 'good' : 'bad')).catch(() => {})}>Check</button>
                <span className="xs muted" style={{ marginLeft: 'auto' }}>{st ? `${3 - st.tries} attempt${3 - st.tries === 1 ? '' : 's'} left` : '3 attempts'}</span></div>}
          </div>); })}</div></div>
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
    {confirm && <Modal onClose={() => setConfirm(false)}><div style={{ padding: 22 }}><h2>Submit your recommendation?</h2><p className="t2 mt-8">You will not be able to request more data, interview anyone or change your hypotheses. {a.pendingEvidence.length > 0 && <b>You have evidence you have not updated on — commit or hold first if you want that recorded.</b>}</p><div className="row end mt-16"><button className="btn" onClick={() => setConfirm(false)}>Keep investigating</button><button className="btn primary" onClick={submit}>Submit and face the board</button></div></div></Modal>}
  </div>;
}

// ------------------------------------------------------------------ Stage 7: Boardroom defence
function Boardroom({ a, c, act, busy }) {
  const b = a.boardroom; const [text, setText] = useState(''); const [stance, setStance] = useState(''); const [shown, setShown] = useState(b?.done.length || 0);
  if (!b) return <div className="panel"><Empty icon="gavel" title="The boardroom opens after you submit a recommendation" /></div>;
  const lastDone = b.done.at(-1); const reviewing = shown < b.done.length; // show reaction before the next challenge
  const wc = text.trim().split(/\s+/).filter(Boolean).length; const n = b.done.length + 1;
  return <div style={{ maxWidth: 820, margin: '0 auto' }}>
    <div className="row between mb-16"><div className="row gap-10"><span className="avatar" style={{ width: 44, height: 44, fontSize: 15, borderColor: 'var(--accent)' }}>{initials(b.ceo.name)}</span><div><div style={{ fontWeight: 600 }}>{b.ceo.name}</div><div className="xs muted">{b.ceo.role}, {c.company} · Boardroom defence</div></div></div>
      <div className="row gap-6">{Array.from({ length: b.total + 1 }, (_, i) => <i key={i} style={{ width: 26, height: 4, borderRadius: 2, background: i < b.done.length + (b.twist?.answer ? 1 : 0) ? 'var(--accent)' : i === b.done.length && !reviewing ? 'var(--text-2)' : 'var(--surface-3)' }} />)}</div></div>
    <div className="panel pad small t2 mb-16"><span className="eyebrow" style={{ marginRight: 8 }}>You recommended</span><b style={{ color: 'var(--text)' }}>{a.recommendation.optionLabel}</b> · expected impact {a.recommendation.impact} {c.impactUnit}</div>
    {reviewing ? <div key={'r' + shown} style={{ animation: 'rise 0.35s' }}>
      <div className="eyebrow mb-8">{lastDone.kind} challenge — response heard</div>
      <p className="board-q">“{lastDone.reaction}”</p>
      <div className="panel pad mt-16"><div className="row between"><span className="eyebrow">How it landed</span><span className="mono" style={{ fontSize: 20, color: lastDone.score >= 0.6 ? 'var(--pos)' : lastDone.score >= 0.35 ? 'var(--accent)' : 'var(--neg)' }}>{Math.round(lastDone.score * 100)}</span></div><Bar value={lastDone.score * 100} className="mt-8" color={lastDone.score >= 0.6 ? 'var(--pos)' : lastDone.score >= 0.35 ? 'var(--accent)' : 'var(--neg)'} />
        <p className="xs muted mt-8">Addressed {lastDone.covered} of {lastDone.of} things a strong answer covers · assessed by {lastDone.mode}. Full feedback follows in the replay.</p></div>
      <button className="btn primary lg mt-16" onClick={() => { setShown(b.done.length); setText(''); }}>{b.current ? 'Next challenge' : 'Continue'}<Icon name="arrow" size={14} /></button></div>
    : b.current ? <div key={b.current.id} style={{ animation: 'rise 0.35s' }}>
      <div className="eyebrow acc mb-8">Challenge {n} of {b.total} · {b.current.kind}</div>
      <p className="board-q">“{b.current.prompt}”</p>
      <textarea className="textarea mt-16" style={{ minHeight: 150, fontSize: 14.5 }} placeholder="Answer as you would in the room. Use your evidence and your numbers." value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <div className="row between mt-8"><span className="xs muted">{wc} words{wc < 25 ? ' · aim for 40–120' : ''}</span><button className="btn primary lg" disabled={busy || wc < 12} onClick={() => act('defend', { response: text }).catch(() => {})}>{busy ? 'The room is listening…' : 'Respond'}</button></div></div>
    : b.twist && !b.twist.answer ? <div style={{ animation: 'rise 0.35s' }}>
      <div className="eyebrow neg mb-8">Something has changed · {b.twist.title}</div>
      <p className="board-q">“{b.twist.prompt}”</p>
      <div className="panel pad mt-16"><div className="eyebrow mb-8">New facts on the table</div><ul className="small t2" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>{b.twist.facts.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div className="col mt-16" style={{ gap: 6 }}>{b.twist.stances.map((s) => <label key={s.id} className={`ds ${stance === s.id ? 'on' : ''}`} style={{ cursor: 'pointer' }}><span className="row gap-10"><input type="radio" name="st" checked={stance === s.id} onChange={() => setStance(s.id)} /><span>{s.label}</span></span></label>)}</div>
      <textarea className="textarea mt-12" style={{ minHeight: 120, fontSize: 14.5 }} placeholder="Explain your position. What does this change, and what does it not?" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row between mt-8"><span className="xs muted">{wc} words</span><button className="btn primary lg" disabled={busy || !stance || wc < 12} onClick={() => act('twist', { stance, text }).catch(() => {})}>{busy ? 'Scoring your investigation…' : 'Give final answer'}</button></div></div>
    : <div className="panel"><Empty icon="check" title="Defence complete">Preparing your evidence trail…</Empty></div>}
  </div>;
}
