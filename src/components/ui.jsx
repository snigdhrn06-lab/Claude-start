import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
export { AnimatePresence as Presence, motion };
import { api } from '../api.js';

// ---------- Icons (custom stroke set)
const P = {
  command: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  vault: 'M4 5h16v14H4zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 9v-1M15 12h1M4 9H2M4 15H2',
  daily: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  arena: 'M6 4l6 4 6-4v9c0 4-3 6-6 7-3-1-6-3-6-7zM12 8v12',
  board: 'M5 20V10M12 20V4M19 20v-7',
  progress: 'M3 17l5-5 4 3 8-9M15 6h5v5',
  cert: 'M6 3h12v12H6zM9 7h6M9 10h6M9 15l-1 6 4-2 4 2-1-6',
  class: 'M3 9l9-5 9 5-9 5zM7 11.5V16c1.5 1.5 3.2 2 5 2s3.500-.5 5-2v-4.500M21 9v6',
  user: 'M12 12m-4-4a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21c1-4 4-6 8-6s7 2 8 6',
  check: 'M4 12l5 5L20 6', x: 'M5 5l14 14M19 5L5 19', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M19 12H5M11 6l-6 6 6 6', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2', flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', search: 'M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M16 16l4 4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  play: 'M7 5l12 7-12 7z', pause: 'M7 5v14M17 5v14', sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M19 5l-1.500 1.500M6.500 17.500L5 19', moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.500c.7.7 1 1.500 1 2.500h6c0-1 .3-1.800 1-2.500A6 6 0 0 0 12 3z', data: 'M4 6c0-1.700 3.600-3 8-3s8 1.300 8 3-3.600 3-8 3-8-1.300-8-3zM4 6v6c0 1.700 3.600 3 8 3s8-1.300 8-3V6M4 12v6c0 1.700 3.600 3 8 3s8-1.300 8-3v-6',
  calc: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01', chat: 'M4 5h16v11H9l-5 4z', doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  gavel: 'M13 5l6 6M10 8l6 6M11.500 6.500l-5 5M17.500 12.500l-5 5M4 20l7-7M14 21h7', replay: 'M4 12a8 8 0 1 0 3-6.200M4 4v5h5', target: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  logout: 'M9 4H5v16h4M14 8l4 4-4 4M18 12H9', download: 'M12 4v11M7 11l5 5 5-5M5 20h14', info: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v6M12 7.500v.01', star: 'M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5zM10 20.5a2 2 0 0 0 4 0', cmd: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18', copy: 'M8 8h11v11H8zM5 16V5h11', chevron: 'M6 9l6 6 6-6', settings: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M19.4 15a1.700 1.700 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1A1.700 1.700 0 0 0 4.600 9a1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z',
  team: 'M9 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c.5-3 2.500-5 6-5s5.500 2 6 5M17 7a3 3 0 0 1 0 6M18 15c2 .5 3 2.300 3.500 5', swords: 'M5 4l9 9M5 4v3l8 8M19 4l-9 9M19 4v3l-8 8M5 20l3-3M19 20l-3-3', pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7', menu: 'M4 7h16M4 12h16M4 17h16',
  tree: 'M12 4v5M6 13V9h12v4M6 13v0M4 13h4v5H4zM10 13h4v5h-4zM16 13h4v5h-4z', scale: 'M12 4v16M6 20h12M5 8h14M5 8l-2 6h4zM19 8l-2 6h4z', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z', chess: 'M9 21h6M8 18h8M10 18c0-4-2-5-2-8a4 4 0 0 1 8 0c0 3-2 4-2 8',
};
export function Icon({ name, size = 16, sw = 1.6, style, className }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true"><path d={(P[name] || P.info).replace(/(\d)\.(\d)00/g, '$1.$2')} /></svg>;
}

