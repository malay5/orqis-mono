/**
 * Container entrypoint — supervises the two orqis processes.
 *
 * Deliberately not a shell script with `&`: a backgrounded child in shell
 * doesn't get SIGTERM on container stop, so the platform waits out its grace
 * period and then SIGKILLs. Node as PID 1 lets us forward signals properly
 * and, importantly, exit when *either* child dies so the host restarts the
 * container instead of serving a half-dead one.
 *
 * Start order matters: the backend comes up first so the frontend's first
 * server-render has an API to talk to. We wait for its health check rather
 * than sleeping a fixed number of seconds.
 */

import { spawn } from "node:child_process";
import process from "node:process";

const BACKEND_PORT = process.env.ORQIS_BACKEND_PORT ?? "4000";
const BACKEND_HOST = process.env.ORQIS_BACKEND_HOST ?? "127.0.0.1";
const FRONTEND_PORT = process.env.PORT ?? "3000";

// Entry points default to the in-container layout. Overridable so this
// supervisor can be exercised against a local build without Docker.
const BACKEND_ENTRY = process.env.ORQIS_BACKEND_ENTRY ?? "orqis-backend/dist/server.js";
const FRONTEND_ENTRY = process.env.ORQIS_FRONTEND_ENTRY ?? "orqis-frontend/server.js";

/** Children we've started, so a signal or a death can tear the rest down. */
const children = [];
let shuttingDown = false;

function log(name, message) {
  console.log(`[start:${name}] ${message}`);
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    // One process dying means the container is broken. Take the whole thing
    // down so the platform's restart policy applies — a container serving
    // pages with no API behind them looks up but isn't.
    log(name, `exited (code=${code} signal=${signal}) — shutting down`);
    shutdown(code ?? 1);
  });

  child.on("error", (err) => {
    log(name, `failed to start: ${err.message}`);
    shutdown(1);
  });

  children.push({ name, child });
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
  // Give children a moment to close listeners, then leave.
  setTimeout(() => process.exit(code), 3000).unref();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    log("supervisor", `received ${signal}`);
    shutdown(0);
  });
}

/**
 * Poll the backend's health endpoint until it answers or we give up.
 *
 * 150s, not 60: the backend awaits its Mongo connection inside buildApp before
 * it starts listening, and a cold Atlas M0 cluster can exceed a minute on the
 * first connection after idling. A too-short window here kills a container
 * that would have come up fine.
 */
async function waitForBackend(timeoutMs = 150_000) {
  const url = `http://${BACKEND_HOST}:${BACKEND_PORT}/health`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (shuttingDown) return false;
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  log("supervisor", `backend → ${BACKEND_HOST}:${BACKEND_PORT}, frontend → :${FRONTEND_PORT}`);

  start("backend", "node", [BACKEND_ENTRY], {
    PORT: BACKEND_PORT,
    HOST: BACKEND_HOST,
  });

  const ready = await waitForBackend();
  if (!ready) {
    // Usually a bad MONGODB_URI or a missing AUTH_SECRET — the backend
    // asserts both at boot and exits with a readable message above this line.
    log(
      "supervisor",
      "backend never became healthy. If nothing was logged above, it is still
" +
        "  inside the initial database connection — a cold Atlas cluster can take
" +
        "  over a minute on its first connection. Otherwise check MONGODB_URI and
" +
        "  AUTH_SECRET; the backend asserts both at boot."
    );
    shutdown(1);
    return;
  }
  log("supervisor", "backend healthy, starting frontend");

  start("frontend", "node", [FRONTEND_ENTRY], {
    PORT: FRONTEND_PORT,
    HOSTNAME: "0.0.0.0",
  });
}

main().catch((err) => {
  log("supervisor", `fatal: ${err.message}`);
  shutdown(1);
});
