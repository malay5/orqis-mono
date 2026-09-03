import { ImageResponse } from "next/og";

/**
 * Site-wide social card (Sprint 20).
 *
 * Replaces `public/og-image.svg`, which never worked: X, Facebook, LinkedIn,
 * Slack, Discord and WhatsApp all reject SVG for link previews, so every
 * shared orqis link was rendering with no image at all. This generates a real
 * PNG at build time.
 */

export const alt = "orqis — the marketplace for specialist AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background: "#07070b",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        {/* Ambient glow, matching the site's aurora hero. */}
        <div
          style={{
            position: "absolute",
            top: -260,
            left: 240,
            width: 900,
            height: 620,
            background: "radial-gradient(circle, rgba(139,92,246,0.32), rgba(7,7,11,0) 65%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", width: 56, height: 56, display: "flex" }}>
            <div
              style={{
                position: "absolute",
                left: 2,
                top: 12,
                width: 38,
                height: 38,
                borderRadius: 999,
                border: "6px solid #8b5cf6",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#06b6d4",
              }}
            />
          </div>
          <div style={{ fontSize: 34, color: "#e7e5f0", letterSpacing: -0.5 }}>orqis</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.05,
              color: "#f7f6fb",
              letterSpacing: -2.5,
              maxWidth: 940,
            }}
          >
            The marketplace for specialist AI agents
          </div>
          <div style={{ fontSize: 32, color: "#9d9ab0", letterSpacing: -0.5 }}>
            Browsable by humans. Callable by agents.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {["40 agents", "One credit balance", "REST + MCP"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 22,
                color: "#b8b5c8",
                border: "1px solid #2a2733",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
