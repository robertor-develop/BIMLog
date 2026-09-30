export type CompatibilityRequest = Readonly<{ client: "web" | "native-2021" | "native-2025"; path: string }>;
export type RolloutState = Readonly<{
  version: string;
  routeAliases: Readonly<Record<string, string>>;
  enabledCohortIds: readonly string[];
  businessEventCursor: string;
}>;

export type RolloutPreview = Readonly<{
  status: "compatible" | "blocked";
  resolutions: readonly Readonly<{ client: CompatibilityRequest["client"]; requestedPath: string; resolvedPath: string }>[];
  unsupported: readonly CompatibilityRequest[];
  writesPerformed: 0;
}>;

export function previewCompatibility(
  requests: readonly CompatibilityRequest[],
  supportedPaths: readonly string[],
  aliases: Readonly<Record<string, string>>,
): RolloutPreview {
  const supported = new Set(supportedPaths);
  const resolutions: Array<{ client: CompatibilityRequest["client"]; requestedPath: string; resolvedPath: string }> = [];
  const unsupported: CompatibilityRequest[] = [];
  for (const request of requests) {
    const resolvedPath = aliases[request.path] ?? request.path;
    if (!supported.has(resolvedPath)) unsupported.push(request);
    else resolutions.push({ client: request.client, requestedPath: request.path, resolvedPath });
  }
  return Object.freeze({ status: unsupported.length ? "blocked" : "compatible", resolutions, unsupported, writesPerformed: 0 });
}

export function rollbackRollout(current: RolloutState, acceptedBefore: RolloutState): RolloutState {
  if (!acceptedBefore.version.trim() || !current.version.trim()) throw new Error("ROLLOUT_VERSION_REQUIRED");
  // Roll back routing and cohort exposure only. Never rewind legitimate business events.
  return Object.freeze({
    version: acceptedBefore.version,
    routeAliases: Object.freeze({ ...acceptedBefore.routeAliases }),
    enabledCohortIds: Object.freeze([...acceptedBefore.enabledCohortIds]),
    businessEventCursor: current.businessEventCursor,
  });
}
