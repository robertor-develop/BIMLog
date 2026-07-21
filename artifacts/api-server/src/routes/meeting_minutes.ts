import { Router } from "express";
import { db } from "@workspace/db";
import {
  meetingMinutesTable, meetingAttendeesTable, actionItemsTable,
  activityLogTable, usersTable, rfisTable, meetingRfiLinksTable,
  submittalsTable, meetingSubmittalLinksTable,
  clashesTable, clashReportsTable, meetingClashLinksTable, meetingClashRefreshEventsTable,
  linkedItemsTable, agentInsightsTable,
} from "@workspace/db/schema";
import { eq, and, desc, ne, isNull, or, ilike, inArray, asc } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { createNotification } from "./notifications";
import { sendEmail } from "../lib/email";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";
import multer from "multer";
import { extractFileText } from "../lib/extract-file-text";

const FFMPEG_PATH = (() => { try { const { execSync } = require("child_process"); return execSync("which ffmpeg").toString().trim() || "ffmpeg"; } catch { return "ffmpeg"; } })();

const router: Router = Router();
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const parseLegacyRfiRows = (notes: string | null) => {
  if (!notes) return [];
  const block = notes.match(/(?:^|\n\n)RFIS:\n([\s\S]*?)(?=\n\n[A-Z][A-Z /]+:\n|$)/)?.[1];
  if (!block) return [];
  return block.split("\n").filter(Boolean).map((line) => {
    const [rfiNumber = "", description = "", status = "", responsible = ""] = line.split("|").map((value) => value.trim());
    return { rfiNumber, description, status, responsible };
  });
};

const parseLegacyDeliverableRows = (notes: string | null) => {
  if (!notes) return [];
  const block = notes.match(/(?:^|\n\n)DELIVERABLES:\n([\s\S]*?)(?=\n\n[A-Z][A-Z /]+:\n|$)/)?.[1];
  if (!block) return [];
  return block.split("\n").filter(Boolean).map((line) => ({ raw: line }));
};

const parseLegacyViewpointRows = (notes: string | null) => {
  if (!notes) return [];
  const block = notes.match(/(?:^|\n\n)VIEWPOINTS:\n([\s\S]*?)(?=\n\n[A-Z][A-Z /]+:\n|$)/)?.[1];
  if (!block) return [];
  return block.split("\n").filter(Boolean).map((line) => ({ raw: line }));
};

type DisciplineBucket = "plumbing" | "hvac" | "fireProtection" | "electrical" | "other" | null;

function cleanLabel(value: string | null | undefined) {
  return value?.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ") || null;
}

function titleLabel(value: string | null | undefined) {
  const cleaned = cleanLabel(value);
  return cleaned ? cleaned.replace(/\b\w/g, character => character.toUpperCase()) : null;
}

function submittalDiscipline(submittal: typeof submittalsTable.$inferSelect) {
  if (cleanLabel(submittal.trade)) return titleLabel(submittal.trade);
  const fallback = `${submittal.submittalCategory || ""} ${submittal.submittalType || ""}`.toLowerCase();
  if (fallback.includes("plumb")) return "Plumbing";
  if (fallback.includes("hvac") || fallback.includes("mechanical")) return "HVAC";
  if (fallback.includes("fire protection") || fallback.includes("fire suppression") || fallback.includes("sprinkler")) return "Fire Protection";
  if (fallback.includes("electr")) return "Electrical";
  return null;
}

function submittalDisciplineBucket(discipline: string | null): DisciplineBucket {
  const key = discipline?.toLowerCase() || "";
  if (!key) return null;
  if (key.includes("plumb")) return "plumbing";
  if (key.includes("hvac") || key.includes("mechanical")) return "hvac";
  if (key.includes("fire protection") || key.includes("fire suppression") || key.includes("sprinkler")) return "fireProtection";
  if (key.includes("electr")) return "electrical";
  return "other";
}

function submittalResponsible(submittal: typeof submittalsTable.$inferSelect, assignedToName?: string | null) {
  return cleanLabel(submittal.ballInCourt || assignedToName || submittal.responsibleCompany || submittal.submittedToPerson || submittal.submittedToCompany);
}

const serializeMeetingSubmittalLink = (link: typeof meetingSubmittalLinksTable.$inferSelect) => ({
  id: link.id,
  submittalId: link.submittalId,
  number: link.numberSnapshot,
  title: link.titleSnapshot,
  description: link.descriptionSnapshot,
  floor: link.floorSnapshot,
  discipline: link.disciplineSnapshot,
  disciplineBucket: link.disciplineBucketSnapshot as DisciplineBucket,
  status: link.statusSnapshot,
  responsible: link.responsibleSnapshot,
  deadline: link.deadlineSnapshot,
  linkedAt: link.createdAt,
  valuesMode: "snapshot" as const,
});

async function getMeetingSubmittalLinks(meetingId: number) {
  const links = await db.select().from(meetingSubmittalLinksTable)
    .where(eq(meetingSubmittalLinksTable.meetingId, meetingId))
    .orderBy(asc(meetingSubmittalLinksTable.id));
  return links.map(serializeMeetingSubmittalLink);
}

const serializeMeetingRfiLink = (link: typeof meetingRfiLinksTable.$inferSelect) => ({
  id: link.id,
  rfiId: link.rfiId,
  rfiNumber: link.rfiNumberSnapshot,
  title: link.titleSnapshot,
  description: link.descriptionSnapshot,
  status: link.statusSnapshot,
  responsible: link.responsibleSnapshot,
  linkedAt: link.createdAt,
  valuesMode: "snapshot" as const,
});

async function getMeetingRfiLinks(meetingId: number) {
  const links = await db.select().from(meetingRfiLinksTable)
    .where(eq(meetingRfiLinksTable.meetingId, meetingId))
    .orderBy(asc(meetingRfiLinksTable.id));
  return links.map(serializeMeetingRfiLink);
}

const ELIGIBLE_CLASH_STATUSES = ["open", "follow_up"] as const;

function clashDiscipline(clash: typeof clashesTable.$inferSelect) {
  return [cleanLabel(clash.discipline1), cleanLabel(clash.discipline2)].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(" / ") || null;
}

