import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertTriangle, BriefcaseBusiness, CalendarClock, ClipboardCheck, Clock3, ExternalLink, FileCheck2, Link2, PackagePlus, RefreshCw, Save, Trash2, UserRoundCheck } from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { downloadGovernedCurrentViewPdf, PrintPdfButton } from "@/components/PrintPdfButton";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { BudgetGovernancePanel } from "@/components/job-operations/BudgetGovernancePanel";
import { ProjectControlsDashboard } from "@/components/job-operations/ProjectControlsDashboard";

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ?? "";
const css = `
.jo{max-width:1240px;margin:0 auto;padding:24px 0 80px}.jo *{box-sizing:border-box}.jo-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.jo-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.jo h1{font-size:30px;margin:4px 0}.jo h2{font-size:20px;margin:0}.jo h3{font-size:16px;margin:0}.jo p{color:#536174}.jo button,.jo select,.jo input,.jo textarea{border:1px solid #cbd5e1;border-radius:8px;padding:9px;background:#fff;color:#0f172a}.jo button{cursor:pointer}.jo button.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff;font-weight:700}.jo button.danger{color:#b42318}.jo button:disabled{opacity:.5;cursor:not-allowed}.jo-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:18px}.jo-stat,.jo-card{background:#fff;border:1px solid #d9e1ec;border-radius:14px}.jo-stat{padding:14px}.jo-stat strong{display:block;font-size:22px}.jo-stat span{font-size:12px;color:#64748b}.jo-card{padding:18px;margin-bottom:16px}.jo-item-head{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:12px}.jo-chip{display:inline-flex;padding:3px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:800;margin-right:5px}.jo-chip.warn{background:#fff7ed;color:#c2410c}.jo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.jo-task{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-top:12px}.jo-task-head{display:flex;justify-content:space-between;gap:10px}.jo label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.jo-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.jo-progress{height:8px;background:#e8edf5;border-radius:99px;overflow:hidden;margin-top:8px}.jo-progress span{display:block;height:100%;background:#2563eb}.jo-sub{margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}.jo-sub h4{margin:0 0 8px}.jo-table{width:100%;border-collapse:collapse;font-size:13px}.jo-table th,.jo-table td{text-align:left;padding:8px;border-bottom:1px solid #e2e8f0}.jo-empty,.jo-error,.jo-ok{padding:16px;border-radius:12px;margin-bottom:14px}.jo-empty{background:#eff6ff}.jo-error{background:#fff1f2;color:#9f1239}.jo-ok{background:#ecfdf5;color:#166534}.jo-muted{font-size:12px;color:#64748b}.jo-financial{background:#f0fdf4}.jo-forms{display:grid;grid-template-columns:1fr 1fr;gap:12px}.jo-form{border:1px solid #dbe4f0;border-radius:12px;padding:12px}.jo-form .jo-grid{grid-template-columns:2fr 1fr 1fr}.jo-file{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #e2e8f0}.jo textarea{min-height:40px;resize:vertical}.jo input[type=range]{padding:0}.jo-refresh{display:flex;align-items:center;gap:6px}.jo-package-create{background:#f8fafc;border:1px dashed #94a3b8;border-radius:12px;padding:12px;margin:10px 0}.jo-package-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:10px}.jo-package{border:1px solid #cbd5e1;border-radius:12px;padding:12px;background:#fff}.jo-package.overdue{border-color:#f97316;background:#fff7ed}.jo-package-head{display:flex;justify-content:space-between;gap:10px}.jo-package-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;font-size:12px;color:#64748b}.jo-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:5px;margin:8px 0}.jo-check{display:flex!important;grid-template-columns:none!important;align-items:center;gap:7px!important;font-weight:500!important}.jo-check input{padding:0}.jo-package-edit{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:8px;align-items:end;margin-top:9px}.jo-connections{border-color:#bfdbfe;background:#f8fbff}.jo-connections-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.jo-connection-form{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:10px;align-items:end;padding:14px;border:1px solid #bfdbfe;border-radius:12px;background:#fff;margin:14px 0}.jo-connection-form .jo-note{grid-column:1/-1}.jo-connection-form .jo-actions{grid-column:1/-1;margin-top:0}.jo-connection-list{display:grid;gap:10px}.jo-connection{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:13px;border:1px solid #dbe4f0;border-radius:12px;background:#fff;min-width:0}.jo-connection-main{min-width:0}.jo-connection-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.jo-connection-title strong,.jo-connection p{overflow-wrap:anywhere}.jo-connection-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px;font-size:12px;color:#64748b}.jo-connection-actions{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}.jo-inline-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;grid-column:1/-1;padding-top:10px;border-top:1px solid #e2e8f0}.jo-inline-confirm p{margin:0;flex:1 1 240px}.jo-permission{padding:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;color:#854d0e}.jo-loading{display:flex;align-items:center;gap:8px;color:#475569}@media(max-width:900px){.jo-grid,.jo-form .jo-grid{grid-template-columns:1fr 1fr}.jo-forms{grid-template-columns:1fr}.jo-head,.jo-item-head,.jo-connections-head{display:block}.jo-table{display:block;overflow:auto}.jo-package-edit{grid-template-columns:1fr 1fr}.jo-connection-form{grid-template-columns:1fr 1fr}.jo-connection-form .jo-note{grid-column:1/-1}}@media(max-width:560px){.jo-grid,.jo-form .jo-grid,.jo-package-edit,.jo-connection-form,.jo-connection{grid-template-columns:1fr}.jo-connection-form .jo-note,.jo-connection-form .jo-actions{grid-column:1}.jo-connection-actions{justify-content:flex-start}.jo-connections{padding:14px}.jo select,.jo input,.jo textarea,.jo button{max-width:100%}}
.jo-limit{grid-column:1/-1;padding:10px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px;color:#854d0e;font-size:12px}@media(max-width:390px){.jo-connections{padding:12px;border-radius:10px}.jo-connection-meta{display:grid;grid-template-columns:1fr}.jo-connection-actions{display:grid;grid-template-columns:1fr;align-items:stretch}.jo-connection-actions a,.jo-connection-actions button{width:100%}}
`;

