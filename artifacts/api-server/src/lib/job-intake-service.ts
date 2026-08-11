import crypto from "node:crypto";
import path from "node:path";
import { pool } from "@workspace/db";
import { storage } from "./storage-adapter";
import { extractFileText } from "./extract-file-text";
import { FinancialControlError } from "./financial-control-contract";
import {
  boundedText,
  decimalFromScaled,
  positiveId,
  scaledSignedDecimal,
} from "./financial-budget-contract";
import { effectiveCommercialAccessForUser } from "./commercial-entitlement";
import { createContractDraftWithClient } from "./financial-contract-service";
import { initializeContractItemWorkflowsWithClient } from "./contract-item-workflow-service";
import { waitForContractItemWorkflowMigration } from "./contract-item-workflow-migration";
import { waitForFinancialContractMigration } from "./financial-contract-migration";
import {
  jobIntakeCompletion,
  jobIntakeCoreFingerprint,
  normalizeJobIntakeData,
  previewSmartIntakeMapping,
  type JobIntakeCapabilities,
  type JobIntakeData,
} from "./job-intake-contract";
import { waitForJobIntakeMigration } from "./job-intake-migration";

const uuid = () => crypto.randomUUID();
const categories = new Set([
  "quotation",
  "proposal",
  "takeoff",
  "estimate",
  "contract",
  "supporting",
]);
const extensions = new Set([".pdf", ".docx", ".xlsx", ".xlsm", ".xls", ".csv"]);
type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

async function capabilitiesFor(
  actorUserId: number,
  client: Queryable = pool,
): Promise<JobIntakeCapabilities> {
  const access = await effectiveCommercialAccessForUser(actorUserId, client);
  return {
    package: access.package,
    budget: access.budget,
    contracts: access.contracts,
    costValuePlanner: access.cost_value_planner,
    anyCommercial: access.any,
    fullCommercialActivation: access.fullActivation,
  };
}

async function scope(
  actorUserId: number,
  projectId: number,
  client: Queryable = pool,
) {
  const result = await client.query(
    `SELECT p.id,p.name,p.code,p.status,p.client_name,p.client_company,p.location,
    to_char(p.start_date,'YYYY-MM-DD') start_date,to_char(p.expected_end_date,'YYYY-MM-DD') expected_end_date,u.company_id actor_company,u.is_super_admin,
    COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) project_company,
    EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=u.id AND pm.status='active') member
    FROM projects p JOIN users u ON u.id=$2 JOIN users creator ON creator.id=p.created_by_id WHERE p.id=$1`,
    [projectId, actorUserId],
  );
  const row = result.rows[0];
  if (!row || row.status === "archived")
    throw new FinancialControlError(
      404,
      "JOB_INTAKE_PROJECT_NOT_FOUND",
      "Project not found.",
    );
  if (!row.is_super_admin && !row.member)
    throw new FinancialControlError(
      403,
      "JOB_INTAKE_PROJECT_ACCESS_REQUIRED",
      "Current project membership is required.",
    );
  if (
    !row.is_super_admin &&
    Number(row.actor_company) !== Number(row.project_company)
  )
    throw new FinancialControlError(
      403,
      "JOB_INTAKE_COMPANY_MISMATCH",
      "The project belongs to another company.",
    );
  return {
    projectId: Number(row.id),
    projectName: String(row.name),
    projectCode: String(row.code),
    companyId: Number(row.project_company),
    clientName: String(row.client_name ?? ""),
    clientCompany: String(row.client_company ?? ""),
    location: String(row.location ?? ""),
    startDate: String(row.start_date ?? ""),
    targetCompletionDate: String(row.expected_end_date ?? ""),
  };
}

async function documents(intakeId: string, client: Queryable = pool) {
  const result = await client.query(
    `SELECT d.id,d.category,d.revision_label "revisionLabel",d.source_hash "sourceHash",d.extraction_status "extractionStatus",d.extraction_summary "extractionSummary",d.created_at "createdAt",d.removed_at "removedAt",f.id "fileId",f.file_name "fileName",f.file_size_bytes "fileSize",f.file_type "fileType"
    FROM job_intake_documents d JOIN files f ON f.id=d.file_id WHERE d.intake_id=$1 ORDER BY d.created_at,d.id`,
    [intakeId],
  );
  return result.rows;
}

async function activationDetails(intakeId: string, client: Queryable = pool) {
  const workItems = (
    await client.query(
      `SELECT id,stable_scope_item_id "stableScopeItemId",name,unit,planned_hours "plannedHours",status,billing_hourly_rate "billingHourlyRate",planned_billable_value "plannedBillableValue",contract_id "contractId",contract_version_id "contractVersionId" FROM job_activation_work_items WHERE intake_id=$1 ORDER BY created_at,id`,
      [intakeId],
    )
  ).rows;
  if (!workItems.length) return null;
  const assignments = (
    await client.query(
      `SELECT r.id,r.work_item_id "workItemId",r.task_id "taskId",r.user_id "userId",r.person_name "personName",r.role,r.employment_type "employmentType",r.planned_hours "plannedHours",r.internal_hourly_rate "internalHourlyRate",r.billing_hourly_rate "billingHourlyRate",r.planned_internal_cost "plannedInternalCost",r.planned_billable_value "plannedBillableValue" FROM job_activation_resource_assignments r WHERE r.intake_id=$1 ORDER BY r.created_at,r.id`,
      [intakeId],
    )
  ).rows;
  const tasks = workItems.length
    ? (
        await client.query(
          `SELECT id,work_item_id "workItemId",task_key "taskKey",name_en "nameEn",name_es "nameEs",status,planned_hours "plannedHours",assignee_user_id "assigneeUserId" FROM job_activation_tasks WHERE work_item_id=ANY($1::text[]) ORDER BY work_item_id,sequence,id`,
          [workItems.map((item: any) => item.id)],
        )
      ).rows
    : [];
  return { workItems, tasks, assignments };
}

