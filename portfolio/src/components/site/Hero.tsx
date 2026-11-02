"use client";
/**
 * Hero: editorial statement, intro, calls to action, verified stats and a full-width masthead name.
 * Content comes from Admin → Site settings → Identity & hero.
 */
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import { Counter } from "@/components/motion/Counter";
import { Magnetic } from "@/components/motion/Magnetic";
import { SplitWords } from "@/components/motion/SplitWords";
import { HeroField } from "./HeroField";
import { useSite } from "./SiteProvider";

type Props = {
  name: string;
  roleLine: string;
  location: string;
  headline: string;
  intro: string;
  stats: { value: string; suffix: string; label: string }[];
  links: { work?: string; achievements?: string; contact?: string };
};

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ name, roleLine, location, headline, intro, stats, links }: Props) {
  const { introDone } = useSite();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const mastheadY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["0%", "35%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0.15]);
  const show = (d: number) => ({ initial: { opacity: 0, y: reduce ? 0 : 18 }, animate: introDone ? { opacity: 1, y: 0 } : {}, transition: { duration: 0.9, delay: d, ease } });
  const nameChars = Array.from(name);

  return (
    <section ref={ref} id="top" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-[calc(var(--nav-h)+2rem)]">
      <div className="absolute inset-0 -z-10 opacity-90">
        <HeroField />
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_20%_10%,rgb(var(--accent)/0.07),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
      </div>

      <motion.div style={{ opacity: fade }} className="container relative flex flex-1 flex-col">
        <motion.div {...show(0)} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/[0.08] pb-4">
          <p className="label flex items-start gap-2.5 !tracking-[0.1em] sm:items-center sm:!tracking-label">
            <span className="mt-[0.4em] h-1.5 w-1.5 shrink-0 animate-blink rounded-full bg-accent sm:mt-0" aria-hidden />
            {roleLine}
          </p>
          {location && <p className="label hidden md:block">{location}</p>}
        </motion.div>

        <div className="grid flex-1 gap-10 py-10 md:py-12 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <SplitWords
              as="p"
              immediate
              play={introDone}
              delay={0.1}
              text={headline}
              className="display text-[clamp(2.9rem,8.4vw,7.6rem)] leading-[0.95]"
            />
          </div>
          <div className="lg:col-span-4 lg:pb-3">
            <motion.p {...show(0.45)} className="max-w-md text-[1.05rem] leading-relaxed text-muted">
              {intro}
            </motion.p>
            <motion.div {...show(0.6)} className="mt-8 flex flex-wrap items-center gap-3">
              {links.work && (
                <Magnetic>
                  <a href={links.work} className="btn btn-primary" data-cursor="Go">
                    Explore my work <ArrowDown className="h-4 w-4" aria-hidden />
                  </a>
                </Magnetic>
              )}
              {links.achievements && (
                <a href={links.achievements} className="btn btn-ghost">
                  View achievements
                </a>
              )}
              {links.contact && (
                <a href={links.contact} className="group inline-flex items-center gap-1.5 px-2 py-3 text-sm text-muted transition-colors hover:text-fg">
                  Contact me <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </a>
              )}
            </motion.div>
          </div>
        </div>

        {stats.length > 0 && (
          <motion.dl {...show(0.75)} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line/[0.08] bg-line/[0.08] md:grid-cols-4">
            {stats.map((s, i) => (
              <div key={i} className="bg-bg/90 px-4 py-5 backdrop-blur-sm md:px-6 md:py-6">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="font-display text-4xl leading-none md:text-5xl">
                    <Counter value={s.value} />
                    <span className="text-accent">{s.suffix}</span>
                  </span>
                  <span className="mt-2 block max-w-[16rem] text-xs leading-snug text-muted" aria-hidden>
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </motion.dl>
        )}
      </motion.div>

      <div className="relative mt-4 overflow-hidden" aria-hidden={false}>
        <motion.h1 style={{ y: mastheadY }} className="display -mb-[0.2em] select-none whitespace-nowrap px-3 text-center text-[clamp(4.2rem,17.5vw,19rem)] leading-[0.85] tracking-[-0.035em]" aria-label={name}>
          {nameChars.map((ch, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
              <motion.span
                className={`inline-block ${ch === " " ? "w-[0.25em]" : ""}`}
                initial={{ y: reduce ? 0 : "105%", opacity: reduce ? 0 : 1 }}
                animate={introDone ? { y: "0%", opacity: 1 } : {}}
                transition={{ duration: 1.2, delay: 0.25 + i * 0.045, ease }}
              >
                {ch === " " ? " " : ch}
              </motion.span>
            </span>
          ))}
        </motion.h1>
        <div className="absolute bottom-6 right-5 hidden flex-col items-center gap-3 sm:right-8 md:flex" aria-hidden>
          <span className="label [writing-mode:vertical-rl]">Scroll</span>
          <span className="block h-14 w-px animate-scrollcue bg-accent" />
        </div>
      </div>
    </section>
  );
}
