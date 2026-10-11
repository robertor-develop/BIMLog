import assert from "node:assert/strict";
import { firstValueEvidenceDestination,type FirstValueEvidence } from "./first-value-evidence";

const base={recordId:17,projectId:9,projectCode:"P9",projectName:"Project 9",label:"Controlled result",createdAt:"2026-10-11T00:00:00.000Z"};
const route=(kind:FirstValueEvidence["kind"])=>firstValueEvidenceDestination({...base,kind});
assert.equal(route("rfi"),"/projects/9/rfis?rfi=17");
assert.equal(route("submittal"),"/projects/9/submittals?submittal=17");
assert.equal(route("file"),"/projects/9/files?file=17");
console.log("Simplification and guided adoption build 023 canonical first-value return: PASS");
