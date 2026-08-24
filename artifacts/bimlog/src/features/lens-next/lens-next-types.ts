export const LENS_NEXT_STATUSES = [
  "open",
  "follow_up",
  "waiting_design",
  "approved",
  "resolved",
] as const;
export const LENS_NEXT_LIFECYCLE_STATES = [
  "active",
  "superseded",
  "voided",
] as const;

export type LensNextStatus = (typeof LENS_NEXT_STATUSES)[number];
export type LensNextLifecycleState =
  (typeof LENS_NEXT_LIFECYCLE_STATES)[number];
export type LensNextConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
export type LensNextRefreshState = "idle" | "refreshing" | "fresh" | "error";

export interface LensNextProjectOption {
  id: number;
  name: string;
  code?: string | null;
}

export interface LensNextImmutableIssueIdentity {
  projectId: number;
  serverId: number;
  viewpointId: string;
  lifecycleStatus: LensNextLifecycleState;
  revisionNumber: number;
}

export interface LensNextIssue {
  identity: LensNextImmutableIssueIdentity;
  mutationVersion: number;
  publishingAllowed: boolean;
  displayId: string | null;
  navisworksGuid: string | null;
  bimlogPhysicalId: string | null;
  issueGroupId: string | null;
  note: string | null;
  openItems: string | null;
  trade: string | null;
  floor: string | null;
  responsibleCompany: string | null;
  reportType: string | null;
  priority: number | null;
  status: LensNextStatus;
  capturedAt: string | null;
  syncedAt: string | null;
  supersedesId: number | null;
  supersedesCode: string | null;
  screenshotUrl: string | null;
  visualStateAvailable: boolean;
  visualStateDigest: string | null;
}

export type LensNextPublishAction =
  | { type: "status"; status: LensNextStatus }
  | { type: "comment"; comment: string }
  | { type: "assignment"; responsibleCompany: string };

export interface LensNextPublishResult {
  replayed: boolean;
  issue: {
    serverId: number;
    viewpointId: string;
    lifecycleStatus: LensNextLifecycleState;
    revisionNumber: number;
    mutationVersion: number;
    status: LensNextStatus;
    responsibleCompany: string | null;
  };
  receipt: { requestId: string; idempotencyKey: string; requestHash: string; actionType: LensNextPublishAction["type"]; recordedAt: string };
}

export interface LensNextFilters {
  search: string;
  status: LensNextStatus | "all";
  trade: string | "all";
  floor: string | "all";
  priority: number | "all";
}

export const LENS_NEXT_DEFAULT_FILTERS: Readonly<LensNextFilters> =
  Object.freeze({
    search: "",
    status: "all",
    trade: "all",
    floor: "all",
    priority: "all",
  });

export interface LensNextHistoryRevision {
  serverId: number;
  revisionNumber: number;
  note: string | null;
  trade: string | null;
  floor: string | null;
  lifecycleStatus: LensNextLifecycleState;
  supersedesId: number | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface LensNextHistoryEvent {
  id: number;
  actionType: string;
  entityId: number;
  before: string | null;
  after: string | null;
  details: string | null;
  userFullName: string | null;
  userCompanyName: string | null;
  createdAt: string | null;
}

export interface LensNextHistory {
  revisions: LensNextHistoryRevision[];
  events: LensNextHistoryEvent[];
}

export interface LensNextOpenWorkingViewRequest {
  protocolVersion: 1;
  command: "open-working-view";
  requestId: string;
  idempotencyKey: string;
  fields: LensNextOpenWorkingViewFields;
}

export interface LensNextBridgeProjectContext {
  sessionId: string;
  projectId: number;
  modelFingerprint: string;
  displayName: string | null;
}

export interface LensNextOpenWorkingViewFields {
  sessionId: string;
  projectId: string;
  serverId: string;
  viewpointId: string;
  lifecycleStatus: LensNextLifecycleState;
  revisionNumber: string;
  modelFingerprint: string;
  bimlogPhysicalId?: string;
  navisworksGuid?: string;
}

export interface LensNextOpenWorkingViewResult {
  opened: true;
  requestId: string;
  identity: LensNextImmutableIssueIdentity;
}
