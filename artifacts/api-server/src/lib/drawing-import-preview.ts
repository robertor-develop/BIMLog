export type ExtractedDrawingField = { value: string | null; confidence: number; source: "filename" | "pdf_text" | "manual" };
export type DrawingImportCandidate = {
  tenantId: number; projectId: number; fileId: number; fileSha256: string;
  sheetNumber: ExtractedDrawingField; title: ExtractedDrawingField; discipline: ExtractedDrawingField;
};

export function previewDrawingImport(candidate: DrawingImportCandidate) {
  if (![candidate.tenantId, candidate.projectId, candidate.fileId].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("DRAWING_IMPORT_SCOPE_INVALID");
  const fields = (["sheetNumber", "title", "discipline"] as const).map(name => {
    const field = candidate[name];
    if (!Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 1) throw new Error("DRAWING_IMPORT_CONFIDENCE_INVALID");
    return Object.freeze({ name, ...field, value: field.value?.trim() || null, requiresConfirmation: field.source !== "manual" || field.confidence < 1 });
  });
  return Object.freeze({ tenantId: candidate.tenantId, projectId: candidate.projectId, fileId: candidate.fileId, fileSha256: candidate.fileSha256,
    fields: Object.freeze(fields), committable: false, uncertaintyVisible: fields.some(field => field.requiresConfirmation || !field.value) });
}

export function confirmDrawingImport(preview: ReturnType<typeof previewDrawingImport>, confirmation: Record<"sheetNumber" | "title" | "discipline", string>) {
  const values = Object.fromEntries(Object.entries(confirmation).map(([key, value]) => [key, value.trim()]));
  if (!values.sheetNumber || !values.title || !values.discipline) throw new Error("DRAWING_IMPORT_CONFIRMATION_INCOMPLETE");
  return Object.freeze({ ...preview, confirmed: Object.freeze(values), committable: true, confirmedManually: true });
}
