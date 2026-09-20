export const DATA_LIFECYCLE = Object.freeze({
  audit_evidence: { exportable: true, correctable: false, archivable: true, deletable: false, immutable: true },
  project_records: { exportable: true, correctable: true, archivable: true, deletable: false, immutable: false },
  uploaded_files: { exportable: true, correctable: false, archivable: true, deletable: true, immutable: false },
  feedback_evidence: { exportable: true, correctable: false, archivable: true, deletable: true, immutable: false },
  release_receipts: { exportable: true, correctable: false, archivable: true, deletable: false, immutable: true },
} as const);

export type DataClass = keyof typeof DATA_LIFECYCLE;
export type LifecycleAction = "export" | "correct" | "archive" | "delete";

export function authorizeLifecycleAction(dataClass: DataClass, action: LifecycleAction, input: { authorized: boolean; retentionHold: boolean }) {
  if (!input.authorized) return { allow: false, code: "LIFECYCLE_AUTHORITY_REQUIRED" } as const;
  const policy = DATA_LIFECYCLE[dataClass];
  if (action === "delete" && input.retentionHold) return { allow: false, code: "RETENTION_HOLD_ACTIVE" } as const;
  const allowed = action === "export" ? policy.exportable : action === "correct" ? policy.correctable : action === "archive" ? policy.archivable : policy.deletable;
  return allowed ? { allow: true, code: "LIFECYCLE_ACTION_ALLOWED" } as const : { allow: false, code: policy.immutable ? "IMMUTABLE_EVIDENCE_PRESERVED" : "LIFECYCLE_ACTION_DENIED" } as const;
}
