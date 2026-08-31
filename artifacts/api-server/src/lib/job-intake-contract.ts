import crypto from "node:crypto";
import { FinancialControlError } from "./financial-control-contract";
import { normalizeJobApuDrafts } from "./job-apu-builder";
import {
  boundedText,
  decimalFromScaled,
  scaledSignedDecimal,
} from "./financial-budget-contract";
import {
  contractCurrency,
  exactPositiveAmount,
} from "./financial-contract-contract";

export const JOB_INTAKE_STAGES = [
  "documents",
  "identity",
  "scope",
  "pricing",
  "contract",
  "delivery",
  "team",
  "review",
] as const;
export type JobIntakeStage = (typeof JOB_INTAKE_STAGES)[number];

const optionalText = (value: unknown, field: string, max = 1000) =>
  value == null || String(value).trim() === ""
    ? ""
    : boundedText(value, field, 1, max);
const optionalId = (value: unknown, field: string) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_ID_INVALID",
      `${field} must be a positive identifier.`,
    );
  return parsed;
};
const bool = (value: unknown) => value === true;
const exact = (value: unknown, field: string) =>
  value == null || value === ""
    ? "0"
    : exactPositiveAmount(String(value), field);
const positive = (value: string) => scaledSignedDecimal(value) > 0n;

export type JobIntakeData = ReturnType<typeof normalizeJobIntakeData>;

export type SmartIntakeMappingPreview = ReturnType<
  typeof previewSmartIntakeMapping
>;

function spreadsheetColumnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function previewSmartIntakeMapping(input: {
  documentId: unknown;
  sourceHash: unknown;
  fileName: unknown;
  sheets: unknown;
  sheetsTruncated?: unknown;
  sheetName: unknown;
  headerRow: unknown;
  nameColumn: unknown;
  quantityColumn: unknown;
}) {
  const sheets = Array.isArray(input.sheets) ? input.sheets : [];
  const sheetName = boundedText(input.sheetName, "sheetName", 1, 200);
  const sheet = sheets.find(
    (entry: any) => entry && String(entry.name) === sheetName,
  ) as any;
  if (!sheet || !Array.isArray(sheet.rows))
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_MAPPING_SHEET_INVALID",
      "Choose a worksheet from the preserved source preview.",
    );
  const headerRow = Number(input.headerRow);
  const nameColumn = Number(input.nameColumn);
  const quantityColumn = Number(input.quantityColumn);
  if (
    !Number.isSafeInteger(headerRow) ||
    headerRow < 1 ||
    headerRow > sheet.rows.length
  )
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_MAPPING_HEADER_INVALID",
      "Choose a valid header row.",
    );
  if (
    !Number.isSafeInteger(nameColumn) ||
    nameColumn < 0 ||
    !Number.isSafeInteger(quantityColumn) ||
    quantityColumn < 0 ||
    nameColumn === quantityColumn
  )
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_MAPPING_COLUMNS_INVALID",
      "Map Contract Item Name and Quantity to two different columns.",
    );
  const headers = Array.isArray(sheet.rows[headerRow - 1])
    ? sheet.rows[headerRow - 1]
    : [];
  const maxColumn = Math.max(nameColumn, quantityColumn);
  if (maxColumn >= Math.max(Number(sheet.columnCount) || 0, headers.length))
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_MAPPING_COLUMNS_INVALID",
      "The selected mapping column is outside this worksheet.",
    );
  const documentId = boundedText(input.documentId, "documentId", 1, 100);
  const sourceHash = boundedText(input.sourceHash, "sourceHash", 16, 128);
  const fileName = boundedText(input.fileName, "fileName", 1, 255);
  const rows: Array<Record<string, unknown>> = [];
  const issues: Array<{
    sourceRow: number;
    code: string;
    en: string;
    es: string;
  }> = [];
  let blankRows = 0;
  for (let index = headerRow; index < sheet.rows.length; index += 1) {
    const source = Array.isArray(sheet.rows[index]) ? sheet.rows[index] : [];
    const rawName = String(source[nameColumn] ?? "").trim();
    const rawQuantity = String(source[quantityColumn] ?? "").trim();
    const sourceRow = index + 1;
    if (!rawName && !rawQuantity) {
      blankRows += 1;
      continue;
    }
    if (!rawName) {
      issues.push({
        sourceRow,
        code: "name_required",
        en: "Contract Item Name is empty.",
        es: "El Nombre de la Partida de Contrato está vacío.",
      });
      continue;
    }
    if (!rawQuantity || rawQuantity.includes(",")) {
      issues.push({
        sourceRow,
        code: "quantity_invalid",
        en: "Quantity must be an unambiguous positive number.",
        es: "La Cantidad debe ser un número positivo sin ambigüedad.",
      });
      continue;
    }
    let quantity = "";
    try {
      quantity = exactPositiveAmount(rawQuantity, "quantity");
      if (!positive(quantity)) throw new Error("quantity must be positive");
    } catch {
      issues.push({
        sourceRow,
        code: "quantity_invalid",
        en: "Quantity must be an unambiguous positive number.",
        es: "La Cantidad debe ser un número positivo sin ambigüedad.",
      });
      continue;
    }
    const id = `CI-${crypto
      .createHash("sha256")
      .update(`${documentId}:${sourceHash}:${sheetName}:${sourceRow}`)
      .digest("hex")
      .slice(0, 20)}`;
    rows.push({
      id,
      name: boundedText(rawName, "name", 1, 300),
      quantity,
      provenance: {
        sourceDocumentId: documentId,
        sourceHash,
        fileName,
        sheetName,
        headerRow,
        sourceRow,
        nameColumn,
        quantityColumn,
      },
    });
  }
  if (sheet.truncated)
    issues.push({
      sourceRow: sheet.rows.length + 1,
      code: "preview_truncated",
      en: "This worksheet exceeds the bounded 500-row or 100-column mapping preview.",
      es: "Esta hoja supera la vista de mapeo limitada a 500 filas o 100 columnas.",
    });
  if (input.sheetsTruncated === true)
    issues.push({
      sourceRow: 0,
      code: "workbook_sheets_truncated",
      en: "This workbook has more than 25 sheets. Export the intended sheet to a separate workbook before importing.",
      es: "Este libro tiene más de 25 hojas. Exporte la hoja deseada a un libro separado antes de importar.",
    });
  const result = {
    documentId,
    sourceHash,
    fileName,
    sheetName,
    headerRow,
    columns: Array.from(
      { length: Math.max(Number(sheet.columnCount) || 0, headers.length) },
      (_, index) => ({
        index,
        label:
          String(headers[index] ?? "").trim() ||
          `Column ${spreadsheetColumnLabel(index)}`,
      }),
    ),
    nameColumn,
    quantityColumn,
    rows,
    issues,
    blankRows,
    sourceRowCount: Number(sheet.rowCount) || sheet.rows.length,
  };
  return {
    ...result,
    mappingFingerprint: crypto
      .createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  };
}

