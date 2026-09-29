export type FileIntakeMode = "record_only" | "retained_evidence" | "connected_delivery";

export type FileIntakeDraft = {
  file: File;
  mode: FileIntakeMode;
  relationship: string;
  destinationLabel: string | null;
  conventionReady: boolean;
  attemptKey: string;
};

export function fileIntakeModeTruth(mode: FileIntakeMode, spanish = false) {
  const copy = {
    record_only: ["Record name and metadata only; file bytes are not retained or delivered.", "Registra solo nombre y metadatos; el archivo no se conserva ni se entrega."],
    retained_evidence: ["Retain the file as project evidence. This does not deliver it to another system.", "Conserva el archivo como evidencia del proyecto. Esto no lo entrega a otro sistema."],
    connected_delivery: ["Retain the file and send it to the selected connected destination after confirmation.", "Conserva el archivo y lo envía al destino conectado seleccionado después de confirmar."],
  } as const;
  return copy[mode][spanish ? 1 : 0];
}

export function fileIntakeRequiresDestination(mode: FileIntakeMode) {
  return mode === "connected_delivery";
}

export function fileIntakeRequiresConvention(mode: FileIntakeMode) {
  return mode !== "record_only";
}

export function conventionResolverUrl(projectId: number) {
  const returnTo = `/projects/${projectId}/files?resume=file-intake`;
  return `/projects/${projectId}/generator?returnTo=${encodeURIComponent(returnTo)}`;
}

export function fileIntakePreview(input: { fileName: string; mode: FileIntakeMode; destinationLabel?: string | null; aiRequested?: boolean }) {
  return {
    fileName: input.fileName,
    retainsBytes: input.mode !== "record_only",
    destination: input.mode === "connected_delivery" ? input.destinationLabel ?? null : null,
    delivers: input.mode === "connected_delivery" && !!input.destinationLabel,
    ai: input.aiRequested ? { requested: true, estimate: "Shown before separate confirmation" } : { requested: false, estimate: "No AI cost" },
  } as const;
}

export function fileIntakeCanSubmit(mode: FileIntakeMode, destinationLabel?: string | null) {
  if (mode === "record_only") return true;
  if (mode === "connected_delivery") return !!destinationLabel && false;
  return false;
}

export function documentIdentity(input: { id: number; rootFileId?: number | null; parentFileId?: number | null; version: number; source?: string | null }) {
  const familyId = input.rootFileId ?? input.parentFileId ?? input.id;
  return {
    recordKey: `file:${input.id}`,
    familyKey: `file-family:${familyId}`,
    label: `Record #${input.id} · Family #${familyId} · V${input.version}`,
    source: input.source?.trim() || "project upload",
  };
}

export function newFileAttemptKey() {
  return crypto.randomUUID();
}
