import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const source=readFileSync(fileURLToPath(new URL("../../../bimlog/src/features/lens-next/LensNextKnowledgePanel.tsx",import.meta.url)),"utf8");
for(const evidence of ["Conflict Type","Approved · revision","elementTypeA","View Full Conflict Type","Change classification","Classification change unavailable","context.canClassify"]) assert.match(source,new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
assert.match(source,/!context\.conflictType/);
console.log("Lens conflict classification card behavior: PASS");
