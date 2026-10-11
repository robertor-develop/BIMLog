export type TodayCandidate = { kind: "rfi" | "submittal" | "attention" | "project"; title: string; detail: string; href: string };

export function chooseRoleAwareTodayAction(role: string | null | undefined, candidates: TodayCandidate[]): TodayCandidate | null {
  if (!candidates.length) return null;
  const normalized = String(role || "").toLowerCase();
  const order = normalized.includes("document")
    ? ["submittal", "rfi", "attention", "project"]
    : normalized.includes("field") || normalized.includes("designer")
      ? ["rfi", "submittal", "attention", "project"]
      : ["attention", "rfi", "submittal", "project"];
  return [...candidates].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}