const n = (value: unknown) => Number(value ?? 0);
const money = (value: unknown) => n(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

type Translate = (english: string, spanish: string) => string;
type DocumentEntityType = "rfi" | "file_revision" | "transmittal";
type DocumentTargetType = "task" | "work_package";
type DocumentConnectionOption = { id: number; displayCode: string; title: string; status: string | null; version: number | null; deepLink: string; parentFileId?: number | null };
type DocumentConnectionEntity = DocumentConnectionOption & { available: boolean; stale: boolean };
type DocumentConnectionOptions = { rfis: DocumentConnectionOption[]; fileRevisions: DocumentConnectionOption[]; transmittals: DocumentConnectionOption[] };
type DocumentConnectionOptionMetaItem = { total: number; limited: boolean; max: number };
type DocumentConnectionOptionMeta = { rfis: DocumentConnectionOptionMetaItem; fileRevisions: DocumentConnectionOptionMetaItem; transmittals: DocumentConnectionOptionMetaItem };
type DocumentConnectionMeta = { total: number; limited: boolean; max: number };
type DocumentConnection = {
  id: string; projectId: number; targetType: DocumentTargetType; targetId: string; entityType: DocumentEntityType; entityId: number; note: string;
  linkedById: number; linkedAt: string; canRemove: boolean; entity: DocumentConnectionEntity;
};
type ApiCall = (path: string, init?: RequestInit) => Promise<any>;

class RequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

const isOption = (value: unknown, needsParentFileId = false): value is DocumentConnectionOption => {
  if (!value || typeof value !== "object") return false;
  const option = value as Record<string, unknown>;
  const base = Number.isInteger(option.id) && typeof option.displayCode === "string" && typeof option.title === "string" &&
    (option.status === null || typeof option.status === "string") && (option.version === null || Number.isInteger(option.version)) && typeof option.deepLink === "string";
  return base && (!needsParentFileId || option.parentFileId === null || Number.isInteger(option.parentFileId));
};

const parseDocumentConnectionOptions = (value: unknown): DocumentConnectionOptions | null => {
  if (!value || typeof value !== "object") return null;
  const options = value as Record<string, unknown>;
  if (!Array.isArray(options.rfis) || !Array.isArray(options.fileRevisions) || !Array.isArray(options.transmittals)) return null;
  if (!options.rfis.every((item) => isOption(item)) || !options.fileRevisions.every((item) => isOption(item, true)) || !options.transmittals.every((item) => isOption(item))) return null;
  return { rfis: options.rfis, fileRevisions: options.fileRevisions, transmittals: options.transmittals };
};

const parseDocumentConnectionOptionMeta = (value: unknown): DocumentConnectionOptionMeta | null => {
  if (!value || typeof value !== "object") return null;
  const meta = value as Record<string, unknown>;
  const valid = (item: unknown): item is DocumentConnectionOptionMetaItem => {
    if (!item || typeof item !== "object") return false;
    const entry = item as Record<string, unknown>;
    return Number.isInteger(entry.total) && Number(entry.total) >= 0 && typeof entry.limited === "boolean" && Number.isInteger(entry.max) && Number(entry.max) > 0;
  };
  if (!valid(meta.rfis) || !valid(meta.fileRevisions) || !valid(meta.transmittals)) return null;
  return { rfis: meta.rfis, fileRevisions: meta.fileRevisions, transmittals: meta.transmittals };
};

const parseDocumentConnectionMeta = (value: unknown): DocumentConnectionMeta | null => {
  if (!value || typeof value !== "object") return null;
  const meta = value as Record<string, unknown>;
  return Number.isInteger(meta.total) && Number(meta.total) >= 0 && typeof meta.limited === "boolean" && Number.isInteger(meta.max) && Number(meta.max) > 0
    ? { total: Number(meta.total), limited: meta.limited, max: Number(meta.max) }
    : null;
};

const isConnectionEntity = (value: unknown): value is DocumentConnectionEntity => {
  if (!isOption(value)) return false;
  const entity = value as DocumentConnectionEntity;
  return typeof entity.available === "boolean" && typeof entity.stale === "boolean";
};

const isConnection = (value: unknown): value is DocumentConnection => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && Number.isInteger(item.projectId) && (item.targetType === "task" || item.targetType === "work_package") &&
    typeof item.targetId === "string" && (item.entityType === "rfi" || item.entityType === "file_revision" || item.entityType === "transmittal") &&
    Number.isInteger(item.entityId) && typeof item.note === "string" && Number.isInteger(item.linkedById) &&
    typeof item.linkedAt === "string" && typeof item.canRemove === "boolean" && isConnectionEntity(item.entity);
};

