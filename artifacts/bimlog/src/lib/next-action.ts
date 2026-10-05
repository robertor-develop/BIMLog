export type NextActionCandidate = {
  key: string;
  title: string;
  status: string;
  deadline: string | null;
  project: { id: number; name: string; code: string };
  classification: { groups: { due: boolean; overdue: boolean; blocked: boolean; noResponse: boolean } };
  action: { label: string; openLink: string };
};

export type NextAction = NextActionCandidate & {
  reason: "overdue" | "due" | "blocked" | "no_response" | "active";
};

const priority: Record<NextAction["reason"], number> = {
  overdue: 0,
  due: 1,
  blocked: 2,
  no_response: 3,
  active: 4,
};

function reasonFor(item: NextActionCandidate): NextAction["reason"] {
  if (item.classification.groups.overdue) return "overdue";
  if (item.classification.groups.due) return "due";
  if (item.classification.groups.blocked) return "blocked";
  if (item.classification.groups.noResponse) return "no_response";
  return "active";
}

function deadlineValue(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/** Selects one presentation-only next action from canonical source records. */
export function selectNextAction(items: readonly NextActionCandidate[]): NextAction | null {
  return items
    .map(item => ({ ...item, reason: reasonFor(item) }))
    .sort((left, right) => priority[left.reason] - priority[right.reason]
      || deadlineValue(left.deadline) - deadlineValue(right.deadline)
      || left.project.code.localeCompare(right.project.code)
      || left.key.localeCompare(right.key))[0] ?? null;
}

export function nextActionReason(reason: NextAction["reason"], lang: string): string {
  const es = lang === "es";
  const labels: Record<NextAction["reason"], [string, string]> = {
    overdue: ["Overdue work needs attention", "Trabajo vencido requiere atención"],
    due: ["Due today", "Vence hoy"],
    blocked: ["A blocker needs to be resolved", "Se debe resolver un bloqueo"],
    no_response: ["A response is still pending", "Aún falta una respuesta"],
    active: ["Continue this active item", "Continúe este elemento activo"],
  };
  return labels[reason][es ? 1 : 0];
}
