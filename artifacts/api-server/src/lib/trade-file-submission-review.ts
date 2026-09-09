import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const tradeFileSubmissionSchema = z.object({
  id,
  collectionRequestId: id,
  requestedArtifactKey: id,
  submitterCompanyId: z.number().int().positive(),
  submitterContactId: z.number().int().positive(),
  revisionNumber: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(512),
  byteSize: z.number().int().nonnegative(),
  sha256: digest,
  malwareScan: z.enum(["pending", "clean", "blocked"]),
  receivedAt: z.string().datetime({ offset: true }),
}).strict();

export const tradeFileReviewInputSchema = z.object({
  submission: tradeFileSubmissionSchema,
  expectedExtensions: z.array(z.string().regex(/^\.[a-z0-9]{1,16}$/)).min(1),
  reviewerUserId: z.number().int().positive(),
  decision: z.enum(["accept", "reject"]),
  reason: z.string().trim().min(1).max(4_096),
}).strict();

export function reviewTradeFileSubmission(input: unknown): { decision: "accepted" | "rejected"; immutableSubmissionId: string; reason: string } {
  const value = tradeFileReviewInputSchema.parse(input);
  const extension = value.submission.fileName.slice(value.submission.fileName.lastIndexOf(".")).toLowerCase();
  if (value.decision === "accept" && value.submission.malwareScan !== "clean") throw new Error("Only a clean submission can be accepted");
  if (value.decision === "accept" && !value.expectedExtensions.includes(extension)) throw new Error("Submission file type is outside the collection contract");
  return { decision: value.decision === "accept" ? "accepted" : "rejected", immutableSubmissionId: value.submission.id, reason: value.reason };
}
