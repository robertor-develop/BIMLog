import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectRetirementRequest } from "@/lib/project-retirement";

export function ProjectRestoreDialog({ project, lang, request, onClose, onRestored }: {
  project: { id: number; name: string; code: string; updatedAt: string }; lang: "en" | "es";
  request: ProjectRetirementRequest; onClose: () => void; onRestored: () => void;
}) {
  const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const t = (en: string, es: string) => lang === "es" ? es : en;
  async function restore() { setBusy(true); setError(""); try {
    const response = await request(`/projects/${project.id}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, expectedUpdatedAt: project.updatedAt }) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || t("Project restoration failed.", "Falló la restauración del proyecto."));
    onRestored();
  } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); } }
  return <div role="dialog" aria-modal="true" aria-labelledby="restore-project-title" style={{ position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center", padding: 16, background: "rgba(15,23,42,.55)" }}><section style={{ width: "min(520px,100%)", borderRadius: 14, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 24px 70px rgba(15,23,42,.25)" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "18px 20px", borderBottom: "1px solid hsl(var(--border))" }}><div><div style={{ color: "#1D4ED8", fontSize: 11, fontWeight: 800 }}>{t("RESTORE PROJECT", "RESTAURAR PROYECTO")}</div><h2 id="restore-project-title" style={{ margin: "4px 0 0", fontSize: 19 }}>{project.name}</h2></div><button onClick={onClose} aria-label={t("Close", "Cerrar")} style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={20}/></button></header>
    <div style={{ padding: 20 }}><div style={{ display: "flex", gap: 10, padding: 13, borderRadius: 9, background: "#EFF6FF", marginBottom: 16 }}><RotateCcw size={19} color="#1D4ED8"/><span style={{ fontSize: 12 }}>{t("Every preserved record remains attached. Restoring returns this project to the active workspace.", "Cada registro preservado permanece vinculado. Restaurar devuelve este proyecto al espacio de trabajo activo.")}</span></div><label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>{t(`Type ${project.code} to confirm`, `Escriba ${project.code} para confirmar`)}<Input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)}/></label>{error && <div role="alert" style={{ color: "#B91C1C", marginTop: 10, fontSize: 12 }}>{error}</div>}</div>
    <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}><Button variant="outline" onClick={onClose}>{t("Cancel", "Cancelar")}</Button><Button disabled={busy || confirmation !== project.code} onClick={() => void restore()}>{busy ? t("Restoring…", "Restaurando…") : t("Restore project", "Restaurar proyecto")}</Button></footer>
  </section></div>;
}
