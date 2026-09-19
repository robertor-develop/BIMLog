import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WINDOWS_APPROVED_ROOT = "F:\\BIMLog\\TestProof\\stabilization-program-20260919";

export function resolveProofRoot(purpose, configuredRoot) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(purpose)) throw new Error("Proof purpose must be a bounded lowercase identifier.");
  const approvedBase = process.platform === "win32"
    ? WINDOWS_APPROVED_ROOT
    : path.join(os.tmpdir(), "bimlog-testproof", "stabilization-program-20260919");
  const target = path.resolve(configuredRoot ?? path.join(approvedBase, purpose));
  const relative = path.relative(path.resolve(approvedBase), target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Proof root escaped the approved deterministic temporary location.");
  return target;
}

export function ensureProofRoot(purpose, configuredRoot) {
  const target = resolveProofRoot(purpose, configuredRoot);
  fs.mkdirSync(target, { recursive: true });
  if (fs.lstatSync(target).isSymbolicLink() || fs.realpathSync.native(target) !== target) {
    throw new Error("Proof root must be a real directory without a link boundary.");
  }
  return target;
}

export const approvedProofBase = process.platform === "win32"
  ? WINDOWS_APPROVED_ROOT
  : path.join(os.tmpdir(), "bimlog-testproof", "stabilization-program-20260919");
