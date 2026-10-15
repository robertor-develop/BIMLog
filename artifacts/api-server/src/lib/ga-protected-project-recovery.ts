import { GA_PROTECTED_PROJECTS } from "./ga-protected-projects";

export type ProtectedProjectSnapshot = {
  id: number;
  code: string;
  name: string;
  status: string;
  memberCount: number;
  fileCount: number;
  recordCounts?: Record<string, number>;
};

export type ProtectedProjectRecoveryCheck = {
  projectId: number;
  code: string;
  active: boolean;
  identityMatches: boolean;
  restorationRequired: boolean;
  issues: string[];
};

export function checkProtectedProjectRecovery(snapshots: ProtectedProjectSnapshot[]): ProtectedProjectRecoveryCheck[] {
  const byId = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
  return GA_PROTECTED_PROJECTS.map(expected => {
    const actual = byId.get(expected.id);
    const issues: string[] = [];
    if (!actual) issues.push("missing_from_authoritative_roster");
    if (actual && actual.code !== expected.code) issues.push("code_mismatch");
    if (actual && actual.name.trim() !== expected.name) issues.push("name_mismatch");
    if (actual && actual.status !== "active") issues.push("not_active");
    if (actual && actual.memberCount < 1) issues.push("membership_missing");
    return {
      projectId: expected.id,
      code: expected.code,
      active: actual?.status === "active",
      identityMatches: Boolean(actual && actual.code === expected.code && actual.name.trim() === expected.name),
      restorationRequired: Boolean(actual && actual.status !== "active"),
      issues,
    };
  });
}
