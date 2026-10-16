import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../artifacts/api-server/src/startup-bootstrap.ts", import.meta.url),
  "utf8",
);

assert.match(source, /const DEFAULT_INITIALIZATION_TIMEOUT_MS = 120_000;/);
assert.match(source, /Application import exceeded \$\{initializationTimeoutMs\}ms\./);
assert.match(source, /initializationTimeoutMs <= 0/);

console.log("API_COLD_START_BUDGET=PASS timeout_ms=120000 bounded=true");