async function event(
  client: any,
  input: {
    intakeId: string;
    projectId: number;
    actorUserId: number;
    eventType: string;
    beforeRevision?: number | null;
    afterRevision?: number | null;
    evidence?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO job_intake_events(id,intake_id,project_id,actor_user_id,event_type,before_revision,after_revision,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      uuid(),
      input.intakeId,
      input.projectId,
      input.actorUserId,
      input.eventType,
      input.beforeRevision ?? null,
      input.afterRevision ?? null,
      JSON.stringify(input.evidence ?? {}),
    ],
  );
}

async function hydrate(
  row: any,
  access: Awaited<ReturnType<typeof scope>>,
  actorUserId: number,
) {
  const docs = await documents(row.id);
  const data = normalizeJobIntakeData(row.data);
  const capabilities = await capabilitiesFor(actorUserId);
  const completion = jobIntakeCompletion(data, docs, capabilities);
  const [members, events, activation] = await Promise.all([
    pool.query(
      `SELECT u.id,u.full_name "fullName",u.email,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.status='active' ORDER BY u.full_name,u.email`,
      [access.projectId],
    ),
    pool.query(
      `SELECT event_type "eventType",before_revision "beforeRevision",after_revision "afterRevision",evidence,created_at "createdAt" FROM job_intake_events WHERE intake_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30`,
      [row.id],
    ),
    activationDetails(row.id),
  ]);
  return {
    id: row.id,
    project: {
      id: access.projectId,
      name: access.projectName,
      code: access.projectCode,
    },
    status: row.status,
    revision: Number(row.revision),
    data,
    completion,
    capabilities,
    documents: docs,
    members: members.rows,
    events: events.rows,
    activation,
    activationMode: row.activation_mode ?? null,
    activationSummary: row.activation_summary ?? {},
    activatedContractId: row.activated_contract_id,
    updatedAt: row.updated_at,
  };
}

