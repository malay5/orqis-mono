#!/usr/bin/env node
// Thin shim that loads the built ESM entrypoint and starts the stdio server.
// Kept as plain JS so the bin works without compilation in `npx @orqis/mcp`
// after publish (the JS is shipped from dist/).

import { runStdio } from "../dist/index.js";

runStdio().catch((err) => {
  console.error("[orqis-mcp] failed to start:", err);
  process.exit(1);
});
