import { inspectLaunchConfiguration, type LaunchConfigurationInput } from "./launch-configuration";

type StoredConfiguration = LaunchConfigurationInput & { secretEnvelopes?: Record<string, unknown> };

export function prepareLaunchConfigurationRestore(input: { current: unknown; historical: unknown }) {
  const current = structuredClone(input.current as StoredConfiguration);
  const historical = structuredClone(input.historical as StoredConfiguration);
  if (!historical || typeof historical !== "object") throw new Error("LAUNCH_CONFIGURATION_HISTORY_INVALID");
  historical.secretEnvelopes = current?.secretEnvelopes ?? {};
  const readiness = inspectLaunchConfiguration(historical);
  return Object.freeze({ configuration: historical, readiness, state: readiness.launchConfigurationEntered ? "validated" as const : "draft" as const });
}
