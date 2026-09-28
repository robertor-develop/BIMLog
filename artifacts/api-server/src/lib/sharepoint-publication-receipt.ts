import { classifySharePointPublicationOutcome } from "./sharepoint-publication-outcome";

export type SharePointPublicationReceipt = { jobId: string; outcome: string; providerItemId?: string | null; errorCode?: string | null };

/** Exposes durable result identity without credentials, tokens, provider payloads or internal stack details. */
export function projectSharePointPublicationReceipt(value: SharePointPublicationReceipt) {
  if (!/^[0-9a-z-]{8,80}$/i.test(value.jobId)) throw new Error("FOLDER_WIZARD_RECEIPT_INVALID");
  const state = classifySharePointPublicationOutcome(value.outcome);
  return { jobId: value.jobId, ...state,
    providerItemId: state.published && value.providerItemId ? value.providerItemId.slice(0, 1024) : null,
    errorCode: !state.published && /^FOLDER_WIZARD_[A-Z_]{1,80}$/.test(value.errorCode ?? "") ? value.errorCode : null };
}
