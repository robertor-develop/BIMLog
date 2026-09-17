import type { LensNextIssue } from "./lens-next-types";

export type LensNextImageStatus = "missing" | "loading" | "loaded" | "error";
export type LensNextImageLoad = { key: string; status: "loaded" | "error" };

export function lensNextCaptureKey(issue: Pick<LensNextIssue, "identity" | "mutationVersion" | "screenshotUrl">, attempt = 0): string {
  return `${issue.identity.projectId}:${issue.identity.serverId}:${issue.mutationVersion}:${issue.screenshotUrl ?? ""}:${attempt}`;
}

export function lensNextImageStatus(load: LensNextImageLoad | null, key: string, screenshotUrl: string | null): LensNextImageStatus {
  if (!screenshotUrl) return "missing";
  return load?.key === key ? load.status : "loading";
}
