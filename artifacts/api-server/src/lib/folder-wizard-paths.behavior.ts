import assert from "node:assert/strict";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { folderWizardDisplayName, previewFolderWizardPaths } from "./folder-wizard-paths";

const tier = { label: "TYPE", items: ["SHOP", "SLEEVE"], mode: "numeric" as const,
  start: 1, width: 3, sep: "_", case: "upper" as const };
assert.equal(folderWizardDisplayName(tier, 0), "001_SHOP");
assert.equal(folderWizardDisplayName(tier, 1), "002_SLEEVE");
assert.equal(folderWizardDisplayName({ ...tier, width: 0 }, 0), "1_SHOP");
assert.equal(folderWizardDisplayName({ ...tier, mode: "alpha", start: 0, width: 2 }, 0), "AA_SHOP");
assert.equal(folderWizardDisplayName({ ...tier, mode: "alpha", start: 26, width: 2, case: "lower" }, 0), "ba_SHOP");
assert.equal(folderWizardDisplayName({ ...tier, mode: "alpha", start: 676, width: 2 }, 0), "BAA_SHOP");
assert.equal(folderWizardDisplayName({ ...tier, mode: "none" }, 0), "SHOP");
assert.throws(() => folderWizardDisplayName(tier, 2), RangeError);

const document = parseFolderWizardExport(JSON.stringify({
  generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "", base_path: "Shared Documents/PROJECT" },
  blueprints: [
    { name: "Trade", include: true, tiers: [tier, { ...tier, label: "LEVEL", items: ["L1", "L2"], mode: "none" }] },
    { name: "Excluded", include: false, tiers: [tier] },
  ],
})).document;
assert.deepEqual(previewFolderWizardPaths(document, 2), {
  paths: ["Shared Documents/PROJECT/001_SHOP/L1", "Shared Documents/PROJECT/001_SHOP/L2"],
  totalLeafPaths: "4", truncated: true,
});
assert.equal(previewFolderWizardPaths(document).truncated, false);
assert.throws(() => previewFolderWizardPaths(document, 1_001), RangeError);
console.log("Folder Wizard path parity: PASS");
