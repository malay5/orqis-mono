/**
 * Shared SSRF guard. Inlined into individual services earlier (img-shrink,
 * scrape-clean, ocr-vision); hoisted here now that every new HTTP-fetching
 * agent needs the same allowlist.
 *
 * Resolves the URL's hostname and rejects if it points at a private /
 * loopback / link-local / multicast address. Does NOT re-fetch via the
 * resolved IP afterwards (DNS rebinding mitigation is left to the fetch
 * stack); rejecting when DNS *currently* points anywhere unsafe is good
 * enough for our threat model.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ValidationError } from "./errors.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const PRIVATE_V4_BLOCKS: [bigint, bigint][] = (
  [
    ["0.0.0.0", "0.255.255.255"],
    ["10.0.0.0", "10.255.255.255"],
    ["100.64.0.0", "100.127.255.255"],
    ["127.0.0.0", "127.255.255.255"],
    ["169.254.0.0", "169.254.255.255"],
    ["172.16.0.0", "172.31.255.255"],
    ["192.0.0.0", "192.0.0.255"],
    ["192.168.0.0", "192.168.255.255"],
    ["198.18.0.0", "198.19.255.255"],
    ["224.0.0.0", "239.255.255.255"],
    ["240.0.0.0", "255.255.255.255"],
  ] as const
).map(([a, b]) => [v4ToBigInt(a), v4ToBigInt(b)] as [bigint, bigint]);

function v4ToBigInt(addr: string): bigint {
  return addr
    .split(".")
    .map((p) => BigInt(Number(p)))
    .reduce((acc, p) => (acc << 8n) | p, 0n);
}

export function isBlockedV4(addr: string): boolean {
  if (isIP(addr) !== 4) return false;
  const n = v4ToBigInt(addr);
  return PRIVATE_V4_BLOCKS.some(([lo, hi]) => n >= lo && n <= hi);
}

export function isBlockedV6(addr: string): boolean {
  if (isIP(addr) !== 6) return false;
  const norm = addr.toLowerCase();
  return (
    norm === "::1" ||
    /^fc|^fd|^fe[89ab]/.test(norm) ||
    norm.includes("::ffff:127.") ||
    norm.includes("::ffff:10.") ||
    norm.includes("::ffff:192.168.") ||
    norm.includes("::ffff:172.")
  );
}

/**
 * Validate a raw URL string and return its parsed form if safe. Throws on
 * invalid protocol or private address — caller is expected to surface the
 * error message back to the API client with a 400.
 */
export async function assertSafeUrl(raw: string, fieldName = "url"): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError(`${fieldName} is not a valid URL`);
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError(`Only http(s) URLs are allowed; got ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  if (isIP(host)) {
    if (isBlockedV4(host) || isBlockedV6(host)) {
      throw new ValidationError("Refusing to fetch from a private / loopback IP");
    }
    return parsed;
  }
  const records = await dnsLookup(host, { all: true });
  for (const r of records) {
    if (r.family === 4 ? isBlockedV4(r.address) : isBlockedV6(r.address)) {
      throw new ValidationError(
        `Refusing to fetch ${host}: resolves to a private / loopback address`
      );
    }
  }
  return parsed;
}
