import crypto from "node:crypto";

export type ReportPackageState = "generated" | "approved" | "delivered";
export type ReportPackageArtifact = { format: "pdf" | "xlsx"; sha256: string; bytes: number };
export type ReportPackageManifest = {
  id: string;
  tenantId: number;
  projectId: number;
  state: ReportPackageState;
  sourceVersions: readonly { sourceKey: string; version: number }[];
  artifacts: readonly ReportPackageArtifact[];
  approvedByUserId?: number;
  deliveredAt?: string;
};

export function createReportPackageManifest(input: Omit<ReportPackageManifest, "state">): ReportPackageManifest {
  if (!input.id.trim() || input.artifacts.length === 0) throw new Error("REPORT_PACKAGE_INCOMPLETE");
  for (const artifact of input.artifacts) {
    if (!/^[a-f0-9]{64}$/i.test(artifact.sha256) || artifact.bytes <= 0) throw new Error("REPORT_PACKAGE_ARTIFACT_INVALID");
  }
  return Object.freeze({ ...input, sourceVersions: Object.freeze(input.sourceVersions.map(item => Object.freeze({ ...item }))), artifacts: Object.freeze(input.artifacts.map(item => Object.freeze({ ...item }))), state: "generated" });
}

export function transitionReportPackage(manifest: ReportPackageManifest, target: Exclude<ReportPackageState, "generated">, input: { actorUserId: number; occurredAt: string }) {
  if (target === "approved" && manifest.state !== "generated") throw new Error("REPORT_PACKAGE_APPROVAL_ORDER_INVALID");
  if (target === "delivered" && manifest.state !== "approved") throw new Error("REPORT_PACKAGE_DELIVERY_REQUIRES_APPROVAL");
  const next = target === "approved"
    ? { ...manifest, state: target, approvedByUserId: input.actorUserId }
    : { ...manifest, state: target, deliveredAt: input.occurredAt };
  return { ...next, manifestFingerprint: crypto.createHash("sha256").update(JSON.stringify(next)).digest("hex") };
}
