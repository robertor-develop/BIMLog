export type LensNextActivityType = "status" | "comment" | "assignment";
export type LensNextTimelineMode =
  | "empty"
  | "ready"
  | "offline"
  | "error"
  | "blocked";
export type LensNextTimelineLocale = "en" | "es";

export interface LensNextTimelineIdentity {
  projectId: number;
  serverId: number;
  viewpointId: string;
  issueFamilyId: string;
  lifecycleStatus: "active" | "superseded" | "voided";
  revisionNumber: number;
}

export interface LensNextActivityEvent {
  activityId: string;
  type: LensNextActivityType;
  identity: LensNextTimelineIdentity;
  version: number;
  occurredAt: string;
  actorDisplayName: string;
  summary: string;
  visualStateDigest: string;
}

export interface LensNextHistoryPage {
  identity: LensNextTimelineIdentity;
  requestCursor: string | null;
  nextCursor: string | null;
  historyVersion: number;
  visualStateDigest: string;
  events: readonly LensNextActivityEvent[];
}

export interface LensNextTimelineState {
  mode: LensNextTimelineMode;
  identity: LensNextTimelineIdentity;
  historyVersion: number;
  visualStateDigest: string;
  events: readonly LensNextActivityEvent[];
  nextCursor: string | null;
  reason: string | null;
}

export interface LensNextHistoryGetRequest {
  method: "GET";
  authenticated: true;
  path: string;
  sessionId: string;
  identity: LensNextTimelineIdentity;
  cursor: string | null;
  limit: 100;
}

export interface LensNextTimelineItem {
  key: string;
  type: LensNextActivityType;
  label: string;
  actorLabel: string;
  timeLabel: string;
  summary: string;
  versionLabel: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const SHA256 = /^[0-9a-f]{64}$/i;
const CURSOR = /^[A-Za-z0-9_-]{8,160}$/;
const MAX_EVENTS = 500;

const LABELS = {
  status: { en: "Status changed", es: "Estado actualizado" },
  comment: { en: "Comment added", es: "Comentario agregado" },
  assignment: { en: "Assignment changed", es: "Asignación actualizada" },
} as const;

function validIdentity(identity: LensNextTimelineIdentity) {
  return (
    Number.isSafeInteger(identity.projectId) &&
    identity.projectId > 0 &&
    Number.isSafeInteger(identity.serverId) &&
    identity.serverId > 0 &&
    ID.test(identity.viewpointId) &&
    UUID.test(identity.issueFamilyId) &&
    identity.lifecycleStatus === "active" &&
    Number.isSafeInteger(identity.revisionNumber) &&
    identity.revisionNumber > 0
  );
}

function sameIdentity(
  left: LensNextTimelineIdentity,
  right: LensNextTimelineIdentity,
) {
  return (
    left.projectId === right.projectId &&
    left.serverId === right.serverId &&
    left.viewpointId === right.viewpointId &&
    left.issueFamilyId === right.issueFamilyId &&
    left.lifecycleStatus === right.lifecycleStatus &&
    left.revisionNumber === right.revisionNumber
  );
}

function blocked(
  state: LensNextTimelineState,
  reason: string,
): LensNextTimelineState {
  return { ...state, mode: "blocked", nextCursor: null, reason };
}

export function createLensNextTimelineState(input: {
  identity: LensNextTimelineIdentity;
  historyVersion: number;
  visualStateDigest: string;
}): LensNextTimelineState {
  if (!validIdentity(input.identity))
    throw new Error("TIMELINE_IDENTITY_INVALID");
  if (!Number.isSafeInteger(input.historyVersion) || input.historyVersion < 0)
    throw new Error("TIMELINE_VERSION_INVALID");
  if (!SHA256.test(input.visualStateDigest))
    throw new Error("VISUAL_DIGEST_INVALID");
  return {
    mode: "empty",
    identity: { ...input.identity },
    historyVersion: input.historyVersion,
    visualStateDigest: input.visualStateDigest,
    events: [],
    nextCursor: null,
    reason: null,
  };
}

export function createLensNextHistoryGetRequest(input: {
  state: LensNextTimelineState;
  sessionId: string;
  authenticated: boolean;
  cursor?: string | null;
}): LensNextHistoryGetRequest | null {
  const cursor = input.cursor ?? null;
  if (
    input.authenticated !== true ||
    !ID.test(input.sessionId) ||
    input.state.mode === "blocked" ||
    (cursor !== null && !CURSOR.test(cursor))
  )
    return null;
  return {
    method: "GET",
    authenticated: true,
    path: `/api/projects/${input.state.identity.projectId}/clash-reports/lens-viewpoints/${input.state.identity.serverId}/history`,
    sessionId: input.sessionId,
    identity: { ...input.state.identity },
    cursor,
    limit: 100,
  };
}

export function applyLensNextHistoryPage(
  state: LensNextTimelineState,
  page: LensNextHistoryPage,
): LensNextTimelineState {
  if (
    !validIdentity(page.identity) ||
    !sameIdentity(state.identity, page.identity)
  )
    return blocked(state, "IMMUTABLE_IDENTITY_MISMATCH");
  if (
    !SHA256.test(page.visualStateDigest) ||
    page.visualStateDigest !== state.visualStateDigest
  )
    return blocked(state, "VISUAL_STATE_DIVERGED");
  if (
    !Number.isSafeInteger(page.historyVersion) ||
    page.historyVersion < state.historyVersion
  )
    return blocked(state, "STALE_HISTORY_VERSION");
  if (
    page.requestCursor !== state.nextCursor ||
    (page.nextCursor !== null && !CURSOR.test(page.nextCursor))
  )
    return blocked(state, "CURSOR_MISMATCH");
  if (page.events.length > 100) return blocked(state, "HISTORY_BOUND_EXCEEDED");

  const byId = new Map(state.events.map((event) => [event.activityId, event]));
  for (const event of page.events) {
    if (
      !ID.test(event.activityId) ||
      !["status", "comment", "assignment"].includes(event.type) ||
      !sameIdentity(state.identity, event.identity) ||
      !Number.isSafeInteger(event.version) ||
      event.version < 1 ||
      !Number.isFinite(Date.parse(event.occurredAt)) ||
      !SHA256.test(event.visualStateDigest) ||
      event.visualStateDigest !== state.visualStateDigest ||
      event.actorDisplayName.trim().length < 1 ||
      event.summary.trim().length < 1
    )
      return blocked(state, "HISTORY_EVENT_INVALID");
    const existing = byId.get(event.activityId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event))
      return blocked(state, "DIVERGENT_ACTIVITY_DUPLICATE");
    byId.set(event.activityId, event);
  }