export function DocumentConnectionsPanel({ data, projectId, language, tt, api, reload, busy }: { data: any; projectId: number; language: string; tt: Translate; api: ApiCall; reload: () => Promise<void>; busy: boolean }) {
  const [targetType, setTargetType] = useState<DocumentTargetType>("task");
  const [targetId, setTargetId] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [entityType, setEntityType] = useState<DocumentEntityType>("rfi");
  const [entityId, setEntityId] = useState("");
  const [entityQuery, setEntityQuery] = useState("");
  const [note, setNote] = useState("");
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const options = parseDocumentConnectionOptions(data?.documentConnectionOptions);
  const metaPresent = data?.documentConnectionOptionMeta !== undefined;
  const optionMeta = metaPresent ? parseDocumentConnectionOptionMeta(data.documentConnectionOptionMeta) : null;
  const connectionMetaPresent = data?.documentConnectionMeta !== undefined;
  const connectionMeta = connectionMetaPresent ? parseDocumentConnectionMeta(data.documentConnectionMeta) : null;
  const rawConnections = data?.documentConnections;
  const connectionsValid = Array.isArray(rawConnections) && rawConnections.every(isConnection);
  const connections: DocumentConnection[] = connectionsValid ? rawConnections : [];
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const packages = Array.isArray(data?.packages) ? data.packages : [];
  const targetItems = targetType === "task" ? tasks : packages;
  const canControl = (item: any) => item?.canControl === true || data?.canManage === true;
  const controllableTargets = targetItems.filter(canControl);
  const entityOptions = !options ? [] : entityType === "rfi" ? options.rfis : entityType === "file_revision" ? options.fileRevisions : options.transmittals;
  const selectedMeta = !optionMeta ? null : entityType === "rfi" ? optionMeta.rfis : entityType === "file_revision" ? optionMeta.fileRevisions : optionMeta.transmittals;
  const contains = (value: unknown, query: string) => String(value ?? "").toLocaleLowerCase(language === "es" ? "es" : "en").includes(query.trim().toLocaleLowerCase(language === "es" ? "es" : "en"));
  const filteredTargets = controllableTargets.filter((item: any) => targetType === "task"
    ? contains(language === "es" ? item.nameEs : item.nameEn, targetQuery)
    : contains(`${item.packageCode} ${item.title}`, targetQuery));
  const filteredEntityOptions = entityOptions.filter((item) => contains(`${item.displayCode} ${item.title} ${item.status ?? ""} ${item.version ?? ""}`, entityQuery));
  const allOptionsEmpty = !!options && options.rfis.length === 0 && options.fileRevisions.length === 0 && options.transmittals.length === 0;
  const anyControllableTarget = tasks.some(canControl) || packages.some(canControl);
  const typeLabel = (value: DocumentEntityType) => ({ rfi: "RFI", file_revision: tt("File revision", "Revisión de archivo"), transmittal: tt("Transmittal", "Transmittal") })[value];
  const canOpenCanonicalRecord = (entity: DocumentConnectionEntity) => entity.available && !entity.stale && entity.deepLink.trim().length > 0;
  const targetTypeLabel = (value: DocumentTargetType) => value === "task" ? tt("Task", "Tarea") : tt("Work package", "Paquete de trabajo");
  const targetLabel = (connection: DocumentConnection) => {
    if (connection.targetType === "task") {
      const task = tasks.find((item: any) => item.id === connection.targetId);
      return task ? (language === "es" ? task.nameEs : task.nameEn) : `${tt("Unavailable task", "Tarea no disponible")} (${connection.targetId})`;
    }
    const item = packages.find((candidate: any) => candidate.id === connection.targetId);
    return item ? `${item.packageCode} · ${item.title}` : `${tt("Unavailable package", "Paquete no disponible")} (${connection.targetId})`;
  };
  const selectedAlreadyLinked = connections.some((item) => item.targetType === targetType && item.targetId === targetId && item.entityType === entityType && item.entityId === Number(entityId));

  useEffect(() => { setTargetId(""); setTargetQuery(""); }, [targetType]);
  useEffect(() => { setEntityId(""); setEntityQuery(""); }, [entityType]);

  if (!options || !connectionsValid || (metaPresent && !optionMeta) || (connectionMetaPresent && !connectionMeta)) return <section className="jo-card jo-connections" aria-labelledby="document-connections-title"><div className="jo-connections-head"><div><h2 id="document-connections-title"><Link2 size={18}/> {tt("Document connections", "Conexiones de documentos")}</h2><p>{tt("Connect operational work to canonical project records without copying them.", "Conecte el trabajo operativo con registros canónicos del proyecto sin copiarlos.")}</p></div></div><div className="jo-error" role="alert"><AlertTriangle size={16}/> {tt("Document connections could not load because the server response is incomplete. Refresh the workspace.", "Las conexiones de documentos no pudieron cargarse porque la respuesta del servidor está incompleta. Actualice el espacio.")}</div><button type="button" disabled={busy} onClick={() => void reload()}><RefreshCw size={14}/> {tt("Reload connections", "Recargar conexiones")}</button></section>;

  const runAction = async (action: () => Promise<any>, success: string, idempotent?: string) => {
    setConnectionBusy(true); setConnectionError(""); setConnectionNotice("");
    try {
      const result = await action();
      setConnectionNotice(result?.idempotent === true && idempotent ? idempotent : success);
      setConfirmRemoveId(null);
      await reload();
    } catch (cause) {
      const request = cause instanceof RequestError ? cause : null;
      if (request?.status === 404 || request?.status === 409 || request?.code?.includes("STALE")) setConnectionError(tt("This connection changed in another session. Reload before trying again.", "Esta conexión cambió en otra sesión. Recargue antes de volver a intentar."));
      else if (request?.status === 401 || request?.status === 403) setConnectionError(tt("Your current permission does not allow this document connection change.", "Su permiso actual no permite cambiar esta conexión de documento."));
      else setConnectionError(cause instanceof Error ? cause.message : String(cause));
    } finally { setConnectionBusy(false); }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetId || !entityId) return;
    void runAction(() => api(`/projects/${projectId}/operations/document-connections`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: crypto.randomUUID(), targetType, targetId, entityType, entityId: Number(entityId), note: note.trim() }),
    }), tt("Document linked to operational work.", "Documento vinculado al trabajo operativo."), tt("This document was already linked; the existing connection was kept.", "Este documento ya estaba vinculado; se conservó la conexión existente."));
  };

  return <section className="jo-card jo-connections" aria-labelledby="document-connections-title">
    <div className="jo-connections-head"><div><h2 id="document-connections-title"><Link2 size={18}/> {tt("Document connections", "Conexiones de documentos")}</h2><p>{tt("Link a task or work package to a same-project RFI, file revision, or transmittal. The original document remains authoritative.", "Vincule una tarea o paquete con un RFI, revisión de archivo o transmittal del mismo proyecto. El documento original sigue siendo el registro autorizado.")}</p></div><span className="jo-chip">{connections.length} {tt("linked", "vinculadas")}</span></div>
    {connectionError && <div className="jo-error" role="alert"><AlertTriangle size={16}/> {connectionError} <button type="button" disabled={connectionBusy || busy} onClick={() => void reload()}><RefreshCw size={14}/> {tt("Reload", "Recargar")}</button></div>}
    {connectionNotice && <div className="jo-ok" role="status">{connectionNotice}</div>}
    {(connectionBusy || busy) && <div className="jo-loading" role="status"><RefreshCw size={15}/> {tt("Updating document connections…", "Actualizando conexiones de documentos…")}</div>}
    {connectionMeta?.limited && <div className="jo-limit" role="status"><AlertTriangle size={14}/> {tt(`Showing ${connections.length} of ${connectionMeta.total} document connections. The server limits this list to ${connectionMeta.max}.`, `Se muestran ${connections.length} de ${connectionMeta.total} conexiones de documentos. El servidor limita esta lista a ${connectionMeta.max}.`)}</div>}
    {!anyControllableTarget && <div className="jo-permission"><strong>{tt("View-only access", "Acceso de solo lectura")}</strong><div>{tt("You can review connections, but your current permission cannot change the available tasks or work packages.", "Puede revisar las conexiones, pero su permiso actual no permite cambiar las tareas o paquetes disponibles.")}</div></div>}
    {anyControllableTarget && allOptionsEmpty && <div className="jo-empty"><FileCheck2 size={19}/><strong>{tt("No canonical documents are available to link", "No hay documentos canónicos disponibles para vincular")}</strong><div>{tt("Create or receive an RFI, file revision, or transmittal in this project, then refresh Job Operations.", "Cree o reciba un RFI, revisión de archivo o transmittal en este proyecto y luego actualice Operaciones.")}</div></div>}
    {anyControllableTarget && !allOptionsEmpty && <form className="jo-connection-form" onSubmit={submit}>
      <label>{tt("Operational target", "Destino operativo")}<select value={targetType} onChange={(event) => setTargetType(event.target.value as DocumentTargetType)}><option value="task">{tt("Task", "Tarea")}</option><option value="work_package">{tt("Work package", "Paquete de trabajo")}</option></select></label>
      <label>{tt("Search operational targets", "Buscar destinos operativos")}<input type="search" value={targetQuery} onChange={(event) => setTargetQuery(event.target.value)} placeholder={tt("Search task or package", "Buscar tarea o paquete")}/></label>
      <label>{targetTypeLabel(targetType)}<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">{filteredTargets.length ? tt("Choose a target", "Seleccione un destino") : tt("No matching targets", "No hay destinos coincidentes")}</option>{filteredTargets.map((item: any) => <option key={item.id} value={item.id}>{targetType === "task" ? (language === "es" ? item.nameEs : item.nameEn) : `${item.packageCode} · ${item.title}`}</option>)}</select></label>
      <label>{tt("Document type", "Tipo de documento")}<select value={entityType} onChange={(event) => setEntityType(event.target.value as DocumentEntityType)}><option value="rfi">RFI</option><option value="file_revision">{tt("File revision", "Revisión de archivo")}</option><option value="transmittal">{tt("Transmittal", "Transmittal")}</option></select></label>
      <label>{tt("Search canonical documents", "Buscar documentos canónicos")}<input type="search" value={entityQuery} onChange={(event) => setEntityQuery(event.target.value)} placeholder={tt("Search code, title, status, or version", "Buscar código, título, estado o versión")}/></label>
      <label>{typeLabel(entityType)}<select required value={entityId} onChange={(event) => setEntityId(event.target.value)}><option value="">{filteredEntityOptions.length ? tt("Choose a canonical record", "Seleccione un registro canónico") : tt("No matching records", "No hay registros coincidentes")}</option>{filteredEntityOptions.map((item) => <option key={item.id} value={item.id}>{item.displayCode} · {item.title}{item.status ? ` · ${item.status}` : ""}{item.version !== null ? ` · v${item.version}` : ""}</option>)}</select></label>
      {selectedMeta?.limited && <div className="jo-limit" role="status"><AlertTriangle size={14}/> {tt(`Showing ${entityOptions.length} of ${selectedMeta.total} available records. The server limits this list to ${selectedMeta.max}; search applies only to the loaded records.`, `Se muestran ${entityOptions.length} de ${selectedMeta.total} registros disponibles. El servidor limita esta lista a ${selectedMeta.max}; la búsqueda se aplica solamente a los registros cargados.`)}</div>}
      <label className="jo-note">{tt("Connection note", "Nota de la conexión")}<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={tt("Optional context for this relationship", "Contexto opcional para esta relación")}/></label>
      <div className="jo-actions"><button className="primary" disabled={connectionBusy || busy || !targetId || !entityId}><Link2 size={15}/> {selectedAlreadyLinked ? tt("Keep existing link", "Conservar vínculo existente") : tt("Link document", "Vincular documento")}</button>{selectedAlreadyLinked && <span className="jo-muted">{tt("This exact relationship already exists; submitting keeps the same connection.", "Esta relación exacta ya existe; al enviar se conserva la misma conexión.")}</span>}</div>
    </form>}
    {connections.length === 0 ? <div className="jo-empty">{tt("No document connections yet.", "Todavía no hay conexiones de documentos.")}</div> : <div className="jo-connection-list">{connections.map((connection) => <article className="jo-connection" key={connection.id}>
      <div className="jo-connection-main"><div className="jo-connection-title"><span className="jo-chip">{typeLabel(connection.entityType)}</span><strong>{connection.entity.displayCode} · {connection.entity.title}</strong></div><div className="jo-connection-meta"><span>{targetTypeLabel(connection.targetType)}: {targetLabel(connection)}</span><span>{tt("Status", "Estado")}: {connection.entity.status || tt("Not stated", "No indicado")}</span>{connection.entity.version !== null && <span>{tt("Version", "Versión")}: {connection.entity.version}</span>}<span>{tt("Linked", "Vinculado")}: {new Date(connection.linkedAt).toLocaleString(language === "es" ? "es" : "en")}</span></div>{connection.note && <p>{connection.note}</p>}</div>
      <div className="jo-connection-actions">{canOpenCanonicalRecord(connection.entity) ? <a href={connection.entity.deepLink}><ExternalLink size={14}/> {tt("Open canonical record", "Abrir registro canónico")}</a> : <span className="jo-muted" role="status"><AlertTriangle size={14}/> {tt("Canonical record unavailable", "Registro canónico no disponible")}</span>}{connection.canRemove ? <button type="button" className="danger" aria-label={tt(`Remove ${connection.entity.displayCode} connection`, `Eliminar conexión ${connection.entity.displayCode}`)} disabled={connectionBusy || busy} onClick={() => setConfirmRemoveId(connection.id)}><Trash2 size={14}/> {tt("Remove link", "Eliminar vínculo")}</button> : <span className="jo-muted">{tt("View only", "Solo lectura")}</span>}</div>
      {confirmRemoveId === connection.id && <div className="jo-inline-confirm" role="alert"><p><strong>{tt("Remove this connection?", "¿Eliminar esta conexión?")}</strong> {tt("The canonical document will not be deleted or changed.", "El documento canónico no se eliminará ni cambiará.")}</p><button type="button" onClick={() => setConfirmRemoveId(null)}>{tt("Cancel", "Cancelar")}</button><button type="button" className="danger" disabled={connectionBusy || busy} onClick={() => void runAction(() => api(`/projects/${projectId}/operations/document-connections/${connection.id}`, { method: "DELETE" }), tt("Document connection removed. The canonical record was not changed.", "Conexión eliminada. El registro canónico no cambió."))}>{tt("Remove connection", "Eliminar conexión")}</button></div>}
    </article>)}</div>}
  </section>;
}

