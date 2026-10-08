export const jobIntakeStages = [
  "documents",
  "identity",
  "contract",
  "scope",
  "delivery",
  "team",
  "review",
] as const;

export type JobIntakeStage = (typeof jobIntakeStages)[number];
export type JobIntakeSetupMode = "quick" | "advanced";

export const blankJobIntakeData = {
  identity: {
    jobName: "",
    jobCode: "",
    clientName: "",
    clientCompany: "",
    location: "",
    currency: "USD",
    primaryContact: "",
    startDate: "",
    targetCompletionDate: "",
  },
  scopeItems: [] as any[],
  commercial: {
    contracts: [
      {
        id: "PRIMARY",
        title: "",
        quotationNumber: "",
        contractNumber: "",
        counterpartyName: "",
        perspective: "downstream",
        contractType: "subcontract",
        reportingType: "base_contract",
        reportingStatus: "work_in_progress",
        paymentTerms: "",
        effectiveDate: "",
        completionDate: "",
      },
    ],
    title: "",
    quotationNumber: "",
    contractNumber: "",
    counterpartyName: "",
    perspective: "downstream",
    contractType: "subcontract",
    budgetSnapshotId: "",
    paymentTerms: "",
    effectiveDate: "",
    completionDate: "",
  },
  delivery: {
    workflowTemplate: "bim-submittal",
    submittalStrategy: "",
    milestoneSummary: "",
  },
  governance: { budgetPolicy: "standard" },
  team: {
    projectLeaderUserId: null as number | null,
    assignments: [] as any[],
  },
  review: {
    sourceConfirmed: false,
    scopeConfirmed: false,
    pricingConfirmed: false,
    contractConfirmed: false,
    deliveryConfirmed: false,
    teamConfirmed: false,
  },
};

const recoveryKey = (projectId: number) => `bimlog:job-intake-recovery:${projectId}`;
const activeStageKey = (projectId: number) => `bimlog:job-intake-active-stage:${projectId}`;
const activeItemKey = (projectId: number) => `bimlog:job-intake-active-item:${projectId}`;
const setupModeKey = (projectId: number) => `bimlog:job-intake-setup-mode:${projectId}`;

export type JobIntakeRecovery<T = any> = {
  revision: number;
  data: T;
  preservedAt?: string;
  repairedOptionalAllocations?: number;
};

const canonicalOptionalAllocation = (value: unknown) => {
  if (value == null || value === "") return { value: undefined, repaired: false };
  const text = String(value).trim();
  if (/^(?:0|[1-9]\d{0,23})(?:\.\d{1,6})?$/.test(text))
    return { value: text, repaired: false };
  if (!/^\d+(?:\.\d+)?$/.test(text)) return { value: undefined, repaired: true };
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric >= 1e24)
    return { value: undefined, repaired: true };
  const rounded = numeric.toFixed(6).replace(/\.?0+$/, "");
  return { value: rounded, repaired: true };
};

export function repairJobIntakeRecoveryData<T>(data: T) {
  if (!data || typeof data !== "object" || !Array.isArray((data as any).scopeItems))
    return { data, repairedOptionalAllocations: 0 };
  let repairedOptionalAllocations = 0;
  const scopeItems = (data as any).scopeItems.map((item: any) => {
    if (!item || typeof item !== "object" || !("productionAllocation" in item)) return item;
    const repaired = canonicalOptionalAllocation(item.productionAllocation);
    if (!repaired.repaired) return item;
    repairedOptionalAllocations += 1;
    const next = { ...item };
    if (repaired.value === undefined) delete next.productionAllocation;
    else next.productionAllocation = repaired.value;
    return next;
  });
  return repairedOptionalAllocations
    ? { data: { ...(data as any), scopeItems } as T, repairedOptionalAllocations }
    : { data, repairedOptionalAllocations };
}

export function jobIntakeIsCanonicalReadOnly(intake: { status?: string; activatedContractId?: unknown } | null | undefined) {
  return Boolean(jobIntakeIsActivated(intake) && intake?.activatedContractId);
}

export function jobIntakeIsActivated(intake: { status?: string; activation?: unknown } | null | undefined) {
  return Boolean(intake?.status === "activated" || intake?.activation);
}

