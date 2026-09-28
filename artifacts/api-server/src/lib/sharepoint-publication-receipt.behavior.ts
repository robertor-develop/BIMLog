import assert from "node:assert/strict";
import { projectSharePointPublicationReceipt } from "./sharepoint-publication-receipt";
assert.deepEqual(projectSharePointPublicationReceipt({ jobId: "job-12345678", outcome: "completed", providerItemId: "item-7", errorCode: "secret" }),
  { jobId: "job-12345678", outcome: "completed", action: "none", published: true, providerItemId: "item-7", errorCode: null });
const failed = projectSharePointPublicationReceipt({ jobId: "job-12345678", outcome: "dead_letter", providerItemId: "hidden", errorCode: "FOLDER_WIZARD_GRAPH_UPLOAD_FAILED" });
assert.equal(failed.providerItemId, null);
assert.equal(failed.errorCode, "FOLDER_WIZARD_GRAPH_UPLOAD_FAILED");
