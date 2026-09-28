import type { ResponsibilityWorkspaceItem } from "./responsibility-workspace";

const LABELS = {
  rfi: "Open RFI",
  submittal: "Open Submittal",
  meeting: "Open Meeting",
  schedule: "Open Schedule Item",
  lens: "Open Lens Issue",
} as const;

export function responsibilityActionRoute(item: ResponsibilityWorkspaceItem) {
  const expectedPrefix = `/projects/${item.project.id}/`;
  if (!item.authorizedLink.startsWith(expectedPrefix)) throw new Error("RESPONSIBILITY_ROUTE_SCOPE_INVALID");
  return {
    sourceActionKey: item.key,
    label: LABELS[item.sourceIdentity.module],
    openLink: item.authorizedLink,
    owningModule: item.sourceIdentity.module,
    mutationMode: "OWNING_MODULE_ONLY" as const,
    retrySafe: true,
    createsParallelTask: false,
    publishesDocument: false,
    publishUpdateMeaning: "Records the owning source update; it does not publish a document.",
    lensEvidenceLink: item.lensEvidence?.authorizedLink ?? null,
  };
}
