export type FolderWizardDestination = { canConfigure: boolean; credentials: { id: string; label: string }[];
  current: { siteId: string; libraryId: string; state: string } | null };

export function readFolderWizardDestination(value: unknown): FolderWizardDestination {
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item);
  const text = (item: unknown) => typeof item === "string" && item.length > 0 && item.length <= 1024;
  if (!object(value) || typeof value.canConfigure !== "boolean" || !Array.isArray(value.credentials)
    || !value.credentials.every(item => object(item) && text(item.id) && text(item.label))
    || !(value.current === null || (object(value.current) && text(value.current.siteId) && text(value.current.libraryId)
      && ["active", "disabled"].includes(String(value.current.state))))) throw new Error("FOLDER_WIZARD_DESTINATION_RESPONSE_INVALID");
  return value as FolderWizardDestination;
}
