import crypto from "crypto";
import { db } from "@workspace/db";
import {
  configOptionsTable,
  coordinatorBulkMeetingOperationsTable,
  meetingMinutesTable,
  meetingRfiLinksTable,
  meetingSubmittalLinksTable,
  projectCompanyBindingVersionsTable,
  projectMembersTable,
  projectsTable,
  rfisTable,
  submittalsTable,
  usersTable,
} from "@workspace/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { resolveEffectiveEntitlement } from "./feature-catalog-service";
import {
  insertMeetingRfiLinks,
  insertMeetingSubmittalLinks,
} from "./meeting-canonical-links";
import { hasScopedAuthority, mapCurrentProjectRole } from "./scoped-authority";
import { waitForCoordinatorBulkActionMigration } from "./coordinator-bulk-action-migration";

const MODULES = ["lens", "rfi", "submittal", "meeting", "schedule"] as const;
type SourceModule = (typeof MODULES)[number];
export type BulkOutcome =
  | "added"
  | "already_linked"
  | "updated"
  | "unsupported"
  | "unauthorized"
  | "stale"
  | "failed";

type Selection = {
  sourceModule: SourceModule;
  sourceId: number;
  sourceUpdatedAt: string | null;
};

type ParsedInput = {
  meetingId: number;
  expectedMeetingUpdatedAt: string;
  items: Selection[];
  confirmed: boolean;
  idempotencyKey: string | null;
};

export class CoordinatorBulkActionError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public messageEs: string,
  ) {
    super(message);
    this.name = "CoordinatorBulkActionError";
  }
}

const fail = (
  status: number,
  code: string,
  message: string,
  messageEs: string,
): never => {
  throw new CoordinatorBulkActionError(status, code, message, messageEs);
};

function positiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    fail(400, "COORDINATOR_BULK_INPUT_INVALID", `${field} is invalid.`, `${field} no es válido.`);
  return parsed;
}

function exactIso(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  const parsed = new Date(text);
  if (!text || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== text)
    fail(400, "COORDINATOR_BULK_INPUT_INVALID", `${field} must be an exact ISO timestamp.`, `${field} debe ser una marca de tiempo ISO exacta.`);
  return text;
}

function parseInput(body: unknown, execute: boolean): ParsedInput {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(400, "COORDINATOR_BULK_INPUT_INVALID", "A valid request body is required.", "Se requiere un cuerpo de solicitud válido.");
  const raw = body as Record<string, unknown>;
  if (!Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 50)
    fail(400, "COORDINATOR_BULK_SELECTION_INVALID", "Select between 1 and 50 items.", "Seleccione entre 1 y 50 elementos.");
  const seen = new Set<string>();
  const items = (raw.items as unknown[]).map((value: unknown, index: number) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(400, "COORDINATOR_BULK_SELECTION_INVALID", "A selected item is invalid.", "Un elemento seleccionado no es válido.");
    const item = value as Record<string, unknown>;
    const sourceModule = String(item.sourceModule ?? "") as SourceModule;
    if (!MODULES.includes(sourceModule))
      fail(400, "COORDINATOR_BULK_SELECTION_INVALID", "A source module is invalid.", "Un módulo de origen no es válido.");
    const sourceId = positiveInteger(item.sourceId, `items[${index}].sourceId`);
    const key = `${sourceModule}:${sourceId}`;
    if (seen.has(key))
      fail(409, "COORDINATOR_BULK_DUPLICATE_SELECTION", "The selection contains a duplicate item.", "La selección contiene un elemento duplicado.");
    seen.add(key);
    return {
      sourceModule,
      sourceId,
      sourceUpdatedAt:
        item.sourceUpdatedAt == null
          ? null
          : exactIso(item.sourceUpdatedAt, `items[${index}].sourceUpdatedAt`),
    };
  });
  let idempotencyKey: string | null = null;
  if (execute) {
    idempotencyKey = String(raw.idempotencyKey ?? "").trim();
    if (!/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey))
      fail(400, "COORDINATOR_BULK_IDEMPOTENCY_INVALID", "A valid idempotency key is required.", "Se requiere una clave de idempotencia válida.");
    if (raw.confirmed !== true)
      fail(409, "COORDINATOR_BULK_CONFIRMATION_REQUIRED", "Explicit confirmation is required before changes.", "Se requiere confirmación explícita antes de realizar cambios.");
  }
  return {
    meetingId: positiveInteger(raw.meetingId, "meetingId"),
    expectedMeetingUpdatedAt: exactIso(raw.expectedMeetingUpdatedAt, "expectedMeetingUpdatedAt"),
    items,
    confirmed: raw.confirmed === true,
    idempotencyKey,
  };
}

