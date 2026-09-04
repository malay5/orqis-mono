import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output — required for a container build, and harmless
   * otherwise.
   *
   * Emits `.next/standalone/` containing a self-contained server plus only
   * the node_modules the traced import graph actually reaches: 31 MB rather
   * than the full dependency tree, which includes `@scalar/api-reference-react`
   * at 89 MB installed.
   *
   * No `outputFileTracingRoot`: tracing defaults to the nearest lockfile, and
   * this app has its own `package-lock.json`, so the default is already
   * correct. Pointing it at a parent directory only makes sense when several
   * apps share one lockfile — and it is actively wrong in the standalone
   * frontend repo, where there is no parent to point at.
   */
  output: "standalone",
};

export default nextConfig;
