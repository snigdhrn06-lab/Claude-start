import { Reveal } from "@/components/motion/Reveal";
import { SplitWords } from "@/components/motion/SplitWords";
import { cn } from "@/lib/utils";

export function SectionHeader({ index, eyebrow, title, intro, className, align = "split" }: { index: number; eyebrow: string; title: string; intro?: string; className?: string; align?: "split" | "stack" }) {
  return (
    <header className={cn("mb-14 md:mb-20", className)}>
      <Reveal className="mb-8 flex items-center gap-4">
        <span className="font-mono text-xs text-accent">{String(index).padStart(2, "0")}</span>
        <span className="h-px w-10 bg-line/20" aria-hidden />
        <span className="label">{eyebrow}</span>
      </Reveal>
      <div className={cn("grid gap-6", align === "split" && "lg:grid-cols-12 lg:items-end")}>
        {title && <SplitWords as="h2" text={title} className={cn("display text-[clamp(2.4rem,5.6vw,5rem)]", align === "split" && "lg:col-span-8")} />}
        {intro && (
          <Reveal delay={0.15} className={cn(align === "split" && "lg:col-span-4 lg:pb-2")}>
            <p className="max-w-md leading-relaxed text-muted">{intro}</p>
          </Reveal>
        )}
      </div>
    </header>
  );
}
