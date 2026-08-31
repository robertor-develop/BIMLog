import {
  LENS_NEXT_LIFECYCLE_STATES,
  LENS_NEXT_STATUSES,
  type LensNextFilters,
  type LensNextBridgeProjectContext,
  type LensNextHistory,
  type LensNextHistoryEvent,
  type LensNextHistoryRevision,
  type LensNextImmutableIssueIdentity,
  type LensNextIssue,
  type LensNextLocalInventory,
  type LensNextInventorySummary,
  type LensNextSyncPlan,
  type LensNextSyncPlanItem,
  type LensNextLifecycleState,
  type LensNextOpenWorkingViewRequest,
  type LensNextProjectOption,
  type LensNextStatus,
} from "./lens-next-types.ts";

function exactIdentityRank(issue: LensNextIssue, view: LensNextLocalInventory["viewpoints"][number]): number {
  if (!view.exactManagedIdentity || view.projectId !== issue.identity.projectId) return 0;
  if (view.serverId === issue.identity.serverId) return 3;
  if (view.bimlogPhysicalId && issue.bimlogPhysicalId && view.bimlogPhysicalId.toLowerCase() === issue.bimlogPhysicalId.toLowerCase()) return 2;
  if (view.displayId && issue.displayId && view.displayId.toLowerCase() === issue.displayId.toLowerCase()) return 1;
  return 0;
}

export function planLensNextSynchronization(
  platformSelection: readonly LensNextIssue[],
  local: LensNextLocalInventory | null,
  authoritativePlatformInventory: readonly LensNextIssue[] = platformSelection,
): LensNextSyncPlan {
  const items: LensNextSyncPlanItem[] = [];
  const claimedLocal = new Set<number>();
  const selectedServerIds = new Set(platformSelection.map((issue) => issue.identity.serverId));
  const topCandidates = authoritativePlatformInventory.map((issue) => {
    if (!local) return [] as number[];
    const ranked = local.viewpoints.map((view, index) => ({ index, rank: exactIdentityRank(issue, view) })).filter((candidate) => candidate.rank > 0);
    const highest = ranked.reduce((value, candidate) => Math.max(value, candidate.rank), 0);
    return ranked.filter((candidate) => candidate.rank === highest).map((candidate) => candidate.index);
  });
  const localClaimCounts = new Map<number, number>();
  topCandidates.flat().forEach((index) => localClaimCounts.set(index, (localClaimCounts.get(index) ?? 0) + 1));

  authoritativePlatformInventory.forEach((issue, platformIndex) => {
    const candidates = topCandidates[platformIndex];
    const displayId = issue.displayId ?? issue.identity.viewpointId;
    const selected = selectedServerIds.has(issue.identity.serverId);
    if (candidates.length === 1 && localClaimCounts.get(candidates[0]) === 1 && local) {
      const view = local.viewpoints[candidates[0]];
      claimedLocal.add(candidates[0]);
      if (selected && issue.navisworksGuid && issue.navisworksGuid.toLowerCase() !== view.navisworksGuid.toLowerCase()) {
        items.push(Object.freeze({ disposition: "manual_conflict", platformServerId: issue.identity.serverId, localNavisworksGuid: view.navisworksGuid, displayId, reason: "BIMLog and the exact managed local viewpoint disagree on Navisworks GUID; automatic replacement is prohibited." }));
      } else if (selected && !issue.navisworksGuid && issue.identity.lifecycleStatus === "active" && issue.visualStateAvailable && issue.visualStateDigest) {
        items.push(Object.freeze({ disposition: "confirm_local_identity", platformServerId: issue.identity.serverId, localNavisworksGuid: view.navisworksGuid, displayId, reason: "The exact managed Saved Viewpoint exists locally, but BIMLog still needs its GUID confirmation." }));
      } else if (selected && !issue.navisworksGuid) {
        items.push(Object.freeze({ disposition: "blocked", platformServerId: issue.identity.serverId, localNavisworksGuid: view.navisworksGuid, displayId, reason: "The local identity cannot be confirmed because the active BIMLog visual package is incomplete or unavailable." }));
      } else if (selected) items.push(Object.freeze({ disposition: "in_sync", platformServerId: issue.identity.serverId, localNavisworksGuid: view.navisworksGuid, displayId, reason: "One exact managed identity exists in BIMLog and Navisworks." }));
    } else if (candidates.length > 0) {
      candidates.forEach((index) => claimedLocal.add(index));
      if (selected) items.push(Object.freeze({ disposition: "manual_conflict", platformServerId: issue.identity.serverId, localNavisworksGuid: null, displayId, reason: "Exact identity is not one-to-one; automatic reconciliation is prohibited." }));
    } else if (selected && issue.navisworksGuid) {
      items.push(Object.freeze({ disposition: "manual_conflict", platformServerId: issue.identity.serverId, localNavisworksGuid: null, displayId, reason: "BIMLog records a Navisworks GUID that is absent from this model; replacing that identity requires manual recovery." }));
    } else if (selected && issue.identity.lifecycleStatus === "active" && issue.visualStateAvailable && issue.visualStateDigest) {
      items.push(Object.freeze({ disposition: "pull_from_bimlog", platformServerId: issue.identity.serverId, localNavisworksGuid: null, displayId, reason: "BIMLog has the authoritative visual package and Navisworks has no exact managed viewpoint." }));
    } else if (selected) {
      items.push(Object.freeze({ disposition: "blocked", platformServerId: issue.identity.serverId, localNavisworksGuid: null, displayId, reason: "BIMLog has no visual package to reconstruct this viewpoint." }));
    }
  });

  local?.viewpoints.forEach((view, index) => {
    if (claimedLocal.has(index)) return;
    items.push(Object.freeze({
      disposition: view.exactManagedIdentity ? "upload_to_bimlog" : "blocked",
      platformServerId: null,
      localNavisworksGuid: view.navisworksGuid,
      displayId: view.displayId ?? view.displayName,
      reason: view.exactManagedIdentity
        ? "An exact Original Lens-managed viewpoint exists only in Navisworks."
        : "The local viewpoint lacks exact BIMLog-managed identity.",
    }));
  });

  const count = (disposition: LensNextSyncPlanItem["disposition"]) => items.filter((item) => item.disposition === disposition).length;
  const manualConflict = count("manual_conflict");
  const blocked = count("blocked");
  const pullFromBimlog = count("pull_from_bimlog");
  const uploadToBimlog = count("upload_to_bimlog");
  const confirmLocalIdentity = count("confirm_local_identity");
  return Object.freeze({
    items: Object.freeze(items), inSync: count("in_sync"), confirmLocalIdentity, pullFromBimlog,
    uploadToBimlog, manualConflict, blocked,
    executable: manualConflict === 0 && blocked === 0 && confirmLocalIdentity + pullFromBimlog + uploadToBimlog > 0,
  });
}

