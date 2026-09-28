export type SharePointPublicationConfirmation = { fileId: number; requestDigest: string; confirmation: "publish_sharepoint" };

/** Confirmation is bound to the exact candidate digest and cannot authorize a changed route or file. */
export function parseSharePointPublicationConfirmation(value: unknown): SharePointPublicationConfirmation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("FOLDER_WIZARD_PUBLISH_CONFIRMATION_REQUIRED");
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.fileId) || Number(input.fileId) <= 0 || input.confirmation !== "publish_sharepoint" ||
      typeof input.requestDigest !== "string" || !/^[a-f0-9]{64}$/.test(input.requestDigest))
    throw new Error("FOLDER_WIZARD_PUBLISH_CONFIRMATION_REQUIRED");
  return { fileId: Number(input.fileId), requestDigest: input.requestDigest, confirmation: "publish_sharepoint" };
}
