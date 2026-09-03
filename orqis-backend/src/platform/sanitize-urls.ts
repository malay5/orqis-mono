
/**
 * Sprint 18 (F4 fix): seller-supplied responses contained URL-shaped fields
 * (previewUrl, downloadUrl, htmlDownloadUrl, posterUrl, …) that the dashboard
 * + Try-It panel render directly — into `<a href>`, `<iframe src>`, and
 * `<img src>`. A malicious seller could embed `javascript:alert(1)` or
 * `data:text/html,<script>…</script>` and have that execute in the buyer's
 * browser context.
 *
 * sanitizeResultUrls walks an arbitrary JSON value, and for any string at a
 * key matching /url$/i (case-insensitive), drops it to `null` unless the
 * scheme is http or https. Nesting and arrays are handled. The original
 * value's shape is preserved; only specific string fields are zeroed.
 *
 * Defensive caps: max 200 nodes visited / 10 levels deep / 6 KB total
 * stringified — prevents adversarial payloads from spending unbounded CPU
 * here. Anything past the cap is left as-is.
 */

const MAX_NODES = 200;
const MAX_DEPTH = 10;
const URL_KEY_RE = /url$/i;
const SAFE_SCHEME_RE = /^https?:\/\//i;

export function sanitizeResultUrls(input: unknown): unknown {
  let visited = 0;
  const walk = (value: unknown, depth: number): unknown => {
    if (visited >= MAX_NODES || depth > MAX_DEPTH) return value;
    visited++;
    if (Array.isArray(value)) {
      return value.map((v) => walk(v, depth + 1));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (URL_KEY_RE.test(k) && typeof v === "string") {
          out[k] = SAFE_SCHEME_RE.test(v.trim()) ? v.trim() : null;
        } else {
          out[k] = walk(v, depth + 1);
        }
      }
      return out;
    }
    return value;
  };
  return walk(input, 0);
}
