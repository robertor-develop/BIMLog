export type JobIntakeLifecycle = "draft" | "ready" | "activating" | "active" | "changes_pending";

export function jobIntakeLifecycle(status: string, ready: boolean, saveState: string, activating: boolean): JobIntakeLifecycle {
  if (status === "activated") return saveState === "saved" ? "active" : "changes_pending";
  if (activating) return "activating";
  return ready && saveState === "saved" ? "ready" : "draft";
}

export function jobIntakeLifecycleCopy(state: JobIntakeLifecycle, language: string) {
  const es = language === "es";
  const copy = {
    draft: es ? ["Borrador", "Complete y guarde la configuración requerida antes de activar."] : ["Draft", "Complete and save the required setup before activation."],
    ready: es ? ["Listo para activar", "La configuración requerida está guardada. Revise y active una vez."] : ["Ready to activate", "Required setup is saved. Review it and activate once."],
    activating: es ? ["Activando", "BIMLog está creando la estructura operativa una sola vez."] : ["Activating", "BIMLog is creating the operational structure once."],
    active: es ? ["Trabajo activo", "La activación terminó. Continúe el trabajo en Operaciones del Trabajo."] : ["Active job", "Activation is complete. Continue delivery in Job Operations."],
    changes_pending: es ? ["Trabajo activo · cambios pendientes", "La estructura activa permanece intacta mientras revisa o vuelve a guardar los cambios permitidos."] : ["Active job · changes pending", "The active structure remains intact while allowed changes are reviewed or saved again."],
  } as const;
  return { label: copy[state][0], guidance: copy[state][1] };
}
