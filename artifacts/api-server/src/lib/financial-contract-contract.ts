import crypto from "crypto";
import {
  FinancialControlError,
  parseCurrency,
  parseDecimal,
  scaledDecimal,
} from "./financial-control-contract";
import {
  boundedText,
  decimalFromScaled,
  exactSignedDecimal,
  scaledSignedDecimal,
} from "./financial-budget-contract";

export const CONTRACT_PERSPECTIVES = ["upstream", "downstream"] as const;
export const CONTRACT_TYPES = [
  "owner_prime",
  "subcontract",
  "purchase_order",
  "consultant_agreement",
  "other_commitment",
] as const;
export const CONTRACT_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "returned",
  "rejected",
  "withdrawn",
  "executed",
  "superseded",
  "terminated",
  "voided",
  "closed",
] as const;
export const CONTRACT_RECORD_PERMISSIONS = [
  "view",
  "prepare",
  "review",
  "approve",
  "execute",
  "manage",
] as const;

export type ContractLineInput = {
  stableLineId: string;
  budgetSnapshotLineId: string;
  projectCostNodeId: string;
  scheduleItemPlacementId: number | null;
  description: string;
  amount: string;
  contractItem: ContractItemSnapshot;
  sortOrder: number;
};

export type ContractItemSnapshot = {
  displayName: string;
  quantity: string;
  unit: string;
  unitRate: string;
  contractValue: string;
  apuPlanVersion: number | null;
  apuFingerprint: string | null;
  apuContent: Record<string, unknown> | null;
  apuEvaluation: Record<string, unknown> | null;
  workflowTemplate: string;
  industryTemplate: string;
  sourceProvenance: Record<string, unknown> | null;
  status: "draft";
};

const exactProduct = (quantity: string, unitRate: string) =>
  decimalFromScaled(
    (scaledDecimal(quantity) * scaledDecimal(unitRate) + 500_000n) / 1_000_000n,
  );

function optionalProvenanceText(value: unknown, field: string, max: number) {
  return value == null || String(value).trim() === ""
    ? null
    : boundedText(value, field, 1, max);
}

function optionalProvenanceInteger(
  value: unknown,
  field: string,
  minimum: number,
) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum)
    throw new FinancialControlError(
      400,
      "CONTRACT_ITEM_PROVENANCE_INVALID",
      `${field} is not a valid source coordinate.`,
    );
  return parsed;
}

function normalizeSourceProvenance(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return {
    source: optionalProvenanceText(source.source, "contractItem.sourceProvenance.source", 40),
    sourceDocumentId: optionalProvenanceText(source.sourceDocumentId, "contractItem.sourceProvenance.sourceDocumentId", 100),
    sourceHash: optionalProvenanceText(source.sourceHash, "contractItem.sourceProvenance.sourceHash", 128),
    fileName: optionalProvenanceText(source.fileName, "contractItem.sourceProvenance.fileName", 255),
    sheetName: optionalProvenanceText(source.sheetName, "contractItem.sourceProvenance.sheetName", 200),
    headerRow: optionalProvenanceInteger(source.headerRow, "contractItem.sourceProvenance.headerRow", 1),
    sourceRow: optionalProvenanceInteger(source.sourceRow, "contractItem.sourceProvenance.sourceRow", 1),
    nameColumn: optionalProvenanceInteger(source.nameColumn, "contractItem.sourceProvenance.nameColumn", 0),
    quantityColumn: optionalProvenanceInteger(source.quantityColumn, "contractItem.sourceProvenance.quantityColumn", 0),
  };
}

const oneOf = <T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string,
): T[number] => {
  const text = String(value ?? "");
  if (!values.includes(text))
    throw new FinancialControlError(
      400,
      "CONTRACT_VALUE_INVALID",
      `${field} is not recognized.`,
    );
  return text as T[number];
};

export const contractPerspective = (v: unknown) =>
  oneOf(v, CONTRACT_PERSPECTIVES, "perspective");
export const contractType = (v: unknown) =>
  oneOf(v, CONTRACT_TYPES, "contractType");
export const contractPermission = (v: unknown) =>
  oneOf(v, CONTRACT_RECORD_PERMISSIONS, "permission");
export const contractCurrency = (v: unknown) => parseCurrency(v);
export const exactPositiveAmount = (v: unknown, field = "amount") =>
  parseDecimal(v, field);
export const exactDelta = (v: unknown, field = "amountDelta") =>
  exactSignedDecimal(v, field);

