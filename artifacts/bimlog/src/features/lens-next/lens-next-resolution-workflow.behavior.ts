import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=import.meta.dirname,panel=readFileSync(join(root,"LensNextResolutionPanel.tsx"),"utf8"),view=readFileSync(join(root,"LensNextPanelView.tsx"),"utf8"),client=readFileSync(join(root,"lens-next-client.ts"),"utf8");
assert.match(view,/"resolution"/);
assert.match(view,/LensNextResolutionPanel/);
assert.match(panel,/Approved resolution method/);
assert.match(panel,/Actual resolution/);
assert.match(panel,/Resolution required an RFI/);
assert.match(panel,/Save draft/);
assert.match(panel,/Complete resolution/);
assert.match(panel,/Immutable resolution history/);
assert.match(client,/saveResolutionRecord/);
assert.match(client,/Resolution Record did not persist after save/);
console.log("Build 258 Lens Next resolution workflow: PASS");
