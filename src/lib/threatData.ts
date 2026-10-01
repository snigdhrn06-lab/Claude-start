// Synthetic metrics for the Threat Center. Deterministic so the demo never changes between runs.
// These are NOT real Sentinel users.

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const r = rng(42);
const DAYS = 14;

export const DAILY = Array.from({ length: DAYS }, (_, i) => {
  const base = 120 + Math.round(i * 6 + r() * 40);
  const high = Math.round(base * (0.16 + r() * 0.08));
  const avg = Math.round(34 + r() * 10 + (i > 9 ? 4 : 0));
  return { day: `D-${DAYS - 1 - i}`, scans: base, high, other: base - high, avgRisk: avg };
});
DAILY[DAYS - 1].day = "Today";

export const PATTERNS = [
  { name: "KYC / bank impersonation", value: 412 },
  { name: "Fake refund / reversal", value: 287 },
  { name: "Investment / trading", value: 231 },
  { name: "Unknown-number family emergency", value: 164 },
  { name: "Job / task payment", value: 118 },
  { name: "Utility disconnection", value: 77 },
];

export const SEVERITY = [
  { name: "Critical", value: 214, color: "#ff4a3d" },
  { name: "High", value: 379, color: "#ff8c42" },
  { name: "Elevated", value: 466, color: "#f2c14e" },
  { name: "Low", value: 1349, color: "#33d69f" },
];

const totalScans = DAILY.reduce((a, d) => a + d.scans, 0);
const totalHigh = DAILY.reduce((a, d) => a + d.high, 0);

export const KPIS = {
  scans: totalScans,
  highRisk: totalHigh,
  prevented: 4_812_400,
  avgRisk: Math.round(DAILY.reduce((a, d) => a + d.avgRisk, 0) / DAYS),
  protection: 92,
  holdRate: 71,
};

export const ALERTS = [
  { t: "2m", title: "KYC impersonation · ₹18,500 held", score: 94, channel: "SMS → call" },
  { t: "11m", title: "Refund reversal · ₹12,999 held", score: 92, channel: "Phone → UPI" },
  { t: "26m", title: "Investment pitch · ₹75,000 held", score: 92, channel: "Telegram" },
  { t: "48m", title: "New-number family emergency · ₹9,000", score: 77, channel: "WhatsApp" },
  { t: "1h", title: "Electricity disconnection notice · ₹4,890", score: 81, channel: "SMS" },
  { t: "2h", title: "Collect request disguised as refund · ₹2,499", score: 64, channel: "UPI" },
];
