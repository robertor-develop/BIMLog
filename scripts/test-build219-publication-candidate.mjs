import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const git = (...args) => execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "-C", root, ...args], { encoding: "utf8", windowsHide: true }).trim();

const census = json("evidence/stabilization-program-20260919/BUILD_216_REPOSITORY_CENSUS.json");
const audit = json("evidence/stabilization-program-20260919/BUILD_216_PLATFORM_AUDIT.json");
const reconciliation = read("evidence/stabilization-program-20260919/BUILD_217_FINAL_RECONCILIATION.md");
const gates = read("evidence/stabilization-program-20260919/BUILD_218_COMPLETE_GATES.md");
const identity = json("contracts/release-identity.json");
const operatingBrief = read("living-brief/CLAUDE.md");
const changed = git("diff", "--name-only", "d5878afc2ec82a6ea9d19a6c26dce6b0cb2feb1e...HEAD").split(/\r?\n/).filter(Boolean);

assert.equal(census.totals.trackedFiles, 2399);
assert.equal(census.totals.sourceFiles, 1806);
assert.equal(audit.counts.P0, 0);
assert.equal(audit.baseline.unexpectedP1.length, 0);
assert.match(reconciliation, /Status: `PASS`/);
assert.match(gates, /Status: `PASS`/);
assert.match(gates, /Navisworks 2021 Native contract: `57\/57 PASS`/);
assert.match(gates, /Navisworks 2025 Native contract: `57\/57 PASS`/);
assert.equal(identity.label, "v1.05.N18-P36");
assert.equal(identity.binaryVersion, "1.5.18.36");

for (const [name, required] of [
  ["persistent authorization", /clear instruction to proceed, push, publish or deploy remains valid through completion/i],
  ["no Replit Agents", /Replit Agents and prompt-based Replit\s+source changes are prohibited/i],
  ["no development-data copy", /development-to-production data copy remains off/i],
  ["zero schema action", /schemaAction=NONE/i],
  ["authenticated visible Chrome", /full authenticated visible-Chrome smoke/i],
]) assert.match(operatingBrief, required, `Missing publication rule: ${name}`);

const forbidden = changed.filter((file) => /^(plugins\/BIMLogLensNext\/|scripts\/build-lens-next|scripts\/install-lens-next|artifacts\/api-server\/src\/db\/|drizzle\/)/i.test(file));
assert.deepEqual(forbidden, [], `Block 44 unexpectedly changed Native, installer, or schema paths: ${forbidden.join(", ")}`);

console.log(`BUILD219_PUBLICATION_CANDIDATE=PASS release=${identity.label} changed=${changed.length} nativeInstallerSchemaChanges=0 route=GitHub->ReplitShell->Publish->AuthenticatedChrome`);
