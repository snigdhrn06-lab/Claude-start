// Global interaction layers: command palette, notifications, onboarding, daily announcement,
// rank-up ceremony and achievement unlocks. Each one has a reason to exist and remembers dismissal.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api.js';
import { ago, celebrate, CountUp, Icon, Modal, RankEmblem, RANKS, rankMeta, useToast } from './ui.jsx';

const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
export { store };

// ------------------------------------------------------------------ celebrations
const CelebrateCtx = createContext({ report: () => {} });
export const useCelebrate = () => useContext(CelebrateCtx);

export function CelebrationHost({ children }) {
  const toast = useToast(); const [rankUp, setRankUp] = useState(null);
  // applied: { rankBefore, rankAfter, achievements[], certificates[], xpAfter } from the server. key prevents replays.
  const report = useCallback((applied, { key, xp } = {}) => {
    if (!applied) return; const seen = store.get('cb_celebrated', []);
    if (key && seen.includes(key)) return; if (key) store.set('cb_celebrated', [...seen.slice(-80), key]);
    const achs = applied.achievements || [];
    if (applied.rankAfter > applied.rankBefore) { setRankUp({ from: applied.rankBefore, to: applied.rankAfter, xp: xp ?? 0, xpAfter: applied.xpAfter, cert: applied.certificates?.[0] }); setTimeout(() => celebrate({ count: 180 }), 450); }
    achs.forEach((a, i) => setTimeout(() => toast(a.name, 'ach', { sub: a.desc }), 700 + i * 900));
    if (achs.length && !(applied.rankAfter > applied.rankBefore)) setTimeout(() => celebrate({ count: 70, origin: { x: 0.85, y: 0.85 } }), 600);
  }, [toast]);
  return <CelebrateCtx.Provider value={{ report }}>{children}<AnimatePresence>{rankUp && <RankUpModal key="ru" {...rankUp} onClose={() => setRankUp(null)} />}</AnimatePresence></CelebrateCtx.Provider>;
}

const RANK_REWARD = {
  silver: ['CloudAxis, the expert case', 'Hypothesis Duel and Boardroom Blitz', 'Your first Consult Brain certificate'],
  gold: ['Market Strategy Challenge', 'Weekly tournament entry', 'Gold certificate'],
  master: ['Master division on the leaderboards', 'Master certificate'],
  expert: ['Expert division', 'Expert certificate'],
  grandmaster: ['Grandmaster hall of fame', 'Grandmaster certificate'],
};
export function RankUpModal({ from, to, xp, xpAfter, cert, onClose }) {
  const nav = useNavigate(); const r = RANKS[to]; const prev = RANKS[from];
  return <Modal onClose={onClose} width={560} label={`Promoted to ${r.name}`} className="rankup">
    <div style={{ position: 'relative', overflow: 'hidden', padding: '34px 30px 26px', textAlign: 'center', background: `radial-gradient(60% 70% at 50% 18%, ${r.color}33, transparent 70%)` }}>
      <svg viewBox="0 0 400 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }} aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2; return <motion.line key={i} x1="200" y1="96" x2={200 + Math.cos(a) * 260} y2={96 + Math.sin(a) * 260} stroke={r.color} strokeOpacity="0.16" strokeWidth="1" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 0.15 + i * 0.015 }} />; })}
      </svg>
      <div className="eyebrow" style={{ position: 'relative', color: r.color }}>Promotion</div>
      <motion.div style={{ position: 'relative', display: 'inline-block', marginTop: 14 }} initial={{ scale: 0.3, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 13, delay: 0.15 }}>
        <RankEmblem rank={r.id} size={128} glow />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} style={{ position: 'relative' }}>
        <div className="xs muted mt-12 row gap-6" style={{ justifyContent: 'center' }}><RankEmblem rank={prev.id} size={16} />{prev.name}<Icon name="arrow" size={12} />{r.name}</div>
        <h1 className="display mt-8" style={{ color: r.color }}>{r.name}</h1>
        {xp > 0 && <div className="mono mt-8 acc" style={{ fontSize: 22 }}>+<CountUp value={xp} duration={1400} /> XP</div>}
        {xpAfter != null && <div className="xs muted mt-4">{xpAfter.toLocaleString('en-IN')} XP total</div>}
      </motion.div>
    </div>
    <div style={{ padding: '18px 28px 24px' }}>
      <div className="eyebrow mb-12">What this rank unlocks</div>
      <div className="col" style={{ gap: 8 }}>{(RANK_REWARD[r.id] || []).map((u, i) => <motion.div key={u} className="row gap-10 small" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.12 }}><Icon name="check" size={14} className="pos" />{u}</motion.div>)}</div>
      {cert && <p className="xs muted mt-12">Certificate <span className="mono">{cert}</span> has been issued by Consult Brain.</p>}
      <div className="row end mt-24"><button className="btn" onClick={() => { onClose(); nav('/progress'); }}>See the ladder</button>{cert && <button className="btn primary" onClick={() => { onClose(); nav('/certificates'); }}><Icon name="cert" size={14} />View certificate</button>}{!cert && <button className="btn primary" onClick={onClose}>Continue</button>}</div>
    </div>
  </Modal>;
}

