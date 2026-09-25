import assert from "node:assert/strict";
import { parseFolderWizardDraft } from "./folder-wizard-draft";

const valid = { generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "", base_path: "" }, blueprints: [{ name: "Trade", include: true }] };
assert.equal(parseFolderWizardDraft(JSON.stringify(valid)).blueprints[0].name, "Trade");
for (const changed of [{ ...valid, blueprints: [null] }, { ...valid, destination: {} },
  { ...valid, blueprints: [{ name: 4, include: true }] }, { ...valid, generated_by: "Other" }]) {
  assert.throws(() => parseFolderWizardDraft(JSON.stringify(changed)));
}
assert.throws(() => parseFolderWizardDraft("{"));
console.log("Folder Wizard draft preview: PASS");
