import assert from "node:assert/strict";
import { parseFolderWizardExport } from "./folder-wizard-export";

const valid = { generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "https://bimcorpgroup.sharepoint.com/sites/1185RIVERAV", base_path: "Shared Documents/1185 RIVER AV/16 COORD" },
  blueprints: [{ name: "Trade Submittals", include: true, tiers: [
    { label: "MAIN", items: ["TRADE SUBMITTALS"], mode: "alpha", start: 1, width: 2, sep: "_", case: "upper" },
    { label: "TYPE", items: ["SHOP", "COMPOSITE"], mode: "numeric", start: 0, width: 0, sep: "_", case: "upper" },
    { label: "LEVEL", items: ["BASEMENT", "LEVEL 01"], mode: "none", start: 0, width: 2, sep: "_", case: "upper" },
  ] }] };
const source = JSON.stringify(valid);
const first = parseFolderWizardExport(source);
assert.equal(first.document.blueprints[0].name, "Trade Submittals");
assert.match(first.sha256, /^[a-f0-9]{64}$/);
assert.equal(parseFolderWizardExport(source).sha256, first.sha256);
assert.equal(parseFolderWizardExport(JSON.stringify({ ...valid, destination: { sharepoint_url: "", base_path: "" } })).document.destination.sharepoint_url, "");
for (const changed of [
  { ...valid, generated_by: "Other" },
  { ...valid, destination: { ...valid.destination, sharepoint_url: "http://localhost/site" } },
  { ...valid, destination: { ...valid.destination, base_path: "Shared Documents/../other" } },
  { ...valid, blueprints: [{ ...valid.blueprints[0], include: false }] },
  { ...valid, blueprints: [{ ...valid.blueprints[0], tiers: [{ ...valid.blueprints[0].tiers[0], items: ["SHOP", "shop"] }] }] },
]) assert.throws(() => parseFolderWizardExport(JSON.stringify(changed)));
assert.throws(() => parseFolderWizardExport("{"), /INVALID_JSON/);
assert.throws(() => parseFolderWizardExport("x".repeat(1_048_577)), /TOO_LARGE/);
console.log("Folder Wizard export contract: PASS");
