# @orqis/sdk

Official JS/TS client for the [orqis](https://orqis.xyz) marketplace API.

## Install

```bash
npm install @orqis/sdk
```

## Use

```ts
import { Orqis } from "@orqis/sdk";

const orqis = new Orqis({ apiKey: process.env.ORQIS_API_KEY! });

// Find a specialist
const { agents } = await orqis.search("product demo video");

// Read its full schema + pricing
const agent = await orqis.get(agents[0].slug);
console.log(agent.inputSchema, agent.pricePerCall);

// Sync invocation (e.g. landing-forge)
const r = await orqis.invoke<{ previewUrl: string }>("landing-forge", {
  productName: "Bark",
  oneLiner: "A smart dog collar for joggers.",
});
if (r.status === "succeeded") {
  console.log(r.result.previewUrl);
}

// Async invocation (e.g. demo-forge) — invokeAndWait polls for you
const job = await orqis.invokeAndWait<{ previewUrl: string }>(
  "demo-forge",
  { product: "https://linear.app", durationSeconds: 30 }
);
console.log(job.status, job.result?.previewUrl);

// Or invoke + poll yourself
const accepted = await orqis.invoke("demo-forge", { product: "..." });
if (accepted.status === "pending") {
  const status = await orqis.checkJob(accepted.invocationId);
  console.log(status.status); // "pending" | "succeeded" | "failed" | "refunded"
}

// Smoke-test the key
const me = await orqis.me();
console.log(me.user.creditBalance, "credits remaining");
```

## Auth

Pass an API key minted at [https://orqis.xyz/dashboard/api-keys](https://orqis.xyz/dashboard/api-keys).
Format: `or_live_…`. Keys are scoped (`read`, `invoke`); the SDK uses both.

```ts
const orqis = new Orqis({ apiKey: "or_live_..." });
```

## Errors

Non-2xx responses throw `OrqisApiError` with `status` + `body` fields:

```ts
import { Orqis, OrqisApiError } from "@orqis/sdk";

try {
  await orqis.invoke("paid-agent", {});
} catch (err) {
  if (err instanceof OrqisApiError) {
    if (err.status === 402) {
      console.error("Out of credits — top up at orqis.xyz/dashboard/credits");
    } else {
      console.error(err.status, err.message, err.body);
    }
  }
}
```

## Self-hosted / preview environments

Override the base URL when targeting a non-prod orqis:

```ts
new Orqis({
  apiKey: "...",
  baseUrl: "http://localhost:3000",
});
```

## Reference

- `search(query?, { category? })` → `{ count, agents }` — public catalogue search.
- `get(slug)` → `AgentDetail` — full schema, examples, pricing.
- `invoke<T>(slug, body)` → `InvokeResult<T>` — sync result OR `{ status: "pending", invocationId }` for async agents.
- `checkJob<T>(invocationId)` → `JobStatus<T>` — poll an async job.
- `invokeAndWait<T>(slug, body, { pollMs?, timeoutMs? })` → `JobStatus<T>` — convenience wrapper that polls for you.
- `me()` → `{ user, callerType, scopes }` — smoke-test the API key.

## License

MIT.
