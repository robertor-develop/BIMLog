import { useState, useEffect, useRef, Fragment } from "react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Upload, ChevronLeft, AlertTriangle, Download, Trash2 } from "lucide-react";
import { isDebug } from "@/lib/debug";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { LensViewpointsView } from "./LensViewpointsView";
import { downloadAuthenticatedPdf, downloadGovernedCurrentViewPdf, PrintPdfButton } from "@/components/PrintPdfButton";

const API = "/api/v1";
type ClashUploadReceipt={projectId:number;id:number;ids:number[];total:number};

interface ClashReport {
  id: number; projectId:number; fileName: string; format: string; totalClashes: number;
  p1Count: number; p2Count: number; p3Count: number; p4Count: number;
  status: string; aiSummary?: string; createdAt: string; reportNumber?: string;
}

interface Clash {
  id: number; clashIdOriginal?: string; description?: string;
  element1?: string; element2?: string; discipline1?: string;
  discipline2?: string; gridLocation?: string; level?: string;
  priority?: string; priorityReason?: string; status: string;
  assignedToName?: string; resolutionNotes?: string;
  viewpoint?: string;
  deadline?: string;
  dueDate?: string | null;
  floor?: string;
}

const P_COLORS: Record<string, { bg: string; text: string }> = {
  P1: { bg: "#FEE2E2", text: "#DC2626" },
  P2: { bg: "#FEF3C7", text: "#D97706" },
  P3: { bg: "#FEF9C3", text: "#CA8A04" },
  P4: { bg: "#F3F4F6", text: "#6B7280" },
};

function PBadge({ p }: { p?: string }) {
  const c = P_COLORS[p ?? ""] ?? { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11,
      fontWeight: 700, background: c.bg, color: c.text }}>
      {p ?? "—"}
    </span>
  );
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "#FEE2E2", text: "#DC2626", label: "Active" },
  follow_up: { bg: "#FEF3C7", text: "#D97706", label: "Follow Up" },
  waiting_design: { bg: "#EDE9FE", text: "#7C3AED", label: "Waiting Design" },
  in_progress: { bg: "#DBEAFE", text: "#1D4ED8", label: "In Progress" },
  approved: { bg: "#D1FAE5", text: "#059669", label: "Approved" },
  resolved: { bg: "#DCFCE7", text: "#16A34A", label: "Resolved" },
  wont_fix: { bg: "#F3F4F6", text: "#6B7280", label: "Won't Fix" },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_STYLE[status || "open"] ?? STATUS_STYLE.open;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function fmtUpdated(v: any): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime()) || String(v).startsWith("1970")) return "—";
  return d.toLocaleDateString();
}

function clashStatusLabel(status: string, t: (en: string, es: string) => string) {
  const labels: Record<string, string> = {
    all: t("All statuses", "Todos los estados"),
    open: t("Active", "Activo"),
    follow_up: t("Follow Up", "Seguimiento"),
    waiting_design: t("Waiting Design", "Esperando Diseno"),
    in_progress: t("In Progress", "En Progreso"),
    approved: t("Approved", "Aprobado"),
    resolved: t("Resolved", "Resuelto"),
    wont_fix: t("Won't Fix", "No se corregira"),
  };
  return labels[status] || status.replace(/_/g, " ");
}

