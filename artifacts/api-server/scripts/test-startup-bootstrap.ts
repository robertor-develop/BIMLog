import assert from "node:assert/strict";
import type { Server } from "node:http";
import { performance } from "node:perf_hooks";
import {
  createApplicationBootstrap,
  type StartupState,
} from "../src/startup-bootstrap";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function listen(server: Server): Promise<{ url: string; elapsedMs: number }> {
  const startedAt = performance.now();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    elapsedMs: performance.now() - startedAt,
  };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function response(url: string): Promise<{ status: number; body: unknown }> {
  const result = await fetch(`${url}/api/v1/healthz`);
  return { status: result.status, body: await result.json() };
}

const delayedImport = deferred<{
  default: (_request: unknown, response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  }) => void;
}>();
const delayedLogs: string[] = [];
const delayed = createApplicationBootstrap(
  () => delayedImport.promise,
  {
    info: (message) => delayedLogs.push(message),
    error: (message) => delayedLogs.push(message),
  },
);
const delayedListener = await listen(delayed.server);
assert(
  delayedListener.elapsedMs < 1_000,
  `listener took ${delayedListener.elapsedMs.toFixed(1)}ms to bind`,
);
const delayedInitialization = delayed.initialize();
assert.deepEqual(await response(delayedListener.url), {
  status: 503,
  body: { status: "starting" },
});
delayedImport.resolve({
  default: (_request, result) => {
    result.statusCode = 200;
    result.setHeader("Content-Type", "application/json");
    result.end(JSON.stringify({ status: "ok" }));
  },
});
await delayedInitialization;
assert.equal(delayed.getState(), "ready" satisfies StartupState);
assert.deepEqual(await response(delayedListener.url), {
  status: 200,
  body: { status: "ok" },
});
assert(delayedLogs.some((line) => line.includes("readiness enabled")));
await close(delayed.server);

const failedLogs: Array<{ message: string; error?: unknown }> = [];
const failed = createApplicationBootstrap(
  async () => {
    throw new Error("synthetic import failure");
  },
  {
    info: (message) => failedLogs.push({ message }),
    error: (message, error) => failedLogs.push({ message, error }),
  },
);
const failedListener = await listen(failed.server);
await failed.initialize();
assert.equal(failed.getState(), "failed" satisfies StartupState);
assert.deepEqual(await response(failedListener.url), {
  status: 503,
  body: { status: "failed" },
});
assert.equal(failedLogs.length, 1);
assert(failedLogs[0]?.message.includes("readiness disabled"));
assert(failedLogs[0]?.error instanceof Error);
await close(failed.server);

console.log(
  JSON.stringify({
    listenerBoundWithinMs: Number(delayedListener.elapsedMs.toFixed(1)),
    delayedImportStayedNotReady: true,
    readyAfterImport: true,
    failedImportStayedNotReady: true,
    failedImportLogged: true,
  }),
);
