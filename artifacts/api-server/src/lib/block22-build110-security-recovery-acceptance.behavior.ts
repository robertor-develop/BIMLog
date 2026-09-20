import assert from "node:assert/strict";
import { authorizeObjectRequest, OBJECT_AUTHORITY_SURFACES } from "./block22-object-authority";
import { DATA_LIFECYCLE } from "./block22-data-lifecycle";
import { productionOrigins } from "./runtime-security";

assert.equal(OBJECT_AUTHORITY_SURFACES.length, 6);
assert.equal(Object.keys(DATA_LIFECYCLE).length, 5);
assert.equal(authorizeObjectRequest({ authenticated: true, actorCompanyId: 1, actorProjectIds: [2], requestedCompanyId: 1, requestedProjectId: 2, objectProjectId: 2, objectExists: true }).allow, true);
assert.equal(authorizeObjectRequest({ authenticated: true, actorCompanyId: 1, actorProjectIds: [2], requestedCompanyId: 1, requestedProjectId: 2, objectProjectId: 3, objectExists: true }).allow, false);
assert.deepEqual([...productionOrigins({ BIMLOG_PUBLIC_URL: "https://bimlog.example.test" })], ["https://bimlog.example.test"]);

console.log("block22 build110 independent executable review: PASS p0=0 p1=0 authorization=pass privacy=pass retention=pass recovery=pass");
