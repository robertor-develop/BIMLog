import { useEffect, useRef, useState } from "react";
import { FolderWizardRequestLifetime } from "./folder-wizard-request-lifetime";
import { refreshAfterConfirmedFolderWizardMutation } from "./folder-wizard-confirmed-refresh";
import { folderWizardPublishOptions, pruneFolderWizardTags, type PublishRoutingDefinition } from "./folder-wizard-publish-options";
import { sharePointPublicationStatus } from "./sharepoint-publication-status";

type SourceFile = { id: number; fileName: string; fileSize: number; status: string };
type Routing = { projectProfile: { definition: PublishRoutingDefinition } | null;
  companyProfile: { definition: PublishRoutingDefinition } | null; canEditProject: boolean };
type Candidate = { ready: boolean; blockers: string[]; fileId?:number;filename?: string; byteSize?: number;
  siteUrl?: string; driveRelativePath?: string; requestDigest?: string;publicationState?:string };
type PublicationReceipt={jobId:string;fileId:number;filename:string;digest:string};

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
  const [pendingReceipt,setPendingReceipt]=useState<PublicationReceipt|null>(null);
  const lifetime = useRef(new FolderWizardRequestLifetime());
  const inFlight = useRef(false);
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard`;
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current.invalidate(); inFlight.current = false;
    setFiles([]); setRouting(null); setFileId(0); setTags({}); setResult(""); setBusy(false);
    setCandidate(null); setConfirming(false); setError("");
    setPendingReceipt(null);
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
      const selected=files.find(file=>file.id===fileId);
      if(data.ready&&(!selected||data.fileId!==fileId||data.filename!==selected.fileName||data.byteSize!==selected.fileSize||data.publicationState!=="not_submitted"||!Array.isArray(data.blockers)||data.blockers.length!==0||!/^[a-f0-9]{64}$/.test(data.requestDigest??"")||typeof data.siteUrl!=="string"||!data.siteUrl.startsWith("https://")||typeof data.driveRelativePath!=="string"||!data.driveRelativePath||data.driveRelativePath.split("/").some(part=>part==="..")))throw new Error("CANDIDATE_IDENTITY_INVALID");
      setCandidate(data);
      if (!data.ready) setError(tr("The destination is not ready. Review the setup above.", "El destino no está listo. Revise la configuración anterior."));
    } catch { if (current()) setError(tr("No exact route or verified file matched this selection.", "No se encontró una ruta exacta o un archivo verificado para esta selección.")); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  }
  async function verifyReceipt(receipt:PublicationReceipt,current:()=>boolean){
    const response=await fetch(`${endpoint}/publishing-jobs`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error("PUBLICATION_READ_UNAVAILABLE");const data=await response.json();if(!current())return;
    const job=Array.isArray(data.jobs)?data.jobs.find((row:any)=>row.jobId===receipt.jobId):null;
    if(!job||job.sourceFileId!==receipt.fileId||job.filename!==receipt.filename||job.requestDigest!==receipt.digest||!["queued","leased","retry","completed","dead_letter","cancelled"].includes(job.state)||(job.state==="completed"&&(!job.completedAt||!Number.isFinite(Date.parse(job.completedAt)))))throw new Error("PUBLICATION_RECEIPT_UNVERIFIED");
    setResult(`${sharePointPublicationStatus(job.state,lang).message} ${tr("Job","Trabajo")}: ${job.jobId} · ${tr("Source file","Archivo fuente")}: #${job.sourceFileId}`);setPendingReceipt(null);
    const refreshed=await refreshAfterConfirmedFolderWizardMutation(onChanged);if(current()&&!refreshed)setError(tr("The exact saved job was verified, but the surrounding status did not refresh. Reload the status; do not submit again.","Se verificó el trabajo guardado exacto, pero no se actualizó el estado general. Recargue el estado; no vuelva a enviar."));
  }
  async function retryReceipt(){if(inFlight.current||!pendingReceipt)return;inFlight.current=true;const current=lifetime.current.begin();setBusy(true);setError("");try{await verifyReceipt(pendingReceipt,current);}catch{if(current())setError(tr("The saved publication job could not be verified. Retry verification; no publication request was repeated.","No se verificó el trabajo guardado. Reintente la verificación; no se repitió la publicación."));}finally{if(current()){inFlight.current=false;setBusy(false);}}}
  async function publish() {
    if (inFlight.current ||pendingReceipt|| !token || !candidate?.ready || !candidate.requestDigest) return;
    inFlight.current = true;
    const current = lifetime.current.begin();
    setBusy(true); setError(""); setResult("");
    try {
      const data = await request("/publish", { fileId, tags, expectedDigest: candidate.requestDigest,
        confirmation: "publish_sharepoint" });
      if (!current()) return;
      if(typeof data.jobId!=="string"||!data.jobId)throw new Error("PUBLICATION_RECEIPT_MISSING");
      const receipt={jobId:data.jobId,fileId,filename:candidate.filename!,digest:candidate.requestDigest};setPendingReceipt(receipt);
      setResult(tr("Publication response received; exact saved-job verification is pending.","Respuesta de publicación recibida; falta verificar el trabajo guardado exacto."));
      setConfirming(false); setCandidate(null);
      try{await verifyReceipt(receipt,current);}catch{if(current())setError(tr("The saved publication job could not be verified. Retry verification; no publication request was repeated.","No se verificó el trabajo guardado. Reintente la verificación; no se repitió la publicación."));}
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
        <select disabled={busy||!!pendingReceipt} value={fileId} onChange={(event) => { lifetime.current.invalidate(); setFileId(Number(event.target.value)); setCandidate(null); setConfirming(false); setResult(""); }}>
          <option value={0}>{tr("Select a file", "Seleccione un archivo")}</option>
          {files.map((file) => <option key={file.id} value={file.id}>{file.fileName} ({file.fileSize} B)</option>)}
        </select>
      </label>
      {files.length === 0 && <p>{tr("No eligible project file is available. Upload and verify one in Files first.",
        "No hay un archivo apto. Cargue y verifique uno en Archivos primero.")}</p>}
      {options.map(({ key, values }) => <label key={key} style={{ display: "block", marginTop: 8 }}>{key}
        <select disabled={busy||!!pendingReceipt} value={tags[key] ?? ""} onChange={(event) => { lifetime.current.invalidate(); setTags((before) => pruneFolderWizardTags(profile?.definition, { ...before, [key]: event.target.value })); setCandidate(null); setConfirming(false); setResult(""); }}>
          <option value="">{tr("Select a mapped value", "Seleccione un valor configurado")}</option>
          {values.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>)}
      <button type="button" disabled={busy ||!!pendingReceipt|| !fileId} onClick={() => void preview()} style={{ display: "block", marginTop: 9 }}>
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
    {pendingReceipt&&<div><p>{tr("Saved job receipt","Recibo del trabajo guardado")}: {pendingReceipt.jobId} · SHA-256: <code style={{overflowWrap:"anywhere"}}>{pendingReceipt.digest}</code></p><button type="button" disabled={busy} onClick={()=>void retryReceipt()}>{tr("Retry publication verification","Reintentar verificación de publicación")}</button></div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