function clashSnapshot(clash: typeof clashesTable.$inferSelect) {
  return {
    clashReportIdSnapshot: clash.clashReportId,
    clashNumberSnapshot: clash.clashIdOriginal?.trim() || `Clash ${clash.id}`,
    descriptionSnapshot: cleanLabel(clash.description || clash.name),
    floorSnapshot: cleanLabel(clash.level || clash.gridLocation),
    disciplineSnapshot: clashDiscipline(clash),
    responsibleSnapshot: cleanLabel(clash.assignedToName),
    groupSnapshot: cleanLabel(clash.testName),
    statusSnapshot: clash.status || "open",
    deadlineSnapshot: clash.dueDate,
  };
}

const serializeMeetingClashLink = (link: typeof meetingClashLinksTable.$inferSelect) => ({
  id: link.id, clashId: link.clashId, clashReportId: link.clashReportIdSnapshot,
  number: link.clashNumberSnapshot, description: link.descriptionSnapshot,
  floor: link.floorSnapshot, discipline: link.disciplineSnapshot,
  responsible: link.responsibleSnapshot, group: link.groupSnapshot,
  status: link.statusSnapshot, deadline: link.deadlineSnapshot,
  meetingNotes: link.meetingNotes, linkState: link.linkState,
  firstLoadedAt: link.firstLoadedAt, lastRefreshedAt: link.lastRefreshedAt,
  valuesMode: "explicit_snapshot" as const,
});

async function getMeetingClashLinks(meetingId: number) {
  const links = await db.select().from(meetingClashLinksTable)
    .where(eq(meetingClashLinksTable.meetingId, meetingId)).orderBy(asc(meetingClashLinksTable.id));
  const events = await db.select().from(meetingClashRefreshEventsTable)
    .where(eq(meetingClashRefreshEventsTable.meetingId, meetingId)).orderBy(desc(meetingClashRefreshEventsTable.createdAt));
  return { links: links.map(serializeMeetingClashLink), events: events.map(event => ({
    eventType: event.eventType, added: event.addedCount, updated: event.updatedCount,
    unchanged: event.unchangedCount, sourceExcluded: event.excludedCount,
    userExcluded: event.userExcludedCount, failures: event.failureCount,
    open: event.openCount, followUp: event.followUpCount,
    changedFields: JSON.parse(event.changedFields || "[]"), createdAt: event.createdAt,
  })) };
}

async function requireMeeting(executor: any, projectId: number, meetingId: number) {
  const [meeting] = await executor.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
    .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
  if (!meeting) throw new MeetingClashLinkError(404, "meeting_not_found");
}

class MeetingClashLinkError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

class MeetingRfiLinkError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

class MeetingSubmittalLinkError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

async function insertMeetingSubmittalLinks(executor: any, projectId: number, meetingId: number, rawSubmittalIds: number[], userId: number) {
  const submittalIds = [...new Set(rawSubmittalIds.filter(Number.isInteger))];
  if (!submittalIds.length) return { requested: 0, added: 0 };

  const [meeting] = await executor.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
    .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
  if (!meeting) throw new MeetingSubmittalLinkError(404, "meeting_not_found");

  const rows = await executor.select({ submittal: submittalsTable, assignedToName: usersTable.fullName })
    .from(submittalsTable).leftJoin(usersTable, eq(submittalsTable.assignedToId, usersTable.id))
    .where(and(inArray(submittalsTable.id, submittalIds), eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt)));
  if (rows.length !== submittalIds.length) throw new MeetingSubmittalLinkError(404, "submittal_not_accessible");

  const inserted = await executor.insert(meetingSubmittalLinksTable).values(rows.map(({ submittal, assignedToName }: any) => {
    const discipline = submittalDiscipline(submittal);
    return {
      projectId, meetingId, submittalId: submittal.id,
      numberSnapshot: submittal.number,
      titleSnapshot: submittal.title,
      descriptionSnapshot: submittal.description || null,
      floorSnapshot: cleanLabel(submittal.floor),
      disciplineSnapshot: discipline,
      disciplineBucketSnapshot: submittalDisciplineBucket(discipline),
      statusSnapshot: submittal.status,
      responsibleSnapshot: submittalResponsible(submittal, assignedToName),
      deadlineSnapshot: submittal.dateRequired || submittal.dueDate || null,
      createdById: userId,
    };
  })).onConflictDoNothing({ target: [meetingSubmittalLinksTable.meetingId, meetingSubmittalLinksTable.submittalId] })
    .returning({ id: meetingSubmittalLinksTable.id });
  return { requested: submittalIds.length, added: inserted.length };
}

async function insertMeetingRfiLinks(executor: any, projectId: number, meetingId: number, rawRfiIds: number[], userId: number) {
  const rfiIds = [...new Set(rawRfiIds.filter(Number.isInteger))];
  if (!rfiIds.length) return { requested: 0, added: 0 };

  const [meeting] = await executor.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
    .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
  if (!meeting) throw new MeetingRfiLinkError(404, "meeting_not_found");

  const rows = await executor.select({
    id: rfisTable.id, number: rfisTable.number, subject: rfisTable.subject,
    description: rfisTable.description, question: rfisTable.question, status: rfisTable.status,
    ballInCourt: rfisTable.ballInCourt, submittedToPerson: rfisTable.submittedToPerson,
    submittedToCompany: rfisTable.submittedToCompany, assignedToName: usersTable.fullName,
  }).from(rfisTable).leftJoin(usersTable, eq(rfisTable.assignedToId, usersTable.id))
    .where(and(inArray(rfisTable.id, rfiIds), eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt)));

  if (rows.length !== rfiIds.length) {
    // Deliberately do not reveal whether an inaccessible identity exists in a
    // different project or was deleted.
    throw new MeetingRfiLinkError(404, "rfi_not_accessible");
  }

  const inserted = await executor.insert(meetingRfiLinksTable).values(rows.map((r: any) => ({
    projectId, meetingId, rfiId: r.id,
    rfiNumberSnapshot: r.number,
    titleSnapshot: r.subject || r.description || r.question || r.number,
    descriptionSnapshot: r.description || r.question || null,
    statusSnapshot: r.status,
    responsibleSnapshot: r.ballInCourt || r.assignedToName || r.submittedToPerson || r.submittedToCompany || null,
    createdById: userId,
  }))).onConflictDoNothing({ target: [meetingRfiLinksTable.meetingId, meetingRfiLinksTable.rfiId] }).returning({ id: meetingRfiLinksTable.id });
  return { requested: rfiIds.length, added: inserted.length };
}

