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

async function listen(
  server: Server,
): Promise<{ url: string; elapsedMs: number }> {
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
const delayed = createApplicationBootstrap(() => delayedImport.promise, {
  initializationTimeoutMs: 1_000,
  logger: {
    info: (message) => delayedLogs.push({ message }),
    error: (message, error) => delayedLogs.push({ message, error }),
  },
});
const delayedListener = await listen(delayed.server);
const delayedInitialization = delayed.initialize();
assert(
  delayedListener.elapsedMs < 1_000,
  `listener took ${delayedListener.elapsedMs.toFixed(1)}ms to bind`,
);
assert.deepEqual(await response(delayedListener.url, "/api"), {
  status: 200,
  body: JSON.stringify({
    status: "starting",
    service: "bimlog-api",
    ready: false,
  }),
});
assert.deepEqual(await response(delayedListener.url, "/api/v1/healthz"), {
  status: 503,
  body: JSON.stringify({ status: "starting", service: "bimlog-api", ready: false }),
});
assert.deepEqual(await response(delayedListener.url, "/other"), {
  status: 503,
  body: JSON.stringify({ status: "starting", service: "bimlog-api", ready: false }),
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

const providerSecret = "provider-secret-must-not-appear";
const failedLogs: Array<{ message: string }> = [];
const failed = createApplicationBootstrap(
  async () => ({
    default: application,
    startupBarrier: Promise.reject(
      new Error(`FEEDBACK_STORAGE_AUTHORITY_INVALID ${providerSecret}`),
    ),
  }),
  {
    initializationTimeoutMs: 1_000,
    logger: {
      info: (message) => failedLogs.push({ message }),
      error: (message) => failedLogs.push({ message }),
    },
  },
);
await assert.rejects(failed.initialize(), /FEEDBACK_STORAGE_AUTHORITY_INVALID/);
assert.equal(failed.getState(), "failed" satisfies StartupState);
assert.equal(failed.server.listening, false);
assert.equal(failed.server.address(), null);
const failureLog = failedLogs.find((entry) =>
  entry.message.includes("phase=app_import_failure"),
);
assert.match(failureLog?.message ?? "", /FEEDBACK_STORAGE_AUTHORITY_INVALID/);
assert.doesNotMatch(failureLog?.message ?? "", new RegExp(providerSecret));
assert.equal(
  failedLogs.filter((entry) =>
    entry.message.includes("phase=app_import_failure"),
  ).length,
  1,
);

const timedOut = createApplicationBootstrap(
  () => new Promise<{ default: RequestListener }>(() => undefined),
  { initializationTimeoutMs: 25 },
);
const timedOutListener = await listen(timedOut.server);
await assert.rejects(timedOut.initialize(), /exceeded 25ms/);
assert.equal(timedOut.getState(), "failed" satisfies StartupState);
assert.deepEqual(await response(timedOutListener.url, "/api"), {
  status: 503,
  body: JSON.stringify({ status: "failed" }),
});
await close(timedOut.server);

const barrier = deferred<void>();
let workerStarts = 0;
const barrierBootstrap = createApplicationBootstrap(async () => ({
  default: application,
  startupBarrier: barrier.promise,
  startWorkers: () => {
    workerStarts += 1;
  },
}));
const barrierInitialization = barrierBootstrap.initialize();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(barrierBootstrap.server.listening, false);
assert.equal(barrierBootstrap.getState(), "starting");
barrier.resolve();
await barrierInitialization;
assert.equal(barrierBootstrap.getState(), "ready");
assert.equal(workerStarts, 0);
barrierBootstrap.startWorkers();
barrierBootstrap.startWorkers();
assert.equal(workerStarts, 1);

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
    apiLivenessSucceededDuringInitialization: true,
    readinessStayed503UntilReady: true,
    apiAndHealthzSucceededAfterReady: true,
    readyAfterImport: true,
    invalidStorageCanStillFailBeforeListenAndTimedOutImportsLoseLiveness: true,
    providerSecretsSanitizedFromStartupFailure: true,
    startupBarrierPrecedesReadyAndWorkers: true,
    doubleWorkerStartSuppressed: true,
    phaseTelemetryComplete: true,
    delayedFfmpegDiscoveryBoundedAndCached: true,
  }),
);
