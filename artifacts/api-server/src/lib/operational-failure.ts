export type OperationalFailureCode =
  | "CONNECTOR_CREDENTIAL_LEASE_ROLLBACK_FAILED"
  | "CONNECTOR_CREDENTIAL_LIFECYCLE_ROLLBACK_FAILED"
  | "PUBLIC_ORIGIN_CONFIGURATION_INVALID";

export type OperationalFailureEvent = Readonly<{
  event: "bimlog_operational_failure";
  code: OperationalFailureCode;
}>;

export type OperationalFailureReporter = (event: OperationalFailureEvent) => void;

export const defaultOperationalFailureReporter: OperationalFailureReporter = (event) => {
  console.error(JSON.stringify(event));
};

export function reportOperationalFailure(
  code: OperationalFailureCode,
  reporter: OperationalFailureReporter = defaultOperationalFailureReporter,
): void {
  reporter(Object.freeze({ event: "bimlog_operational_failure", code }));
}

export async function rollbackWithOperationalEvidence(
  client: { query(sql: string): Promise<unknown> },
  code: Extract<OperationalFailureCode, `${string}_ROLLBACK_FAILED`>,
  reporter: OperationalFailureReporter = defaultOperationalFailureReporter,
): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    reportOperationalFailure(code, reporter);
  }
}
