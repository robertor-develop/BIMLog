import assert from "node:assert/strict";
import { isDirectoryPlaceholderEmail, isDirectoryRecipientEmail, isCompanyOnlyEntry } from "@workspace/api-zod";
for (const email of ["project-58-company-31-client@project-directory.local", "CONTACT@BIMLOG.IO", "imported@bimlog.io"]) {
  assert.equal(isDirectoryPlaceholderEmail(email), true);
  assert.equal(isDirectoryRecipientEmail(email), false);
}
assert.equal(isDirectoryRecipientEmail("ana@example.com"), true);
assert.equal(isDirectoryRecipientEmail(""), false);
assert.equal(isCompanyOnlyEntry({role:"External Company",email:"project-x@project-directory.local"}), true);
assert.equal(isCompanyOnlyEntry({role:"Client Contact",email:"project-x@project-directory.local"}), false);
assert.equal(isCompanyOnlyEntry({role:"External Company",email:"ana@example.com"}), false);
console.log("Directory placeholder and recipient boundary: PASS");