export function reconcileLensNextInventories(
  platform: readonly LensNextIssue[],
  local: LensNextLocalInventory | null,
): LensNextInventorySummary {
  if (!local) return Object.freeze({ matched: 0, platformOnly: platform.length, navisworksOnly: 0, conflicted: 0, unresolved: 0 });
  const unmatched = new Set(local.viewpoints.map((_, index) => index));
  let matched = 0;
  let platformOnly = 0;
  let conflicted = 0;
  for (const issue of platform) {
    const candidates = local.viewpoints.flatMap((view, index) => {
      if (!unmatched.has(index)) return [];
      const exactServer = view.serverId === issue.identity.serverId;
      const exactPhysical = Boolean(view.bimlogPhysicalId && issue.bimlogPhysicalId && view.bimlogPhysicalId.toLowerCase() === issue.bimlogPhysicalId.toLowerCase());
      const exactDisplay = Boolean(view.displayId && issue.displayId && view.displayId.toLowerCase() === issue.displayId.toLowerCase());
      return exactServer || exactPhysical || exactDisplay ? [index] : [];
    });
    if (candidates.length === 1 && local.viewpoints[candidates[0]].exactManagedIdentity) {
      unmatched.delete(candidates[0]);
      matched += 1;
    } else if (candidates.length > 0) {
      candidates.forEach((index) => unmatched.delete(index));
      conflicted += 1;
    } else {
      platformOnly += 1;
    }
  }
  let navisworksOnly = 0;
  let unresolved = 0;
  unmatched.forEach((index) => {
    if (local.viewpoints[index].exactManagedIdentity) navisworksOnly += 1;
    else unresolved += 1;
  });
  return Object.freeze({ matched, platformOnly, navisworksOnly, conflicted, unresolved });
}

