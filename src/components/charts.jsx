import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
const nice = (max) => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-IN') : Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

function useWidth() {
  const ref = useRef(null); const [w, setW] = useState(600);
  useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver(([e]) => setW(Math.max(220, e.contentRect.width))); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  return [ref, w];
}
function useMounted(delay = 30) { const [m, setM] = useState(false); useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, [delay]); return m; }

export function Legend({ items }) { return <div className="row wrap gap-16 xs t2">{items.map((s, i) => <span key={i} className="row gap-6"><span className="dot" style={{ background: s.color || PALETTE[i % 8], borderRadius: 2 }} />{s.label}</span>)}</div>; }

// ---------- Radar (six skills), optional comparison polygon
export function Radar({ data, compare, size = 260, color = 'var(--accent)', compareColor = 'var(--c4)' }) {
  const m = useMounted(); const n = data.length; const c = size / 2; const R = size / 2 - 42;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [c + R * (v / 100) * Math.cos(a), c + R * (v / 100) * Math.sin(a)]; };
  const poly = (vals) => vals.map((v, i) => pt(i, m ? v : 0).map((x) => x.toFixed(1)).join(',')).join(' ');
  const [hover, setHover] = useState(null);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {[25, 50, 75, 100].map((g) => <polygon key={g} points={data.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="var(--line)" strokeWidth="1" />)}
      {data.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />; })}
      {compare && <polygon points={poly(compare.map((d) => d.value))} fill={compareColor} fillOpacity="0.08" stroke={compareColor} strokeWidth="1.3" strokeDasharray="4 3" style={{ transition: 'all 0.9s cubic-bezier(.22,.8,.24,1)' }} />}
      <polygon points={poly(data.map((d) => d.value))} fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.8" strokeLinejoin="round" style={{ transition: 'all 0.9s cubic-bezier(.22,.8,.24,1)' }} />
      {data.map((d, i) => { const [x, y] = pt(i, m ? d.value : 0); const [lx, ly] = pt(i, 124); return (
        <g key={d.id || i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
          <circle cx={x} cy={y} r={hover === i ? 5 : 3.2} fill="var(--bg)" stroke={color} strokeWidth="1.8" style={{ transition: 'all 0.9s cubic-bezier(.22,.8,.24,1), r 0.15s' }} />
          <text x={lx} y={ly - 5} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight="600" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>{d.short || d.label.split(' ')[0]}</text>
          <text x={lx} y={ly + 9} textAnchor="middle" fontSize="12.5" fill={hover === i ? color : 'var(--text)'} fontFamily="var(--mono)" fontWeight="500">{Math.round(d.value)}</text>
          <circle cx={lx} cy={ly} r="24" fill="transparent" />
        </g>); })}
    </svg>
  );
}

