export type ConventionSetupStatus = "not_started" | "in_progress" | "completed";

export interface ConventionDocumentState {
  companies: Array<{ code: string }>;
  separator: "-" | "_";
  enforceUppercase: boolean;
  applyCharLimits: boolean;
  levelList: Array<{ code: string }>;
  disciplines: Array<{ code: string; selected: boolean }>;
  docTypes: Array<{ code: string; selected: boolean }>;
  statusCodes: Array<{ code: string; selected: boolean }>;
  seqDigits: 3 | 4 | 5;
  revisionFormat: "alpha" | "numerical" | "custom";
  customRevisions: string[];
  userGuidance: string;
}

export interface ConventionDocumentField {
  label: "Project Code" | "Originator" | "Discipline" | "Level" | "Type" | "Sequence" | "Status" | "Revision";
  fieldOrder: number;
  allowedValues: string[];
}

export interface SavedConventionDocument {
  setupStatus?: unknown;
  separator?: unknown;
  enforceUppercase?: unknown;
  applyCharLimits?: unknown;
  fields?: unknown;
}

export interface SavedConventionFoundation {
  separator: "-" | "_";
  enforceUppercase?: boolean;
  applyCharLimits?: boolean;
  companyCodes: string[];
  levelCodes: string[] | null;
}

export interface ConventionDocumentValidation {
  valid: boolean;
  errors: Array<
    | "company_required"
    | "company_code_required"
    | "company_code_duplicate"
    | "discipline_required"
    | "level_required"
    | "document_type_required"
    | "status_required"
    | "revision_required"
  >;
}

function normalizedCodes(values: Array<{ code: string }>): string[] {
  return values.map(({ code }) => code.trim().toUpperCase()).filter(Boolean);
}

export function buildRevisionCodes(
  format: ConventionDocumentState["revisionFormat"],
  custom: string[],
): string[] {
  if (format === "alpha") return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
  if (format === "numerical") return ["P01", "P02", "P03", "P04", "C01", "C02", "C03", "C04", "S0", "S1", "S2"];
  return custom.map(value => value.trim().toUpperCase()).filter(Boolean);
}

export function validateConventionDocumentState(state: ConventionDocumentState): ConventionDocumentValidation {
  const errors: ConventionDocumentValidation["errors"] = [];
  const companyCodes = normalizedCodes(state.companies);
  if (state.companies.length === 0) errors.push("company_required");
  if (companyCodes.length !== state.companies.length) errors.push("company_code_required");
  if (new Set(companyCodes).size !== companyCodes.length) errors.push("company_code_duplicate");
  if (!state.disciplines.some(item => item.selected && item.code.trim())) errors.push("discipline_required");
  if (!state.levelList.some(item => item.code.trim())) errors.push("level_required");
  if (!state.docTypes.some(item => item.selected && item.code.trim())) errors.push("document_type_required");
  if (!state.statusCodes.some(item => item.selected && item.code.trim())) errors.push("status_required");
  if (buildRevisionCodes(state.revisionFormat, state.customRevisions).length === 0) errors.push("revision_required");
  return { valid: errors.length === 0, errors };
}

export function buildConventionDocumentFields(state: ConventionDocumentState): ConventionDocumentField[] {
  const companyCodes = normalizedCodes(state.companies);
  const sequenceValues = Array.from(
    { length: Math.min(10, Math.pow(10, state.seqDigits) - 1) },
    (_, index) => String(index + 1).padStart(state.seqDigits, "0"),
  );
  return [
    { label: "Project Code", fieldOrder: 0, allowedValues: companyCodes },
    { label: "Originator", fieldOrder: 1, allowedValues: companyCodes },
    { label: "Discipline", fieldOrder: 2, allowedValues: normalizedCodes(state.disciplines.filter(item => item.selected)) },
    { label: "Level", fieldOrder: 3, allowedValues: normalizedCodes(state.levelList) },
    { label: "Type", fieldOrder: 4, allowedValues: normalizedCodes(state.docTypes.filter(item => item.selected)) },
    { label: "Sequence", fieldOrder: 5, allowedValues: sequenceValues },
    { label: "Status", fieldOrder: 6, allowedValues: normalizedCodes(state.statusCodes.filter(item => item.selected)) },
    { label: "Revision", fieldOrder: 7, allowedValues: buildRevisionCodes(state.revisionFormat, state.customRevisions) },
  ];
}

export function buildConventionDocumentPayload(state: ConventionDocumentState) {
  return {
    separator: state.separator,
    isActive: true,
    enforceUppercase: state.enforceUppercase,
    applyCharLimits: state.applyCharLimits,
    fields: buildConventionDocumentFields(state),
    markCompleted: true,
    ...(state.userGuidance ? { userGuidance: state.userGuidance } : {}),
  };
}

export function resolveConventionSetupStatus(convention: SavedConventionDocument | null | undefined): ConventionSetupStatus {
  return convention?.setupStatus === "completed"
    ? "completed"
    : convention?.setupStatus === "in_progress"
      ? "in_progress"
      : "not_started";
}

export function readSavedConventionFoundation(convention: SavedConventionDocument | null | undefined): SavedConventionFoundation {
  const fields = Array.isArray(convention?.fields) ? convention.fields as Array<{ label?: unknown; allowedValues?: unknown }> : [];
  const projectCode = fields.find(field => field.label === "Project Code");
  const level = fields.find(field => field.label === "Level");
  return {
    separator: convention?.separator === "_" ? "_" : "-",
    enforceUppercase: typeof convention?.enforceUppercase === "boolean" ? convention.enforceUppercase : undefined,
    applyCharLimits: typeof convention?.applyCharLimits === "boolean" ? convention.applyCharLimits : undefined,
    companyCodes: Array.isArray(projectCode?.allowedValues)
      ? projectCode.allowedValues.filter((value): value is string => typeof value === "string")
      : [],
    levelCodes: level
      ? Array.isArray(level.allowedValues)
        ? level.allowedValues.filter((value): value is string => typeof value === "string")
        : []
      : null,
  };
}

export function savedConventionLevelsNeedRepair(
  setupStatus: ConventionSetupStatus,
  foundation: SavedConventionFoundation,
): boolean {
  return setupStatus === "completed" && foundation.levelCodes !== null && foundation.levelCodes.length === 0;
}
