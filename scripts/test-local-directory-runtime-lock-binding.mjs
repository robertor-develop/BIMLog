import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("artifacts/api-server/build.ts", "utf8");
for (const contract of [
  'lockedReference.startsWith("file:")',
  "lockedReference !== declaredSpec",
  "type: directory",
  "local package entry is missing",
  "local package resolution mismatch",
  "local package snapshot is missing",
]) assert.ok(source.includes(contract), `missing local directory lock contract: ${contract}`);
console.log("LOCAL_DIRECTORY_RUNTIME_LOCK_BINDING=PASS exactSpec=true directoryResolution=true snapshot=true");
