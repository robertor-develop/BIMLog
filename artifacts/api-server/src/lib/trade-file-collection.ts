import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);

export const tradeFileCollectionRequestSchema = z.object({
  id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  requestingUserId: z.number().int().positive(),
  responsibleCompanyId: z.number().int().positive(),
  responsibleContactId: z.number().int().positive(),
  tradeId: z.number().int().positive(),
  category: z.string().trim().min(1).max(128),
  requestedArtifacts: z.array(z.object({ key: id, description: z.string().trim().min(1).max(2_048), required: z.boolean(), allowedExtensions: z.array(z.string().regex(/^\.[a-z0-9]{1,16}$/)).min(1).max(30) }).strict()).min(1).max(200),
  dueAt: z.string().datetime({ offset: true }),
  status: z.enum(["draft", "issued", "closed", "cancelled"]),
}).strict().superRefine((value, context) => {
  const keys = value.requestedArtifacts.map((artifact) => artifact.key);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["requestedArtifacts"], message: "Requested artifact keys must be unique" });
});

export type TradeFileCollectionRequest = z.infer<typeof tradeFileCollectionRequestSchema>;

export function issueTradeFileCollectionRequest(input: unknown): TradeFileCollectionRequest {
  const request = tradeFileCollectionRequestSchema.parse(input);
  if (request.status !== "draft") throw new Error("Only a draft collection request can be issued");
  return { ...request, status: "issued" };
}
