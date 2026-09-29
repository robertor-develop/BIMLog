import type { LensNextIssue, LensNextLinkedItem } from "./lens-next-types";
export function lensNextLinkedItemHref(issue: LensNextIssue, item: LensNextLinkedItem): string {
  const base=item.type==="rfi"?`/projects/${issue.identity.projectId}/rfis/${item.authoritativeId}`:`/projects/${issue.identity.projectId}/submittals/${item.authoritativeId}`;
  const back=new URLSearchParams({projectId:String(issue.identity.projectId),issueId:String(issue.identity.serverId),viewpointId:issue.identity.viewpointId,revision:String(issue.identity.revisionNumber)});
  return `${base}?from=${encodeURIComponent(`/lens-next?${back.toString()}`)}`;
}
