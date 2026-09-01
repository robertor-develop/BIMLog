import { normalizeJobIntakeData } from "./job-intake-contract";
import { summarizeJobCommandCenter } from "./job-command-center";

export function previewIntakeCompatibility(raw: unknown, documents: unknown[] = []) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, any> : {};
  const normalized = normalizeJobIntakeData(source);
  const secondPass = normalizeJobIntakeData(normalized);
  const additions: string[] = [];
  if (!source.relationships) additions.push("RELATIONSHIP_CONTAINER_DEFAULTED");
  if (!Array.isArray(source.commercial?.contracts)) additions.push("PRIMARY_AGREEMENT_DERIVED");
  if (!Array.isArray(source.apuDrafts)) additions.push("APU_COLLECTION_DEFAULTED");
  if (!Array.isArray(source.workPackages)) additions.push("WORK_PACKAGE_COLLECTION_DEFAULTED");
  if (!Array.isArray(source.resourcePlans)) additions.push("RESOURCE_PLAN_COLLECTION_DEFAULTED");
  const summary = summarizeJobCommandCenter(normalized, documents);
  return {
    mode: additions.length ? "legacy_preview" : "current_format",
    additions,
    idempotent: JSON.stringify(normalized) === JSON.stringify(secondPass),
    preserved: {
      scopeItems: Array.isArray(source.scopeItems) ? source.scopeItems.length === normalized.scopeItems.length : true,
      assignments: Array.isArray(source.team?.assignments) ? source.team.assignments.length === normalized.team.assignments.length : true,
      agreements: Array.isArray(source.commercial?.contracts) ? source.commercial.contracts.length === normalized.commercial.contracts.length : true,
    },
    counts: summary.counts,
    attention: summary.attention,
    ready: summary.ready && JSON.stringify(normalized) === JSON.stringify(secondPass),
    normalized,
  };
}
