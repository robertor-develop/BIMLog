export type JobIntakeMappingForm = {
  sheetName: string;
  headerRow: number;
  nameColumn: number;
  quantityColumn: number;
};

export type JobIntakeDocument = {
  id: string;
  fileName?: string;
  fileType?: string;
  extractionSummary?: { sheets?: Array<{ name: string; rowCount: number; columnCount: number; rows?: unknown[][] }> };
};

export function defaultJobIntakeMappingForm(document: JobIntakeDocument): JobIntakeMappingForm | null {
  const sheet = document.extractionSummary?.sheets?.[0];
  if (!sheet) return null;
  return {
    sheetName: sheet.name,
    headerRow: 1,
    nameColumn: 0,
    quantityColumn: Math.min(1, Math.max(0, sheet.columnCount - 1)),
  };
}

export function jobIntakeMappingSheet(document: JobIntakeDocument | null, form: JobIntakeMappingForm) {
  return document?.extractionSummary?.sheets?.find((sheet) => sheet.name === form.sheetName) ?? null;
}

export function prepareJobIntakeUpload(form: HTMLFormElement, expectedRevision: number) {
  const body = new FormData(form);
  body.set("expectedRevision", String(expectedRevision));
  return body;
}

export function buildJobIntakeMappingRequest(form: JobIntakeMappingForm) {
  return {
    sheetName: form.sheetName,
    headerRow: Number(form.headerRow),
    nameColumn: Number(form.nameColumn),
    quantityColumn: Number(form.quantityColumn),
  };
}

export type JobIntakeAssistanceDisclosure = {
  mode: "deterministic_spreadsheet" | "manual_evidence";
  readsFile: boolean;
  usesAi: false;
  estimatedCostMicros: 0;
};

export function jobIntakeDocumentAssistance(document: JobIntakeDocument): JobIntakeAssistanceDisclosure {
  return document.extractionSummary?.sheets?.length
    ? { mode: "deterministic_spreadsheet", readsFile: true, usesAi: false, estimatedCostMicros: 0 }
    : { mode: "manual_evidence", readsFile: false, usesAi: false, estimatedCostMicros: 0 };
}

export function assertVisibleAiCostGate(input: {
  operation: "text_assist" | "file_read";
  fundingSourceVisible: boolean;
  estimateVisible: boolean;
  confirmationGranted: boolean;
}) {
  if (!input.fundingSourceVisible || !input.estimateVisible || !input.confirmationGranted) {
    throw new Error("JOB_INTAKE_AI_COST_GATE_REQUIRED");
  }
  return input;
}
