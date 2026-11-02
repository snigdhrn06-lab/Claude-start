/**
 * Built-in illustrative visuals for projects without a cover image.
 * Each is a deterministic, decorative SVG with no data, numbers or claims. The wrapper
 * always shows an "Illustrative" tag so nobody mistakes it for a product screenshot.
 * Choose one per project in Admin → Projects → "Illustrative visual".
 */
import { cn } from "@/lib/utils";

const W = 1600;
const H = 1000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Grid({ step = 80, opacity = 0.05 }: { step?: number; opacity?: number }) {
  const lines = [];
  for (let x = step; x < W; x += step) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} />);
  for (let y = step; y < H; y += step) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />);
  return (
    <g stroke="#fff" strokeOpacity={opacity} strokeWidth={1}>
      {lines}
    </g>
  );
}

function Storefront({ c }: { c: string }) {
  const cards = [0, 1, 2, 3];
  return (
    <g>
      <rect x={180} y={110} width={1240} height={800} rx={28} fill="#0f1012" stroke={c} strokeOpacity={0.35} strokeWidth={2} />
      <rect x={180} y={110} width={1240} height={64} rx={28} fill={c} fillOpacity={0.08} />
      {[0, 1, 2].map((i) => <circle key={i} cx={222 + i * 26} cy={142} r={7} fill="#fff" fillOpacity={0.18} />)}
      <rect x={520} y={128} width={560} height={28} rx={14} fill="#fff" fillOpacity={0.05} />
      {/* hero copy lines */}
      <rect x={250} y={260} width={420} height={34} rx={6} fill="#fff" fillOpacity={0.85} />
      <rect x={250} y={312} width={360} height={34} rx={6} fill="#fff" fillOpacity={0.85} />
      <rect x={250} y={364} width={300} height={34} rx={6} fill={c} fillOpacity={0.9} />
      <rect x={250} y={430} width={380} height={12} rx={6} fill="#fff" fillOpacity={0.25} />
      <rect x={250} y={454} width={320} height={12} rx={6} fill="#fff" fillOpacity={0.25} />
      <rect x={250} y={500} width={150} height={48} rx={24} fill={c} />
      <rect x={414} y={500} width={190} height={48} rx={24} fill="none" stroke="#fff" strokeOpacity={0.3} />
      {/* temple-arch frame with rangoli */}
      <path d="M940 600 V350 a210 210 0 0 1 420 0 V600" fill="none" stroke={c} strokeOpacity={0.6} strokeWidth={3} />
      {[150, 110, 70, 32].map((r, i) => (
        <circle key={r} cx={1150} cy={420} r={r} fill="none" stroke={c} strokeOpacity={0.15 + i * 0.15} strokeWidth={2} strokeDasharray={i % 2 ? "6 10" : undefined} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <ellipse key={i} cx={1150 + Math.cos(a) * 92} cy={420 + Math.sin(a) * 92} rx={10} ry={26} transform={`rotate(${(a * 180) / Math.PI + 90} ${1150 + Math.cos(a) * 92} ${420 + Math.sin(a) * 92})`} fill={c} fillOpacity={0.35} />;
      })}
      {Array.from({ length: 15 }).map((_, i) => <circle key={i} cx={960 + i * 27} cy={300 - Math.sin((i / 14) * Math.PI) * 40} r={8} fill={c} fillOpacity={0.8} />)}
      {/* product grid */}
      {cards.map((i) => (
        <g key={i} transform={`translate(${250 + i * 285} 640)`}>
          <rect width={255} height={220} rx={18} fill="#fff" fillOpacity={0.04} stroke="#fff" strokeOpacity={0.08} />
          <circle cx={128} cy={90} r={46} fill={c} fillOpacity={0.12 + i * 0.05} />
          <rect x={20} y={168} width={130} height={12} rx={6} fill="#fff" fillOpacity={0.4} />
          <rect x={20} y={190} width={70} height={10} rx={5} fill={c} fillOpacity={0.7} />
          <circle cx={222} cy={188} r={16} fill={c} />
        </g>
      ))}
    </g>
  );
}

