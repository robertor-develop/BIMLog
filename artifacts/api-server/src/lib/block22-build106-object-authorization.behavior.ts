import assert from "node:assert/strict";
import fs from "node:fs";
import { authorizeObjectRequest, OBJECT_AUTHORITY_SURFACES } from "./block22-object-authority";

const exact = { authenticated: true, actorCompanyId: 9, actorProjectIds: [26], requestedCompanyId: 9, requestedProjectId: 26, objectProjectId: 26, objectExists: true } as const;
for (const surface of OBJECT_AUTHORITY_SURFACES) {
  assert.deepEqual(authorizeObjectRequest(exact), { allow: true, code: "ALLOW_EXACT_SCOPE" }, surface);
  assert.equal(authorizeObjectRequest({ ...exact, requestedCompanyId: 10 }).allow, false, `${surface}: cross-tenant request`);
  assert.equal(authorizeObjectRequest({ ...exact, requestedProjectId: 27 }).allow, false, `${surface}: guessed project id`);
  assert.equal(authorizeObjectRequest({ ...exact, objectProjectId: 27 }).allow, false, `${surface}: object/project mismatch`);
  assert.equal(authorizeObjectRequest({ ...exact, objectExists: false }).allow, false, `${surface}: guessed object id`);
}

const route = (name: string) => fs.readFileSync(new URL(`../routes/${name}.ts`, import.meta.url), "utf8");
const files = route("files"), reports = route("reports"), lens = route("clash_reports"), feedback = route("feedback"), integrations = route("coordination-hub");
for (const [name, source] of Object.entries({ files, reports })) {
  assert.match(source, /requireProjectMember\(\)/, `${name}: missing membership boundary`);
  assert.match(source, /projectId/, `${name}: missing project scope`);
}
assert.match(files, /eq\(filesTable\.id, fileId\), eq\(filesTable\.projectId, projectId\)/);
assert.match(reports, /eq\([^\n]+\.projectId, projectId\)/);
assert.match(lens, /projectId/);
assert.match(feedback, /actor\.companyId !== row\.companyId|feedback\.companyId !== actor\.companyId/);
assert.match(feedback, /projectAuthorized\(/);
assert.match(integrations, /projectId/);

console.log("block22 build106 tenant/project object authorization: PASS surfaces=6 cross_tenant=deny guessed_id=deny");