const FORBIDDEN_IDENTITY_KEYS = new Set([
  "label",
  "name",
  "displayId",
  "folder",
  "folderPath",
  "path",
  "tree",
  "treeIndex",
  "activeView",
  "activeViewpoint",
]);
const IDENTITY_KEYS = [
  "projectId",
  "serverId",
  "viewpointId",
  "lifecycleStatus",
  "revisionNumber",
] as const;

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return positiveInteger(value, label);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = nonEmptyString(value, "timestamp");
  if (Number.isNaN(Date.parse(text)))
    throw new Error("timestamp must be an ISO-compatible date");
  return text;
}

function lensStatus(value: unknown): LensNextStatus {
  const status = nonEmptyString(value, "status") as LensNextStatus;
  if (!(LENS_NEXT_STATUSES as readonly string[]).includes(status))
    throw new Error(`unsupported Lens status: ${status}`);
  return status;
}

function lifecycleStatus(value: unknown): LensNextLifecycleState {
  const status = nonEmptyString(
    value,
    "lifecycleStatus",
  ) as LensNextLifecycleState;
  if (!(LENS_NEXT_LIFECYCLE_STATES as readonly string[]).includes(status)) {
    throw new Error(`unsupported Lens lifecycle state: ${status}`);
  }
  return status;
}

function safeThumbnailUrl(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  if (text.startsWith("/") || text.startsWith("data:image/")) return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function assertLensNextProjectId(value: unknown): number {
  return positiveInteger(value, "projectId");
}

export function normalizeLensNextProjects(
  value: readonly LensNextProjectOption[],
): LensNextProjectOption[] {
  const byId = new Map<number, LensNextProjectOption>();
  for (const candidate of value) {
    const id = assertLensNextProjectId(candidate.id);
    const name = nonEmptyString(candidate.name, "project name");
    if (!byId.has(id))
      byId.set(id, { id, name, code: nullableString(candidate.code) });
  }
  return [...byId.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id - b.id,
  );
}

export function assertAuthorizedLensNextProject(
  projectId: unknown,
  projects: readonly LensNextProjectOption[],
): number {
  const id = assertLensNextProjectId(projectId);
  if (!projects.some((project) => project.id === id))
    throw new Error("selected project is not in the authenticated project set");
  return id;
}

export function assertLensNextImmutableIdentity(
  value: unknown,
): LensNextImmutableIssueIdentity {
  const row = recordOf(value, "identity");
  for (const key of Object.keys(row)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key))
      throw new Error(`fallback identity key is forbidden: ${key}`);
    if (!(IDENTITY_KEYS as readonly string[]).includes(key))
      throw new Error(`unknown identity key is forbidden: ${key}`);
  }
  for (const key of IDENTITY_KEYS) {
    if (!(key in row)) throw new Error(`identity.${key} is required`);
  }
  return Object.freeze({
    projectId: positiveInteger(row.projectId, "identity.projectId"),
    serverId: positiveInteger(row.serverId, "identity.serverId"),
    viewpointId: nonEmptyString(row.viewpointId, "identity.viewpointId"),
    lifecycleStatus: lifecycleStatus(row.lifecycleStatus),
    revisionNumber: positiveInteger(
      row.revisionNumber,
      "identity.revisionNumber",
    ),
  });
}

