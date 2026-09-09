import { z } from "zod/v4";

const boundedId = z.string().trim().min(1).max(256);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const instant = z.iso.datetime({ offset: true });

export const actionModuleSchema = z.enum([
  "coordination",
  "job_intake",
  "meetings",
  "rfi",
  "submittal",
  "files",
  "financial",
  "lens_next",
  "other",
]);

export const actionSourceTypeSchema = z.enum([
  "action_item",
  "coordinator_action",
  "activation_task",
  "meeting_action",
  "rfi",
  "submittal",
  "module_action",
]);

export const actionPrincipalSchema = z.object({
  kind: z.enum(["user", "contact", "external"]),
  id: boundedId,
  displayName: z.string().trim().min(1).max(256).nullable().default(null),
  email: z.email().nullable().default(null),
}).strict();

export const actionSourceSchema = z.object({
  module: actionModuleSchema,
  type: actionSourceTypeSchema,
  recordId: boundedId,
  revision: z.number().int().positive().nullable().default(null),
}).strict();

export const unifiedActionSchema = z.object({
  contractVersion: z.literal("1.0"),
  actionId: boundedId,
  source: actionSourceSchema,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive().nullable(),
  tradeId: z.number().int().positive().nullable(),
  owner: actionPrincipalSchema,
  assignee: actionPrincipalSchema.nullable(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(8_000).nullable(),
  dueAt: instant.nullable(),
  status: z.enum(["proposed", "open", "in_progress", "blocked", "completed", "cancelled"]),
  visibility: z.enum(["internal", "project", "external"]),
  sourceSnapshotDigest: digest,
  createdAt: instant,
  updatedAt: instant,
}).strict().superRefine((action, context) => {
  if (action.visibility === "external" && !action.assignee) {
    context.addIssue({ code: "custom", path: ["assignee"], message: "External visibility requires an attributable assignee" });
  }
});

export type UnifiedAction = z.infer<typeof unifiedActionSchema>;
export type ActionPrincipal = z.infer<typeof actionPrincipalSchema>;

export const immutableAuditEventSchema = z.object({
  contractVersion: z.literal("1.0"),
  immutable: z.literal(true),
  eventId: boundedId,
  eventType: z.enum(["created", "assigned", "status_changed", "due_changed", "visibility_changed", "superseded", "reconciled"]),
  occurredAt: instant,
  actor: actionPrincipalSchema,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive().nullable(),
  tradeId: z.number().int().positive().nullable(),
  source: actionSourceSchema,
  actionId: boundedId,
  previousSnapshotDigest: digest.nullable(),
  resultingSnapshotDigest: digest,
  reasonCode: z.string().regex(/^[A-Z0-9][A-Z0-9_:-]{0,127}$/),
  evidenceRefs: z.array(boundedId).max(100),
}).strict();

export type ImmutableAuditEvent = z.infer<typeof immutableAuditEventSchema>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function createImmutableAuditEvent(input: unknown): Readonly<ImmutableAuditEvent> {
  return deepFreeze(immutableAuditEventSchema.parse(input));
}

export type LegacyActionProjectionInput = {
  module: z.infer<typeof actionModuleSchema>;
  sourceType: z.infer<typeof actionSourceTypeSchema>;
  sourceRecordId: string | number;
  sourceRevision?: number | null;
  projectId: number;
  companyId?: number | null;
  tradeId?: number | null;
  owner: ActionPrincipal;
  assignee?: ActionPrincipal | null;
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  status: UnifiedAction["status"];
  visibility?: UnifiedAction["visibility"];
  sourceSnapshotDigest: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new Error("Action timestamp is invalid");
  return date.toISOString();
}

export function projectLegacyAction(input: LegacyActionProjectionInput): UnifiedAction {
  const recordId = String(input.sourceRecordId);
  return unifiedActionSchema.parse({
    contractVersion: "1.0",
    actionId: `${input.module}:${input.sourceType}:${recordId}`,
    source: { module: input.module, type: input.sourceType, recordId, revision: input.sourceRevision ?? null },
    projectId: input.projectId,
    companyId: input.companyId ?? null,
    tradeId: input.tradeId ?? null,
    owner: input.owner,
    assignee: input.assignee ?? null,
    title: input.title,
    description: input.description ?? null,
    dueAt: input.dueAt == null ? null : iso(input.dueAt),
    status: input.status,
    visibility: input.visibility ?? "project",
    sourceSnapshotDigest: input.sourceSnapshotDigest,
    createdAt: iso(input.createdAt),
    updatedAt: iso(input.updatedAt),
  });
}
