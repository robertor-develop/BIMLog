import { useEffect, useState } from "react";
import { parseFolderWizardDraft, type FolderWizardDraft } from "./folder-wizard-draft";

type ImportRecord = { id: string; version: number; sha256: string;
  document: { destination: { sharepoint_url: string; base_path: string }; blueprints: { name: string; include: boolean }[] };
  preview: { paths: string[]; totalLeafPaths: string; truncated: boolean } };

export function FolderWizardImportPanel({ projectId, token, lang }: { projectId: number; token: string | null; lang: string }) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const [current, setCurrent] = useState<ImportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState("");
  const [draft, setDraft] = useState<FolderWizardDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard`;

  async function reload(signal?: AbortSignal) {
    if (!token) return;
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!response.ok) throw new Error(`load ${response.status}`);
    const data = await response.json() as { current: ImportRecord | null };
    setCurrent(data.current);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void reload(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error && cause.message.includes("403")
        ? tr("Project access is required to view routing.", "Se requiere acceso al proyecto para ver las rutas.")
        : tr("Could not load folder routing. Retry.", "No se pudo cargar la configuración de carpetas. Reintente."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, token, lang]);

  async function choose(file: File | undefined) {
    setDraft(null); setSourceText(""); setFileName(""); setError("");
    if (!file) return;
    if (file.size > 1_048_576 || !file.name.toLowerCase().endsWith(".json")) {
      setError(tr("Choose a Wizard JSON export up to 1 MB.", "Seleccione un archivo JSON del Wizard de hasta 1 MB."));
      return;
    }
    try {
      const text = await file.text();
      setDraft(parseFolderWizardDraft(text)); setSourceText(text); setFileName(file.name);
    } catch {
      setError(tr("This is not a BT Folder Wizard 3.1 BIMLog export.", "Este archivo no es una exportación BIMLog de BT Folder Wizard 3.1."));
    }
  }

  async function save() {
    if (!token || !sourceText) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, expectedCurrentSha256: current?.sha256 ?? null }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 409) throw new Error("stale");
        if (response.status === 403) throw new Error("forbidden");
        throw new Error(payload.error ?? "invalid");
      }
      await reload();
      setDraft(null); setSourceText(""); setFileName("");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "invalid";
      setError(reason === "stale" ? tr("Another import was saved. Reload before trying again.", "Se guardó otra importación. Recargue antes de intentar nuevamente.")
        : reason === "forbidden" ? tr("Only a project administrator may import routing.", "Solo un administrador del proyecto puede importar rutas.")
        : tr("Import failed. Check the Wizard export and try again.", "Falló la importación. Revise el archivo del Wizard e intente nuevamente."));
    } finally { setSaving(false); }
  }

  return <section aria-label={tr("BT Folder Wizard routing", "Rutas de BT Folder Wizard")} style={{ border: "1px solid hsl(var(--border))", borderRadius: 11, padding: 17, marginBottom: 18, background: "hsl(var(--card))" }}>
    <h2 style={{ margin: 0, fontSize: 17 }}>{tr("BT Folder Wizard routing", "Rutas de BT Folder Wizard")}</h2>
    <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{tr("Import the JSON export to configure project folder rules. This does not publish files to SharePoint yet.", "Importe el JSON para configurar las reglas de carpetas del proyecto. Esto todavía no publica archivos en SharePoint.")}</p>
    {loading ? <p role="status">{tr("Loading routing…", "Cargando rutas…")}</p> : error && !current && !draft ? <p role="alert">{error}</p> : <>
      {current ? <div style={{ fontSize: 12 }}>
        <strong>{tr("Saved version", "Versión guardada")}: {current.version}</strong>
        <p>{tr("SharePoint site", "Sitio SharePoint")}: {current.document.destination.sharepoint_url || tr("Not configured", "Sin configurar")}</p>
        <p>{tr("Base path", "Ruta base")}: {current.document.destination.base_path || tr("Library root", "Raíz de la biblioteca")}</p>
        <p>{tr("Included blueprints", "Esquemas incluidos")}: {current.document.blueprints.filter((item) => item.include).map((item) => item.name).join(", ")}</p>
        <details><summary>{tr("Folder preview", "Vista previa de carpetas")} ({current.preview.totalLeafPaths})</summary>
          <ul>{current.preview.paths.map((path, index) => <li key={`${path}-${index}`} style={{ overflowWrap: "anywhere" }}>{path}</li>)}</ul>
          {current.preview.truncated && <p>{tr("Preview limited to 100 paths.", "Vista previa limitada a 100 rutas.")}</p>}
        </details>
      </div> : <p style={{ fontSize: 12 }}>{tr("No routing export has been imported for this project.", "No se ha importado una configuración de rutas para este proyecto.")}</p>}
      <label style={{ display: "block", marginTop: 12, fontSize: 12 }}>
        {tr("Choose a Wizard JSON export", "Seleccione un JSON exportado por el Wizard")}
        <input type="file" accept=".json,application/json" onChange={(event) => void choose(event.target.files?.[0])} style={{ display: "block", marginTop: 5, maxWidth: "100%" }} />
      </label>
      {draft && <div style={{ fontSize: 12, marginTop: 8 }}>
        <p>{fileName} · {draft.blueprints.filter((item) => item.include).map((item) => item.name).join(", ")}</p>
        <p>{tr("Destination", "Destino")}: {draft.destination.sharepoint_url || tr("Not configured; publishing will remain unavailable", "Sin configurar; la publicación seguirá no disponible")}</p>
        <button type="button" disabled={saving} onClick={() => void save()}>{saving ? tr("Saving…", "Guardando…") : tr("Import as new version", "Importar como nueva versión")}</button>
        <button type="button" disabled={saving} onClick={() => { setDraft(null); setSourceText(""); setFileName(""); }} style={{ marginLeft: 8 }}>{tr("Cancel", "Cancelar")}</button>
      </div>}
      {error && <p role="alert" style={{ color: "#991B1B" }}>{error}</p>}
    </>}
  </section>;
}