// ------------------------------------------------------------------ onboarding (first visit per account)
export function Onboarding({ user }) {
  const key = `cb_onboarded_${user.id}`; const [open, setOpen] = useState(() => !store.get(key, false) && user.role === 'student'); const [i, setI] = useState(0); const nav = useNavigate();
  const close = () => { store.set(key, true); setOpen(false); };
  const steps = [
    { icon: 'target', t: 'Commit before you look', d: 'Every engagement starts with competing hypotheses and 100 confidence points. You are scored on how well your beliefs follow the evidence, not on guessing the answer.' },
    { icon: 'data', t: 'Spend analyst hours wisely', d: 'The data room holds more than your budget can buy. Datasets and interviews cost hours. Choose the cut that separates your top hypotheses.' },
    { icon: 'gavel', t: 'Defend it in the boardroom', d: 'Submit a structured recommendation, then answer three challenges from the client and one twist you will not see coming.' },
    { icon: 'replay', t: 'Watch your Evidence Trail', d: 'Afterwards, replay your investigation beside two expert routes: where your beliefs moved, what you missed, and where hours were wasted.' },
  ];
  return <AnimatePresence>{open && <Modal key="ob" onClose={close} width={560} label="Welcome to Consult Brain">
    <div style={{ padding: '26px 28px 22px' }}>
      <div className="row between"><span className="eyebrow acc">Welcome to Consult Brain</span><span className="mono xs muted">{i + 1} / {steps.length}</span></div>
      <AnimatePresence mode="wait"><motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
        <span className="empty-ico mt-16" style={{ width: 54, height: 54, borderStyle: 'solid', borderColor: 'var(--accent-line)' }}><Icon name={steps[i].icon} size={24} /></span>
        <h2 className="mt-12" style={{ fontSize: 26 }}>{steps[i].t}</h2><p className="t2 mt-8" style={{ fontSize: 15, lineHeight: 1.6 }}>{steps[i].d}</p>
      </motion.div></AnimatePresence>
      <div className="row mt-24" style={{ gap: 6 }}>{steps.map((_, k) => <motion.i key={k} animate={{ width: k === i ? 26 : 8, background: k <= i ? 'var(--accent)' : 'var(--surface-3)' }} style={{ height: 4, borderRadius: 3, display: 'block' }} />)}</div>
      <div className="row between mt-24"><button className="btn ghost" onClick={close}>Skip</button><div className="row">{i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
        {i < steps.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)}>Next<Icon name="arrow" size={14} /></button> : <button className="btn primary" onClick={() => { close(); nav('/vault?open=brewly'); }}>Take your first case<Icon name="arrow" size={14} /></button>}</div></div>
    </div></Modal>}</AnimatePresence>;
}

