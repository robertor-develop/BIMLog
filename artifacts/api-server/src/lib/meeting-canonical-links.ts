import {
  meetingMinutesTable,
  meetingRfiLinksTable,
  meetingSubmittalLinksTable,
  rfisTable,
  submittalsTable,
  usersTable,
} from "@workspace/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

type DisciplineBucket =
  | "plumbing"
  | "hvac"
  | "fireProtection"
  | "electrical"
  | "other"
  | null;

const cleanLabel = (value: string | null | undefined) =>
  value?.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ") || null;

const titleLabel = (value: string | null | undefined) => {
  const cleaned = cleanLabel(value);
  return cleaned
    ? cleaned.replace(/\b\w/g, (character) => character.toUpperCase())
    : null;
};

function submittalDiscipline(
  submittal: typeof submittalsTable.$inferSelect,
) {
  if (cleanLabel(submittal.trade)) return titleLabel(submittal.trade);
  const fallback = `${submittal.submittalCategory || ""} ${submittal.submittalType || ""}`.toLowerCase();
  if (fallback.includes("plumb")) return "Plumbing";
  if (fallback.includes("hvac") || fallback.includes("mechanical"))
    return "HVAC";
  if (
    fallback.includes("fire protection") ||
    fallback.includes("fire suppression") ||
    fallback.includes("sprinkler")
  )
    return "Fire Protection";
  if (fallback.includes("electr")) return "Electrical";
  return null;
}

function submittalDisciplineBucket(
  discipline: string | null,
): DisciplineBucket {
  const key = discipline?.toLowerCase() || "";
  if (!key) return null;
  if (key.includes("plumb")) return "plumbing";
  if (key.includes("hvac") || key.includes("mechanical")) return "hvac";
  if (
    key.includes("fire protection") ||
    key.includes("fire suppression") ||
    key.includes("sprinkler")
  )
    return "fireProtection";
  if (key.includes("electr")) return "electrical";
  return "other";
}

function submittalResponsible(
  submittal: typeof submittalsTable.$inferSelect,
  assignedToName?: string | null,
) {
  return cleanLabel(
    submittal.ballInCourt ||
      assignedToName ||
      submittal.responsibleCompany ||
      submittal.submittedToPerson ||
      submittal.submittedToCompany,
  );
}

export class MeetingRfiLinkError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export class MeetingSubmittalLinkError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function insertMeetingSubmittalLinks(
  executor: any,
  projectId: number,
  meetingId: number,
  rawSubmittalIds: number[],
  userId: number,
) {
  const submittalIds = [...new Set(rawSubmittalIds.filter(Number.isInteger))];
  if (!submittalIds.length)
    return { requested: 0, added: 0, insertedSourceIds: [] as number[] };

  const [meeting] = await executor
    .select({ id: meetingMinutesTable.id })
    .from(meetingMinutesTable)
    .where(
      and(
        eq(meetingMinutesTable.id, meetingId),
        eq(meetingMinutesTable.projectId, projectId),
        isNull(meetingMinutesTable.deletedAt),
      ),
    )
    .limit(1);
  if (!meeting) throw new MeetingSubmittalLinkError(404, "meeting_not_found");

  const rows = await executor
    .select({ submittal: submittalsTable, assignedToName: usersTable.fullName })
    .from(submittalsTable)
    .leftJoin(usersTable, eq(submittalsTable.assignedToId, usersTable.id))
    .where(
      and(
        inArray(submittalsTable.id, submittalIds),
        eq(submittalsTable.projectId, projectId),
        isNull(submittalsTable.deletedAt),
      ),
    );
  if (rows.length !== submittalIds.length)
    throw new MeetingSubmittalLinkError(404, "submittal_not_accessible");

  const inserted = await executor
    .insert(meetingSubmittalLinksTable)
    .values(
      rows.map(({ submittal, assignedToName }: any) => {
        const discipline = submittalDiscipline(submittal);
        return {
          projectId,
          meetingId,
          submittalId: submittal.id,
          numberSnapshot: submittal.number,
          titleSnapshot: submittal.title,
          descriptionSnapshot: submittal.description || null,
          floorSnapshot: cleanLabel(submittal.floor),
          disciplineSnapshot: discipline,
          disciplineBucketSnapshot: submittalDisciplineBucket(discipline),
          statusSnapshot: submittal.status,
          responsibleSnapshot: submittalResponsible(
            submittal,
            assignedToName,
          ),
          deadlineSnapshot:
            submittal.dateRequired || submittal.dueDate || null,
          createdById: userId,
        };
      }),
    )
    .onConflictDoNothing({
      target: [
        meetingSubmittalLinksTable.meetingId,
        meetingSubmittalLinksTable.submittalId,
      ],
    })
    .returning({
      id: meetingSubmittalLinksTable.id,
      sourceId: meetingSubmittalLinksTable.submittalId,
    });
  return {
    requested: submittalIds.length,
    added: inserted.length,
    insertedSourceIds: inserted.map((row: { sourceId: number }) => row.sourceId),
  };
}

