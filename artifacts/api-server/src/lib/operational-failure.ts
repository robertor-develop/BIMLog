export type OperationalFailureCode =
  | "CONNECTOR_CREDENTIAL_LEASE_ROLLBACK_FAILED"
  | "CONNECTOR_CREDENTIAL_LIFECYCLE_ROLLBACK_FAILED"
  | "FEEDBACK_PACKAGE_DOCX_CLEANUP_FAILED"
  | "FEEDBACK_PACKAGE_MANIFEST_CLEANUP_FAILED"
  | "FEEDBACK_PACKAGE_PDF_CLEANUP_FAILED"
  | "FEEDBACK_PACKAGE_UNLOCK_FAILED"
  | "FEEDBACK_PACKAGE_WORKBOOK_CLEANUP_FAILED"
  | "JOB_INTAKE_ACTIVATION_ROLLBACK_FAILED"
  | "JOB_INTAKE_IMPORT_ROLLBACK_FAILED"
  | "JOB_INTAKE_UPLOAD_ROLLBACK_FAILED"
  | "LENS_NEXT_CREATE_FAILURE_SERIALIZATION_FAILED"
  | "PUBLIC_ORIGIN_CONFIGURATION_INVALID"
  | "TELEGRAM_DELIVERY_RESPONSE_INVALID"
  | "TELEGRAM_DOCUMENT_RESPONSE_INVALID"
  | "TELEGRAM_TEXT_RESPONSE_INVALID";

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

export async function cleanupWithOperationalEvidence(
  cleanup: () => Promise<unknown>,
  code: OperationalFailureCode,
  reporter: OperationalFailureReporter = defaultOperationalFailureReporter,
): Promise<boolean> {
  try {
    await cleanup();
    return true;
  } catch {
    reportOperationalFailure(code, reporter);
    return false;
  }
}

export async function parseJsonWithOperationalEvidence(
  response: { json(): Promise<unknown> },
  code: OperationalFailureCode,
  reporter: OperationalFailureReporter = defaultOperationalFailureReporter,
): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    reportOperationalFailure(code, reporter);
    return null;
  }
}
