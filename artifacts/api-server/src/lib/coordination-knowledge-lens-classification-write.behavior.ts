import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repository=readFileSync(fileURLToPath(new URL("./coordination-knowledge-repository.ts",import.meta.url)),"utf8");
const routes=readFileSync(fileURLToPath(new URL("../routes/coordination-knowledge.ts",import.meta.url)),"utf8");
const client=readFileSync(fileURLToPath(new URL("../../../bimlog/src/features/lens-next/lens-next-client.ts",import.meta.url)),"utf8");
assert.match(repository,/classifyLensIssue/);
assert.match(repository,/FOR UPDATE/);
assert.match(repository,/status='approved'/);
assert.match(repository,/KNOWLEDGE_CLASSIFICATION_STALE/);
assert.match(repository,/issue_classification_changed/);
assert.match(routes,/"classify_issue"/);
assert.match(routes,/classification/);
assert.match(client,/classifyKnowledgeContext/);
console.log("Coordination Knowledge Lens optional classification write behavior: PASS");