export function normalizeJobIntakeData(raw: unknown) {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, any>)
      : {};
  const identity =
    input.identity && typeof input.identity === "object" ? input.identity : {};
  const commercial =
    input.commercial && typeof input.commercial === "object"
      ? input.commercial
      : {};
  const delivery =
    input.delivery && typeof input.delivery === "object" ? input.delivery : {};
  const team = input.team && typeof input.team === "object" ? input.team : {};
  const review =
    input.review && typeof input.review === "object" ? input.review : {};
  const scopeItems = Array.isArray(input.scopeItems) ? input.scopeItems : [];
  const relationshipInput =
    input.relationships && typeof input.relationships === "object"
      ? input.relationships
      : {};
  const participantInput = Array.isArray(relationshipInput.participants)
    ? relationshipInput.participants
    : [];
  const engagementInput = Array.isArray(relationshipInput.engagements)
    ? relationshipInput.engagements
    : [];
  if (participantInput.length > 50)
    throw new FinancialControlError(400, "JOB_INTAKE_PARTICIPANT_LIMIT", "An Intake accepts up to 50 participating companies.");
  if (engagementInput.length > 100)
    throw new FinancialControlError(400, "JOB_INTAKE_ENGAGEMENT_LIMIT", "An Intake accepts up to 100 company relationships.");
  const participantIds = new Set<string>();
  const participantRoles = new Set(["owner", "general_contractor", "customer", "service_provider", "trade_contractor", "consultant", "vendor", "other"]);
  const participants = participantInput.map((rawParticipant: any, index: number) => {
    const participant = rawParticipant && typeof rawParticipant === "object" ? rawParticipant : {};
    const id = optionalText(participant.id, `relationships.participants[${index}].id`, 100);
    if (!id) throw new FinancialControlError(400, "JOB_INTAKE_PARTICIPANT_ID_REQUIRED", "Every participating company requires a stable ID.");
    if (participantIds.has(id)) throw new FinancialControlError(400, "JOB_INTAKE_PARTICIPANT_ID_DUPLICATE", "Participating company IDs must be unique.");
    participantIds.add(id);
    const role = participantRoles.has(String(participant.role)) ? String(participant.role) : "other";
    const companyName = optionalText(participant.companyName, `relationships.participants[${index}].companyName`, 200);
    if (!companyName) throw new FinancialControlError(400, "COMPANY_NAME_REQUIRED", "Every company in the job map needs a name.");
    return { id, companyId: optionalId(participant.companyId, `relationships.participants[${index}].companyId`), companyName, role, contactName: optionalText(participant.contactName, `relationships.participants[${index}].contactName`, 200) };
  });
  const engagementIds = new Set<string>();
  const engagements = engagementInput.map((rawEngagement: any, index: number) => {
    const engagement = rawEngagement && typeof rawEngagement === "object" ? rawEngagement : {};
    const id = optionalText(engagement.id, `relationships.engagements[${index}].id`, 100);
    if (!id) throw new FinancialControlError(400, "JOB_INTAKE_ENGAGEMENT_ID_REQUIRED", "Every company relationship requires a stable ID.");
    if (engagementIds.has(id)) throw new FinancialControlError(400, "JOB_INTAKE_ENGAGEMENT_ID_DUPLICATE", "Company relationship IDs must be unique.");
    engagementIds.add(id);
    const providerParticipantId = optionalText(engagement.providerParticipantId, `relationships.engagements[${index}].providerParticipantId`, 100);
    const customerParticipantId = optionalText(engagement.customerParticipantId, `relationships.engagements[${index}].customerParticipantId`, 100);
    if (!providerParticipantId || !customerParticipantId || !participantIds.has(providerParticipantId) || !participantIds.has(customerParticipantId))
      throw new FinancialControlError(400, "JOB_INTAKE_ENGAGEMENT_PARTICIPANT_INVALID", "Every relationship must connect two participating companies in this Intake.");
    if (providerParticipantId === customerParticipantId)
      throw new FinancialControlError(400, "JOB_INTAKE_ENGAGEMENT_PARTIES_MUST_DIFFER", "A company cannot hire itself in the same relationship.");
    return { id, providerParticipantId, customerParticipantId, description: optionalText(engagement.description, `relationships.engagements[${index}].description`, 300) };
  });
  const assignments = Array.isArray(team.assignments) ? team.assignments : [];
  const contractInputs = Array.isArray(commercial.contracts)
    ? commercial.contracts
    : [];
  if (scopeItems.length > 500)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_SCOPE_LIMIT",
      "No more than 500 scope items are accepted.",
    );
  if (assignments.length > 500)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_ASSIGNMENT_LIMIT",
      "No more than 500 assignments are accepted.",
    );
  if (contractInputs.length > 50)
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_CONTRACT_LIMIT",
      "No more than 50 contract profiles are accepted.",
    );
  const contractIds = new Set<string>();
  const normalizedContracts = (
    contractInputs.length
      ? contractInputs
      : [
          {
            id: "PRIMARY",
            quotationNumber: commercial.quotationNumber,
            contractNumber: commercial.contractNumber,
            counterpartyName: commercial.counterpartyName,
            perspective: commercial.perspective,
            contractType: commercial.contractType,
            paymentTerms: commercial.paymentTerms,
            effectiveDate: commercial.effectiveDate,
            completionDate: commercial.completionDate,
          },
        ]
  ).map((rawContract: any, index: number) => {
    const contract =
      rawContract && typeof rawContract === "object" ? rawContract : {};
    const id =
      optionalText(contract.id, `commercial.contracts[${index}].id`, 100) ||
      `CONTRACT-${index + 1}`;
    if (contractIds.has(id))
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_CONTRACT_ID_DUPLICATE",
        "Contract profile IDs must be unique within the Intake.",
      );
    contractIds.add(id);
    return {
      id,
      quotationNumber: optionalText(
        contract.quotationNumber,
        `commercial.contracts[${index}].quotationNumber`,
        100,
      ),
      contractNumber: optionalText(
        contract.contractNumber,
        `commercial.contracts[${index}].contractNumber`,
        100,
      ),
      counterpartyName: optionalText(
        contract.counterpartyName,
        `commercial.contracts[${index}].counterpartyName`,
        200,
      ),
      perspective: ["upstream", "downstream"].includes(
        String(contract.perspective),
      )
        ? String(contract.perspective)
        : "downstream",
      title: optionalText(
        contract.title,
        `commercial.contracts[${index}].title`,
        200,
      ),
      engagementId: optionalText(
        contract.engagementId,
        `commercial.contracts[${index}].engagementId`,
        100,
      ),
      parentContractId: optionalText(
        contract.parentContractId,
        `commercial.contracts[${index}].parentContractId`,
        100,
      ),
      agreementKind: ["quote", "base", "additional", "change_order", "addition", "amendment"].includes(
        String(contract.agreementKind),
      )
        ? String(contract.agreementKind)
        : "base",
      status: ["draft", "proposed", "sent", "negotiating", "accepted", "active", "rejected", "superseded", "cancelled", "completed"].includes(
        String(contract.status),
      )
        ? String(contract.status)
        : "draft",
      contractType: [
        "owner_prime",
        "subcontract",
        "purchase_order",
        "consultant_agreement",
        "other_commitment",
      ].includes(String(contract.contractType))
        ? String(contract.contractType)
        : "subcontract",
      paymentTerms: optionalText(
        contract.paymentTerms,
        `commercial.contracts[${index}].paymentTerms`,
        1000,
      ),
      effectiveDate: optionalText(
        contract.effectiveDate,
        `commercial.contracts[${index}].effectiveDate`,
        20,
      ),
      completionDate: optionalText(
        contract.completionDate,
        `commercial.contracts[${index}].completionDate`,
        20,
      ),
    };
  });
  const contractLegalKeys = new Set<string>();
  const availableEngagementIds = new Set(engagements.map((engagement: any) => engagement.id));
  for (const contract of normalizedContracts) {
    if (contract.engagementId && !availableEngagementIds.has(contract.engagementId))
      throw new FinancialControlError(400, "JOB_INTAKE_CONTRACT_ENGAGEMENT_INVALID", "Every selected agreement relationship must exist in this Intake.");
    if (contract.parentContractId && (!contractIds.has(contract.parentContractId) || contract.parentContractId === contract.id))
      throw new FinancialControlError(400, "JOB_INTAKE_CONTRACT_PARENT_INVALID", "Every selected parent agreement must be a different agreement in this Intake.");
    if (!contract.contractNumber) continue;
    const legalKey = `${contract.perspective}:${contract.contractNumber.toLowerCase()}`;
    if (contractLegalKeys.has(legalKey))
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_CONTRACT_LEGAL_ID_DUPLICATE",
        "Contract profiles must use unique numbers within each perspective.",
      );
    contractLegalKeys.add(legalKey);
  }
  const primaryContract = normalizedContracts[0];
  const scopeItemIds = new Set<string>();
  const normalizedItems = scopeItems.map((rawItem: any, index: number) => {
    const item = rawItem && typeof rawItem === "object" ? rawItem : {};
    const plannedHours = exact(
      item.plannedHours,
      `scopeItems[${index}].plannedHours`,
    );
    const billingHourlyRate = exact(
      item.billingHourlyRate,
      `scopeItems[${index}].billingHourlyRate`,
    );
    const id = optionalText(item.id, `scopeItems[${index}].id`, 100);
    if (!id)
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_SCOPE_ID_REQUIRED",
        "Every Contract Item requires an automatically generated stable ID.",
      );
    if (scopeItemIds.has(id))
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_SCOPE_ID_DUPLICATE",
        "Contract Item IDs must be unique within the Intake.",
      );
    scopeItemIds.add(id);
    return {
      id,
      name: optionalText(item.name, `scopeItems[${index}].name`, 300),
      description: optionalText(
        item.description,
        `scopeItems[${index}].description`,
        2000,
      ),
      plannedHours,
      billingHourlyRate,
      contractValue: decimalFromScaled(
        (scaledSignedDecimal(plannedHours) *
          scaledSignedDecimal(billingHourlyRate) +
          500_000n) /
          1_000_000n,
      ),
      unit: optionalText(item.unit, `scopeItems[${index}].unit`, 40) || "Hours",
      apuPlanVersion: optionalId(
        item.apuPlanVersion,
        `scopeItems[${index}].apuPlanVersion`,
      ),
      apuDraftId: optionalText(item.apuDraftId, `scopeItems[${index}].apuDraftId`, 100),
      budgetSnapshotLineId: optionalText(
        item.budgetSnapshotLineId,
        `scopeItems[${index}].budgetSnapshotLineId`,
        100,
      ),
      projectCostNodeId: optionalText(
        item.projectCostNodeId,
        `scopeItems[${index}].projectCostNodeId`,
        100,
      ),
      scheduleItemPlacementId: optionalId(
        item.scheduleItemPlacementId,
        `scopeItems[${index}].scheduleItemPlacementId`,
      ),
      assumptions: optionalText(
        item.assumptions,
        `scopeItems[${index}].assumptions`,
        2000,
      ),
      exclusions: optionalText(
        item.exclusions,
        `scopeItems[${index}].exclusions`,
        2000,
      ),
      workflowTemplate: optionalText(
        item.workflowTemplate,
        `scopeItems[${index}].workflowTemplate`,
        100,
      ),
      contractId:
        optionalText(item.contractId, `scopeItems[${index}].contractId`, 100) ||
        primaryContract.id,
      provenance:
        item.provenance &&
        typeof item.provenance === "object" &&
        !Array.isArray(item.provenance)
          ? {
              sourceDocumentId: optionalText(
                item.provenance.sourceDocumentId,
                `scopeItems[${index}].provenance.sourceDocumentId`,
                100,
              ),
              source: optionalText(
                item.provenance.source,
                `scopeItems[${index}].provenance.source`,
                40,
              ),
              sourceHash: optionalText(
                item.provenance.sourceHash,
                `scopeItems[${index}].provenance.sourceHash`,
                128,
              ),
              fileName: optionalText(
                item.provenance.fileName,
                `scopeItems[${index}].provenance.fileName`,
                255,
              ),
              sheetName: optionalText(
                item.provenance.sheetName,
                `scopeItems[${index}].provenance.sheetName`,
                200,
              ),
              headerRow: optionalId(
                item.provenance.headerRow,
                `scopeItems[${index}].provenance.headerRow`,
              ),
              sourceRow: optionalId(
                item.provenance.sourceRow,
                `scopeItems[${index}].provenance.sourceRow`,
              ),
              nameColumn: Number.isSafeInteger(
                Number(item.provenance.nameColumn),
              )
                ? Number(item.provenance.nameColumn)
                : null,
              quantityColumn: Number.isSafeInteger(
                Number(item.provenance.quantityColumn),
              )
                ? Number(item.provenance.quantityColumn)
                : null,
            }
          : null,
    };
  });
  if (normalizedItems.some((item) => !contractIds.has(item.contractId)))
    throw new FinancialControlError(
      400,
      "JOB_INTAKE_CONTRACT_ITEM_PROFILE_INVALID",
      "Every Contract Item must reference a contract profile in this Intake.",
    );
  const apuDrafts = normalizeJobApuDrafts(input.apuDrafts, contractIds);
  const apuDraftIds = new Set(apuDrafts.map((item) => item.id));
  if (normalizedItems.some((item) => item.apuDraftId && !apuDraftIds.has(item.apuDraftId)))
    throw new FinancialControlError(400, "JOB_INTAKE_APU_DRAFT_INVALID", "Every selected APU draft must exist in this Intake.");
  const normalizedAssignments = assignments.map(
    (rawAssignment: any, index: number) => {
      const assignment =
        rawAssignment && typeof rawAssignment === "object" ? rawAssignment : {};
      const plannedHours = exact(
        assignment.plannedHours,
        `assignments[${index}].plannedHours`,
      );
      const internalHourlyRate = exact(
        assignment.internalHourlyRate,
        `assignments[${index}].internalHourlyRate`,
      );
      return {
        id:
          optionalText(assignment.id, `assignments[${index}].id`, 100) ||
          `ASSIGN-${index + 1}`,
        userId: optionalId(assignment.userId, `assignments[${index}].userId`),
        personName: optionalText(
          assignment.personName,
          `assignments[${index}].personName`,
          200,
        ),
        role: optionalText(assignment.role, `assignments[${index}].role`, 100),
        employmentType:
          optionalText(
            assignment.employmentType,
            `assignments[${index}].employmentType`,
            50,
          ) || "employee",
        scopeItemId: optionalText(
          assignment.scopeItemId,
          `assignments[${index}].scopeItemId`,
          100,
        ),
        plannedHours,
        internalHourlyRate,
        plannedLaborCost: decimalFromScaled(
          (scaledSignedDecimal(plannedHours) *
            scaledSignedDecimal(internalHourlyRate) +
            500_000n) /
            1_000_000n,
        ),
      };
    },
  );
  return {
    relationships: { participants, engagements },
    identity: {
      jobName: optionalText(identity.jobName, "identity.jobName", 300),
      jobCode: optionalText(identity.jobCode, "identity.jobCode", 60),
      clientName: optionalText(identity.clientName, "identity.clientName", 200),
      clientCompany: optionalText(
        identity.clientCompany,
        "identity.clientCompany",
        200,
      ),
      location: optionalText(identity.location, "identity.location", 500),
      currency: identity.currency ? contractCurrency(identity.currency) : "USD",
      primaryContact: optionalText(
        identity.primaryContact,
        "identity.primaryContact",
        200,
      ),
      startDate: optionalText(identity.startDate, "identity.startDate", 20),
      targetCompletionDate: optionalText(
        identity.targetCompletionDate,
        "identity.targetCompletionDate",
        20,
      ),
    },
    scopeItems: normalizedItems,
    apuDrafts,
    commercial: {
      contracts: normalizedContracts,
      quotationNumber: optionalText(
        primaryContract.quotationNumber,
        "commercial.quotationNumber",
        100,
      ),
      contractNumber: optionalText(
        primaryContract.contractNumber,
        "commercial.contractNumber",
        100,
      ),
      counterpartyName: optionalText(
        primaryContract.counterpartyName,
        "commercial.counterpartyName",
        200,
      ),
      perspective: primaryContract.perspective,
      contractType: primaryContract.contractType,
      budgetSnapshotId: optionalText(
        commercial.budgetSnapshotId,
        "commercial.budgetSnapshotId",
        100,
      ),
      paymentTerms: optionalText(
        primaryContract.paymentTerms,
        "commercial.paymentTerms",
        1000,
      ),
      effectiveDate: optionalText(
        primaryContract.effectiveDate,
        "commercial.effectiveDate",
        20,
      ),
      completionDate: optionalText(
        primaryContract.completionDate,
        "commercial.completionDate",
        20,
      ),
    },
    delivery: {
      workflowTemplate:
        optionalText(
          delivery.workflowTemplate,
          "delivery.workflowTemplate",
          100,
        ) || "bim-submittal",
      submittalStrategy: optionalText(
        delivery.submittalStrategy,
        "delivery.submittalStrategy",
        2000,
      ),
      milestoneSummary: optionalText(
        delivery.milestoneSummary,
        "delivery.milestoneSummary",
        2000,
      ),
    },
    team: {
      projectLeaderUserId: optionalId(
        team.projectLeaderUserId,
        "team.projectLeaderUserId",
      ),
      assignments: normalizedAssignments,
    },
    review: {
      sourceConfirmed: bool(review.sourceConfirmed),
      scopeConfirmed: bool(review.scopeConfirmed),
      pricingConfirmed: bool(review.pricingConfirmed),
      contractConfirmed: bool(review.contractConfirmed),
      deliveryConfirmed: bool(review.deliveryConfirmed),
      teamConfirmed: bool(review.teamConfirmed),
    },
  };
}