// ------------------------------------------------------------------ daily announcement: once per day, never inside an investigation, never on first visit
export function DailyAnnouncement({ user, daily }) {
  const loc = useLocation(); const nav = useNavigate(); const day = daily?.day; const key = `cb_daily_seen_${user.id}`;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!daily || daily.played || !store.get(`cb_onboarded_${user.id}`, false)) return; if (store.get(key, '') === day || store.get('cb_quiet', false)) return; const t = setTimeout(() => setOpen(true), 1400); return () => clearTimeout(t); }, [daily, day, key, user.id]);
  if (loc.pathname.startsWith('/case/') || loc.pathname.startsWith('/replay/') || loc.pathname.startsWith('/arena/') || loc.pathname === '/daily') return null;
  const close = (quiet) => { store.set(key, day); if (quiet) store.set('cb_quiet', true); setOpen(false); };
  return <AnimatePresence>{open && <motion.div key="da" className="panel announce" role="dialog" aria-label="Today's Daily Diagnostic" style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 80, width: 'min(380px, calc(100vw - 28px))', boxShadow: 'var(--shadow-lg)', borderColor: 'var(--accent-line)', overflow: 'hidden' }}
    initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
    <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--signal))' }} />
    <div className="panel-b"><div className="row between"><span className="eyebrow acc row gap-6"><Icon name="daily" size={12} />Today's Daily Diagnostic</span><button className="btn ghost sm icon" aria-label="Dismiss" onClick={() => close(false)}><Icon name="x" size={14} /></button></div>
      <h3 className="serif mt-8" style={{ fontSize: 19, fontWeight: 400 }}>{daily.title}</h3><p className="small t2 mt-4" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{daily.scenario}</p>
      <div className="row between mt-12"><button className="btn ghost sm" onClick={() => close(true)}>Don't show these</button><button className="btn primary sm" onClick={() => { close(false); nav('/daily'); }}>Diagnose · 4 min<Icon name="arrow" size={13} /></button></div></div>
  </motion.div>}</AnimatePresence>;
}

