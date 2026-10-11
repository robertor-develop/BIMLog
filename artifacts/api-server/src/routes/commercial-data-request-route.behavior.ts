import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./support-cases.ts",import.meta.url),"utf8");
assert.ok(source.includes("...input,fingerprint,companyId:actor.companyId,requesterUserId:actor.userId"));
assert.ok((source.match(/dataRequestKind:supportCasesTable\.dataRequestKind/g)??[]).length>=2);
assert.ok(source.includes("eq(supportCasesTable.companyId,actor.companyId),eq(supportCasesTable.requesterUserId,actor.userId)"));
assert.ok(source.includes('res.set("Cache-Control","private, no-store, max-age=0")'));
console.log("LR083 tenant-scoped customer data-request projection: PASS");
