import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = file => readFileSync(file, "utf8");
const runBehavior = file => {
  const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
};

for (const file of [
  "artifacts/api-server/src/lib/generic-apu.behavior.ts",
  "artifacts/api-server/src/lib/financial-apu-allocation.behavior.ts",
  "artifacts/api-server/src/lib/apu-budget-authority-http.behavior.ts",
]) runBehavior(file);

const routes = read("artifacts/api-server/src/routes/financial-apu.ts");
assert.match(routes, /router\.use\("\/projects\/:projectId\/financial\/apu", authMiddleware\)/);
for (const endpoint of ["library-applications", "performance", "performance.csv", "forecast", "forecast.csv"]) {
  assert.ok(routes.includes(endpoint), `APU lifecycle route missing ${endpoint}`);
}
const ui = read("artifacts/bimlog/src/pages/FinancialApuWorkspace.tsx");
for (const token of ["loadLibrary", "applyLibraryVersion", "const save = async", "savePerformance", "exportPerformance"]) {
  assert.ok(ui.includes(token), `APU workspace missing ${token}`);
}
console.log("GA-F04-B026 governed APU lifecycle, authority, persistence and export: PASS");
