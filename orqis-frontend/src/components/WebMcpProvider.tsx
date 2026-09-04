"use client";

import { useEffect, useState } from "react";
import { buildTools, type WebMcpTool } from "@/lib/webmcp-tools";

/**
 * WebMCP — exposes orqis's catalogue to an in-browser AI agent.
 *
 * WebMCP is the browser-side counterpart to the Model Context Protocol: a page
 * publishes tools on `navigator.modelContext`, and an agent running in the
 * browser (an extension, or the browser itself) can discover and call them. No
 * server, no subprocess — the page *is* the MCP server.
 *
 * This registers the same five tools `@orqis/mcp` exposes over stdio, so an
 * agent gets identical capabilities whichever way it reaches orqis.
 *
 * Why this fits orqis specifically: the whole pitch is "browsable by humans,
 * callable by agents". Until now the agent path required minting an API key
 * and running a subprocess. With WebMCP an agent that lands on the site can
 * search and invoke immediately, as the signed-in user, with that user's
 * credits and rate limits — no key ever handed to page scripts.
 *
 * The spec is a draft and the surface has changed during its life, so this
 * feature-detects rather than assuming: `registerTool` (incremental) is used
 * when present, `provideContext` (whole-set) otherwise. When neither exists
 * the component renders nothing and the page behaves normally — every browser
 * without WebMCP support today.
 */

/** Minimal shape of the parts of the draft API we use. */
type ModelContextLike = {
  registerTool?: (tool: unknown) => void | (() => void);
  provideContext?: (context: { tools: unknown[] }) => void;
  unregisterTool?: (name: string) => void;
};

function getModelContext(): ModelContextLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { modelContext?: ModelContextLike };
  return nav.modelContext ?? null;
}

/**
 * Shape a tool for the draft API.
 *
 * The spec expects `execute` to resolve to `{ content: [...] }`, the same
 * envelope MCP uses over stdio — which is why `webmcp-tools.ts` already
 * returns that shape and this only has to rename the schema field.
 */
function toSpecTool(tool: WebMcpTool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: async (args: Record<string, unknown>) => tool.execute(args ?? {}),
  };
}

export function WebMcpProvider() {
  const [registered, setRegistered] = useState(0);

  useEffect(() => {
    const mc = getModelContext();
    if (!mc) return;

    const tools = buildTools();
    const cleanups: Array<() => void> = [];

    try {
      if (typeof mc.registerTool === "function") {
        for (const tool of tools) {
          const undo = mc.registerTool(toSpecTool(tool));
          // Some drafts return an unregister function; others expose
          // unregisterTool(name). Support both, prefer what we're handed.
          if (typeof undo === "function") {
            cleanups.push(undo);
          } else if (typeof mc.unregisterTool === "function") {
            cleanups.push(() => mc.unregisterTool?.(tool.name));
          }
        }
      } else if (typeof mc.provideContext === "function") {
        mc.provideContext({ tools: tools.map(toSpecTool) });
        cleanups.push(() => mc.provideContext?.({ tools: [] }));
      } else {
        return; // navigator.modelContext exists but has neither entry point.
      }
      setRegistered(tools.length);
    } catch (err) {
      // A draft API that throws must not take the page down with it.
      console.warn("[webmcp] tool registration failed:", err);
      return;
    }

    return () => {
      for (const undo of cleanups) {
        try {
          undo();
        } catch {
          // Nothing useful to do if teardown fails.
        }
      }
    };
  }, []);

  // Nothing visual. The one exception is a marker attribute, which gives the
  // Playwright-style checks something to assert on and makes it obvious in
  // devtools whether registration actually happened.
  return (
    <div
      hidden
      data-webmcp-tools={registered}
      aria-hidden="true"
    />
  );
}
