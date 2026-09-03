/**
 * ssl-inspect — TLS certificate chain inspector.
 *
 * Opens a TLS connection to `host:port`, reads back the negotiated cert
 * chain, and returns parsed metadata: issuer, subject, SANs, validity
 * window, days-until-expiry, signature algorithm, key length, protocol /
 * cipher negotiated.
 *
 * Doesn't validate the chain (we trust Node's default verify); the goal
 * here is observability — "what does this server present and when does it
 * expire" — not security-grade validation. We do flag obvious red signals
 * (expired / about-to-expire / self-signed / wrong host) in the summary.
 */

import { connect as tlsConnect, type PeerCertificate, type DetailedPeerCertificate } from "node:tls";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedV4, isBlockedV6 } from "../lib/url-guard.js";

export type SslInspectInput = {
  host: string;
  port?: number;
  servername?: string;
  rejectUnauthorized?: boolean;
};

type CertView = {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  signatureAlgorithm: string | null;
  fingerprint256: string;
  subjectAltNames: string[];
  isSelfSigned: boolean;
  keyBits: number | null;
};

export type SslInspectResult = {
  host: string;
  port: number;
  protocol: string | null;
  cipher: { name: string; standardName?: string; version: string } | null;
  authorized: boolean;
  authorizationError: string | null;
  chain: CertView[];
  leaf: CertView | null;
  summary: {
    daysUntilExpiry: number | null;
    isExpired: boolean;
    isExpiringSoon: boolean;
    matchesHost: boolean | null;
    hasWeakSignature: boolean;
  };
  durationMs: number;
};

const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const CONNECT_TIMEOUT_MS = 10_000;
const EXPIRING_SOON_DAYS = 30;
const WEAK_SIG_ALGOS = /sha1|md5/i;

function formatName(record: PeerCertificate["subject"]): string {
  if (!record) return "";
  const order: (keyof PeerCertificate["subject"])[] = ["CN", "O", "OU", "C", "L", "ST"];
  return order
    .map((k) => (record[k] ? `${k}=${record[k]}` : null))
    .filter(Boolean)
    .join(", ");
}

function viewCert(cert: PeerCertificate | DetailedPeerCertificate): CertView {
  const validTo = cert.valid_to ? new Date(cert.valid_to) : new Date(0);
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : new Date(0);
  const daysUntilExpiry = Math.round((validTo.getTime() - Date.now()) / 86_400_000);
  const sans = cert.subjectaltname
    ? cert.subjectaltname.split(",").map((s) => s.trim().replace(/^DNS:/, ""))
    : [];
  const subject = formatName(cert.subject);
  const issuer = formatName(cert.issuer);
  return {
    subject,
    issuer,
    serialNumber: cert.serialNumber ?? "",
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    daysUntilExpiry,
    signatureAlgorithm: (cert as PeerCertificate & { sigalg?: string }).sigalg ?? null,
    fingerprint256: cert.fingerprint256 ?? "",
    subjectAltNames: sans,
    isSelfSigned: subject === issuer,
    keyBits: (cert as PeerCertificate & { bits?: number }).bits ?? null,
  };
}

function buildChain(leaf: DetailedPeerCertificate): CertView[] {
  const chain: CertView[] = [];
  let current: DetailedPeerCertificate | undefined = leaf;
  const seen = new Set<string>();
  while (current && !seen.has(current.fingerprint256 ?? "")) {
    chain.push(viewCert(current));
    seen.add(current.fingerprint256 ?? "");
    if (current.issuerCertificate && current.issuerCertificate !== current) {
      current = current.issuerCertificate;
    } else {
      break;
    }
  }
  return chain;
}

function hostMatches(host: string, sans: string[], cn: string): boolean {
  const candidates = [...sans];
  const cnMatch = cn.match(/CN=([^,]+)/);
  if (cnMatch) candidates.push(cnMatch[1]);
  return candidates.some((pat) => matchPattern(host, pat));
}

