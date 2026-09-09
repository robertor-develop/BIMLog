import { z } from "zod/v4";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const secretPart = z.string().min(16).max(65_536);

export const protectedSecretEnvelopeSchema = z.object({
  secretCiphertext: secretPart,
  secretIv: secretPart,
  secretTag: secretPart,
  wrappedDataKey: secretPart,
  wrapIv: secretPart,
  wrapTag: secretPart,
  keyVersion: z.number().int().positive(),
}).strict();

export const connectorJobStateSchema = z.enum(["queued", "leased", "retry", "completed", "dead_letter", "cancelled"]);
export type ConnectorJobState = z.infer<typeof connectorJobStateSchema>;

const transitions = {
  queued: ["leased", "cancelled"],
  leased: ["retry", "completed", "dead_letter"],
  retry: ["leased", "cancelled"],
  completed: [],
  dead_letter: ["queued"],
  cancelled: [],
} as const satisfies Readonly<Record<ConnectorJobState, readonly ConnectorJobState[]>>;

export function assertConnectorJobTransition(from: ConnectorJobState, to: ConnectorJobState): void {
  if (!(transitions[from] as readonly ConnectorJobState[]).includes(to)) throw new Error(`Invalid connector job transition: ${from}->${to}`);
}

export function retryDelaySeconds(attempt: number, baseSeconds = 30, ceilingSeconds = 3_600): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Attempt must be a positive integer");
  return Math.min(ceilingSeconds, baseSeconds * 2 ** Math.min(attempt - 1, 10));
}

export const coordinationRevisionInputSchema = z.object({
  coordinationFileId: z.string().min(1).max(256),
  projectId: z.number().int().positive(),
  revisionNumber: z.number().int().positive(),
  provider: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  providerItemId: z.string().min(1).max(1_024),
  providerVersionId: z.string().min(1).max(1_024),
  contentSha256: digest,
  byteSize: z.number().int().nonnegative(),
}).strict();

export const sharePointMappingInputSchema = z.object({
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  credentialId: z.string().min(1).max(256),
  siteId: z.string().min(1).max(1_024),
  libraryId: z.string().min(1).max(1_024),
  category: z.string().min(1).max(128),
  tradeId: z.number().int().positive().nullable(),
  folderId: z.string().min(1).max(1_024),
  folderPath: z.string().startsWith("/").max(4_096),
}).strict();
