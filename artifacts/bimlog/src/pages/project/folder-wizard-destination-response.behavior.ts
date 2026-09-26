import assert from "node:assert/strict";
import { readFolderWizardDestination } from "./folder-wizard-destination-response";
const valid = { canConfigure: true, credentials: [{ id: "test", label: "Test connection" }], current: null };
assert.equal(readFolderWizardDestination(valid), valid);
assert.equal(readFolderWizardDestination({ ...valid, current: { siteId: "site", libraryId: "drive", state: "active" } }).current?.state, "active");
for (const value of [null, {}, { ...valid, credentials: null }, { ...valid, credentials: [{}] }, { ...valid, current: {} }, { ...valid, current: { siteId: "site", libraryId: "drive", state: "unknown" } }]) assert.throws(() => readFolderWizardDestination(value));
console.log("Folder Wizard destination response validation: PASS");