function matchPattern(host: string, pattern: string): boolean {
  if (pattern === host) return true;
  if (pattern.startsWith("*.")) {
    const tail = pattern.slice(2);
    const dot = host.indexOf(".");
    return dot > 0 && host.slice(dot + 1) === tail;
  }
  return false;
}

/**
 * Sprint 18 (F1 fix): ssl-inspect previously opened a TLS socket to any
 * host without restriction. An attacker could probe localhost, RFC1918
 * addresses, link-local (169.254/16 — covers cloud metadata endpoints
 * like AWS IMDS), or carrier-grade NAT space. Apply the same DNS-resolve-
 * then-block-private rules as the HTTP agents. Hostnames resolve through
 * the system resolver and EVERY returned address must be public; IP
 * literals are checked directly.
 */
async function assertSafeTlsTarget(host: string): Promise<void> {
  if (isIP(host)) {
    if (isBlockedV4(host) || isBlockedV6(host)) {
      throw new Error("Refusing to inspect a private / loopback / link-local IP");
    }
    return;
  }
  const records = await dnsLookup(host, { all: true });
  if (records.length === 0) {
    throw new Error(`host ${host} could not be resolved`);
  }
  for (const r of records) {
    if (r.family === 4 ? isBlockedV4(r.address) : isBlockedV6(r.address)) {
      throw new Error(
        `Refusing to inspect ${host}: resolves to a private / loopback / link-local address`
      );
    }
  }
}

export async function runSslInspect(input: SslInspectInput): Promise<SslInspectResult> {
  const host = (input.host ?? "").trim().toLowerCase();
  if (!host) throw new Error("host is required");
  if (!HOST_RE.test(host) && !isIP(host)) throw new Error("host is not a valid hostname");
  const port = clampInt(input.port ?? 443, 1, 65535);
  const servername = input.servername ?? host;

  await assertSafeTlsTarget(host);

  const startedAt = performance.now();
  return new Promise<SslInspectResult>((resolve, reject) => {
    const socket = tlsConnect({
      host,
      port,
      servername,
      // Default to true — we report authorizationError but don't tear down.
      // Set rejectUnauthorized:false to inspect self-signed / expired certs.
      rejectUnauthorized: input.rejectUnauthorized !== false,
    });
    socket.setTimeout(CONNECT_TIMEOUT_MS);

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try {
        socket.end();
      } catch {
        /* ignore */
      }
      fn();
    };

    socket.on("secureConnect", () => {
      try {
        const leaf = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();
        const chain = buildChain(leaf as DetailedPeerCertificate);
        const leafView = chain[0] ?? null;
        const hostOk = leafView ? hostMatches(host, leafView.subjectAltNames, leafView.subject) : null;
        const weak = leafView ? WEAK_SIG_ALGOS.test(leafView.signatureAlgorithm ?? "") : false;
        settle(() =>
          resolve({
            host,
            port,
            protocol,
            cipher: cipher
              ? { name: cipher.name, standardName: (cipher as { standardName?: string }).standardName, version: cipher.version }
              : null,
            authorized: socket.authorized,
            authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
            chain,
            leaf: leafView,
            summary: {
              daysUntilExpiry: leafView?.daysUntilExpiry ?? null,
              isExpired: leafView ? leafView.daysUntilExpiry < 0 : false,
              isExpiringSoon: leafView ? leafView.daysUntilExpiry >= 0 && leafView.daysUntilExpiry < EXPIRING_SOON_DAYS : false,
              matchesHost: hostOk,
              hasWeakSignature: weak,
            },
            durationMs: Math.round(performance.now() - startedAt),
          })
        );
      } catch (err) {
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
      }
    });

    socket.on("error", (err) => {
      settle(() => reject(new Error(`TLS connect failed: ${err.message}`)));
    });
    socket.on("timeout", () => {
      settle(() => reject(new Error(`TLS connect timed out after ${CONNECT_TIMEOUT_MS}ms`)));
    });
  });
}

function clampInt(n: unknown, lo: number, hi: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
