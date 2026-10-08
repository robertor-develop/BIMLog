export type ActiveIntakeReturn = {
  href: string;
  projectId: number;
};

export function activeIntakeReturnTarget(projectId: number): string {
  return `/projects/${projectId}/intake?stage=review&item=ji-review`;
}

export function withActiveIntakeReturn(destination: string, projectId: number): string {
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}returnTo=${encodeURIComponent(activeIntakeReturnTarget(projectId))}`;
}

export function parseActiveIntakeReturn(search: string, projectId: number): ActiveIntakeReturn | null {
  const params = new URLSearchParams(search);
  const values = params.getAll("returnTo");
  if (values.length !== 1) return null;
  const expected = activeIntakeReturnTarget(projectId);
  if (values[0] !== expected) return null;
  return { href: expected, projectId };
}
