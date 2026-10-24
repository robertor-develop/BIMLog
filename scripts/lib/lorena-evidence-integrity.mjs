import fs from "node:fs";

const acceptedStates = new Set(["INDEPENDENTLY_ACCEPTED", "CUSTOMER_FIELD_ACCEPTED"]);

export function validateLorenaEvidenceLedger(ledger, { candidateCommit, requireIndependent = false } = {}) {
  const errors = [];
  if (ledger?.candidate?.sourceCommit !== candidateCommit) errors.push("STALE_OR_MIXED_COMMIT");
  if (ledger?.candidate?.deployedCommit !== candidateCommit) errors.push("DEPLOYED_IDENTITY_MISMATCH");
  const claims = Array.isArray(ledger?.claims) ? ledger.claims : [];
  const ids = new Set();
  for (const claim of claims) {
    if (!claim?.id || ids.has(claim.id)) errors.push("DUPLICATE_OR_MISSING_CLAIM_ID");
    ids.add(claim?.id);
    if (/FIXTURE|DOCUMENTATION_ONLY|HISTORICAL_ONLY/.test(claim?.state ?? "")) errors.push(`${claim.id}:NON_ACCEPTANCE_EVIDENCE`);
    if ((claim?.state ?? "").includes("HISTORICAL") && acceptedStates.has(claim?.state)) errors.push(`${claim.id}:HISTORICAL_ACCEPTANCE_CONFLICT`);
    if ((claim?.state ?? "").startsWith("OBSERVED_EXACT_CANDIDATE")) {
      for (const key of ["route", "role", "locale", "viewport", "consoleResult", "networkResult", "observedAt"])
        if (claim[key] === null || claim[key] === "") errors.push(`${claim.id}:MISSING_${key.toUpperCase()}`);
      if (!Array.isArray(claim.artifactRefs) || claim.artifactRefs.length === 0) errors.push(`${claim.id}:MISSING_ARTIFACT`);
      for (const artifact of claim.artifactRefs ?? []) if (!fs.existsSync(artifact)) errors.push(`${claim.id}:MISSING_ARTIFACT_FILE`);
    }
    if (requireIndependent && claim.state !== "INDEPENDENTLY_ACCEPTED" && claim.state !== "CUSTOMER_FIELD_ACCEPTED")
      errors.push(`${claim.id}:INDEPENDENT_REVIEW_REQUIRED`);
  }
  const lifecycle = claims.filter((claim) => ["job-intake", "apu-cost-value", "delivery-workflow", "edt-wbs", "activation-operations"].includes(claim.id));
  const lifecycleProjects = new Set(lifecycle.map((claim) => claim.projectId).filter(Number.isInteger));
  if (lifecycleProjects.size > 1) errors.push("MIXED_PROJECT_LIFECYCLE_EVIDENCE");
  return [...new Set(errors)];
}
