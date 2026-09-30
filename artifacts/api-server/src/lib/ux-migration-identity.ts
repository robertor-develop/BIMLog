import { createHash } from "node:crypto";

export type MigrationIdentity = Readonly<{
  entity: string;
  sourceId: string;
  targetId: string | null;
  sourceFingerprint: string;
  targetFingerprint: string | null;
  displayName: string;
}>;

export type MigrationIdentityDecision = Readonly<{
  sourceId: string;
  targetId: string;
  reviewedBy: string;
  reviewedAt: string;
  reason: string;
}>;

export type MigrationIdentityDryRun = Readonly<{
  status: "review_required" | "ready";
  mappings: readonly Readonly<{ sourceId: string; targetId: string; basis: "explicit_review" | "stable_identity" }>[];
  collisions: readonly Readonly<{ sourceId: string; candidateTargetIds: readonly string[]; reason: string }>[];
  unmappedSourceIds: readonly string[];
  digest: string;
  writesPerformed: 0;
}>;

const stable = (value: unknown) => JSON.stringify(value, Object.keys(value as object).sort());

export function migrationIdentityDryRun(
  source: readonly MigrationIdentity[],
  target: readonly MigrationIdentity[],
  decisions: readonly MigrationIdentityDecision[],
): MigrationIdentityDryRun {
  const targetsById = new Map(target.map((item) => [item.targetId ?? item.sourceId, item]));
  const decisionsBySource = new Map(decisions.map((decision) => [decision.sourceId, decision]));
  const mappings: Array<{ sourceId: string; targetId: string; basis: "explicit_review" | "stable_identity" }> = [];
  const collisions: Array<{ sourceId: string; candidateTargetIds: string[]; reason: string }> = [];
  const unmappedSourceIds: string[] = [];

  for (const item of source) {
    const decision = decisionsBySource.get(item.sourceId);
    if (decision) {
      if (!decision.reviewedBy.trim() || !decision.reason.trim() || Number.isNaN(Date.parse(decision.reviewedAt))) {
        collisions.push({ sourceId: item.sourceId, candidateTargetIds: [decision.targetId], reason: "review_evidence_invalid" });
      } else if (!targetsById.has(decision.targetId)) {
        collisions.push({ sourceId: item.sourceId, candidateTargetIds: [decision.targetId], reason: "reviewed_target_missing" });
      } else {
        mappings.push({ sourceId: item.sourceId, targetId: decision.targetId, basis: "explicit_review" });
      }
      continue;
    }

    const exact = target.filter((candidate) => candidate.entity === item.entity && candidate.sourceId === item.sourceId);
    if (exact.length === 1) {
      mappings.push({ sourceId: item.sourceId, targetId: exact[0].targetId ?? exact[0].sourceId, basis: "stable_identity" });
      continue;
    }
    if (exact.length > 1) {
      collisions.push({ sourceId: item.sourceId, candidateTargetIds: exact.map((candidate) => candidate.targetId ?? candidate.sourceId).sort(), reason: "stable_identity_collision" });
      continue;
    }

    // Display names and filenames are deliberately never identity evidence.
    unmappedSourceIds.push(item.sourceId);
  }

  const body = { mappings: [...mappings].sort((a, b) => a.sourceId.localeCompare(b.sourceId)), collisions: [...collisions].sort((a, b) => a.sourceId.localeCompare(b.sourceId)), unmappedSourceIds: [...unmappedSourceIds].sort() };
  return Object.freeze({
    status: body.collisions.length || body.unmappedSourceIds.length ? "review_required" : "ready",
    ...body,
    digest: createHash("sha256").update(stable(body)).digest("hex"),
    writesPerformed: 0,
  });
}
