import assert from "node:assert/strict";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { resolveFolderWizardDestination, FolderWizardResolutionError } from "./folder-wizard-resolver";

const document = parseFolderWizardExport(JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "https://bimcorpgroup.sharepoint.com/sites/1185RIVERAV", base_path: "Shared Documents/1185 RIVER AV/16 COORD" },
  blueprints: [
    { name: "Trade", include: true, tiers: [
      { label: "MAIN", items: ["TRADE SUBMITTALS"], mode: "alpha", start: 1, width: 2, sep: "_", case: "upper" },
      { label: "TYPE", items: ["SHOP", "SLEEVE"], mode: "numeric", start: 0, width: 0, sep: "_", case: "upper" },
      { label: "LEVEL", items: ["BASEMENT", "LEVEL 01"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" },
    ] },
    { name: "Model", include: true, tiers: [{ label: "FILE TYPE", items: ["NWF", "NWD"], mode: "numeric", start: 0, width: 0, sep: "_", case: "upper" }] },
  ] })).document;
const profile = { selectors: [{ tagKey: "type", tagValue: "Shop", blueprintName: "Trade" },
  { tagKey: "type", tagValue: "NWF", blueprintName: "Model" }], tierMappings: [
    { blueprintName: "Trade", tierLabel: "TYPE", tagKey: "type", values: [{ tagValue: "Shop", item: "SHOP" }] },
    { blueprintName: "Trade", tierLabel: "LEVEL", tagKey: "level", values: [{ tagValue: "L01", item: "LEVEL 01" }] },
    { blueprintName: "Model", tierLabel: "FILE TYPE", tagKey: "type", values: [{ tagValue: "NWF", item: "NWF" }] },
  ] };
const shop = resolveFolderWizardDestination({ document, profile, tags: { type: "Shop", level: "L01" }, filename: "P-SD-L01.pdf" });
assert.equal(shop.relativeFilePath, "Shared Documents/1185 RIVER AV/16 COORD/AB_TRADE SUBMITTALS/0_SHOP/LEVEL 01/P-SD-L01.pdf");
const model = resolveFolderWizardDestination({ document, profile, tags: { type: "NWF" }, filename: "model.nwf" });
assert.equal(model.relativeFilePath, "Shared Documents/1185 RIVER AV/16 COORD/0_NWF/model.nwf");
assert.notEqual(shop.blueprintName, model.blueprintName);
assert.throws(() => resolveFolderWizardDestination({ document, profile, tags: { type: "Shop", level: "L02" }, filename: "x.pdf" }),
  (error: unknown) => error instanceof FolderWizardResolutionError && error.code === "FOLDER_WIZARD_TIER_UNMAPPED");
assert.throws(() => resolveFolderWizardDestination({ document, profile, tags: { type: "NWD" }, filename: "x.nwd" }));
assert.throws(() => resolveFolderWizardDestination({ document, profile, tags: { type: "NWF" }, filename: "../x.nwf" }));
console.log("Folder Wizard exact route resolution: PASS");
