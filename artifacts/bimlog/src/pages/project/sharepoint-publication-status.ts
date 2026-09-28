export function sharePointPublicationStatus(execution: unknown, lang: string): { tone: "success" | "warning" | "neutral"; message: string } {
  const es = lang === "es";
  if (execution === "completed") return { tone: "success", message: es ? "El archivo exacto se publicó en SharePoint." : "The exact file was published to SharePoint." };
  if (execution === "retry") return { tone: "warning", message: es ? "El reintento estará disponible tras la espera. Actualice la vista previa antes de confirmar de nuevo." : "Retry is available after the delay. Refresh the preview before confirming again." };
  if (execution === "dead_letter") return { tone: "warning", message: es ? "La publicación requiere revisión del administrador; no se publicó el archivo." : "Publication needs administrator review; the file was not published." };
  if (execution === "cancelled") return { tone: "neutral", message: es ? "La publicación fue cancelada y no se reinició." : "The publication was cancelled and was not restarted." };
  return { tone: "neutral", message: es ? "Revise el estado antes de intentar otra publicación." : "Review the current status before attempting another publication." };
}
