import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeConventionFields, suggestedConventionName } from "../artifacts/bimlog/src/lib/convention-consumer.ts";

const convention = { isActive: true, separator: "-", fields: [
  { label: "Originator", fieldOrder: 1, allowedValues: ["ORG"] },
  { label: "Project Code", fieldOrder: 0, allowedValues: ["PROJECT"] },
  { label: "Revision", fieldOrder: 2, allowedValues: ["P02"] },
] };
assert.deepEqual(activeConventionFields(convention).map(field => field.label), ["Project Code", "Originator", "Revision"]);
assert.equal(suggestedConventionName(convention), "PROJECT-ORG-P02");
assert.equal(suggestedConventionName({ ...convention, isActive: false }), null);
const source = readFileSync("artifacts/bimlog/src/pages/project/ConventionBuilder.tsx", "utf8");
const checkpoint = source.slice(source.indexOf("function CheckpointScreen("), source.indexOf("function CheckpointScreen(") + 30000);
assert.match(checkpoint, /activeConventionFields\(currentConvention\)/);
assert.match(checkpoint, /suggestedConventionName\(currentConvention\)/);
assert.doesNotMatch(checkpoint, /function buildSampleName\(/);
console.log("GA-F02-B006 active convention checkpoint: PASS");
