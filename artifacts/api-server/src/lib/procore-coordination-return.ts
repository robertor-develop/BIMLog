import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const procoreCoordinationReturnSchema = z.object({
  id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  procoreProjectId: id,
  compositeManifestId: id,
  compositeRevision: z.number().int().positive(),
  compositeSha256: digest,
  qcDecisionId: id,
  qcDecision: z.literal("approve"),
  destination: z.object({ kind: z.enum(["document", "rfi_response", "submittal_response"]), providerRecordId: id }).strict(),
  requestedByUserId: z.number().int().positive(),
  approval: z.object({ approvedByUserId: z.number().int().positive(), approvedAt: z.string().datetime({ offset: true }) }).strict(),
  idempotencyKey: id,
}).strict();

export type ProcoreCoordinationReturn = z.infer<typeof procoreCoordinationReturnSchema>;

export class ProcoreReturnConflict extends Error {}

export function stageProcoreCoordinationReturn(input: unknown, existing: ProcoreCoordinationReturn | null): { result: "staged" | "idempotent"; value: ProcoreCoordinationReturn } {
  const value = procoreCoordinationReturnSchema.parse(input);
  if (!existing) return { result: "staged", value };
  if (existing.idempotencyKey !== value.idempotencyKey || existing.compositeSha256 !== value.compositeSha256 || existing.destination.providerRecordId !== value.destination.providerRecordId || existing.projectId !== value.projectId) throw new ProcoreReturnConflict("Procore return identity conflicts with previously staged evidence");
  return { result: "idempotent", value: existing };
}
