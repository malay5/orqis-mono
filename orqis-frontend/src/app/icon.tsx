import { ImageResponse } from "next/og";

/**
 * Favicon, generated at build time from the orqis mark (Sprint 20).
 *
 * `public/favicon.ico` still covers legacy browsers that only look for the
 * root .ico; this adds a crisp modern PNG. Generated rather than committed as
 * a binary so the mark and the gradient stay in one place — change the colours
 * here and every icon size follows.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07070b",
          borderRadius: 7,
        }}
      >
        {/* The mark: an open ring with a cyan satellite. Drawn with divs
            rather than SVG because Satori's SVG support is partial. */}
        <div style={{ position: "relative", width: 26, height: 26, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: 1,
              top: 5,
              width: 17,
              height: 17,
              borderRadius: 999,
              border: "3px solid #8b5cf6",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "#06b6d4",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
