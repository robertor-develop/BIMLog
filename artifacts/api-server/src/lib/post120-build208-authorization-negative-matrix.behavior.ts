import assert from "node:assert/strict";
import { authorizeObjectRequest, OBJECT_AUTHORITY_SURFACES } from "./block22-object-authority";

const allowed = {
  authenticated: true,
  actorCompanyId: 11,
  actorProjectIds: [101, 102],
  requestedCompanyId: 11,
  requestedProjectId: 101,
  objectProjectId: 101,
  objectExists: true,
} as const;

for (const surface of OBJECT_AUTHORITY_SURFACES) {
  assert.equal(authorizeObjectRequest(allowed).code, "ALLOW_EXACT_SCOPE", `${surface}: exact authority`);
  assert.equal(authorizeObjectRequest({ ...allowed, authenticated: false }).code, "AUTHENTICATION_REQUIRED", `${surface}: anonymous`);
  assert.equal(authorizeObjectRequest({ ...allowed, requestedCompanyId: 12 }).code, "COMPANY_SCOPE_DENIED", `${surface}: cross tenant`);
  assert.equal(authorizeObjectRequest({ ...allowed, requestedProjectId: 103 }).code, "PROJECT_SCOPE_DENIED", `${surface}: guessed project`);
  assert.equal(authorizeObjectRequest({ ...allowed, objectProjectId: 102 }).code, "PROJECT_SCOPE_DENIED", `${surface}: cross project object`);
  assert.equal(authorizeObjectRequest({ ...allowed, objectExists: false }).code, "OBJECT_NOT_FOUND", `${surface}: guessed object`);
}

console.log(`POST120_BUILD208=PASS surfaces=${OBJECT_AUTHORITY_SURFACES.length} anonymous=deny tenant=deny project=deny object=deny`);
