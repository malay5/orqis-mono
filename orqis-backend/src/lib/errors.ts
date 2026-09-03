/**
 * Sprint 18 (F5 fix): structured-error class services throw for input /
 * validation problems. Route plugins catch via `instanceof ValidationError`
 * and surface a 400. Anything else that bubbles out of a service is treated
 * as an upstream failure (502).
 *
 * Previously each route plugin maintained its own regex of "validation
 * verbs" (`/required|invalid|too long|.../`). Adding a new validation
 * message that didn't happen to hit one of those tokens got mis-mapped to
 * 502 (looks like an upstream failure to the caller, masks the real cause).
 * Tester found at least one such case in round 2.
 *
 * Migration policy: new code should `throw new ValidationError(msg)` for
 * any thrown error that represents bad input. The route layer still keeps
 * the legacy regex as a fallback so services that haven't been migrated
 * keep working — but the structured path is preferred and tested.
 */

export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Helper for route plugins: maps an unknown thrown value to (statusCode, message).
 *
 *   1. `instanceof ValidationError` → its statusCode (400 by default).
 *   2. Otherwise, if `legacyPattern` is provided and the message matches → 400.
 *      This is the transitional fallback for services that haven't been
 *      migrated to throw ValidationError yet.
 *   3. Otherwise → `fallback` (502).
 *
 * Passing the same regex existing plugins used as `legacyPattern` keeps
 * behavior backward-compatible while letting new code rely on the typed path.
 */
export function statusForThrown(
  err: unknown,
  fallback = 502,
  legacyPattern?: RegExp,
  defaultMessage = "service failed"
): { code: number; message: string } {
  if (err instanceof ValidationError) {
    return { code: err.statusCode, message: err.message };
  }
  const message = err instanceof Error ? err.message : defaultMessage;
  if (legacyPattern && legacyPattern.test(message)) {
    return { code: 400, message };
  }
  return { code: fallback, message };
}
