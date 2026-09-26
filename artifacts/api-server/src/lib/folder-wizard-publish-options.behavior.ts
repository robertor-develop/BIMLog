import assert from "node:assert/strict";
import { folderWizardPublishOptions, pruneFolderWizardTags } from "../../../bimlog/src/pages/project/folder-wizard-publish-options";
const definition = {
  selectors: [{ tagKey: "type", tagValue: "SHOP", blueprintName: "Shop" }, { tagKey: "type", tagValue: "MODEL", blueprintName: "Model" }],
  tierMappings: [
    { tagKey: "floor", blueprintName: "Shop", values: [{ tagValue: "L01", item: "1st Floor" }] },
    { tagKey: "floor", blueprintName: "Model", values: [{ tagValue: "ALL", item: "All" }] },
  ],
};
assert.deepEqual(folderWizardPublishOptions(undefined, {}), []);
assert.deepEqual(folderWizardPublishOptions(definition, { type: "SHOP" }), [{ key: "type", values: ["SHOP", "MODEL"] }, { key: "floor", values: ["L01"] }]);
assert.deepEqual(pruneFolderWizardTags(definition, { type: "MODEL", floor: "L01", arbitrary: "x" }), { type: "MODEL" });
assert.deepEqual(pruneFolderWizardTags(definition, {}), {});
assert.equal(folderWizardPublishOptions(definition, {})[1].values.length, 2);
console.log("Folder Wizard exact saved publication vocabulary: PASS");
