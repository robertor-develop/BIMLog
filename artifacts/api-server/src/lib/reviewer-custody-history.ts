export type CustodyIntervalState = "open" | "closed" | "unknown";

export type CustodySource = "rfi_custody" | "submittal_history";

export interface ReviewerCustodyStep {
  identity: string;
  source: CustodySource;
  recordType: "rfi" | "submittal";
  recordId: number;
  projectId: number;
  sourceEventId: string;
  party: string | null;
  company: string | null;
  openedAt: string | null;
  closedAt: string | null;
  intervalState: CustodyIntervalState;
  provenance: {
    tableOrField: "rfi_ball_in_court_history" | "submittals.ball_in_court_history";
    rawDaysHeld: number | null;
  };
}

export interface LinkedCoordinationEvidence {
  serverId: number;
  displayId: string | null;
  authorizedLink: string;
}

type RfiCustodyRow = {
  id: number;
  rfiId: number;
  projectId: number;
  heldBy?: string | null;
  heldByCompany?: string | null;
  fromDate?: Date | string | null;
  toDate?: Date | string | null;
  daysHeld?: number | null;
};

type SubmittalHistoryEntry = { party?: string | null; setAt?: string | null; setBy?: string | null };

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function intervalState(openedAt: string | null, closedAt: string | null): CustodyIntervalState {
  if (!openedAt) return "unknown";
  if (!closedAt) return "open";
  return new Date(closedAt).getTime() >= new Date(openedAt).getTime() ? "closed" : "unknown";
}

export function normalizeRfiCustody(rows: readonly RfiCustodyRow[]): ReviewerCustodyStep[] {
  return rows.map(row => {
    const openedAt = iso(row.fromDate);
    const closedAt = iso(row.toDate);
    return {
      identity: `rfi:${row.rfiId}:custody:${row.id}`,
      source: "rfi_custody",
      recordType: "rfi",
      recordId: row.rfiId,
      projectId: row.projectId,
      sourceEventId: String(row.id),
      party: row.heldBy?.trim() || null,
      company: row.heldByCompany?.trim() || null,
      openedAt,
      closedAt,
      intervalState: intervalState(openedAt, closedAt),
      provenance: { tableOrField: "rfi_ball_in_court_history", rawDaysHeld: row.daysHeld ?? null },
    };
  }).sort(compareCustodySteps);
}

export function normalizeSubmittalCustody(input: {
  submittalId: number;
  projectId: number;
  history: readonly SubmittalHistoryEntry[] | null | undefined;
}): ReviewerCustodyStep[] {
  const history = Array.isArray(input.history) ? input.history : [];
  return history.map((entry, index) => {
    const openedAt = iso(entry.setAt);
    const nextOpenedAt = index + 1 < history.length ? iso(history[index + 1]?.setAt) : null;
    const closedAt = openedAt && nextOpenedAt && new Date(nextOpenedAt).getTime() >= new Date(openedAt).getTime()
      ? nextOpenedAt
      : null;
    const state = openedAt
      ? (index + 1 < history.length ? (closedAt ? "closed" : "unknown") : "open")
      : "unknown";
    return {
      identity: `submittal:${input.submittalId}:custody:${index}`,
      source: "submittal_history",
      recordType: "submittal",
      recordId: input.submittalId,
      projectId: input.projectId,
      sourceEventId: String(index),
      party: entry.party?.trim() || null,
      company: null,
      openedAt,
      closedAt,
      intervalState: state,
      provenance: { tableOrField: "submittals.ball_in_court_history", rawDaysHeld: null },
    };
  }).sort(compareCustodySteps);
}

export function compareCustodySteps(a: ReviewerCustodyStep, b: ReviewerCustodyStep): number {
  const aTime = a.openedAt ? new Date(a.openedAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.openedAt ? new Date(b.openedAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime || a.identity.localeCompare(b.identity);
}

export function custodyReadContract(input: {
  rfiRows?: readonly RfiCustodyRow[];
  submittals?: readonly { id: number; projectId: number; ballInCourtHistory?: readonly SubmittalHistoryEntry[] | null }[];
  linkedCoordinationEvidence?: readonly LinkedCoordinationEvidence[];
}) {
  const steps = [
    ...normalizeRfiCustody(input.rfiRows ?? []),
    ...(input.submittals ?? []).flatMap(row => normalizeSubmittalCustody({
      submittalId: row.id,
      projectId: row.projectId,
      history: row.ballInCourtHistory,
    })),
  ].sort(compareCustodySteps);

  return {
    steps,
    linkedCoordinationEvidence: [...(input.linkedCoordinationEvidence ?? [])],
  };
}
