import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../build.ts", import.meta.url), "utf8");

assert.match(source, /async function removeRetiredRuntimeClosures/);
assert.match(source, /entry\.name\.startsWith\("runtime-retired-"\)/);
assert.match(source, /await removeGeneratedDirectory\(path\.join\(distDir, entry\.name\)\)/);
assert.match(source, /await removeRetiredRuntimeClosures\(distDir\)/);

const deploymentIndex = source.lastIndexOf("await deployRuntimeClosure(runtimeDir");
const cleanupIndex = source.lastIndexOf("await removeRetiredRuntimeClosures(distDir)");
assert.ok(cleanupIndex > deploymentIndex, "retired closures must be removed only after the replacement runtime is complete");

console.log("RUNTIME_CLOSURE_RETIREMENT=PASS post_success_cleanup=1 active_runtime_preserved=1");