const ratio = (checks: boolean[]) =>
  checks.length ? checks.filter(Boolean).length / checks.length : 0;
export type JobIntakeCapabilities = {
  package: boolean;
  budget: boolean;
  contracts: boolean;
  costValuePlanner: boolean;
  anyCommercial: boolean;
  fullCommercialActivation: boolean;
};

export const FULL_JOB_INTAKE_CAPABILITIES: JobIntakeCapabilities = {
  package: true,
  budget: true,
  contracts: true,
  costValuePlanner: true,
  anyCommercial: true,
  fullCommercialActivation: true,
};

export function jobIntakeCoreFingerprint(data: JobIntakeData) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        identity: data.identity,
        scopeItems: data.scopeItems.map(
          ({
            billingHourlyRate: _billingHourlyRate,
            apuPlanVersion: _apuPlanVersion,
            budgetSnapshotLineId: _budgetSnapshotLineId,
            projectCostNodeId: _projectCostNodeId,
            contractValue: _contractValue,
            contractId: _contractId,
            ...item
          }) => item,
        ),
        delivery: data.delivery,
        team: {
          projectLeaderUserId: data.team.projectLeaderUserId,
          assignments: data.team.assignments.map(
            (entry: (typeof data.team.assignments)[number]) => {
              const {
                internalHourlyRate: _internalHourlyRate,
                plannedLaborCost: _plannedLaborCost,
                ...assignment
              } = entry;
              return assignment;
            },
          ),
        },
      }),
    )
    .digest("hex");
}

