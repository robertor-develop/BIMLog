export type ProjectRetirementRequest = (path: string, init?: RequestInit) => Promise<Response>;

type Preview = { projectName: string; projectCode: string; expectedUpdatedAt: string;
  completeProjectDependentTableCount: number; memberCount: number; fileCount: number };

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return new Error(body.error || fallback);
}

export async function confirmAndRetireProject(projectId: number, request: ProjectRetirementRequest): Promise<boolean> {
  const previewResponse = await request(`/projects/${projectId}/retirement-preview`);
  if (!previewResponse.ok) throw await responseError(previewResponse, "Could not preview project retirement.");
  const preview = await previewResponse.json() as Preview;
  const confirmation = window.prompt(`Retire "${preview.projectName}"?\n\n${preview.completeProjectDependentTableCount} dependent table categories will be preserved. ${preview.memberCount} memberships and ${preview.fileCount} files remain intact.\n\nType the exact project code ${preview.projectCode} to confirm:`);
  if (confirmation === null) return false;
  const response = await request(`/projects/${projectId}/retire`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation, expectedUpdatedAt: preview.expectedUpdatedAt }) });
  if (!response.ok) throw await responseError(response, "Project retirement failed.");
  return true;
}
