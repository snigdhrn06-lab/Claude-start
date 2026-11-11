// Generative artwork. Each case and Arena mode gets a distinct, data-flavoured motif drawn in SVG.
// Deterministic (no randomness at render) so artwork is stable across visits.
import React from 'react';

export const CASE_THEME = {
  brewly: { color: '#E39A4F', motif: 'steam', tag: 'Margin erosion' },
  northstar: { color: '#72AEE3', motif: 'compass', tag: 'Leaking balance sheet' },
  cloudaxis: { color: '#3FD4BD', motif: 'network', tag: 'Retention decay' },
};
export const caseTheme = (id) => CASE_THEME[id] || { color: '#E0AD55', motif: 'network', tag: 'Investigation' };
const prng = (seed) => { let s = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export function CaseArt({ id, initials }) {
  const t = caseTheme(id); const c = t.color; const r = prng(id);
  const grid = <g opacity="0.35">{Array.from({ length: 13 }, (_, i) => <line key={'v' + i} x1={i * 40} y1="0" x2={i * 40} y2="240" stroke="var(--line-2)" strokeWidth="0.6" />)}{Array.from({ length: 7 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 40} x2="480" y2={i * 40} stroke="var(--line-2)" strokeWidth="0.6" />)}</g>;
  let motif = null;
  if (t.motif === 'steam') {
    // revenue bars rising while a contribution line sinks; steam curls above
    const bars = [38, 52, 61, 74, 92, 118];
    motif = <g>
      {bars.map((h, i) => <rect key={i} x={250 + i * 34} y={210 - h} width="20" height={h} rx="2" fill={c} fillOpacity={0.14 + i * 0.07} />)}
      <path d="M250 112 C 300 118, 330 132, 360 150 S 420 176, 450 190" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M250 112 C 300 118, 330 132, 360 150 S 420 176, 450 190" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" className="data-line" />
      {[0, 1, 2].map((k) => <path key={k} d={`M${300 + k * 40} 70 c -12 -14, 12 -22, 0 -36 c -12 -14, 12 -22, 0 -34`} fill="none" stroke={c} strokeOpacity={0.35 - k * 0.08} strokeWidth="1.6" strokeLinecap="round" style={{ animation: `breathe ${3 + k}s ease-in-out infinite` }} />)}
      <circle cx="450" cy="190" r="4" fill={c} style={{ animation: 'breathe 2s ease-in-out infinite' }} />
    </g>;
  } else if (t.motif === 'compass') {
    motif = <g transform="translate(360 120)">
      {[90, 64, 40].map((rr, i) => <circle key={rr} r={rr} fill="none" stroke={c} strokeOpacity={0.18 + i * 0.1} strokeWidth="1" strokeDasharray={i === 0 ? '2 6' : ''} />)}
      <g style={{ animation: 'spin 60s linear infinite', transformOrigin: '0 0' }}>{Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return <line key={i} x1={Math.cos(a) * 84} y1={Math.sin(a) * 84} x2={Math.cos(a) * (i % 6 ? 90 : 98)} y2={Math.sin(a) * (i % 6 ? 90 : 98)} stroke={c} strokeOpacity="0.5" />; })}</g>
      <path d="M0 -34 L7 -7 L34 0 L7 7 L0 34 L-7 7 L-34 0 L-7 -7 Z" fill={c} fillOpacity="0.85" />
      {Array.from({ length: 14 }, (_, i) => { const a = r() * Math.PI * 2, d = 46 + r() * 50; return <circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={1.6 + r() * 1.6} fill={c} fillOpacity={0.3 + r() * 0.5} />; })}
      <path d="M-150 60 C -110 40, -80 70, -40 50" fill="none" stroke={c} strokeOpacity="0.5" strokeWidth="1.5" className="data-line" />
    </g>;
  } else {
    const nodes = Array.from({ length: 16 }, (_, i) => ({ x: 230 + r() * 230, y: 30 + r() * 180, big: i % 5 === 0 }));
    motif = <g>
      {nodes.map((a, i) => nodes.slice(i + 1).filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 80).map((b, k) => <line key={i + '-' + k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeOpacity="0.22" />))}
      {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.big ? 5 : 2.4} fill={c} fillOpacity={n.big ? 0.9 : 0.55} style={n.big ? { animation: `breathe ${2.4 + i * 0.1}s ease-in-out infinite` } : null} />)}
      <path d="M20 190 L90 170 L150 150 L200 120 L250 108 L300 118 L350 140 L410 160" fill="none" stroke={c} strokeWidth="1.8" strokeOpacity="0.7" />
      <path d="M20 190 L90 170 L150 150 L200 120 L250 108 L300 118 L350 140 L410 160" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" className="data-line" />
    </g>;
  }
  return <svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {grid}{motif}
    {initials && <text x="462" y="226" textAnchor="end" fontFamily="var(--serif)" fontSize="64" fontStyle="italic" fill={c} fillOpacity="0.22">{initials}</text>}
  </svg>;
}

