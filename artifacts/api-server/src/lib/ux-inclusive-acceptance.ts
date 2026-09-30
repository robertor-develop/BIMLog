export type InclusiveJourney = Readonly<{
  id: string;
  viewport: "mobile" | "desktop";
  input: "keyboard" | "pointer";
  locale: "en" | "es";
  completed: boolean;
  focusOrderValid: boolean;
}>;
export type NativeGate = Readonly<{ client: "native-2021" | "native-2025"; status: "passed" | "deferred"; reason?: string }>;

export function verifyInclusiveAcceptance(journeys: readonly InclusiveJourney[], nativeGates: readonly NativeGate[]) {
  const failures: string[] = [];
  for (const viewport of ["mobile", "desktop"] as const)
    for (const input of ["keyboard", "pointer"] as const)
      for (const locale of ["en", "es"] as const)
        if (!journeys.some((item) => item.viewport === viewport && item.input === input && item.locale === locale && item.completed && item.focusOrderValid))
          failures.push(`MISSING_${viewport.toUpperCase()}_${input.toUpperCase()}_${locale.toUpperCase()}`);
  for (const client of ["native-2021", "native-2025"] as const) {
    const gate = nativeGates.find((item) => item.client === client);
    if (!gate) failures.push(`MISSING_${client.toUpperCase()}`);
    else if (gate.status === "deferred" && !gate.reason?.trim()) failures.push(`UNEXPLAINED_DEFERRAL_${client.toUpperCase()}`);
  }
  return Object.freeze({ status: failures.length ? "blocked" : "passed", failures: Object.freeze(failures), representativeJourneyCount: journeys.length });
}
