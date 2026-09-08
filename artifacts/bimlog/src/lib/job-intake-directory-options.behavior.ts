import assert from "node:assert/strict";
import {
  clientCompanyOptions,
  contactBelongsToCompany,
  primaryContactOptions,
} from "./job-intake-directory-options.ts";

const entries = [
  { id: 1, fullName: "Zoe", email: "z@example.test", companyName: "Client B" },
  { id: 2, fullName: "Ana", email: "a@example.test", companyName: "Client A" },
  { id: 3, fullName: "Bob", email: "b@example.test", companyName: "Client A" },
  { id: 4, fullName: "Ignored", companyName: " " },
];

assert.deepEqual(clientCompanyOptions(entries), ["Client A", "Client B"]);
assert.deepEqual(
  primaryContactOptions(entries, "Client A").map((entry) => entry.fullName),
  ["Ana", "Bob"],
);
assert.deepEqual(primaryContactOptions(entries, ""), []);
assert.equal(contactBelongsToCompany(entries, "Client A", "Ana"), true);
assert.equal(contactBelongsToCompany(entries, "Client B", "Ana"), false);
assert.equal(contactBelongsToCompany(entries, "Client A", "Missing"), false);

console.log("Job Intake directory options behavior: PASS");
