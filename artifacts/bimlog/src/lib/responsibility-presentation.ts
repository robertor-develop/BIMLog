const statusLabels: Record<string, [string, string]> = {
  open: ["Open", "Abierto"], pending: ["Pending", "Pendiente"], in_review: ["In review", "En revisión"],
  waiting_design: ["Waiting for design", "En espera de diseño"], follow_up: ["Follow up", "Seguimiento"],
  approved: ["Approved", "Aprobado"], resolved: ["Resolved", "Resuelto"], closed: ["Closed", "Cerrado"],
  blocked: ["Blocked", "Bloqueado"], rejected: ["Changes requested", "Cambios solicitados"],
};

const gapLabels: Record<string, [string, string]> = {
  OWNER_MISSING: ["Owner not assigned", "Responsable no asignado"],
  DEADLINE_MISSING: ["Deadline not set", "Fecha límite no definida"],
  SOURCE_UNAVAILABLE: ["Source temporarily unavailable", "Fuente temporalmente no disponible"],
  REVIEWER_MISSING: ["Reviewer not assigned", "Revisor no asignado"],
  COMPANY_MISSING: ["Company not assigned", "Empresa no asignada"],
};

function readableFallback(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/^./, character => character.toUpperCase());
}

export function responsibilityStatusLabel(value: string, lang: string): string {
  const pair = statusLabels[value.toLowerCase()];
  return pair ? pair[lang === "es" ? 1 : 0] : readableFallback(value);
}

export function responsibilityGapLabel(value: string, lang: string): string {
  const pair = gapLabels[value.toUpperCase()];
  return pair ? pair[lang === "es" ? 1 : 0] : readableFallback(value);
}
