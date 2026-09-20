import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";

const help = readBimlogSource("lib/help-content.ts");
const center = readBimlogSource("pages/HelpCenter.tsx");

for (const phrase of [
  "registration with the invited email",
  "Roles control who may manage",
  "Lens Next is the supported Navisworks workflow",
  "Confirm the active BIMLog project and model identity",
  "Recover without hidden repair",
  "Do not create a duplicate company or project",
  "retry it; the error must not silently place an invited user",
]) assert.ok(help.includes(phrase), `missing Help guidance: ${phrase}`);
assert.match(center, /Search features, actions, errors, or terms/);
assert.match(center, /Documentation policy/);

console.log("block21 build103 critical-workflow Help coverage: PASS");
