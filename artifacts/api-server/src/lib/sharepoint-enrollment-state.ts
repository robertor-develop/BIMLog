import { z } from "zod/v4";

const inputSchema = z.object({
  projectId: z.number().int().positive(), companyAdmin: z.boolean(),
  selectedSiteId: z.string().trim().min(1).max(1_024).nullable(),
  microsoftConsent: z.enum(["not_started", "awaiting_microsoft_admin", "granted", "denied"]),
  credentialState: z.enum(["absent", "pending_validation", "active", "disabled", "revoked"]),
  destinationBound: z.boolean(),
}).strict();

export function sharePointEnrollmentState(raw: unknown) {
  const input = inputSchema.parse(raw);
  const steps = [
    { id: "site", complete: input.selectedSiteId !== null, owner: "company_admin" as const },
    { id: "consent", complete: input.microsoftConsent === "granted", owner: "microsoft_admin" as const },
    { id: "connection", complete: input.credentialState === "active", owner: "company_admin" as const },
    { id: "destination", complete: input.destinationBound, owner: "company_admin" as const },
  ];
  const connected = steps.every(step => step.complete);
  const next = steps.find(step => !step.complete)?.id ?? "complete";
  return Object.freeze({ projectId: input.projectId, connected, next, steps, resumable: true,
    canConfigure: input.companyAdmin, ordinaryUserHandlesMicrosoftConsent: false,
    state: connected ? "connected" as const : input.microsoftConsent === "denied" ? "consent_denied" as const : "incomplete" as const });
}