  const events = [...byId.values()].sort((left, right) => {
    const time = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    return (
      time ||
      left.version - right.version ||
      left.activityId.localeCompare(right.activityId)
    );
  });
  for (let index = 1; index < events.length; index += 1) {
    if (
      Date.parse(events[index].occurredAt) <
        Date.parse(events[index - 1].occurredAt) ||
      events[index].version < events[index - 1].version
    )
      return blocked(state, "NON_MONOTONIC_HISTORY");
  }
  if (events.length > MAX_EVENTS)
    return blocked(state, "HISTORY_BOUND_EXCEEDED");
  return {
    ...state,
    mode: events.length ? "ready" : "empty",
    historyVersion: page.historyVersion,
    events,
    nextCursor: page.nextCursor,
    reason: null,
  };
}

export function markLensNextTimelineUnavailable(
  state: LensNextTimelineState,
  kind: "offline" | "error",
): LensNextTimelineState {
  return {
    ...state,
    mode: kind,
    reason: kind === "offline" ? "HISTORY_OFFLINE" : "HISTORY_ERROR",
  };
}

export function toLensNextTimelineItems(
  state: LensNextTimelineState,
  locale: LensNextTimelineLocale,
): readonly LensNextTimelineItem[] {
  return state.events.map((event) => ({
    key: event.activityId,
    type: event.type,
    label: LABELS[event.type][locale],
    actorLabel:
      locale === "es"
        ? `Por ${event.actorDisplayName}`
        : `By ${event.actorDisplayName}`,
    timeLabel: event.occurredAt,
    summary: event.summary,
    versionLabel:
      locale === "es" ? `Versión ${event.version}` : `Version ${event.version}`,
  }));
}

export const LENS_NEXT_TIMELINE_INVARIANTS = Object.freeze({
  maximumEvents: MAX_EVENTS,
  pageSize: 100,
  method: "GET" as const,
  actionEnablement: false as const,
  writeBehavior: false as const,
  fallbackMatching: false as const,
  automaticConflictResolution: false as const,
  visualStateMutation: false as const,
});