function Documents({ c }: { c: string }) {
  const page = (x: number, y: number, rot: number, o: number, key: string, fold = false) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={fold ? "M0 0 H250 L320 70 V420 H0 Z" : "M0 0 H320 V420 H0 Z"} fill="#121316" stroke={c} strokeOpacity={o} strokeWidth={2} />
      {fold && <path d="M250 0 V70 H320" fill="none" stroke={c} strokeOpacity={o} strokeWidth={2} />}
      {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={36} y={90 + i * 32} width={i % 3 === 2 ? 150 : 240} height={10} rx={5} fill="#fff" fillOpacity={0.12} />)}
      <rect x={36} y={40} width={110} height={26} rx={6} fill={c} fillOpacity={0.25} />
    </g>
  );
  return (
    <g>
      {page(260, 250, -8, 0.25, "a")}
      {page(380, 230, -2, 0.4, "b")}
      {page(500, 210, 4, 0.7, "c", true)}
      <g stroke={c} strokeWidth={3} fill="none" strokeLinecap="round">
        <path d="M900 420 C 1000 420, 1000 500, 1080 500" />
        <path d="M900 580 C 1000 580, 1000 500, 1080 500" />
        <path d="M1060 482 L1084 500 L1060 518" />
      </g>
      <g transform="translate(1110 300)">
        <rect width={300} height={400} rx={10} fill={c} fillOpacity={0.1} stroke={c} strokeWidth={2.5} />
        {Array.from({ length: 4 }).map((_, i) => <rect key={i} x={30} y={60 + i * 70} width={240} height={50} rx={8} fill={c} fillOpacity={0.16 + i * 0.05} />)}
        <text x={150} y={380} textAnchor="middle" fontFamily="monospace" fontSize={26} fill={c} letterSpacing={6}>PDF</text>
      </g>
    </g>
  );
}

function Pulse({ c }: { c: string }) {
  const pts = [];
  const r = rng(7);
  for (let x = 0; x <= W; x += 20) {
    const d = Math.abs(x - 800);
    let y = 500 + (r() - 0.5) * 8;
    if (d < 140) y = 500 + Math.sin((x - 800) / 22) * (140 - d) * 2.2;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return (
    <g>
      {[380, 290, 200, 110].map((rad, i) => <circle key={rad} cx={800} cy={500} r={rad} fill="none" stroke={c} strokeOpacity={0.08 + i * 0.07} strokeWidth={2} />)}
      <circle cx={800} cy={500} r={46} fill={c} fillOpacity={0.15} />
      <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth={4} strokeLinejoin="round" />
    </g>
  );
}

function Seasonality({ c }: { c: string }) {
  const r = rng(12);
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  return (
    <g transform="translate(800 500)">
      {[140, 220, 300, 380].map((rad) => <circle key={rad} r={rad} fill="none" stroke="#fff" strokeOpacity={0.07} />)}
      {months.map((m, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const len = 60 + r() * 220;
        const x1 = Math.cos(a) * 120;
        const y1 = Math.sin(a) * 120;
        const x2 = Math.cos(a) * (120 + len);
        const y2 = Math.sin(a) * (120 + len);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeOpacity={0.35 + (len / 280) * 0.6} strokeWidth={34} strokeLinecap="round" />
            <text x={Math.cos(a) * 440} y={Math.sin(a) * 440 + 9} textAnchor="middle" fontFamily="monospace" fontSize={26} fill="#fff" fillOpacity={0.45}>{m}</text>
          </g>
        );
      })}
      <circle r={90} fill="#0d0e10" stroke={c} strokeOpacity={0.5} strokeWidth={2} />
    </g>
  );
}

function Heatmap({ c }: { c: string }) {
  const n = 8;
  const r = rng(31);
  const vals: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      const v = i === j ? 1 : r();
      vals[i]![j] = v;
      vals[j]![i] = v;
    }
  const size = 92;
  const ox = 800 - (n * size) / 2;
  const oy = 500 - (n * size) / 2;
  return (
    <g>
      {vals.map((row, i) =>
        row.map((v, j) => <rect key={`${i}-${j}`} x={ox + j * size + 4} y={oy + i * size + 4} width={size - 8} height={size - 8} rx={8} fill={c} fillOpacity={0.06 + v * 0.8} />),
      )}
      <rect x={ox - 10} y={oy - 10} width={n * size + 20} height={n * size + 20} rx={16} fill="none" stroke="#fff" strokeOpacity={0.12} />
    </g>
  );
}

