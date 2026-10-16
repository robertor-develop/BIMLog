import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { latestConventionVersion } from "../artifacts/bimlog/src/lib/convention-version-selection.ts";

const emptyLatest = { conventionVersion: 3, acceptedDisciplines: [], acceptedDocTypes: [] };
const olderPopulated = { conventionVersion: 2, acceptedDisciplines: [{ code: "ARC" }], acceptedDocTypes: [{ code: "DR" }] };
assert.equal(latestConventionVersion([olderPopulated, emptyLatest]), emptyLatest, "an accepted empty latest version remains authoritative");
assert.equal(latestConventionVersion([]), null);
assert.throws(() => latestConventionVersion([{ conventionVersion: 2 }, { conventionVersion: 2 }]), /Invalid or ambiguous/);
assert.throws(() => latestConventionVersion([{ conventionVersion: 0 }]), /Invalid or ambiguous/);
const source = readFileSync("artifacts/bimlog/src/pages/project/ConventionBuilder.tsx", "utf8");
const checkpoint = source.slice(source.indexOf("function CheckpointScreen("), source.indexOf("function CheckpointScreen(") + 30000);
assert.match(checkpoint, /setSnapshotState\("loading"\)/);
assert.match(checkpoint, /setLatestVersion\(latestConventionVersion\(versions\)\)/);
assert.match(checkpoint, /setSnapshotState\("error"\)/);
assert.match(checkpoint, /setSnapshotRetry\(value => value \+ 1\)/);
assert.match(checkpoint, /let cancelled = false/);
console.log("GA-F02-B008 latest convention version recovery: PASS");
