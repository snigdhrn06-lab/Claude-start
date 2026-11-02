"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#08090a", color: "#ECEAE4", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 400, fontSize: 40 }}>The site is temporarily unavailable.</h1>
          <button onClick={reset} style={{ marginTop: 24, padding: "12px 20px", borderRadius: 999, border: 0, background: "#C8F560", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
