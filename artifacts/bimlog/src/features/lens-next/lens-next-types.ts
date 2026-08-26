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
  projectId: number | null;
  modelFingerprint: string;
  modelBindingKey: string;
  displayName: string | null;
  bindingSource: "unbound" | "navisworks_bimlog_metadata" | "bimlog_model_registry";
  managedViewpointCount: number;
}

export interface LensNextLocalViewpoint {
  projectId: number;
  serverId: number | null;
  viewpointId: string;
  displayId: string | null;
  bimlogPhysicalId: string | null;
  navisworksGuid: string;
  displayName: string;
  folderPath: string;
  note?: string | null;
  trade?: string | null;
  responsibleCompany?: string | null;
  reportType?: string | null;
  floor?: string | null;
  priority?: number | null;
  openItems?: string | null;
  status?: LensNextStatus;
  exactManagedIdentity: boolean;
  lensNextPublished?: boolean;
}

export interface LensNextLocalInventory {
  projectId: number | null;
  modelFingerprint: string;
  modelBindingKey: string;
  viewpoints: readonly LensNextLocalViewpoint[];
}

export interface LensNextLocalCapture {
  localViewpoint: LensNextLocalViewpoint;
  visualState: Record<string, unknown>;
}

export interface LensNextLocalUploadReceipt {
  serverId: number;
  viewpointId: string;
  navisworksGuid: string;
  visualStateDigest: string;
}

export interface LensNextCreateDraft {
  trade: string; note: string; responsibleCompany: string; reportType: string;
  floor: string; priority: number; openItems: string; status: LensNextStatus;
}

export interface LensNextCreateReceipt {
  serverId: number; viewpointId: string; visualStateDigest: string;
  revisionNumber: number; lifecycleStatus: LensNextLifecycleState; displayCode: string;
}
export interface LensNextLayoutItem { navisworksGuid: string; folderPath: string; }
export interface LensNextLayoutReceipt { requested: number; moved: number; alreadyPlaced: number; }

export interface LensNextModelBindingResolution {
  projectId: number;
  modelBindingKey: string;
  source: "existing_registry" | "managed_metadata" | "unique_platform_identity";
}

export interface LensNextInventorySummary {
  matched: number;
  platformOnly: number;
  navisworksOnly: number;
  conflicted: number;
  unresolved: number;
}

export type LensNextSyncDisposition =
  | "in_sync"
  | "pull_from_bimlog"
  | "upload_to_bimlog"
  | "manual_conflict"
  | "blocked";

export interface LensNextSyncPlanItem {
  disposition: LensNextSyncDisposition;
  platformServerId: number | null;
  localNavisworksGuid: string | null;
  displayId: string;
  reason: string;
}

export interface LensNextSyncPlan {
  items: readonly LensNextSyncPlanItem[];
  inSync: number;
  pullFromBimlog: number;
  uploadToBimlog: number;
  manualConflict: number;
  blocked: number;
  executable: boolean;
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
