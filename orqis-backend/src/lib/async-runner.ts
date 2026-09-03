/**
 * Tiny in-process async-job runner. Sprint 8 placeholder for the real
 * BullMQ + Upstash Redis worker that lands later (when we set
 * JOB_WORKER_MODE=bullmq).
 *
 * Contract:
 *   - runLater(work) schedules `work` to fire after a small delay so the
 *     caller can return a 202 Accepted to the orqis invocation proxy first.
 *   - The work itself is responsible for POSTing the webhook result. Helpers
 *     `webhookSuccess` / `webhookFailure` package that call.
 *
 * Caveats:
 *   - No persistence: a process restart drops in-flight jobs. Real BullMQ
 *     swap will fix this without changing the public API.
 *   - No retry: webhooks that fail to deliver are logged and dropped. Good
 *     enough for in-house agents in dev; production needs at-least-once.
 */

const DEFAULT_DELAY_MS = 50;

export function runLater(
  work: () => Promise<void>,
  delayMs = DEFAULT_DELAY_MS
): void {
  setTimeout(() => {
    void work().catch((err) => {
      // The worker swallowing errors is intentional — the user-visible signal
      // for failure is a webhook with ok:false. We log so operators can debug.
      // eslint-disable-next-line no-console
      console.error("[async-runner] background work threw:", err);
    });
  }, delayMs).unref?.();
}

export type WebhookContext = {
  webhookUrl: string;
  webhookSecret: string;
};

export function webhookContextFromHeaders(
  headers: Record<string, string | undefined>
): WebhookContext | null {
  const url = headers["x-orqis-webhook-url"];
  const secret = headers["x-orqis-webhook-secret"];
  if (typeof url === "string" && url && typeof secret === "string" && secret) {
    return { webhookUrl: url, webhookSecret: secret };
  }
  return null;
}

async function postWebhook(
  ctx: WebhookContext,
  body: Record<string, unknown>,
  attempt = 1
): Promise<void> {
  try {
    const res = await fetch(ctx.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Orqis-Webhook-Secret": ctx.webhookSecret,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && attempt < 3) {
      // Best-effort retry with exponential backoff. Swap for BullMQ retries later.
      const wait = 500 * Math.pow(2, attempt - 1);
      setTimeout(() => void postWebhook(ctx, body, attempt + 1), wait).unref?.();
    }
  } catch (err) {
    if (attempt < 3) {
      const wait = 500 * Math.pow(2, attempt - 1);
      setTimeout(() => void postWebhook(ctx, body, attempt + 1), wait).unref?.();
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[async-runner] webhook delivery failed after retries:", err);
  }
}

export async function webhookSuccess(
  ctx: WebhookContext,
  result: unknown,
  durationMs: number
): Promise<void> {
  await postWebhook(ctx, { ok: true, result, durationMs });
}

export async function webhookFailure(
  ctx: WebhookContext,
  errorCode: string,
  errorMessage: string,
  durationMs: number
): Promise<void> {
  await postWebhook(ctx, { ok: false, errorCode, errorMessage, durationMs });
}
