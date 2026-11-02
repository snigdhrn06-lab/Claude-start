"use client";
/**
 * Headline reveal: each word slides up from behind a mask, staggered.
 * Supports *emphasis* (rendered italic in the accent colour) and \n line breaks.
 * Screen readers get the plain sentence via aria-label.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Fragment } from "react";
import { emphasisSegments, stripEmphasis } from "@/lib/utils";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  /** Animate on mount (hero) instead of when scrolled into view. */
  immediate?: boolean;
  play?: boolean;
  as?: "h1" | "h2" | "h3" | "p" | "span";
};

export function SplitWords({ text, className, delay = 0, stagger = 0.06, immediate = false, play = true, as = "h2" }: Props) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const lines = text.split("\n");
  let index = 0;
  const variants: Variants = {
    hidden: { y: reduce ? "0%" : "110%", opacity: reduce ? 0 : 1 },
    shown: (i: number) => ({
      y: "0%",
      opacity: 1,
      transition: { duration: reduce ? 0.3 : 1.05, delay: reduce ? 0 : delay + i * stagger, ease: [0.16, 1, 0.3, 1] as const },
    }),
  };
  const animateProps = immediate
    ? { initial: "hidden", animate: play ? "shown" : "hidden" }
    : { initial: "hidden", whileInView: "shown", viewport: { once: true, margin: "0px 0px -10% 0px" } };

  // Tokenise into words (split on whitespace only), keeping emphasis per character run,
  // so punctuation stays attached to the word before it ("*hard*." stays one unit).
  const toWords = (line: string) => {
    const words: { text: string; em: boolean }[][] = [[]];
    for (const seg of emphasisSegments(line)) {
      seg.text.split(/(\s+)/).forEach((piece) => {
        if (!piece) return;
        if (/^\s+$/.test(piece)) words.push([]);
        else words[words.length - 1]!.push({ text: piece, em: seg.em });
      });
    }
    return words.filter((w) => w.length);
  };

  return (
    <Tag className={className} aria-label={stripEmphasis(text.replace(/\n/g, " "))} {...animateProps}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden>
          {toWords(line).map((parts, wi) => {
            const i = index++;
            return (
              <Fragment key={wi}>
                {wi > 0 && " "}
                <span className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] pr-[0.08em] -mr-[0.08em] align-bottom">
                  <motion.span custom={i} variants={variants} className="inline-block">
                    {parts.map((part, pi) =>
                      part.em ? (
                        <span key={pi} className="font-display italic text-accent">
                          {part.text}
                        </span>
                      ) : (
                        <Fragment key={pi}>{part.text}</Fragment>
                      ),
                    )}
                  </motion.span>
                </span>
              </Fragment>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
