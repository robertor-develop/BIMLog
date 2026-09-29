import assert from "node:assert/strict";
import { projectCompanyNames, projectCompanyIdentities } from "./project-party-options";
const directory = [
  { id: 1, companyId: 31, companyName: "BIMTECH", fullName: "Ana" },
  { id: 2, companyId: 31, companyName: "BIMTECH", fullName: "Bob" },
  { id: 3, companyId: 42, companyName: "Client" },
];
assert.deepEqual(projectCompanyNames(directory), ["BIMTECH", "Client"]);
assert.deepEqual(projectCompanyIdentities(directory), [{id:31,name:"BIMTECH"},{id:42,name:"Client"}]);
assert.deepEqual(projectCompanyNames([], "Historical name"), ["Historical name"]);
assert.deepEqual(projectCompanyNames([]), []);
assert.equal(directory.length, 3);
console.log("Project party eligibility: PASS");
