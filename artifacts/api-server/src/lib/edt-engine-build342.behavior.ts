import assert from "node:assert/strict";
import { validateResolvedEdtRequestIntent } from "./edt-engine-resolved-activation";

const actor = { grants: ["JOB_ACTIVATION_REQUEST"] as const, actorUserId: 3,
  actorCompanyId: 7, actorProjectIds: [11], eligibleRole: "PMO" };
const valid = { actor, companyId: 7, projectId: 11, expectedFingerprint: "a".repeat(64),
  reason: "Create the saved EDT from the activated Intake", idempotencyKey: "edt-intake-1" };
assert.doesNotThrow(() => validateResolvedEdtRequestIntent(valid));
for (const [change, code] of [
  [{ companyId: 8 }, "COMPANY_SCOPE_REQUIRED"],
  [{ projectId: 12 }, "PROJECT_SCOPE_REQUIRED"],
  [{ actor: { ...actor, grants: [] } }, "PERMISSION_REQUIRED"],
  [{ expectedFingerprint: "browser-plan" }, "EDT_CANDIDATE_STALE"],
  [{ reason: " " }, "REASON_REQUIRED"],
  [{ idempotencyKey: "short" }, "IDEMPOTENCY_KEY_INVALID"],
] as const) {
  assert.throws(() => validateResolvedEdtRequestIntent({ ...valid, ...change }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === code, code);
}
console.log("EDT_ENGINE_BUILD342_RESULT=PASS request intent is scoped and bounded before any database write");
