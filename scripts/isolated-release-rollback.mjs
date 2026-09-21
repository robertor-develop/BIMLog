import fs from "node:fs";
import path from "node:path";

export function decideIsolatedRollback(input) {
  if (!input?.target?.disposable || input.target.production) return { action: "STOP", code: "TARGET_NOT_DISPOSABLE" };
  if (!input.candidate?.commit || !input.previous?.commit || input.candidate.commit === input.previous.commit)
    return { action: "STOP", code: "RELEASE_IDENTITIES_INVALID" };
  if (input.observedCommit !== input.candidate.commit) return { action: "STOP", code: "CANDIDATE_IDENTITY_CHANGED" };
  if (input.candidate.healthy) return { action: "KEEP_CANDIDATE", commit: input.candidate.commit };
  if (!input.previous.healthy) return { action: "STOP", code: "ROLLBACK_TARGET_UNHEALTHY" };
  return { action: "ROLLBACK", commit: input.previous.commit };
}

export function rehearseIsolatedRollback(root, input) {
  if (!path.basename(root).startsWith("bimlog-release-rollback-")) throw new Error("rollback rehearsal root must be disposable");
  fs.mkdirSync(root, { recursive: true });
  const pointer = path.join(root, "current-release.txt");
  fs.writeFileSync(pointer, `${input.candidate.commit}\n`, { flag: "wx" });
  const decision = decideIsolatedRollback(input);
  if (decision.action === "ROLLBACK") fs.writeFileSync(pointer, `${decision.commit}\n`);
  const observed = fs.readFileSync(pointer, "utf8").trim();
  if ((decision.action === "ROLLBACK" || decision.action === "KEEP_CANDIDATE") && observed !== decision.commit)
    throw new Error("isolated rollback pointer verification failed");
  return { ...decision, observed };
}