export function JobOperationsWorkspace() {
  const { token } = useAuthStore();
  const { language, tt } = useI18n();
  const [, route] = useRoute("/projects/:id/operations");
  const projectId = Number(route?.id);
  const [data, setData] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [packageDrafts, setPackageDrafts] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfSections, setPdfSections] = useState({ summary: true, controls: true, budget: true, work: true });
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new RequestError((language === "es" ? payload?.error?.es : payload?.error?.en) || payload?.error?.en || tt("The request failed.", "La solicitud falló."), response.status, payload?.code || payload?.error?.code);
    return payload;
  }, [headers, language, tt]);
  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true); setError("");
    try {
      const result = await api(`/projects/${projectId}/operations`);
      setData(result);
      setDrafts(Object.fromEntries((result.tasks ?? []).map((task: any) => [task.id, { status: task.status, progressPercent: task.progressPercent, assigneeUserId: task.assigneeUserId ?? "" }])));
      setPackageDrafts(Object.fromEntries((result.packages ?? []).map((item: any) => [item.id, { status: item.status, responsibleUserId: item.responsibleUserId ?? "", dueDate: item.dueDate ?? "" }])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }, [api, projectId]);
  useEffect(() => { void load(); }, [load]);

  const mutate = async (path: string, init: RequestInit, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await api(path, init); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false); }
  };
  const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const tasksFor = (id: string) => data?.tasks?.filter((task: any) => task.workItemId === id) ?? [];
  const assignmentsFor = (id: string) => data?.assignments?.filter((assignment: any) => assignment.workItemId === id) ?? [];
  const taskAssignments = (id: string) => data?.assignments?.filter((assignment: any) => assignment.taskId === id) ?? [];
  const taskDeliverables = (id: string) => data?.deliverables?.filter((item: any) => item.taskId === id) ?? [];
  const packagesFor = (id: string) => data?.packages?.filter((item: any) => item.workItemId === id) ?? [];
  const packageTaskIdsFor = (id: string) => data?.packageTasks?.filter((item: any) => item.packageId === id).map((item: any) => item.taskId) ?? [];
  const statusLabel = (value: string) => ({ not_started: tt("Not started", "No iniciada"), in_progress: tt("In progress", "En progreso"), blocked: tt("Blocked", "Bloqueada"), complete: tt("Complete", "Completada"), cancelled: tt("Cancelled", "Cancelada") } as Record<string, string>)[value] ?? value;
  const deliverableLabel = (value: string) => ({ shop_drawing: tt("Shop drawing", "Plano de taller"), submittal: tt("Submittal", "Submittal"), deliverable: tt("Deliverable", "Entregable"), supporting: tt("Supporting file", "Archivo de apoyo") } as Record<string, string>)[value] ?? value;
  const packageTypeLabel = (value: string) => ({ shop_drawing: tt("Shop drawing", "Plano de taller"), submittal: tt("Submittal", "Submittal"), mixed: tt("Mixed package", "Paquete mixto"), deliverable: tt("Deliverable", "Entregable") } as Record<string, string>)[value] ?? value;
  const packageStatusLabel = (value: string) => ({ draft: tt("Draft", "Borrador"), internal_review: tt("Internal review", "Revisión interna"), submitted: tt("Submitted", "Enviado"), returned: tt("Returned", "Devuelto"), approved: tt("Approved", "Aprobado"), cancelled: tt("Cancelled", "Cancelado") } as Record<string, string>)[value] ?? value;
  const packageStatuses = (value: string) => ({ draft: ["draft", "internal_review", "cancelled"], internal_review: ["draft", "internal_review", "submitted", "returned", "cancelled"], submitted: ["submitted", "returned", "approved", "cancelled"], returned: ["returned", "internal_review", "submitted", "cancelled"], approved: ["approved", "returned", "cancelled"], cancelled: ["cancelled", "draft"] } as Record<string, string[]>)[value] ?? [value];

  const selectedPdfSections = Object.values(pdfSections).filter(Boolean).length;
  const pdfOptions = <div style={{ display: "grid", gap: 8 }}>
    {([
      ["summary", tt("Operational summary", "Resumen operativo")],
      ["controls", tt("Project controls", "Control del proyecto")],
      ["budget", tt("Budget governance", "Gobernanza del presupuesto")],
      ["work", tt("Work items, tasks, and packages", "Partidas, tareas y paquetes")],
    ] as const).map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={pdfSections[key]} onChange={(event) => setPdfSections((current) => ({ ...current, [key]: event.target.checked }))}/><span>{label}</span></label>)}
  </div>;

  const exportOperationsPdf = async () => {
    if (!data || !token || selectedPdfSections === 0) return;
    setExportingPdf(true); setError("");
    try {
      const rows: string[][] = [];
      if (pdfSections.summary) {
        const totals = data.totals ?? {};
        rows.push(
          [tt("Summary", "Resumen"), tt("Planned hours", "Horas planificadas"), `${money(totals.plannedHours)}h`, "—"],
          [tt("Summary", "Resumen"), tt("Actual hours", "Horas reales"), `${money(totals.actualHours)}h`, "—"],
          [tt("Summary", "Resumen"), tt("Work packages", "Paquetes de trabajo"), `${data.packageSummary?.total ?? 0}`, `${data.packageSummary?.overdue ?? 0} ${tt("overdue", "vencidos")}`],
        );
      }
      if (pdfSections.controls) rows.push(
        [tt("Controls", "Control"), "CPI", String(data.projectControls?.summary?.cpi ?? "—"), String(data.projectControls?.summary?.status ?? "—")],
        [tt("Controls", "Control"), "EAC / ETC / VAC", `${data.projectControls?.summary?.eac ?? "—"} / ${data.projectControls?.summary?.etc ?? "—"} / ${data.projectControls?.summary?.vac ?? "—"}`, "—"],
      );
      if (pdfSections.budget) rows.push(
        [tt("Budget", "Presupuesto"), tt("Baseline", "Línea base"), String(data.budgetGovernance?.baseline?.version ?? tt("Not frozen", "No congelada")), String(data.budgetGovernance?.status ?? "—")],
      );
      if (pdfSections.work) {
        for (const item of data.workItems ?? []) {
          rows.push([tt("Work item", "Partida"), item.name, `${money(item.plannedHours)}h`, item.description || "—"]);
          for (const task of tasksFor(item.id)) rows.push([tt("Task", "Tarea"), language === "es" ? task.nameEs : task.nameEn, `${task.progressPercent}%`, statusLabel(task.status)]);
          for (const pkg of packagesFor(item.id)) rows.push([tt("Package", "Paquete"), `${pkg.packageCode} · ${pkg.title}`, `${pkg.progressPercent}%`, packageStatusLabel(pkg.status)]);
        }
      }
      await downloadGovernedCurrentViewPdf(projectId, token, {
        surface: "job-operations", lang: language,
        context: [`${tt("Project", "Proyecto")}: ${data.project?.name ?? projectId}`, `${tt("Included sections", "Secciones incluidas")}: ${Object.entries(pdfSections).filter(([, value]) => value).map(([key]) => key).join(", ")}`],
        columns: [tt("Section", "Sección"), tt("Record", "Registro"), tt("Value", "Valor"), tt("Status / detail", "Estado / detalle")], rows,
        emptyMessage: tt("No selected Job Operations information is available.", "No hay información seleccionada de Operaciones."),
      }, `${data.project?.code ?? `project-${projectId}`}-job-operations.pdf`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tt("The Job Operations PDF could not be generated.", "No se pudo generar el PDF de Operaciones.")); }
    finally { setExportingPdf(false); }
  };

  if (!data) return <FinancialProjectShell projectId={projectId} activeTab="operations"><style>{css}</style><main className="jo">{busy ? <p className="jo-loading" role="status"><RefreshCw size={15}/>{tt("Loading job operations…", "Cargando operaciones del trabajo…")}</p> : <div className="jo-error" role="alert"><AlertTriangle size={16}/>{error || tt("Job Operations is unavailable.", "Operaciones no está disponible.")}<div className="jo-actions"><button type="button" onClick={() => void load()}><RefreshCw size={14}/>{tt("Try again", "Intentar de nuevo")}</button></div></div>}</main></FinancialProjectShell>;
  const total = data.totals ?? {};
  const remaining = Math.max(0, n(total.plannedHours) - n(total.actualHours));
  const progress = data.tasks?.length ? Math.round(data.tasks.reduce((sum: number, task: any) => sum + n(task.progressPercent), 0) / data.tasks.length) : 0;
  return <FinancialProjectShell projectId={projectId} activeTab="operations"><style>{css}</style><main className="jo">
    <header className="jo-head"><div><span className="jo-chip">{tt("COMMAND", "COMANDO")}</span><h1>{tt("Job Operations", "Operaciones del Trabajo")}</h1><p>{tt("Run activated work, assign people, record actual hours, and connect project deliverables.", "Ejecute el trabajo activado, asigne personas, registre horas reales y conecte los entregables del proyecto.")}</p></div><div className="jo-head-actions"><PrintPdfButton lang={language} selectionMode loading={exportingPdf} disabled={!token} disabledReason={selectedPdfSections === 0 ? tt("Select at least one PDF section.", "Seleccione al menos una sección del PDF.") : undefined} configurationInvalid={selectedPdfSections === 0} options={pdfOptions} currentViewSummary={[`${tt("Project", "Proyecto")}: ${data.project?.name ?? projectId}`]} onClick={() => void exportOperationsPdf()}/><button className="jo-refresh" disabled={busy} onClick={() => void load()}><RefreshCw size={15}/>{tt("Refresh", "Actualizar")}</button></div></header>
    {error && <div className="jo-error" role="alert">{error}</div>}{notice && <div className="jo-ok">{notice}</div>}
    {!data.available && <div className="jo-empty"><BriefcaseBusiness size={22}/><h2>{tt("Activate Job Intake first", "Primero active el Ingreso del Trabajo")}</h2><p>{tt("Job Operations begins with the work items, tasks, and assignments created by an activated Intake.", "Operaciones del Trabajo comienza con las partidas, tareas y asignaciones creadas por un Ingreso activado.")}</p><Link href={`/projects/${projectId}/intake`}>{tt("Open Job Intake & Setup", "Abrir Ingreso y Configuración del Trabajo")}</Link></div>}
    {data.available && <>
      <section className="jo-summary"><div className="jo-stat"><strong>{money(total.plannedHours)}h</strong><span>{tt("Planned hours", "Horas planificadas")}</span></div><div className="jo-stat"><strong>{money(total.actualHours)}h</strong><span>{tt("Actual hours", "Horas reales")}</span></div><div className="jo-stat"><strong>{money(remaining)}h</strong><span>{tt("Remaining", "Restantes")}</span></div><div className="jo-stat"><strong>{progress}%</strong><span>{tt("Task progress", "Progreso de tareas")}</span></div><div className="jo-stat"><strong>{data.packageSummary?.total ?? 0}</strong><span>{tt("Work packages", "Paquetes de trabajo")}</span></div><div className="jo-stat"><strong>{data.packageSummary?.overdue ?? 0}</strong><span>{tt("Overdue packages", "Paquetes vencidos")}</span></div><div className="jo-stat"><strong>{data.packageSummary?.blocked ?? 0}</strong><span>{tt("Packages with blockers", "Paquetes con bloqueos")}</span></div><div className="jo-stat"><strong>{data.packageSummary?.approved ?? 0}</strong><span>{tt("Approved packages", "Paquetes aprobados")}</span></div>{data.capabilities?.budget && <><div className="jo-stat jo-financial"><strong>{money(total.plannedInternalCost)}</strong><span>{tt("Planned internal cost", "Costo interno planificado")}</span></div><div className="jo-stat jo-financial"><strong>{money(total.actualInternalCost)}</strong><span>{tt("Actual internal cost", "Costo interno real")}</span></div></>}{data.capabilities?.cost_value_planner && <><div className="jo-stat jo-financial"><strong>{money(total.plannedBillableValue)}</strong><span>{tt("Planned billable value", "Valor facturable planificado")}</span></div><div className="jo-stat jo-financial"><strong>{money(total.earnedBillableValue)}</strong><span>{tt("Earned billable value", "Valor facturable ganado")}</span></div></>}</section>
      <DocumentConnectionsPanel data={data} projectId={projectId} language={language} tt={tt} api={api} reload={load} busy={busy}/>
      <ProjectControlsDashboard controls={data.projectControls} members={data.members ?? []} packages={data.packages ?? []} projectId={projectId} token={token}/>
      <BudgetGovernancePanel projectId={projectId} governance={data.budgetGovernance} canManage={data.canManage} busy={busy} mutate={mutate}/>
      {data.workItems.map((item: any) => <section className="jo-card" key={item.id}><div className="jo-item-head"><div><h2>{item.name}</h2><p>{item.description || tt("Activated scope item", "Partida de alcance activada")}</p></div><div><span className="jo-chip">{money(item.plannedHours)}h</span>{data.capabilities?.cost_value_planner && <span className="jo-chip">{money(item.plannedBillableValue)}</span>}</div></div>
        {assignmentsFor(item.id).length > 0 && <div className="jo-sub"><h4>{tt("Resource plan", "Plan de recursos")}</h4><div style={{overflow:"auto"}}><table className="jo-table"><thead><tr><th>{tt("Person", "Persona")}</th><th>{tt("Role", "Rol")}</th><th>{tt("Planned", "Planificadas")}</th><th>{tt("Actual", "Reales")}</th>{data.capabilities?.budget && <th>{tt("Internal cost", "Costo interno")}</th>}{data.canManage && <th>{tt("Reassign", "Reasignar")}</th>}</tr></thead><tbody>{assignmentsFor(item.id).map((assignment: any) => <tr key={assignment.id}><td>{assignment.personName || "—"}</td><td>{assignment.role}</td><td>{money(assignment.plannedHours)}h</td><td>{money(assignment.actualHours)}h</td>{data.capabilities?.budget && <td>{money(assignment.plannedInternalCost)}</td>}{data.canManage && <td><select aria-label={tt("Reassign resource", "Reasignar recurso")} value={assignment.userId ?? ""} onChange={(event) => void mutate(`/projects/${projectId}/operations/assignments/${assignment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: assignment.version, userId: Number(event.target.value) }) }, tt("Resource reassigned.", "Recurso reasignado."))}>{data.members.map((member: any) => <option key={member.id} value={member.id}>{member.fullName || member.email}</option>)}</select></td>}</tr>)}</tbody></table></div></div>}
        <div className="jo-sub"><h4><ClipboardCheck size={15}/> {tt("Work packages", "Paquetes de trabajo")}</h4><p className="jo-muted">{tt("Group activated tasks into controlled shop-drawing or submittal packages. Progress is calculated from the linked tasks.", "Agrupe tareas activadas en paquetes controlados de planos de taller o submittals. El progreso se calcula desde las tareas vinculadas.")}</p>
          {data.canManage && <form className="jo-package-create" onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);void mutate(`/projects/${projectId}/operations/packages`,json({packageId:crypto.randomUUID(),workItemId:item.id,packageCode:form.get("packageCode"),title:form.get("title"),description:form.get("description"),packageType:form.get("packageType"),responsibleUserId:form.get("responsibleUserId")||null,dueDate:form.get("dueDate")||null,taskIds:form.getAll("taskIds").map(String)}),tt("Work package created.","Paquete de trabajo creado."));}}><div className="jo-grid"><label>{tt("Package code", "Código del paquete")}<input required name="packageCode" maxLength={50} placeholder="WP-001"/></label><label>{tt("Title", "Título")}<input required name="title" maxLength={160}/></label><label>{tt("Type", "Tipo")}<select name="packageType">{["shop_drawing","submittal","mixed","deliverable"].map(value=><option key={value} value={value}>{packageTypeLabel(value)}</option>)}</select></label><label>{tt("Responsible", "Responsable")}<select name="responsibleUserId"><option value="">{tt("Unassigned", "Sin asignar")}</option>{data.members.map((member:any)=><option key={member.id} value={member.id}>{member.fullName||member.email}</option>)}</select></label><label>{tt("Due date", "Fecha límite")}<input name="dueDate" type="date"/></label></div><label>{tt("Description", "Descripción")}<textarea name="description" maxLength={2000}/></label><div className="jo-checks">{tasksFor(item.id).map((task:any)=><label className="jo-check" key={task.id}><input required={tasksFor(item.id).length===1} type="checkbox" name="taskIds" value={task.id}/><span>{language==="es"?task.nameEs:task.nameEn}</span></label>)}</div><button className="primary" disabled={busy}><PackagePlus size={15}/> {tt("Create package", "Crear paquete")}</button></form>}
          {packagesFor(item.id).length===0 && <div className="jo-empty">{tt("No work packages yet.", "Todavía no hay paquetes de trabajo.")}</div>}
          <div className="jo-package-list">{packagesFor(item.id).map((pkg:any)=>{const draft=packageDrafts[pkg.id]??pkg;const linked=packageTaskIdsFor(pkg.id);return <article className={`jo-package${pkg.overdue?" overdue":""}`} key={pkg.id}><div className="jo-package-head"><div><span className="jo-chip">{pkg.packageCode}</span><span className="jo-chip">{packageTypeLabel(pkg.packageType)}</span>{pkg.overdue&&<span className="jo-chip warn"><AlertTriangle size={12}/> {tt("Overdue", "Vencido")}</span>}<h3>{pkg.title}</h3></div><strong>{pkg.progressPercent}%</strong></div><div className="jo-progress"><span style={{width:`${pkg.progressPercent}%`}}/></div><div className="jo-package-meta"><span><ClipboardCheck size={13}/> {packageStatusLabel(pkg.status)}</span><span><UserRoundCheck size={13}/> {pkg.responsibleName||tt("Unassigned", "Sin asignar")}</span><span><CalendarClock size={13}/> {pkg.dueDate||tt("No due date", "Sin fecha")}</span><span>{pkg.completedCount}/{pkg.taskCount} {tt("tasks complete", "tareas completas")}</span>{Number(pkg.blockedCount)>0&&<span className="jo-chip warn">{pkg.blockedCount} {tt("blocked", "bloqueadas")}</span>}</div>{pkg.description&&<p>{pkg.description}</p>}<div className="jo-checks">{linked.map((taskId:string)=>{const task=tasksFor(item.id).find((candidate:any)=>candidate.id===taskId);return task?<span className="jo-chip" key={taskId}>{language==="es"?task.nameEs:task.nameEn}</span>:null;})}</div>{pkg.canControl&&<div className="jo-package-edit"><label>{tt("Package status", "Estado del paquete")}<select value={draft.status} onChange={(event)=>setPackageDrafts(old=>({...old,[pkg.id]:{...draft,status:event.target.value}}))}>{packageStatuses(pkg.status).map(value=><option key={value} value={value}>{packageStatusLabel(value)}</option>)}</select></label>{data.canManage&&<><label>{tt("Responsible", "Responsable")}<select value={draft.responsibleUserId??""} onChange={(event)=>setPackageDrafts(old=>({...old,[pkg.id]:{...draft,responsibleUserId:event.target.value}}))}><option value="">{tt("Unassigned", "Sin asignar")}</option>{data.members.map((member:any)=><option key={member.id} value={member.id}>{member.fullName||member.email}</option>)}</select></label><label>{tt("Due date", "Fecha límite")}<input type="date" value={draft.dueDate??""} onChange={(event)=>setPackageDrafts(old=>({...old,[pkg.id]:{...draft,dueDate:event.target.value}}))}/></label></>}<button className="primary" disabled={busy} onClick={()=>void mutate(`/projects/${projectId}/operations/packages/${pkg.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:pkg.version,status:draft.status,...(data.canManage?{responsibleUserId:draft.responsibleUserId?Number(draft.responsibleUserId):null,dueDate:draft.dueDate||null}:{})})},tt("Work package updated.","Paquete de trabajo actualizado."))}><Save size={14}/> {tt("Save package", "Guardar paquete")}</button></div>}</article>;})}</div>
        </div>
        {tasksFor(item.id).map((task: any) => { const draft = drafts[task.id] ?? task; return <article className="jo-task" key={task.id}><div className="jo-task-head"><div><h3>{language === "es" ? task.nameEs : task.nameEn}</h3><span className="jo-muted">{statusLabel(task.status)} · {money(task.actualHours)} / {money(task.plannedHours)}h · {task.deliverableCount} {tt("files", "archivos")}</span></div><strong>{task.progressPercent}%</strong></div><div className="jo-progress"><span style={{width:`${task.progressPercent}%`}}/></div>
          <div className="jo-grid" style={{marginTop:10}}><label>{tt("Status", "Estado")}<select disabled={!task.canControl} value={draft.status} onChange={(e)=>setDrafts(old=>({...old,[task.id]:{...draft,status:e.target.value}}))}>{["not_started","in_progress","blocked","complete","cancelled"].map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label>{tt("Progress", "Progreso")}<input disabled={!task.canControl} type="number" min="0" max="100" step="1" value={draft.progressPercent} onChange={(e)=>setDrafts(old=>({...old,[task.id]:{...draft,progressPercent:Number(e.target.value)}}))}/></label><label>{tt("Assignee", "Responsable")}<select disabled={!data.canManage} value={draft.assigneeUserId ?? ""} onChange={(e)=>setDrafts(old=>({...old,[task.id]:{...draft,assigneeUserId:e.target.value}}))}><option value="">{tt("Unassigned", "Sin asignar")}</option>{data.members.map((member:any)=><option key={member.id} value={member.id}>{member.fullName || member.email}</option>)}</select></label><div className="jo-actions"><button className="primary" disabled={busy || !task.canControl} onClick={()=>void mutate(`/projects/${projectId}/operations/tasks/${task.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:task.version,status:draft.status,progressPercent:draft.progressPercent,assigneeUserId:draft.assigneeUserId?Number(draft.assigneeUserId):null})},tt("Task updated.","Tarea actualizada."))}><Save size={14}/>{tt("Save task", "Guardar tarea")}</button></div></div>
          <div className="jo-forms"><form className="jo-form" onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);void mutate(`/projects/${projectId}/operations/time`,json({entryId:crypto.randomUUID(),taskId:task.id,assignmentId:form.get("assignmentId")||null,workDate:form.get("workDate"),hours:form.get("hours"),note:form.get("note")}),tt("Actual hours recorded.","Horas reales registradas."));}}><h4><Clock3 size={15}/> {tt("Record actual hours", "Registrar horas reales")}</h4><div className="jo-grid"><label>{tt("Assignment", "Asignación")}<select disabled={!task.canControl} name="assignmentId"><option value="">{tt("Task assignee", "Responsable de la tarea")}</option>{taskAssignments(task.id).map((a:any)=><option key={a.id} value={a.id}>{a.personName}</option>)}</select></label><label>{tt("Date", "Fecha")}<input disabled={!task.canControl} required name="workDate" type="date" defaultValue={today()}/></label><label>{tt("Hours", "Horas")}<input disabled={!task.canControl} required name="hours" type="number" min="0.01" max="24" step="0.01"/></label></div><label>{tt("Work note", "Nota del trabajo")}<textarea disabled={!task.canControl} name="note" maxLength={500}/></label><button className="primary" disabled={busy || !task.canControl}>{tt("Add time", "Agregar horas")}</button></form>
          <form className="jo-form" onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);void mutate(`/projects/${projectId}/operations/deliverables`,json({linkId:crypto.randomUUID(),taskId:task.id,fileId:Number(form.get("fileId")),deliverableType:form.get("deliverableType"),note:form.get("note")}),tt("Project file linked.","Archivo del proyecto vinculado."));}}><h4><FileCheck2 size={15}/> {tt("Connect deliverable", "Conectar entregable")}</h4><div className="jo-grid"><label>{tt("Project file", "Archivo del proyecto")}<select disabled={!task.canControl} required name="fileId"><option value="">{tt("Choose file", "Seleccione un archivo")}</option>{data.files.map((file:any)=><option key={file.id} value={file.id}>{file.fileName}</option>)}</select></label><label>{tt("Type", "Tipo")}<select disabled={!task.canControl} name="deliverableType">{["shop_drawing","submittal","deliverable","supporting"].map(value=><option key={value} value={value}>{deliverableLabel(value)}</option>)}</select></label></div><label>{tt("Link note", "Nota del vínculo")}<textarea disabled={!task.canControl} name="note" maxLength={500}/></label><button className="primary" disabled={busy || !task.canControl}>{tt("Link file", "Vincular archivo")}</button>{taskDeliverables(task.id).map((link:any)=><div className="jo-file" key={link.id}><span><UserRoundCheck size={13}/> {link.fileName} · {deliverableLabel(link.deliverableType)}</span>{link.canRemove && <button type="button" className="danger" aria-label={tt("Remove link", "Eliminar vínculo")} onClick={()=>void mutate(`/projects/${projectId}/operations/deliverables/${link.id}`,{method:"DELETE"},tt("Link removed.","Vínculo eliminado."))}><Trash2 size={13}/></button>}</div>)}</form></div>
        </article>; })}
      </section>)}
    </>}
  </main></FinancialProjectShell>;
}
