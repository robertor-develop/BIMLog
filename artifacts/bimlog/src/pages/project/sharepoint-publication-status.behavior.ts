import assert from "node:assert/strict";
import { sharePointPublicationStatus } from "./sharepoint-publication-status";
assert.equal(sharePointPublicationStatus("completed", "en").tone, "success");
assert.match(sharePointPublicationStatus("dead_letter", "en").message, /not published/);
assert.match(sharePointPublicationStatus("retry", "es").message, /vista previa/);
assert.equal(sharePointPublicationStatus("unknown", "en").tone, "neutral");
