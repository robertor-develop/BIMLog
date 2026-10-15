export const GA_PROTECTED_PROJECTS = Object.freeze([
  { id: 23, code: "IBQ-LIT", name: "IBQ Lithium Extraction Plant" },
  { id: 26, code: "ELA01", name: "ELARA EAST" },
  { id: 35, code: "PRO-521-TEST", name: "521 E TREMONT TEST PROJECT" },
] as const);

const protectedIds = new Set<number>(GA_PROTECTED_PROJECTS.map(project => project.id));

export function isGaProtectedProjectId(projectId: number): boolean {
  return protectedIds.has(projectId);
}

export function requireGaProjectNotProtected(projectId: number): void {
  if (isGaProtectedProjectId(projectId)) {
    throw new Error(`GA_PROTECTED_PROJECT:${projectId}`);
  }
}

export function gaProtectedProjectById(projectId: number) {
  return GA_PROTECTED_PROJECTS.find(project => project.id === projectId) ?? null;
}
