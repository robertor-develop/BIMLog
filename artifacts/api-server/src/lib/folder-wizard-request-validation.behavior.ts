import assert from "node:assert/strict";
import { validFolderWizardTags, validFolderWizardFileId } from "./folder-wizard-request-validation";
assert.equal(validFolderWizardTags({ trade: "Architecture", floor: "L01" }), true);
assert.equal(validFolderWizardTags({}), true);
for (const value of [null, [], "trade", { trade: 1 }, { Trade: "A" }, { trade: "x".repeat(161) },
  { constructor: "A" }, JSON.parse('{"__proto__":"A"}'), Object.create({ trade: "A" }),
  Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`tag_${i}`, "A"]))]) {
  assert.equal(validFolderWizardTags(value), false);
}
assert.equal(validFolderWizardTags({ trade: "x".repeat(160) }), true);
assert.equal(validFolderWizardFileId(1), true);
for (const value of ["1", null, true, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validFolderWizardFileId(value), false);
console.log("Folder Wizard bounded request validation: PASS");
