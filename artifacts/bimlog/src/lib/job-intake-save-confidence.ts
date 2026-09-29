export type JobIntakeSaveState = "saved" | "unsaved" | "saving" | "error";

export function jobIntakeSaveConfidence(state: JobIntakeSaveState) {
  return {
    canRetry: state === "error",
    safelyStoredOnServer: state === "saved",
    retainsEnteredValues: state !== "saved",
    en: state === "saving" ? "Saving..." : state === "unsaved" ? "Changes pending" : state === "error" ? "Save failed · your entered values are retained" : "All changes saved",
    es: state === "saving" ? "Guardando..." : state === "unsaved" ? "Cambios pendientes" : state === "error" ? "Falló el guardado · se conservaron los valores ingresados" : "Todos los cambios guardados",
  };
}
