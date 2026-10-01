import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050607",
          900: "#08090b",
          850: "#0c0d10",
          800: "#101216",
          750: "#14171c",
          700: "#1a1d23",
          600: "#242830",
          500: "#2f343d",
        },
        fg: { DEFAULT: "#eceef1", muted: "#9aa1ad", dim: "#626a77", faint: "#3d434d" },
        risk: { DEFAULT: "#ff4a3d", soft: "#ff6b5e", deep: "#c2271c" },
        warn: { DEFAULT: "#ff8c42" },
        caution: { DEFAULT: "#f2c14e" },
        safe: { DEFAULT: "#33d69f" },
        info: { DEFAULT: "#8fb4ff" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderColor: { DEFAULT: "rgba(255,255,255,0.07)" },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] },
      letterSpacing: { label: "0.14em" },
      keyframes: {
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        scan: "scan 2.4s linear infinite",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
