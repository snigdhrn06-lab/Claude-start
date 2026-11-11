import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  team: 'M9 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c.5-3 2.500-5 6-5s5.500 2 6 5M17 7a3 3 0 0 1 0 6M18 15c2 .5 3 2.300 3.500 5', swords: 'M5 4l9 9M5 4v3l8 8M19 4l-9 9M19 4v3l-8 8M5 20l3-3M19 20l-3-3', pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7', menu: 'M4 7h16M4 12h16M4 17h16',
  tree: 'M12 4v5M6 13V9h12v4M6 13v0M4 13h4v5H4zM10 13h4v5h-4zM16 13h4v5h-4z', scale: 'M12 4v16M6 20h12M5 8h14M5 8l-2 6h4zM19 8l-2 6h4z', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z', chess: 'M9 21h6M8 18h8M10 18c0-4-2-5-2-8a4 4 0 0 1 8 0c0 3-2 4-2 8',
};
export function Icon({ name, size = 16, sw = 1.6, style, className }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true"><path d={(P[name] || P.info).replace(/(\d)\.(\d)00/g, '$1.$2')} /></svg>;
}

// ---------- Rank emblem: nested hexagonal marks, one more facet per rank
export const RANKS = [
  { id: 'bronze', name: 'Bronze', color: '#B8794A' }, { id: 'silver', name: 'Silver', color: '#AEB7C2' }, { id: 'gold', name: 'Gold', color: '#E2B84A' },
  { id: 'expert', name: 'Expert', color: '#45B5A4' }, { id: 'master', name: 'Master', color: '#D9605A' }, { id: 'grandmaster', name: 'Grandmaster', color: '#F1E9D8' },
];
export const rankMeta = (id) => RANKS.find((r) => r.id === id) || RANKS[0];
export function RankEmblem({ rank = 'bronze', size = 36, muted = false }) {
  const i = Math.max(0, RANKS.findIndex((r) => r.id === rank)); const c = muted ? 'var(--faint)' : RANKS[i].color;
  const hex = (r) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
  return (
    <svg className="emblem" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`${RANKS[i].name} rank`}>
      <polygon points={hex(18)} fill={c} fillOpacity="0.1" stroke={c} strokeWidth="1.4" />
      {i >= 1 && <polygon points={hex(13.5)} fill="none" stroke={c} strokeWidth="1" strokeOpacity="0.7" />}
      {i >= 3 && <polygon points={hex(9.5)} fill={c} fillOpacity="0.18" stroke={c} strokeWidth="1" />}
      {i < 2 && <circle cx="20" cy="20" r={i === 0 ? 3 : 2.4} fill={c} />}
      {i === 2 && <path d="M20 12l2.300 5.200 5.700.6-4.300 3.800 1.300 5.600L20 24.300l-5 2.900 1.300-5.600-4.300-3.800 5.700-.6z" fill={c} transform="translate(0 .5) scale(1)" />}
      {i === 3 && <path d="M14 20l4.500 4.500L27 16" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {i === 4 && <path d="M13 24l2-9 5 5 5-5 2 9z" fill={c} />}
      {i === 5 && <><path d="M12 24.500l2.200-10 5.800 5.500 5.800-5.500 2.200 10z" fill={c} /><circle cx="20" cy="11" r="1.700" fill={c} /><path d="M12 27h16" stroke={c} strokeWidth="1.600" strokeLinecap="round" /></>}
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
export function Empty({ icon = 'info', title, children, action }) { return <div className="empty"><Icon name={icon} size={22} /><div className="t">{title}</div>{children && <div className="small" style={{ maxWidth: 420 }}>{children}</div>}{action}</div>; }
export function ErrorState({ error, retry }) { return <div className="page"><div className="panel"><Empty icon="x" title="This did not load" action={retry && <button className="btn sm mt-8" onClick={retry}>Try again</button>}>{error?.message}</Empty></div></div>; }

export function CountUp({ value, duration = 900, decimals = 0, prefix = '', suffix = '' }) {
  const [v, setV] = useState(value); const from = useRef(value);
  useEffect(() => { const a = from.current, b = Number(value) || 0; if (a === b) return; let raf; const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - p, 3); setV(a + (b - a) * e); if (p < 1) raf = requestAnimationFrame(tick); else from.current = b; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [value, duration]);
  return <>{prefix}{Number(v).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

export function Modal({ onClose, children, width }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}><div className="modal" style={width ? { width: `min(${width}px, 100%)` } : null} role="dialog" aria-modal="true">{children}</div></div>;
}
export function Drawer({ onClose, children, width }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <><div className="scrim" style={{ background: 'rgba(4,5,7,0.45)' }} onMouseDown={onClose} /><aside className="drawer" style={width ? { width: `min(${width}px, 100%)` } : null} role="dialog" aria-modal="true">{children}</aside></>;
}
export function Tabs({ tabs, value, onChange }) { return <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'on' : ''}`} onClick={() => onChange(t.id)}>{t.label}{t.count != null && <span className="mono muted xs" style={{ marginLeft: 6 }}>{t.count}</span>}</button>)}</div>; }
export function Seg({ options, value, onChange }) { return <div className="seg">{options.map((o) => <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>; }
export function Field({ label, error, hint, children }) { return <div className={`field ${error ? 'bad' : ''}`}>{label && <label>{label}</label>}{children}{error ? <span className="err">{error}</span> : hint ? <span className="xs muted">{hint}</span> : null}</div>; }

// ---------- Toasts
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = '') => { const id = Math.random(); setItems((x) => [...x.slice(-2), { id, text, tone }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3600); }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'good' && <Icon name="check" size={14} className="pos" />}{t.tone === 'bad' && <Icon name="x" size={14} className="neg" />}{t.text}</div>)}</div></ToastCtx.Provider>;
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
