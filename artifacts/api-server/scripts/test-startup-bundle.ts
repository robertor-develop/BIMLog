import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { performance } from "node:perf_hooks";

const bundle = path.resolve("dist/index.cjs");
assert(fs.existsSync(bundle), "Build the production bundle before this proof.");
const bundleText = fs.readFileSync(bundle, "utf8");
assert.doesNotMatch(bundleText, /which ffmpeg/);
assert.match(bundleText, /phase=bootstrap_bound/);
assert.match(bundleText, /phase=app_import_begin/);
assert.match(bundleText, /phase=app_import_complete/);
assert.match(bundleText, /phase=ready_transition/);

const port = 18_084;
const startedAt = performance.now();
const child = spawn(process.execPath, [bundle], {
  cwd: path.resolve("../.."),
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "production",
    REPLIT_DEPLOYMENT: "1",
    DATABASE_URL:
      "postgresql://synthetic:synthetic@127.0.0.1:55999/bimlog",
    PROD_DATABASE_URL:
      "postgresql://synthetic:synthetic@127.0.0.1:55999/bimlog",
    JWT_SECRET: "synthetic-local-startup-proof-only-0000000000000000",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += String(chunk);
});
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

async function waitForPort(): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return performance.now() - startedAt;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Production bundle did not bind within 2.5 seconds.");
}

async function waitForReady(): Promise<number> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await fetch(
      `http://127.0.0.1:${port}/api/v1/healthz`,
    ).catch(() => null);
    if (result?.status === 200) return performance.now() - startedAt;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Production bundle did not become ready within 5 seconds. ${stderr}`,
  );
}

try {
  const portBoundMs = await waitForPort();
  const readyMs = await waitForReady();
  assert(portBoundMs < 2_500);
  assert(readyMs < 5_000);
  assert.match(stdout, /phase=bootstrap_bound/);
  assert.match(stdout, /phase=app_import_begin/);
  assert.match(stdout, /phase=app_import_complete/);
  assert.match(stdout, /phase=ready_transition/);
  console.log(
    JSON.stringify({
      actualProductionBundle: true,
      portBoundMs: Number(portBoundMs.toFixed(1)),
      readyMs: Number(readyMs.toFixed(1)),
      noTopLevelFfmpegDiscovery: true,
      phaseTelemetryComplete: true,
    }),
  );
} finally {
  child.kill();
}
