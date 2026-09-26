export type WorkflowAvailability = {
  source: string;
  versionId: string;
  activationBlock?: { code: string; message?: string } | null;
};

export function workflowLifecycleLabel(state: string, spanish: boolean): string {
  const labels: Record<string, [string, string]> = {
    draft: ["Draft — not available for new work", "Borrador — no disponible para trabajo nuevo"],
    approved: ["Approved — publication pending", "Aprobado — publicación pendiente"],
    published: ["Published — locked version", "Publicado — versión bloqueada"],
    superseded: ["Superseded — historical version", "Sustituido — versión histórica"],
    retired: ["Retired — not available for new work", "Retirado — no disponible para trabajo nuevo"],
  };
  return labels[state]?.[spanish ? 1 : 0] ?? state;
}

export function workflowReadiness(
  versions: Array<{ versionId: string; state: string }>,
  options: WorkflowAvailability[],
) {
  const unique = [...new Map(versions.map(row => [row.versionId, row])).values()];
  const published = new Set(unique.filter(row => row.state === "published").map(row => row.versionId));
  const company = [...new Map(options.filter(row => row.source === "company" && published.has(row.versionId))
    .map(row => [row.versionId, row])).values()];
  return {
    drafts: unique.filter(row => row.state === "draft").length,
    awaitingPublication: unique.filter(row => row.state === "approved").length,
    selectable: company.filter(row => !row.activationBlock).length,
    blocked: company.filter(row => !!row.activationBlock).length,
  };
}
