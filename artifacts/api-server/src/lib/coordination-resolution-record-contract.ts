import { z } from "zod";

export const RESOLUTION_RECORD_STATUSES = ["draft", "completed", "verified"] as const;
export type ResolutionRecordStatus = (typeof RESOLUTION_RECORD_STATUSES)[number];

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();
const isoDate = z.string().datetime({ offset: true }).nullable();

export const resolutionRecordRevisionSchema = z.object({
  id: z.string().uuid(),
  resolutionRecordId: z.string().uuid(),
  projectCaseId: z.string().uuid(),
  companyId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  lensViewpointId: z.number().int().positive(),
  revision: z.number().int().positive(),
  status: z.enum(RESOLUTION_RECORD_STATUSES),
  methodRevisionId: z.string().uuid().nullable(),
  actualResolution: optionalText(8_000),
  disciplineChanged: optionalText(160),
  responsibleTrade: optionalText(160),
  rfiRequired: z.boolean(),
  rfiReference: optionalText(500),
  drawingSubmittalReference: optionalText(1_000),
  resolvedById: z.number().int().positive().nullable(),
  resolutionDate: isoDate,
  verifiedById: z.number().int().positive().nullable(),
  verificationDate: isoDate,
  reopenReason: optionalText(2_000),
  createdById: z.number().int().positive(),
}).superRefine((value, ctx) => {
  if (value.rfiRequired && !value.rfiReference) ctx.addIssue({ code: "custom", path: ["rfiReference"], message: "An RFI reference is required when the resolution required an RFI." });
  if (value.status !== "draft" && !value.actualResolution) ctx.addIssue({ code: "custom", path: ["actualResolution"], message: "Actual resolution is required before completion." });
  if (value.status !== "draft" && (!value.resolvedById || !value.resolutionDate)) ctx.addIssue({ code: "custom", path: ["resolvedById"], message: "Resolver identity and resolution date are required before completion." });
  if (value.status === "verified" && (!value.verifiedById || !value.verificationDate)) ctx.addIssue({ code: "custom", path: ["verifiedById"], message: "Verifier identity and verification date are required." });
  if (value.status !== "verified" && (value.verifiedById || value.verificationDate)) ctx.addIssue({ code: "custom", path: ["verifiedById"], message: "Verification evidence is valid only for a verified revision." });
});

export type ResolutionRecordRevision = z.infer<typeof resolutionRecordRevisionSchema>;
export function validateResolutionRecordRevision(value: unknown): ResolutionRecordRevision { return resolutionRecordRevisionSchema.parse(value); }

export function assertResolutionRecordTransition(from: ResolutionRecordStatus | null, to: ResolutionRecordStatus, reopenReason: string | null): void {
  const allowed = from === null ? to === "draft" : from === "draft" ? ["draft", "completed"].includes(to) : from === "completed" ? to === "verified" || (to === "draft" && !!reopenReason) : to === "draft" && !!reopenReason;
  if (!allowed) throw new Error(`RESOLUTION_RECORD_TRANSITION_INVALID:${from ?? "none"}->${to}`);
}
