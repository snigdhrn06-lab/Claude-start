"use client";

/**
 * Fallback text extraction for vector screenshots (SVG). Chat bubbles are
 * grouped as <g class="msg" data-sender="…">; any other SVG falls back to its
 * raw <text> content. Raster images require the vision model.
 */
export function parseSvgScreenshot(svgText: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const groups = Array.from(doc.querySelectorAll("g.msg, g[data-sender]"));
    if (groups.length) {
      return groups
        .map((g) => {
          const sender = g.getAttribute("data-sender") || "Unknown sender";
          const text = Array.from(g.querySelectorAll("text"))
            .map((t) => t.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ");
          return `${sender}: ${text}`;
        })
        .join("\n");
    }
    const lines = Array.from(doc.querySelectorAll("text:not(.ui)"))
      .map((t) => t.textContent?.trim() ?? "")
      .filter(Boolean);
    return lines.length ? lines.map((l) => `Unknown sender: ${l}`).join("\n") : null;
  } catch {
    return null;
  }
}

export function readFile(file: File, as: "text" | "dataUrl"): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read file"));
    r.onload = () => resolve(String(r.result));
    if (as === "text") r.readAsText(file);
    else r.readAsDataURL(file);
  });
}
