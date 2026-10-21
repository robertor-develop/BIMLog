import crypto from "node:crypto";

export type IntakeCustodyEnvelope = {
  tenantId: number; projectId: number; sourceId: string; sourceVersion: string;
  fileName: string; bytes: Buffer; declaredSha256: string;
  locator: { page?: number; sheet?: string; paragraph?: string };
  classification: string; confidence: number; duplicateOf?: string | null;
};

export function reviewIntakeCustody(input: IntakeCustodyEnvelope) {
  const actualSha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const errors: string[] = [];
  if (!input.tenantId || !input.projectId) errors.push("SCOPE_REQUIRED");
  if (!input.sourceId || !input.sourceVersion) errors.push("SOURCE_IDENTITY_REQUIRED");
  if (actualSha256 !== input.declaredSha256.toLowerCase()) errors.push("HASH_MISMATCH");
  if (!input.locator.page && !input.locator.sheet && !input.locator.paragraph) errors.push("EXACT_LOCATOR_REQUIRED");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) errors.push("CONFIDENCE_INVALID");
  return {
    state: errors.length ? "REQUIRES_HUMAN_REVIEW" as const : "READY_FOR_HUMAN_REVIEW" as const,
    actualSha256, errors, canonicalMutation: false as const,
    immutableHistoryKey: `${input.tenantId}:${input.projectId}:${input.sourceId}:${input.sourceVersion}:${actualSha256}`,
    duplicateDisposition: input.duplicateOf ? "LINK_EXISTING_VERSION" as const : "NEW_CANDIDATE" as const,
  };
}
