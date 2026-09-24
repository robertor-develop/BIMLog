import assert from "node:assert/strict";
import { edtRoleFromCurrentAuthority, edtRouteActorSql } from "./edt-engine-route-context";
import { permissionsForDefaultRole } from "./edt-engine-authorization";

const ordinary = { isOperationsDirector: false, projectRole: "project_admin",
  isSuperAdmin: false, isCompanyPmo: false };
assert.equal(edtRoleFromCurrentAuthority(ordinary), "PROJECT_LEADER");
assert.equal(edtRoleFromCurrentAuthority({ ...ordinary, isCompanyPmo: true }), "PMO");
assert.equal(edtRoleFromCurrentAuthority({ ...ordinary, isSuperAdmin: true }), "CEO");
assert.equal(edtRoleFromCurrentAuthority({ ...ordinary, isOperationsDirector: true }), "OPERATIONS_DIRECTOR");
assert.equal(edtRoleFromCurrentAuthority({ ...ordinary, isOperationsDirector: true, projectRole: null }), undefined);
for (const role of ["PROJECT_LEADER", "PMO", "CEO"] as const)
  assert.equal(permissionsForDefaultRole(role).includes("JOB_ACTIVATION_APPROVE"), false);
assert.equal(permissionsForDefaultRole("OPERATIONS_DIRECTOR").includes("JOB_ACTIVATION_APPROVE"), true);
assert.match(edtRouteActorSql, /edt_operations_director_revocations/);
assert.match(edtRouteActorSql, /pm\.status='active'/);
console.log("EDT_OPERATIONS_DIRECTOR_ROLE_RESULT=PASS narrow current grant and active membership");
