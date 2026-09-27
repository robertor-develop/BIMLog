/** Manual scenarios are not approved earnings, allocations, or payment authority. */
export function performanceProvenance(plan: {
  id: string; version: number; content_fingerprint: string; content: { currency?: unknown };
}) {
  const currency = typeof plan.content.currency === "string" && /^[A-Z]{3}$/.test(plan.content.currency)
    ? plan.content.currency : null;
  return {
    classification: "manual_scenario" as const,
    approvedEarnings: false as const,
    paymentAuthorized: false as const,
    planVersionId: plan.id,
    planVersion: Number(plan.version),
    planFingerprint: plan.content_fingerprint,
    currency,
    policyAuthority: "scenario_evaluator_only" as const,
  };
}
