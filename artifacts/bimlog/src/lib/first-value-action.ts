export type FirstValueActionKind = "rfi" | "submittal" | "file";

export function chooseFirstValueAction(input: { workProfile: string | null; preferredDocumentTypes: string[] }): FirstValueActionKind {
  if (input.workProfile === "document_controller") return "file";
  if (input.preferredDocumentTypes.includes("Submittals")) return "submittal";
  if (input.preferredDocumentTypes.includes("RFIs")) return "rfi";
  if (input.workProfile === "field_team" || input.workProfile === "designer") return "rfi";
  return "submittal";
}

export function firstValueDestination(projectId: number, kind: FirstValueActionKind) {
  const tab = kind === "file" ? "files" : kind === "rfi" ? "rfis" : "submittals";
  return `/projects/${projectId}/${tab}`;
}
