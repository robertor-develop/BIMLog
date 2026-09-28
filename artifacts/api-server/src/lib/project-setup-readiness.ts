import { createHash } from "node:crypto";

export type SetupReadinessCheck = {
  key: "catalogs" | "templates" | "budget" | "providers" | "lens_company";
  scope: "core" | "commercial" | "integration";
  required: boolean;
  ready: boolean;
  detail: string;
};

export type ProjectSetupReadinessSnapshot = {
  schemaVersion: 1;
  projectId: number;
  revision: number;
  checks: readonly SetupReadinessCheck[];
  coreReady: boolean;
  commercialReady: boolean;
  lensReady: boolean;
  fingerprint: string;
};

const orderedChecks = (checks: readonly SetupReadinessCheck[]) => [...checks].sort((left, right) => left.key.localeCompare(right.key));

/** Deterministic projection of saved setup state; optional providers cannot block core work. */
export function projectSetupReadiness(input: {
  projectId: number;
  revision: number;
  checks: readonly SetupReadinessCheck[];
}): ProjectSetupReadinessSnapshot {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0 || !Number.isSafeInteger(input.revision) || input.revision <= 0)
    throw new Error("SETUP_READINESS_IDENTITY_INVALID");
  const checks = orderedChecks(input.checks);
  const keys = new Set(checks.map((check) => check.key));
  if (keys.size !== checks.length || checks.some((check) => !check.detail.trim()))
    throw new Error("SETUP_READINESS_CHECK_INVALID");
  const ready = (scope: SetupReadinessCheck["scope"]) => checks
    .filter((check) => check.scope === scope && check.required)
    .every((check) => check.ready);
  const coreReady = ready("core");
  const commercialReady = coreReady && ready("commercial");
  const lensReady = coreReady && ready("integration");
  const canonical = JSON.stringify({ schemaVersion: 1, projectId: input.projectId, revision: input.revision, checks });
  return {
    schemaVersion: 1,
    projectId: input.projectId,
    revision: input.revision,
    checks,
    coreReady,
    commercialReady,
    lensReady,
    fingerprint: createHash("sha256").update(canonical).digest("hex"),
  };
}
