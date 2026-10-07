const SHA40 = /^[0-9a-f]{40}$/;

export type ProductionSourceCandidate = {
  headCommit: string;
  headTree: string;
  remoteMasterCommit?: string;
  remoteMasterTree?: string;
  remoteMasterIsAncestor?: boolean;
  acceptedCommit?: string;
  replitEnvironment: boolean;
  headSubject?: string;
  parentCommit?: string;
  parentTree?: string;
};

export type ProductionCommitIdentity = { commit: string; tree: string; subject: string };

export function unwrapReplitPublishChain(chain: readonly ProductionCommitIdentity[]): ProductionCommitIdentity {
  if (!chain.length) throw new Error("Remote master history is empty.");
  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index];
    if (!SHA40.test(current.commit.trim().toLowerCase())) throw new Error("Remote master history contains an invalid commit.");
    if (current.subject.trim() !== "Published your App") return current;
    const parent = chain[index + 1];
    if (!parent) throw new Error("Replit publish wrapper chain has no canonical parent.");
    if (current.tree.trim().toLowerCase() !== parent.tree.trim().toLowerCase()) {
      throw new Error("Replit publish wrapper chain changes the canonical source tree.");
    }
  }
  throw new Error("Replit publish wrapper chain has no canonical source.");
}

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
  if (!SHA40.test(remoteCommit)) throw new Error("Replit publication requires an exact accepted remote commit.");
  const acceptedCommit = candidate.acceptedCommit?.trim().toLowerCase();
  if (acceptedCommit && (!SHA40.test(acceptedCommit) || acceptedCommit !== remoteCommit)) {
    throw new Error("Accepted production commit differs from the verified remote branch.");
  }
  if (!candidate.remoteMasterIsAncestor) throw new Error("Replit publication HEAD is not descended from the accepted remote source.");
  if (candidate.headTree.trim().toLowerCase() !== candidate.remoteMasterTree?.trim().toLowerCase()) {
    throw new Error("Replit publication HEAD differs from the verified accepted remote source tree.");
  }
  return remoteCommit;
}
