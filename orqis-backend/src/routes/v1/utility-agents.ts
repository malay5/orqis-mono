import type { FastifyPluginAsync } from "fastify";
import { runRngUniform } from "../../services/rng-uniform.js";
import { runSortBench, type SortAlgorithm } from "../../services/sort-bench.js";

const VALID_ALGORITHMS: SortAlgorithm[] = [
  "bubble",
  "insertion",
  "selection",
  "merge",
  "quick",
  "heap",
  "native",
];

/**
 * Two non-AI utility agents that share this file because they're tiny and
 * thematically related (both deal with arrays of numbers, both are zero-cost
 * in-process work). Same prefix as the AI agents — discoverability via
 * GET /v1/agents/:slug.
 */
export const utilityAgentRoutes: FastifyPluginAsync = async (app) => {
  // ---------- rng-uniform ----------
  app.get("/agents/rng-uniform", async () => ({
    name: "rng-uniform",
    kind: "utility",
    isAsync: false,
    version: "0.10.0",
    doc: "POST /v1/agents/rng-uniform/run with { count, min?, max?, integer?, seed? }.",
  }));

  app.post("/agents/rng-uniform/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const count = Number(body.count);
    if (!Number.isFinite(count) || count < 0) {
      return reply.code(400).send({ error: "count must be a non-negative number" });
    }
    try {
      const result = runRngUniform({
        count,
        min: typeof body.min === "number" ? body.min : undefined,
        max: typeof body.max === "number" ? body.max : undefined,
        integer: body.integer === true,
        seed: typeof body.seed === "number" ? body.seed : undefined,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : "rng-uniform failed",
      });
    }
  });

  // ---------- sort-bench ----------
  app.get("/agents/sort-bench", async () => ({
    name: "sort-bench",
    kind: "utility",
    isAsync: false,
    version: "0.10.0",
    doc: "POST /v1/agents/sort-bench/run with { numbers, algorithm?, reverse? }. Algorithms: bubble, insertion, selection, merge, quick, heap, native.",
  }));

  app.post("/agents/sort-bench/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(body.numbers)) {
      return reply.code(400).send({ error: "numbers must be an array" });
    }
    const algorithm = body.algorithm as SortAlgorithm | undefined;
    if (algorithm !== undefined && !VALID_ALGORITHMS.includes(algorithm)) {
      return reply.code(400).send({
        error: `algorithm must be one of: ${VALID_ALGORITHMS.join(", ")}`,
      });
    }
    try {
      const result = runSortBench({
        numbers: body.numbers as number[],
        algorithm,
        reverse: body.reverse === true,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : "sort-bench failed",
      });
    }
  });
};
