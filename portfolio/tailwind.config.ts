import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1.25rem", sm: "1.5rem", lg: "2.5rem" }, screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        bg: rgb("--bg"),
        "bg-2": rgb("--bg-2"),
        surface: rgb("--surface"),
        "surface-2": rgb("--surface-2"),
        line: rgb("--line"),
        fg: rgb("--fg"),
        muted: rgb("--muted"),
        dim: rgb("--dim"),
        accent: rgb("--accent"),
        "accent-ink": rgb("--accent-ink"),
        danger: rgb("--danger"),
        ok: rgb("--ok"),
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: { tightest: "-0.045em", label: "0.16em" },
      transitionTimingFunction: { expo: "cubic-bezier(0.16, 1, 0.3, 1)", quart: "cubic-bezier(0.76, 0, 0.24, 1)" },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        scrollcue: { "0%": { transform: "scaleY(0)", transformOrigin: "top" }, "45%": { transform: "scaleY(1)", transformOrigin: "top" }, "55%": { transform: "scaleY(1)", transformOrigin: "bottom" }, "100%": { transform: "scaleY(0)", transformOrigin: "bottom" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.25" } },
      },
      animation: {
        marquee: "marquee var(--marquee-duration, 60s) linear infinite",
        scrollcue: "scrollcue 2.4s cubic-bezier(0.76, 0, 0.24, 1) infinite",
        blink: "blink 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
