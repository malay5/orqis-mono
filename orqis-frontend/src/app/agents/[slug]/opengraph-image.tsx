import { ImageResponse } from "next/og";
import { getAgentBySlug } from "@/lib/agents";

/**
 * Per-agent social card (Sprint 20).
 *
 * Every agent link shared in Slack, X or Discord previously fell back to the
 * generic site card, so 40 different agents all looked identical. This renders
 * the agent's own emoji, name, tagline, price and accent colour.
 *
 * Falls back to a plain orqis-branded card if the API is unreachable at build
 * or request time — a missing preview is better than a failed render.
 */

export const alt = "orqis agent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AgentOpengraphImage({
  params,
}: {
  // Promise, not a plain object — Next 15+ made route params async, and taking
  // them synchronously silently yields `undefined`, which renders the fallback
  // card for every agent.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug).catch(() => null);

  const name = agent?.name ?? "orqis";
  const tagline = agent?.tagline ?? "The marketplace for specialist AI agents";
  const emoji = agent?.iconEmoji || "✨";
  const accent = /^#[0-9a-f]{6}$/i.test(agent?.accentHex ?? "") ? agent!.accentHex : "#a855f7";
  const category = agent?.category ?? "Agent";
  const price = agent?.pricePerCall;

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
        <div
          style={{
            position: "absolute",
            top: -280,
            left: 300,
            width: 860,
            height: 640,
            background: `radial-gradient(circle, ${accent}45, rgba(7,7,11,0) 65%)`,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 132,
              height: 132,
              borderRadius: 30,
              fontSize: 74,
              background: `${accent}22`,
              border: `2px solid ${accent}55`,
            }}
          >
            {emoji}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#8b8799", letterSpacing: 3 }}>
            ORQIS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 24, color: accent, letterSpacing: 2 }}>
            {category.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.02,
              color: "#f7f6fb",
              letterSpacing: -2.5,
              maxWidth: 1000,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#9d9ab0",
              letterSpacing: -0.4,
              maxWidth: 940,
              lineHeight: 1.3,
            }}
          >
            {tagline}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {typeof price === "number" && (
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#e7e5f0",
                border: "1px solid #2a2733",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {price} credits / call
            </div>
          )}
          {agent?.isAsync !== undefined && (
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#b8b5c8",
                border: "1px solid #2a2733",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {agent.isAsync ? "async" : "sync"}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#b8b5c8",
              border: "1px solid #2a2733",
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            REST + MCP
          </div>
        </div>
      </div>
    ),
    size
  );
}