export const MODE_THEME = {
  daily: { color: '#E0AD55', label: 'Rapid diagnosis' }, 'issue-tree': { color: '#72AEE3', label: 'Structure' }, margin: { color: '#4CC08D', label: 'Forensics' },
  duel: { color: '#C194C0', label: 'Evidence weighing' }, blitz: { color: '#EC6A5F', label: 'Under pressure' }, market: { color: '#3FD4BD', label: 'Strategy simulation' },
};
export function ModeArt({ id }) {
  const c = (MODE_THEME[id] || MODE_THEME.daily).color;
  const art = {
    daily: <g><path d="M0 70 H120 L140 30 L160 104 L180 50 L196 70 H400" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" /><path d="M0 70 H120 L140 30 L160 104 L180 50 L196 70 H400" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" className="data-line" /><circle cx="330" cy="70" r="26" fill="none" stroke={c} strokeOpacity="0.4" /><path d="M330 52 V70 L342 78" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" /></g>,
    'issue-tree': <g fill="none" stroke={c}><rect x="40" y="56" width="70" height="22" rx="4" fillOpacity="0.15" fill={c} /><path d="M110 67 H150 M150 30 V104 M150 30 H180 M150 67 H180 M150 104 H180" strokeOpacity="0.6" /><rect x="180" y="20" width="60" height="18" rx="4" strokeOpacity="0.7" /><rect x="180" y="58" width="60" height="18" rx="4" strokeOpacity="0.7" /><rect x="180" y="95" width="60" height="18" rx="4" strokeOpacity="0.7" /><path d="M240 29 H270 M270 14 V44 M270 14 H290 M270 44 H290" strokeOpacity="0.4" /><rect x="290" y="6" width="44" height="14" rx="3" strokeOpacity="0.45" /><rect x="290" y="37" width="44" height="14" rx="3" strokeOpacity="0.45" /></g>,
    margin: <g>{[[40, 30, 80], [86, 30, 22, 1], [126, 52, 14], [166, 52, 30, 1], [206, 82, 18, 1], [246, 30, 66]].map(([x, y, h, neg], i) => <rect key={i} x={x} y={neg ? y : 110 - h} width="30" height={h} rx="2" fill={neg ? '#EC6A5F' : c} fillOpacity={i === 0 || i === 5 ? 0.45 : 0.8} />)}<circle cx="330" cy="58" r="22" fill="none" stroke={c} strokeWidth="2" /><path d="M346 74 L366 94" stroke={c} strokeWidth="3" strokeLinecap="round" /></g>,
    duel: <g><circle cx="130" cy="68" r="40" fill={c} fillOpacity="0.14" stroke={c} strokeOpacity="0.6" /><circle cx="270" cy="68" r="40" fill="#72AEE3" fillOpacity="0.12" stroke="#72AEE3" strokeOpacity="0.6" /><text x="130" y="78" textAnchor="middle" fontFamily="var(--serif)" fontSize="30" fill={c}>A</text><text x="270" y="78" textAnchor="middle" fontFamily="var(--serif)" fontSize="30" fill="#72AEE3">B</text><path d="M170 68 H230" stroke="var(--line-hi)" strokeDasharray="3 5" className="data-line" /></g>,
    blitz: <g><circle cx="300" cy="64" r="44" fill="none" stroke="var(--line-2)" strokeWidth="5" /><circle cx="300" cy="64" r="44" fill="none" stroke={c} strokeWidth="5" strokeDasharray="276" strokeDashoffset="90" strokeLinecap="round" transform="rotate(-90 300 64)" /><path d="M130 14 L94 72 H124 L110 120 L160 54 H128 Z" fill={c} fillOpacity="0.8" /></g>,
    market: <g>{Array.from({ length: 5 }, (_, i) => Array.from({ length: 9 }, (_, j) => <rect key={i + '-' + j} x={40 + j * 34} y={8 + i * 24} width="30" height="20" rx="2" fill={c} fillOpacity={(i + j) % 2 ? 0.05 : 0.12} />))}<path d="M40 110 C 120 90, 160 40, 210 52 S 300 20, 350 14" fill="none" stroke={c} strokeWidth="2" /><path d="M40 110 C 120 104, 170 96, 220 100 S 300 90, 350 96" fill="none" stroke="#EC6A5F" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="4 4" /></g>,
  }[id];
  return <svg viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{art}</svg>;
}
