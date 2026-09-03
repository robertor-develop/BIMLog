type SafeFailureRecord = Record<string, unknown>;

function safeRead(value: unknown, key: string): unknown {
  try {
    return value !== null && (typeof value === "object" || typeof value === "function")
      ? (value as SafeFailureRecord)[key]
      : undefined;
  } catch {
    return undefined;
  }
}

function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return typeof value === "string" ? value : String(value);
  } catch {
    return "[unreadable]";
  }
}

function safeClass(value: unknown): string {
  const constructor = safeRead(value, "constructor");
  return safeText(safeRead(constructor, "name")) ?? safeText(safeRead(value, "name")) ?? "UnknownError";
}

export function serializeLensNextCreateFailure(input: {
  error: unknown;
  correlationId: string;
  projectId: number;
  stage: string;
}): string {
  try {
    const cause = safeRead(input.error, "cause");
    const event = {
      event: "lens_next_create_failure",
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId,
      projectId: Number.isSafeInteger(input.projectId) ? input.projectId : null,
      requestRoute: "/api/v1/projects/:projectId/clash-reports/lens-next/issues/create",
      transactionStage: input.stage,
      exceptionType: typeof input.error,
      exceptionClass: safeClass(input.error),
      exceptionName: safeText(safeRead(input.error, "name")),
      exceptionMessage: safeText(safeRead(input.error, "message")) ?? safeText(input.error),
      exceptionCause: safeText(safeRead(cause, "message")) ?? safeText(cause),
      stack: safeText(safeRead(input.error, "stack")),
      postgresCode: safeText(safeRead(input.error, "code")) ?? safeText(safeRead(cause, "code")),
      constraint: safeText(safeRead(input.error, "constraint")) ?? safeText(safeRead(cause, "constraint")),
      detail: safeText(safeRead(input.error, "detail")) ?? safeText(safeRead(cause, "detail")),
      schema: safeText(safeRead(input.error, "schema")) ?? safeText(safeRead(cause, "schema")),
      table: safeText(safeRead(input.error, "table")) ?? safeText(safeRead(cause, "table")),
      column: safeText(safeRead(input.error, "column")) ?? safeText(safeRead(cause, "column")),
      routine: safeText(safeRead(input.error, "routine")) ?? safeText(safeRead(cause, "routine")),
      sourceFunction: safeText(safeRead(input.error, "routine")) ?? safeText(safeRead(cause, "routine")),
      sourceContext: safeText(safeRead(input.error, "where")) ?? safeText(safeRead(cause, "where")),
    };
    return JSON.stringify(event);
  } catch {
    return JSON.stringify({
      event: "lens_next_create_failure",
      timestamp: new Date().toISOString(),
      correlationId: safeText(input.correlationId),
      projectId: Number.isSafeInteger(input.projectId) ? input.projectId : null,
      requestRoute: "/api/v1/projects/:projectId/clash-reports/lens-next/issues/create",
      transactionStage: safeText(input.stage),
      exceptionType: "unknown",
      exceptionClass: "TelemetryExtractionError",
      exceptionName: null,
      exceptionMessage: "Failure telemetry extraction failed safely.",
      exceptionCause: null,
      stack: null,
      postgresCode: null,
      constraint: null,
      detail: null,
      schema: null,
      table: null,
      column: null,
      routine: null,
      sourceFunction: null,
      sourceContext: null,
    });
  }
}
