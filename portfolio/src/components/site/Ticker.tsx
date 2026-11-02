/** Scrolling tape of featured achievements under the hero (static for reduced motion via CSS). */
export function Ticker({ items }: { items: { title: string; event: string }[] }) {
  if (!items.length) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-4 whitespace-nowrap px-6">
          <span className="font-mono text-xs uppercase tracking-label text-accent">{it.title}</span>
          <span className="text-sm text-muted">{it.event}</span>
          <span className="ml-6 text-accent/60" aria-hidden>
            ✦
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="group relative overflow-hidden border-y border-line/[0.07] bg-bg-2 py-4 mask-fade-x" role="region" aria-label="Highlights">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]" style={{ ["--marquee-duration" as string]: `${Math.max(30, items.length * 9)}s` }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