export function normalizeContractLines(
  input: unknown,
  signed = false,
): ContractLineInput[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 10000)
    throw new FinancialControlError(
      400,
      "CONTRACT_LINES_INVALID",
      "One to 10,000 SOV lines are required.",
    );
  const ids = new Set<string>();
  return input.map((raw, index) => {
    const r = raw as Record<string, unknown>;
    const stableLineId = boundedText(r.stableLineId, "stableLineId", 1, 100);
    if (ids.has(stableLineId))
      throw new FinancialControlError(
        400,
        "CONTRACT_LINE_DUPLICATE",
        "SOV line identities must be unique.",
      );
    ids.add(stableLineId);
    const schedule =
      r.scheduleItemPlacementId == null || r.scheduleItemPlacementId === ""
        ? null
        : Number(r.scheduleItemPlacementId);
    if (schedule != null && (!Number.isSafeInteger(schedule) || schedule <= 0))
      throw new FinancialControlError(
        400,
        "CONTRACT_SCHEDULE_LINK_INVALID",
        "Schedule links must identify a canonical project schedule item.",
      );
    const amount = signed
      ? exactDelta(r.amount ?? r.amountDelta)
      : exactPositiveAmount(r.amount);
    const item =
      r.contractItem &&
      typeof r.contractItem === "object" &&
      !Array.isArray(r.contractItem)
        ? (r.contractItem as Record<string, unknown>)
        : null;
    const quantity = item
      ? exactPositiveAmount(item.quantity, "contractItem.quantity")
      : "1";
    const unitRate = item
      ? exactPositiveAmount(item.unitRate, "contractItem.unitRate")
      : amount;
    if (item && scaledDecimal(quantity) <= 0n)
      throw new FinancialControlError(
        400,
        "CONTRACT_ITEM_QUANTITY_INVALID",
        "Contract Item quantity must be greater than zero.",
      );
    if (item && scaledDecimal(unitRate) <= 0n)
      throw new FinancialControlError(
        400,
        "CONTRACT_ITEM_RATE_INVALID",
        "Contract Item APU unit rate must be greater than zero.",
      );
    const contractValue = signed ? amount : exactProduct(quantity, unitRate);
    if (!signed && scaledDecimal(contractValue) !== scaledDecimal(amount))
      throw new FinancialControlError(
        400,
        "CONTRACT_ITEM_VALUE_MISMATCH",
        "Contract Item value must equal Quantity multiplied by Unit Rate.",
      );
    const apuPlanVersion =
      item?.apuPlanVersion == null || item.apuPlanVersion === ""
        ? null
        : Number(item.apuPlanVersion);
    if (
      apuPlanVersion != null &&
      (!Number.isSafeInteger(apuPlanVersion) || apuPlanVersion <= 0)
    )
      throw new FinancialControlError(
        400,
        "CONTRACT_ITEM_APU_INVALID",
        "Contract Item APU version must be a positive saved version.",
      );
    return {
      stableLineId,
      budgetSnapshotLineId: boundedText(
        r.budgetSnapshotLineId,
        "budgetSnapshotLineId",
        3,
        100,
      ),
      projectCostNodeId: boundedText(
        r.projectCostNodeId,
        "projectCostNodeId",
        3,
        100,
      ),
      scheduleItemPlacementId: schedule,
      description: boundedText(r.description, "description", 1, 500),
      amount,
      contractItem: {
        displayName: item
          ? boundedText(
              item.displayName ?? r.description,
              "contractItem.displayName",
              1,
              300,
            )
          : boundedText(r.description, "description", 1, 300),
        quantity,
        unit: item ? boundedText(item.unit, "contractItem.unit", 1, 40) : "LS",
        unitRate,
        contractValue,
        apuPlanVersion,
        apuFingerprint: null,
        apuContent: null,
        apuEvaluation: null,
        workflowTemplate: item
          ? boundedText(
              item.workflowTemplate ?? "generic",
              "contractItem.workflowTemplate",
              1,
              100,
            )
          : "legacy",
        industryTemplate: item
          ? boundedText(
              item.industryTemplate ?? "generic",
              "contractItem.industryTemplate",
              1,
              100,
            )
          : "legacy",
        sourceProvenance: normalizeSourceProvenance(item?.sourceProvenance),
        status: "draft",
      },
      sortOrder: Number.isSafeInteger(Number(r.sortOrder))
        ? Number(r.sortOrder)
        : index,
    };
  });
}

export function contractLineTotal(
  lines: ReadonlyArray<Pick<ContractLineInput, "amount">>,
): string {
  return decimalFromScaled(
    lines.reduce((sum, line) => sum + scaledSignedDecimal(line.amount), 0n),
  );
}

export function assertReconciledTotal(
  lines: ContractLineInput[],
  expected: string,
  field: string,
) {
  const total = contractLineTotal(lines);
  if (scaledSignedDecimal(total) !== scaledSignedDecimal(expected))
    throw new FinancialControlError(
      400,
      "CONTRACT_SOV_NOT_RECONCILED",
      `SOV lines must reconcile exactly to ${field}.`,
    );
  return total;
}

export function exactVariance(committed: string, budget: string) {
  return decimalFromScaled(
    scaledSignedDecimal(committed) - scaledSignedDecimal(budget),
  );
}

export function absoluteExact(value: string) {
  const n = scaledSignedDecimal(value);
  return decimalFromScaled(n < 0n ? -n : n);
}

export function greaterThanZero(value: string) {
  return scaledSignedDecimal(value) > 0n;
}

export function higherLimitIsStrict(primary: string, higher: string) {
  return scaledDecimal(higher) > scaledDecimal(primary);
}

export function contractFingerprint(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function safeCommercialMetadata(value: unknown) {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FinancialControlError(
      400,
      "CONTRACT_METADATA_INVALID",
      "Commercial metadata must be an object.",
    );
  const input = value as Record<string, unknown>;
  const output: Record<string, string | null> = {};
  for (const key of ["retainage", "tax", "bond", "insurance"]) {
    const raw = input[key];
    output[key] =
      raw == null || raw === "" ? null : boundedText(raw, key, 1, 500);
  }
  return output;
}
