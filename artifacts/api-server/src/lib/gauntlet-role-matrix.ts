export const GAUNTLET_PERSONAS = Object.freeze(["project_administrator", "company_lead", "drafter", "project_manager", "read_only"] as const);
export const GAUNTLET_ACTIONS = Object.freeze(["files", "rfis", "submittals", "conventions", "schedules", "apus", "reports", "exports", "team_administration", "deletion"] as const);
export type GauntletPersona = typeof GAUNTLET_PERSONAS[number];
export type GauntletAction = typeof GAUNTLET_ACTIONS[number];
export type GauntletRoleDecision = { persona: GauntletPersona; action: GauntletAction; allowed: boolean; status: number; code: string };

const EXPECTED: Readonly<Record<GauntletPersona, ReadonlySet<GauntletAction>>> = Object.freeze({
  project_administrator: new Set<GauntletAction>(GAUNTLET_ACTIONS),
  company_lead: new Set<GauntletAction>(["files", "rfis", "submittals", "schedules", "reports", "exports"]),
  drafter: new Set<GauntletAction>(["files", "rfis", "submittals", "schedules"]),
  project_manager: new Set<GauntletAction>(["files", "rfis", "submittals", "conventions", "schedules", "apus", "reports", "exports"]),
  read_only: new Set<GauntletAction>(["reports", "exports"]),
});

/** Verifies observed API decisions; it never grants authority or replaces endpoint policy. */
export function inspectGauntletRoleMatrix(decisions: readonly GauntletRoleDecision[]) {
  const identity = (decision: GauntletRoleDecision) => `${decision.persona}:${decision.action}`;
  if (new Set(decisions.map(identity)).size !== decisions.length) throw new Error("GAUNTLET_ROLE_DECISION_DUPLICATE");
  const missing: string[] = [];
  const mismatches: string[] = [];
  for (const persona of GAUNTLET_PERSONAS) for (const action of GAUNTLET_ACTIONS) {
    const observed = decisions.find(decision => decision.persona === persona && decision.action === action);
    const expected = EXPECTED[persona].has(action);
    if (!observed) { missing.push(`${persona}:${action}`); continue; }
    if (observed.allowed !== expected || (expected ? observed.status < 200 || observed.status >= 300 : ![401, 403].includes(observed.status)) || !observed.code.trim())
      mismatches.push(`${persona}:${action}`);
  }
  return Object.freeze({ ready: missing.length === 0 && mismatches.length === 0, missing, mismatches });
}

export function expectedGauntletRoleDecision(persona: GauntletPersona, action: GauntletAction): boolean {
  return EXPECTED[persona].has(action);
}
