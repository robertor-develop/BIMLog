import assert from "node:assert/strict";
import { lensNextPrerequisiteGuidance } from "./lens-next-prerequisite-guidance.ts";
assert.equal(lensNextPrerequisiteGuidance("disconnected",null).state,"disconnected");
assert.match(lensNextPrerequisiteGuidance("connected",null).message,/no Navisworks model/i);
assert.match(lensNextPrerequisiteGuidance("connected","coordination.nwd").message,/Confirm the BIMLog project and model/);
console.log("PASS UX062 bridge and model prerequisite guidance");
