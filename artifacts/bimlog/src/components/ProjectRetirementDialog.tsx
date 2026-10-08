import { useEffect, useState } from "react";
import { AlertTriangle, Archive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectRetirementRequest } from "@/lib/project-retirement";

type Preview = {
  projectName: string; projectCode: string; expectedUpdatedAt: string;
  recordCounts: Record<string, number>; totalInventoriedRecords: number;
  ownership: { projectRecords: { includes: string[] }; companyLibraries: { includes: string[] }; platformAuthorities: { includes: string[] } };
};

export function ProjectRetirementDialog({ projectId, lang, request, onClose, onRetired }: {
  projectId: number; lang: "en" | "es"; request: ProjectRetirementRequest; onClose: () => void; onRetired: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const t = (en: string, es: string) => lang === "es" ? es : en;

  useEffect(() => {
    let active = true;
    request(`/projects/${projectId}/retirement-preview`).then(async response => {
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || t("Could not load retirement preview.", "No se pudo cargar la vista previa del retiro."));
      if (active) setPreview(await response.json());
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [projectId]);

  async function retire() {
    if (!preview || confirmation !== preview.projectCode) return;
    setBusy(true); setError("");
    try {
      const response = await request(`/projects/${projectId}/retire`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, expectedUpdatedAt: preview.expectedUpdatedAt }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || t("Project retirement failed.", "Falló el retiro del proyecto."));
      onRetired();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="retirement-title" style={{ position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center", padding: 16, background: "rgba(15,23,42,.55)" }}>
    <section style={{ width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto", borderRadius: 14, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 24px 70px rgba(15,23,42,.25)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
        <div><div style={{ color: "#B45309", fontSize: 11, fontWeight: 800 }}>{t("NON-DESTRUCTIVE RETIREMENT", "RETIRO NO DESTRUCTIVO")}</div><h2 id="retirement-title" style={{ margin: "4px 0 0", fontSize: 19 }}>{preview?.projectName || t("Review project retirement", "Revisar retiro del proyecto")}</h2></div>
        <button onClick={onClose} aria-label={t("Close", "Cerrar")} style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={20}/></button>
      </header>
      <div style={{ padding: 20 }}>
        {busy && !preview ? <p>{t("Loading complete project inventory…", "Cargando el inventario completo del proyecto…")}</p> : error && !preview ? <div role="alert" style={{ color: "#B91C1C" }}>{error}</div> : preview && <>
          <div style={{ display: "flex", gap: 10, padding: 14, borderRadius: 10, background: "#EFF6FF", color: "#1E3A5F", marginBottom: 16 }}><Archive size={20}/><div><strong>{t("No records will be deleted.", "No se eliminará ningún registro.")}</strong><div style={{ fontSize: 12, marginTop: 3 }}>{t(`${preview.totalInventoriedRecords} key records were found. The project moves out of the active workspace and remains available for governed restoration.`, `Se encontraron ${preview.totalInventoriedRecords} registros clave. El proyecto sale del espacio activo y permanece disponible para una restauración controlada.`)}</div></div></div>
          <h3 style={{ fontSize: 14 }}>{t("Project records preserved", "Registros del proyecto preservados")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 18 }}>{Object.entries(preview.recordCounts).map(([key, value]) => <div key={key} style={{ padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }}><strong style={{ display: "block", fontSize: 18 }}>{value}</strong><span style={{ fontSize: 11 }}>{key.replace(/([A-Z])/g, " $1")}</span></div>)}</div>
          <h3 style={{ fontSize: 14 }}>{t("Shared company information remains active", "La información compartida de la empresa permanece activa")}</h3>
          <p style={{ fontSize: 12, lineHeight: 1.6 }}>{preview.ownership.companyLibraries.includes.join(" · ")}</p>
          <div style={{ display: "flex", gap: 9, padding: 12, border: "1px solid #FDE68A", borderRadius: 8, background: "#FFFBEB", margin: "16px 0" }}><AlertTriangle size={18} color="#B45309"/><span style={{ fontSize: 12 }}>{t("The project will no longer appear in Active projects. Authorized administrators can restore it from Retired projects.", "El proyecto dejará de aparecer en Proyectos activos. Los administradores autorizados podrán restaurarlo desde Proyectos retirados.")}</span></div>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>{t(`Type ${preview.projectCode} to confirm`, `Escriba ${preview.projectCode} para confirmar`)}<Input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoFocus /></label>
          {error && <div role="alert" style={{ color: "#B91C1C", marginTop: 10, fontSize: 12 }}>{error}</div>}
        </>}
      </div>
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}><Button variant="outline" onClick={onClose}>{t("Cancel", "Cancelar")}</Button><Button variant="destructive" disabled={!preview || busy || confirmation !== preview.projectCode} onClick={() => void retire()}>{busy && preview ? t("Retiring…", "Retirando…") : t("Retire project", "Retirar proyecto")}</Button></footer>
    </section>
  </div>;
}
