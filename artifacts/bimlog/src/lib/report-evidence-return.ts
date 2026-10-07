export type ReportEvidenceReturn = { returnTo: string };

/** Accept only the exact Reports workspace for the current project. */
export function parseReportEvidenceReturn(search: string, projectId: number): ReportEvidenceReturn | null {
  if (!Number.isSafeInteger(projectId) || projectId < 1) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if ([...params.keys()].some((key) => key !== "from")) return null;
  const values = params.getAll("from");
  const expected = `/projects/${projectId}/reports`;
  return values.length === 1 && values[0] === expected ? { returnTo: expected } : null;
}
