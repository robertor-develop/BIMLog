export type FailureJourneyObservation = Readonly<{
  scenario: "recoverable_retry" | "date_boundary" | "permission_denial" | "cross_tenant_denial";
  inputFingerprintBefore: string;
  inputFingerprintAfter: string;
  mutationCount: number;
  exposedRecordIds: readonly string[];
  authorizedRecordIds: readonly string[];
}>;

export function verifyFailureJourneys(observations: readonly FailureJourneyObservation[]) {
  const required = new Set<FailureJourneyObservation["scenario"]>(["recoverable_retry", "date_boundary", "permission_denial", "cross_tenant_denial"]);
  const failures: string[] = [];
  for (const observation of observations) {
    if (!required.delete(observation.scenario)) failures.push(`DUPLICATE_OR_UNKNOWN_${observation.scenario.toUpperCase()}`);
    if (observation.inputFingerprintBefore !== observation.inputFingerprintAfter) failures.push(`INPUT_NOT_PRESERVED_${observation.scenario.toUpperCase()}`);
    const denied = observation.scenario.endsWith("denial");
    if ((denied && observation.mutationCount !== 0) || (!denied && observation.mutationCount > 1)) failures.push(`MUTATION_COUNT_${observation.scenario.toUpperCase()}`);
    const authorized = new Set(observation.authorizedRecordIds);
    if (observation.exposedRecordIds.some((id) => !authorized.has(id))) failures.push(`UNAUTHORIZED_EXPOSURE_${observation.scenario.toUpperCase()}`);
  }
  for (const missing of required) failures.push(`MISSING_${missing.toUpperCase()}`);
  return Object.freeze({ status: failures.length ? "blocked" : "passed", failures: Object.freeze(failures) });
}
