import { z } from "zod/v4";
import { projectLegacyAction, type ActionPrincipal, type UnifiedAction } from "./unified-action-contract";

const inputSchema = z.object({
  commentId: z.string().trim().min(1).max(256),
  commentRevision: z.number().int().positive(),
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  tradeId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(500),
  text: z.string().trim().min(1).max(8_000),
  disposition: z.enum(["open", "accepted", "rejected", "resolved"]),
  owner: z.custom<ActionPrincipal>(),
  assignee: z.custom<ActionPrincipal>().nullable(),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  sourceSnapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export function projectDesignCommentAction(input: unknown): UnifiedAction {
  const value = inputSchema.parse(input);
  return projectLegacyAction({
    module: "coordination",
    sourceType: "module_action",
    sourceRecordId: value.commentId,
    sourceRevision: value.commentRevision,
    projectId: value.projectId,
    companyId: value.companyId,
    tradeId: value.tradeId,
    owner: value.owner,
    assignee: value.assignee,
    title: value.title,
    description: value.text,
    dueAt: value.dueAt,
    status: value.disposition === "resolved" ? "completed" : value.disposition === "rejected" ? "cancelled" : "open",
    visibility: "project",
    sourceSnapshotDigest: value.sourceSnapshotDigest,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}
