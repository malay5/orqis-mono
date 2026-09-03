/**
 * @orqis/sdk — minimal JS/TS client for orqis.
 *
 *   import { Orqis } from "@orqis/sdk";
 *   const orqis = new Orqis({ apiKey: process.env.ORQIS_API_KEY! });
 *
 *   const { agents } = await orqis.search("product demo video");
 *   const agent = await orqis.get(agents[0].slug);
 *   const result = await orqis.invoke(agent.slug, { product: "https://linear.app" });
 *
 * If `result.status === "pending"`, poll `orqis.checkJob(result.invocationId)`
 * until `status === "succeeded"` or `"refunded"`/"failed"`.
 */

export interface OrqisOptions {
  /** API key minted at https://orqis.xyz/dashboard/api-keys (`or_live_…`). */
  apiKey: string;
  /** Override the API base URL. Defaults to https://orqis.xyz. */
  baseUrl?: string;
  /** Custom fetch implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Optional User-Agent suffix. */
  userAgent?: string;
}

export type AgentSummary = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  tags: string[];
  pricePerCall: number;
  isAsync: boolean;
  ratingAverage: number;
  ratingCount: number;
  invocationCount: number;
};

export type AgentDetail = AgentSummary & {
  description: string;
  longDescription: string;
  iconEmoji: string;
  accentHex: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  exampleRequest: Record<string, unknown> | null;
  exampleResponse: Record<string, unknown> | null;
};

export type InvokeSyncResult<T = unknown> = {
  ok: true;
  status: "succeeded";
  invocationId: string;
  latencyMs: number;
  creditsCharged: number;
  newBalance: number;
  result: T;
  schemaWarning: string | null;
};

export type InvokeAsyncResult = {
  ok: true;
  status: "pending";
  invocationId: string;
  creditsCharged: number;
  message: string;
};

export type InvokeResult<T = unknown> = InvokeSyncResult<T> | InvokeAsyncResult;

export type JobStatus<T = unknown> = {
  invocationId: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  isAsync: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  creditsCharged: number;
  errorCode: string;
  errorMessage: string;
  result: T | null;
  createdAt: string;
  completedAt: string | null;
};

export type Me = {
  callerType: "session" | "api_key";
  apiKeyId: string | null;
  scopes: string[] | null;
  user: {
    id: string;
    email: string;
    name: string;
    role: "buyer" | "seller" | "admin";
    creditBalance: number;
  };
};

/**
 * Thrown for non-2xx responses. The `body` field holds whatever the server
 * returned (typically `{ error: string }`).
 */
export class OrqisApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "OrqisApiError";
  }
}

const DEFAULT_BASE_URL = "https://orqis.xyz";

export class Orqis {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OrqisOptions) {
    if (!opts.apiKey) {
      throw new Error("Orqis: apiKey is required");
    }
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = {
      Authorization: `Bearer ${opts.apiKey}`,
      "User-Agent": opts.userAgent
        ? `orqis-sdk-js/0.1.0 (${opts.userAgent})`
        : "orqis-sdk-js/0.1.0",
    };
  }

  // -------------- agents --------------

  /** Search the public agent catalogue. */
  async search(
    query?: string,
    opts: { category?: string } = {}
  ): Promise<{ count: number; agents: AgentSummary[] }> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (opts.category) params.set("category", opts.category);
    const qs = params.toString();
    return this.request("GET", `/api/v1/agents${qs ? `?${qs}` : ""}`);
  }

  /** Full agent detail by slug. */
  async get(slug: string): Promise<AgentDetail> {
    return this.request("GET", `/api/v1/agents/${encodeURIComponent(slug)}`);
  }

  /**
   * Invoke an agent. Returns either a completed sync result (with `status: "succeeded"`)
   * or a pending async receipt (with `status: "pending"` + an `invocationId` to poll).
   *
   * Type the result to your agent's outputSchema for strong typing:
   *
   *   const r = await orqis.invoke<{ previewUrl: string }>("landing-forge", { ... });
   *   if (r.status === "succeeded") console.log(r.result.previewUrl);
   */
  async invoke<TResult = unknown>(
    slug: string,
    body: Record<string, unknown>
  ): Promise<InvokeResult<TResult>> {
    return this.request(
      "POST",
      `/api/v1/agents/${encodeURIComponent(slug)}/invoke`,
      body
    );
  }

  // -------------- jobs --------------

  /** Poll an async invocation by id. */
  async checkJob<TResult = unknown>(invocationId: string): Promise<JobStatus<TResult>> {
    return this.request("GET", `/api/v1/jobs/${encodeURIComponent(invocationId)}`);
  }

  /**
   * Convenience: invoke an async agent and wait for completion. Polls every
   * `pollMs` (default 2000) until the job is terminal or `timeoutMs` (default
   * 5 min) elapses.
   */
  async invokeAndWait<TResult = unknown>(
    slug: string,
    body: Record<string, unknown>,
    opts: { pollMs?: number; timeoutMs?: number } = {}
  ): Promise<JobStatus<TResult>> {
    const pollMs = opts.pollMs ?? 2000;
    const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
    const r = await this.invoke<TResult>(slug, body);
    // Sync agents return immediately; build a JobStatus-ish view.
    if (r.status === "succeeded") {
      return {
        invocationId: r.invocationId,
        status: "succeeded",
        isAsync: false,
        httpStatus: 200,
        latencyMs: r.latencyMs,
        creditsCharged: r.creditsCharged,
        errorCode: "",
        errorMessage: "",
        result: r.result,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, pollMs));
      const job = await this.checkJob<TResult>(r.invocationId);
      if (job.status !== "pending") return job;
    }
    throw new OrqisApiError(
      408,
      { invocationId: r.invocationId },
      `Timed out waiting for ${slug} (${timeoutMs}ms). Use orqis.checkJob() to keep polling.`
    );
  }

  // -------------- caller --------------

  /** Smoke-test: confirms the API key is valid and returns the caller's balance. */
  async me(): Promise<Me> {
    return this.request("GET", "/api/v1/me");
  }

  // -------------- internals --------------

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        ...this.headers,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `Request failed (${res.status})`;
      throw new OrqisApiError(res.status, parsed, message);
    }
    return parsed as T;
  }
}
