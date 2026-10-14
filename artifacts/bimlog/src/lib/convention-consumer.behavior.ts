import assert from "node:assert/strict";
import {
  activeConventionFields,
  selectedConventionName,
  suggestedConventionName,
} from "./convention-consumer";

const convention = {
  isActive: true,
  separator: "_",
  fields: [
    { label: "Type", fieldOrder: 2, allowedValues: ["DR"] },
    { label: "Project", fieldOrder: 0, allowedValues: ["BIM"] },
    { label: "Discipline", fieldOrder: 1, allowedValues: ["ARC"] },
  ],
};

assert.deepEqual(activeConventionFields(convention).map(field => field.label), ["Project", "Discipline", "Type"]);
assert.equal(suggestedConventionName(convention), "BIM_ARC_DR");
assert.equal(selectedConventionName(convention, { Project: "BIM", Discipline: "STR", Type: "RP" }), "BIM_STR_RP");
assert.equal(selectedConventionName(convention, { Project: "BIM", Discipline: "STR", Type: "RP" }, { Discipline: true }), "BIM_RP");
assert.equal(suggestedConventionName({ ...convention, isActive: false }), null);

console.log("convention-consumer.behavior: PASS all browser naming consumers share one ordered convention contract");
