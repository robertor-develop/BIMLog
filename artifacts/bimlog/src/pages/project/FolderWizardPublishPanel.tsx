import { useEffect, useState } from "react";

type SourceFile = { id: number; fileName: string; fileSize: number; status: string };
type Routing = { projectProfile: { definition: { selectors: { tagKey: string }[];
  tierMappings: { tagKey: string }[] } } | null; companyProfile: { definition: { selectors: { tagKey: string }[];
  tierMappings: { tagKey: string }[] } } | null; canEditProject: boolean };
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
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard`;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setCandidate(null); setConfirming(false); setError("");
    void Promise.all([
      fetch(`/api/v1/projects/${projectId}/files`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
      fetch(`${endpoint}/routing`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
    ]).then(async ([fileResponse, routingResponse]) => {
      if (!fileResponse.ok || !routingResponse.ok) throw new Error("LOAD_FAILED");
      if (controller.signal.aborted) return;
      setFiles((await fileResponse.json() as SourceFile[]).filter((file) => file.status === "active" && file.fileSize > 0 && file.fileSize <= 10_485_760));
      setRouting(await routingResponse.json() as Routing);
    }).catch(() => { if (!controller.signal.aborted) setError(tr("Could not load project files or routing rules.", "No se pudieron cargar los archivos o las reglas de rutas.")); });
    return () => controller.abort();
  }, [projectId, token, lang]);
  const profile = routing?.projectProfile ?? routing?.companyProfile;
  const keys = [...new Set([...(profile?.definition.selectors ?? []).map((entry) => entry.tagKey),
    ...(profile?.definition.tierMappings ?? []).map((entry) => entry.tagKey)])];

  async function request(path: string, body: unknown) {
    const response = await fetch(`${endpoint}${path}`, { method: "POST", headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data.error ?? `HTTP ${response.status}`));
    return data;
  }
  async function preview() {
    setBusy(true); setError(""); setResult(""); setCandidate(null); setConfirming(false);
    try {
      const data = await request("/publishing-candidate", { fileId, tags }) as Candidate;
      setCandidate(data);
      if (!data.ready) setError(tr("The destination is not ready. Review the setup above.", "El destino no está listo. Revise la configuración anterior."));
    } catch { setError(tr("No exact route or verified file matched this selection.", "No se encontró una ruta exacta o un archivo verificado para esta selección.")); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!candidate?.ready || !candidate.requestDigest) return;
    setBusy(true); setError(""); setResult("");
    try {
      const data = await request("/publish", { fileId, tags, expectedDigest: candidate.requestDigest,
        confirmation: "publish_sharepoint" });
      setResult(data.execution === "completed"
        ? tr("The exact file was published to SharePoint.", "El archivo exacto se publicó en SharePoint.")
        : data.execution === "retry" ? tr("Retry is available after the delay. Preview and confirm again later.", "El reintento estará disponible tras la espera. Actualice la vista previa y confirme de nuevo más tarde.")
        : tr("Review the publication status below before trying again.", "Revise el estado de publicación antes de volver a intentar."));
      setConfirming(false); setCandidate(null);
      await onChanged();
    } catch { setError(tr("Publication was not confirmed. Refresh the preview and try again; no overwrite is attempted.",
      "No se confirmó la publicación. Actualice la vista previa y reintente; no se sobrescribe ningún archivo.")); }
    finally { setBusy(false); }
  }
  return <section style={{ borderTop: "1px solid hsl(var(--border))", marginTop: 16, paddingTop: 16, fontSize: 12 }}>
    <h3 style={{ fontSize: 15, margin: "0 0 7px" }}>{tr("Publish a project file", "Publicar un archivo del proyecto")}</h3>
    <p>{tr("Select an existing verified project file, preview its exact SharePoint destination, then confirm. Existing SharePoint files are never overwritten.",
      "Seleccione un archivo verificado del proyecto, revise su destino exacto en SharePoint y confirme. Nunca se sobrescriben archivos existentes.")}</p>
    {!routing?.canEditProject ? <p>{tr("Only a project administrator may publish.", "Solo un administrador del proyecto puede publicar.")}</p> : <>
      <label>{tr("Project file", "Archivo del proyecto")}
        <select value={fileId} onChange={(event) => { setFileId(Number(event.target.value)); setCandidate(null); setConfirming(false); }}>
          <option value={0}>{tr("Select a file", "Seleccione un archivo")}</option>
          {files.map((file) => <option key={file.id} value={file.id}>{file.fileName} ({file.fileSize} B)</option>)}
        </select>
      </label>
      {files.length === 0 && <p>{tr("No eligible project file is available. Upload and verify one in Files first.",
        "No hay un archivo apto. Cargue y verifique uno en Archivos primero.")}</p>}
      {keys.map((key) => <label key={key} style={{ display: "block", marginTop: 8 }}>{key}
        <input value={tags[key] ?? ""} onChange={(event) => { setTags((before) => ({ ...before, [key]: event.target.value })); setCandidate(null); setConfirming(false); }} />
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
