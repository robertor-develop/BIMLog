const SHA40 = /^[0-9a-f]{40}$/;

export type ProductionSourceCandidate = {
  headCommit: string;
  headTree: string;
  remoteMasterCommit?: string;
  remoteMasterTree?: string;
  remoteMasterIsAncestor?: boolean;
  replitEnvironment: boolean;
  headSubject?: string;
  parentCommit?: string;
  parentTree?: string;
};

export function resolveProductionSourceCommit(candidate: ProductionSourceCandidate): string {
  const headCommit = candidate.headCommit.trim().toLowerCase();
  if (!SHA40.test(headCommit)) throw new Error("Build source commit is not a full Git commit.");
  if (candidate.headSubject?.trim() === "Published your App") {
    const parentCommit = candidate.parentCommit?.trim().toLowerCase() ?? "";
    if (!SHA40.test(parentCommit)) throw new Error("Replit publish wrapper requires an exact parent commit.");
    if (candidate.headTree.trim().toLowerCase() !== candidate.parentTree?.trim().toLowerCase()) {
      throw new Error("Replit publish wrapper changes the verified parent source tree.");
    }
    if (!candidate.replitEnvironment) return parentCommit;
  }
  if (!candidate.replitEnvironment) return headCommit;

  const remoteCommit = candidate.remoteMasterCommit?.trim().toLowerCase() ?? "";
  if (!SHA40.test(remoteCommit)) throw new Error("Replit publication requires an exact origin/master commit.");
  if (!candidate.remoteMasterIsAncestor) throw new Error("Replit publication HEAD is not descended from origin/master.");
  if (candidate.headTree.trim().toLowerCase() !== candidate.remoteMasterTree?.trim().toLowerCase()) {
    throw new Error("Replit publication HEAD differs from the verified origin/master source tree.");
  }
  return remoteCommit;
}
