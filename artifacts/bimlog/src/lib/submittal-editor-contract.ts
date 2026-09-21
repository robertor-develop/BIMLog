export type SubmittalEditorSource = {
  title?: string | null;
  status?: string | null;
  specSection?: string | null;
  submittalCategory?: string | null;
  submittalType?: string | null;
  trade?: string | null;
  floor?: string | null;
  responsibleCompany?: string | null;
  submittedByCompany?: string | null;
  submittedByPerson?: string | null;
  submittedByEmail?: string | null;
  submittedByPhone?: string | null;
  submittedToCompany?: string | null;
  submittedToPerson?: string | null;
  submittedToEmail?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  procurementStatus?: string | null;
  ballInCourt?: string | null;
  drawingNumber?: string | null;
  drawingTitle?: string | null;
  dateSubmitted?: string | null;
  dateRequired?: string | null;
  linkedRfiId?: number | null;
  description?: string | null;
  attachmentsJson?: string[] | null;
};

export type SubmittalEditorForm = ReturnType<typeof submittalToEditorForm>;

export function submittalToEditorForm(submittal: SubmittalEditorSource) {
  return {
    title: submittal.title || "",
    status: submittal.status || "pending",
    specSection: submittal.specSection || "",
    submittalCategory: submittal.submittalCategory || submittal.submittalType || "shop_drawing",
    submittalType: submittal.submittalType || "shop_drawing",
    trade: submittal.trade || "",
    floor: submittal.floor || "",
    responsibleCompany: submittal.responsibleCompany || "",
    submittedByCompany: submittal.submittedByCompany || "",
    submittedByPerson: submittal.submittedByPerson || "",
    submittedByEmail: submittal.submittedByEmail || "",
    submittedByPhone: submittal.submittedByPhone || "",
    submittedToCompany: submittal.submittedToCompany || "",
    submittedToPerson: submittal.submittedToPerson || "",
    submittedToEmail: submittal.submittedToEmail || "",
    manufacturer: submittal.manufacturer || "",
    modelNumber: submittal.modelNumber || "",
    procurementStatus: submittal.procurementStatus || "not_ordered",
    ballInCourt: submittal.ballInCourt || "",
    drawingNumber: submittal.drawingNumber || "",
    drawingTitle: submittal.drawingTitle || "",
    dateSubmitted: submittal.dateSubmitted ? submittal.dateSubmitted.slice(0, 10) : "",
    dateRequired: submittal.dateRequired ? submittal.dateRequired.slice(0, 10) : "",
    linkedRfiId: submittal.linkedRfiId ? String(submittal.linkedRfiId) : "",
    description: submittal.description || "",
    attachmentsText: (submittal.attachmentsJson || []).join("\n"),
  };
}

function nullable(value: string) {
  return value || null;
}

export function attachmentValues(value: string) {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

export function buildSubmittalUpdateRequest(form: SubmittalEditorForm, expectedUpdatedAt: string) {
  return {
    expectedUpdatedAt,
    title: form.title.trim(),
    status: form.status,
    specSection: nullable(form.specSection),
    submittalCategory: nullable(form.submittalCategory),
    submittalType: form.submittalType || form.submittalCategory || "shop_drawing",
    trade: nullable(form.trade),
    floor: nullable(form.floor),
    responsibleCompany: nullable(form.responsibleCompany),
    submittedByCompany: nullable(form.submittedByCompany),
    submittedByPerson: nullable(form.submittedByPerson),
    submittedByEmail: nullable(form.submittedByEmail),
    submittedByPhone: nullable(form.submittedByPhone),
    submittedToCompany: nullable(form.submittedToCompany),
    submittedToPerson: nullable(form.submittedToPerson),
    submittedToEmail: nullable(form.submittedToEmail),
    manufacturer: nullable(form.manufacturer),
    modelNumber: nullable(form.modelNumber),
    procurementStatus: nullable(form.procurementStatus),
    ballInCourt: nullable(form.ballInCourt),
    drawingNumber: nullable(form.drawingNumber),
    drawingTitle: nullable(form.drawingTitle),
    dateSubmitted: nullable(form.dateSubmitted),
    dateRequired: nullable(form.dateRequired),
    linkedRfiId: form.linkedRfiId ? Number.parseInt(form.linkedRfiId, 10) : null,
    description: nullable(form.description),
    attachmentsJson: attachmentValues(form.attachmentsText),
  };
}

export function buildSubmittalReviewRequest(input: {
  reviewDecision: string;
  complianceNotes: string;
  rejectionReason: string;
  expectedUpdatedAt: string;
}) {
  return { ...input };
}

export function mergeAttachment(existing: string[] | null | undefined, attachment: string): string[] {
  return Array.from(new Set([...(existing || []), attachment]));
}

export function readSubmittalMutationError(payload: unknown, fallback: string, lang: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const localized = error as Record<string, unknown>;
    const preferred = lang === "es" ? localized.es : localized.en;
    if (typeof preferred === "string" && preferred.trim()) return preferred;
    const alternate = lang === "es" ? localized.en : localized.es;
    if (typeof alternate === "string" && alternate.trim()) return alternate;
  }
  return fallback;
}
