export function intakeReadinessLabel(status: string, ready: boolean, saveState: string, language: string) {
  const es = language === "es";
  if (status === "activated") {
    if (saveState === "unsaved") return es ? "Trabajo activo · cambios pendientes" : "Active job · changes pending";
    if (saveState === "error") return es ? "Trabajo activo · revise el guardado" : "Active job · check save status";
    return es ? "Trabajo activo" : "Active job";
  }
  return ready ? (es ? "Borrador listo para activar" : "Draft ready to activate") : (es ? "Borrador · configuración incompleta" : "Draft · setup incomplete");
}