function adaptLensIssue(
  value: unknown,
  expectedProjectId: number,
  publishingAllowed = false,
): LensNextIssue {
  const row = recordOf(value, "Lens viewpoint");
  const projectId = positiveInteger(row.projectId, "viewpoint.projectId");
  if (projectId !== expectedProjectId)
    throw new Error("lens-pull returned a row for a different project");
  const priority =
    row.priority === null || row.priority === undefined
      ? null
      : positiveInteger(row.priority, "priority");
  if (priority !== null && priority > 5)
    throw new Error("priority must be between 1 and 5");
  return Object.freeze({
    identity: assertLensNextImmutableIdentity({
      projectId,
      serverId: row.id,
      viewpointId: row.viewpointId,
      lifecycleStatus: row.lifecycleStatus,
      revisionNumber: row.revisionNumber,
    }),
    mutationVersion: positiveInteger(row.mutationVersion ?? 1, "mutationVersion"),
    publishingAllowed,
    displayId: nullableString(row.displayId),
    navisworksGuid: nullableString(row.navisworksGuid),
    bimlogPhysicalId: nullableString(row.bimlogPhysicalId),
    issueGroupId: nullableString(row.issueGroupId),
    note: nullableString(row.note),
    openItems: nullableString(row.openItems),
    trade: nullableString(row.trade),
    floor: nullableString(row.floor),
    responsibleCompany: nullableString(row.responsibleCompany),
    reportType: nullableString(row.reportType),
    priority,
    status: lensStatus(row.status),
    capturedAt: nullableTimestamp(row.capturedAt),
    syncedAt: nullableTimestamp(row.syncedAt),
    supersedesId: nullablePositiveInteger(row.supersedesId, "supersedesId"),
    supersedesCode: nullableString(row.supersedesCode),
    // Null is an intentional, honest state when no verified capture exists;
    // never fabricate or derive an image from unrelated model metadata.
    screenshotUrl: safeThumbnailUrl(row.screenshotUrl),
    visualStateAvailable: row.visualStateAvailable === true,
    visualStateDigest: nullableString(row.visualStateDigest),
  });
}

export function adaptLensNextPullResponse(
  value: unknown,
  expectedProjectId: number,
): LensNextIssue[] {
  const body = recordOf(value, "lens-pull response");
  if (body.success !== true || !Array.isArray(body.viewpoints))
    throw new Error("invalid lens-pull response");
  const publishing = body.publishing && typeof body.publishing === "object" && !Array.isArray(body.publishing)
    ? body.publishing as Record<string, unknown> : null;
  const publishingAllowed = publishing?.contractVersion === "lens-next-publish.v1" && publishing.allowed === true;
  const issues = body.viewpoints.map((row) =>
    adaptLensIssue(row, expectedProjectId, publishingAllowed),
  );
  const seen = new Set<number>();
  for (const issue of issues) {
    if (seen.has(issue.identity.serverId))
      throw new Error("lens-pull returned a duplicate server identity");
    seen.add(issue.identity.serverId);
  }
  return sortLensNextIssues(issues);
}

export function sortLensNextIssues(
  value: readonly LensNextIssue[],
): LensNextIssue[] {
  return [...value].sort((a, b) => {
    const priority = (a.priority ?? 99) - (b.priority ?? 99);
    if (priority !== 0) return priority;
    const captured =
      (b.capturedAt ? Date.parse(b.capturedAt) : 0) -
      (a.capturedAt ? Date.parse(a.capturedAt) : 0);
    if (captured !== 0) return captured;
    return a.identity.serverId - b.identity.serverId;
  });
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en-US");
}

export function filterLensNextIssues(
  value: readonly LensNextIssue[],
  filters: Readonly<LensNextFilters>,
): LensNextIssue[] {
  const query = normalized(filters.search);
  return value.filter((issue) => {
    if (filters.status !== "all" && issue.status !== filters.status)
      return false;
    if (
      filters.trade !== "all" &&
      normalized(issue.trade) !== normalized(filters.trade)
    )
      return false;
    if (
      filters.floor !== "all" &&
      normalized(issue.floor) !== normalized(filters.floor)
    )
      return false;
    if (filters.priority !== "all" && issue.priority !== filters.priority)
      return false;
    if (!query) return true;
    return [
      issue.identity.viewpointId,
      issue.displayId,
      issue.note,
      issue.openItems,
      issue.trade,
      issue.floor,
      issue.responsibleCompany,
      issue.reportType,
      issue.status,
    ].some((candidate) => normalized(candidate).includes(query));
  });
}

export function lensNextCollectionFingerprint(
  value: readonly LensNextIssue[],
): string {
  return JSON.stringify(
    [...value]
      .sort((a, b) => a.identity.serverId - b.identity.serverId)
      .map((issue) => [
        issue.identity.projectId,
        issue.identity.serverId,
        issue.identity.viewpointId,
        issue.identity.lifecycleStatus,
        issue.identity.revisionNumber,
        issue.mutationVersion,
        issue.navisworksGuid,
        issue.bimlogPhysicalId,
        issue.status,
        issue.priority,
        issue.trade,
        issue.floor,
        issue.note,
        issue.openItems,
        issue.responsibleCompany,
        issue.screenshotUrl,
        issue.visualStateAvailable,
        issue.visualStateDigest,
      ]),
  );
}

