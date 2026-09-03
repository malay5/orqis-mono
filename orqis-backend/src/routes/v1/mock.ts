import type { FastifyPluginAsync } from "fastify";

/**
 * Mock seller endpoints — for end-to-end testing of the orqis invocation
 * proxy without standing up a real third-party service. Routes here are
 * intentionally generic and unauthenticated. Don't expose this in production.
 */
export const mockRoutes: FastifyPluginAsync = async (app) => {
  app.post("/_mock/echo", async (req, reply) => {
    return reply.send({
      echoed: req.body ?? null,
      receivedAt: new Date().toISOString(),
      orqisInvocationId: req.headers["x-orqis-invocation-id"] ?? null,
    });
  });

  // Useful for testing the failure path: returns 500 with a JSON body so the
  // orqis proxy refunds + records the failure.
  app.post("/_mock/fail", async (_req, reply) => {
    return reply.code(500).send({ error: "Mock seller intentional failure." });
  });

  // Useful for testing the timeout path. Sleeps just past the 30s proxy budget.
  app.post("/_mock/slow", async (_req, reply) => {
    await new Promise((r) => setTimeout(r, 35_000));
    return reply.send({ ok: true, slow: true });
  });
};
