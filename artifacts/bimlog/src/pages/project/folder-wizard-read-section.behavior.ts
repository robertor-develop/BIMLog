import assert from "node:assert/strict";
import { readFolderWizardSection } from "./folder-wizard-read-section";

const [readiness, history] = await Promise.all([
  readFolderWizardSection(async () => { throw new Error("offline"); }),
  readFolderWizardSection<{ jobs: string[] }>(async () => Response.json({ jobs: ["completed"] })),
]);
assert.deepEqual(readiness, { ok: false });
assert.deepEqual(history, { ok: true, data: { jobs: ["completed"] } });
assert.deepEqual(await readFolderWizardSection(async () => new Response("denied", { status: 403 })), { ok: false });
assert.deepEqual(await readFolderWizardSection(async () => new Response("broken JSON")), { ok: false });
console.log("Independent Folder Wizard status reads: PASS");