export async function insertMeetingRfiLinks(
  executor: any,
  projectId: number,
  meetingId: number,
  rawRfiIds: number[],
  userId: number,
) {
  const rfiIds = [...new Set(rawRfiIds.filter(Number.isInteger))];
  if (!rfiIds.length)
    return { requested: 0, added: 0, insertedSourceIds: [] as number[] };

  const [meeting] = await executor
    .select({ id: meetingMinutesTable.id })
    .from(meetingMinutesTable)
    .where(
      and(
        eq(meetingMinutesTable.id, meetingId),
        eq(meetingMinutesTable.projectId, projectId),
        isNull(meetingMinutesTable.deletedAt),
      ),
    )
    .limit(1);
  if (!meeting) throw new MeetingRfiLinkError(404, "meeting_not_found");

  const rows = await executor
    .select({
      id: rfisTable.id,
      number: rfisTable.number,
      subject: rfisTable.subject,
      description: rfisTable.description,
      question: rfisTable.question,
      status: rfisTable.status,
      ballInCourt: rfisTable.ballInCourt,
      submittedToPerson: rfisTable.submittedToPerson,
      submittedToCompany: rfisTable.submittedToCompany,
      assignedToName: usersTable.fullName,
    })
    .from(rfisTable)
    .leftJoin(usersTable, eq(rfisTable.assignedToId, usersTable.id))
    .where(
      and(
        inArray(rfisTable.id, rfiIds),
        eq(rfisTable.projectId, projectId),
        isNull(rfisTable.deletedAt),
      ),
    );

  if (rows.length !== rfiIds.length)
    throw new MeetingRfiLinkError(404, "rfi_not_accessible");

  const inserted = await executor
    .insert(meetingRfiLinksTable)
    .values(
      rows.map((r: any) => ({
        projectId,
        meetingId,
        rfiId: r.id,
        rfiNumberSnapshot: r.number,
        titleSnapshot: r.subject || r.description || r.question || r.number,
        descriptionSnapshot: r.description || r.question || null,
        statusSnapshot: r.status,
        responsibleSnapshot:
          r.ballInCourt ||
          r.assignedToName ||
          r.submittedToPerson ||
          r.submittedToCompany ||
          null,
        createdById: userId,
      })),
    )
    .onConflictDoNothing({
      target: [meetingRfiLinksTable.meetingId, meetingRfiLinksTable.rfiId],
    })
    .returning({
      id: meetingRfiLinksTable.id,
      sourceId: meetingRfiLinksTable.rfiId,
    });
  return {
    requested: rfiIds.length,
    added: inserted.length,
    insertedSourceIds: inserted.map((row: { sourceId: number }) => row.sourceId),
  };
}
