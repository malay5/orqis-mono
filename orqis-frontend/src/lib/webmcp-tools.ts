/**
 * Tool definitions shared by the WebMCP integration.
 *
 * These deliberately mirror `@orqis/mcp`'s stdio tools (orqis_search_agents,
 * orqis_get_agent, orqis_invoke_agent, orqis_check_job, orqis_get_balance) so
 * an agent gets the same capabilities whether it launched the MCP server as a
 * subprocess or is driving the site in a browser. Same names, same argument
 * shapes, same descriptions — only the transport differs.
 *
 * Each tool calls this app's own `/api/...` routes rather than the backend
 * directly: those routes already hold the session cookie, so a signed-in
 * visitor's browser agent acts as that user, with their credits and their
 * rate limits, without any key being exposed to page scripts.
 */

export type WebMcpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>;
};

function ok(value: unknown): WebMcpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function err(message: string): WebMcpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Fetch JSON from a same-origin route, surfacing API errors as tool errors. */
async function call(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      // Same-origin, so the session cookie rides along automatically.
      credentials: "same-origin",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${res.status})`;
      return { ok: false, message };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Network error" };
  }
}

export function buildTools(): WebMcpTool[] {
  return [
    {
      name: "orqis_search_agents",
      description:
        "Search the orqis catalogue for specialist AI agents. Use this when the user asks for a capability you don't have natively — rendering a page to PDF, validating an email, summarising a scraped page, generating a QR code. Returns matches with slug, name, tagline, price in credits, and whether the agent is async. Pass a result's `slug` to orqis_get_agent or orqis_invoke_agent.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free text, e.g. 'pdf' or 'email validation'." },
          category: {
            type: "string",
            description: "Optional exact category filter, e.g. 'LLM', 'Utilities', 'Web'.",
          },
          limit: { type: "number", description: "Max results (default 10, max 40)." },
        },
        required: ["query"],
      },
      async execute(args) {
        const params = new URLSearchParams();
        if (typeof args.query === "string" && args.query) params.set("q", args.query);
        if (typeof args.category === "string" && args.category) params.set("category", args.category);
        params.set("limit", String(Math.min(40, Number(args.limit) || 10)));

        const r = await call(`/api/v1/agents?${params}`);
        if (!r.ok) return err(`Search failed: ${r.message}`);

        const agents = (r.data as { agents?: Array<Record<string, unknown>> }).agents ?? [];
        return ok(
          agents.map((a) => ({
            slug: a.slug,
            name: a.name,
            tagline: a.tagline,
            category: a.category,
            pricePerCall: a.pricePerCall,
            isAsync: a.isAsync,
          }))
        );
      },
    },

    {
      name: "orqis_get_agent",
      description:
        "Fetch full detail for one agent: description, input and output JSON Schema, example request and response, price, and whether it runs async. Always call this before orqis_invoke_agent on an unfamiliar agent so you know the exact shape its input expects.",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string", description: "Agent slug, e.g. 'email-truth'." } },
        required: ["slug"],
      },
      async execute(args) {
        const slug = String(args.slug ?? "");
        if (!slug) return err("slug is required.");
        const r = await call(`/api/v1/agents/${encodeURIComponent(slug)}`);
        if (!r.ok) return err(`Could not load '${slug}': ${r.message}`);
        return ok((r.data as { agent?: unknown }).agent ?? r.data);
      },
    },

    {
      name: "orqis_invoke_agent",
      description:
        "Run an orqis agent on behalf of the signed-in user. Sync agents return their result inline; async agents return { status: 'pending', invocationId } — poll orqis_check_job until it settles. Debits credits from the user's balance, and failed calls are refunded automatically. Validate `input` against the agent's inputSchema first.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Agent slug to run." },
          input: {
            type: "object",
            description: "Payload matching the agent's inputSchema.",
            additionalProperties: true,
          },
        },
        required: ["slug", "input"],
      },
      async execute(args) {
        const slug = String(args.slug ?? "");
        if (!slug) return err("slug is required.");
        const input = (args.input ?? {}) as Record<string, unknown>;

        const r = await call(`/api/agents/${encodeURIComponent(slug)}/invoke`, {
          method: "POST",
          body: input,
        });
        if (!r.ok) {
          // 401 here means nobody is signed in — worth saying plainly, since
          // the fix is a user action, not a different tool call.
          return err(
            `Invoking '${slug}' failed: ${r.message}` +
              (/sign in/i.test(r.message) ? " Ask the user to sign in at /signin first." : "")
          );
        }
        return ok(r.data);
      },
    },

    {
      name: "orqis_check_job",
      description:
        "Poll an async invocation by its id. Returns { status, result, errorCode, latencyMs }. status is one of pending, succeeded, failed, refunded. Poll every few seconds while pending.",
      inputSchema: {
        type: "object",
        properties: {
          invocationId: { type: "string", description: "Id returned by orqis_invoke_agent." },
        },
        required: ["invocationId"],
      },
      async execute(args) {
        const id = String(args.invocationId ?? "");
        if (!id) return err("invocationId is required.");
        const r = await call(`/api/jobs/${encodeURIComponent(id)}`);
        if (!r.ok) return err(`Could not check job ${id}: ${r.message}`);
        return ok(r.data);
      },
    },

    {
      name: "orqis_get_balance",
      description:
        "Return the signed-in user's credit balance. Check this before invoking an expensive agent to confirm there is headroom.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const r = await call("/api/auth/me");
        if (!r.ok) return err(`Could not read balance: ${r.message}`);
        const user = (r.data as { user?: { creditBalance?: number; email?: string } | null }).user;
        if (!user) return ok({ signedIn: false, creditBalance: 0 });
        return ok({ signedIn: true, email: user.email, creditBalance: user.creditBalance });
      },
    },
  ];
}
