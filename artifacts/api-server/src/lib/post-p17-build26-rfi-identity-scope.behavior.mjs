import assert from "node:assert/strict";
import fs from "node:fs";

const routes = fs.readFileSync(new URL("../routes/rfis.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/project/RfisTab.tsx", import.meta.url), "utf8");

assert.match(routes, /UpdateRfiParams\.parse\(\{ projectId: req\.params\.projectId, rfiId: req\.params\.rfiId \}\)/);
assert.match(routes, /and\(eq\(rfisTable\.id, rfiId\), eq\(rfisTable\.projectId, projectId\)/);
assert.match(routes, /validateRfiAttachmentTarget\(projectId, rfiId\)/);
assert.match(routes, /eq\(rfiResponsesTable\.projectId, projectId\)/);
assert.match(routes, /eq\(activityLogTable\.projectId, projectId\)/);
assert.match(routes, /requireProjectMember\(\)/);
assert.match(ui, /useListRfis\(projectId\)/);
assert.match(ui, /`\/api\/v1\/projects\/\$\{projectId\}\/rfis\/\$\{rfiId\}`/);
assert.match(ui, /canonicalFileLocator\(projectId, fileId\)/);

console.log("POST-P17 Build 26 RFI authoritative identity and project scope: PASS");
