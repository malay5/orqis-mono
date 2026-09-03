import { ImageResponse } from "next/og";

/**
 * Apple touch icon (Sprint 20). Without this, iOS "Add to Home Screen" uses a
 * screenshot of the page, which looks broken.
 *
 * 180×180 is the size iOS actually asks for; it downscales for everything else.
 * No transparency and no rounding — iOS applies its own mask, and a
 * pre-rounded icon ends up double-rounded.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b0b12 0%, #14101f 100%)",
        }}
      >
        <div style={{ position: "relative", width: 130, height: 130, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 28,
              width: 86,
              height: 86,
              borderRadius: 999,
              border: "14px solid #8b5cf6",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 2,
              top: 2,
              width: 42,
              height: 42,
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
