import { ImageResponse } from "next/og";

// Default social card for every route that does not declare its own image.
// No `fonts` option and no remote assets: next/og falls back to its bundled sans face, so this
// renders offline in the container. Colours are the tokens from globals.css.
export const alt = "ChartRelay — deterministic SVG plus PNG charts with alt text and a QA review on every render";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#151621";
const accent = "#6c5ce7";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: ink,
          backgroundImage: `radial-gradient(circle at 78% 6%, rgba(108,92,231,0.55), rgba(21,22,33,0) 58%)`,
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: accent,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            CR
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>ChartRelay</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>
            Charts your agents can ship.
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 30, lineHeight: 1.4, color: "#c3c7d4" }}>
            Deterministic SVG plus PNG, alt text and a QA review on every render.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 120, height: 6, borderRadius: 3, backgroundColor: accent }} />
          <div style={{ display: "flex", fontSize: 24, color: "#8d93a6" }}>Chart API · MCP server · Chart QA</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
