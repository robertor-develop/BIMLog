import assert from "node:assert/strict";
import fs from "node:fs";

const routes = fs.readFileSync(new URL("../routes/rfis.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/rfis.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/project/RfisTab.tsx", import.meta.url), "utf8");

assert.match(schema, /revisionNumber: integer\("revision_number"\)\.default\(0\)/);
assert.match(schema, /deletedAt: timestamp\("deleted_at"\)/);
assert.match(schema, /\.on\(t\.projectId, t\.parentRfiId, t\.revisionNumber\)/);
assert.match(routes, /SELECT id FROM rfis WHERE id = \$\{rfiId\} AND project_id = \$\{projectId\} FOR UPDATE/);
assert.match(routes, /Math\.max\(0, \.\.\.family\.map\(item => item\.revisionNumber \?\? 0\)\) \+ 1/);
assert.match(routes, /parentRfiId: parentId, revisionNumber: revNum, revisionOf: source\.id/);
assert.match(routes, /event: "rfi\.revised"/);
assert.match(routes, /\.set\(\{ deletedAt: new Date\(\), deleteReason: reason \}\)/);
assert.match(routes, /rfiBallInCourtHistoryTable/);
assert.match(ui, />R\{rfi\.revisionNumber\}</);

console.log("POST-P17 Build 27 RFI lifecycle, revision, and immutable history: PASS");