function fingerprint(input: ParsedInput) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        meetingId: input.meetingId,
        expectedMeetingUpdatedAt: input.expectedMeetingUpdatedAt,
        items: input.items,
      }),
    )
    .digest("hex");
}

function sameTimestamp(expected: string | null, current: Date | string | null) {
  if (!expected || !current) return false;
  return new Date(current).toISOString() === expected;
}

async function requireTransactionalWriteAuthority(
  tx: any,
  userId: number,
  projectId: number,
) {
  const [user] = await tx
    .select({ companyId: usersTable.companyId, isSuperAdmin: usersTable.isSuperAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const [project] = await tx
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  const [binding] = await tx
    .select({ companyId: projectCompanyBindingVersionsTable.companyId })
    .from(projectCompanyBindingVersionsTable)
    .where(eq(projectCompanyBindingVersionsTable.projectId, projectId))
    .orderBy(desc(projectCompanyBindingVersionsTable.version))
    .limit(1);
  const [membership] = await tx
    .select({
      role: projectMembersTable.role,
      status: projectMembersTable.status,
      meta: configOptionsTable.meta,
    })
    .from(projectMembersTable)
    .leftJoin(
      configOptionsTable,
      and(
        eq(configOptionsTable.category, "member_role"),
        eq(configOptionsTable.value, projectMembersTable.role),
      ),
    )
    .where(
      and(
        eq(projectMembersTable.projectId, projectId),
        eq(projectMembersTable.userId, userId),
      ),
    )
    .orderBy(configOptionsTable.id)
    .limit(1);
  if (!user || !project || !binding || user.isSuperAdmin === true)
    fail(403, "COORDINATOR_BULK_WRITE_DENIED", "Active project write access is required.", "Se requiere acceso activo de escritura al proyecto.");
  const permission =
    membership?.meta && typeof membership.meta.permission === "string"
      ? membership.meta.permission
      : membership?.role === "admin"
        ? "admin"
        : membership?.role === "viewer"
          ? "read"
          : null;
  const mapping = mapCurrentProjectRole(membership?.role, permission);
  if (
    Number(binding.companyId) !== Number(user.companyId) ||
    membership?.status !== "active" ||
    !hasScopedAuthority(mapping, ["project:write"])
  )
    fail(403, "COORDINATOR_BULK_WRITE_DENIED", "Active project write access is required.", "Se requiere acceso activo de escritura al proyecto.");
  return { companyId: Number(user.companyId) };
}

type Classified = {
  sourceModule: SourceModule;
  sourceId: number;
  outcome: BulkOutcome;
  reason: string;
  meetingLinkId: number | null;
  meetingLinkPath: string | null;
};

function unsupported(item: Selection): Classified {
  const lens = item.sourceModule === "lens";
  return {
    sourceModule: item.sourceModule,
    sourceId: item.sourceId,
    outcome: "unsupported",
    reason: lens
      ? "Lens Viewpoints remain navigation-only; no canonical Meeting association exists."
      : "This canonical source type has no Build 3 Meeting-link action.",
    meetingLinkId: null,
    meetingLinkPath: null,
  };
}

async function run(input: {
  userId: number;
  projectId: number;
  body: unknown;
  execute: boolean;
}) {
  await waitForCoordinatorBulkActionMigration();
  const parsed = parseInput(input.body, input.execute);
  const requestFingerprint = fingerprint(parsed);
  return db.transaction(async (tx: any) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`coordinator-bulk-meeting:${input.projectId}:${parsed.meetingId}`},0))`,
    );
    const authority = await requireTransactionalWriteAuthority(
      tx,
      input.userId,
      input.projectId,
    );

    if (input.execute && parsed.idempotencyKey) {
      const [receipt] = await tx
        .select()
        .from(coordinatorBulkMeetingOperationsTable)
        .where(
          and(
            eq(coordinatorBulkMeetingOperationsTable.userId, input.userId),
            eq(coordinatorBulkMeetingOperationsTable.projectId, input.projectId),
            eq(
              coordinatorBulkMeetingOperationsTable.idempotencyKey,
              parsed.idempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (receipt) {
        if (receipt.requestFingerprint !== requestFingerprint)
          fail(409, "COORDINATOR_BULK_IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.", "Esta clave de idempotencia ya se utilizó para una solicitud diferente.");
        return { ...(receipt.resultSnapshot as Record<string, unknown>), idempotent: true };
      }
    }

    const [meeting] = await tx
      .select({ id: meetingMinutesTable.id, updatedAt: meetingMinutesTable.updatedAt })
      .from(meetingMinutesTable)
      .where(
        and(
          eq(meetingMinutesTable.id, parsed.meetingId),
          eq(meetingMinutesTable.projectId, input.projectId),
          isNull(meetingMinutesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!meeting)
      fail(404, "COORDINATOR_BULK_MEETING_UNAVAILABLE", "The Meeting is not accessible in this project.", "La Reunión no está disponible en este proyecto.");

    const meetingStale = !sameTimestamp(
      parsed.expectedMeetingUpdatedAt,
      meeting.updatedAt,
    );
    const rfiItems = parsed.items.filter((item) => item.sourceModule === "rfi");
    const submittalItems = parsed.items.filter(
      (item) => item.sourceModule === "submittal",
    );
    const rfiRows = rfiItems.length
      ? await tx
          .select({ id: rfisTable.id, status: rfisTable.status, updatedAt: rfisTable.updatedAt })
          .from(rfisTable)
          .where(
            and(
              eq(rfisTable.projectId, input.projectId),
              inArray(rfisTable.id, rfiItems.map((item) => item.sourceId)),
              isNull(rfisTable.deletedAt),
            ),
          )
      : [];
    const submittalRows = submittalItems.length
      ? await tx
          .select({
            id: submittalsTable.id,
            status: submittalsTable.status,
            reviewDecision: submittalsTable.reviewDecision,
            updatedAt: submittalsTable.updatedAt,
          })
          .from(submittalsTable)
          .where(
            and(
              eq(submittalsTable.projectId, input.projectId),
              inArray(
                submittalsTable.id,
                submittalItems.map((item) => item.sourceId),
              ),
              isNull(submittalsTable.deletedAt),
            ),
          )
      : [];
    const rfiById = new Map<number, any>(
      rfiRows.map((row: any) => [Number(row.id), row]),
    );
    const submittalById = new Map<number, any>(
      submittalRows.map((row: any) => [Number(row.id), row]),
    );

    let rfiAuthorized = true;
    if (rfiItems.length) {
      const entitlement = await resolveEffectiveEntitlement({
        featureKey: "rfi.core",
        userId: input.userId,
        companyId: authority.companyId,
        projectId: input.projectId,
      });
      rfiAuthorized = entitlement.decision === "allow";
    }

    const existingRfis = rfiItems.length
      ? await tx
          .select({ sourceId: meetingRfiLinksTable.rfiId, id: meetingRfiLinksTable.id })
          .from(meetingRfiLinksTable)
          .where(
            and(
              eq(meetingRfiLinksTable.projectId, input.projectId),
              eq(meetingRfiLinksTable.meetingId, parsed.meetingId),
              inArray(meetingRfiLinksTable.rfiId, rfiItems.map((item) => item.sourceId)),
            ),
          )
      : [];
    const existingSubmittals = submittalItems.length
      ? await tx
          .select({
            sourceId: meetingSubmittalLinksTable.submittalId,
            id: meetingSubmittalLinksTable.id,
          })
          .from(meetingSubmittalLinksTable)
          .where(
            and(
              eq(meetingSubmittalLinksTable.projectId, input.projectId),
              eq(meetingSubmittalLinksTable.meetingId, parsed.meetingId),
              inArray(
                meetingSubmittalLinksTable.submittalId,
                submittalItems.map((item) => item.sourceId),
              ),
            ),
          )
      : [];
    const existing = new Map<string, number>([
      ...existingRfis.map((row: any) => [`rfi:${row.sourceId}`, Number(row.id)] as const),
      ...existingSubmittals.map(
        (row: any) => [`submittal:${row.sourceId}`, Number(row.id)] as const,
      ),
    ]);

    const classifications = parsed.items.map((item): Classified => {
      if (item.sourceModule !== "rfi" && item.sourceModule !== "submittal")
        return unsupported(item);
      if (meetingStale)
        return { sourceModule: item.sourceModule, sourceId: item.sourceId, outcome: "stale", reason: "The selected Meeting changed; reload before confirming.", meetingLinkId: null, meetingLinkPath: null };
      if (item.sourceModule === "rfi" && !rfiAuthorized)
        return { sourceModule: item.sourceModule, sourceId: item.sourceId, outcome: "unauthorized", reason: "Current RFI entitlement does not authorize this action.", meetingLinkId: null, meetingLinkPath: null };
      const row = item.sourceModule === "rfi" ? rfiById.get(item.sourceId) : submittalById.get(item.sourceId);
      if (!row)
        return { sourceModule: item.sourceModule, sourceId: item.sourceId, outcome: "unauthorized", reason: "The source record is not accessible in this project.", meetingLinkId: null, meetingLinkPath: null };
      const status = String(
        item.sourceModule === "submittal"
          ? row.reviewDecision || row.status
          : row.status,
      ).toLowerCase();
      const actionable =
        item.sourceModule === "rfi"
          ? ["open", "pending", "in_review"].includes(status)
          : [
              "pending",
              "submitted",
              "under_review",
              "revise_resubmit",
              "rejected",
            ].includes(status);
      if (!actionable || !sameTimestamp(item.sourceUpdatedAt, row.updatedAt))
        return { sourceModule: item.sourceModule, sourceId: item.sourceId, outcome: "stale", reason: "The canonical source changed or is no longer actionable.", meetingLinkId: null, meetingLinkPath: null };
      const meetingLinkId = existing.get(`${item.sourceModule}:${item.sourceId}`) ?? null;
      return {
        sourceModule: item.sourceModule,
        sourceId: item.sourceId,
        outcome: meetingLinkId ? "already_linked" : "added",
        reason: meetingLinkId ? "The canonical Meeting link already exists." : input.execute ? "The canonical Meeting link was added." : "The canonical Meeting link will be added after confirmation.",
        meetingLinkId,
        meetingLinkPath: `/projects/${input.projectId}/meetings?meeting=${parsed.meetingId}`,
      };
    });

    if (input.execute && !meetingStale) {
      const rfiIds = classifications
        .filter((row) => row.sourceModule === "rfi" && row.outcome === "added")
        .map((row) => row.sourceId);
      const submittalIds = classifications
        .filter(
          (row) => row.sourceModule === "submittal" && row.outcome === "added",
        )
        .map((row) => row.sourceId);
      const [rfiInsert, submittalInsert] = await Promise.all([
        insertMeetingRfiLinks(tx, input.projectId, parsed.meetingId, rfiIds, input.userId),
        insertMeetingSubmittalLinks(
          tx,
          input.projectId,
          parsed.meetingId,
          submittalIds,
          input.userId,
        ),
      ]);
      const inserted = new Set([
        ...rfiInsert.insertedSourceIds.map((id: number) => `rfi:${id}`),
        ...submittalInsert.insertedSourceIds.map((id: number) => `submittal:${id}`),
      ]);
      const allLinks = await Promise.all([
        rfiIds.length
          ? tx
              .select({ sourceId: meetingRfiLinksTable.rfiId, id: meetingRfiLinksTable.id })
              .from(meetingRfiLinksTable)
              .where(
                and(
                  eq(meetingRfiLinksTable.projectId, input.projectId),
                  eq(meetingRfiLinksTable.meetingId, parsed.meetingId),
                  inArray(meetingRfiLinksTable.rfiId, rfiIds),
                ),
              )
          : [],
        submittalIds.length
          ? tx
              .select({ sourceId: meetingSubmittalLinksTable.submittalId, id: meetingSubmittalLinksTable.id })
              .from(meetingSubmittalLinksTable)
              .where(
                and(
                  eq(meetingSubmittalLinksTable.projectId, input.projectId),
                  eq(meetingSubmittalLinksTable.meetingId, parsed.meetingId),
                  inArray(meetingSubmittalLinksTable.submittalId, submittalIds),
                ),
              )
          : [],
      ]);
      const links = new Map<string, number>([
        ...allLinks[0].map((row: any) => [`rfi:${row.sourceId}`, Number(row.id)] as const),
        ...allLinks[1].map(
          (row: any) => [`submittal:${row.sourceId}`, Number(row.id)] as const,
        ),
      ]);
      for (const row of classifications) {
        const key = `${row.sourceModule}:${row.sourceId}`;
        if (row.outcome !== "added") continue;
        row.meetingLinkId = links.get(key) ?? null;
        if (!inserted.has(key)) {
          row.outcome = "already_linked";
          row.reason = "A concurrent request created the same canonical Meeting link.";
        }
      }
    }

    const summary = Object.fromEntries(
      ["added", "already_linked", "updated", "unsupported", "unauthorized", "stale", "failed"].map(
        (outcome) => [
          outcome,
          classifications.filter((row) => row.outcome === outcome).length,
        ],
      ),
    );
    const result = {
      operation: "meeting_link" as const,
      preview: !input.execute,
      idempotent: false,
      projectId: input.projectId,
      meetingId: parsed.meetingId,
      summary,
      outcomes: classifications,
      scheduleWorkflow: "accepted_m4_only" as const,
      canonicalRecordsMutated: false,
      lensMutated: false,
      clashesQueried: false,
    };
    if (input.execute && parsed.idempotencyKey) {
      await tx.insert(coordinatorBulkMeetingOperationsTable).values({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        userId: input.userId,
        meetingId: parsed.meetingId,
        idempotencyKey: parsed.idempotencyKey,
        requestFingerprint,
        resultSnapshot: result,
      });
    }
    return result;
  });
}

export function previewCoordinatorMeetingLinks(input: {
  userId: number;
  projectId: number;
  body: unknown;
}) {
  return run({ ...input, execute: false });
}

export function executeCoordinatorMeetingLinks(input: {
  userId: number;
  projectId: number;
  body: unknown;
}) {
  return run({ ...input, execute: true });
}
