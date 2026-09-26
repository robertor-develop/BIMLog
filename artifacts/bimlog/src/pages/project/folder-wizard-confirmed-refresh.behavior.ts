import assert from "node:assert/strict";
import { refreshAfterConfirmedFolderWizardMutation } from "./folder-wizard-confirmed-refresh";

async function main() {
  let reads = 0;
  assert.equal(await refreshAfterConfirmedFolderWizardMutation(async () => { reads += 1; }), true);
  assert.equal(await refreshAfterConfirmedFolderWizardMutation(async () => { reads += 1; throw new Error("offline"); }), false);
  assert.equal(reads, 2, "one refresh, no automatic write retry");
  console.log("Confirmed Folder Wizard writes survive refresh failure: PASS");
}
void main();
