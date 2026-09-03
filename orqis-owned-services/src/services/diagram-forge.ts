/**
 * diagram-forge — text → SVG diagram, via nomnoml.
 *
 * nomnoml is a tiny pure-JS diagramming lib (no DOM, no headless browser).
 * Input is a compact text DSL; output is a self-contained SVG string we can
 * inline in the response.
 *
 * Example input:
 *   [Buyer] -> [orqis API]
 *   [orqis API] -> [Seller Agent]
 *   [Seller Agent] -> [orqis API]
 *   [orqis API] -> [Buyer]
 */

// nomnoml ships ESM with a default export; types come bundled.
import * as nomnomlMod from "nomnoml";

type NomnomlLike = { renderSvg: (source: string) => string };
const nomnoml: NomnomlLike =
  (nomnomlMod as unknown as { default?: NomnomlLike }).default ??
  (nomnomlMod as unknown as NomnomlLike);

export type DiagramForgeInput = {
  source: string;
  direction?: "down" | "right";
  style?: "default" | "ink" | "vintage" | "minimal";
};

export type DiagramForgeResult = {
  svg: string;
  width: number;
  height: number;
  sourceLength: number;
  styleApplied: string;
  durationMs: number;
};

const STYLE_PRELUDES: Record<NonNullable<DiagramForgeInput["style"]>, string> = {
  default: "#fontSize: 14\n#lineWidth: 1.5\n#fill: #fefefe; #f5f3ff\n#stroke: #4c1d95\n",
  ink: "#fontSize: 14\n#lineWidth: 2\n#fill: #ffffff\n#stroke: #111111\n#bendSize: 0.4\n",
  vintage: "#fontSize: 14\n#fill: #fdf6e3; #f5e6b8\n#stroke: #8b6914\n#font: Georgia\n",
  minimal: "#fontSize: 12\n#lineWidth: 1\n#fill: #ffffff\n#stroke: #6b7280\n#padding: 6\n",
};

export function runDiagramForge(input: DiagramForgeInput): DiagramForgeResult {
  if (!input.source || typeof input.source !== "string") {
    throw new Error("source is required");
  }
  if (input.source.length > 20_000) {
    throw new Error(`source too long: ${input.source.length} chars (max 20000)`);
  }
  const style = input.style ?? "default";
  if (!STYLE_PRELUDES[style]) {
    throw new Error(`style must be one of: ${Object.keys(STYLE_PRELUDES).join(", ")}`);
  }

  const startedAt = performance.now();
  const direction = input.direction === "right" ? "#direction: right\n" : "";
  const prelude = STYLE_PRELUDES[style] + direction;
  // Only prepend prelude if user hasn't already set their own directives.
  const composed = /^#[a-zA-Z]/m.test(input.source) ? input.source : prelude + "\n" + input.source;

  let svg: string;
  try {
    svg = nomnoml.renderSvg(composed);
  } catch (err) {
    throw new Error(
      `nomnoml parse error: ${err instanceof Error ? err.message : "unknown"}`
    );
  }

  const widthMatch = svg.match(/<svg[^>]*\bwidth="([\d.]+)"/);
  const heightMatch = svg.match(/<svg[^>]*\bheight="([\d.]+)"/);

  return {
    svg,
    width: widthMatch ? Math.round(Number(widthMatch[1])) : 0,
    height: heightMatch ? Math.round(Number(heightMatch[1])) : 0,
    sourceLength: input.source.length,
    styleApplied: style,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
