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
const setupModeKey = (projectId: number) => `bimlog:job-intake-setup-mode:${projectId}`;

export type JobIntakeRecovery<T = any> = {
  revision: number;
  data: T;
  preservedAt?: string;
};

export function resolveJobIntakeRecovery<T>(
  serverRevision: number,
  serverData: T,
  recovered: JobIntakeRecovery<T> | null,
) {
  const resume = recovered?.revision === serverRevision && JSON.stringify(recovered.data) !== JSON.stringify(serverData);
  return {
    resume,
    data: resume ? recovered!.data : serverData,
    discardStale: Boolean(recovered && recovered.revision < serverRevision),
  };
}

export function readJobIntakeRecovery(projectId: number): JobIntakeRecovery | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recoveryKey(projectId)) || "null");
    return parsed && typeof parsed === "object" && Number.isInteger(parsed.revision) && parsed.data && typeof parsed.data === "object"
      ? parsed as JobIntakeRecovery
      : null;
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
  try { return window.localStorage.getItem(setupModeKey(projectId)) === "advanced" ? "advanced" : "quick"; }
  catch { return "quick"; }
}

export function preserveJobIntakeSetupMode(projectId: number, mode: JobIntakeSetupMode) {
  try { window.localStorage.setItem(setupModeKey(projectId), mode); } catch { /* mode switching stays usable */ }
}

export function readJobIntakeActiveStage(projectId: number): JobIntakeStage {
  if (!Number.isInteger(projectId) || projectId <= 0) return "documents";
  try {
    const saved = window.localStorage.getItem(activeStageKey(projectId));
    return jobIntakeStages.includes(saved as JobIntakeStage) ? saved as JobIntakeStage : "documents";
  } catch {
    return "documents";
  }
}

export function preserveJobIntakeActiveStage(projectId: number, stage: JobIntakeStage) {
  if (!Number.isInteger(projectId) || projectId <= 0) return;
  try { window.localStorage.setItem(activeStageKey(projectId), stage); } catch { /* navigation stays usable */ }
}