export function resolveJobIntakeRecovery<T>(
  serverRevision: number,
  serverData: T,
  recovered: JobIntakeRecovery<T> | null,
  readOnly = false,
) {
  const sameRevision = recovered?.revision === serverRevision;
  const sameData = Boolean(recovered && JSON.stringify(recovered.data) === JSON.stringify(serverData));
  const resume = Boolean(!readOnly && recovered && sameRevision && !sameData);
  return {
    resume,
    data: resume ? recovered!.data : serverData,
    discardStale: Boolean(!readOnly && recovered && recovered.revision < serverRevision),
    retainNewer: Boolean(!readOnly && recovered && recovered.revision > serverRevision),
    reason: readOnly && recovered ? "read_only" : !recovered ? "none" : resume ? "same_revision_draft" : recovered.revision < serverRevision ? "stale_server_wins" : recovered.revision > serverRevision ? "newer_draft_retained" : "already_saved",
  };
}

export function readJobIntakeRecovery(projectId: number): JobIntakeRecovery | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recoveryKey(projectId)) || "null");
    if (!(parsed && typeof parsed === "object" && Number.isInteger(parsed.revision) && parsed.data && typeof parsed.data === "object"))
      return null;
    const repaired = repairJobIntakeRecoveryData(parsed.data);
    return { ...parsed, data: repaired.data, repairedOptionalAllocations: repaired.repairedOptionalAllocations } as JobIntakeRecovery;
  } catch {
    return null;
  }
}

export function preserveJobIntakeRecovery(projectId: number, revision: number, data: unknown) {
  try {
    window.localStorage.setItem(recoveryKey(projectId), JSON.stringify({ revision, data, preservedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clearMatchingJobIntakeRecovery(projectId: number, data: unknown) {
  const recovered = readJobIntakeRecovery(projectId);
  if (recovered && JSON.stringify(recovered.data) === JSON.stringify(data)) {
    try { window.localStorage.removeItem(recoveryKey(projectId)); } catch { /* server save remains authoritative */ }
  }
}

export function removeJobIntakeRecovery(projectId: number) {
  try { window.localStorage.removeItem(recoveryKey(projectId)); } catch { /* unreadable browser storage is ignored */ }
}

export function readJobIntakeSetupMode(projectId: number): JobIntakeSetupMode {
  // Legacy quick drafts use the same payload; always resume in the full setup.
  return "advanced";
}

export function preserveJobIntakeSetupMode(projectId: number, mode: JobIntakeSetupMode) {
  try { window.localStorage.setItem(setupModeKey(projectId), mode); } catch { /* mode switching stays usable */ }
}

export function readJobIntakeActiveStage(projectId: number): JobIntakeStage {
  if (!Number.isInteger(projectId) || projectId <= 0) return "identity";
  try {
    const stage = new URLSearchParams(window.location?.search).get("stage");
    if (jobIntakeStages.includes(stage as JobIntakeStage)) return stage as JobIntakeStage;
    const saved = window.localStorage.getItem(activeStageKey(projectId));
    return jobIntakeStages.includes(saved as JobIntakeStage) ? saved as JobIntakeStage : "identity";
  } catch {
    return "identity";
  }
}

export function preserveJobIntakeActiveStage(projectId: number, stage: JobIntakeStage) {
  if (!Number.isInteger(projectId) || projectId <= 0) return;
  try { window.localStorage.setItem(activeStageKey(projectId), stage); } catch { /* navigation stays usable */ }
}

export function readJobIntakeActiveItem(projectId: number) {
  try {
    const fromUrl = new URLSearchParams(window.location?.search).get("item");
    if (fromUrl && /^ji-[a-zA-Z0-9_-]{1,100}$/.test(fromUrl)) return fromUrl;
    const saved = window.localStorage.getItem(activeItemKey(projectId));
    return saved && /^ji-[a-zA-Z0-9_-]{1,100}$/.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function preserveJobIntakeActiveItem(projectId: number, item: string | null) {
  if (!Number.isInteger(projectId) || projectId <= 0 || !item || !/^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) return;
  try { window.localStorage.setItem(activeItemKey(projectId), item); } catch { /* navigation stays usable */ }
}