export function jobIntakeCompletion(
  data: JobIntakeData,
  documents: Array<{ category: string; removedAt?: unknown }>,
  capabilities: JobIntakeCapabilities = FULL_JOB_INTAKE_CAPABILITIES,
) {
  const activeDocuments = documents.filter((document) => !document.removedAt);
  const scopeReady =
    data.scopeItems.length > 0 &&
    data.scopeItems.every((item) => item.name && positive(item.plannedHours));
  const pricingReady =
    data.scopeItems.length > 0 &&
    data.scopeItems.every(
      (item) => positive(item.billingHourlyRate) && item.apuPlanVersion != null,
    );
  const contractItemsReady =
    data.scopeItems.length > 0 &&
    data.scopeItems.every(
      (item) => item.budgetSnapshotLineId && item.projectCostNodeId,
    );
  const plannedHours = data.scopeItems.reduce(
    (sum, item) => sum + scaledSignedDecimal(item.plannedHours),
    0n,
  );
  const assignedHours = data.team.assignments.reduce(
    (sum: bigint, assignment: any) =>
      sum + scaledSignedDecimal(assignment.plannedHours),
    0n,
  );
  const teamReady =
    data.team.assignments.length > 0 &&
    data.team.assignments.every(
      (assignment: any) =>
        (assignment.userId != null || assignment.personName) &&
        assignment.role &&
        assignment.scopeItemId &&
        data.scopeItems.some((item) => item.id === assignment.scopeItemId) &&
        positive(assignment.plannedHours),
    );
  const teamRatesReady =
    teamReady &&
    data.team.assignments.every((assignment: any) =>
      positive(assignment.internalHourlyRate),
    );
  const assignedContractIds = new Set(
    data.scopeItems.map((item) => item.contractId),
  );
  const contractTermsReady =
    data.commercial.contracts.length > 0 &&
    data.commercial.contracts.every(
      (contract: any) =>
        (contract.agreementKind === "quote" ? contract.quotationNumber : contract.contractNumber) &&
        contract.counterpartyName &&
        (!data.relationships.engagements.length || contract.engagementId) &&
        (!new Set(["change_order", "addition", "amendment"]).has(contract.agreementKind) || contract.parentContractId) &&
        assignedContractIds.has(contract.id),
    );
  const budgetReady = !!data.commercial.budgetSnapshotId && contractItemsReady;
  const stageChecks: Record<JobIntakeStage, boolean[]> = {
    documents: activeDocuments.length ? [data.review.sourceConfirmed] : [],
    identity: [
      !!data.identity.jobName,
      !!data.identity.jobCode,
      !!data.identity.clientName,
      !!data.identity.currency,
    ],
    scope: [data.scopeItems.length > 0, scopeReady, data.review.scopeConfirmed],
    pricing: capabilities.costValuePlanner
      ? [pricingReady, data.review.pricingConfirmed]
      : [],
    contract: [
      ...(capabilities.contracts
        ? [contractTermsReady, data.review.contractConfirmed]
        : []),
      ...(capabilities.budget ? [budgetReady] : []),
    ],
    delivery: [
      !!data.delivery.workflowTemplate,
      !!data.delivery.submittalStrategy,
      data.review.deliveryConfirmed,
    ],
    team: [
      data.team.projectLeaderUserId != null,
      teamReady,
      ...(capabilities.budget ? [teamRatesReady] : []),
      assignedHours >= plannedHours && plannedHours > 0n,
      data.review.teamConfirmed,
    ],
    review: [
      ...(activeDocuments.length ? [data.review.sourceConfirmed] : []),
      data.review.scopeConfirmed,
      ...(capabilities.costValuePlanner ? [data.review.pricingConfirmed] : []),
      ...(capabilities.contracts ? [data.review.contractConfirmed] : []),
      data.review.deliveryConfirmed,
      data.review.teamConfirmed,
    ],
  };
  const baseWeights: Record<JobIntakeStage, number> = {
    documents: 10,
    identity: 10,
    scope: 20,
    pricing: 20,
    contract: 15,
    delivery: 10,
    team: 10,
    review: 5,
  };
  const requiredWeight = JOB_INTAKE_STAGES.reduce(
    (sum, key) => sum + (stageChecks[key].length ? baseWeights[key] : 0),
    0,
  );
  const stages = JOB_INTAKE_STAGES.map((key) => {
    const required = stageChecks[key].length > 0;
    const progress = Math.round(ratio(stageChecks[key]) * 100);
    return {
      key,
      required,
      weight: required ? baseWeights[key] : 0,
      progress: required ? progress : 100,
      status: required
        ? progress === 100
          ? "complete"
          : progress === 0
            ? "not_started"
            : "in_progress"
        : "optional",
    };
  });
  const percent = requiredWeight
    ? Math.round(
        (stages.reduce(
          (sum, stage) => sum + (stage.weight * stage.progress) / 100,
          0,
        ) *
          100) /
          requiredWeight,
      )
    : 100;
  const missingItems = [
    !data.identity.jobName && {
      code: "job_name",
      en: "Enter the job name.",
      es: "Ingrese el nombre del trabajo.",
    },
    !data.identity.jobCode && {
      code: "job_code",
      en: "Enter the job code.",
      es: "Ingrese el código del trabajo.",
    },
    !data.identity.clientName && {
      code: "client",
      en: "Enter the client.",
      es: "Ingrese el cliente.",
    },
    !scopeReady && {
      code: "scope",
      en: "Add scope items with planned hours.",
      es: "Agregue partidas de alcance con horas planificadas.",
    },
    capabilities.costValuePlanner &&
      !pricingReady && {
        code: "pricing",
        en: "Select an APU and billing hourly rate for every scope item.",
        es: "Seleccione un APU y una tarifa facturable para cada partida.",
      },
    capabilities.budget &&
      !contractItemsReady && {
        code: "budget_mapping",
        en: "Map every scope item to an approved budget line.",
        es: "Vincule cada partida con una línea de presupuesto aprobada.",
      },
    capabilities.contracts &&
      data.commercial.contracts.some(
        (contract: any) => contract.agreementKind === "quote" ? !contract.quotationNumber : !contract.contractNumber,
      ) && {
        code: "contract_number",
        en: "Enter the real quote or contract number before activation.",
        es: "Ingrese el número real de cotización o contrato antes de activar.",
      },
    capabilities.contracts && data.relationships.engagements.length > 0 &&
      data.commercial.contracts.some((contract: any) => !contract.engagementId) && {
        code: "contract_relationship",
        en: "Connect every agreement to its provider/customer relationship.",
        es: "Conecte cada acuerdo con su relación proveedor/cliente.",
      },
    capabilities.contracts &&
      data.commercial.contracts.some((contract: any) => new Set(["change_order", "addition", "amendment"]).has(contract.agreementKind) && !contract.parentContractId) && {
        code: "contract_parent",
        en: "Select the base agreement for every change, addition, or amendment.",
        es: "Seleccione el acuerdo base para cada cambio, adición o enmienda.",
      },
    capabilities.contracts &&
      data.commercial.contracts.some(
        (contract: any) => !contract.counterpartyName,
      ) && {
        code: "counterparty",
        en: "Enter the counterparty for every contract profile.",
        es: "Ingrese la contraparte contractual.",
      },
    capabilities.contracts &&
      data.commercial.contracts.some(
        (contract: any) => !assignedContractIds.has(contract.id),
      ) && {
        code: "contract_assignment",
        en: "Assign at least one Contract Item to every contract profile.",
        es: "Asigne al menos una Partida de Contrato a cada perfil de contrato.",
      },
    capabilities.budget &&
      !data.commercial.budgetSnapshotId && {
        code: "budget_snapshot",
        en: "Select the approved budget snapshot.",
        es: "Seleccione el presupuesto aprobado.",
      },
    !data.delivery.submittalStrategy && {
      code: "delivery",
      en: "Describe the Submittal delivery strategy.",
      es: "Describa la estrategia de entrega de submittals.",
    },
    data.team.projectLeaderUserId == null && {
      code: "leader",
      en: "Assign a project leader.",
      es: "Asigne un líder del proyecto.",
    },
    !teamReady && {
      code: "team",
      en: "Assign every team member to a scope item with planned hours.",
      es: "Asigne cada miembro a una partida con horas planificadas.",
    },
    capabilities.budget &&
      !teamRatesReady && {
        code: "internal_rates",
        en: "Enter internal hourly costs for the resource plan.",
        es: "Ingrese los costos horarios internos del plan de recursos.",
      },
    assignedHours < plannedHours && {
      code: "hours",
      en: "Assign all planned scope hours to the team.",
      es: "Asigne al equipo todas las horas planificadas.",
    },
    !(
      (!activeDocuments.length || data.review.sourceConfirmed) &&
      data.review.scopeConfirmed &&
      data.review.deliveryConfirmed &&
      data.review.teamConfirmed &&
      (!capabilities.costValuePlanner || data.review.pricingConfirmed) &&
      (!capabilities.contracts || data.review.contractConfirmed)
    ) && {
      code: "confirmations",
      en: "Complete the required final confirmations.",
      es: "Complete las confirmaciones finales requeridas.",
    },
  ].filter(Boolean) as Array<{ code: string; en: string; es: string }>;
  const missing = missingItems.map((item) => item.en);
  const totals = {
    plannedHours: decimalFromScaled(plannedHours),
    assignedHours: decimalFromScaled(assignedHours),
    unassignedHours: decimalFromScaled(
      plannedHours > assignedHours ? plannedHours - assignedHours : 0n,
    ),
    contractValue: decimalFromScaled(
      data.scopeItems.reduce(
        (sum, item) => sum + scaledSignedDecimal(item.contractValue),
        0n,
      ),
    ),
    plannedLaborCost: decimalFromScaled(
      data.team.assignments.reduce(
        (sum: bigint, item: any) =>
          sum + scaledSignedDecimal(item.plannedLaborCost),
        0n,
      ),
    ),
  };
  const overlayReadiness = {
    costValuePlanner: !capabilities.costValuePlanner
      ? "not_entitled"
      : pricingReady
        ? "ready"
        : "requires_input",
    budget: !capabilities.budget
      ? "not_entitled"
      : budgetReady
        ? "ready"
        : "requires_input",
    contracts: !capabilities.contracts
      ? "not_entitled"
      : contractTermsReady
        ? "ready"
        : "requires_input",
    automaticCommercialActivation: !capabilities.fullCommercialActivation
      ? "not_entitled"
      : pricingReady && budgetReady && contractTermsReady
        ? "ready"
        : "requires_input",
  };
  return {
    percent,
    stages,
    missing,
    missingItems,
    ready: percent === 100 && missing.length === 0,
    totals,
    capabilities,
    overlayReadiness,
    coreFingerprint: jobIntakeCoreFingerprint(data),
    fingerprint: crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          data,
          documents: activeDocuments.map((d) => d.category),
          percent,
          totals,
          capabilities,
        }),
      )
      .digest("hex"),
  };
}