// ---------- Rank insignia: nested hexagons, one more facet per rank; each rank has its own mark.
export const RANKS = [
  { id: 'bronze', name: 'Bronze', color: '#C98A57' }, { id: 'silver', name: 'Silver', color: '#B9C3CE' }, { id: 'gold', name: 'Gold', color: '#E9BE55' },
  { id: 'master', name: 'Master', color: '#E46B5F' }, { id: 'expert', name: 'Expert', color: '#45C2AE' }, { id: 'grandmaster', name: 'Grandmaster', color: '#F3EAD6' },
];
export const rankMeta = (id) => RANKS.find((r) => r.id === id) || RANKS[0];
export function RankEmblem({ rank = 'bronze', size = 36, muted = false, glow = false }) {
  const i = Math.max(0, RANKS.findIndex((r) => r.id === rank)); const c = muted ? 'var(--faint)' : RANKS[i].color; const gid = `rg-${rank}-${muted ? 'm' : 'c'}`;
  const hex = (r) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
  return (
    <svg className={`emblem ${glow && !muted ? 'insignia-glow' : ''}`} style={{ '--rank': c }} width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`${RANKS[i].name} rank`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity="0.32" /><stop offset="1" stopColor={c} stopOpacity="0.04" /></linearGradient></defs>
      <polygon points={hex(18)} fill={`url(#${gid})`} stroke={c} strokeWidth="1.4" />
      {i >= 1 && <polygon points={hex(13.5)} fill="none" stroke={c} strokeWidth="0.9" strokeOpacity="0.65" />}
      {i >= 3 && <polygon points={hex(9.5)} fill={c} fillOpacity="0.16" stroke={c} strokeWidth="0.9" />}
      {rank === 'bronze' && <circle cx="20" cy="20" r="3" fill={c} />}
      {rank === 'silver' && <path d="M20 14.5l5.5 5.5-5.5 5.5-5.5-5.5z" fill={c} />}
      {rank === 'gold' && <path d="M20 12l2.3 5.2 5.7.6-4.3 3.8 1.3 5.6L20 24.3l-5 2.9 1.3-5.6-4.3-3.8 5.7-.6z" fill={c} />}
      {rank === 'master' && <path d="M13 24l2-9 5 5 5-5 2 9z" fill={c} />}
      {rank === 'expert' && <><circle cx="20" cy="20" r="5.2" fill="none" stroke={c} strokeWidth="1.6" /><circle cx="20" cy="20" r="1.9" fill={c} /><path d="M20 11.5v3M20 25.5v3M11.5 20h3M25.5 20h3" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></>}
      {rank === 'grandmaster' && <><path d="M12 24.5l2.2-10 5.8 5.5 5.8-5.5 2.2 10z" fill={c} /><circle cx="20" cy="11" r="1.7" fill={c} /><path d="M12 27h16" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></>}
    </svg>
  );
}

export const DemoTag = () => <span className="demo-tag" title="Seeded demo data, not a real person">Demo</span>;
export const initials = (n = '') => n.replace(/^Prof\. /, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export function Person({ name, demo, rank, sub, size = 28 }) {
  return <span className="row gap-6" style={{ minWidth: 0 }}><span className="avatar" style={{ width: size, height: size }}>{initials(name)}</span><span className="col" style={{ gap: 0, minWidth: 0 }}><span className="row gap-6"><span className="truncate" style={{ fontWeight: 500 }}>{name}</span>{demo && <DemoTag />}{rank && <RankEmblem rank={rank} size={16} />}</span>{sub && <span className="xs muted truncate">{sub}</span>}</span></span>;
}

export function Bar({ value, max = 100, color, className = '' }) { return <div className={`bar ${className}`}><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} /></div>; }
export function Skeleton({ h = 120, className = '' }) { return <div className={`skel ${className}`} style={{ height: h }} />; }
export function PageSkeleton() { return <div className="page"><Skeleton h={34} className="mb-16" /><div className="grid g3"><Skeleton h={150} /><Skeleton h={150} /><Skeleton h={150} /></div><Skeleton h={280} className="mt-16" /></div>; }
export function Empty({ icon = 'info', title, children, action }) { return <div className="empty"><span className="empty-ico"><Icon name={icon} size={20} /></span><div className="t">{title}</div>{children && <div className="small" style={{ maxWidth: 420 }}>{children}</div>}{action}</div>; }
export function ErrorState({ error, retry }) { return <div className="page"><div className="panel"><Empty icon="x" title="This did not load" action={retry && <button className="btn sm mt-8" onClick={retry}>Try again</button>}>{error?.message}</Empty></div></div>; }

