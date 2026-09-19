import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "scripts", "prepare-artifact-proof-fixture.mjs");
const cyclesIndex = process.argv.indexOf("--cycles");
const cycleCount = cyclesIndex >= 0 ? Number(process.argv[cyclesIndex + 1]) : 2;
const recreateFirst = process.argv.includes("--recreate-first");
if (!Number.isInteger(cycleCount) || cycleCount < 1 || cycleCount > 2)
  throw new Error("--cycles must be 1 or 2");
if (!process.env.BIMLOG_ARTIFACT_PROOF_DATABASE_URL || !process.env.BIMLOG_ARTIFACT_PROOF_ROOT)
  throw new Error("Repeatability proof requires the isolated artifact fixture environment.");

const env = { ...process.env, BIMLOG_ALLOW_DISPOSABLE_FIXTURE_RECREATE: "YES" };
for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
  const prepareArgs = [fixture, "--prepare"];
  if (recreateFirst && cycle === 1) prepareArgs.push("--recreate");
  const prepared = execFileSync(process.execPath, prepareArgs, {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  const checked = execFileSync(process.execPath, [fixture, "--check"], {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (!prepared.includes("Artifact fixture ready") || !checked.includes("Artifact fixture ready"))
    throw new Error(`Fixture cycle ${cycle} did not complete its prepare/check contract.`);
  console.log(`ARTIFACT_FIXTURE_CYCLE_${cycle}=PASS`);
}
console.log(`ARTIFACT_FIXTURE_REPEATABILITY=PASS cycles=${cycleCount} database=bimlog_rfi_test encoding=UTF8`);
