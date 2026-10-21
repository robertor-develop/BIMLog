export const ANALYZE_INTAKE_ENTRY_POINTS = [
  "files",
  "upload",
  "rfi-attachment",
  "submittal-attachment",
  "transmittal-attachment",
  "email-connector",
  "document-connector",
  "crawler-review",
] as const;

export type AnalyzeIntakeEntryPoint = typeof ANALYZE_INTAKE_ENTRY_POINTS[number];

export function analyzeIntakeHref(projectId: number, source: AnalyzeIntakeEntryPoint, sourceId?: string | number) {
  const params = new URLSearchParams({ mode: "analyze", source });
  if (sourceId !== undefined) params.set("sourceId", String(sourceId));
  return `/projects/${projectId}/files?${params.toString()}#canonical-intake-queue`;
}
