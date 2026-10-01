import { writeFileSync } from "node:fs";
import { SCENARIOS } from "../src/lib/scenarios";
import { parseConversation } from "../src/lib/engine/parse";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function wrap(text: string, max = 34) {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max) { out.push(line.trim()); line = w; } else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
for (const sc of SCENARIOS) {
  const msgs = parseConversation(sc.conversation);
  const W = 390;
  let y = 96;
  const parts: string[] = [];
  for (const m of msgs) {
    const lines = wrap(m.text);
    const h = lines.length * 18 + 16;
    const bw = Math.min(290, Math.max(...lines.map((l) => l.length)) * 7.4 + 24);
    const x = m.self ? W - 16 - bw : 16;
    parts.push(`<g class="msg" data-sender="${esc(m.self ? "You" : m.sender)}">`);
    parts.push(`<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="12" fill="${m.self ? "#1f6f5c" : "#1d2026"}"/>`);
    lines.forEach((l, i) => parts.push(`<text x="${x + 12}" y="${y + 22 + i * 18}" font-size="13" fill="#e9edf1">${esc(l)}</text>`));
    parts.push(`</g>`);
    y += h + 10;
  }
  const H = y + 70;
  const sender = msgs.find((m) => !m.self)!.sender;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
<metadata>Synthetic Sentinel demo screenshot — fictional data.</metadata>
<rect width="${W}" height="${H}" fill="#0b0d10"/>
<rect width="${W}" height="72" fill="#14171c"/>
<circle cx="36" cy="38" r="16" fill="#2a2f38"/>
<text x="31" y="43" font-size="14" fill="#c9ced6" class="ui">${esc(sender[0])}</text>
<text x="62" y="34" font-size="15" fill="#f1f3f5" font-weight="600" class="ui">${esc(sender)}</text>
<text x="62" y="52" font-size="11" fill="#7d8592" class="ui">${esc(sc.channel)}</text>
${parts.join("\n")}
<rect y="${H - 54}" width="${W}" height="54" fill="#14171c"/>
<rect x="14" y="${H - 42}" width="${W - 28}" height="30" rx="15" fill="#22262d"/>
<text x="30" y="${H - 22}" font-size="12" fill="#6b7280" class="ui">Message</text>
</svg>`;
  writeFileSync(`public/samples/${sc.id}.svg`, svg);
  console.log(sc.id, H);
}
