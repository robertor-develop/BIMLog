import { z } from "zod/v4";
import { projectLegacyAction, type UnifiedAction } from "./unified-action-contract";

const id = z.string().trim().min(1).max(256);
const principal = z.object({ kind: z.enum(["user", "contact", "external"]), id, displayName: z.string().trim().min(1).max(256).nullable(), email: z.string().email().nullable() }).strict();

export const meetingReportActionExtractionSchema = z.object({
  meetingId: id,
  meetingRevision: z.number().int().positive(),
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive().nullable(),
  reportSnapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.string().datetime({ offset: true }),
  actions: z.array(z.object({ key: id, title: z.string().trim().min(1).max(500), description: z.string().trim().max(8_000).nullable(), tradeId: z.number().int().positive().nullable(), owner: principal, assignee: principal.nullable(), dueAt: z.string().datetime({ offset: true }).nullable(), visibility: z.enum(["internal", "project", "external"]) }).strict()).max(200),
}).strict().superRefine((value, context) => {
  const keys = value.actions.map((action) => action.key);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["actions"], message: "Meeting action keys must be unique within a report revision" });
});

export function extractMeetingReportActions(input: unknown): UnifiedAction[] {
  const value = meetingReportActionExtractionSchema.parse(input);
  return value.actions.map((action) => projectLegacyAction({
    module: "meetings",
    sourceType: "meeting_action",
    sourceRecordId: `${value.meetingId}:${action.key}`,
    sourceRevision: value.meetingRevision,
    projectId: value.projectId,
    companyId: value.companyId,
    tradeId: action.tradeId,
    owner: action.owner,
    assignee: action.assignee,
    title: action.title,
    description: action.description,
    dueAt: action.dueAt,
    status: "proposed",
    visibility: action.visibility,
    sourceSnapshotDigest: value.reportSnapshotDigest,
    createdAt: value.capturedAt,
    updatedAt: value.capturedAt,
  }));
}
