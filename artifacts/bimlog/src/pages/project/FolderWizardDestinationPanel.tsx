import { useEffect, useRef, useState } from "react";
import { readFolderWizardDestination, type FolderWizardDestination as Destination } from "./folder-wizard-destination-response";

export function FolderWizardDestinationPanel({ projectId, token, lang, onSaved }: {
  projectId: number; token: string | null; lang: string; onSaved: () => Promise<void>;
}) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const [data, setData] = useState<Destination | null>(null);
  const [draft, setDraft] = useState({ credentialId: "", siteId: "", libraryId: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const revision = useRef(0);
  const inFlight = useRef(false);
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard/destination`;
  const valid = Object.values(draft).every(value => value.trim().length > 0 && value.length <= 1024 && !/[\x00-\x1f]/.test(value));

  async function read(current: number, signal?: AbortSignal) {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!response.ok) throw new Error("load");
    const next = readFolderWizardDestination(await response.json());
    if (current === revision.current && !signal?.aborted) setData(next);
  }
  useEffect(() => {
    const controller = new AbortController();
    const current = ++revision.current;
    inFlight.current = false;
    setData(null); setDraft({ credentialId: "", siteId: "", libraryId: "" });
    setError(""); setSaved(false); setBusy(false); setConfirm(false); setLoading(true);
    if (!token) { setLoading(false); return () => { controller.abort(); revision.current++; }; }
    void read(current, controller.signal).catch(() => {
      if (current === revision.current) setError("load");
    }).finally(() => { if (current === revision.current) setLoading(false); });
    return () => { controller.abort(); revision.current++; };
  }, [projectId, token]);

  async function retry() {
    if (inFlight.current || !token) return;
    inFlight.current = true; setLoading(true); setError("");
    const current = revision.current;
    try { await read(current); }
    catch { if (current === revision.current) setError("load"); }
    finally { if (current === revision.current) { inFlight.current = false; setLoading(false); } }
  }
  async function save() {
    if (inFlight.current || !valid || !confirm || !token || !data?.canConfigure || data.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const current = revision.current;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, confirmation: "configure_sharepoint_destination" }) });
      if (current !== revision.current) return;
      if (!response.ok) { setError(response.status === 409 ? "conflict" : response.status === 403 ? "denied" : "verify"); return; }
      setSaved(true); setConfirm(false);
      try { await read(current); await onSaved(); }
      catch { if (current === revision.current) setError("refresh"); }
    } catch { if (current === revision.current) setError("uncertain"); }
    finally { if (current === revision.current) { inFlight.current = false; setBusy(false); } }
  }
  const messages: Record<string, [string, string]> = {
    load: ["Could not load the SharePoint destination. Retry.", "No se pudo cargar el destino SharePoint. Reintente."],
    conflict: ["A different destination is already registered. Reload to inspect it; it was not replaced.", "Ya existe otro destino registrado. Recargue para consultarlo; no se reemplazó."],
    denied: ["Current project administrator access is required.", "Se requiere acceso vigente de administrador del proyecto."],
    verify: ["Microsoft could not verify this site and library with the selected company connection. Check the identifiers and connection with your administrator.", "Microsoft no pudo verificar el sitio y la biblioteca con la conexión seleccionada. Revise los identificadores y la conexión con su administrador."],
    refresh: ["The destination was saved, but the screen could not refresh. Reload before submitting again.", "Se guardó el destino, pero no se pudo actualizar la pantalla. Recargue antes de volver a enviar."],
    uncertain: ["The response was interrupted. Reload to check whether the destination was saved before retrying.", "Se interrumpió la respuesta. Recargue para comprobar si se guardó el destino antes de reintentar."],
  };
  const fieldStyle = { display: "block", width: "100%", minWidth: 0, padding: 8, marginTop: 4, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
  return <section aria-label={tr("SharePoint destination", "Destino SharePoint")} style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 14, marginBottom: 14 }}>
    <h3 style={{ margin: "0 0 8px" }}>{tr("SharePoint destination", "Destino SharePoint")}</h3>
    <p>{tr("Bind this project to an existing company connection, site and document library. This step does not upload files or change Microsoft permissions.",
      "Vincule el proyecto a una conexión de empresa, un sitio y una biblioteca existentes. Este paso no carga archivos ni cambia permisos de Microsoft.")}</p>
    {loading ? <p role="status">{tr("Loading destination…", "Cargando destino…")}</p> : data?.current ? <dl style={{ overflowWrap: "anywhere" }}>
      <dt>{tr("Site identifier", "Identificador del sitio")}</dt><dd>{data.current.siteId}</dd>
      <dt>{tr("Library identifier", "Identificador de la biblioteca")}</dt><dd>{data.current.libraryId}</dd>
      <dt>{tr("State", "Estado")}</dt><dd>{data.current.state === "active" ? tr("Configured — verify routing before publication", "Configurado — verifique las rutas antes de publicar") : tr("Disabled — administrator review required", "Desactivado — requiere revisión del administrador")}</dd>
    </dl> : data && (!data.canConfigure ? <p>{tr("Ask a project administrator to configure the destination.", "Solicite al administrador del proyecto que configure el destino.")}</p>
      : data.credentials.length === 0 ? <p role="status">{tr("No active SharePoint company connection is registered. An administrator must connect and validate the authorized company account before this project can publish. No password or token belongs in this form.",
        "No hay una conexión SharePoint activa registrada para la empresa. Un administrador debe conectar y validar la cuenta autorizada antes de publicar. No ingrese contraseñas ni tokens en este formulario.")}</p>
        : <>
          <label>{tr("Company connection", "Conexión de empresa")}<select style={fieldStyle} disabled={busy || saved} value={draft.credentialId} onChange={e => { setDraft({ ...draft, credentialId: e.target.value }); setConfirm(false); }}>
            <option value="">{tr("Select a connection", "Seleccione una conexión")}</option>
            {data.credentials.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <p>{tr("Use the exact site and document-library identifiers supplied by your Microsoft administrator, not a browser sharing link.", "Use los identificadores exactos del sitio y la biblioteca suministrados por su administrador de Microsoft, no un enlace para compartir.")}</p>
          <label>{tr("Site identifier", "Identificador del sitio")}<input style={fieldStyle} disabled={busy || saved} maxLength={1024} value={draft.siteId} onChange={e => { setDraft({ ...draft, siteId: e.target.value }); setConfirm(false); }} /></label>
          <label>{tr("Library identifier", "Identificador de la biblioteca")}<input style={fieldStyle} disabled={busy || saved} maxLength={1024} value={draft.libraryId} onChange={e => { setDraft({ ...draft, libraryId: e.target.value }); setConfirm(false); }} /></label>
          {!confirm ? <button type="button" disabled={!valid || busy || saved} onClick={() => setConfirm(true)}>{tr("Review destination", "Revisar destino")}</button>
            : <div role="group" aria-label={tr("Confirm destination", "Confirmar destino")} style={{ overflowWrap: "anywhere" }}>
              <p>{tr("Confirm this exact destination? Existing mappings will not be replaced.", "¿Confirma este destino exacto? No se reemplazan configuraciones existentes.")}</p>
              <p>{draft.siteId} / {draft.libraryId}</p>
              <button type="button" disabled={busy} onClick={() => void save()}>{tr("Verify and save destination", "Verificar y guardar destino")}</button>
              <button type="button" disabled={busy} onClick={() => setConfirm(false)}>{tr("Cancel", "Cancelar")}</button>
            </div>}
        </>)}
    {saved && <p role="status">{tr("Destination saved. Continue with the Wizard import and routing verification.", "Destino guardado. Continúe con la importación del Wizard y la verificación de rutas.")}</p>}
    {error && <p role="alert">{messages[error]?.[lang === "es" ? 1 : 0]}</p>}
    <button type="button" disabled={loading || busy} onClick={() => void retry()}>{tr("Reload destination", "Recargar destino")}</button>
  </section>;
}
