import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectedConventionName, suggestedConventionName } from "../artifacts/bimlog/src/lib/convention-consumer.ts";

const convention = { isActive: true, separator: "_", fields: [
  { label: "Type", fieldOrder: 2, allowedValues: ["DR"] },
  { label: "Project", fieldOrder: 0, allowedValues: ["BIM"] },
  { label: "Discipline", fieldOrder: 1, allowedValues: ["ARC"] },
] };
assert.equal(suggestedConventionName(convention), "BIM_ARC_DR");
assert.equal(selectedConventionName(convention, { Project: "BIM", Discipline: "STR", Type: "RP" }), "BIM_STR_RP");
assert.equal(selectedConventionName(convention, { Project: "BIM", Discipline: "STR", Type: "RP" }, { Discipline: true }), "BIM_RP");
const consumers = {
  checkpoint: "artifacts/bimlog/src/pages/project/ConventionBuilder.tsx",
  files: "artifacts/bimlog/src/pages/project/FilesTab.tsx",
  coordination: "artifacts/bimlog/src/pages/project/CoordinationHub.tsx",
  generator: "artifacts/bimlog/src/pages/project/NameGenerator.tsx",
};
for (const [name, file] of Object.entries(consumers)) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /from "@\/lib\/convention-consumer"/, `${name} must consume the shared naming contract`);
}
console.log("GA-F02-B007 convention naming consumer parity: PASS consumers=4");