export async function getJobIntake(input: {
  actorUserId: number;
  projectId: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId"),
    access = await scope(input.actorUserId, projectId);
  const row = (
    await pool.query(`SELECT * FROM job_intakes WHERE project_id=$1`, [
      projectId,
    ])
  ).rows[0];
  return row
    ? hydrate(row, access, input.actorUserId)
    : {
        intake: null,
        project: {
          id: projectId,
          name: access.projectName,
          code: access.projectCode,
        },
      };
}

export async function initializeJobIntake(input: {
  actorUserId: number;
  projectId: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId"),
    access = await scope(input.actorUserId, projectId),
    id = uuid();
  const data = normalizeJobIntakeData({
    identity: {
      jobName: access.projectName,
      jobCode: access.projectCode,
      clientName: access.clientName,
      clientCompany: access.clientCompany,
      location: access.location,
      startDate: access.startDate,
      targetCompletionDate: access.targetCompletionDate,
    },
  });
  const capabilities = await capabilitiesFor(input.actorUserId);
  const completion = jobIntakeCompletion(data, [], capabilities);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO job_intakes(id,company_id,project_id,status,revision,data,completion,created_by_id,updated_by_id) VALUES($1,$2,$3,'draft',1,$4::jsonb,$5::jsonb,$6,$6) ON CONFLICT(project_id) DO NOTHING`,
      [
        id,
        access.companyId,
        projectId,
        JSON.stringify(data),
        JSON.stringify(completion),
        input.actorUserId,
      ],
    );
    const row = (
      await client.query(
        `SELECT * FROM job_intakes WHERE project_id=$1 FOR UPDATE`,
        [projectId],
      )
    ).rows[0];
    if (row.id === id)
      await event(client, {
        intakeId: id,
        projectId,
        actorUserId: input.actorUserId,
        eventType: "intake_created",
        afterRevision: 1,
        evidence: { completion: completion.percent },
      });
    await client.query("COMMIT");
    return hydrate(row, access, input.actorUserId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveJobIntake(input: {
  actorUserId: number;
  projectId: unknown;
  expectedRevision: unknown;
  data: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId"),
    access = await scope(input.actorUserId, projectId),
    expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision <= 0)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_REVISION_INVALID",
      "A positive expected revision is required.",
    );
  const data = normalizeJobIntakeData(input.data);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = (
      await client.query(
        `SELECT * FROM job_intakes WHERE project_id=$1 FOR UPDATE`,
        [projectId],
      )
    ).rows[0];
    if (!row)
      throw new FinancialControlError(
        404,
        "JOB_INTAKE_NOT_FOUND",
        "Initialize this job intake first.",
      );
    if (Number(row.revision) !== expectedRevision)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_STALE",
        "This intake changed in another session. Reload before saving.",
      );
    const capabilities = await capabilitiesFor(input.actorUserId, client);
    if (row.status === "activated" && row.activated_contract_id)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_ACTIVATED",
        "The operational and Commercial activation is complete; the accepted intake is immutable.",
      );
    if (
      row.status === "activated" &&
      jobIntakeCoreFingerprint(normalizeJobIntakeData(row.data)) !==
        jobIntakeCoreFingerprint(data)
    )
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_CORE_IMMUTABLE",
        "Operational scope, delivery, and resource hours are immutable after activation; only newly entitled Commercial details may be completed.",
      );
    const docs = await documents(row.id, client),
      completion = jobIntakeCompletion(data, docs, capabilities),
      revision = expectedRevision + 1;
    const nextStatus =
      row.status === "activated"
        ? "activated"
        : completion.ready
          ? "ready"
          : "draft";
    await client.query(
      `UPDATE job_intakes SET data=$2::jsonb,completion=$3::jsonb,status=$4,revision=$5,updated_by_id=$6,updated_at=now() WHERE id=$1`,
      [
        row.id,
        JSON.stringify(data),
        JSON.stringify(completion),
        nextStatus,
        revision,
        input.actorUserId,
      ],
    );
    await event(client, {
      intakeId: row.id,
      projectId,
      actorUserId: input.actorUserId,
      eventType:
        row.status === "activated"
          ? "commercial_enrichment_saved"
          : "intake_saved",
      beforeRevision: expectedRevision,
      afterRevision: revision,
      evidence: {
        completion: completion.percent,
        fingerprint: completion.fingerprint,
        capabilities,
      },
    });
    await client.query("COMMIT");
    return hydrate(
      {
        ...row,
        data,
        completion,
        status: nextStatus,
        revision,
        updated_at: new Date().toISOString(),
      },
      access,
      input.actorUserId,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function extraction(buffer: Buffer, fileName: string) {
  let extracted: Awaited<ReturnType<typeof extractFileText>>;
  try {
    extracted = await extractFileText(buffer, fileName);
  } catch (error) {
    if (
      ![".xls", ".xlsx", ".xlsm", ".csv"].includes(
        path.extname(fileName).toLowerCase(),
      )
    )
      throw error;
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_SPREADSHEET_PARSE_FAILED",
      "The spreadsheet source could not be parsed safely. Confirm its file type and export it again.",
    );
  }
  if (extracted.isSpreadsheet && extracted.sheets?.length) {
    return {
      status: "structured_preview",
      summary: {
        workbookType: path.extname(fileName).slice(1).toLowerCase(),
        sheetCount: extracted.workbookSheetCount ?? extracted.sheets.length,
        sheetsTruncated: extracted.sheetsTruncated === true,
        sheets: extracted.sheets,
        requiresExplicitMapping: true,
      },
    };
  }
  if (path.extname(fileName).toLowerCase() === ".docx")
    return {
      status: "manual_review_required",
      summary: {
        note: "Word document preserved byte-for-byte. Confirm scope and commercial terms in the intake before activation.",
      },
    };
  if (extracted.isPdf)
    return {
      status: "manual_review_required",
      summary: {
        note: "PDF preserved byte-for-byte. Confirm scope and commercial terms in the intake before activation.",
      },
    };
  return {
    status: "text_preview",
    summary: { preview: extracted.text.slice(0, 2000) },
  };
}

export async function previewJobIntakeDocumentMapping(input: {
  actorUserId: number;
  projectId: unknown;
  documentId: unknown;
  sheetName: unknown;
  headerRow: unknown;
  nameColumn: unknown;
  quantityColumn: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId");
  await scope(input.actorUserId, projectId);
  const documentId = boundedText(input.documentId, "documentId", 1, 100);
  const row = (
    await pool.query(
      `SELECT d.id,d.source_hash,d.extraction_status,d.extraction_summary,d.removed_at,f.file_name
       FROM job_intake_documents d
       JOIN job_intakes i ON i.id=d.intake_id
       JOIN files f ON f.id=d.file_id
       WHERE d.id=$1 AND d.project_id=$2 AND i.project_id=$2`,
      [documentId, projectId],
    )
  ).rows[0];
  if (!row || row.removed_at)
    throw new FinancialControlError(
      404,
      "JOB_INTAKE_DOCUMENT_NOT_FOUND",
      "The active intake source document was not found.",
    );
  if (row.extraction_status !== "structured_preview")
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_MAPPING_SOURCE_INVALID",
      "Only a preserved spreadsheet source can be mapped to Contract Items.",
    );
  return previewSmartIntakeMapping({
    documentId: row.id,
    sourceHash: row.source_hash,
    fileName: row.file_name,
    sheets: row.extraction_summary?.sheets,
    sheetsTruncated: row.extraction_summary?.sheetsTruncated,
    sheetName: input.sheetName,
    headerRow: input.headerRow,
    nameColumn: input.nameColumn,
    quantityColumn: input.quantityColumn,
  });
}

export async function applyJobIntakeDocumentMapping(input: {
  actorUserId: number;
  projectId: unknown;
  documentId: unknown;
  expectedRevision: unknown;
  mappingFingerprint: unknown;
  sheetName: unknown;
  headerRow: unknown;
  nameColumn: unknown;
  quantityColumn: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId");
  await scope(input.actorUserId, projectId);
  const documentId = boundedText(input.documentId, "documentId", 1, 100);
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_REVISION_INVALID",
      "A valid expected revision is required.",
    );
  const mappingFingerprint = boundedText(
    input.mappingFingerprint,
    "mappingFingerprint",
    64,
    64,
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const intake = (
      await client.query(
        `SELECT * FROM job_intakes WHERE project_id=$1 FOR UPDATE`,
        [projectId],
      )
    ).rows[0];
    if (!intake)
      throw new FinancialControlError(
        404,
        "JOB_INTAKE_NOT_FOUND",
        "Initialize this job intake before importing Contract Items.",
      );
    if (intake.status === "activated")
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_ACTIVATED",
        "An activated intake is immutable.",
      );
    if (Number(intake.revision) !== expectedRevision)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_STALE",
        "Reload the intake before importing mapped Contract Items.",
      );
    const document = (
      await client.query(
        `SELECT d.id,d.source_hash,d.extraction_status,d.extraction_summary,d.removed_at,f.file_name
         FROM job_intake_documents d JOIN files f ON f.id=d.file_id
         WHERE d.id=$1 AND d.intake_id=$2 AND d.project_id=$3 FOR SHARE`,
        [documentId, intake.id, projectId],
      )
    ).rows[0];
    if (!document || document.removed_at)
      throw new FinancialControlError(
        404,
        "JOB_INTAKE_DOCUMENT_NOT_FOUND",
        "The active intake source document was not found.",
      );
    if (document.extraction_status !== "structured_preview")
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_MAPPING_SOURCE_INVALID",
        "Only a preserved spreadsheet source can be mapped to Contract Items.",
      );
    const preview = previewSmartIntakeMapping({
      documentId: document.id,
      sourceHash: document.source_hash,
      fileName: document.file_name,
      sheets: document.extraction_summary?.sheets,
      sheetsTruncated: document.extraction_summary?.sheetsTruncated,
      sheetName: input.sheetName,
      headerRow: input.headerRow,
      nameColumn: input.nameColumn,
      quantityColumn: input.quantityColumn,
    });
    if (preview.mappingFingerprint !== mappingFingerprint)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_MAPPING_STALE",
        "The confirmed mapping no longer matches the preserved preview.",
      );
    if (preview.issues.length)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_MAPPING_HAS_ISSUES",
        "Resolve every mapped source-row issue before importing Contract Items.",
      );
    if (!preview.rows.length)
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_MAPPING_EMPTY",
        "The confirmed mapping contains no Contract Item rows.",
      );
    const data = normalizeJobIntakeData(intake.data);
    const capabilities = await capabilitiesFor(input.actorUserId, client);
    const latestPlan = capabilities.costValuePlanner
      ? ((
          await client.query(
            `SELECT version,content FROM generic_cost_value_plan_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1`,
            [projectId],
          )
        ).rows[0] ?? null)
      : null;
    const inheritedRate =
      latestPlan?.content?.currency === data.identity.currency
        ? String(latestPlan.content.sellingPrice ?? "0")
        : "0";
    const inheritedApuVersion =
      inheritedRate !== "0" ? Number(latestPlan.version) : null;
    const existingById = new Map(
      data.scopeItems.map((item) => [item.id, item]),
    );
    for (const mapped of preview.rows as Array<any>) {
      const existing = existingById.get(String(mapped.id));
      existingById.set(String(mapped.id), {
        ...(existing ?? {
          id: mapped.id,
          description: "",
          billingHourlyRate: inheritedRate,
          contractValue: "0",
          unit: "Hours",
          apuPlanVersion: inheritedApuVersion,
          budgetSnapshotLineId: "",
          projectCostNodeId: "",
          scheduleItemPlacementId: null,
          assumptions: "",
          exclusions: "",
          workflowTemplate: data.delivery.workflowTemplate,
          contractId: data.commercial.contracts[0].id,
        }),
        name: mapped.name,
        plannedHours: mapped.quantity,
        provenance: mapped.provenance,
      });
    }
    const mergedItems = [...existingById.values()];
    if (mergedItems.length > 500)
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_SCOPE_LIMIT",
        "No more than 500 Contract Items are accepted.",
      );
    const nextData = normalizeJobIntakeData({
      ...data,
      scopeItems: mergedItems,
      review: {
        ...data.review,
        scopeConfirmed: false,
        pricingConfirmed: false,
      },
    });
    const docs = await documents(intake.id, client);
    const completion = jobIntakeCompletion(nextData, docs, capabilities);
    const revision = expectedRevision + 1;
    await client.query(
      `UPDATE job_intakes SET data=$2::jsonb,completion=$3::jsonb,status=$4,revision=$5,updated_by_id=$6,updated_at=now() WHERE id=$1`,
      [
        intake.id,
        JSON.stringify(nextData),
        JSON.stringify(completion),
        completion.ready ? "ready" : "draft",
        revision,
        input.actorUserId,
      ],
    );
    await event(client, {
      intakeId: intake.id,
      projectId,
      actorUserId: input.actorUserId,
      eventType: "contract_items_imported",
      beforeRevision: expectedRevision,
      afterRevision: revision,
      evidence: {
        documentId,
        sourceHash: document.source_hash,
        sheetName: preview.sheetName,
        headerRow: preview.headerRow,
        nameColumn: preview.nameColumn,
        quantityColumn: preview.quantityColumn,
        mappingFingerprint,
        importedRows: preview.rows.length,
        totalRows: mergedItems.length,
      },
    });
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
  return getJobIntake({ actorUserId: input.actorUserId, projectId });
}

export async function uploadJobIntakeDocument(input: {
  actorUserId: number;
  projectId: unknown;
  category: unknown;
  revisionLabel?: unknown;
  expectedRevision: unknown;
  fileName: unknown;
  mimeType: unknown;
  bytes: Buffer;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId"),
    access = await scope(input.actorUserId, projectId),
    category = String(input.category ?? "");
  if (!categories.has(category))
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_DOCUMENT_CATEGORY_INVALID",
      "Choose a recognized intake document category.",
    );
  const fileName = boundedText(input.fileName, "fileName", 1, 255),
    extension = path.extname(fileName).toLowerCase();
  if (!extensions.has(extension))
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_DOCUMENT_TYPE_INVALID",
      "Only PDF, Word, Excel, and CSV intake documents are accepted.",
    );
  if (!input.bytes.length || input.bytes.length > 25 * 1024 * 1024)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_DOCUMENT_SIZE_INVALID",
      "Intake documents must be between 1 byte and 25 MB.",
    );
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_REVISION_INVALID",
      "A valid expected revision is required.",
    );
  const sourceHash = crypto
      .createHash("sha256")
      .update(input.bytes)
      .digest("hex"),
    preview = await extraction(input.bytes, fileName);
  let storagePath: string | null = null;
  const client = await pool.connect();
  try {
    storagePath = await storage.upload(input.bytes, projectId, fileName);
    await client.query("BEGIN");
    const intake = (
      await client.query(
        `SELECT * FROM job_intakes WHERE project_id=$1 FOR UPDATE`,
        [projectId],
      )
    ).rows[0];
    if (!intake)
      throw new FinancialControlError(
        404,
        "JOB_INTAKE_NOT_FOUND",
        "Initialize this job intake before uploading documents.",
      );
    if (intake.status === "activated")
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_ACTIVATED",
        "An activated intake is immutable.",
      );
    if (Number(intake.revision) !== expectedRevision)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_STALE",
        "Reload the intake before uploading this document.",
      );
    const file = (
      await client.query(
        `INSERT INTO files(project_id,file_name,file_size,file_type,version,status,uploaded_by_id,file_hash,file_size_bytes,document_relationship,document_relationship_declared_at,file_type_tier,source,storage_path,is_compliant) VALUES($1,$2,$3,$4,1,'approved',$5,$6,$3,'supporting',now(),'standard','job-intake',$7,true) RETURNING id`,
        [
          projectId,
          fileName,
          input.bytes.length,
          String(input.mimeType || "application/octet-stream"),
          input.actorUserId,
          sourceHash,
          storagePath,
        ],
      )
    ).rows[0];
    const id = uuid();
    await client.query(
      `INSERT INTO job_intake_documents(id,intake_id,project_id,file_id,category,revision_label,source_hash,extraction_status,extraction_summary,uploaded_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [
        id,
        intake.id,
        projectId,
        file.id,
        category,
        input.revisionLabel == null || input.revisionLabel === ""
          ? null
          : boundedText(input.revisionLabel, "revisionLabel", 1, 100),
        sourceHash,
        preview.status,
        JSON.stringify(preview.summary),
        input.actorUserId,
      ],
    );
    const docs = await documents(intake.id, client),
      data = normalizeJobIntakeData(intake.data),
      capabilities = await capabilitiesFor(input.actorUserId, client),
      completion = jobIntakeCompletion(data, docs, capabilities),
      revision = expectedRevision + 1;
    await client.query(
      `UPDATE job_intakes SET completion=$2::jsonb,status=$3,revision=$4,updated_by_id=$5,updated_at=now() WHERE id=$1`,
      [
        intake.id,
        JSON.stringify(completion),
        completion.ready ? "ready" : "draft",
        revision,
        input.actorUserId,
      ],
    );
    await event(client, {
      intakeId: intake.id,
      projectId,
      actorUserId: input.actorUserId,
      eventType: "source_document_added",
      beforeRevision: expectedRevision,
      afterRevision: revision,
      evidence: {
        documentId: id,
        fileId: Number(file.id),
        category,
        sourceHash,
        extractionStatus: preview.status,
      },
    });
    await client.query("COMMIT");
    storagePath = null;
    return {
      documentId: id,
      fileId: Number(file.id),
      sourceHash,
      extractionStatus: preview.status,
      extractionSummary: preview.summary,
      revision,
      completion,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    if (storagePath) await storage.delete(storagePath);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeJobIntakeDocument(input: {
  actorUserId: number;
  projectId: unknown;
  documentId: unknown;
  expectedRevision: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId");
  await scope(input.actorUserId, projectId);
  const documentId = boundedText(input.documentId, "documentId", 3, 100),
    expectedRevision = Number(input.expectedRevision);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const intake = (
      await client.query(
        `SELECT * FROM job_intakes WHERE project_id=$1 FOR UPDATE`,
        [projectId],
      )
    ).rows[0];
    if (!intake || Number(intake.revision) !== expectedRevision)
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_STALE",
        "Reload the intake before removing this document.",
      );
    const document = (
      await client.query(
        `UPDATE job_intake_documents SET removed_at=now(),removed_by_id=$3 WHERE id=$1 AND intake_id=$2 AND removed_at IS NULL RETURNING id,file_id,source_hash`,
        [documentId, intake.id, input.actorUserId],
      )
    ).rows[0];
    if (!document)
      throw new FinancialControlError(
        404,
        "JOB_INTAKE_DOCUMENT_NOT_FOUND",
        "Active intake document not found.",
      );
    const docs = await documents(intake.id, client),
      data = normalizeJobIntakeData(intake.data),
      capabilities = await capabilitiesFor(input.actorUserId, client),
      completion = jobIntakeCompletion(data, docs, capabilities),
      revision = expectedRevision + 1;
    await client.query(
      `UPDATE job_intakes SET completion=$2::jsonb,status=$3,revision=$4,updated_by_id=$5,updated_at=now() WHERE id=$1`,
      [
        intake.id,
        JSON.stringify(completion),
        completion.ready ? "ready" : "draft",
        revision,
        input.actorUserId,
      ],
    );
    await event(client, {
      intakeId: intake.id,
      projectId,
      actorUserId: input.actorUserId,
      eventType: "source_document_removed",
      beforeRevision: expectedRevision,
      afterRevision: revision,
      evidence: {
        documentId,
        fileId: Number(document.file_id),
        sourceHash: document.source_hash,
        sourceBytesPreserved: true,
      },
    });
    await client.query("COMMIT");
    return { revision, completion };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createCoreActivationWithClient(
  input: {
    actorUserId: number;
    projectId: number;
    intakeId: string;
    data: JobIntakeData;
    capabilities: JobIntakeCapabilities;
  },
  client: any,
) {
  let workItemsCreated = 0,
    tasksCreated = 0,
    assignmentsCreated = 0;
  const workItemByScope = new Map<string, { id: string; taskId: string }>();
  for (const item of input.data.scopeItems) {
    const workItemId = uuid();
    const inserted = (
      await client.query(
        `INSERT INTO job_activation_work_items(id,intake_id,project_id,stable_scope_item_id,name,description,unit,planned_hours,workflow_template,billing_hourly_rate,planned_billable_value,apu_plan_version,budget_snapshot_line_id,project_cost_node_id,commercial_capabilities,created_by_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
      ON CONFLICT(intake_id,stable_scope_item_id) DO NOTHING RETURNING id`,
        [
          workItemId,
          input.intakeId,
          input.projectId,
          item.id,
          item.name,
          item.description,
          item.unit,
          item.plannedHours,
          item.workflowTemplate || input.data.delivery.workflowTemplate,
          input.capabilities.costValuePlanner ? item.billingHourlyRate : null,
          input.capabilities.costValuePlanner ? item.contractValue : null,
          input.capabilities.costValuePlanner ? item.apuPlanVersion : null,
          input.capabilities.budget ? item.budgetSnapshotLineId || null : null,
          input.capabilities.budget ? item.projectCostNodeId || null : null,
          JSON.stringify(input.capabilities),
          input.actorUserId,
        ],
      )
    ).rows[0];
    const actualWorkItemId =
      inserted?.id ??
      (
        await client.query(
          `SELECT id FROM job_activation_work_items WHERE intake_id=$1 AND stable_scope_item_id=$2`,
          [input.intakeId, item.id],
        )
      ).rows[0]?.id;
    if (!actualWorkItemId)
      throw new FinancialControlError(
        500,
        "JOB_ACTIVATION_WORK_ITEM_FAILED",
        "The operational work item could not be created.",
      );
    if (inserted) workItemsCreated += 1;
    const taskId = uuid();
    const taskInserted = (
      await client.query(
        `INSERT INTO job_activation_tasks(id,work_item_id,task_key,name_en,name_es,sequence,status,planned_hours,assignee_user_id,created_by_id)
      VALUES($1,$2,'scope-delivery','Deliver scope item','Entregar partida de alcance',1,'not_started',$3,$4,$5)
      ON CONFLICT(work_item_id,task_key) DO NOTHING RETURNING id`,
        [
          taskId,
          actualWorkItemId,
          item.plannedHours,
          input.data.team.projectLeaderUserId,
          input.actorUserId,
        ],
      )
    ).rows[0];
    const actualTaskId =
      taskInserted?.id ??
      (
        await client.query(
          `SELECT id FROM job_activation_tasks WHERE work_item_id=$1 AND task_key='scope-delivery'`,
          [actualWorkItemId],
        )
      ).rows[0]?.id;
    if (!actualTaskId)
      throw new FinancialControlError(
        500,
        "JOB_ACTIVATION_TASK_FAILED",
        "The operational delivery task could not be created.",
      );
    if (taskInserted) tasksCreated += 1;
    workItemByScope.set(item.id, {
      id: actualWorkItemId,
      taskId: actualTaskId,
    });
  }
  for (const assignment of input.data.team.assignments) {
    const linked = workItemByScope.get(assignment.scopeItemId);
    if (!linked)
      throw new FinancialControlError(
        400,
        "JOB_ACTIVATION_ASSIGNMENT_SCOPE_INVALID",
        "Every resource assignment must reference an activated scope item.",
      );
    const item = input.data.scopeItems.find(
      (candidate) => candidate.id === assignment.scopeItemId,
    )!;
    const inserted = (
      await client.query(
        `INSERT INTO job_activation_resource_assignments(id,intake_id,work_item_id,task_id,source_assignment_id,user_id,person_name,role,employment_type,planned_hours,internal_hourly_rate,billing_hourly_rate,planned_internal_cost,planned_billable_value,created_by_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT(intake_id,source_assignment_id) DO NOTHING RETURNING id`,
        [
          uuid(),
          input.intakeId,
          linked.id,
          linked.taskId,
          assignment.id,
          assignment.userId,
          assignment.personName || "Unassigned resource",
          assignment.role,
          assignment.employmentType,
          assignment.plannedHours,
          input.capabilities.budget ? assignment.internalHourlyRate : null,
          input.capabilities.costValuePlanner ? item.billingHourlyRate : null,
          input.capabilities.budget ? assignment.plannedLaborCost : null,
          input.capabilities.costValuePlanner
            ? decimalProduct(assignment.plannedHours, item.billingHourlyRate)
            : null,
          input.actorUserId,
        ],
      )
    ).rows[0];
    if (inserted) assignmentsCreated += 1;
  }
  return {
    workItemsCreated,
    tasksCreated,
    assignmentsCreated,
    workItemByScope,
  };
}

function decimalProduct(left: string, right: string) {
  return decimalFromScaled(
    (scaledSignedDecimal(left) * scaledSignedDecimal(right) + 500_000n) /
      1_000_000n,
  );
}

export async function activateJobIntake(input: {
  actorUserId: number;
  projectId: unknown;
  expectedRevision: unknown;
  confirmationFingerprint: unknown;
}) {
  await waitForJobIntakeMigration();
  const projectId = positiveId(input.projectId, "projectId");
  await scope(input.actorUserId, projectId);
  const capabilities = await capabilitiesFor(input.actorUserId);
  if (capabilities.fullCommercialActivation)
    await Promise.all([
      waitForFinancialContractMigration(),
      waitForContractItemWorkflowMigration(),
    ]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const intake = (
      await client.query(
        `SELECT * FROM job_intakes WHERE project_id=$1 FOR UPDATE`,
        [projectId],
      )
    ).rows[0];
    if (!intake)
      throw new FinancialControlError(
        404,
        "JOB_INTAKE_NOT_FOUND",
        "Job intake not found.",
      );
    if (intake.status === "activated" && intake.activated_contract_id) {
      await client.query("COMMIT");
      return {
        intakeId: intake.id,
        contractId: intake.activated_contract_id,
        contractIds: Array.isArray(intake.activation_summary?.contracts)
          ? intake.activation_summary.contracts.map((contract: any) =>
              String(contract.contractId),
            )
          : [intake.activated_contract_id],
        status: "activated",
        activationMode: "commercial",
        idempotent: true,
      };
    }
    if (
      intake.status === "activated" &&
      !capabilities.fullCommercialActivation
    ) {
      await client.query("COMMIT");
      return {
        intakeId: intake.id,
        contractId: null,
        status: "activated",
        activationMode: "core",
        idempotent: true,
      };
    }
    if (Number(intake.revision) !== Number(input.expectedRevision))
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_STALE",
        "Reload this intake before activation.",
      );
    const docs = await documents(intake.id, client),
      data = normalizeJobIntakeData(intake.data),
      completion = jobIntakeCompletion(data, docs, capabilities);
    if (
      !completion.ready ||
      completion.fingerprint !== String(input.confirmationFingerprint)
    )
      throw new FinancialControlError(
        409,
        "JOB_INTAKE_NOT_READY",
        `Complete the intake before activation: ${completion.missing.join(" ")}`,
      );
    const core = await createCoreActivationWithClient(
      {
        actorUserId: input.actorUserId,
        projectId,
        intakeId: intake.id,
        data,
        capabilities,
      },
      client,
    );
    const drafts: Array<{
      profileId: string;
      contractId: string;
      contractVersionId: string;
      contractItems: number;
      contractValue: string;
    }> = [];
    let workflowBaseline = { requested: data.scopeItems.length, created: 0 };
    if (capabilities.fullCommercialActivation) {
      const grants: Array<{ userId: number; permission: string }> =
        data.team.assignments
          .filter((assignment: any) => assignment.userId != null)
          .map((assignment: any) => ({
            userId: assignment.userId,
            permission: "view",
          }));
      if (data.team.projectLeaderUserId)
        grants.push({
          userId: data.team.projectLeaderUserId,
          permission: "manage",
        });
      workflowBaseline = { requested: data.scopeItems.length, created: 0 };
      for (const contract of data.commercial.contracts) {
        const contractItems = data.scopeItems.filter(
          (item) => item.contractId === contract.id,
        );
        const contractValue = decimalFromScaled(
          contractItems.reduce(
            (sum, item) => sum + scaledSignedDecimal(item.contractValue),
            0n,
          ),
        );
        const draft = await createContractDraftWithClient(
          {
            actorUserId: input.actorUserId,
            projectId,
            legalNumber: contract.contractNumber,
            perspective: contract.perspective,
            contractType: contract.contractType,
            counterpartyName: contract.counterpartyName,
            title: `${data.identity.jobName} - ${contract.contractNumber}`,
            currency: data.identity.currency,
            originalValue: contractValue,
            budgetSnapshotId: data.commercial.budgetSnapshotId,
            effectiveDate: contract.effectiveDate || undefined,
            completionDate: contract.completionDate || undefined,
            paymentTerms: contract.paymentTerms || undefined,
            commercialMetadata: {
              intakeId: intake.id,
              contractProfileId: contract.id,
              quotationNumber: contract.quotationNumber,
              contractItems: contractItems.length,
              plannedHours: decimalFromScaled(
                contractItems.reduce(
                  (sum, item) => sum + scaledSignedDecimal(item.plannedHours),
                  0n,
                ),
              ),
            },
            initialGrants: grants,
            lines: contractItems.map((item, index) => ({
              stableLineId: item.id,
              budgetSnapshotLineId: item.budgetSnapshotLineId,
              projectCostNodeId: item.projectCostNodeId,
              scheduleItemPlacementId: item.scheduleItemPlacementId,
              description: item.name,
              amount: item.contractValue,
              sortOrder: index,
              contractItem: {
                displayName: item.name,
                quantity: item.plannedHours,
                unit: item.unit,
                unitRate: item.billingHourlyRate,
                apuPlanVersion: item.apuPlanVersion,
                workflowTemplate:
                  item.workflowTemplate || data.delivery.workflowTemplate,
                industryTemplate: "bim-services",
                sourceProvenance: item.provenance,
              },
            })),
          },
          client,
        );
        const initialized = await initializeContractItemWorkflowsWithClient(
          {
            actorUserId: input.actorUserId,
            projectId,
            contractId: draft.id,
            contractVersionId: draft.versionId,
            items: contractItems.map((item) => ({
              stableLineId: item.id,
              displayName: item.name,
              templateKey:
                item.workflowTemplate || data.delivery.workflowTemplate,
            })),
          },
          client,
        );
        workflowBaseline.created += initialized.created;
        await client.query(
          `UPDATE job_activation_work_items SET contract_id=$2,contract_version_id=$3,updated_at=now() WHERE intake_id=$1 AND stable_scope_item_id=ANY($4::text[])`,
          [
            intake.id,
            draft.id,
            draft.versionId,
            contractItems.map((item) => item.id),
          ],
        );
        drafts.push({
          profileId: contract.id,
          contractId: draft.id,
          contractVersionId: draft.versionId,
          contractItems: contractItems.length,
          contractValue,
        });
      }
    }
    const draft = drafts[0] ?? null;
    const activationMode = draft ? "commercial" : "core";
    const activationSummary = {
      activationMode,
      capabilities,
      workItems: data.scopeItems.length,
      tasks: data.scopeItems.length,
      resourceAssignments: data.team.assignments.length,
      contractCreated: Boolean(draft),
      contractId: draft?.contractId ?? null,
      contracts: drafts,
      commercialWorkflowInstances: workflowBaseline.created,
    };
    const revision = Number(intake.revision) + 1;
    await client.query(
      `UPDATE job_intakes SET status='activated',revision=$2,activated_contract_id=$3,activation_mode=$4,activation_summary=$5::jsonb,activated_at=COALESCE(activated_at,now()),updated_by_id=$6,updated_at=now() WHERE id=$1`,
      [
        intake.id,
        revision,
        draft?.contractId ?? null,
        activationMode,
        JSON.stringify(activationSummary),
        input.actorUserId,
      ],
    );
    await client.query(
      `UPDATE projects SET client_name=$2,client_company=$3,location=$4,contract_value=CASE WHEN $8::boolean THEN $5 ELSE contract_value END,start_date=$6,expected_end_date=$7,entry_type='job_intake',updated_at=now() WHERE id=$1`,
      [
        projectId,
        data.identity.clientName,
        data.identity.clientCompany || data.commercial.counterpartyName || null,
        data.identity.location || null,
        completion.totals.contractValue,
        data.identity.startDate || null,
        data.identity.targetCompletionDate || null,
        Boolean(draft),
      ],
    );
    await event(client, {
      intakeId: intake.id,
      projectId,
      actorUserId: input.actorUserId,
      eventType:
        intake.status === "activated"
          ? "commercial_overlay_activated"
          : "job_activated",
      beforeRevision: Number(intake.revision),
      afterRevision: revision,
      evidence: {
        ...activationSummary,
        contractVersionId: draft?.contractVersionId ?? null,
        contractIds: drafts.map((contract) => contract.contractId),
        coreWorkItemsCreated: core.workItemsCreated,
        coreTasksCreated: core.tasksCreated,
        resourceAssignmentsCreated: core.assignmentsCreated,
        completionFingerprint: completion.fingerprint,
        plannedHours: completion.totals.plannedHours,
        plannedLaborCost: capabilities.budget
          ? completion.totals.plannedLaborCost
          : null,
      },
    });
    await client.query("COMMIT");
    return {
      intakeId: intake.id,
      contractId: draft?.contractId ?? null,
      contractIds: drafts.map((contract) => contract.contractId),
      contractVersionId: draft?.contractVersionId ?? null,
      contractVersionIds: drafts.map((contract) => contract.contractVersionId),
      status: "activated",
      activationMode,
      activationSummary,
      idempotent: false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}
