export type VisualPackageTruth =
  | { state: "absent"; available: false; digest: null }
  | { state: "complete"; available: true; digest: string }
  | { state: "invalid_partial"; available: false; digest: string | null };

export function classifyVisualPackageTruth(input: { visualStateJson?: string | null; visualStateDigest?: string | null }): VisualPackageTruth {
  const hasJson = Boolean(input.visualStateJson);
  const digest = typeof input.visualStateDigest === "string" && /^[a-f0-9]{64}$/i.test(input.visualStateDigest.trim())
    ? input.visualStateDigest.trim().toLowerCase()
    : null;
  if (!hasJson && !input.visualStateDigest) return { state: "absent", available: false, digest: null };
  if (hasJson && digest) return { state: "complete", available: true, digest };
  return { state: "invalid_partial", available: false, digest };
}

export function requireCompleteVisualPackage(input: { visualStateJson?: string | null; visualStateDigest?: string | null }): { visualStateJson: string; visualStateDigest: string } {
  const truth = classifyVisualPackageTruth(input);
  if (truth.state !== "complete") throw new Error(truth.state === "absent" ? "VISUAL_PACKAGE_REQUIRED" : "VISUAL_PACKAGE_PARTIAL");
  return { visualStateJson: input.visualStateJson!, visualStateDigest: truth.digest };
}

export function presentLensReferenceAttachment(projectId: number, item: {
  linkId: number;
  fileId: number;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: Date | null;
}) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0 || !Number.isSafeInteger(item.fileId) || item.fileId <= 0) {
    throw new Error("REFERENCE_IDENTITY_INVALID");
  }
  return { ...item, fileSize: item.fileSize ?? 0, downloadUrl: `/api/v1/projects/${projectId}/files/${item.fileId}/download` };
}
