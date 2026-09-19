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

export const coordinationEvidenceKinds = ["attachment", "reference", "comment", "responsible_company"] as const;
export type CoordinationEvidenceKind = typeof coordinationEvidenceKinds[number];

export type CoordinationEvidence = {
  id: string;
  recordKey: string;
  recordVersion: number;
  kind: CoordinationEvidenceKind;
  value: string;
  contentSha256: string | null;
  actorUserId: number;
  createdAt: string;
};

export type CoordinationNotification = {
  eventKey: string;
  recordKey: string;
  recordVersion: number;
  event: "comment_added" | "attachment_added" | "responsibility_changed";
  recipients: number[];
};

export function bindCoordinationEvidence(input: {
  identity: CoordinationRecordIdentity;
  evidence: Omit<CoordinationEvidence, "recordKey" | "recordVersion">;
  existing?: readonly CoordinationEvidence[];
  responsibleUserIds?: readonly number[];
}) {
  const identity = canonicalCoordinationIdentity(input.identity);
  const evidence = input.evidence;
  if (!evidence.id.trim() || !evidence.value.trim() || !Number.isInteger(evidence.actorUserId) || evidence.actorUserId <= 0 || !Number.isFinite(Date.parse(evidence.createdAt))) {
    throw new Error("Complete coordination evidence identity, value, actor, and time are required");
  }
  if (evidence.kind === "attachment" && !/^[a-f0-9]{64}$/.test(evidence.contentSha256 ?? "")) {
    throw new Error("Attachments require an exact SHA-256 digest");
  }
  if (evidence.kind !== "attachment" && evidence.contentSha256 !== null) {
    throw new Error("Only attachment evidence carries a content digest");
  }
  const existing = [...(input.existing ?? [])];
  const duplicate = existing.find((entry) => entry.id === evidence.id);
  if (duplicate) {
    if (duplicate.recordKey !== identity.key || duplicate.recordVersion !== identity.version || duplicate.kind !== evidence.kind || duplicate.value !== evidence.value || duplicate.contentSha256 !== evidence.contentSha256) {
      throw new Error("Evidence identity cannot be rebound or overwritten");
    }
    return { evidence: existing, notification: null, result: "idempotent" as const };
  }
  const bound: CoordinationEvidence = { ...evidence, recordKey: identity.key, recordVersion: identity.version };
  const recipients = [...new Set((input.responsibleUserIds ?? []).filter((id) => Number.isInteger(id) && id > 0 && id !== evidence.actorUserId))].sort((a, b) => a - b);
  const event = evidence.kind === "comment" ? "comment_added" : evidence.kind === "attachment" ? "attachment_added" : evidence.kind === "responsible_company" ? "responsibility_changed" : null;
  const notification: CoordinationNotification | null = event && recipients.length > 0 ? {
    eventKey: `${identity.key}:v${identity.version}:${event}:${evidence.id}`,
    recordKey: identity.key,
    recordVersion: identity.version,
    event,
    recipients,
  } : null;
  return { evidence: [...existing, bound], notification, result: "created" as const };
}

export function evidenceForCoordinationVersion(identityInput: CoordinationRecordIdentity, evidence: readonly CoordinationEvidence[]) {
  const identity = canonicalCoordinationIdentity(identityInput);
  return evidence.filter((entry) => entry.recordKey === identity.key && entry.recordVersion === identity.version);
}

export type CoordinationRegisterRow = {
  identity: CoordinationRecordIdentity;
  number: string;
  title: string;
  status: CoordinationStatus;
  responsibleCompany: string | null;
  updatedAt: string;
};

export const coordinationSavedViewSchema = z.object({
  id: z.string().trim().min(1).max(128),
  projectId: z.number().int().positive(),
  name: z.string().trim().min(1).max(128),
  filters: z.object({
    types: z.array(z.enum(coordinationRecordTypes)).default([]),
    statuses: z.array(z.string().trim().min(1)).default([]),
    responsibleCompanies: z.array(z.string().trim().min(1)).default([]),
    search: z.string().trim().max(256).default(""),
  }).strict(),
  sort: z.enum(["updated_desc", "updated_asc", "number_asc"]),
  pageSize: z.number().int().min(1).max(200),
}).strict();

export type CoordinationSavedView = z.infer<typeof coordinationSavedViewSchema>;

export function coordinationRegisterView(input: { rows: readonly CoordinationRegisterRow[]; view: CoordinationSavedView; page: number }) {
  const view = coordinationSavedViewSchema.parse(input.view);
  if (!Number.isInteger(input.page) || input.page < 1) throw new Error("Coordination register page must be positive");
  for (const row of input.rows) {
    const identity = canonicalCoordinationIdentity(row.identity);
    if (identity.projectId !== view.projectId) throw new Error("Saved view cannot read records from another project");
  }
  const typeSet = new Set(view.filters.types);
  const statusSet = new Set(view.filters.statuses);
  const companySet = new Set(view.filters.responsibleCompanies.map((value) => value.toLocaleLowerCase()));
  const search = view.filters.search.toLocaleLowerCase();
  const filtered = input.rows.filter((row) => {
    const identity = canonicalCoordinationIdentity(row.identity);
    return (typeSet.size === 0 || typeSet.has(identity.type))
      && (statusSet.size === 0 || statusSet.has(row.status))
      && (companySet.size === 0 || companySet.has((row.responsibleCompany ?? "").toLocaleLowerCase()))
      && (!search || [row.number, row.title, row.responsibleCompany ?? "", identity.type].some((value) => value.toLocaleLowerCase().includes(search)));
  });
  const sorted = [...filtered].sort((left, right) => {
    if (view.sort === "number_asc") return left.number.localeCompare(right.number);
    const difference = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
    return view.sort === "updated_asc" ? difference : -difference;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / view.pageSize));
  const page = Math.min(input.page, totalPages);
  const visibleRows = sorted.slice((page - 1) * view.pageSize, page * view.pageSize);
  return { view, page, pageSize: view.pageSize, totalRows: sorted.length, totalPages, filteredRows: sorted, visibleRows };
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function coordinationExportModel(result: ReturnType<typeof coordinationRegisterView>) {
  const rows = result.filteredRows.map((row) => {
    const identity = canonicalCoordinationIdentity(row.identity);
    return { key: identity.key, version: identity.version, type: identity.type, number: row.number, title: row.title, status: row.status, responsibleCompany: row.responsibleCompany ?? "", updatedAt: row.updatedAt };
  });
  const headers = ["Key", "Version", "Type", "Number", "Title", "Status", "Responsible company", "Updated at"];
  const csv = [headers, ...rows.map((row) => [row.key, row.version, row.type, row.number, row.title, row.status, row.responsibleCompany, row.updatedAt])]
    .map((line) => line.map((value) => csvCell(value)).join(","))
    .join("\r\n");
  return { viewId: result.view.id, projectId: result.view.projectId, filters: result.view.filters, sort: result.view.sort, totalRows: rows.length, rows, csv };
}