// ── GET /projects/:projectId/meetings ─────────────────────────────────────────
router.get("/projects/:projectId/meetings", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const meetings = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt)))
      .orderBy(desc(meetingMinutesTable.meetingDate));
    const result = await Promise.all(meetings.map(async m => {
      const attendees = await db.select({ id: meetingAttendeesTable.id }).from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, m.id));
      const actionItems = await db.select({ id: actionItemsTable.id, status: actionItemsTable.status }).from(actionItemsTable).where(eq(actionItemsTable.meetingId, m.id));
      const linkedRfis = await getMeetingRfiLinks(m.id);
      const linkedSubmittals = await getMeetingSubmittalLinks(m.id);
      const clashes = await getMeetingClashLinks(m.id);
      return { ...m, attendeeCount: attendees.length, actionItemCount: actionItems.length, openActionItems: actionItems.filter(a => a.status !== "completed" && a.status !== "cancelled").length, linkedRfis, linkedSubmittals, linkedClashes: clashes.links, clashRefreshEvents: clashes.events, legacyRfis: parseLegacyRfiRows(m.notes), legacyDeliverables: parseLegacyDeliverableRows(m.notes), legacyViewpoints: parseLegacyViewpointRows(m.notes) };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings ────────────────────────────────────────
router.post("/projects/:projectId/meetings", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as {
    title: string; meeting_date: string; location?: string; notes?: string;
    attendees?: { user_id?: number; external_email?: string; full_name: string; company?: string; role?: string }[];
    rfi_ids?: number[];
    submittal_ids?: number[];
  };
  if (!body.title || !body.meeting_date) { res.status(400).json({ error: "title and meeting_date required" }); return; }
  try {
    if (body.rfi_ids !== undefined && (!Array.isArray(body.rfi_ids) || body.rfi_ids.some(id => !Number.isInteger(id)))) {
      res.status(400).json({ error: "valid_rfi_ids_required" }); return;
    }
    if (body.submittal_ids !== undefined && (!Array.isArray(body.submittal_ids) || body.submittal_ids.some(id => !Number.isInteger(id)))) {
      res.status(400).json({ error: "valid_submittal_ids_required" }); return;
    }
    const meeting = await db.transaction(async (tx) => {
      const [created] = await tx.insert(meetingMinutesTable).values({
        projectId, title: body.title,
        meetingDate: new Date(body.meeting_date),
        location: body.location ?? null, notes: body.notes ?? null,
        createdById: req.user!.userId,
      }).returning();

      if (body.attendees?.length) {
        await tx.insert(meetingAttendeesTable).values(body.attendees.map(a => ({
          meetingId: created.id, userId: a.user_id ?? null,
          externalEmail: a.external_email ?? null, fullName: a.full_name,
          company: a.company ?? null, role: a.role ?? null,
        })));
      }
      await insertMeetingRfiLinks(tx, projectId, created.id, body.rfi_ids ?? [], req.user!.userId);
      await insertMeetingSubmittalLinks(tx, projectId, created.id, body.submittal_ids ?? [], req.user!.userId);
      await tx.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
        actionType: "create", entityType: "meeting", entityId: created.id,
        fileNameBefore: null, fileNameAfter: null,
        details: `Created meeting: ${body.title} on ${new Date(body.meeting_date).toLocaleDateString()}`,
      });
      return created;
    });
    res.status(201).json(meeting);
  } catch (err) {
    if (err instanceof MeetingRfiLinkError) { res.status(err.status).json({ error: err.code }); return; }
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// Selector payload is intentionally minimal: no attachments, URLs, storage
// locators, or private audit data are exposed.
router.get("/projects/:projectId/meetings/rfi-candidates", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const q = String(req.query.q ?? "").trim();
  const meetingId = req.query.meeting_id ? Number(req.query.meeting_id) : null;
  try {
    let alreadyLinked = new Set<number>();
    if (meetingId !== null) {
      const [meeting] = await db.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
        .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
      if (!meeting) { res.status(404).json({ error: "meeting_not_found" }); return; }
      alreadyLinked = new Set((await db.select({ rfiId: meetingRfiLinksTable.rfiId }).from(meetingRfiLinksTable)
        .where(and(eq(meetingRfiLinksTable.projectId, projectId), eq(meetingRfiLinksTable.meetingId, meetingId)))).map(row => row.rfiId));
    }
    const base = and(eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt));
    const where = q ? and(base, or(
      ilike(rfisTable.number, `%${q}%`), ilike(rfisTable.subject, `%${q}%`),
      ilike(rfisTable.description, `%${q}%`), ilike(rfisTable.question, `%${q}%`),
    )) : base;
    const candidates = await db.select({
      id: rfisTable.id, number: rfisTable.number, title: rfisTable.subject,
      description: rfisTable.description, question: rfisTable.question, status: rfisTable.status,
      ballInCourt: rfisTable.ballInCourt, submittedToPerson: rfisTable.submittedToPerson,
      submittedToCompany: rfisTable.submittedToCompany, assignedToName: usersTable.fullName,
    }).from(rfisTable).leftJoin(usersTable, eq(rfisTable.assignedToId, usersTable.id))
      .where(where).orderBy(asc(rfisTable.number)).limit(100);
    res.json(candidates.map(rfi => ({
      id: rfi.id, number: rfi.number,
      title: rfi.title || rfi.description || rfi.question || rfi.number,
      description: rfi.description || rfi.question || null,
      status: rfi.status,
      responsible: rfi.ballInCourt || rfi.assignedToName || rfi.submittedToPerson || rfi.submittedToCompany || null,
      alreadyAdded: alreadyLinked.has(rfi.id),
    })));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/meetings/:meetingId/rfis", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const rfiIds = req.body?.rfi_ids;
  if (!Array.isArray(rfiIds) || rfiIds.length === 0 || rfiIds.some((id: unknown) => !Number.isInteger(id))) {
    res.status(400).json({ error: "valid_rfi_ids_required" }); return;
  }
  try {
    const result = await db.transaction(tx => insertMeetingRfiLinks(tx, projectId, meetingId, rfiIds, req.user!.userId));
    res.status(result.added ? 201 : 200).json({ ...result, links: await getMeetingRfiLinks(meetingId) });
  } catch (err) {
    if (err instanceof MeetingRfiLinkError) { res.status(err.status).json({ error: err.code }); return; }
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.delete("/projects/:projectId/meetings/:meetingId/rfis/:rfiId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const rfiId = Number(req.params.rfiId);
  try {
    const [meeting] = await db.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
    if (!meeting) { res.status(404).json({ error: "meeting_not_found" }); return; }
    const removed = await db.delete(meetingRfiLinksTable).where(and(
      eq(meetingRfiLinksTable.projectId, projectId), eq(meetingRfiLinksTable.meetingId, meetingId), eq(meetingRfiLinksTable.rfiId, rfiId),
    )).returning({ id: meetingRfiLinksTable.id });
    if (!removed.length) { res.status(404).json({ error: "meeting_rfi_link_not_found" }); return; }
    res.json({ removed: true, rfiId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// Minimal project-scoped selector payload: attachments, storage locators,
// contact details, audit data, and all other private fields are excluded.
router.get("/projects/:projectId/meetings/submittal-candidates", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const floor = String(req.query.floor ?? "").trim().toLowerCase();
  const disciplineFilter = String(req.query.discipline ?? "").trim().toLowerCase();
  const status = String(req.query.status ?? "").trim().toLowerCase();
  const responsibleFilter = String(req.query.responsible ?? "").trim().toLowerCase();
  const meetingId = req.query.meeting_id ? Number(req.query.meeting_id) : null;
  try {
    let alreadyLinked = new Set<number>();
    if (meetingId !== null) {
      const [meeting] = await db.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
        .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
      if (!meeting) { res.status(404).json({ error: "meeting_not_found" }); return; }
      alreadyLinked = new Set((await db.select({ submittalId: meetingSubmittalLinksTable.submittalId }).from(meetingSubmittalLinksTable)
        .where(and(eq(meetingSubmittalLinksTable.projectId, projectId), eq(meetingSubmittalLinksTable.meetingId, meetingId)))).map(row => row.submittalId));
    }
    const rows = await db.select({ submittal: submittalsTable, assignedToName: usersTable.fullName })
      .from(submittalsTable).leftJoin(usersTable, eq(submittalsTable.assignedToId, usersTable.id))
      .where(and(eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt)))
      .orderBy(asc(submittalsTable.number));
    const candidates = rows.map(({ submittal, assignedToName }) => {
      const discipline = submittalDiscipline(submittal);
      const responsible = submittalResponsible(submittal, assignedToName);
      return {
        id: submittal.id,
        number: submittal.number,
        title: submittal.title,
        description: submittal.description || null,
        floor: cleanLabel(submittal.floor),
        discipline,
        disciplineBucket: submittalDisciplineBucket(discipline),
        status: submittal.status,
        responsible,
        deadline: submittal.dateRequired || submittal.dueDate || null,
        alreadyAdded: alreadyLinked.has(submittal.id),
      };
    }).filter(candidate => {
      const text = `${candidate.number} ${candidate.title} ${candidate.description || ""}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (floor && (candidate.floor || "").toLowerCase() !== floor) return false;
      if (disciplineFilter && (candidate.discipline || "").toLowerCase() !== disciplineFilter) return false;
      if (status && candidate.status.toLowerCase() !== status) return false;
      if (responsibleFilter && !(candidate.responsible || "").toLowerCase().includes(responsibleFilter)) return false;
      return true;
    }).slice(0, 200);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/meetings/:meetingId/submittals", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const submittalIds = req.body?.submittal_ids;
  if (!Array.isArray(submittalIds) || submittalIds.length === 0 || submittalIds.some((id: unknown) => !Number.isInteger(id))) {
    res.status(400).json({ error: "valid_submittal_ids_required" }); return;
  }
  try {
    const result = await db.transaction(tx => insertMeetingSubmittalLinks(tx, projectId, meetingId, submittalIds, req.user!.userId));
    res.status(result.added ? 201 : 200).json({ ...result, links: await getMeetingSubmittalLinks(meetingId) });
  } catch (err) {
    if (err instanceof MeetingSubmittalLinkError) { res.status(err.status).json({ error: err.code }); return; }
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.delete("/projects/:projectId/meetings/:meetingId/submittals/:submittalId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const submittalId = Number(req.params.submittalId);
  try {
    const [meeting] = await db.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))).limit(1);
    if (!meeting) { res.status(404).json({ error: "meeting_not_found" }); return; }
    const removed = await db.delete(meetingSubmittalLinksTable).where(and(
      eq(meetingSubmittalLinksTable.projectId, projectId),
      eq(meetingSubmittalLinksTable.meetingId, meetingId),
      eq(meetingSubmittalLinksTable.submittalId, submittalId),
    )).returning({ id: meetingSubmittalLinksTable.id });
    if (!removed.length) { res.status(404).json({ error: "meeting_submittal_link_not_found" }); return; }
    res.json({ removed: true, submittalId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/meetings/:meetingId ──────────────────────────────
type ClashSyncMode = "initial_load" | "refresh";

async function syncMeetingClashes(projectId: number, meetingId: number, actor: { userId: number; fullName?: string; companyName?: string }, mode: ClashSyncMode) {
  return db.transaction(async (tx) => {
    await requireMeeting(tx, projectId, meetingId);
    const now = new Date();
    const canonical = await tx.select().from(clashesTable).where(eq(clashesTable.projectId, projectId));
    const reportIds = new Set((await tx.select({ id: clashReportsTable.id }).from(clashReportsTable).where(eq(clashReportsTable.projectId, projectId))).map(report => report.id));
    const eligible = canonical.filter(clash => reportIds.has(clash.clashReportId) && !clash.deletedAt && ELIGIBLE_CLASH_STATUSES.includes((clash.status || "") as typeof ELIGIBLE_CLASH_STATUSES[number]));
    const existing = await tx.select().from(meetingClashLinksTable).where(and(eq(meetingClashLinksTable.projectId, projectId), eq(meetingClashLinksTable.meetingId, meetingId)));
    const existingByClash = new Map(existing.map(link => [link.clashId, link]));
    const canonicalById = new Map(canonical.map(clash => [clash.id, clash]));
    const changedFields = new Set<string>();
    let updated = 0, unchanged = 0, sourceExcluded = 0;
    let userExcluded = existing.filter(link => link.linkState === "removed_by_user").length;

    if (mode === "refresh") for (const link of existing) {
      if (link.linkState === "removed_by_user") continue;
      const source = canonicalById.get(link.clashId);
      const sourceEligible = !!source && reportIds.has(source.clashReportId) && !source.deletedAt && ELIGIBLE_CLASH_STATUSES.includes((source.status || "") as typeof ELIGIBLE_CLASH_STATUSES[number]);
      if (!sourceEligible) {
        sourceExcluded++;
        if (link.linkState === "source_closed_or_excluded") unchanged++;
        else {
          await tx.update(meetingClashLinksTable).set({ linkState: "source_closed_or_excluded", lastRefreshedAt: now, updatedAt: now }).where(eq(meetingClashLinksTable.id, link.id));
          updated++; changedFields.add("link_state");
        }
        continue;
      }
      const snapshot = clashSnapshot(source!);
      const changes: Record<string, unknown> = {};
      const pairs: Array<[keyof typeof snapshot, keyof typeof link, string]> = [
        ["clashReportIdSnapshot", "clashReportIdSnapshot", "clash_report"], ["clashNumberSnapshot", "clashNumberSnapshot", "number"],
        ["descriptionSnapshot", "descriptionSnapshot", "description"], ["floorSnapshot", "floorSnapshot", "floor"],
        ["disciplineSnapshot", "disciplineSnapshot", "discipline"], ["responsibleSnapshot", "responsibleSnapshot", "responsible"],
        ["groupSnapshot", "groupSnapshot", "group"], ["statusSnapshot", "statusSnapshot", "status"],
      ];
      for (const [snapshotKey, linkKey, label] of pairs) if ((snapshot[snapshotKey] ?? null) !== (link[linkKey] ?? null)) { changes[snapshotKey] = snapshot[snapshotKey]; changedFields.add(label); }
      if ((snapshot.deadlineSnapshot?.getTime() ?? null) !== (link.deadlineSnapshot?.getTime() ?? null)) { changes.deadlineSnapshot = snapshot.deadlineSnapshot; changedFields.add("deadline"); }
      if (link.linkState !== "active") { changes.linkState = "active"; changedFields.add("link_state"); }
      if (Object.keys(changes).length) { await tx.update(meetingClashLinksTable).set({ ...changes, lastRefreshedAt: now, updatedAt: now }).where(eq(meetingClashLinksTable.id, link.id)); updated++; }
      else unchanged++;
    }

    const toInsert = eligible.filter(clash => !existingByClash.has(clash.id));
    const inserted = toInsert.length ? await tx.insert(meetingClashLinksTable).values(toInsert.map(clash => ({
      projectId, meetingId, clashId: clash.id, ...clashSnapshot(clash), linkState: "active", firstLoadedAt: now, lastRefreshedAt: now, createdById: actor.userId, updatedAt: now,
    }))).onConflictDoNothing({ target: [meetingClashLinksTable.meetingId, meetingClashLinksTable.clashId] }).returning({ id: meetingClashLinksTable.id }) : [];

    if (mode === "initial_load") {
      const linkedEligible = eligible.map(clash => existingByClash.get(clash.id)).filter(Boolean);
      unchanged = linkedEligible.filter(link => link!.linkState === "active").length;
      userExcluded = linkedEligible.filter(link => link!.linkState === "removed_by_user").length;
      sourceExcluded = linkedEligible.filter(link => link!.linkState === "source_closed_or_excluded").length;
    }
    const summary = { reviewed: canonical.length, added: inserted.length, updated, unchanged, sourceExcluded, userExcluded, failures: 0,
      open: eligible.filter(clash => clash.status === "open").length, followUp: eligible.filter(clash => clash.status === "follow_up").length, changedFields: [...changedFields].sort() };
    await tx.insert(meetingClashRefreshEventsTable).values({ projectId, meetingId, actorId: actor.userId, eventType: mode, addedCount: summary.added, updatedCount: summary.updated, unchangedCount: summary.unchanged, excludedCount: summary.sourceExcluded, userExcludedCount: summary.userExcluded, failureCount: 0, openCount: summary.open, followUpCount: summary.followUp, changedFields: JSON.stringify(summary.changedFields), createdAt: now });
    await tx.insert(activityLogTable).values({ projectId, userId: actor.userId, userFullName: actor.fullName ?? "", userCompanyName: actor.companyName ?? "", actionType: mode === "initial_load" ? "load_clashes" : "refresh_clashes", entityType: "meeting", entityId: meetingId, details: JSON.stringify(summary) });
    return summary;
  });
}

router.post("/projects/:projectId/meetings/:meetingId/clashes/load", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try { const summary = await syncMeetingClashes(Number(req.params.projectId), Number(req.params.meetingId), req.user!, "initial_load"); res.json({ summary, ...(await getMeetingClashLinks(Number(req.params.meetingId))) }); }
  catch (err) { if (err instanceof MeetingClashLinkError) { res.status(err.status).json({ error: err.code }); return; } res.status(500).json({ error: "clash_load_failed" }); }
});

router.post("/projects/:projectId/meetings/:meetingId/clashes/refresh", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try { const summary = await syncMeetingClashes(Number(req.params.projectId), Number(req.params.meetingId), req.user!, "refresh"); res.json({ summary, ...(await getMeetingClashLinks(Number(req.params.meetingId))) }); }
  catch (err) { if (err instanceof MeetingClashLinkError) { res.status(err.status).json({ error: err.code }); return; } res.status(500).json({ error: "clash_refresh_failed" }); }
});

router.patch("/projects/:projectId/meetings/:meetingId/clashes/:clashId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId), meetingId = Number(req.params.meetingId), clashId = Number(req.params.clashId);
  const action = req.body?.action, meetingNotes = req.body?.meeting_notes;
  if (action !== undefined && action !== "remove" && action !== "restore") { res.status(400).json({ error: "invalid_action" }); return; }
  if (meetingNotes !== undefined && typeof meetingNotes !== "string") { res.status(400).json({ error: "invalid_meeting_notes" }); return; }
  try {
    const result = await db.transaction(async tx => {
      await requireMeeting(tx, projectId, meetingId);
      const [link] = await tx.select().from(meetingClashLinksTable).where(and(eq(meetingClashLinksTable.projectId, projectId), eq(meetingClashLinksTable.meetingId, meetingId), eq(meetingClashLinksTable.clashId, clashId))).limit(1);
      if (!link) throw new MeetingClashLinkError(404, "meeting_clash_link_not_found");
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (meetingNotes !== undefined) updates.meetingNotes = meetingNotes.trim() || null;
      if (action === "remove") updates.linkState = "removed_by_user";
      if (action === "restore") {
        const [source] = await tx.select().from(clashesTable).where(and(eq(clashesTable.id, clashId), eq(clashesTable.projectId, projectId), isNull(clashesTable.deletedAt))).limit(1);
        if (!source || !ELIGIBLE_CLASH_STATUSES.includes((source.status || "") as typeof ELIGIBLE_CLASH_STATUSES[number])) throw new MeetingClashLinkError(409, "clash_not_eligible_for_restore");
        const [report] = await tx.select({ id: clashReportsTable.id }).from(clashReportsTable).where(and(eq(clashReportsTable.id, source.clashReportId), eq(clashReportsTable.projectId, projectId))).limit(1);
        if (!report) throw new MeetingClashLinkError(404, "clash_not_accessible");
        Object.assign(updates, clashSnapshot(source), { linkState: "active", lastRefreshedAt: new Date() });
      }
      const [updatedLink] = await tx.update(meetingClashLinksTable).set(updates).where(eq(meetingClashLinksTable.id, link.id)).returning();
      if (action) await tx.insert(activityLogTable).values({ projectId, userId: req.user!.userId, userFullName: req.user!.fullName ?? "", userCompanyName: req.user!.companyName ?? "", actionType: action === "remove" ? "remove_clash_from_meeting" : "restore_clash_to_meeting", entityType: "meeting", entityId: meetingId, details: JSON.stringify({ clashId }) });
      return updatedLink;
    });
    res.json(serializeMeetingClashLink(result));
  } catch (err) { if (err instanceof MeetingClashLinkError) { res.status(err.status).json({ error: err.code }); return; } res.status(500).json({ error: "meeting_clash_update_failed" }); }
});

router.get("/projects/:projectId/meetings/:meetingId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  try {
    const [meeting] = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }
    const attendees = await db.select().from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, meetingId));
    const actionItems = await db.select().from(actionItemsTable).where(eq(actionItemsTable.meetingId, meetingId));
    const clashes = await getMeetingClashLinks(meetingId);
    res.json({ ...meeting, attendees, actionItems, linkedRfis: await getMeetingRfiLinks(meetingId), linkedSubmittals: await getMeetingSubmittalLinks(meetingId), linkedClashes: clashes.links, clashRefreshEvents: clashes.events, legacyRfis: parseLegacyRfiRows(meeting.notes), legacyDeliverables: parseLegacyDeliverableRows(meeting.notes), legacyViewpoints: parseLegacyViewpointRows(meeting.notes) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/meetings/:meetingId ────────────────────────────
router.patch("/projects/:projectId/meetings/:meetingId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const body = req.body as Partial<{ title: string; notes: string; location: string; ai_summary: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)      updates.title      = body.title;
    if (body.notes !== undefined)      updates.notes      = body.notes;
    if (body.location !== undefined)   updates.location   = body.location;
    if (body.ai_summary !== undefined) updates.aiSummary  = body.ai_summary;
    const [updated] = await db.update(meetingMinutesTable).set(updates as any)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/:meetingId/ai-summary ──────────────────
router.post("/projects/:projectId/meetings/:meetingId/ai-summary", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  try {
    const [meeting] = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

    const prompt = `You are a construction project manager. Summarize these meeting notes and extract action items.
Meeting: ${meeting.title} on ${new Date(meeting.meetingDate).toLocaleDateString()}
Notes: ${meeting.notes ?? "(no notes)"}
Return JSON only: { "summary": "...", "action_items": [{ "description": "...", "assigned_to_name": "...", "assigned_to_email": "...", "due_date": "YYYY-MM-DD or null" }] }`;

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      projectId,
      feature: "meeting_ai_summary",
    });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5", max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

    await db.update(meetingMinutesTable).set({ aiSummary: parsed.summary, updatedAt: new Date() })
      .where(eq(meetingMinutesTable.id, meetingId));
    res.json(parsed);
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/:meetingId/action-items ────────────────
router.post("/projects/:projectId/meetings/:meetingId/action-items", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const body = req.body as { items: { description: string; assigned_to_id?: number; assigned_to_name?: string; assigned_to_email?: string; due_date?: string }[] };
  if (!body.items?.length) { res.status(400).json({ error: "items required" }); return; }
  try {
    const created = await db.insert(actionItemsTable).values(
      body.items.map(i => ({
        meetingId, projectId, description: i.description,
        assignedToId: i.assigned_to_id ?? null,
        assignedToName: i.assigned_to_name ?? null,
        assignedToExternalEmail: i.assigned_to_email ?? null,
        dueDate: i.due_date ? new Date(i.due_date) : null,
        status: "open" as const,
      }))
    ).returning();

    // Notify assigned BIMLog users
    for (const item of created) {
      if (item.assignedToId) {
        await createNotification(item.assignedToId, projectId, "action_item_due",
          "New Action Item", item.description,
          `/projects/${projectId}/meetings`);
      }
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "action_items", entityId: meetingId,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created ${created.length} action item(s) for meeting`,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/action-items ─────────────────────────────────────
router.get("/projects/:projectId/action-items", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const items = await db.select().from(actionItemsTable)
      .where(and(eq(actionItemsTable.projectId, projectId), ne(actionItemsTable.status, "cancelled")))
      .orderBy(desc(actionItemsTable.createdAt));
    const now = Date.now();
    const withOverdue = items.map(i => ({
      ...i,
      isOverdue: i.status !== "completed" && i.dueDate && new Date(i.dueDate).getTime() < now,
    }));
    res.json(withOverdue);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/action-items/:itemId ───────────────────────────
router.patch("/projects/:projectId/action-items/:itemId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const itemId = Number(req.params.itemId);
  const body = req.body as Partial<{ status: string; description: string; due_date: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed") updates.completedAt = new Date();
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.due_date !== undefined)    updates.dueDate = body.due_date ? new Date(body.due_date) : null;
    const [updated] = await db.update(actionItemsTable).set(updates as any)
      .where(and(eq(actionItemsTable.id, itemId), eq(actionItemsTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/transcribe-audio ───────────────────────
router.post("/projects/:projectId/meetings/transcribe-audio",
  authMiddleware,
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }).single("audio"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const [userRow] = await db.select({ openaiApiKey: usersTable.openaiApiKey })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId));
      if (!userRow?.openaiApiKey) {
        res.status(400).json({ error: "no_openai_key", message: "OpenAI API key not configured. Add it in your Profile." });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "no_file", message: "No audio file uploaded." });
        return;
      }

      const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "";
      const allowedExts = ["mp3","mp4","m4a","wav","webm","ogg"];
      if (!allowedExts.includes(ext)) {
        res.status(400).json({ error: "invalid_format", message: "Unsupported format. Use MP3, MP4, M4A, WAV, WebM, or OGG." });
        return;
      }

      const CHUNK_SIZE = 20 * 1024 * 1024;
      const fileBuffer = req.file.buffer;
      const fileSizeMB = Math.round(fileBuffer.length / 1024 / 1024);

      async function transcribeBuffer(buf: Buffer, filename: string): Promise<string> {
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const { OpenAI } = await import("openai");
        const openaiClient = new OpenAI({ apiKey: userRow.openaiApiKey as string });
        const tmpPath = path.join(os.tmpdir(), `whisper_${Date.now()}_${filename}`);
        fs.writeFileSync(tmpPath, buf);
        try {
          const response = await openaiClient.audio.transcriptions.create({
            file: fs.createReadStream(tmpPath) as any,
            model: "whisper-1",
          });
          return response.text ?? "";
        } finally {
          try { fs.unlinkSync(tmpPath); } catch (cleanupError) {
            console.warn("[meeting_minutes] Failed to remove transcription temp file:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
          }
        }
      }

      let fullTranscript = "";

      if (fileBuffer.length <= CHUNK_SIZE) {
        const { execSync } = await import("child_process");
        const os = await import("os");
        const fs = await import("fs");
        const path = await import("path");
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, `bimlog_audio_${Date.now()}.${ext}`);
        const outputPath = path.join(tmpDir, `bimlog_compressed_${Date.now()}.mp3`);
        fs.writeFileSync(inputPath, fileBuffer);
        try {
          execSync(`${FFMPEG_PATH} -i "${inputPath}" -ar 16000 -ac 1 -b:a 64k "${outputPath}" -y`, { stdio: "pipe" });
          const compressed = fs.readFileSync(outputPath);
          fullTranscript = await transcribeBuffer(compressed, "audio.mp3");
        } finally {
          try { fs.unlinkSync(inputPath); } catch (cleanupError) {
            console.warn("[meeting_minutes] Failed to remove input temp file:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
          }
          try { fs.unlinkSync(outputPath); } catch (cleanupError) {
            console.warn("[meeting_minutes] Failed to remove compressed temp file:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
          }
        }
      } else {
        const { execSync } = await import("child_process");
        const os = await import("os");
        const fs = await import("fs");
        const path = await import("path");
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, `bimlog_audio_${Date.now()}.${ext}`);
        const compressedPath = path.join(tmpDir, `bimlog_compressed_${Date.now()}.mp3`);
        fs.writeFileSync(inputPath, fileBuffer);

        try {
          execSync(`${FFMPEG_PATH} -i "${inputPath}" -ar 16000 -ac 1 -b:a 64k "${compressedPath}" -y`, { stdio: "pipe" });
          const compressedBuffer = fs.readFileSync(compressedPath);

          if (compressedBuffer.length <= CHUNK_SIZE) {
            fullTranscript = await transcribeBuffer(compressedBuffer, "audio.mp3");
          } else {
            const numChunks = Math.ceil(compressedBuffer.length / CHUNK_SIZE);
            const transcripts: string[] = [];
            for (let i = 0; i < numChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, compressedBuffer.length);
              const chunk = compressedBuffer.subarray(start, end);
              const chunkPath = path.join(tmpDir, `bimlog_chunk_${Date.now()}_${i}.mp3`);
              fs.writeFileSync(chunkPath, chunk);
              try {
                const chunkTranscript = await transcribeBuffer(chunk, `chunk_${i}.mp3`);
                transcripts.push(chunkTranscript);
              } finally {
                try { fs.unlinkSync(chunkPath); } catch (cleanupError) {
                  console.warn("[meeting_minutes] Failed to remove chunk temp file:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
                }
              }
            }
            fullTranscript = transcripts.join(" ");
          }
        } finally {
          try { fs.unlinkSync(inputPath); } catch (cleanupError) {
            console.warn("[meeting_minutes] Failed to remove large input temp file:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
          }
          try { fs.unlinkSync(compressedPath); } catch (cleanupError) {
            console.warn("[meeting_minutes] Failed to remove large compressed temp file:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
          }
        }
      }

      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "meeting_transcript_analysis",
      });
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are a construction project coordinator assistant.
Extract structured meeting information from this transcript.
Return ONLY valid JSON, no markdown, no explanation.

Transcript:
${fullTranscript}

Return this exact JSON structure:
{
  "title": "meeting title or topic if mentioned",
  "agenda": ["item 1", "item 2"],
  "attendees": [{ "trade": "", "company": "", "fullName": "", "role": "", "email": "", "phone": "" }],
  "rfis": [{ "rfiNumber": "", "description": "", "status": "PENDING", "responsible": "" }],
  "deliverables": [{ "floor": "", "description": "", "plumbing": "", "hvac": "", "fireProt": "", "electrical": "", "other": "", "coordinator": "", "deadline": "" }],
  "viewpoints": [{ "floor": "", "responsible": "", "holdUps": "", "viewpoint": "", "description": "", "deadline": "" }],
  "aiSummary": "two sentence summary of the meeting"
}
For deliverable status fields use only: PENDING, COMPLETE, N/A, or empty string.
For deadlines use MM-DD-YY format if mentioned.
If information is not mentioned use empty string or empty array.`
        }],
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
      res.json({ ...parsed, transcript: fullTranscript, fileSizeMB });

    } catch (err) {
      if (sendAiUsageError(res, err)) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[transcribe-audio] FAILED:", errMsg);
      res.status(500).json({ error: "transcription_failed", message: errMsg });
    }
  }
);

router.post("/projects/:projectId/meetings/import",
  authMiddleware,
  requirePermission("admin", "write"),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "meeting_import",
      });
      let data: any = { title: null, meetingDate: null, meetingTime: null, location: null, meetingNumber: null, notes: null, attendees: [], actionItems: [] };
      if (isPdf && pdfBase64) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: `You are analyzing a construction meeting minutes PDF document.
Extract the meeting information. Return ONLY valid JSON, no markdown. Use null for fields not present:
{
  "title": "meeting title or null",
  "meetingDate": "date string or null",
  "meetingTime": "time string or null",
  "location": "location or null",
  "meetingNumber": "meeting number or null",
  "notes": "general notes or null",
  "attendees": [{"trade":"","company":"","fullName":"","role":"","email":"","phone":""}],
  "actionItems": [{"description":"","assignedToName":"","dueDate":"date or null","status":"open"}]
}` }
              ] as any
            }]
          });
          const text = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "{}";
          const clean = text.replace(/```json\n?|```/g, "").trim();
          const parsed = JSON.parse(clean);
          data = {
            title: parsed.title ?? null,
            meetingDate: parsed.meetingDate ?? null,
            meetingTime: parsed.meetingTime ?? null,
            location: parsed.location ?? null,
            meetingNumber: parsed.meetingNumber ?? null,
            notes: parsed.notes ?? null,
            attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
          };
          console.log("[meeting-import] PDF direct extraction: attendees=", data.attendees.length, "actions=", data.actionItems.length);
        } catch (e) {
          console.error("[meeting-import] PDF direct extraction failed:", e);
        }
      } else {
      for (const chunk of chunks) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `You are analyzing a chunk of a construction meeting minutes document.
Extract the meeting information from this chunk. Return ONLY valid JSON, no markdown. Use null for fields not present in this chunk:
{
  "title": "meeting title or null",
  "meetingDate": "date string or null",
  "meetingTime": "time string or null",
  "location": "location or null",
  "meetingNumber": "meeting number or null",
  "notes": "general notes or null",
  "attendees": [{"trade":"","company":"","fullName":"","role":"","email":"","phone":""}],
  "actionItems": [{"description":"","assignedToName":"","dueDate":"date or null","status":"open"}]
}

Document chunk:
${chunk}`
            }]
          });
          const text = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "{}";
          const clean = text.replace(/```json\n?|```/g, "").trim();
          const chunkData = JSON.parse(clean);
          data.title = data.title || chunkData.title || null;
          data.meetingDate = data.meetingDate || chunkData.meetingDate || null;
          data.meetingTime = data.meetingTime || chunkData.meetingTime || null;
          data.location = data.location || chunkData.location || null;
          data.meetingNumber = data.meetingNumber || chunkData.meetingNumber || null;
          data.notes = [data.notes, chunkData.notes].filter(Boolean).join("\n\n") || null;
          if (Array.isArray(chunkData.attendees)) data.attendees = [...data.attendees, ...chunkData.attendees];
          if (Array.isArray(chunkData.actionItems)) data.actionItems = [...data.actionItems, ...chunkData.actionItems];
        } catch (e) {
          console.error("[meeting-import] chunk extraction failed:", e);
        }
      }
      } // end else (non-PDF)

      const [meeting] = await db.insert(meetingMinutesTable).values({
        projectId,
        title: data.title || req.file.originalname,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : new Date(),
        location: data.location || null,
        notes: data.notes || null,
        createdById: req.user!.userId,
      }).returning();

      if (data.attendees?.length > 0) {
        const validAttendees = data.attendees.filter((a: any) => a.fullName);
        if (validAttendees.length > 0) {
          await db.insert(meetingAttendeesTable).values(
            validAttendees.map((a: any) => ({
              meetingId: meeting.id,
              fullName: a.fullName,
              company: a.company || null,
              role: a.role || null,
              externalEmail: a.email || null,
              userId: null,
            }))
          );
        }
      }

      if (data.actionItems?.length > 0) {
        const validItems = data.actionItems.filter((ai: any) => ai.description);
        if (validItems.length > 0) {
          await db.insert(actionItemsTable).values(
            validItems.map((ai: any) => ({
              meetingId: meeting.id,
              projectId,
              description: ai.description,
              assignedToName: ai.assignedToName || null,
              dueDate: ai.dueDate ? new Date(ai.dueDate) : null,
              status: ai.status || "open",
            }))
          );
        }
      }

      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "import",
        entityType: "meeting",
        entityId: meeting.id,
        details: `Imported meeting minutes from ${req.file.originalname} — ${data.attendees?.length ?? 0} attendees, ${data.actionItems?.length ?? 0} action items`,
      });

      res.json({ imported: 1, meetingId: meeting.id, title: meeting.title, message: "Meeting imported successfully" });
    } catch (err) {
      if (sendAiUsageError(res, err)) return;
      console.error("[meeting-import]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── DELETE meeting (soft delete) ──────────────────────────────────────────────
router.delete("/projects/:projectId/meetings/:meetingId",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const meetingId = Number(req.params.meetingId);
    const reason = (req.body?.reason as string | undefined) ?? null;
    try {
      const [existing] = await db.select().from(meetingMinutesTable)
        .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
      if (!existing) { res.status(404).json({ error: "not_found" }); return; }

      await db.update(meetingMinutesTable)
        .set({ deletedAt: new Date(), deleteReason: reason })
        .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));

      await db.delete(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, meetingId));

      await db.delete(linkedItemsTable).where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, "meeting"), eq(linkedItemsTable.fromId, meetingId)),
          and(eq(linkedItemsTable.toType, "meeting"), eq(linkedItemsTable.toId, meetingId)),
        ),
      ));

      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "delete", entityType: "meeting", entityId: meetingId,
        details: JSON.stringify({ reason, title: existing.title, meetingDate: existing.meetingDate }),
      });

      await db.insert(agentInsightsTable).values({
        projectId, agentType: "meeting", entityType: "meeting", entityId: meetingId,
        insightType: "delete_pattern",
        message: `Meeting "${existing.title}" deleted: ${reason ?? "no reason"}`,
        recommendation: "Review meeting delete reasons to detect scheduling churn.",
        severity: "info",
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
