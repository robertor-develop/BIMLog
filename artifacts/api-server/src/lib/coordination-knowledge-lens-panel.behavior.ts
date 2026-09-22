import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const route=readFileSync(fileURLToPath(new URL("../routes/coordination-knowledge.ts",import.meta.url)),"utf8");
const view=readFileSync(fileURLToPath(new URL("../../../bimlog/src/features/lens-next/LensNextPanelView.tsx",import.meta.url)),"utf8");
const panel=readFileSync(fileURLToPath(new URL("../../../bimlog/src/features/lens-next/LensNextKnowledgePanel.tsx",import.meta.url)),"utf8");
assert.match(route,/lens-context\/:lensViewpointId/);
assert.match(route,/context\(req,"view_approved"\)/);
assert.match(view,/"overview", "knowledge", "bimlog"/);
assert.match(panel,/Collapse/);
assert.match(panel,/Issue work remains available/);
assert.doesNotMatch(panel,/BIMLens/);
console.log("coordination knowledge Lens panel behavior: PASS");
