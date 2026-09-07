import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const panelPath = path.resolve(
  process.cwd(),
  "../bimlog/src/features/lens-next/LensNextPanel.tsx",
);
const workspacePath = path.resolve(
  process.cwd(),
  "../bimlog/src/features/lens-next/LensNextWorkspace.tsx",
);
const panel = fs.readFileSync(panelPath, "utf8");
const workspace = fs.readFileSync(workspacePath, "utf8");

assert.doesNotMatch(
  panel,
  /setInterval\(\s*\(\) => void loadIssues\("refresh"\)/,
  "automatic issue refresh must not use an overlapping interval",
);
assert.match(
  panel,
  /setTimeout\(async \(\) => \{[\s\S]*await loadIssues\("refresh", controller\.signal\);[\s\S]*if \(!stopped\) schedule\(\)/,
  "the next refresh must be scheduled only after the current refresh settles",
);
assert.match(panel, /controller\?\.abort\(\)/, "an in-flight refresh must be cancelled when its context unmounts");
assert.match(panel, /sequence !== refreshSequence\.current \|\| signal\?\.aborted/, "stale refresh responses must remain rejected");
assert.doesNotMatch(
  workspace,
  /setInterval\([\s\S]{0,160}(probe|loadProjectContext|loadLocalInventory)/,
  "bridge and Navisworks reads must not run from a repeating interval",
);

console.log("PASS lens-next refresh responsiveness: completion-based cadence, cancellation, and stale-response guard");