export function reconcileLensNextRefresh(
  current: readonly LensNextIssue[],
  incoming: readonly LensNextIssue[],
): readonly LensNextIssue[] {
  return lensNextCollectionFingerprint(current) ===
    lensNextCollectionFingerprint(incoming)
    ? current
    : incoming;
}

function adaptHistoryRevision(value: unknown): LensNextHistoryRevision {
  const row = recordOf(value, "history revision");
  return Object.freeze({
    serverId: positiveInteger(row.id, "history revision id"),
    revisionNumber: positiveInteger(
      row.revisionNumber,
      "history revision number",
    ),
    note: nullableString(row.note),
    trade: nullableString(row.trade),
    floor: nullableString(row.floor),
    lifecycleStatus: lifecycleStatus(row.lifecycleStatus),
    supersedesId: nullablePositiveInteger(
      row.supersedesId,
      "history supersedesId",
    ),
    updatedAt: nullableTimestamp(row.updatedAt),
    createdAt: nullableTimestamp(row.createdAt),
  });
}

function adaptHistoryEvent(value: unknown): LensNextHistoryEvent {
  const row = recordOf(value, "history event");
  return Object.freeze({
    id: positiveInteger(row.id, "history event id"),
    actionType: nonEmptyString(row.actionType, "history actionType"),
    entityId: positiveInteger(row.entityId, "history entityId"),
    before: nullableString(row.fileNameBefore),
    after: nullableString(row.fileNameAfter),
    details: nullableString(row.details),
    userFullName: nullableString(row.userFullName),
    userCompanyName: nullableString(row.userCompanyName),
    createdAt: nullableTimestamp(row.createdAt),
  });
}

export function adaptLensNextHistoryResponse(
  value: unknown,
  identity: LensNextImmutableIssueIdentity,
): LensNextHistory {
  const exactIdentity = assertLensNextImmutableIdentity(identity);
  const body = recordOf(value, "Lens history response");
  if (
    body.success !== true ||
    !Array.isArray(body.chain) ||
    !Array.isArray(body.events)
  ) {
    throw new Error("invalid Lens history response");
  }
  const revisions = body.chain.map(adaptHistoryRevision);
  if (
    !revisions.some((revision) => revision.serverId === exactIdentity.serverId)
  ) {
    throw new Error(
      "history response does not contain the requested immutable server identity",
    );
  }
  return Object.freeze({
    revisions,
    events: body.events.map(adaptHistoryEvent),
  });
}

export function createLensNextOpenWorkingViewRequest(
  identity: unknown,
  context: LensNextBridgeProjectContext,
  physicalIdentity: {
    bimlogPhysicalId: string | null;
    navisworksGuid: string | null;
  },
  requestId: string,
): LensNextOpenWorkingViewRequest {
  const exactIdentity = assertLensNextImmutableIdentity(identity);
  const exactContext = recordOf(context, "bridge project context");
  const sessionId = nonEmptyString(exactContext.sessionId, "bridge sessionId");
  const contextProjectId = positiveInteger(
    exactContext.projectId,
    "bridge projectId",
  );
  if (contextProjectId !== exactIdentity.projectId) {
    throw new Error("bridge project context does not match the issue project");
  }
  const modelFingerprint = nonEmptyString(
    exactContext.modelFingerprint,
    "bridge modelFingerprint",
  );
  const exactRequestId = nonEmptyString(requestId, "requestId");
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(exactRequestId))
    throw new Error("requestId has an invalid format");
  return Object.freeze({
    protocolVersion: 1,
    command: "open-working-view",
    requestId: exactRequestId,
    idempotencyKey: exactRequestId,
    fields: Object.freeze({
      sessionId,
      projectId: String(exactIdentity.projectId),
      serverId: String(exactIdentity.serverId),
      viewpointId: exactIdentity.viewpointId,
      lifecycleStatus: exactIdentity.lifecycleStatus,
      revisionNumber: String(exactIdentity.revisionNumber),
      modelFingerprint,
      ...(physicalIdentity.bimlogPhysicalId
        ? { bimlogPhysicalId: physicalIdentity.bimlogPhysicalId }
        : {}),
      ...(physicalIdentity.navisworksGuid
        ? { navisworksGuid: physicalIdentity.navisworksGuid }
        : {}),
    }),
  });
}
