import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /**
   * Standalone output (Sprint 21) — required for the single-container build.
   *
   * Emits `.next/standalone/` containing a self-contained server plus only
   * the node_modules actually reached by the traced import graph. Without it
   * the runtime image has to carry the full dependency tree, and
   * `@scalar/api-reference-react` alone is 89 MB installed.
   *
   * `outputFileTracingRoot` must point at the monorepo root: tracing starts
   * from the nearest lockfile by default, and in a monorepo that guess is
   * wrong often enough to silently drop files the server needs at runtime.
   */
  output: "standalone",
  
};

export default nextConfig;