export function ClashReportsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { token,user } = useAuthStore();
  const creationStorageKey=`clashReportCreateAttempt:${projectId}:${user?.id??"unknown"}`;
  const { lang } = useI18n();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const headers = { Authorization: `Bearer ${token}` };
  const fileRef = useRef<HTMLInputElement>(null);

  const [reports, setReports] = useState<ClashReport[]>([]);
  const [deleteClash, setDeleteClash] = useState<{ id: number; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadReceipt,setUploadReceipt]=useState<ClashUploadReceipt|null>(null);
  const uploadTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(()=>{setUploading(false);setUploadReceipt(null);setUploadMsg("");return()=>{uploadTimers.current.forEach(clearTimeout);uploadTimers.current=[];};},[projectId,token]);
  const [error, setError] = useState("");
  const scope = useRef(0);
  const mutationLock = useRef(false);
  const [mutating, setMutating] = useState(false);
  const [receipt, setReceipt] = useState("");
  const createAttempt=useRef<{projectId:number;key:string;saved:ClashReport|null}|null>(null);
  const listRequest=useRef(0);
  const mutateReport = async (url: string, method: string, body?: unknown) => {
    if (!canWrite || mutationLock.current) return null;
    const current = scope.current;
    mutationLock.current = true; setMutating(true); setError(""); setReceipt("");
    try {
      const response = await fetch(url, {method, headers: {...headers,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
      if (current !== scope.current) return null;
      if (!response.ok) throw new Error("Rejected mutation");
      const saved = await response.json();
      if (current !== scope.current) return null;
      setReceipt(t("Saved response confirmed. Reload to verify the current record.","Respuesta guardada confirmada. Recargue para verificar el registro actual."));
      return saved;
    } catch (failure) {
      if (current === scope.current) {setError(t("Change could not be confirmed. Reload saved records before retrying.","No se pudo confirmar el cambio. Recargue registros guardados antes de reintentar."));setReceipt("");}
      return null;
    } finally {if(current===scope.current){mutationLock.current=false;setMutating(false);}}
  };
  const [selectedReport, setSelectedReport] = useState<ClashReport | null>(null);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [clashLoading, setClashLoading] = useState(false);
  const [clashExporting, setClashExporting] = useState(false);
  const [listExporting, setListExporting] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [clashLinks, setClashLinks] = useState<Record<number, any[]>>({});
  const [linkableItems, setLinkableItems] = useState<{ submittalItems: any[]; rfis: any[]; meetings: any[] }>({ submittalItems: [], rfis: [], meetings: [] });
  const [viewMode, setViewMode] = useState<"normal" | "grouped">("normal");
  const [deleteReport, setDeleteReport] = useState<{ id: number; label: string } | null>(null);
  // Persist the active sub-tab so a page refresh keeps the user on the tab they
  // were viewing (Clash Hits vs Lens Viewpoints), scoped per project.
  const tabStorageKey = `clashReportsTab:${projectId}`;
  const readSavedTab = (key: string): "clash" | "lens" => {
    try {
      const saved = localStorage.getItem(key);
      return saved === "lens" || saved === "clash" ? saved : "clash";
    } catch {
      return "clash";
    }
  };
  const requestedLensId = Number(new URLSearchParams(window.location.search).get("viewpoint"));
  const requestedLensView = new URLSearchParams(window.location.search).get("view") === "lens";
  const [activeTab, setActiveTab] = useState<"clash" | "lens">(() => requestedLensView ? "lens" : readSavedTab(tabStorageKey));
  // Rehydrate when the project changes (the component instance can be reused
  // across projects, so the lazy initializer alone is not enough).
  useEffect(() => {
    setActiveTab(requestedLensView ? "lens" : readSavedTab(tabStorageKey));
  }, [tabStorageKey]);
  // Persist on explicit user selection (not via an effect) to avoid writing a
  // stale tab into the new project's key during a project switch.
  const selectTab = (k: "clash" | "lens") => {
    setActiveTab(k);
    try {
      localStorage.setItem(tabStorageKey, k);
    } catch {
      /* storage unavailable — selection still applies for this session */
    }
  };

  const loadLinkableItems = async () => {
    const current=scope.current;
    try {
      const [siRes, rfiRes, meetRes] = await Promise.all([
        fetch(`${API}/projects/${projectId}/submittal-reports`, { headers }),
        fetch(`${API}/projects/${projectId}/rfis`, { headers }),
        fetch(`${API}/projects/${projectId}/meetings`, { headers }),
      ]);
      const submittalReports = siRes.ok ? await siRes.json() : [];
      const rfis = rfiRes.ok ? await rfiRes.json() : [];
      const meetings = meetRes.ok ? await meetRes.json() : [];
      if(current===scope.current)setLinkableItems({ submittalItems: submittalReports, rfis: Array.isArray(rfis) ? rfis : rfis.rfis ?? [], meetings: Array.isArray(meetings) ? meetings : [] });
    } catch (e) {
      console.error("[loadLinkableItems]", e);
    }
  };

  const loadClashLinks = async (clashId: number) => {
    const current=scope.current;
    const r = await fetch(`${API}/projects/${projectId}/links/clash/${clashId}`, { headers });
    if (r.ok) {
      const links = await r.json();
      if(current===scope.current)setClashLinks(prev => ({ ...prev, [clashId]: links }));
    }
  };

  const addClashLink = async (clashId: number, toType: string, toId: number, linkType: string) => {
    const r = await fetch(`${API}/projects/${projectId}/links`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ fromType: "clash", fromId: clashId, toType, toId, linkType }),
    });
    if (r.ok) loadClashLinks(clashId);
  };

  const loadReports = async (expectedId?:number) => {
    const current = scope.current;
    const request=++listRequest.current;
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports`, { headers });
      if (!r.ok) {if(current===scope.current&&request===listRequest.current&&[401,403].includes(r.status)){setSelectedReport(null);setClashes([]);setClashLinks({});}throw new Error("Reports unavailable");}
      const saved=await r.json();if(!Array.isArray(saved)||!saved.every((row:ClashReport)=>Number.isSafeInteger(row.id)&&row.projectId===projectId)||(expectedId!==undefined&&!saved.some((row:ClashReport)=>row.id===expectedId)))throw new Error("Invalid or missing saved report");
      if(current!==scope.current||request!==listRequest.current)return false;
      setReports(saved);setError("");return true;
    } catch(failure) {if(current===scope.current&&request===listRequest.current){setReports([]);setError(t("Reports could not be loaded. Retry saved records.","No se pudieron cargar los reportes. Reintente registros guardados."));}return false;}
    finally { if(current===scope.current&&request===listRequest.current)setLoading(false); }
  };

  const createReport=async()=>{
    if(!canWrite||mutationLock.current)return;const current=scope.current;mutationLock.current=true;setMutating(true);setError("");setReceipt("");
    try{
      if(!createAttempt.current||createAttempt.current.projectId!==projectId){createAttempt.current={projectId,key:crypto.randomUUID(),saved:null};try{sessionStorage.setItem(creationStorageKey,createAttempt.current.key);}catch{/* Active-tab recovery still retains the key in memory. */}}
      const attempt=createAttempt.current;
      if(!attempt.saved){const response=await fetch(`${API}/projects/${projectId}/clash-reports`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({fileName:"New Manual Report",clientRequestId:attempt.key})});const saved=await response.json().catch(()=>({}));if(current!==scope.current)return;if(!response.ok)throw new Error([401,403].includes(response.status)?"access_denied":saved.message||saved.error||"Create rejected");if(!Number.isSafeInteger(saved.id)||saved.id<=0||saved.projectId!==projectId)throw new Error("Invalid saved report receipt");attempt.saved=saved;}
      const saved=attempt.saved!;
      if(!await loadReports(saved.id))throw new Error("Saved list unavailable");
      const response=await fetch(`${API}/projects/${projectId}/clash-reports/${saved.id}`,{headers});const details=await response.json().catch(()=>({}));if(current!==scope.current)return;
      if(!response.ok||details.report?.id!==saved.id||details.report?.projectId!==projectId||!Array.isArray(details.clashes)||!details.clashes.every((row:Clash)=>Number.isSafeInteger(row.id)))throw new Error("Saved report unavailable");
      setSelectedReport(details.report);setClashes(details.clashes);selectTab("clash");const url=new URL(window.location.href);url.searchParams.set("report",String(saved.id));url.searchParams.delete("clash");window.history.replaceState(window.history.state,"",url);createAttempt.current=null;try{sessionStorage.removeItem(creationStorageKey);}catch{/* A verified server receipt remains authoritative. */}setReceipt(t("Created report saved and reopened.","Reporte creado, guardado y reabierto."));
    }catch(failure){if(current===scope.current){setError(failure instanceof Error&&failure.message==="access_denied"?t("Creation or recovery denied. Restore your current session and project write access before retrying.","Creación o recuperación denegada. Restaure la sesión y el acceso de escritura del proyecto antes de reintentar."):t("New report could not be fully verified. Use Recover new report to reopen the same creation attempt.","No se verificó completamente el reporte nuevo. Use Recuperar reporte nuevo para reabrir el mismo intento."));setReceipt("");}}
    finally{if(current===scope.current){mutationLock.current=false;setMutating(false);}}
  };

  useEffect(() => { scope.current++;mutationLock.current=false;createAttempt.current=null;try{const key=sessionStorage.getItem(creationStorageKey);if(key&&/^[0-9a-f-]{36}$/i.test(key))createAttempt.current={projectId,key,saved:null};}catch{/* Storage is optional; server authorization remains required. */}setMutating(false);setSelectedReport(null);setReports([]);setClashes([]);setClashLinks({});setLinkableItems({submittalItems:[],rfis:[],meetings:[]});setError("");setReceipt("");void loadReports();return()=>{scope.current++;}; }, [projectId,token,user?.id]);

  // Stable deep-link used by Meeting Minutes. The report and Clash are resolved
  // by database IDs; displayed clash numbers are never used as identity.
  useEffect(() => {
    if (selectedReport || reports.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const reportId = Number(params.get("report"));
    if (!Number.isInteger(reportId)) return;
    const report = reports.find(item => item.id === reportId);
    if (report) { selectTab("clash"); void loadClashes(report); }
  }, [reports, selectedReport]);

  useEffect(() => {
    const clashId = Number(new URLSearchParams(window.location.search).get("clash"));
    if (!Number.isInteger(clashId) || clashLoading) return;
    const element = document.querySelector(`[data-clash-id="${clashId}"]`) as HTMLElement | null;
    if (element) { element.scrollIntoView({ block: "center" }); element.style.outline = "3px solid #2563EB"; }
  }, [clashes, clashLoading]);

  async function loadClashes(report: ClashReport) {
    const current=scope.current;
    loadLinkableItems();
    setSelectedReport(report);
    setClashLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/${report.id}`, { headers });
      if (!r.ok) throw new Error("Report unavailable");
      const data=await r.json();if(data.report?.id!==report.id||data.report?.projectId!==projectId||!Array.isArray(data.clashes))throw new Error("Invalid report details");
      if(current!==scope.current)return;setClashes(data.clashes);setSelectedReport(data.report);setError("");
      if(!await loadReports(report.id))throw new Error("Saved report list unavailable");
    } catch(failure) {if(current===scope.current){setClashes([]);setError(t("Report details could not be verified. Reload saved records.","No se pudieron verificar los detalles. Recargue registros guardados."));}}
    finally { if(current===scope.current)setClashLoading(false); }
  }

  const verifyUpload=async(saved:ClashUploadReceipt,current:number,poll=true)=>{
    if(!await loadReports(saved.id))throw new Error("Saved import list unavailable");
    const response=await fetch(`${API}/projects/${projectId}/clash-reports/${saved.id}`,{headers});const data=await response.json().catch(()=>({}));if(current!==scope.current)return;
    if(!response.ok||data.report?.id!==saved.id||data.report?.projectId!==projectId||!Array.isArray(data.clashes)||!saved.ids.every(id=>data.clashes.some((row:{id:number;projectId:number})=>row.id===id&&row.projectId===projectId)))throw new Error("Saved imported identities unavailable");
    setUploadReceipt(null);
    setUploadMsg(t(`Import verified: ${saved.total} ${saved.total===1?"record":"records"}. ${data.report.status==="complete"?"Ranking complete.":data.report.status==="ranking_failed"?"Ranking failed; open the saved report and retry Re-rank AI.":"Ranking pending at last check; refresh saved records."}`,`Importación verificada: ${saved.total} ${saved.total===1?"registro":"registros"}. ${data.report.status==="complete"?"Clasificación completa.":data.report.status==="ranking_failed"?"Clasificación fallida; abra el reporte y reintente Reclasificar con IA.":"Clasificación pendiente en la última revisión; recargue registros."}`));
    if(data.report.status==="ranking_failed")setError(t("Imported records are saved, but ranking failed. Review the report and retry Re-rank AI.","Los registros están guardados, pero falló la clasificación. Revise el reporte y reintente Reclasificar con IA."));
    if(poll&&data.report.status==="processing"){uploadTimers.current.forEach(clearTimeout);uploadTimers.current=[5000,12000].map(ms=>setTimeout(()=>{if(current===scope.current)void verifyUpload(saved,current,false).catch(()=>{if(current===scope.current){setUploadReceipt(saved);setError(t("Saved import could not be reopened. Use Verify uploaded report; it does not upload again.","No se pudo reabrir la importación. Use Verificar reporte importado; no vuelve a subir el archivo."));}});},ms));}
  };

  const verifyPendingUpload=async()=>{
    if(!uploadReceipt||mutationLock.current)return;const current=scope.current;mutationLock.current=true;setUploading(true);setError("");
    try{await verifyUpload(uploadReceipt,current);}catch(failure){if(current===scope.current)setError(t("Saved import could not be reopened. Use Verify uploaded report; it does not upload again.","No se pudo reabrir la importación. Use Verificar reporte importado; no vuelve a subir el archivo."));}
    finally{if(current===scope.current){mutationLock.current=false;setUploading(false);}}
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0];if(!file||!canWrite||mutationLock.current||uploadReceipt)return;
    const current=scope.current;mutationLock.current=true;uploadTimers.current.forEach(clearTimeout);uploadTimers.current=[];
    setUploading(true);setError("");setUploadMsg(t("Uploading clash register…","Subiendo registro de choques…"));
    let saved:ClashUploadReceipt|null=null;
    try{
      const formData=new FormData();formData.append("file",file);
      const response=await fetch(`${API}/projects/${projectId}/clash-reports/upload`,{method:"POST",headers,body:formData});const data=await response.json().catch(()=>({}));if(current!==scope.current)return;
      if(!response.ok)throw new Error(data.message||data.error||t("Upload rejected. Inspect saved records before retrying.","Carga rechazada. Revise registros antes de reintentar."));
      if(data.projectId!==projectId||!Number.isSafeInteger(data.clash_report_id)||!Number.isInteger(data.total_parsed)||data.total_parsed<=0||!Array.isArray(data.clash_ids)||data.clash_ids.length!==data.total_parsed||new Set(data.clash_ids).size!==data.clash_ids.length||!data.clash_ids.every((id:number)=>Number.isSafeInteger(id)&&id>0))throw new Error(t("Invalid import receipt. Inspect saved records before uploading again.","Comprobante de importación inválido. Revise registros antes de volver a subir."));
      saved={projectId,id:data.clash_report_id,ids:data.clash_ids,total:data.total_parsed};setUploadReceipt(saved);setUploadMsg("");await verifyUpload(saved,current);
    }catch(failure){if(current===scope.current){setUploadMsg("");setError(saved?t("Import saved, but its records could not be reopened. Use Verify uploaded report before another upload.","Importación guardada, pero no se reabrieron los registros. Use Verificar reporte importado antes de otra carga."):failure instanceof Error?failure.message:String(failure));}}
    finally{if(current===scope.current){mutationLock.current=false;setUploading(false);event.target.value="";}}
  };

  const updateClash = async (clashId: number, updates: Partial<Clash>) => {
    if (!selectedReport) return;
    const saved=await mutateReport(`${API}/projects/${projectId}/clash-reports/${selectedReport.id}/clashes/${clashId}`,"PATCH",updates);
    if(saved)setClashes(prev=>prev.map(c=>c.id===clashId?saved:c));
  };

  const filteredClashes = clashes
    .filter(c => filterPriority === "all" || c.priority === filterPriority)
    .filter(c => filterStatus === "all" || c.status === filterStatus)
    .filter(c => !search || (c.description ?? "").toLowerCase().includes(search.toLowerCase()) || (c.element1 ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const order = { P1: 0, P2: 1, P3: 2, P4: 3 };
      return (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
    });

  const clashCurrentViewSummary = selectedReport ? [
    `${t("Report", "Reporte")}: ${selectedReport.reportNumber || selectedReport.fileName}`,
    `${t("View", "Vista")}: ${viewMode === "grouped" ? t("Grouped", "Agrupado") : t("Normal", "Normal")}`,
    `${t("Priority", "Prioridad")}: ${filterPriority === "all" ? t("All priorities", "Todas las prioridades") : filterPriority}`,
    `${t("Status", "Estado")}: ${clashStatusLabel(filterStatus, t)}`,
    search.trim() ? `${t("Search", "Busqueda")}: ${search.trim()}` : "",
    `${t("Visible", "Visible")}: ${filteredClashes.length}/${clashes.length}`,
  ].filter(Boolean) : [];

  const exportClashCurrentViewPdf = async () => {
    if (!selectedReport || !token) return;
    const params = new URLSearchParams({
      lang,
      priority: filterPriority,
      status: filterStatus,
      search: search.trim(),
      view: viewMode,
    });
    setClashExporting(true);
    setError("");
    try {
      await downloadAuthenticatedPdf(
        `${API}/projects/${projectId}/clash-reports/${selectedReport.id}/current-view/pdf?${params.toString()}`,
        token,
        `clash-current-view-${selectedReport.id}.pdf`,
      );
    } catch {
      setError(t("Could not prepare the current Clash view PDF.", "No se pudo preparar el PDF de la vista actual de Choques."));
    } finally {
      setClashExporting(false);
    }
  };

  const exportSelectedClashReportPdf = async () => {
    if (!selectedReport || !token) return;
    setError("");
    try {
      await downloadAuthenticatedPdf(
        `${API}/projects/${projectId}/clash-reports/${selectedReport.id}/pdf`,
        token,
        `clash-report-${selectedReport.id}.pdf`,
      );
    } catch {
      setError(t("Could not prepare the selected Clash Report PDF.", "No se pudo preparar el PDF del Reporte de Choques seleccionado."));
    }
  };

  const exportClashReportListPdf = async () => {
    if (!token) return;
    setListExporting(true);
    setError("");
    try {
      await downloadGovernedCurrentViewPdf(projectId, token, {
        surface: "clash-reports",
        lang,
        context: [`${t("Visible reports", "Reportes visibles")}: ${reports.length}`],
        columns: [
          t("Report", "Reporte"),
          t("File", "Archivo"),
          t("Status", "Estado"),
          t("Clashes", "Choques"),
          t("Created", "Creado"),
        ],
        rows: reports.map((report) => [
          report.reportNumber || String(report.id),
          report.fileName,
          report.status,
          String(report.totalClashes),
          new Date(report.createdAt).toLocaleDateString(),
        ]),
        emptyMessage: t("No clash reports are available.", "No hay reportes de choques disponibles."),
      }, "clash-reports-current-view.pdf");
    } catch {
      setError(t("Could not prepare the Clash Reports PDF.", "No se pudo preparar el PDF de Reportes de Choques."));
    } finally {
      setListExporting(false);
    }
  };

  const getRecordOptions = (type: string) => {
    if (type === "rfi") return linkableItems.rfis.map((r: any) => `<option value="${r.id}">${r.number} — ${r.subject}</option>`).join("");
    if (type === "meeting") return linkableItems.meetings.map((m: any) => `<option value="${m.id}">${m.title}</option>`).join("");
    return linkableItems.submittalItems.map((s: any) => `<option value="${s.id}">${s.fileName || s.reportNumber || `Tracker #${s.id}`}</option>`).join("");
  };

  if (selectedReport) return (
    <>
    {deleteClash && (
      <DeleteConfirmModal
        open
        onClose={() => setDeleteClash(null)}
        onDeleted={() => { setClashes(prev => prev.filter(x => x.id !== deleteClash.id)); setDeleteClash(null); }}
        endpoint={`${API}/projects/${projectId}/clash-reports/${selectedReport.id}/clashes/${deleteClash.id}`}
        entityLabel={`Clash ${deleteClash.label}`}
        warning={t("Linked items (RFIs, submittals) will be detached.", "Los elementos enlazados serán desvinculados.")}
      />
    )}
    <div id="clash-reports-list-current-view" className="tab-content-wrapper">
      <a href={`/plugin-pull-review?projectId=${projectId}`} style={{display:"inline-block",marginBottom:12}}>{t("Review pending native clash changes","Revisar cambios nativos de choques pendientes")}</a>
      {error&&<div role="alert"><p>{error}</p><button disabled={loading||clashLoading||mutating} onClick={()=>void loadClashes(selectedReport)}>{t("Reload saved records","Recargar registros guardados")}</button></div>}{receipt&&<p role="status">{receipt}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={() => {const url=new URL(window.location.href);url.searchParams.delete("report");url.searchParams.delete("clash");window.history.replaceState(window.history.state,"",url);setSelectedReport(null);setReceipt("");}}
          style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={14} /> {t("Back", "Volver")}
        </button>
        <div>
          <input
            disabled={!canWrite||mutating}
            aria-label={t("Report filename","Nombre del reporte")}
            value={selectedReport.fileName}
            onChange={e => setSelectedReport(prev => prev ? { ...prev, fileName: e.target.value } : prev)}
            onBlur={async e => {
              const saved=await mutateReport(`${API}/projects/${projectId}/clash-reports/${selectedReport.id}/rename`,"PATCH",{fileName:e.target.value});if(saved)setSelectedReport(saved);
            }}
            style={{ fontWeight: 700, fontSize: 18, border: "none", borderBottom: "2px solid #1E3A5F",
              background: "transparent", outline: "none", width: "100%", cursor: "text" }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
            <input
              disabled={!canWrite||mutating}
              aria-label={t("Report number","Número de reporte")}
              value={selectedReport.reportNumber || ""}
              onChange={e => setSelectedReport(prev => prev ? { ...prev, reportNumber: e.target.value } : prev)}
              onBlur={async e => {
                const saved=await mutateReport(`${API}/projects/${projectId}/clash-reports/${selectedReport.id}/rename`,"PATCH",{reportNumber:e.target.value});if(saved)setSelectedReport(saved);
              }}
              placeholder="Report No. (e.g. ELA01-CR-001)"
              style={{ fontSize: 12, border: "none", borderBottom: canWrite ? "1px dashed #D1D5DB" : "none",
                background: "transparent", outline: "none", color: "#1D4ED8", fontWeight: 600, width: 200,
                cursor: canWrite ? "text" : "default" }}
            />
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              {new Date(selectedReport.createdAt).toLocaleDateString()} · {selectedReport.totalClashes} {t("clashes","choques")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void exportSelectedClashReportPdf()}
          disabled={!token}
          title={t("Export the selected clash report as a PDF", "Exportar el reporte de choques seleccionado como PDF")}
          className="btn btn-primary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", textDecoration: "none" }}
        >
          <Download size={14} /> {t("Export Clash PDF", "Exportar PDF de Choques")}
        </button>
        <PrintPdfButton lang={lang} onClick={() => void exportClashCurrentViewPdf()} loading={clashExporting} disabled={clashLoading} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "-8px 0 14px" }}>
        {clashCurrentViewSummary.map(part => (
          <span key={part} style={{ display: "inline-flex", border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1E3A5F", borderRadius: 6, padding: "4px 7px", fontSize: 11, fontWeight: 800 }}>
            {part}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: t("Total","Total"), value: selectedReport.totalClashes, color: "#1D4ED8" },
          { label: "P1 Critical", value: selectedReport.p1Count, color: "#DC2626" },
          { label: "P2 This Week", value: selectedReport.p2Count, color: "#D97706" },
          { label: "P3 Monitor", value: selectedReport.p3Count, color: "#CA8A04" },
          { label: "P4 Low", value: selectedReport.p4Count, color: "#6B7280" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {selectedReport.aiSummary && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8,
          padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1E40AF" }}>
          {selectedReport.aiSummary}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
          <option value="all">{t("All Priorities","Todas las Prioridades")}</option>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 This Week</option>
          <option value="P3">P3 Monitor</option>
          <option value="P4">P4 Low</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
          <option value="all">{t("All Statuses","Todos los Estados")}</option>
          <option value="open">{t("Active","Activo")}</option>
          <option value="follow_up">{t("Follow Up","Seguimiento")}</option>
          <option value="waiting_design">{t("Waiting Design","Esperando Diseño")}</option>
          <option value="in_progress">{t("In Progress","En Progreso")}</option>
          <option value="approved">{t("Approved","Aprobado")}</option>
          <option value="resolved">{t("Resolved","Resuelto")}</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("Search clashes...","Buscar choques...")}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, flex: 1, minWidth: 200 }} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["normal", "grouped"] as const).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6,
              border: "1px solid " + (viewMode === m ? "#1E3A5F" : "#D1D5DB"),
              background: viewMode === m ? "#1E3A5F" : "white",
              color: viewMode === m ? "white" : "#374151", cursor: "pointer" }}>
            {m === "normal" ? t("Normal", "Normal") : t("Grouped", "Agrupado")}
          </button>
        ))}
      </div>

      {canWrite && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="btn btn-sm btn-primary" disabled={mutating} onClick={async () => {
            if (!selectedReport) return;
            const saved=await mutateReport(`${API}/projects/${projectId}/clash-reports/${selectedReport.id}/clashes`,"POST",{description:"",status:"open"});if(saved)await loadClashes(selectedReport);
          }}>
            + Add Clash
          </button>
        </div>
      )}

      {clashLoading
        ? <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>{t("Loading clashes...","Cargando choques...")}</div>
        : viewMode === "grouped"
        ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(() => {
              const buildings: Record<string, Record<string, Record<string, Clash[]>>> = {};
              for (const c of filteredClashes) {
                const b = ((c as any).building?.toString().trim()) || "Unassigned Building";
                const f = ((c.floor || c.level)?.toString().trim()) || "Unassigned Floor";
                const s = (c.status?.toString().trim()) || "open";
                if (!buildings[b]) buildings[b] = {};
                if (!buildings[b][f]) buildings[b][f] = {};
                if (!buildings[b][f][s]) buildings[b][f][s] = [];
                buildings[b][f][s].push(c);
              }
              const buildingNames = Object.keys(buildings).sort();
              if (buildingNames.length === 0) return (
                <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                  {t("No clashes match your filters","Ningún choque coincide con los filtros")}
                </div>
              );
              return buildingNames.map(b => {
                const floors = buildings[b];
                const bCount = Object.values(floors).reduce((n, st) => n + Object.values(st).reduce((m, arr) => m + arr.length, 0), 0);
                return (
                  <div key={b} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ background: "#1E3A5F", color: "white", padding: "10px 14px", fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
                      <span>{b}</span><span style={{ opacity: 0.85 }}>{bCount}</span>
                    </div>
                    {Object.keys(floors).sort().map(f => {
                      const statuses = floors[f];
                      const fCount = Object.values(statuses).reduce((m, arr) => m + arr.length, 0);
                      return (
                        <div key={f}>
                          <div style={{ background: "#EFF3F8", padding: "8px 16px", fontWeight: 700, fontSize: 13, color: "#1E3A5F", display: "flex", justifyContent: "space-between", borderTop: "1px solid #E5E7EB" }}>
                            <span>{f}</span><span style={{ color: "#6B7280" }}>{fCount}</span>
                          </div>
                          {Object.keys(statuses).sort().map(s => {
                            const rows = statuses[s];
                            return (
                              <div key={s}>
                                <div style={{ padding: "6px 20px", display: "flex", alignItems: "center", gap: 8, background: "#FAFAFA", borderTop: "1px solid #F3F4F6" }}>
                                  <StatusBadge status={s} />
                                  <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{rows.length}</span>
                                </div>
                                {rows.map(c => (
                                  <div key={c.id} data-clash-id={c.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 130px 120px 110px", gap: 10, alignItems: "center", padding: "8px 20px", borderTop: "1px solid #F3F4F6", fontSize: 12 }}>
                                    <PBadge p={c.priority} />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.description || c.clashIdOriginal || `Clash #${c.id}`}>{c.description || c.clashIdOriginal || `Clash #${c.id}`}</span>
                                    <StatusBadge status={c.status} />
                                    <span style={{ color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.discipline1 || "—"}</span>
                                    <span style={{ color: "#9CA3AF" }}>{fmtUpdated((c as any).updatedAt)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        )
        : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "#1E3A5F", position: "sticky", top: 0, zIndex: 10 }}>
                  {[
                    { label: "Priority", w: 80 },
                    { label: "Viewpoint", w: 100 },
                    { label: "Description", w: 220 },
                    { label: "Trade", w: 80 },
                    { label: "Floor", w: 100 },
                    { label: "Status", w: 110 },
                    { label: "Responsible", w: 110 },
                    { label: "Deadline", w: 100 },
                    { label: "Notes", w: 70 },
                  ].map(h => (
                    <th key={h.label} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700,
                      color: "white", textAlign: "left", textTransform: "uppercase",
                      whiteSpace: "nowrap", width: h.w, minWidth: h.w, background: "#1E3A5F" }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClashes.map(c => (
                  <Fragment key={c.id}>
                    <tr data-clash-id={c.id} style={{ borderBottom: "1px solid #F3F4F6", background: c.status === "resolved" ? "#F0FDF4" : "white" }}>
                      <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                        <select value={c.priority || ""} onChange={e => updateClash(c.id, { priority: e.target.value })}
                          style={{ border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 11, padding: "2px 4px", fontWeight: 700,
                            background: P_COLORS[c.priority ?? ""]?.bg ?? "#F3F4F6", color: P_COLORS[c.priority ?? ""]?.text ?? "#6B7280" }}>
                          <option value="">—</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option><option value="P4">P4</option>
                        </select>
                      </td>
                      {(["clashIdOriginal","description","discipline1","level"] as const).map(field => {
                        const val = (c as any)[field] as string | undefined;
                        const widths: Record<string, number> = { clashIdOriginal: 60, description: 180, discipline1: 80, level: 70 };
                        return (
                          <td key={field} style={{ padding: "4px 8px" }}
                              onClick={() => setExpandedNotes(prev => ({ ...prev, [c.id]: true }))}>
                            <div style={{ border: "1px solid #E5E7EB", borderRadius: 4, padding: "4px 6px", fontSize: 11,
                              width: widths[field], minHeight: 22, cursor: "pointer",
                              background: !val ? "#FFFBEB" : "white",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: !val ? "#9CA3AF" : "#111827" }}>
                              {val || "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding: "4px 8px" }}>
                        <select disabled={!canWrite||mutating} aria-label={t("Clash status","Estado del choque")} value={c.status} onChange={e => updateClash(c.id, { status: e.target.value })}
                          style={{ border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 11, padding: "2px 4px", fontWeight: 600,
                            background: c.status === "resolved" ? "#DCFCE7" : c.status === "approved" ? "#D1FAE5" : c.status === "waiting_design" ? "#EDE9FE" : c.status === "follow_up" ? "#FEF3C7" : c.status === "in_progress" ? "#DBEAFE" : "#FEE2E2",
                            color: c.status === "resolved" ? "#16A34A" : c.status === "approved" ? "#059669" : c.status === "waiting_design" ? "#7C3AED" : c.status === "follow_up" ? "#D97706" : c.status === "in_progress" ? "#1D4ED8" : "#DC2626" }}>
                          <option value="open">Active</option><option value="follow_up">Follow Up</option><option value="waiting_design">Waiting Design</option><option value="in_progress">In Progress</option><option value="approved">Approved</option><option value="resolved">Resolved</option><option value="wont_fix">Won't Fix</option>
                        </select>
                      </td>
                      <td style={{ padding: "4px 8px" }} onClick={() => setExpandedNotes(prev => ({ ...prev, [c.id]: true }))}>
                        <div style={{ border: "1px solid #E5E7EB", borderRadius: 4, padding: "4px 6px", fontSize: 11,
                          width: 90, minHeight: 22, cursor: "pointer",
                          background: !c.assignedToName ? "#FFFBEB" : "white",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: !c.assignedToName ? "#9CA3AF" : "#111827" }}>
                          {c.assignedToName || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input type="date"
                          value={(c.dueDate && !String(c.dueDate).startsWith("1970") ? new Date(c.dueDate).toISOString().split("T")[0] : "")}
                          onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, dueDate: e.target.value } : x))}
                          onBlur={e => updateClash(c.id, { dueDate: e.target.value })}
                          style={{ border: "1px solid #E5E7EB", borderRadius: 4, padding: "2px 4px",
                            fontSize: 11, width: 95,
                            background: !c.dueDate || c.dueDate.toString().startsWith("1970") ? "#FFFBEB" : "white" }} />
                      </td>
                      <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                        <button className="btn btn-sm btn-outline"
                          onClick={() => {
                            const nowOpen = !expandedNotes[c.id];
                            setExpandedNotes(prev => ({ ...prev, [c.id]: nowOpen }));
                            if (nowOpen) loadClashLinks(c.id);
                          }}>
                          {expandedNotes[c.id] ? "Done" : "Edit"}
                        </button>
                        {canWrite && (
                          <button
                            title={t("Delete clash", "Eliminar choque")}
                            onClick={() => setDeleteClash({ id: c.id, label: c.clashIdOriginal || `Clash #${c.id}` })}
                            style={{ marginLeft: 4, padding: "3px 6px", border: "1px solid #FECACA", borderRadius: 4, background: "#FEF2F2", color: "#DC2626", cursor: "pointer" }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedNotes[c.id] && (
                      <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                        <td colSpan={10} style={{ padding: "12px 16px" }}>
                          {c.priorityReason && <div style={{ marginBottom: 10, fontStyle: "italic", fontSize: 11, color: "#6B7280" }}>AI: {c.priorityReason}</div>}
                          {(() => {
                            const inputStyle = (v: any) => ({ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: !v ? "#FFFBEB" : "white" });
                            const lblStyle = { fontSize: 11, fontWeight: 600, color: "#374151" };
                            const renderInput = (field: string) => (
                              <input value={((c as any)[field] as string) || ""}
                                onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, [field]: e.target.value } : x))}
                                onBlur={e => updateClash(c.id, { [field]: e.target.value })}
                                style={inputStyle((c as any)[field])} />
                            );
                            const dueVal = (c as any).dueDate ? String((c as any).dueDate).slice(0, 10) : "";
                            return (
                              <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 10 }}>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={lblStyle}>Viewpoint ID</span>
                                    {renderInput("clashIdOriginal")}
                                  </label>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={lblStyle}>Description</span>
                                    {renderInput("description")}
                                  </label>
                                </div>
                                <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                                  <span style={lblStyle}>Hold Ups</span>
                                  <input value={((c as any).element1 as string) || ""}
                                    onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, element1: e.target.value } : x))}
                                    onBlur={e => updateClash(c.id, { element1: e.target.value })}
                                    style={{ ...inputStyle((c as any).element1), width: "100%" }} />
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 10 }}>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={lblStyle}>Trade</span>
                                    {renderInput("discipline1")}
                                  </label>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={lblStyle}>Floor</span>
                                    {renderInput("level")}
                                  </label>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 10 }}>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={lblStyle}>Responsible</span>
                                    {renderInput("assignedToName")}
                                  </label>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={lblStyle}>Deadline</span>
                                    <input type="date" value={dueVal}
                                      onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, dueDate: e.target.value } as any : x))}
                                      onBlur={e => updateClash(c.id, { dueDate: e.target.value } as any)}
                                      style={inputStyle(dueVal)} />
                                  </label>
                                </div>
                                <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                                  <span style={lblStyle}>Response / Direction</span>
                                  <textarea value={c.resolutionNotes || ""}
                                    onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, resolutionNotes: e.target.value } : x))}
                                    onBlur={e => updateClash(c.id, { resolutionNotes: e.target.value })}
                                    rows={2} style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "vertical" }} />
                                </label>
                          <div style={{ marginTop: 12, borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
                            <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Linked Items</div>
                            {(clashLinks[c.id] ?? []).length === 0 && (
                              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>No linked items yet</div>
                            )}
                            {(clashLinks[c.id] ?? []).map((link: any) => (
                              <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#EFF6FF", borderRadius: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>{link.fromType === "clash" ? link.toType : link.fromType}</span>
                                <span style={{ fontSize: 11, color: "#374151" }}>#{link.fromType === "clash" ? link.toId : link.fromId}</span>
                                <span style={{ fontSize: 10, color: "#6B7280" }}>{link.linkType}</span>
                                <button onClick={async () => {
                                  await fetch(`${API}/projects/${projectId}/links/${link.id}`, { method: "DELETE", headers });
                                  loadClashLinks(c.id);
                                }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 12 }}>×</button>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                              <select id={`link-type-${c.id}`}
                                onChange={() => {
                                  const typeEl = document.getElementById(`link-type-${c.id}`) as HTMLSelectElement;
                                  const recordEl = document.getElementById(`link-record-${c.id}`) as HTMLSelectElement;
                                  if (recordEl) recordEl.innerHTML = getRecordOptions(typeEl?.value);
                                }}
                                style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
                                <option value="submittal_report">Submittal Tracker</option>
                                <option value="rfi">RFI</option>
                                <option value="meeting">Meeting</option>
                              </select>
                              <select id={`link-record-${c.id}`} style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12, flex: 1, minWidth: 200 }}>
                                {linkableItems.submittalItems.map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.fileName || s.reportNumber || `Tracker #${s.id}`}</option>
                                ))}
                              </select>
                              <select id={`link-rel-${c.id}`} style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
                                <option value="resolves">Resolves</option>
                                <option value="related">Related</option>
                                <option value="caused_by">Caused by</option>
                                <option value="blocks">Blocks</option>
                              </select>
                              <button className="btn btn-sm btn-primary" onClick={() => {
                                const toType = (document.getElementById(`link-type-${c.id}`) as HTMLSelectElement)?.value;
                                const toId = Number((document.getElementById(`link-record-${c.id}`) as HTMLSelectElement)?.value);
                                const linkType = (document.getElementById(`link-rel-${c.id}`) as HTMLSelectElement)?.value;
                                if (toId) addClashLink(c.id, toType, toId, linkType);
                              }}>+ Link</button>
                            </div>
                          </div>
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                  <button className="btn btn-sm btn-outline" onClick={() => setExpandedNotes(prev => ({ ...prev, [c.id]: false }))}>Done</button>
                                </div>
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {filteredClashes.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                {t("No clashes match your filters","Ningún choque coincide con los filtros")}
              </div>
            )}
          </div>
        )
      }
    </div>
    </>
  );

  return (
    <>
    {deleteReport && (
      <DeleteConfirmModal
        open
        onClose={() => setDeleteReport(null)}
        onDeleted={() => { setReports(prev => prev.filter(x => x.id !== deleteReport.id)); setDeleteReport(null); }}
        endpoint={`${API}/projects/${projectId}/clash-reports/${deleteReport.id}`}
        entityLabel={`Report ${deleteReport.label}`}
        warning={t("Linked items will be detached.", "Los elementos enlazados serán desvinculados.")}
      />
    )}
    <div id="clash-reports-list-current-view" className="tab-content-wrapper">
      {error&&<div role="alert"><p>{error}</p><button disabled={loading||mutating} onClick={()=>void loadReports()}>{t("Reload saved records","Recargar registros guardados")}</button></div>}{receipt&&<p role="status">{receipt}</p>}
      <a href={`/plugin-pull-review?projectId=${projectId}`} style={{display:"inline-block",marginBottom:12}}>{t("Review pending native clash changes","Revisar cambios nativos de choques pendientes")}</a>
      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid #E5E7EB", marginBottom: 20 }}>
        {([["clash", t("Clash Hits", "Choques")], ["lens", t("Lens Viewpoints", "Vistas Lens")]] as const).map(([k, label]) => (
          <button key={k} onClick={() => selectTab(k)}
            style={{ background: "none", border: "none", padding: "0 0 10px", fontSize: 14, fontWeight: 700,
              cursor: "pointer", marginBottom: -1,
              color: activeTab === k ? "#1D4ED8" : "#6B7280",
              borderBottom: activeTab === k ? "2px solid #1D4ED8" : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "clash" && (<>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,flexWrap:"wrap",gap:12 }}>
        <div style={{flex:"1 1 240px",minWidth:0}}>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Clash Reports","Reportes de Choques")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Upload clash register from Navisworks, Revit, or Excel — AI ranks every clash by priority","Sube el registro de choques — IA clasifica por prioridad")}
          </p>
          {!canWrite&&<p style={{fontSize:12,color:"#475569",marginTop:6}}>{t("Read-only report access. Editing and deletion require project write permission.","Acceso de solo lectura. Editar y eliminar requiere permiso de escritura del proyecto.")}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end",flex:"0 0 auto",maxWidth:"100%" }}>
          <PrintPdfButton
            lang={lang}
            onClick={() => void exportClashReportListPdf()}
            disabled={loading}
            loading={listExporting}
          />
          <button className="btn btn-sm btn-outline" disabled={loading||mutating||uploading} onClick={()=>{setUploadMsg("");void loadReports();}}>{t("Refresh saved reports","Recargar reportes guardados")}</button>
          {uploadReceipt&&<button className="btn btn-sm btn-outline" disabled={uploading||mutating} onClick={()=>void verifyPendingUpload()}>{t("Verify uploaded report","Verificar reporte importado")}</button>}
        {canWrite && (
          <button
            className="btn btn-sm btn-outline"
            style={{ marginRight: 8 }}
            onClick={()=>void createReport()} disabled={mutating||loading}
          >
            {createAttempt.current?t("Recover new report","Recuperar reporte nuevo"):t("+ New Report","+ Nuevo reporte")}
          </button>
        )}

        {canWrite && (
          <label style={{ cursor: uploading||uploadReceipt ? "not-allowed" : "pointer" }}>
            <input ref={fileRef} type="file" accept="*"
              onChange={handleUpload} disabled={uploading||!!uploadReceipt} style={{ display: "none" }} />
            <div className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6,
              opacity: uploading||uploadReceipt ? 0.6 : 1, pointerEvents: uploading||uploadReceipt ? "none" : "auto" }}>
              <Upload size={14} />
              {uploading ? t("Processing...","Procesando...") : t("Upload Clash Register","Subir Registro de Choques")}
            </div>
          </label>
        )}
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
          padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {uploadMsg && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8,
          padding: "10px 14px", color: "#1D4ED8", fontSize: 13, marginBottom: 14,
          display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {uploadMsg}
        </div>
      )}

      {loading
        ? <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>{t("Loading...","Cargando...")}</div>
        : reports.length === 0
          ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <Upload size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {t("No clash reports yet","Sin reportes de choques aún")}
              </div>
              <div style={{ fontSize: 13 }}>
                {t("Upload your clash register Excel file to get started","Sube tu archivo Excel de choques para comenzar")}
              </div>
            </div>
          )
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reports.map(r => (
                <div key={r.id} style={{ background: "white", border: "1px solid #E5E7EB",
                  borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center",flexWrap:"wrap",gap:12 }}>
                  <div style={{ flex:"1 1 240px",minWidth:0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      <input
                        disabled={!canWrite||mutating}
                        aria-label={t("Report filename","Nombre del reporte")}
                        value={r.fileName}
                        onChange={e => setReports(prev => prev.map(x => x.id === r.id ? { ...x, fileName: e.target.value } : x))}
                        onBlur={async e => {
                          const saved=await mutateReport(`${API}/projects/${projectId}/clash-reports/${r.id}/rename`,"PATCH",{fileName:e.target.value});if(saved)setReports(current=>current.map(row=>row.id===saved.id?saved:row));
                        }}
                        style={{ fontWeight: 700, fontSize: 14, border: "none", borderBottom: "1px dashed #D1D5DB",
                          background: "transparent", outline: "none", width: "100%", cursor: "text" }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                      {r.reportNumber && <span style={{ color: "#1D4ED8", fontWeight: 700, marginRight: 8 }}>{r.reportNumber}</span>}
                      {new Date(r.createdAt).toLocaleDateString()} · {r.totalClashes} {t("clashes","choques")}
                      {r.aiSummary && <span> · {r.aiSummary}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: r.status === "complete" ? "#DCFCE7" : r.status==="ranking_failed"?"#FEF2F2":"#FEF3C7",
                        color: r.status === "complete" ? "#16A34A" : r.status==="ranking_failed"?"#B91C1C":"#D97706" }}>
                        {r.status === "complete" ? t("Complete","Completo") : r.status==="ranking_failed"?t("Ranking failed","Clasificación fallida"):t("Processing","Procesando")}
                      </span>
                      {r.p1Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEE2E2", color: "#DC2626" }}>P1: {r.p1Count}</span>}
                      {r.p2Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>P2: {r.p2Count}</span>}
                      {r.p3Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEF9C3", color: "#CA8A04" }}>P3: {r.p3Count}</span>}
                      {r.p4Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#F3F4F6", color: "#6B7280" }}>P4: {r.p4Count}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0,flexWrap:"wrap",maxWidth:"100%" }}>
                    <button className="btn btn-sm btn-outline" onClick={() => loadClashes(r)} style={{ fontSize: 12, padding: "4px 12px" }}>{t("View Clashes","Ver choques")}</button>
                    <button className="btn btn-sm btn-outline" disabled={!canWrite||mutating} onClick={async () => {const saved=await mutateReport(`${API}/projects/${projectId}/clash-reports/${r.id}/rerank`,"POST");if(saved){setUploadMsg("");await loadReports();}}} style={{ fontSize: 12, padding: "4px 12px" }}>{t("Re-rank AI","Reclasificar con IA")}</button>
                    <button disabled={!canWrite||mutating} onClick={() => setDeleteReport({ id: r.id, label: r.fileName })} style={{ fontSize: 12, padding: "4px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, cursor:canWrite?"pointer":"not-allowed",opacity:canWrite?1:0.5, fontWeight: 600 }}>{t("Delete","Eliminar")}</button>
                  </div>
                </div>
              ))}
            </div>
          )
      }
      </>)}

      {activeTab === "lens" && (
        <LensViewpointsView projectId={projectId} canWrite={canWrite} focusViewpointId={Number.isInteger(requestedLensId) && requestedLensId > 0 ? requestedLensId : undefined} />
      )}
    </div>
    </>
  );
}
