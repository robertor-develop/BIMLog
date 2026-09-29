export function projectHomeDestination(projectId: number, role: string, intake?: {status?: string; intake?: unknown}): string | null {
  if (role === "project_admin") {
    if (intake?.status === "activated") return `/projects/${projectId}/operations`;
    if (intake?.intake === null || ["draft", "ready"].includes(intake?.status || "")) return `/projects/${projectId}/intake`;
    return null;
  }
  const tab = ["discipline_lead", "convention_manager"].includes(role) ? "coordination" : ["member", "sub_trade"].includes(role) ? "operations" : "analytics";
  return `/projects/${projectId}/${tab}`;
}
