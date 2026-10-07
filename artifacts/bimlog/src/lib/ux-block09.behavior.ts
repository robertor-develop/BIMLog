import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fileIntakeModeTruth,
  fileIntakeRequiresDestination,
  fileIntakeRequiresConvention,
  conventionResolverUrl,
  fileIntakePreview,
  fileIntakeCanSubmit,
  documentIdentity,
  fileIntakeRetryState,
} from "./file-intake-journey";

assert.match(fileIntakeModeTruth("record_only"), /not retained or delivered/);
assert.match(fileIntakeModeTruth("retained_evidence"), /does not deliver/);
assert.match(fileIntakeModeTruth("connected_delivery"), /after confirmation/);
assert.equal(fileIntakeRequiresDestination("record_only"), false);
assert.equal(fileIntakeRequiresDestination("connected_delivery"), true);
assert.equal(fileIntakeRequiresConvention("record_only"), false);
assert.equal(fileIntakeRequiresConvention("retained_evidence"), true);
assert.equal(conventionResolverUrl(42), "/projects/42/generator?returnTo=%2Fprojects%2F42%2Ffiles%3Fresume%3Dfile-intake");
const generatorSource = readFileSync(new URL("../pages/project/NameGenerator.tsx", import.meta.url), "utf8");
const filesSource = readFileSync(new URL("../pages/project/FilesTab.tsx", import.meta.url), "utf8");
assert.match(generatorSource, /safeProjectReturnTarget\(requestedReturnTo, projectId\)/);
assert.equal((filesSource.match(/conventionResolverUrl\(projectId\)/g) ?? []).length, 5);
assert.deepEqual(fileIntakePreview({ fileName: "A.pdf", mode: "record_only" }), { fileName: "A.pdf", retainsBytes: false, destination: null, delivers: false, ai: { requested: false, estimate: "No AI cost" } });
assert.equal(fileIntakePreview({ fileName: "A.pdf", mode: "connected_delivery", destinationLabel: null }).delivers, false);
assert.equal(fileIntakeCanSubmit("record_only"), true);
assert.equal(fileIntakeCanSubmit("retained_evidence"), false);
assert.deepEqual(documentIdentity({ id: 8, version: 2, parentFileId: 3, source: "system-generated" }), { recordKey: "file:8", familyKey: "file-family:3", label: "Record #8 · Family #3 · V2", source: "system-generated" });
assert.notEqual(documentIdentity({ id: 8, version: 1 }).familyKey, documentIdentity({ id: 9, version: 1 }).familyKey);
assert.equal(fileIntakeRetryState({ previous: "failed_retryable", sameFile: true, sameContext: true }), "failed_retryable");
assert.equal(fileIntakeRetryState({ previous: "failed_retryable", sameFile: false, sameContext: true }), "not_submitted");

console.log("UX041–UX045 file intake journey PASS");
