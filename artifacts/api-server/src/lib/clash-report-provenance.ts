import { and, eq } from "drizzle-orm";
import { clashReportsTable, clashesTable } from "@workspace/db/schema";

export class ClashProvenanceError extends Error {
  readonly code = "CLASH_PROVENANCE_MISMATCH";
  constructor() { super("CLASH_PROVENANCE_MISMATCH"); this.name = "ClashProvenanceError"; }
}

const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

export function requireClashProvenance(input: {
  routeProjectId: number;
  routeReportId: number;
  recordProjectId: number;
  recordReportId: number;
  routeClashId?: number;
  recordClashId?: number;
}): void {
  const clashIdentityMatches = input.routeClashId === undefined || input.recordClashId === input.routeClashId;
  if (!positive(input.routeProjectId) || !positive(input.routeReportId) ||
      input.recordProjectId !== input.routeProjectId || input.recordReportId !== input.routeReportId || !clashIdentityMatches) {
    throw new ClashProvenanceError();
  }
}

export function requireClashLinkProvenance(input: {
  projectId: number;
  sourceProjectId: number;
  sourceReportId: number;
  reportProjectId: number;
  targetProjectId: number;
}): void {
  if (!positive(input.projectId) || input.sourceProjectId !== input.projectId ||
      input.reportProjectId !== input.projectId || input.targetProjectId !== input.projectId ||
      !positive(input.sourceReportId)) throw new ClashProvenanceError();
}

export const clashReportScopeWhere = (projectId: number, reportId: number) => and(
  eq(clashReportsTable.id, reportId),
  eq(clashReportsTable.projectId, projectId),
);

export const clashScopeWhere = (projectId: number, reportId: number, clashId?: number) => and(
  eq(clashesTable.projectId, projectId),
  eq(clashesTable.clashReportId, reportId),
  ...(clashId === undefined ? [] : [eq(clashesTable.id, clashId)]),
);
