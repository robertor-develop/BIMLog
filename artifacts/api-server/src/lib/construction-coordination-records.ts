import { z } from "zod/v4";

export const coordinationRecordTypes = [
  "issue",
  "rfi",
  "submittal",
  "transmittal",
  "meeting",
  "schedule",
  "change_order",
] as const;

export type CoordinationRecordType = typeof coordinationRecordTypes[number];

export const coordinationRecordIdentitySchema = z.object({
  projectId: z.number().int().positive(),
  type: z.enum(coordinationRecordTypes),
  id: z.number().int().positive(),
  version: z.number().int().nonnegative(),
}).strict();

export type CoordinationRecordIdentity = z.infer<typeof coordinationRecordIdentitySchema>;

const sourceAliases: Readonly<Record<string, CoordinationRecordType>> = {
  clash: "issue",
  lens_viewpoint: "issue",
  issue: "issue",
  rfi: "rfi",
  submittal: "submittal",
  transmittal: "transmittal",
  meeting: "meeting",
  schedule: "schedule",
  schedule_item: "schedule",
  change_order: "change_order",
};

export function canonicalCoordinationType(value: unknown): CoordinationRecordType {
  const normalized = typeof value === "string" ? sourceAliases[value.trim().toLowerCase()] : undefined;
  if (!normalized) throw new Error("Unsupported coordination record type");
  return normalized;
}

export function canonicalCoordinationIdentity(input: unknown): CoordinationRecordIdentity & { key: string } {
  const candidate = input as Record<string, unknown>;
  const identity = coordinationRecordIdentitySchema.parse({
    projectId: candidate?.projectId,
    type: canonicalCoordinationType(candidate?.type),
    id: candidate?.id,
    version: candidate?.version ?? 0,
  });
  return { ...identity, key: `${identity.projectId}:${identity.type}:${identity.id}` };
}

export type CoordinationRecordLink = {
  projectId: number;
  from: CoordinationRecordIdentity;
  to: CoordinationRecordIdentity;
  relation: string;
};

export function reconcileCoordinationLinks(records: readonly CoordinationRecordIdentity[], links: readonly CoordinationRecordLink[]) {
  const canonicalRecords = new Map<string, CoordinationRecordIdentity>();
  for (const record of records) {
    const identity = canonicalCoordinationIdentity(record);
    const existing = canonicalRecords.get(identity.key);
    if (existing && existing.version !== identity.version) {
      throw new Error(`Duplicate coordination state for ${identity.key}`);
    }
    canonicalRecords.set(identity.key, identity);
  }

  const canonicalLinks = new Map<string, CoordinationRecordLink & { fromKey: string; toKey: string }>();
  for (const link of links) {
    const from = canonicalCoordinationIdentity(link.from);
    const to = canonicalCoordinationIdentity(link.to);
    if (from.projectId !== link.projectId || to.projectId !== link.projectId) {
      throw new Error("Coordination links cannot cross project authority");
    }
    if (!canonicalRecords.has(from.key) || !canonicalRecords.has(to.key)) {
      throw new Error("Coordination link references an unknown authoritative record");
    }
    const relation = link.relation.trim();
    if (!relation) throw new Error("Coordination link relation is required");
    const key = `${from.key}->${to.key}:${relation}`;
    if (!canonicalLinks.has(key)) canonicalLinks.set(key, { ...link, from, to, fromKey: from.key, toKey: to.key, relation });
  }

  return { records: [...canonicalRecords.values()], links: [...canonicalLinks.values()] };
}

export type CoordinationStatus = "draft" | "open" | "in_progress" | "submitted" | "under_review" | "responded" | "sent" | "acknowledged" | "approved" | "rejected" | "resolved" | "closed" | "complete" | "issued" | "revised" | "void";
export type CoordinationTransitionAction = "start" | "submit" | "review" | "respond" | "send" | "acknowledge" | "approve" | "reject" | "resolve" | "close" | "complete" | "issue" | "revise" | "reopen" | "void";

const lifecycle: Readonly<Record<CoordinationRecordType, Readonly<Record<string, Partial<Record<CoordinationTransitionAction, CoordinationStatus>>>>>> = {
  issue: { open: { start: "in_progress", resolve: "resolved", void: "void" }, in_progress: { resolve: "resolved", void: "void" }, resolved: { close: "closed", reopen: "open" }, closed: { reopen: "open" }, void: { reopen: "open" } },
  rfi: { draft: { submit: "open", void: "void" }, open: { respond: "responded", void: "void" }, responded: { close: "closed", revise: "revised", reopen: "open" }, revised: { submit: "open", void: "void" }, closed: { reopen: "open" }, void: { reopen: "draft" } },
  submittal: { draft: { submit: "submitted", void: "void" }, submitted: { review: "under_review", void: "void" }, under_review: { approve: "approved", reject: "rejected", void: "void" }, approved: { revise: "revised" }, rejected: { revise: "revised" }, revised: { submit: "submitted", void: "void" }, void: { reopen: "draft" } },
  transmittal: { draft: { send: "sent", void: "void" }, sent: { acknowledge: "acknowledged", void: "void" }, acknowledged: { revise: "revised" }, revised: { send: "sent", void: "void" }, void: { reopen: "draft" } },
  meeting: { draft: { issue: "issued", void: "void" }, issued: { revise: "revised", void: "void" }, revised: { issue: "issued", void: "void" }, void: { reopen: "draft" } },
  schedule: { draft: { start: "in_progress", void: "void" }, in_progress: { complete: "complete", void: "void" }, complete: { reopen: "in_progress" }, void: { reopen: "draft" } },
  change_order: { draft: { submit: "submitted", void: "void" }, submitted: { approve: "approved", reject: "rejected", void: "void" }, approved: { revise: "revised" }, rejected: { revise: "revised", reopen: "draft" }, revised: { submit: "submitted", void: "void" }, void: { reopen: "draft" } },
};

export type CoordinationAuditEntry = {
  sequence: number;
  recordKey: string;
  from: CoordinationStatus;
  to: CoordinationStatus;
  action: CoordinationTransitionAction;
  reason: string | null;
  actorUserId: number;
  occurredAt: string;
};

export function transitionCoordinationRecord(input: {
  identity: CoordinationRecordIdentity;
  status: CoordinationStatus;
  action: CoordinationTransitionAction;
  reason?: string | null;
  actorUserId: number;
  occurredAt: string;
  history?: readonly CoordinationAuditEntry[];
}) {
  const identity = canonicalCoordinationIdentity(input.identity);
  const next = lifecycle[identity.type][input.status]?.[input.action];
  if (!next) throw new Error(`Transition ${input.action} is not allowed from ${input.status} for ${identity.type}`);
  const reason = input.reason?.trim() || null;
  if (["reopen", "revise", "void", "reject"].includes(input.action) && !reason) {
    throw new Error(`Transition ${input.action} requires a reason`);
  }
  if (!Number.isInteger(input.actorUserId) || input.actorUserId <= 0 || !Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("Transition actor and timestamp are required");
  }
  const history = [...(input.history ?? [])];
  history.push({ sequence: history.length + 1, recordKey: identity.key, from: input.status, to: next, action: input.action, reason, actorUserId: input.actorUserId, occurredAt: input.occurredAt });
  return { identity, status: next, history };
}