// ------------------------------------------------------------------ notifications dropdown (derived from real records)
export function Notifications() {
  const [items, setItems] = useState(null); const [open, setOpen] = useState(false); const ref = useRef(); const nav = useNavigate();
  const [seen, setSeen] = useState(() => store.get('cb_notif_seen', 0));
  useEffect(() => { api('/notifications').then((d) => setItems(d.items)).catch(() => setItems([])); }, [open]);
  useEffect(() => { if (!open) return; const f = (e) => !ref.current?.contains(e.target) && setOpen(false); document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, [open]);
  const unread = (items || []).filter((n) => n.t > seen).length;
  const KIND = { achievement: 'star', rank: 'cert', challenge: 'swords', assignment: 'class' };
  return <div ref={ref} style={{ position: 'relative' }}>
    <button className={`icon-btn ${open ? 'on' : ''}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => { setOpen(!open); if (!open && items?.length) { const t = Math.max(...items.map((n) => n.t)); store.set('cb_notif_seen', t); setTimeout(() => setSeen(t), 1500); } }}>
      <Icon name="bell" size={17} />{unread > 0 && <motion.span className="badge-dot" initial={{ scale: 0 }} animate={{ scale: 1 }}>{unread > 9 ? '9+' : unread}</motion.span>}</button>
    <AnimatePresence>{open && <motion.div className="menu" style={{ right: 0, top: 'calc(100% + 8px)', width: 360, padding: 0 }} initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
      <div className="panel-h" style={{ minHeight: 40 }}><span className="eyebrow">Notifications</span><span className="xs muted">{items?.length || 0}</span></div>
      <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>{!items ? <div className="skel" style={{ height: 120 }} /> : items.length === 0 ? <div className="empty" style={{ padding: 24 }}><div className="t">Nothing yet</div><div className="small">Achievements, certificates, challenges and assignments appear here.</div></div>
        : items.map((n) => <button key={n.id} className="menu-item" style={{ alignItems: 'flex-start' }} onClick={() => { setOpen(false); nav(n.to); }}>
          <span className="avatar" style={{ width: 30, height: 30, background: n.t > seen ? 'var(--accent-soft)' : undefined, borderColor: n.t > seen ? 'var(--accent-line)' : undefined, color: n.t > seen ? 'var(--accent)' : 'var(--muted)' }}><Icon name={KIND[n.kind] || 'info'} size={14} /></span>
          <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', color: 'var(--text)', fontWeight: 500 }}>{n.title}</span><span className="xs muted" style={{ display: 'block' }}>{n.body}</span></span><span className="xs muted" style={{ flex: 'none' }}>{ago(n.t)}</span></button>)}</div>
    </motion.div>}</AnimatePresence></div>;
}

// ------------------------------------------------------------------ command palette (⌘K / Ctrl-K)
export function CommandPalette({ user, theme, setTheme, signOut }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [i, setI] = useState(0); const [cases, setCases] = useState([]); const nav = useNavigate();
  useEffect(() => { const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } }; const o = () => setOpen(true); window.addEventListener('keydown', k); window.addEventListener('cb-palette', o); return () => { window.removeEventListener('keydown', k); window.removeEventListener('cb-palette', o); }; }, []);
  useEffect(() => { if (open) { setQ(''); setI(0); api('/cases').then((d) => setCases(d.cases)).catch(() => {}); } }, [open]);
  const go = (to) => () => nav(to);
  const items = useMemo(() => {
    const base = user.role === 'professor' ? [['Classroom', 'class', go('/classroom')], ['Case Vault', 'vault', go('/vault')], ['Leaderboards', 'board', go('/leaderboards')]]
      : [['Command Centre', 'command', go('/')], ['Case Vault', 'vault', go('/vault')], ['Daily Diagnostic', 'daily', go('/daily')], ['Arena', 'arena', go('/arena')], ['Issue Tree Arena', 'tree', go('/arena/issue-tree')], ['Margin Detective', 'search', go('/arena/margin')], ['Leaderboards', 'board', go('/leaderboards')], ['My Progress', 'progress', go('/progress')], ['Certificates', 'cert', go('/certificates')], ['Classroom', 'class', go('/classroom')], ['My profile', 'user', go(`/u/${user.id}`)]];
    const cs = cases.map((c) => [`${c.company}: ${c.title}`, 'doc', go(`/vault?open=${c.id}`), c.locked ? `Unlocks at ${c.unlockRankName}` : c.status === 'active' ? 'In progress' : c.status === 'completed' ? `Best ${c.best}` : `${c.durationMin} min · +${c.xpReward} XP`]);
    const acts = [[theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', theme === 'dark' ? 'sun' : 'moon', () => setTheme(theme === 'dark' ? 'light' : 'dark')], ['Sign out', 'logout', signOut]];
    const all = [...base.map((x) => ({ group: 'Go to', label: x[0], icon: x[1], run: x[2] })), ...cs.map((x) => ({ group: 'Cases', label: x[0], icon: x[1], run: x[2], meta: x[3] })), ...acts.map((x) => ({ group: 'Actions', label: x[0], icon: x[1], run: x[2] }))];
    return q ? all.filter((x) => x.label.toLowerCase().includes(q.toLowerCase())) : all;
  }, [q, cases, theme, user]); // eslint-disable-line
  const run = (x) => { setOpen(false); x?.run(); };
  return <AnimatePresence>{open && <Modal key="pal" onClose={() => setOpen(false)} className="palette" label="Command palette">
    <input autoFocus placeholder="Jump to a page, case or action…" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(items.length - 1, v + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(0, v - 1)); } if (e.key === 'Enter') run(items[i]); }} aria-label="Search commands" />
    <div style={{ maxHeight: 400, overflowY: 'auto', padding: 6 }}>{items.length === 0 ? <div className="empty" style={{ padding: 26 }}><div className="t">No matches</div></div> : items.map((x, k) => <React.Fragment key={x.group + x.label}>
      {(k === 0 || items[k - 1].group !== x.group) && <div className="eyebrow" style={{ padding: '10px 10px 4px' }}>{x.group}</div>}
      <button className={`menu-item ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => run(x)}><Icon name={x.icon} size={15} /><span className="grow truncate">{x.label}</span>{x.meta && <span className="xs muted">{x.meta}</span>}{k === i && <Icon name="arrow" size={13} />}</button></React.Fragment>)}</div>
    <div className="row between xs muted" style={{ padding: '9px 14px', borderTop: '1px solid var(--line)' }}><span className="row gap-6"><span className="kbd">↑</span><span className="kbd">↓</span>navigate <span className="kbd">↵</span>open</span><span className="row gap-6"><span className="kbd">esc</span>close</span></div>
  </Modal>}</AnimatePresence>;
}
