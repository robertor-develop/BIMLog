import { useEffect, useRef, useState } from "react";
import { FolderWizardRequestLifetime } from "./folder-wizard-request-lifetime";
import { refreshAfterConfirmedFolderWizardMutation } from "./folder-wizard-confirmed-refresh";
import { folderWizardPublishOptions, pruneFolderWizardTags, type PublishRoutingDefinition } from "./folder-wizard-publish-options";

type SourceFile = { id: number; fileName: string; fileSize: number; status: string };
type Routing = { projectProfile: { definition: PublishRoutingDefinition } | null;
  companyProfile: { definition: PublishRoutingDefinition } | null; canEditProject: boolean };
type Candidate = { ready: boolean; blockers: string[]; filename?: string; byteSize?: number;
  siteUrl?: string; driveRelativePath?: string; requestDigest?: string };

export function FolderWizardPublishPanel({ projectId, token, lang, onChanged }: {
  projectId: number; token: string | null; lang: string; onChanged: () => Promise<void>;
}) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [routing, setRouting] = useState<Routing | null>(null);
  const [fileId, setFileId] = useState(0);
  const [tags, setTags] = useState<Record<string, string>>({});
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const lifetime = useRef(new FolderWizardRequestLifetime());
  const inFlight = useRef(false);
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard`;
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current.invalidate(); inFlight.current = false;
    setFiles([]); setRouting(null); setFileId(0); setTags({}); setResult(""); setBusy(false);
    setCandidate(null); setConfirming(false); setError("");
    if (!token) return () => lifetime.current.invalidate();
    void Promise.all([
      fetch(`/api/v1/projects/${projectId}/files`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
      fetch(`${endpoint}/routing`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
    ]).then(async ([fileResponse, routingResponse]) => {
      if (!fileResponse.ok || !routingResponse.ok) throw new Error("LOAD_FAILED");
      if (controller.signal.aborted) return;
      const loadedFiles = await fileResponse.json() as SourceFile[];
      const loadedRouting = await routingResponse.json() as Routing;
      if (controller.signal.aborted) return;
      setFiles(loadedFiles.filter((file) => file.status === "active" && file.fileSize > 0 && file.fileSize <= 10_485_760));
      setRouting(loadedRouting);
    }).catch(() => { if (!controller.signal.aborted) setError(tr("Could not load project files or routing rules.", "No se pudieron cargar los archivos o las reglas de rutas.")); });
    return () => { controller.abort(); lifetime.current.invalidate(); };
  }, [projectId, token, lang]);
  const profile = routing?.projectProfile ?? routing?.companyProfile;
  const options = folderWizardPublishOptions(profile?.definition, tags);

  async function request(path: string, body: unknown) {
    const response = await fetch(`${endpoint}${path}`, { method: "POST", headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data.error ?? `HTTP ${response.status}`));
    return data;
  }
  async function preview() {
    if (inFlight.current || !token || !fileId) return;
    inFlight.current = true;
    const current = lifetime.current.begin();
    setBusy(true); setError(""); setResult(""); setCandidate(null); setConfirming(false);
    try {
      const data = await request("/publishing-candidate", { fileId, tags }) as Candidate;
      if (!current()) return;
      setCandidate(data);
      if (!data.ready) setError(tr("The destination is not ready. Review the setup above.", "El destino no está listo. Revise la configuración anterior."));
    } catch { if (current()) setError(tr("No exact route or verified file matched this selection.", "No se encontró una ruta exacta o un archivo verificado para esta selección.")); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  }
  async function publish() {
    if (inFlight.current || !token || !candidate?.ready || !candidate.requestDigest) return;
    inFlight.current = true;
    const current = lifetime.current.begin();
    setBusy(true); setError(""); setResult("");
    try {
      const data = await request("/publish", { fileId, tags, expectedDigest: candidate.requestDigest,
        confirmation: "publish_sharepoint" });
      if (!current()) return;
      setResult(data.execution === "completed"
        ? tr("The exact file was published to SharePoint.", "El archivo exacto se publicó en SharePoint.")
        : data.execution === "retry" ? tr("Retry is available after the delay. Preview and confirm again later.", "El reintento estará disponible tras la espera. Actualice la vista previa y confirme de nuevo más tarde.")
        : data.execution === "dead_letter" ? tr("Publication needs administrator attention. The attempt limit was reached or the failure is not retryable.", "La publicación requiere revisión del administrador. Se alcanzó el límite de intentos o el fallo no permite reintento.")
        : data.execution === "cancelled" ? tr("This publication was cancelled. It was not restarted.", "Esta publicación fue cancelada. No se reinició.")
        : tr("Review the publication status below before trying again.", "Revise el estado de publicación antes de volver a intentar."));
      setConfirming(false); setCandidate(null);
      const refreshed = await refreshAfterConfirmedFolderWizardMutation(onChanged);
      if (current() && !refreshed) setError(tr("The publication response was received, but the status could not be refreshed. Reload to check its current state; do not submit again solely because of this refresh error.",
        "Se recibió la respuesta de publicación, pero no se pudo actualizar el estado. Recargue para consultarlo; no vuelva a enviar solo por este error de actualización."));
    } catch { if (current()) setError(tr("Publication was not confirmed. Refresh the preview and try again; no overwrite is attempted.",
      "No se confirmó la publicación. Actualice la vista previa y reintente; no se sobrescribe ningún archivo.")); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  }
  return <section style={{ borderTop: "1px solid hsl(var(--border))", marginTop: 16, paddingTop: 16, fontSize: 12 }}>
    <h3 style={{ fontSize: 15, margin: "0 0 7px" }}>{tr("Publish a project file", "Publicar un archivo del proyecto")}</h3>
    <p>{tr("Select an existing verified project file, preview its exact SharePoint destination, then confirm. Existing SharePoint files are never overwritten.",
      "Seleccione un archivo verificado del proyecto, revise su destino exacto en SharePoint y confirme. Nunca se sobrescriben archivos existentes.")}</p>
    {!routing?.canEditProject ? <p>{tr("Only a project administrator may publish.", "Solo un administrador del proyecto puede publicar.")}</p> : <>
      <label>{tr("Project file", "Archivo del proyecto")}
        <select disabled={busy} value={fileId} onChange={(event) => { lifetime.current.invalidate(); setFileId(Number(event.target.value)); setCandidate(null); setConfirming(false); setResult(""); }}>
          <option value={0}>{tr("Select a file", "Seleccione un archivo")}</option>
          {files.map((file) => <option key={file.id} value={file.id}>{file.fileName} ({file.fileSize} B)</option>)}
        </select>
      </label>
      {files.length === 0 && <p>{tr("No eligible project file is available. Upload and verify one in Files first.",
        "No hay un archivo apto. Cargue y verifique uno en Archivos primero.")}</p>}
      {options.map(({ key, values }) => <label key={key} style={{ display: "block", marginTop: 8 }}>{key}
        <select disabled={busy} value={tags[key] ?? ""} onChange={(event) => { lifetime.current.invalidate(); setTags((before) => pruneFolderWizardTags(profile?.definition, { ...before, [key]: event.target.value })); setCandidate(null); setConfirming(false); setResult(""); }}>
          <option value="">{tr("Select a mapped value", "Seleccione un valor configurado")}</option>
          {values.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>)}
      <button type="button" disabled={busy || !fileId} onClick={() => void preview()} style={{ display: "block", marginTop: 9 }}>
        {tr("Preview publication", "Vista previa de publicación")}</button>
      {candidate?.ready && <div role="group" aria-label={tr("Review publication", "Revisar publicación")}>
        <p>{candidate.filename} · {candidate.byteSize} B</p>
        <p style={{ overflowWrap: "anywhere" }}>{candidate.siteUrl} / {candidate.driveRelativePath}</p>
        {!confirming ? <button type="button" disabled={busy} onClick={() => setConfirming(true)}>{tr("Review and confirm", "Revisar y confirmar")}</button>
          : <><p>{tr("Confirm publication to the exact destination above?", "¿Confirma la publicación en el destino exacto indicado?")}</p>
            <button type="button" disabled={busy} onClick={() => void publish()}>{tr("Confirm publish", "Confirmar publicación")}</button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}>{tr("Cancel", "Cancelar")}</button></>}
      </div>}
    </>}
    {result && <p role="status">{result}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
