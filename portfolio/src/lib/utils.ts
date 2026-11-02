import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function formatRange(start: string, end: string) {
  if (!start && !end) return "";
  if (!end) return start;
  if (!start) return end;
  return `${start} – ${end}`;
}

export function isExternal(url: string) {
  return /^https?:\/\//i.test(url);
}

/** Splits "Separating the *signal*" into [{text, em}] segments for emphasis rendering. */
export function emphasisSegments(line: string): { text: string; em: boolean }[] {
  const out: { text: string; em: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), em: false });
    out.push({ text: m[1]!, em: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), em: false });
  return out;
}

export function stripEmphasis(s: string) {
  return s.replace(/\*/g, "");
}
