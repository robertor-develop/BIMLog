import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const designCommentSchema = z.object({
  id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  source: z.object({ provider: z.enum(["procore", "bimlog"]), recordId: id, revision: z.number().int().positive(), snapshotSha256: digest }).strict(),
  target: z.object({ coordinationFileId: id, revisionId: id, locationRef: id.nullable() }).strict(),
  author: z.object({ kind: z.enum(["user", "contact"]), id }).strict(),
  text: z.string().trim().min(1).max(16_000),
  disposition: z.enum(["open", "accepted", "rejected", "resolved"]),
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export type DesignComment = z.infer<typeof designCommentSchema>;

export function reconcileDesignComment(input: unknown, existing: DesignComment | null): { result: "created" | "idempotent"; value: DesignComment } {
  const value = designCommentSchema.parse(input);
  if (!existing) return { result: "created", value };
  const immutableMatch = existing.id === value.id && existing.projectId === value.projectId && existing.companyId === value.companyId && existing.source.provider === value.source.provider && existing.source.recordId === value.source.recordId && existing.source.revision === value.source.revision && existing.source.snapshotSha256 === value.source.snapshotSha256 && existing.target.coordinationFileId === value.target.coordinationFileId && existing.target.revisionId === value.target.revisionId && existing.text === value.text;
  if (!immutableMatch) throw new Error("Design comment immutable evidence conflicts");
  return { result: "idempotent", value: existing };
}
