export type ProjectRecordState = "active" | "archived" | "missing" | "stale";

export class ProjectRecordLineageError extends Error {
  constructor(readonly code: "PROJECT_LINEAGE_MISMATCH" | "PROJECT_RECORD_UNAVAILABLE") {
    super(code);
    this.name = "ProjectRecordLineageError";
  }
}

export function requireProjectRecordLineage(input: {
  routeProjectId: number;
  recordProjectId: number;
  state: ProjectRecordState;
}): void {
  if (!Number.isSafeInteger(input.routeProjectId) || input.routeProjectId < 1 || input.recordProjectId !== input.routeProjectId) {
    throw new ProjectRecordLineageError("PROJECT_LINEAGE_MISMATCH");
  }
  if (input.state !== "active") throw new ProjectRecordLineageError("PROJECT_RECORD_UNAVAILABLE");
}