export function CountUp({ value, duration = 900, decimals = 0, prefix = '', suffix = '' }) {
  const [v, setV] = useState(value); const from = useRef(value);
  useEffect(() => { const a = from.current, b = Number(value) || 0; if (a === b) return; let raf; const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - p, 3); setV(a + (b - a) * e); if (p < 1) raf = requestAnimationFrame(tick); else from.current = b; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [value, duration]);
  return <>{prefix}{Number(v).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };
function useEsc(fn) { useEffect(() => { const k = (e) => e.key === 'Escape' && fn?.(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [fn]); }
export function Modal({ onClose, children, width, className = '', label }) {
  useEsc(onClose);
  return <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
    <motion.div className={`modal ${className}`} style={width ? { width: `min(${width}px, 100%)` } : null} role="dialog" aria-modal="true" aria-label={label} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={SPRING}>{children}</motion.div></motion.div>;
}
export function Drawer({ onClose, children, width }) {
  useEsc(onClose);
  return <><motion.div className="scrim" style={{ background: 'rgba(3,4,6,0.5)' }} onMouseDown={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.aside className="drawer" style={width ? { width: `min(${width}px, 100%)` } : null} role="dialog" aria-modal="true" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={SPRING}>{children}</motion.aside></>;
}
export function Tabs({ tabs, value, onChange }) {
  const id = useId();
  return <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'on' : ''}`} onClick={() => onChange(t.id)}>{t.label}{t.count != null && <span className="mono muted xs" style={{ marginLeft: 6 }}>{t.count}</span>}{value === t.id && <motion.span layoutId={`ink-${id}`} className="tab-ink" transition={SPRING} />}</button>)}</div>;
}
export function Seg({ options, value, onChange }) {
  const id = useId();
  return <div className="seg">{options.map((o) => <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{value === o.id && <motion.span layoutId={`seg-${id}`} className="seg-ink" transition={SPRING} />}{o.label}</button>)}</div>;
}
export function Field({ label, error, hint, children }) { return <div className={`field ${error ? 'bad' : ''}`}>{label && <label>{label}</label>}{children}{error ? <span className="err">{error}</span> : hint ? <span className="xs muted">{hint}</span> : null}</div>; }

// ---------- Tooltip: delayed, positioned above the trigger, keyboard-accessible.
export function Tip({ label, children, delay = 320, side = 'top' }) {
  const [pos, setPos] = useState(null); const t = useRef(); const ref = useRef();
  const show = () => { clearTimeout(t.current); t.current = setTimeout(() => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ x: r.left + r.width / 2, y: side === 'top' ? r.top : r.bottom }); }, delay); };
  const hide = () => { clearTimeout(t.current); setPos(null); };
  useEffect(() => () => clearTimeout(t.current), []);
  return <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} style={{ display: 'inline-flex' }}>{children}
    <AnimatePresence>{pos && label && <motion.span className="tip" role="tooltip" initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
      style={{ left: Math.min(window.innerWidth - 140, Math.max(140, pos.x)), top: pos.y, translate: side === 'top' ? '-50% calc(-100% - 8px)' : '-50% 8px' }}>{label}</motion.span>}</AnimatePresence></span>;
}

// ---------- Dropdown menu anchored to a trigger. Closes on outside click / Escape.
export function Dropdown({ trigger, children, align = 'right', width = 280 }) {
  const [open, setOpen] = useState(false); const ref = useRef();
  useEffect(() => { if (!open) return; const f = (e) => !ref.current?.contains(e.target) && setOpen(false); const k = (e) => e.key === 'Escape' && setOpen(false); document.addEventListener('mousedown', f); window.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', f); window.removeEventListener('keydown', k); }; }, [open]);
  return <div ref={ref} style={{ position: 'relative' }}>{trigger({ open, toggle: () => setOpen((o) => !o) })}
    <AnimatePresence>{open && <motion.div className="menu" role="menu" style={{ [align]: 0, top: 'calc(100% + 8px)', width }} initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.16, ease: [0.22, 0.8, 0.24, 1] }} onClick={(e) => e.target.closest('[data-close]') && setOpen(false)}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</motion.div>}</AnimatePresence></div>;
}

// ---------- Cursor spotlight for interactive surfaces.
export const spotlight = (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); };

// ---------- Copy with confirmation.
export function CopyButton({ text, label = 'Copy', className = 'btn sm' }) {
  const [done, setDone] = useState(false);
  return <button className={className} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { setDone(false); } }}><Icon name={done ? 'check' : 'copy'} size={13} className={done ? 'pos' : ''} />{done ? 'Copied' : label}</button>;
}

// ---------- Confetti: one canvas burst, auto-removed. Rare by design; skipped under reduced motion.
export function celebrate({ count = 140, colors = ['#E0AD55', '#F3CD82', '#3FD4BD', '#ECE8DF', '#72AEE3'], origin = { x: 0.5, y: 0.35 } } = {}) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; document.body.appendChild(c); const g = c.getContext('2d'); g.scale(dpr, dpr);
  const P = Array.from({ length: count }, () => { const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9; return { x: innerWidth * origin.x, y: innerHeight * origin.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], s: Math.random() > 0.5 }; });
  const t0 = performance.now();
  const tick = (t) => { const el = t - t0; g.clearRect(0, 0, innerWidth, innerHeight); for (const p of P) { p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - el / 2600); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; p.s ? g.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25) : (g.beginPath(), g.arc(0, 0, p.r / 1.6, 0, 7), g.fill()); g.restore(); }
    if (el < 2700) requestAnimationFrame(tick); else c.remove(); };
  requestAnimationFrame(tick);
}

// ---------- Toasts (tone: '', good, bad, ach)
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = '', opts = {}) => { const id = Math.random(); setItems((x) => [...x.slice(-3), { id, text, tone, ...opts }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), opts.ms || (tone === 'ach' ? 5200 : 3600)); }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toasts" aria-live="polite"><AnimatePresence initial={false}>{items.map((t) => <motion.div layout key={t.id} className={`toast ${t.tone}`} initial={{ opacity: 0, x: 30, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, transition: { duration: 0.18 } }} transition={SPRING}>
    {t.tone === 'good' && <Icon name="check" size={15} className="pos" />}{t.tone === 'bad' && <Icon name="x" size={15} className="neg" />}
    {t.tone === 'ach' ? <><span className="empty-ico" style={{ width: 34, height: 34, margin: 0, borderStyle: 'solid', borderColor: 'var(--accent-line)' }}><Icon name="star" size={16} /></span><span><span className="eyebrow acc" style={{ display: 'block', marginBottom: 3 }}>{t.title || 'Achievement unlocked'}</span><b>{t.text}</b>{t.sub && <span className="xs muted" style={{ display: 'block' }}>{t.sub}</span>}</span></> : t.text}</motion.div>)}</AnimatePresence></div></ToastCtx.Provider>;
}

// ---------- Data loading
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => { if (!path) return; setState((s) => ({ ...s, loading: true, error: null })); let live = true; api(path).then((data) => live && setState({ data, error: null, loading: false })).catch((error) => live && setState({ data: null, error, loading: false })); return () => { live = false; }; }, [path, ...deps]); // eslint-disable-line
  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}

export const fmtDate = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtShort = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const ago = (t) => { const d = (Date.now() - t) / 1000; return d < 90 ? 'just now' : d < 3600 ? `${Math.round(d / 60)} min ago` : d < 86400 ? `${Math.round(d / 3600)} h ago` : d < 86400 * 14 ? `${Math.round(d / 86400)} d ago` : fmtShort(t); };
export const scoreTone = (s) => (s >= 75 ? 'var(--pos)' : s >= 50 ? 'var(--accent)' : 'var(--neg)');
export const SKILL_COLOR = { structuring: 'var(--c4)', hypothesis: 'var(--c6)', evidence: 'var(--c2)', quant: 'var(--c1)', calibration: 'var(--c5)', synthesis: 'var(--c3)' };
export const DIFF_COLOR = ['', 'var(--pos)', 'var(--c2)', 'var(--accent)', 'var(--neg)', 'var(--neg)'];
