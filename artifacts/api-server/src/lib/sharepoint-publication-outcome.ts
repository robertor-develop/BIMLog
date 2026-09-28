export type SharePointPublicationOutcome = "completed" | "retry" | "dead_letter" | "cancelled" | "pending";
export type SharePointPublicationAction = "none" | "refresh" | "administrator_review";

/** Provider execution truth is never collapsed into a generic success message. */
export function classifySharePointPublicationOutcome(outcome: unknown): { outcome: SharePointPublicationOutcome; action: SharePointPublicationAction; published: boolean } {
  if (outcome === "completed") return { outcome, action: "none", published: true };
  if (outcome === "retry") return { outcome, action: "refresh", published: false };
  if (outcome === "dead_letter") return { outcome, action: "administrator_review", published: false };
  if (outcome === "cancelled") return { outcome, action: "none", published: false };
  return { outcome: "pending", action: "refresh", published: false };
}
