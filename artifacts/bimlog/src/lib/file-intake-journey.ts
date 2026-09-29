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

export function newFileAttemptKey() {
  return crypto.randomUUID();
}
