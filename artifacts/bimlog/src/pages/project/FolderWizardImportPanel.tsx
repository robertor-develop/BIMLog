import { useEffect, useState } from "react";
import { parseFolderWizardDraft, type FolderWizardDraft } from "./folder-wizard-draft";
import { FolderWizardRoutingPanel } from "./FolderWizardRoutingPanel";
import { FolderWizardPublishPanel } from "./FolderWizardPublishPanel";

type ImportRecord = { id: string; version: number; sha256: string;
  document: { destination: { sharepoint_url: string; base_path: string }; blueprints: { name: string; include: boolean; tiers: { label: string; items: string[] }[] }[] };
  preview: { paths: string[]; totalLeafPaths: string; truncated: boolean } };
type Readiness = { ready: boolean; blockers: string[]; providerError: string | null };
type PublishJob = { jobId: string; state: string; attempts: number; maxAttempts: number;
  errorCode: string | null; filename: string; sourceFileId: number; createdAt: string };
const publishStateLabels: Record<string, [string, string]> = {
  queued: ["Queued", "En cola"], leased: ["Publishing", "Publicando"], retry: ["Retry available after delay", "Reintento disponible tras la espera"],
  completed: ["Published", "Publicado"], dead_letter: ["Needs attention", "Requiere atención"],
  cancelled: ["Cancelled", "Cancelado"],
};

const readinessLabels: Record<string, [string, string]> = {
  IMPORT_MISSING: ["Wizard import missing", "Falta la importación del Wizard"],
  SITE_MISSING: ["SharePoint site missing in export", "Falta el sitio SharePoint en la exportación"],
  ROUTING_MISSING: ["Routing rules missing", "Faltan reglas de rutas"],
  ROUTING_STALE: ["Routing rules need a new version", "Las reglas requieren una nueva versión"],
  ROUTING_INVALID: ["Routing rules do not match the import", "Las reglas no corresponden a la importación"],
  PROJECT_MAPPING_MISSING: ["Project site and library are not configured", "El sitio y la biblioteca del proyecto no están configurados"],
  PROJECT_MAPPING_DISABLED: ["Project SharePoint mapping is disabled", "La conexión SharePoint del proyecto está desactivada"],
  CREDENTIAL_INACTIVE: ["SharePoint credential is not active", "La credencial SharePoint no está activa"],
  SITE_IDENTITY_UNVERIFIED: ["Site identity has not been verified", "No se ha verificado la identidad del sitio"],
  LIBRARY_IDENTITY_UNVERIFIED: ["Library identity has not been verified", "No se ha verificado la identidad de la biblioteca"],
};

export function FolderWizardImportPanel({ projectId, token, lang }: { projectId: number; token: string | null; lang: string }) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const [current, setCurrent] = useState<ImportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState("");
  const [draft, setDraft] = useState<FolderWizardDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessError, setReadinessError] = useState(false);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [jobsError, setJobsError] = useState(false);
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard`;

  async function reload(signal?: AbortSignal) {
    if (!token) return;
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!response.ok) throw new Error(`load ${response.status}`);
    const data = await response.json() as { current: ImportRecord | null };
    setCurrent(data.current);
    const check = await fetch(`${endpoint}/publishing-readiness`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (check.ok) { setReadiness(await check.json() as Readiness); setReadinessError(false); }
    else { setReadiness(null); setReadinessError(true); }
    const jobResponse = await fetch(`${endpoint}/publishing-jobs`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (jobResponse.ok) { setJobs(((await jobResponse.json()) as { jobs: PublishJob[] }).jobs); setJobsError(false); }
    else { setJobs([]); setJobsError(true); }
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
    <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{tr("Import the Wizard JSON to configure folder rules. File publication is a separate, explicit step after destination verification.", "Importe el JSON del Wizard para configurar las reglas de carpetas. La publicación de archivos es un paso separado y explícito después de verificar el destino.")}</p>
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
      {readinessError ? <p role="alert">{tr("Destination verification could not be loaded.", "No se pudo cargar la verificación del destino.")}</p>
        : readiness && <div style={{ fontSize: 12 }}>
          <strong>{readiness.ready ? tr("Site and library verified", "Sitio y biblioteca verificados") : tr("Destination setup incomplete", "Configuración del destino incompleta")}</strong>
          {readiness.blockers.length > 0 && <ul>{readiness.blockers.map((code) => <li key={code}>{readinessLabels[code]?.[lang === "es" ? 1 : 0] ?? code}</li>)}</ul>}
          {readiness.providerError && <p role="alert">{tr("Microsoft Graph verification is unavailable; no publishing is enabled.", "La verificación con Microsoft Graph no está disponible; no se habilita la publicación.")}</p>}
          {!readiness.ready && <p>{tr("File publishing remains unavailable until every destination check passes.", "La publicación no está disponible hasta que se aprueben todas las verificaciones del destino.")}</p>}
        </div>}
      <div style={{ fontSize: 12, marginTop: 12 }} aria-label={tr("SharePoint publication status", "Estado de publicación SharePoint")}>
        <strong>{tr("SharePoint publication status", "Estado de publicación SharePoint")}</strong>
        {jobsError ? <p role="alert">{tr("Could not load publication history.", "No se pudo cargar el historial de publicación.")}</p>
          : jobs.length === 0 ? <p>{tr("No files have been submitted for publication.", "No se enviaron archivos para publicación.")}</p>
          : <ul>{jobs.map((job) => <li key={job.jobId}>
            {job.filename} · {publishStateLabels[job.state]?.[lang === "es" ? 1 : 0] ?? tr("Unknown status", "Estado desconocido")} · {job.attempts}/{job.maxAttempts}
            {job.errorCode && <> · {tr("Publication failed; ask a project administrator to review it.", "Falló la publicación; solicite revisión a un administrador del proyecto.")}</>}
          </li>)}</ul>}
      </div>
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
      {current && <FolderWizardRoutingPanel projectId={projectId} token={token} lang={lang} blueprints={current.document.blueprints} />}
      {current && readiness?.ready && <FolderWizardPublishPanel projectId={projectId} token={token} lang={lang} onChanged={() => reload()} />}
    </>}
  </section>;
}
