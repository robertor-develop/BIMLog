import assert from "node:assert/strict";
import {
  EDT_ENGINE_PERMISSIONS,
  decideEdtEnginePermission,
  isEdtEnginePermission,
  normalizeEdtEnginePermissions,
} from "./edt-engine-permissions";

assert.equal(EDT_ENGINE_PERMISSIONS.length, 15, "approved permission vocabulary must remain complete");
assert.equal(new Set(EDT_ENGINE_PERMISSIONS).size, EDT_ENGINE_PERMISSIONS.length);
assert.equal(isEdtEnginePermission("QC_APPROVE"), true);
assert.equal(isEdtEnginePermission("SUPER_ADMIN"), false, "role labels are not engine permissions");

assert.deepEqual(
  normalizeEdtEnginePermissions(["QC_APPROVE", "JOB_OPERATE", "QC_APPROVE"]),
  ["JOB_OPERATE", "QC_APPROVE"],
  "normalization is deterministic and removes duplicate grants",
);
assert.deepEqual(normalizeEdtEnginePermissions(["QC_APPROVE", "UNKNOWN"]), []);
assert.deepEqual(normalizeEdtEnginePermissions("QC_APPROVE"), []);

assert.deepEqual(decideEdtEnginePermission(["QC_APPROVE"], "QC_APPROVE"), {
  allow: true,
  code: "PERMISSION_GRANTED",
  required: "QC_APPROVE",
});
assert.deepEqual(decideEdtEnginePermission(["QC_REVIEW"], "QC_APPROVE"), {
  allow: false,
  code: "PERMISSION_REQUIRED",
  required: "QC_APPROVE",
});
assert.deepEqual(decideEdtEnginePermission(["QC_APPROVE", "UNKNOWN"], "QC_APPROVE"), {
  allow: false,
  code: "INVALID_PERMISSION_GRANT",
  required: "QC_APPROVE",
});

console.log("EDT_ENGINE_BUILD281_RESULT=PASS");