// ---------- Line / area chart with hover crosshair
export function LineChart({ categories, series, height = 190, unit = '', area = true, yMax, yMin = 0 }) {
  const [ref, w] = useWidth(); const m = useMounted(); const id = useId(); const [hover, setHover] = useState(null);
  const pad = { l: 38, r: 12, t: 12, b: 24 }; const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const max = yMax ?? nice(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null)))); const min = yMin;
  const x = (i) => pad.l + (categories.length === 1 ? iw / 2 : (iw * i) / (categories.length - 1)); const y = (v) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;
  const path = (vals) => vals.map((v, i) => (v == null ? '' : `${i === 0 || vals[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(' ');
  const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
  const step = Math.ceil(categories.length / Math.max(2, Math.floor(iw / 62)));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={w} height={height} onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (categories.length - 1)); setHover(Math.max(0, Math.min(categories.length - 1, i))); }}>
        <defs>{series.map((s, k) => <linearGradient key={k} id={`${id}g${k}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color || PALETTE[k]} stopOpacity="0.22" /><stop offset="1" stopColor={s.color || PALETTE[k]} stopOpacity="0" /></linearGradient>)}
          <clipPath id={`${id}c`}><rect x="0" y="0" height={height} width={m ? w : 0} style={{ transition: 'width 1.1s cubic-bezier(.22,.8,.24,1)' }} /></clipPath></defs>
        {ticks.map((t, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={i ? '2 4' : ''} /><text x={pad.l - 7} y={y(t) + 3.500} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">{fmt(t)}</text></g>)}
        {categories.map((c, i) => (i % step === 0 || i === categories.length - 1) && <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === categories.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--muted)">{c}</text>)}
        <g clipPath={`url(#${id}c)`}>{series.map((s, k) => <g key={k}>
          {area && series.length <= 2 && <path d={`${path(s.values)} L${x(s.values.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`} fill={`url(#${id}g${k})`} />}
          <path d={path(s.values)} fill="none" stroke={s.color || PALETTE[k]} strokeWidth="1.900" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : ''} /></g>)}</g>
        {hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--line-2)" />{series.map((s, k) => s.values[hover] != null && <circle key={k} cx={x(hover)} cy={y(s.values[hover])} r="3.500" fill="var(--bg)" stroke={s.color || PALETTE[k]} strokeWidth="1.800" />)}</g>}
      </svg>
      {hover != null && <div className="panel xs" style={{ position: 'absolute', top: 4, left: Math.min(w - 150, Math.max(pad.l, x(hover) + 10)), padding: '6px 9px', pointerEvents: 'none', boxShadow: 'var(--shadow)', zIndex: 2 }}>
        <div className="muted" style={{ marginBottom: 2 }}>{categories[hover]}</div>{series.map((s, k) => <div key={k} className="row gap-6"><span className="dot" style={{ background: s.color || PALETTE[k] }} /><span className="t2">{s.label}</span><span className="mono" style={{ marginLeft: 'auto', paddingLeft: 10 }}>{s.values[hover] == null ? '—' : fmt(s.values[hover])}{unit}</span></div>)}</div>}
    </div>
  );
}

// ---------- Grouped bar chart
export function BarChart({ categories, series, height = 210, unit = '' }) {
  const [ref, w] = useWidth(); const m = useMounted(); const [hover, setHover] = useState(null);
  const pad = { l: 40, r: 8, t: 14, b: 30 }; const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const vals = series.flatMap((s) => s.values.filter((v) => v != null)); const max = nice(Math.max(1, ...vals)); const min = Math.min(0, ...vals) < 0 ? -nice(-Math.min(...vals)) : 0;
  const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih; const gw = iw / categories.length; const bw = Math.min(34, (gw * 0.72) / series.length);
  return (
    <div ref={ref}>
      <svg width={w} height={height}>
        {[min, (min + max) / 2, max].map((t, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? '' : '2 4'} /><text x={pad.l - 7} y={y(t) + 3.500} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">{fmt(t)}</text></g>)}
        {min < 0 && <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke="var(--line-2)" />}
        {categories.map((c, ci) => { const gx = pad.l + gw * ci + (gw - bw * series.length - 3 * (series.length - 1)) / 2; return (
          <g key={ci}>{series.map((s, si) => { const v = s.values[ci]; if (v == null) return null; const h = Math.abs(y(v) - y(0)); const on = hover && hover[0] === ci && hover[1] === si; return (
            <g key={si} onMouseEnter={() => setHover([ci, si])} onMouseLeave={() => setHover(null)}>
              <rect x={gx + si * (bw + 3)} width={bw} y={m ? (v >= 0 ? y(v) : y(0)) : y(0)} height={m ? Math.max(1, h) : 0} rx="2" fill={s.color || PALETTE[si]} opacity={hover && !on ? 0.5 : 1} style={{ transition: `y 0.7s cubic-bezier(.22,.8,.24,1) ${ci * 0.04}s, height 0.7s cubic-bezier(.22,.8,.24,1) ${ci * 0.04}s, opacity 0.15s` }} />
              {(on || (categories.length * series.length <= 8 && bw > 20)) && <text x={gx + si * (bw + 3) + bw / 2} y={(v >= 0 ? y(v) : y(0) + h + 12) - 5 + (v >= 0 ? 0 : 5)} textAnchor="middle" fontSize="10" fontFamily="var(--mono)" fill="var(--text-2)" style={{ opacity: m ? 1 : 0, transition: 'opacity 0.5s 0.5s' }}>{fmt(v)}</text>}
            </g>); })}
            <text x={pad.l + gw * ci + gw / 2} y={height - 10} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{String(c).length > Math.floor(gw / 6) ? String(c).slice(0, Math.max(4, Math.floor(gw / 6) - 1)) + '…' : c}</text>
          </g>); })}
      </svg>
      <div className="row between wrap" style={{ paddingLeft: pad.l }}><Legend items={series.map((s, i) => ({ label: s.label, color: s.color || PALETTE[i] }))} /><span className="xs muted">{unit}</span></div>
    </div>
  );
}

// ---------- Waterfall (profit bridge). items: [{label, value, total?, hidden?}]
export function Waterfall({ items, height = 240, unit = '', onPick }) {
  const [ref, w] = useWidth(); const m = useMounted();
  const pad = { l: 40, r: 8, t: 18, b: 46 }; const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const bars = useMemo(() => { let run = 0; return items.map((it) => { if (it.total) { run = it.value; return { ...it, from: 0, to: it.value }; } if (it.hidden) return { ...it, from: run, to: run }; const from = run; run += it.value; return { ...it, from, to: run }; }); }, [items]);
  const all = bars.flatMap((b) => [b.from, b.to]); const max = nice(Math.max(...all, 1) * 1.08); const min = Math.min(0, ...all);
  const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih; const bw = iw / bars.length;
  return (
    <div ref={ref}><svg width={w} height={height}>
      {[min, max / 2, max].map((t, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={i ? '2 4' : ''} /><text x={pad.l - 7} y={y(t) + 3.500} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">{fmt(t)}</text></g>)}
      {bars.map((b, i) => { const x = pad.l + bw * i + bw * 0.16, ww = bw * 0.68; const top = y(Math.max(b.from, b.to)), h = Math.max(2, Math.abs(y(b.from) - y(b.to))); const col = b.total ? 'var(--c7)' : b.value >= 0 ? 'var(--pos)' : 'var(--neg)'; return (
        <g key={i} style={{ cursor: onPick && !b.total ? 'pointer' : 'default' }} onClick={() => onPick && !b.total && onPick(b)}>
          {b.hidden ? <rect x={x} y={y(b.from) - 16} width={ww} height={32} rx="3" fill="var(--surface-2)" stroke="var(--line-2)" strokeDasharray="4 3" />
            : <rect x={x} width={ww} rx="2" y={m ? top : y(b.from)} height={m ? h : 0} fill={col} fillOpacity={b.total ? 0.55 : 0.85} style={{ transition: `all 0.6s cubic-bezier(.22,.8,.24,1) ${i * 0.06}s` }} />}
          {b.hidden ? <text x={x + ww / 2} y={y(b.from) + 4} textAnchor="middle" fontSize="13" fill="var(--muted)" style={{ pointerEvents: 'none' }}>?</text>
            : <text x={x + ww / 2} y={top - 5} textAnchor="middle" fontSize="10.5" fontFamily="var(--mono)" fill="var(--text-2)">{b.total ? fmt(b.value) : (b.value > 0 ? '+' : '') + fmt(b.value)}</text>}
          {i < bars.length - 1 && !b.hidden && <line x1={x + ww} x2={pad.l + bw * (i + 1) + bw * 0.16} y1={y(b.to)} y2={y(b.to)} stroke="var(--line-2)" strokeDasharray="2 3" />}
          <foreignObject x={pad.l + bw * i} y={height - pad.b + 6} width={bw} height={pad.b - 6}><div style={{ fontSize: 10, lineHeight: 1.2, color: 'var(--muted)', textAlign: 'center', padding: '0 2px', overflow: 'hidden' }}>{b.label}</div></foreignObject>
        </g>); })}
    </svg><div className="xs muted" style={{ textAlign: 'right' }}>{unit}</div></div>
  );
}

export function Spark({ values, width = 90, height = 26, color = 'var(--accent)' }) {
  if (!values?.length) return null; const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`).join(' ');
  return <svg width={width} height={height}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.500" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
export function MiniBars({ values, height = 44, color = 'var(--accent)', labels }) {
  const m = useMounted(); const max = Math.max(1, ...values);
  return <div className="row" style={{ alignItems: 'flex-end', gap: 3, height }}>{values.map((v, i) => <div key={i} title={labels ? `${labels[i]}: ${v}` : v} style={{ flex: 1, height: m ? `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%` : '2%', background: v > 0 ? color : 'var(--surface-3)', borderRadius: 2, opacity: i === values.length - 1 ? 1 : 0.62, transition: `height 0.6s cubic-bezier(.22,.8,.24,1) ${i * 0.025}s` }} />)}</div>;
}

export function Ring({ value, size = 120, stroke = 9, color = 'var(--accent)', children, max = 100 }) {
  const m = useMounted(); const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const p = Math.max(0, Math.min(1, value / max));
  return <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={m ? c * (1 - p) : c} style={{ transition: 'stroke-dashoffset 1.200s cubic-bezier(.22,.8,.24,1)' }} /></svg>
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div></div>;
}

// ---------- Belief stream: stacked confidence by area across snapshots. The signature chart of the replay.
export function BeliefStream({ snapshots, drivers, truth, upto, height = 230, onPick, active }) {
  const [ref, w] = useWidth();
  const keys = useMemo(() => { const present = new Set(snapshots.flatMap((s) => Object.keys(s.byDriver))); const ks = Object.keys(drivers).filter((k) => present.has(k) || (truth && truth[k] >= 10)); if (present.has('other')) ks.push('other'); return ks; }, [snapshots, drivers, truth]);
  const colorOf = (k) => (k === 'other' ? 'var(--c7)' : PALETTE[Object.keys(drivers).indexOf(k) % 8]);
  const cols = truth ? [...snapshots, { label: 'Evidence-weighted view', byDriver: truth, ref: true }] : snapshots;
  const pad = { l: 8, r: 8, t: 10, b: 38 }; const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b; const n = cols.length;
  const ns = snapshots.length; const colW = Math.max(26, Math.min(46, (iw / n) * 0.5)); const gap = truth ? 34 : 0;
  const span = iw - colW - (truth ? colW + gap : 0);
  const x = (i) => (cols[i].ref ? pad.l + iw - colW / 2 : pad.l + colW / 2 + (ns <= 1 ? 0 : (span * i) / (ns - 1)));
  const stacks = cols.map((c) => { const tot = keys.reduce((s, k) => s + (c.byDriver[k] || 0), 0) || 1; let acc = 0; return keys.map((k) => { const v = ((c.byDriver[k] || 0) / tot) * 100; const seg = { k, y0: acc, y1: acc + v, v: c.byDriver[k] || 0 }; acc += v; return seg; }); });
  const yy = (p) => pad.t + (p / 100) * ih; const shown = upto == null ? n : Math.min(n, upto + 1);
  return (
    <div ref={ref}><svg width={w} height={height}>
      {keys.map((k, ki) => stacks.slice(0, -1).map((st, i) => { if (i + 1 >= shown && !cols[i + 1].ref) return null; if (cols[i + 1].ref && shown < n) return null; const a = st[ki], b = stacks[i + 1][ki]; const x0 = x(i) + colW / 2, x1 = x(i + 1) - colW / 2, mx = (x0 + x1) / 2;
        return <path key={k + i} d={`M${x0},${yy(a.y0)} C${mx},${yy(a.y0)} ${mx},${yy(b.y0)} ${x1},${yy(b.y0)} L${x1},${yy(b.y1)} C${mx},${yy(b.y1)} ${mx},${yy(a.y1)} ${x0},${yy(a.y1)} Z`} fill={colorOf(k)} fillOpacity={cols[i + 1].ref ? 0.06 : 0.16} style={{ animation: 'fadeIn 0.5s' }} />; }))}
      {stacks.map((st, i) => (i >= shown && !(cols[i].ref && shown >= n - 1)) ? null : <g key={i} onClick={() => onPick && !cols[i].ref && onPick(i)} style={{ cursor: onPick && !cols[i].ref ? 'pointer' : 'default', animation: 'fadeIn 0.4s' }}>
        {st.map((s) => s.y1 - s.y0 > 0.4 && <g key={s.k}><rect x={x(i) - colW / 2} y={yy(s.y0) + 0.75} width={colW} height={Math.max(0, yy(s.y1) - yy(s.y0) - 1.500)} rx="2" fill={colorOf(s.k)} fillOpacity={cols[i].ref ? 0.5 : 0.92} stroke={cols[i].ref ? colorOf(s.k) : 'none'} strokeDasharray="3 2" />
          {yy(s.y1) - yy(s.y0) > 15 && <text x={x(i)} y={(yy(s.y0) + yy(s.y1)) / 2 + 3.500} textAnchor="middle" fontSize="10.5" fontFamily="var(--mono)" fontWeight="500" fill={cols[i].ref ? 'var(--text)' : '#0b0d10'}>{Math.round(s.v)}</text>}</g>)}
        {active === i && <rect x={x(i) - colW / 2 - 4} y={pad.t - 4} width={colW + 8} height={ih + 8} rx="4" fill="none" stroke="var(--text)" strokeWidth="1.200" />}
        <foreignObject x={Math.max(0, Math.min(w - 92, x(i) - 46))} y={height - pad.b + 6} width={92} height={pad.b - 6}><div style={{ fontSize: 9.5, lineHeight: 1.2, color: cols[i].ref ? 'var(--text-2)' : 'var(--muted)', textAlign: 'center', fontWeight: cols[i].ref ? 600 : 400 }}>{cols[i].ref ? 'Where the evidence points' : i === 0 ? 'Opening' : i === ns - 1 && ns > 2 ? 'Final' : `Update ${i}`}</div></foreignObject>
      </g>)}
    </svg>
    <Legend items={keys.map((k) => ({ label: drivers[k] || 'Other', color: colorOf(k) }))} /></div>
  );
}

// ---------- Horizontal distribution compare (class hypothesis distributions)
export function DistCompare({ rows, series }) {
  const m = useMounted();
  return <div className="col" style={{ gap: 12 }}>{rows.map((r) => <div key={r.id}><div className="row between small"><span>{r.label}</span></div>
    <div className="col" style={{ gap: 3, marginTop: 4 }}>{series.map((s, i) => <div key={s.key} className="row gap-6"><span className="xs muted" style={{ width: 86, flex: 'none' }}>{s.label}</span><div className="bar grow" style={{ height: 8 }}><i style={{ width: m ? `${r[s.key]}%` : 0, background: s.color || PALETTE[i] }} /></div><span className="mono xs" style={{ width: 26, textAlign: 'right' }}>{r[s.key]}</span></div>)}</div></div>)}</div>;
}
