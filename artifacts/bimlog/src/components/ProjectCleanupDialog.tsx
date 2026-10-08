import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { classifyCleanupRow, reconcileCleanupSelection, retirementReviewQueue, selectableCleanupRows, summarizeCleanupSelection, testingCleanupCandidateIds, toggleCleanupSelection, toWorkspaceStateBatchItems, type ProjectCleanupRow } from "@/lib/project-cleanup-selection";

type Props = {
  rows: ProjectCleanupRow[];
  lang: string;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onChanged: () => void;
  onReviewRetirement: (projectId: number) => void;
  onReviewRetirementQueue?: (projectIds: number[]) => void;
  preferredTestProjectId?: number | null;
};

export function ProjectCleanupDialog({ rows, lang, request, onClose, onChanged, onReviewRetirement, onReviewRetirementQueue, preferredTestProjectId = null }: Props) {
  const tt = (en: string, es: string) => lang === "es" ? es : en;
  const selectable = useMemo(() => selectableCleanupRows(rows), [rows]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const summary = useMemo(() => summarizeCleanupSelection(rows, selected), [rows, selected]);
  const testingCandidates = useMemo(() => testingCleanupCandidateIds(rows, preferredTestProjectId), [rows, preferredTestProjectId]);
  const selectedReviewQueue = useMemo(() => retirementReviewQueue(rows, selected, preferredTestProjectId), [rows, selected, preferredTestProjectId]);

  useEffect(() => setSelected(current => reconcileCleanupSelection(current, rows)), [rows]);

  async function applyState(state: "active" | "testing") {
    if (selected.size === 0 || saving) return;
    setSaving(true); setError("");
    try {
      const response = await request("/projects/workspace-state/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, items: toWorkspaceStateBatchItems(rows, selected) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || tt("The selected projects could not be changed.", "No se pudieron cambiar los proyectos seleccionados."));
      setSelected(new Set());
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tt("The selected projects could not be changed.", "No se pudieron cambiar los proyectos seleccionados."));
    } finally { setSaving(false); }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="project-cleanup-title" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.48)", display: "grid", placeItems: "center", padding: 16 }}>
    <div style={{ width: "min(760px, 100%)", maxHeight: "min(780px, calc(100vh - 32px))", overflow: "auto", background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 14, boxShadow: "0 24px 70px rgba(15,23,42,.25)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 2, padding: "18px 20px", background: "hsl(var(--background))", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div><h2 id="project-cleanup-title" style={{ margin: 0, fontSize: 19 }}>{tt("Clean up project workspaces", "Organizar espacios de proyectos")}</h2><p style={{ margin: "5px 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{tt("Classify projects without deleting project records or shared company libraries.", "Clasifica proyectos sin eliminar registros del proyecto ni bibliotecas compartidas de la empresa.")}</p></div>
        <button type="button" aria-label={tt("Close", "Cerrar")} onClick={onClose} style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer" }}><X /></button>
      </div>
      <div style={{ padding: 20 }}>
        <div aria-live="polite" style={{ padding: 12, borderRadius: 9, background: "#EFF6FF", color: "#1E3A8A", fontSize: 12, marginBottom: 14 }}>
          <strong>{summary.selectedCount} {tt("selected", "seleccionados")}</strong> · {summary.activeCount} {tt("active", "activos")} · {summary.testingCount} {tt("testing", "pruebas")} · {summary.memberCount} {tt("members", "miembros")} · {summary.fileCount} {tt("files", "archivos")}
        </div>
        {error && <div role="alert" style={{ padding: 12, borderRadius: 9, background: "#FEF2F2", color: "#B91C1C", fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {selectable.map(project => { const classification = classifyCleanupRow(project, preferredTestProjectId); return <label key={project.id} style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) auto", alignItems: "center", gap: 10, minHeight: 58, padding: "8px 10px", border: selected.has(project.id) ? "2px solid #2563EB" : "1px solid #CBD5E1", borderRadius: 9, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(project.id)} onChange={() => setSelected(current => toggleCleanupSelection(current, project.id))} style={{ width: 20, height: 20, justifySelf: "center" }} />
            <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13 }}>{project.name}</strong><span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{project.code} · {project.workspaceGroup === "testing" ? tt("Testing", "Pruebas") : project.workspaceGroup === "retired" ? tt("Retired", "Retirado") : tt("Active", "Activo")}</span><span style={{ display: "block", marginTop: 3, fontSize: 10, fontWeight: 800, color: classification === "protected-working" ? "#166534" : classification === "preferred-testing" ? "#1D4ED8" : "#92400E" }}>{classification === "protected-working" ? tt("Protected working project", "Proyecto de trabajo protegido") : classification === "preferred-testing" ? tt("Preferred reusable QA workspace", "Espacio de pruebas reutilizable preferido") : classification === "testing-review" ? tt("Testing workspace ready for review", "Espacio de pruebas listo para revisión") : tt("Review only if work has ended", "Revisar solo si el trabajo terminó")}</span></span>
            {classification !== "retired" && classification !== "protected-working" && classification !== "preferred-testing" && <Button type="button" variant="outline" disabled={saving} onClick={event => { event.preventDefault(); onReviewRetirement(project.id); }}>{tt("Review retirement", "Revisar retiro")}</Button>}
          </label>})}
        </div>
        {selectable.length === 0 && <p style={{ fontSize: 13 }}>{tt("No manageable projects are visible in this view.", "No hay proyectos administrables visibles en esta vista.")}</p>}
        <div style={{ position: "sticky", bottom: 0, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", paddingTop: 16, marginTop: 8, background: "hsl(var(--background))" }}>
          <Button type="button" variant="outline" onClick={() => setSelected(new Set(selectable.map(project => project.id)))} disabled={saving || selectable.length === 0}>{tt("Select visible", "Seleccionar visibles")}</Button>
          <Button type="button" variant="outline" onClick={() => setSelected(new Set(testingCandidates))} disabled={saving || testingCandidates.length === 0}>{tt("Select testing candidates", "Seleccionar candidatos de prueba")}</Button>
          <Button type="button" variant="outline" onClick={() => setSelected(new Set())} disabled={saving || selected.size === 0}>{tt("Clear", "Limpiar")}</Button>
          <Button type="button" variant="outline" onClick={() => onReviewRetirementQueue ? onReviewRetirementQueue(selectedReviewQueue) : onReviewRetirement(selectedReviewQueue[0])} disabled={saving || selectedReviewQueue.length === 0}>{tt(`Review ${selectedReviewQueue.length} for retirement`, `Revisar ${selectedReviewQueue.length} para retiro`)}</Button>
          <Button type="button" variant="outline" onClick={() => void applyState("testing")} disabled={saving || selected.size === 0}>{tt("Move to Testing", "Mover a Pruebas")}</Button>
          <Button type="button" onClick={() => void applyState("active")} disabled={saving || selected.size === 0}>{tt("Keep active", "Mantener activos")}</Button>
        </div>
      </div>
    </div>
  </div>;
}
