"use client";
/**
 * Decorative hero background: a drifting market line, flow bars and a fine grid lit by the cursor.
 * It contains no data. It pauses off-screen and in background tabs, and is static for reduced motion.
 */
import { useEffect, useRef } from "react";

export function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().split(/\s+/).join(",") || "200,245,96";
    let w = 0, h = 0, dpr = 1, raf = 0, running = true, t = 0;
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    // Deterministic random walk, extended as it scrolls.
    let seed = 1337;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const series: number[] = [];
    let level = 0;
    const push = () => { level += (rand() - 0.5) * 0.9 - level * 0.015; series.push(level); };
    for (let i = 0; i < 400; i++) push();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
      const step = w < 640 ? 36 : 56;
      // grid dots, brighter near the cursor
      for (let x = step / 2; x < w; x += step) {
        for (let y = step / 2; y < h; y += step) {
          const d = Math.hypot(x - mouse.x, y - mouse.y);
          const glow = Math.max(0, 1 - d / 260);
          ctx.fillStyle = glow > 0 ? `rgba(${accent},${0.08 + glow * 0.55})` : "rgba(255,255,255,0.06)";
          ctx.fillRect(x - 0.75, y - 0.75, 1.5 + glow * 1.5, 1.5 + glow * 1.5);
        }
      }
      // series
      const spacing = w < 640 ? 6 : 8;
      const visible = Math.ceil(w / spacing) + 2;
      const offset = (t * 0.35) % spacing;
      const start = Math.max(0, series.length - visible);
      const slice = series.slice(start);
      const min = Math.min(...slice), max = Math.max(...slice);
      const mid = h * 0.58, amp = h * 0.16;
      const yOf = (v: number) => mid - ((v - min) / (max - min || 1) - 0.5) * 2 * amp;
      // flow bars
      for (let i = 1; i < slice.length; i++) {
        const x = i * spacing - offset;
        const dv = slice[i]! - slice[i - 1]!;
        const bh = Math.min(60, Math.abs(dv) * 70);
        ctx.fillStyle = dv >= 0 ? `rgba(${accent},0.13)` : "rgba(255,255,255,0.06)";
        ctx.fillRect(x - spacing * 0.3, h - 40 - bh, spacing * 0.6, bh);
      }
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${accent},0)`);
      grad.addColorStop(0.35, `rgba(${accent},0.18)`);
      grad.addColorStop(1, `rgba(${accent},0.7)`);
      ctx.beginPath();
      slice.forEach((v, i) => { const x = i * spacing - offset; const y = yOf(v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
      // head marker
      const lx = (slice.length - 1) * spacing - offset, ly = yOf(slice[slice.length - 1]!);
      ctx.fillStyle = `rgba(${accent},0.9)`; ctx.beginPath(); ctx.arc(Math.min(lx, w - 8), ly, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${accent},0.25)`; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke(); ctx.setLineDash([]);
    };

    const loop = () => {
      if (!running) return;
      t += 1;
      if (t % Math.round(8 / 0.35) === 0) { push(); if (series.length > 2000) series.splice(0, 1000); }
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; };
    const io = new IntersectionObserver(([e]) => { const vis = !!e?.isIntersecting; if (vis && !running && !reduce) { running = true; loop(); } else if (!vis) { running = false; cancelAnimationFrame(raf); } });
    const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!reduce && !running) { running = true; loop(); } };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    io.observe(canvas);
    if (reduce) { running = false; draw(); } else loop();

    return () => {
      running = false; cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}
