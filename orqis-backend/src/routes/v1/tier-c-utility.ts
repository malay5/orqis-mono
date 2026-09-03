import type { FastifyPluginAsync } from "fastify";
import { runEmailTruth, type EmailTruthInput } from "../../services/email-truth.js";
import { runDnsTrace, type DnsTraceInput } from "../../services/dns-trace.js";
import { runSslInspect, type SslInspectInput } from "../../services/ssl-inspect.js";
import { runOgCard, type OgCardInput } from "../../services/og-card.js";
import { runPhoneTruth, type PhoneTruthInput } from "../../services/phone-truth.js";
import { runA11yQuick, type A11yQuickInput } from "../../services/a11y-quick.js";
import { statusForThrown } from "../../lib/errors.js";

// Legacy fallback for plain Error services. ValidationError is the typed path.
const VALIDATION_PATTERN =
  /required|invalid|must be|too long|not a valid|Only http|Refusing to fetch|too large|2-letter/;

export const tierCUtilityRoutes: FastifyPluginAsync = async (app) => {
  // ---------- email-truth ----------
  app.get("/agents/email-truth", async () => ({
    name: "email-truth",
    kind: "utility",
    version: "0.16.0",
    doc: "POST /v1/agents/email-truth/run with { email }",
  }));
  app.post("/agents/email-truth/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: EmailTruthInput = {
      email: typeof body.email === "string" ? body.email : "",
    };
    try {
      return await runEmailTruth(input);
    } catch (err) {
      const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "email-truth failed");
      return reply.code(code).send({ error: message });
    }
  });

  // ---------- dns-trace ----------
  app.get("/agents/dns-trace", async () => ({
    name: "dns-trace",
    kind: "utility",
    version: "0.16.0",
    doc: "POST /v1/agents/dns-trace/run with { domain, includeDkimSelectors? }",
  }));
  app.post("/agents/dns-trace/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: DnsTraceInput = {
      domain: typeof body.domain === "string" ? body.domain : "",
      includeDkimSelectors: Array.isArray(body.includeDkimSelectors)
        ? (body.includeDkimSelectors as string[]).filter((s) => typeof s === "string")
        : undefined,
    };
    try {
      return await runDnsTrace(input);
    } catch (err) {
      const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "dns-trace failed");
      return reply.code(code).send({ error: message });
    }
  });

  // ---------- ssl-inspect ----------
  app.get("/agents/ssl-inspect", async () => ({
    name: "ssl-inspect",
    kind: "utility",
    version: "0.16.0",
    doc: "POST /v1/agents/ssl-inspect/run with { host, port?, servername?, rejectUnauthorized? }",
  }));
  app.post("/agents/ssl-inspect/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: SslInspectInput = {
      host: typeof body.host === "string" ? body.host : "",
      port: typeof body.port === "number" ? body.port : undefined,
      servername: typeof body.servername === "string" ? body.servername : undefined,
      rejectUnauthorized: body.rejectUnauthorized !== false,
    };
    try {
      return await runSslInspect(input);
    } catch (err) {
      const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "ssl-inspect failed");
      return reply.code(code).send({ error: message });
    }
  });

  // ---------- og-card ----------
  app.get("/agents/og-card", async () => ({
    name: "og-card",
    kind: "utility",
    version: "0.16.0",
    doc: "POST /v1/agents/og-card/run with { url }",
  }));
  app.post("/agents/og-card/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: OgCardInput = {
      url: typeof body.url === "string" ? body.url : "",
    };
    try {
      return await runOgCard(input);
    } catch (err) {
      const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "og-card failed");
      return reply.code(code).send({ error: message });
    }
  });

  // ---------- phone-truth ----------
  app.get("/agents/phone-truth", async () => ({
    name: "phone-truth",
    kind: "utility",
    version: "0.16.0",
    doc: "POST /v1/agents/phone-truth/run with { phone, defaultCountry? }",
  }));
  app.post("/agents/phone-truth/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: PhoneTruthInput = {
      phone: typeof body.phone === "string" ? body.phone : "",
      defaultCountry: typeof body.defaultCountry === "string" ? body.defaultCountry : undefined,
    };
    try {
      return runPhoneTruth(input);
    } catch (err) {
      const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "phone-truth failed");
      return reply.code(code).send({ error: message });
    }
  });

  // ---------- a11y-quick ----------
  app.get("/agents/a11y-quick", async () => ({
    name: "a11y-quick",
    kind: "utility",
    version: "0.16.0",
    doc: "POST /v1/agents/a11y-quick/run with { url, device?, waitUntil? }",
  }));
  app.post("/agents/a11y-quick/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: A11yQuickInput = {
      url: typeof body.url === "string" ? body.url : "",
      device: body.device === "desktop" || body.device === "mobile" ? body.device : undefined,
      waitUntil:
        body.waitUntil === "load" || body.waitUntil === "domcontentloaded" || body.waitUntil === "networkidle"
          ? body.waitUntil
          : undefined,
    };
    try {
      return await runA11yQuick(input);
    } catch (err) {
      const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "a11y-quick failed");
      return reply.code(code).send({ error: message });
    }
  });
};
