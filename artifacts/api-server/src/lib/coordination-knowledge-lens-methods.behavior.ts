import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const repository=readFileSync(fileURLToPath(new URL("./coordination-knowledge-repository.ts",import.meta.url)),"utf8");
const panel=readFileSync(fileURLToPath(new URL("../../../bimlog/src/features/lens-next/LensNextKnowledgePanel.tsx",import.meta.url)),"utf8");
assert.match(repository,/ORDER BY link\.display_order,lower\(revision\.name\),method\.code/);
assert.match(repository,/preferred:typeof row\.details/);
for(const evidence of ["Known Resolution Methods","BIMLog does not select or execute a resolution","Responsible trade","RFI","Approvals","Constraints","Approved preferred","View method details"]) assert.match(panel,new RegExp(evidence));
console.log("Lens approved resolution methods behavior: PASS");