function Terminal({ c }: { c: string }) {
  const r = rng(5);
  let p = 520;
  const candles = Array.from({ length: 34 }).map((_, i) => {
    const o = p;
    p += (r() - 0.48) * 60;
    const cl = p;
    const hi = Math.min(o, cl) - r() * 30;
    const lo = Math.max(o, cl) + r() * 30;
    return { x: 230 + i * 24, o, cl, hi, lo };
  });
  return (
    <g>
      <rect x={170} y={150} width={1260} height={700} rx={24} fill="#0f1012" stroke="#fff" strokeOpacity={0.1} />
      <rect x={170} y={150} width={1260} height={56} rx={24} fill="#fff" fillOpacity={0.04} />
      {[0, 1, 2].map((i) => <circle key={i} cx={208 + i * 24} cy={178} r={6} fill="#fff" fillOpacity={0.2} />)}
      {candles.map((k, i) => (
        <g key={i}>
          <line x1={k.x} x2={k.x} y1={k.hi} y2={k.lo} stroke={k.cl < k.o ? c : "#fff"} strokeOpacity={0.6} strokeWidth={2} />
          <rect x={k.x - 7} y={Math.min(k.o, k.cl)} width={14} height={Math.max(4, Math.abs(k.cl - k.o))} fill={k.cl < k.o ? c : "#fff"} fillOpacity={k.cl < k.o ? 0.9 : 0.35} />
        </g>
      ))}
      <g transform="translate(1080 250)">
        <rect width={300} height={540} rx={16} fill="#fff" fillOpacity={0.03} stroke="#fff" strokeOpacity={0.08} />
        {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={24} y={30 + i * 50} width={252} height={14} rx={7} fill="#fff" fillOpacity={0.1} />)}
        <rect x={24} y={360} width={120} height={56} rx={10} fill={c} />
        <rect x={156} y={360} width={120} height={56} rx={10} fill="none" stroke={c} strokeWidth={2} />
        <text x={84} y={396} textAnchor="middle" fontFamily="monospace" fontSize={22} fill="#0b0c0e">BUY</text>
        <text x={216} y={396} textAnchor="middle" fontFamily="monospace" fontSize={22} fill={c}>SELL</text>
        <text x={150} y={480} textAnchor="middle" fontFamily="monospace" fontSize={18} fill="#fff" fillOpacity={0.4} letterSpacing={4}>SIMULATED</text>
      </g>
    </g>
  );
}

function Drawdown({ c }: { c: string }) {
  const r = rng(19);
  const path = (depth: number, seed: number) => {
    const rr = rng(seed);
    const pts: string[] = [];
    let y = 0;
    for (let x = 0; x <= 1200; x += 20) {
      const shock = x > 380 && x < 640 ? Math.sin(((x - 380) / 260) * Math.PI) * depth : 0;
      y = Math.max(0, shock + (rr() - 0.4) * 18 * (depth / 300));
      pts.push(`${200 + x},${300 + y}`);
    }
    return pts;
  };
  void r;
  const bench = path(420, 3);
  const strat = path(250, 4);
  return (
    <g>
      <line x1={200} y1={300} x2={1400} y2={300} stroke="#fff" strokeOpacity={0.3} strokeDasharray="6 8" />
      <polygon points={`200,300 ${bench.join(" ")} 1400,300`} fill="#fff" fillOpacity={0.06} />
      <polyline points={bench.join(" ")} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={3} />
      <polygon points={`200,300 ${strat.join(" ")} 1400,300`} fill={c} fillOpacity={0.18} />
      <polyline points={strat.join(" ")} fill="none" stroke={c} strokeWidth={4} />
      <g fontFamily="monospace" fontSize={22} letterSpacing={3}>
        <rect x={200} y={820} width={24} height={6} fill={c} />
        <text x={236} y={830} fill="#fff" fillOpacity={0.55}>STRATEGY</text>
        <rect x={430} y={820} width={24} height={6} fill="#fff" fillOpacity={0.4} />
        <text x={466} y={830} fill="#fff" fillOpacity={0.55}>BENCHMARK</text>
      </g>
    </g>
  );
}

function Network({ c }: { c: string }) {
  const r = rng(42);
  const nodes = Array.from({ length: 22 }).map(() => ({ x: 200 + r() * 1200, y: 160 + r() * 680 }));
  return (
    <g>
      {nodes.map((a, i) =>
        nodes.slice(i + 1).map((b, j) => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          return d < 300 ? <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeOpacity={0.25 * (1 - d / 300)} strokeWidth={2} /> : null;
        }),
      )}
      {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={i % 5 === 0 ? 12 : 6} fill={c} fillOpacity={i % 5 === 0 ? 0.9 : 0.5} />)}
    </g>
  );
}

const VISUALS = {
  storefront: Storefront,
  documents: Documents,
  pulse: Pulse,
  seasonality: Seasonality,
  heatmap: Heatmap,
  terminal: Terminal,
  drawdown: Drawdown,
  grid: Network,
} as const;

export function ProjectVisual({ visual, accent, className, label = true }: { visual: string; accent?: string; className?: string; label?: boolean }) {
  const Comp = VISUALS[visual as keyof typeof VISUALS] ?? Network;
  const c = accent || "rgb(var(--accent))";
  return (
    <div className={cn("relative overflow-hidden bg-[radial-gradient(120%_90%_at_70%_20%,#16181b_0%,#0b0c0e_60%)]", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden role="presentation">
        <Grid />
        <Comp c={c} />
      </svg>
      {label && (
        <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-white/60 backdrop-blur">
          Illustrative
        </span>
      )}
    </div>
  );
}
