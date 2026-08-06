import assert from "node:assert/strict";
import type { RequestListener, Server } from "node:http";
import { performance } from "node:perf_hooks";
import {
  createApplicationBootstrap,
  type StartupState,
} from "../src/startup-bootstrap";
import { createFfmpegPathResolver } from "../src/lib/ffmpeg-capability";

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

async function response(
  url: string,
  path: string,
): Promise<{ status: number; body: string }> {
  const result = await fetch(`${url}${path}`);
  return { status: result.status, body: await result.text() };
}

const application: RequestListener = (request, result) => {
  if (request.url === "/api") {
    result.statusCode = 200;
    result.setHeader("Content-Type", "application/json");
    result.end(JSON.stringify({ status: "ok", service: "bimlog-api" }));
    return;
  }
  if (request.url === "/api/v1/healthz") {
    result.statusCode = 200;
    result.setHeader("Content-Type", "application/json");
    result.end(JSON.stringify({ status: "ok" }));
    return;
  }
  result.statusCode = 404;
  result.end(`Cannot GET ${request.url}\n`);
};

const delayedImport = deferred<{ default: RequestListener }>();
const delayedLogs: Array<{ message: string; error?: unknown }> = [];
const delayed = createApplicationBootstrap(
  () => delayedImport.promise,
  {
    initializationTimeoutMs: 1_000,
    logger: {
      info: (message) => delayedLogs.push({ message }),
      error: (message, error) => delayedLogs.push({ message, error }),
    },
  },
);
const delayedListener = await listen(delayed.server);
assert(
  delayedListener.elapsedMs < 1_000,
  `listener took ${delayedListener.elapsedMs.toFixed(1)}ms to bind`,
);
const delayedInitialization = delayed.initialize();
assert.deepEqual(await response(delayedListener.url, "/api"), {
  status: 404,
  body: "Cannot GET /api\n",
});
assert.deepEqual(await response(delayedListener.url, "/api/v1/healthz"), {
  status: 503,
  body: JSON.stringify({ status: "starting" }),
});
assert.deepEqual(await response(delayedListener.url, "/other"), {
  status: 503,
  body: JSON.stringify({ status: "starting" }),
});
delayedImport.resolve({ default: application });
await delayedInitialization;
assert.equal(delayed.getState(), "ready" satisfies StartupState);
assert.deepEqual(await response(delayedListener.url, "/api/v1/healthz"), {
  status: 200,
  body: JSON.stringify({ status: "ok" }),
});
assert.deepEqual(await response(delayedListener.url, "/api"), {
  status: 200,
  body: JSON.stringify({ status: "ok", service: "bimlog-api" }),
});
assert(
  delayedLogs.some((entry) => entry.message.includes("phase=app_import_begin")),
);
assert(
  delayedLogs.some((entry) =>
    entry.message.includes("phase=app_import_complete"),
  ),
);
assert(
  delayedLogs.some((entry) => entry.message.includes("phase=ready_transition")),
);
await close(delayed.server);

const failedLogs: Array<{ message: string; error?: unknown }> = [];
const failed = createApplicationBootstrap(
  async () => {
    throw new Error("synthetic import failure");
  },
  {
    initializationTimeoutMs: 1_000,
    logger: {
      info: (message) => failedLogs.push({ message }),
      error: (message, error) => failedLogs.push({ message, error }),
    },
  },
);
const failedListener = await listen(failed.server);
await failed.initialize();
assert.equal(failed.getState(), "failed" satisfies StartupState);
assert.deepEqual(await response(failedListener.url, "/api"), {
  status: 503,
  body: JSON.stringify({ status: "failed" }),
});
assert.deepEqual(await response(failedListener.url, "/api/v1/healthz"), {
  status: 503,
  body: JSON.stringify({ status: "failed" }),
});
const failureLog = failedLogs.find((entry) =>
  entry.message.includes("phase=app_import_failure"),
);
assert(failureLog?.error instanceof Error);
await close(failed.server);

const timedOut = createApplicationBootstrap(
  () => new Promise<{ default: RequestListener }>(() => undefined),
  { initializationTimeoutMs: 25 },
);
const timedOutListener = await listen(timedOut.server);
await timedOut.initialize();
assert.equal(timedOut.getState(), "failed" satisfies StartupState);
assert.equal(
  (await response(timedOutListener.url, "/api")).status,
  503,
);
await close(timedOut.server);

let discoveryCalls = 0;
const resolveDelayedFfmpeg = createFfmpegPathResolver({
  timeoutMs: 25,
  discover: async () => {
    discoveryCalls += 1;
    return await new Promise<string | null>(() => undefined);
  },
});
const discoveryStartedAt = performance.now();
assert.equal(await resolveDelayedFfmpeg(), "ffmpeg");
assert(performance.now() - discoveryStartedAt < 500);
assert.equal(await resolveDelayedFfmpeg(), "ffmpeg");
assert.equal(discoveryCalls, 1);

console.log(
  JSON.stringify({
    listenerBoundWithinMs: Number(delayedListener.elapsedMs.toFixed(1)),
    apiProbeStayedNonSuccessUntilReady: true,
    healthzProbeStayedNonSuccessUntilReady: true,
    apiAndHealthzSucceededAfterReady: true,
    readyAfterImport: true,
    failedAndTimedOutImportsStayedNonReady: true,
    phaseTelemetryComplete: true,
    delayedFfmpegDiscoveryBoundedAndCached: true,
  }),
);
