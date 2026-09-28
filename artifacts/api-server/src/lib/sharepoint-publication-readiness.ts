import { evaluateFolderWizardPublishReadiness, type FolderWizardPublishReadinessInput } from "./folder-wizard-publish-readiness";

export type SharePointPublicationReadiness = {
  state: "ready" | "blocked";
  blockers: string[];
  requiresConfirmation: boolean;
};

/** One truthful readiness projection for API and UI; setup health alone never enables publishing. */
export function projectSharePointPublicationReadiness(input: FolderWizardPublishReadinessInput): SharePointPublicationReadiness {
  const result = evaluateFolderWizardPublishReadiness(input);
  return { state: result.ready ? "ready" : "blocked", blockers: [...new Set(result.blockers)], requiresConfirmation: result.ready };
}
