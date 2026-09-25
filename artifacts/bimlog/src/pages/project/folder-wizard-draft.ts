export type FolderWizardDraft = { destination: { sharepoint_url: string; base_path: string }; blueprints: { name: string; include: boolean }[] };

/** Display-only preview. The server performs the authoritative full validation. */
export function parseFolderWizardDraft(sourceText: string): FolderWizardDraft {
  const raw: unknown = JSON.parse(sourceText);
  if (!raw || typeof raw !== "object") throw new Error("INVALID_WIZARD_EXPORT");
  const record = raw as Record<string, unknown>;
  if (record.generated_by !== "BT Folder Wizard" || record.version !== "3.1 (BIMLOG export)" ||
      !record.destination || typeof record.destination !== "object" || !Array.isArray(record.blueprints)) throw new Error("INVALID_WIZARD_EXPORT");
  const destination = record.destination as Record<string, unknown>;
  if (typeof destination.sharepoint_url !== "string" || typeof destination.base_path !== "string" ||
      record.blueprints.length < 1 || record.blueprints.length > 16 ||
      !record.blueprints.every((entry) => entry && typeof entry === "object" &&
        typeof entry.name === "string" && typeof entry.include === "boolean")) throw new Error("INVALID_WIZARD_EXPORT");
  return { destination: { sharepoint_url: destination.sharepoint_url, base_path: destination.base_path },
    blueprints: record.blueprints.map((entry) => ({ name: entry.name as string, include: entry.include as boolean })) };
}
