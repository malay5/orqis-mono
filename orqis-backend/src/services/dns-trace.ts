/**
 * dns-trace — full-spectrum DNS audit for a domain.
 *
 * Returns all major record types (A / AAAA / MX / NS / TXT / CAA / SOA),
 * plus parsed views of common TXT records (SPF / DMARC / DKIM hints).
 *
 * Lookups go through Node's built-in resolver which respects the system
 * resolver order. Cross-resolver propagation checking (8.8.8.8 vs 1.1.1.1
 * vs 9.9.9.9) is a follow-up feature — it requires raw UDP queries which
 * blow past what we want to bring in for v1.
 */

import { Resolver } from "node:dns/promises";

export type DnsTraceInput = {
  domain: string;
  includeDkimSelectors?: string[];
};

export type DnsTraceResult = {
  domain: string;
  records: {
    a: string[];
    aaaa: string[];
    mx: { exchange: string; priority: number }[];
    ns: string[];
    txt: string[];
    caa: { critical: number; issue?: string; issuewild?: string; iodef?: string }[];
    soa: { nsname: string; hostmaster: string; serial: number; refresh: number; retry: number; expire: number; minttl: number } | null;
  };
  parsed: {
    spf: string | null;
    dmarc: string | null;
    mxHosts: string[];
    nsHosts: string[];
    dkim: Record<string, string | null>;
  };
  summary: {
    hasA: boolean;
    hasAaaa: boolean;
    hasMx: boolean;
    hasSpf: boolean;
    hasDmarc: boolean;
    hasCaa: boolean;
  };
  errors: Record<string, string>;
  durationMs: number;
};

const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function runDnsTrace(input: DnsTraceInput): Promise<DnsTraceResult> {
  const domain = (input.domain ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!domain) throw new Error("domain is required");
  if (domain.length > 253) throw new Error("domain too long (>253 chars)");
  if (!DOMAIN_RE.test(domain)) {
    throw new Error("domain is not a valid hostname");
  }

  const startedAt = performance.now();
  const resolver = new Resolver();

  const errors: Record<string, string> = {};
  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // ENOTFOUND / ENODATA are expected for record types the domain doesn't have.
      if (!/ENOTFOUND|ENODATA/.test(msg)) errors[label] = msg;
      return null;
    }
  };

  const [a, aaaa, mx, ns, txt, caa, soa] = await Promise.all([
    safe("a", () => resolver.resolve4(domain)),
    safe("aaaa", () => resolver.resolve6(domain)),
    safe("mx", () => resolver.resolveMx(domain)),
    safe("ns", () => resolver.resolveNs(domain)),
    safe("txt", () => resolver.resolveTxt(domain)),
    safe("caa", () => resolver.resolveCaa(domain)),
    safe("soa", () => resolver.resolveSoa(domain)),
  ]);

  // dmarc lives on _dmarc.<domain>
  const dmarcTxt = await safe("dmarc", () => resolver.resolveTxt(`_dmarc.${domain}`));

  // dkim lives on <selector>._domainkey.<domain>; selectors aren't discoverable
  // without trying each one. We probe whatever the caller hands us.
  const dkimSelectors = (input.includeDkimSelectors ?? ["default", "google", "k1", "selector1", "selector2"]).slice(0, 8);
  const dkimResults: Record<string, string | null> = {};
  await Promise.all(
    dkimSelectors.map(async (sel) => {
      const r = await safe(`dkim:${sel}`, () =>
        resolver.resolveTxt(`${sel}._domainkey.${domain}`)
      );
      dkimResults[sel] = r ? r.map((chunks) => chunks.join("")).join("\n") || null : null;
    })
  );

  const txtFlat = (txt ?? []).map((chunks) => chunks.join(""));
  const spf = txtFlat.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;
  const dmarcFlat = (dmarcTxt ?? []).map((chunks) => chunks.join(""));
  const dmarc = dmarcFlat.find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null;

  const records: DnsTraceResult["records"] = {
    a: a ?? [],
    aaaa: aaaa ?? [],
    mx: mx
      ? mx.sort((x, y) => x.priority - y.priority).map((m) => ({ exchange: m.exchange, priority: m.priority }))
      : [],
    ns: ns ?? [],
    txt: txtFlat,
    caa: caa
      ? caa.map((c) => ({
          critical: c.critical,
          issue: c.issue,
          issuewild: c.issuewild,
          iodef: c.iodef,
        }))
      : [],
    soa: soa
      ? {
          nsname: soa.nsname,
          hostmaster: soa.hostmaster,
          serial: soa.serial,
          refresh: soa.refresh,
          retry: soa.retry,
          expire: soa.expire,
          minttl: soa.minttl,
        }
      : null,
  };

  return {
    domain,
    records,
    parsed: {
      spf,
      dmarc,
      mxHosts: records.mx.map((m) => m.exchange),
      nsHosts: records.ns,
      dkim: dkimResults,
    },
    summary: {
      hasA: records.a.length > 0,
      hasAaaa: records.aaaa.length > 0,
      hasMx: records.mx.length > 0,
      hasSpf: !!spf,
      hasDmarc: !!dmarc,
      hasCaa: records.caa.length > 0,
    },
    errors,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
