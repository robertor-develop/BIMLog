import assert from "node:assert/strict";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { validateFolderWizardRoutingProfile } from "./folder-wizard-routing-contract";

const document = parseFolderWizardExport(JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "", base_path: "" }, blueprints: [
    { name: "Trade", include: true, tiers: [{ label: "MAIN", items: ["TRADE"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" },
      { label: "LEVEL", items: ["LEVEL 01", "LEVEL 02"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] },
    { name: "Model", include: true, tiers: [{ label: "TYPE", items: ["NWF", "NWD"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] },
  ] })).document;
const definition = { selectors: [{ tagKey: "type", tagValue: "Shop", blueprintName: "Trade" },
  { tagKey: "type", tagValue: "NWF", blueprintName: "Model" }], tierMappings: [
    { blueprintName: "Trade", tierLabel: "LEVEL", tagKey: "level", values: [{ tagValue: "L01", item: "LEVEL 01" }] },
    { blueprintName: "Model", tierLabel: "TYPE", tagKey: "type", values: [{ tagValue: "NWF", item: "NWF" }] },
  ] };
assert.match(validateFolderWizardRoutingProfile(definition, document).fingerprint, /^[a-f0-9]{64}$/);
for (const changed of [
  { ...definition, selectors: definition.selectors.slice(0, 1) },
  { ...definition, selectors: [...definition.selectors, { tagKey: "type", tagValue: "shop", blueprintName: "Model" }] },
  { ...definition, tierMappings: definition.tierMappings.slice(1) },
  { ...definition, tierMappings: [{ ...definition.tierMappings[0], values: [{ tagValue: "L01", item: "OTHER" }] }, definition.tierMappings[1]] },
]) assert.throws(() => validateFolderWizardRoutingProfile(changed, document));
console.log("Folder Wizard mapping contract: PASS");
