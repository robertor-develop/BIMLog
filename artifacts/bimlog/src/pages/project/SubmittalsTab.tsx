import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { useListSubmittals, useCreateSubmittal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth";
import * as XLSX from "xlsx";
import {
  FileCheck, Plus, X, ChevronDown, ChevronUp, AlertCircle, Download, FileText,
  Sparkles, CheckCircle2, Clock, Search, Filter, ExternalLink, Eye, Shield,
  BookOpen, Loader2, Copy, TriangleAlert, ClipboardList, Trash2,
  Pencil, Save, Link as LinkIcon, Paperclip,
} from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { LinkedItemsPanel } from "@/components/LinkedItemsPanel";
import { format, differenceInDays, isValid } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type AiCheckResult = {
  overall: "pass" | "possible_issue" | "fail";
  aspects: Array<{ label: string; result: "pass" | "possible_issue" | "fail"; note: string }>;
  summary: string;
};

type Submittal = {
  id: number; projectId: number; number: string; title: string; description?: string | null;
  status: string; specSection?: string | null; submittalType: string; submittalCategory?: string | null;
  trade?: string | null; floor?: string | null; responsibleCompany?: string | null;
  submittedById: number; submittedByName?: string;
  submittedByCompany?: string | null; submittedByPerson?: string | null;
  submittedByEmail?: string | null; submittedByPhone?: string | null; submittedByAddress?: string | null;
  submittedToCompany?: string | null; submittedToPerson?: string | null;
  submittedToEmail?: string | null; submittedToExternal?: boolean | null;
  manufacturer?: string | null; modelNumber?: string | null;
  drawingNumber?: string | null; drawingTitle?: string | null;
  dateSubmitted?: string | null; dateRequired?: string | null; dueDate?: string | null;
  procurementStatus?: string | null; ballInCourt?: string | null;
  ballInCourtHistory?: Array<{ party: string; setAt: string; setBy: string }> | null;
  aiCheckResult?: AiCheckResult | null; aiCheckRan?: boolean | null;
  reviewDecision?: string | null; complianceNotes?: string | null;
  rejectionReason?: string | null; reviewerName?: string | null; reviewedAt?: string | null;
  linkedRfiId?: number | null; rapidApprovalFlag?: boolean | null;
  parentSubmittalId?: number | null; revisionNumber?: number | null;
  distributionList?: string[] | null; attachmentsJson?: string[] | null;
  assignedToId?: number | null; createdAt: string; updatedAt: string;
};

type RegisterItem = {
  id: number; projectId: number; specSection: string; description: string;
  trade?: string | null; submittalType?: string | null; requiredByDate?: string | null;
  leadTimeDays?: number | null; responsibleCompany?: string | null;
  status?: string | null; dateCreated?: string | null;
};

type ViewEvent = {
  id: number; submittalId: number; userId: number;
  userFullName: string; userCompanyName: string; viewedAt: string; eventType: string;
};

type RFI = { id: number; number: string; subject: string; status: string };
type ProjectFile = { id: number; fileName: string; fileType: string; fileUrl?: string };
type DirectoryEntry = {
  id: number;
  fullName?: string | null;
  email?: string | null;
  companyName?: string | null;
  role?: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: "shop_drawing", label: "Shop Drawing", labelEs: "Plano de Taller" },
  { value: "product_data", label: "Product Data", labelEs: "Datos de Producto" },
  { value: "sample", label: "Sample", labelEs: "Muestra" },
  { value: "mockup", label: "Mockup", labelEs: "Maqueta" },
  { value: "calculation", label: "Calculation", labelEs: "Cálculo" },
  { value: "certificate", label: "Certificate", labelEs: "Certificado" },
  { value: "warranty", label: "Warranty", labelEs: "Garantía" },
  { value: "operation_manual", label: "Operation Manual", labelEs: "Manual de Operación" },
  { value: "as_built", label: "As-Built", labelEs: "Como Construido" },
  { value: "closeout", label: "Closeout", labelEs: "Cierre" },
  { value: "other", label: "Other", labelEs: "Otro" },
];

const PROCUREMENT_OPTIONS = [
  { value: "not_ordered", label: "Not Yet Ordered", labelEs: "No Ordenado" },
  { value: "on_order", label: "On Order", labelEs: "En Pedido" },
  { value: "delivered", label: "Delivered to Site", labelEs: "Entregado en Obra" },
  { value: "installed", label: "Installed", labelEs: "Instalado" },
];

const REVIEW_DECISIONS = [
  { value: "approved", label: "Approved", labelEs: "Aprobado" },
  { value: "approved_as_noted", label: "Approved as Noted", labelEs: "Aprobado con Notas" },
  { value: "revise_resubmit", label: "Revise and Resubmit", labelEs: "Revisar y Reenviar" },
  { value: "rejected", label: "Rejected", labelEs: "Rechazado" },
  { value: "not_required", label: "Not Required", labelEs: "No Requerido" },
];

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string; labelEs: string }> = {
  pending: { bg: "#F3F4F6", color: "#6B7280", label: "Pending", labelEs: "Pendiente" },
  submitted: { bg: "#EFF6FF", color: "#1D4ED8", label: "Submitted", labelEs: "Enviado" },
  under_review: { bg: "#FFFBEB", color: "#B45309", label: "Under Review", labelEs: "En Revisión" },
  approved: { bg: "#F0FDF4", color: "#15803D", label: "Approved", labelEs: "Aprobado" },
  approved_as_noted: { bg: "#EFF6FF", color: "#1D4ED8", label: "Approved as Noted", labelEs: "Aprobado con Notas" },
  rejected: { bg: "#FFF1F2", color: "#DC2626", label: "Rejected", labelEs: "Rechazado" },
  revise_resubmit: { bg: "#FFF7ED", color: "#EA580C", label: "Revise & Resubmit", labelEs: "Revisar y Reenviar" },
};

const REGISTER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", labelEs: "Pendiente" },
  { value: "submitted", label: "Submitted", labelEs: "Enviado" },
  { value: "approved", label: "Approved", labelEs: "Aprobado" },
  { value: "rejected", label: "Rejected", labelEs: "Rechazado" },
  { value: "not_required", label: "Not Required", labelEs: "No Requerido" },
];

const AI_COLOR: Record<string, string> = {
  pass: "#15803D", possible_issue: "#D97706", fail: "#DC2626",
};
const AI_BG: Record<string, string> = {
  pass: "#F0FDF4", possible_issue: "#FFFBEB", fail: "#FEF2F2",
};

function w(en: string, es: string, lang: string) { return lang === "es" ? es : en; }
function getToken() { return JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token || ""; }
function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  const dt = new Date(d);
  return isValid(dt) ? format(dt, "MMM d, yyyy") : "-";
}
function isAttachmentUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/api/");
}
function attachmentLabel(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return url.searchParams.get("name") || decodeURIComponent(url.pathname.split("/").pop() || value);
  } catch {
    return value;
  }
}
function attachmentValues(value: string) {
  return value.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean);
}
function uniqSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(v => v?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b));
}
function daysOut(d: string | null | undefined) {
  if (!d) return null;
  const dt = new Date(d);
  if (!isValid(dt)) return null;
  return differenceInDays(new Date(), dt);
}

// ─── Slide-out panel wrapper ──────────────────────────────────────────────────
function SlidePanel({ open, onClose, children, title, width = 680 }: {
  open: boolean; onClose: () => void; children: React.ReactNode; title: string; width?: number;
}) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000 }}
      />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width, zIndex: 1001,
        background: "white", boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "1px solid #E5E7EB",
          background: "#1E3A5F", color: "white",
        }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "white", cursor: "pointer", padding: 4 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>{children}</div>
      </div>
    </>
  );
}

// ─── Section heading inside panels ───────────────────────────────────────────
function PanelSection({ title }: { title: string }) {
  return (
    <div style={{ margin: "20px 0 10px", padding: "6px 10px", background: "#1E3A5F", borderRadius: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, ...props.style }} />;
}
function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, background: "white", ...props.style }} />;
}
function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, resize: "vertical", ...props.style }} />;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type TrackerExportFilters = { floor?: string; type?: string; date?: string; status?: string };

async function downloadSubmittalTracker(projectId: number, format: "pdf" | "excel", filters: TrackerExportFilters = {}) {
  const endpoint = format === "pdf"
    ? `/api/v1/projects/${projectId}/submittals/tracker-pdf`
    : `/api/v1/projects/${projectId}/submittals/tracker-excel`;
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!response.ok) throw new Error("Tracker export failed");
  const blob = await response.blob();
  downloadBlob(blob, format === "pdf" ? `Submittal-Tracker-Project${projectId}.pdf` : `Submittal-Tracker-Project${projectId}.xlsx`);
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {lang === "es" ? s.labelEs : s.label}
    </span>
  );
}

// ─── AI result badge ──────────────────────────────────────────────────────────
function AiBadge({ result }: { result: "pass" | "possible_issue" | "fail" }) {
  const labels: Record<string, string> = { pass: "AI Pass", possible_issue: "AI Issue", fail: "AI Fail" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 10,
      background: AI_BG[result], color: AI_COLOR[result],
      fontSize: 10, fontWeight: 700,
    }}>
      {labels[result]}
    </span>
  );
}

// ─── Submittal Tracking List ──────────────────────────────────────────────────
function SubmittalTrackingList({ projectId, submittals, lang, onGoSubmittals }: {
  projectId: number; submittals: Submittal[]; lang: string; onGoSubmittals: () => void;
}) {
  const { toast } = useToast();
  const [buildingLevels, setBuildingLevels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    fetch(`/api/v1/projects/${projectId}/levels`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(r => r.ok ? r.json() : { levels: [] })
      .then(data => {
        if (cancelled) return;
        setBuildingLevels(Array.isArray(data.levels)
          ? data.levels.filter((x: unknown): x is string => typeof x === "string" && x.trim() !== "")
          : []);
      })
      .catch(() => {
        if (!cancelled) setBuildingLevels([]);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const TRADE_ORDER = ["Plumbing", "HVAC", "Fire Protection", "Electrical", "Other"];
  function tradeOf(s: Submittal): string {
    if (s.trade) return s.trade;
    const t = (s.submittalCategory ?? s.submittalType ?? "").toLowerCase();
    if (t.includes("plumb")) return "Plumbing";
    if (t.includes("hvac") || t.includes("mechanical")) return "HVAC";
    if (t.includes("fire")) return "Fire Protection";
    if (t.includes("electr")) return "Electrical";
    return "Other";
  }
  function floorOf(s: Submittal): string {
    return s.floor || s.drawingNumber || w("Unassigned", "Sin asignar", lang);
  }

  function typeOf(s: Submittal): string {
    const raw = `${s.submittalType ?? ""} ${s.submittalCategory ?? ""}`.toLowerCase();
    if (raw.includes("sleeve") && (raw.includes("vert") || raw.includes("vertical") || raw.includes(" v"))) return "Sleeve V";
    if (raw.includes("sleeve") && (raw.includes("horiz") || raw.includes("horizontal") || raw.includes(" h"))) return "Sleeve H";
    if (raw.includes("shop")) return "Shop";
    if (raw.includes("sleeve")) return "Sleeve";
    return w("Other", "Otro", lang);
  }

  function trackerDateRaw(s: Submittal): string {
    const raw = s.reviewedAt || s.dateRequired || s.dueDate || s.dateSubmitted || s.createdAt;
    return raw ? String(raw).slice(0, 10) : "";
  }

  function trackerDateLabel(raw: string): string {
    if (!raw) return w("No date", "Sin fecha", lang);
    const d = new Date(raw);
    return isValid(d) ? format(d, "MM/dd/yy") : raw;
  }

  const [filterFloor, setFilterFloor] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filterOptions = useMemo(() => {
    const uniq = (rows: string[]) => Array.from(new Set(rows.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const uniqPreserve = (rows: string[]) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const row of rows) {
        const value = (row || "").trim();
        const key = value.toLowerCase();
        if (!value || seen.has(key)) continue;
        seen.add(key);
        out.push(value);
      }
      return out;
    };
    const standardTypes = ["Shop", "Sleeve V", "Sleeve H", "Sleeve", "Other"];
    return {
      floors: uniqPreserve([...buildingLevels, ...uniq(submittals.map(floorOf))]),
      types: uniqPreserve([...standardTypes, ...uniq(submittals.map(typeOf))]),
      dates: uniq(submittals.map(trackerDateRaw)),
      statuses: uniq(submittals.map(s => s.status || w("Unknown", "Desconocido", lang))),
    };
  }, [submittals, buildingLevels, lang]);

  const visibleSubmittals = useMemo(() => submittals.filter(s => {
    if (filterFloor && floorOf(s) !== filterFloor) return false;
    if (filterType && typeOf(s) !== filterType) return false;
    if (filterDate && trackerDateRaw(s) !== filterDate) return false;
    if (filterStatus && (s.status || w("Unknown", "Desconocido", lang)) !== filterStatus) return false;
    return true;
  }), [submittals, filterFloor, filterType, filterDate, filterStatus, lang]);

  if (submittals.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
        <ClipboardList size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          {w("No submittals yet. Create submittals in the Submittals tab to see them here.",
             "Sin entregables aun. Crea entregables en la pestana de Entregables para verlos aqui.", lang)}
        </div>
        <Button size="sm" onClick={onGoSubmittals}>
          {w("Go to Submittals", "Ir a Entregables", lang)}
        </Button>
      </div>
    );
  }

  const grouped: Record<string, Record<string, Submittal[]>> = {};
  for (const s of visibleSubmittals) {
    const tr = tradeOf(s);
    const fl = floorOf(s);
    if (!grouped[tr]) grouped[tr] = {};
    if (!grouped[tr][fl]) grouped[tr][fl] = [];
    grouped[tr][fl].push(s);
  }
  const groupedTradeKeys = Object.keys(grouped);
  const orderedTradeKeys = [
    ...TRADE_ORDER.filter(tr => groupedTradeKeys.includes(tr)),
    ...groupedTradeKeys.filter(tr => !TRADE_ORDER.includes(tr)).sort((a, b) => a.localeCompare(b)),
  ];

  function approvalCell(s: Submittal) {
    const d = (s.reviewDecision ?? "").toLowerCase();
    let bg = "#F3F4F6", color = "#374151", label = w("Pending", "Pendiente", lang);
    if (d === "approved") { bg = "#DCFCE7"; color = "#16A34A"; label = w("Approved", "Aprobado", lang); }
    else if (d === "approved_as_noted" || d === "approved as noted") { bg = "#FEF3C7"; color = "#D97706"; label = w("Approved as Noted", "Aprobado c/Notas", lang); }
    else if (d === "rejected") { bg = "#FEE2E2"; color = "#DC2626"; label = w("Rejected", "Rechazado", lang); }
    else if (d === "for_record" || d === "for record") { bg = "#DBEAFE"; color = "#1D4ED8"; label = w("For Record", "Para Registro", lang); }
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color }}>
        {label}
      </span>
    );
  }

  const overdueCount = visibleSubmittals.filter(s => {
    const raw = s.dateRequired || s.dueDate;
    return raw && new Date(raw).getTime() < Date.now() && !["approved", "approved_as_noted", "closed"].includes((s.status || "").toLowerCase());
  }).length;
  const missingResponsible = visibleSubmittals.filter(s => !s.responsibleCompany && !s.submittedByCompany).length;
  const missingDueDate = visibleSubmittals.filter(s => !s.dateRequired && !s.dueDate).length;
  const filtersActive = Boolean(filterFloor || filterType || filterDate || filterStatus);

  const downloadTracker = async (format: "pdf" | "excel") => {
    try {
      await downloadSubmittalTracker(projectId, format, { floor: filterFloor, type: filterType, date: filterDate, status: filterStatus });
      toast({
        title: format === "pdf"
          ? w("Tracker PDF exported", "PDF del seguimiento exportado", lang)
          : w("Tracker Excel exported", "Excel del seguimiento exportado", lang),
      });
    } catch {
      toast({
        title: w("Tracker export failed", "Error al exportar seguimiento", lang),
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1E3A5F" }}>
            {w("Submittal Tracking Table", "Tabla de Seguimiento de Entregables", lang)}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
            {w("Live control table by building level, drawing type, date, and review status.",
               "Tabla viva por nivel, tipo de plano, fecha y estado de revision.", lang)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="outline" onClick={() => downloadTracker("pdf")}>
            <Download style={{ width: 13, height: 13, marginRight: 4 }} />
            {w("Export PDF", "Exportar PDF", lang)}
          </Button>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(150px, 1fr)) auto",
        gap: 10,
        alignItems: "end",
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: 12,
        marginBottom: 14,
      }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#475569" }}>
          {w("Building Level", "Nivel", lang)}
          <select className="input" value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
            <option value="">{w("All Building Levels", "Todos los Niveles", lang)}</option>
            {filterOptions.floors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#475569" }}>
          {w("Drawing Type", "Tipo de Plano", lang)}
          <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">{w("All Drawing Types", "Todos los Tipos de Plano", lang)}</option>
            {filterOptions.types.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#475569" }}>
          {w("Date", "Fecha", lang)}
          <select className="input" value={filterDate} onChange={e => setFilterDate(e.target.value)}>
            <option value="">{w("All Dates", "Todas las Fechas", lang)}</option>
            {filterOptions.dates.map(v => <option key={v || "none"} value={v}>{trackerDateLabel(v)}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#475569" }}>
          {w("Review Status", "Estado de Revision", lang)}
          <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{w("All Review Statuses", "Todos los Estados de Revision", lang)}</option>
            {filterOptions.statuses.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={!filtersActive}
          onClick={() => { setFilterFloor(""); setFilterType(""); setFilterDate(""); setFilterStatus(""); }}
        >
          {w("Clear", "Limpiar", lang)}
        </Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {[
          [filtersActive ? w("Visible", "Visible", lang) : w("Total", "Total", lang), visibleSubmittals.length, "#1E3A5F"],
          [w("Overdue", "Vencidos", lang), overdueCount, overdueCount ? "#DC2626" : "#16A34A"],
          [w("Missing due date", "Sin fecha", lang), missingDueDate, missingDueDate ? "#D97706" : "#16A34A"],
          [w("Missing company", "Sin empresa", lang), missingResponsible, missingResponsible ? "#D97706" : "#16A34A"],
        ].map(([label, value, color]) => (
          <div key={String(label)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", background: "white" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 800, color: "#64748B" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: String(color), marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <Button size="sm" variant="outline" onClick={() => downloadTracker("excel")}>
          <Download style={{ width: 13, height: 13, marginRight: 4 }} />
          {w("Export Excel", "Exportar Excel", lang)}
        </Button>
      </div>

      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Floor","Shop","Sleeve V","Sleeve H","Submittal","Date","Description","Status","Version","RFI Open","RFI Close","RFI Description"].map(h => (
                <th key={h} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#374151",
                  textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedTradeKeys.map(tr => (
              <Fragment key={tr}>
                <tr>
                  <td colSpan={12} style={{ background: "#1E3A5F", color: "white", padding: "6px 12px",
                    fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{tr}</td>
                </tr>
                {Object.keys(grouped[tr]).sort().map(fl => (
                  <Fragment key={tr + fl}>
                    <tr>
                      <td colSpan={12} style={{ background: "#F0F7FF", color: "#1E40AF", padding: "5px 12px",
                        fontWeight: 700, fontSize: 11 }}>{fl}</td>
                    </tr>
                    {grouped[tr][fl].map(s => {
                      const trackerType = typeOf(s);
                      const trackerDate = trackerDateRaw(s);
                      return (
                        <tr key={s.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td style={{ padding: "6px 10px", fontSize: 11 }}>{fl}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11 }}>{trackerType === "Shop" ? "Yes" : ""}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11 }}>{trackerType === "Sleeve V" ? "X" : ""}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11 }}>{trackerType === "Sleeve H" ? "X" : ""}</td>
                          <td style={{ padding: "6px 10px" }}>{approvalCell(s)}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11, whiteSpace: "nowrap" }}>
                            {trackerDate ? trackerDateLabel(trackerDate) : "-"}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 11, maxWidth: 240 }}>{s.title}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>{s.status}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>
                            R{(s as any).revisionNumber ?? 0}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 11 }}>{s.linkedRfiId ? `RFI-${s.linkedRfiId}` : "-"}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11 }}>-</td>
                          <td style={{ padding: "6px 10px", fontSize: 11, color: "#6B7280", maxWidth: 200 }}>
                            {s.ballInCourt ? `${w("Ball in Court","Pelota en Cancha", lang)}: ${s.ballInCourt}` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main SubmittalsTab ───────────────────────────────────────────────────────
export function SubmittalsTab({ projectId, canWrite = true, initialView = "submittals" }: {
  projectId: number; canWrite?: boolean; initialView?: "register" | "submittals" | "tracking";
}) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [view, setView] = useState<"register" | "submittals" | "tracking">(initialView);
  const [selectedSubmittal, setSelectedSubmittal] = useState<Submittal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const submittalsQueryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => { setView(initialView); }, [initialView, projectId]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/projects/${projectId}/submittals/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        let msg = `${data.imported ?? 0} submittals imported successfully`;
        if (data.renameCount > 0) msg += `. ${data.renameCount} duplicate(s) renamed with DRF suffix`;
        setImportMsg(msg);
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setImportMsg("Import failed - please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const { data: submittals = [], isLoading } = useListSubmittals(projectId) as {
    data: Submittal[]; isLoading: boolean;
  };

  const handleTrackerExport = async (format: "pdf" | "excel") => {
    try {
      await downloadSubmittalTracker(projectId, format);
      toast({
        title: format === "pdf"
          ? w("Submittal tracker PDF exported", "PDF de seguimiento exportado", lang)
          : w("Submittal tracker Excel exported", "Excel de seguimiento exportado", lang),
      });
    } catch {
      toast({ title: w("Export failed", "Error al exportar", lang), variant: "destructive" });
    }
  };

  const pendingCount = submittals.filter(s => !["approved", "approved_as_noted", "rejected"].includes(s.status)).length;
  const approvedCount = submittals.filter(s => s.status === "approved" || s.status === "approved_as_noted").length;
  const actionNeeded = submittals.filter(s => {
    const d = daysOut(s.createdAt);
    return ["submitted", "under_review"].includes(s.status) && d !== null && d > 14;
  }).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1E3A5F" }}>
            {w("Submittals", "Entregables", lang)}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            {submittals.length} {w("total", "total", lang)} - {pendingCount} {w("pending", "pendiente", lang)} - {approvedCount} {w("approved", "aprobado", lang)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <span className="btn btn-outline btn-sm" style={{ fontSize: 12, opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? w("Importing...","Importando...",lang) : w("Import","Importar",lang)}
              </span>
            </label>
          )}
          <Button size="sm" variant="outline" onClick={() => handleTrackerExport("excel")} style={{ gap: 5, fontSize: 12 }}>
            <Download style={{ width: 13, height: 13 }} />
            {w("Export Excel", "Exportar Excel", lang)}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTrackerExport("pdf")} style={{ gap: 5, fontSize: 12 }}>
            <FileText style={{ width: 13, height: 13 }} />
            {w("Export PDF", "Exportar PDF", lang)}
          </Button>
          {importMsg && <span style={{ fontSize: 12, color: "#1D4ED8" }}>{importMsg}</span>}
          {canWrite && (
            <Button size="sm" onClick={() => setShowNewForm(true)} style={{ gap: 5, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />
              {w("New Submittal", "Nuevo Entregable", lang)}
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #E5E7EB", marginBottom: 16 }}>
        {[
          ["submittals", w("Submittals", "Entregables", lang)],
          ["register", w("Register", "Registro", lang)],
          ["tracking", w("Tracking Table", "Tabla de Seguimiento", lang)],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key as typeof view)}
            style={{
              border: "none",
              borderBottom: view === key ? "2px solid #2563EB" : "2px solid transparent",
              background: "transparent",
              color: view === key ? "#1D4ED8" : "#64748B",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              padding: "0 0 9px",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action needed banner */}
      {actionNeeded > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
          padding: "9px 13px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#B45309",
        }}>
          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <strong>{actionNeeded}</strong>&nbsp;{w("submittal(s) under review for 14+ days - follow up required.", "entregable(s) en revisión por 14+ días - seguimiento requerido.", lang)}
        </div>
      )}

      {view === "register" ? (
        <RegisterView projectId={projectId} canWrite={canWrite} lang={lang} />
      ) : view === "tracking" ? (
        <SubmittalTrackingList projectId={projectId} submittals={submittals} lang={lang} onGoSubmittals={() => setView("submittals")} />
      ) : (
        <SubmittalsList
          onRequestDelete={(s) => setDeleteTarget({ id: s.id, label: s.number })}
          projectId={projectId}
          submittals={submittals}
          isLoading={isLoading}
          lang={lang}
          canWrite={canWrite}
          onSelect={(s) => setSelectedSubmittal(s)}
        />
      )}

      {/* New Submittal Slide-out */}
      <SlidePanel
        open={showNewForm}
        onClose={() => setShowNewForm(false)}
        title={w("New Submittal", "Nuevo Entregable", lang)}
        width={700}
      >
        <NewSubmittalForm
          projectId={projectId}
          lang={lang}
          onClose={() => setShowNewForm(false)}
        />
      </SlidePanel>

      {/* Submittal Detail Slide-out */}
      <SlidePanel
        open={!!selectedSubmittal}
        onClose={() => setSelectedSubmittal(null)}
        title={selectedSubmittal ? `${selectedSubmittal.number} - ${selectedSubmittal.title}` : ""}
        width={720}
      >
        {selectedSubmittal && (
          <SubmittalDetail
            projectId={projectId}
            submittal={selectedSubmittal}
            lang={lang}
            canWrite={canWrite}
            onClose={() => setSelectedSubmittal(null)}
            onUpdated={(updated) => setSelectedSubmittal(updated)}
          />
        )}
      </SlidePanel>

      {deleteTarget && (
        <DeleteConfirmModal
          open
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            submittalsQueryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
            setDeleteTarget(null);
          }}
          endpoint={`/api/v1/projects/${projectId}/submittals/${deleteTarget.id}`}
          entityLabel={`Submittal ${deleteTarget.label}`}
          warning={lang === "es" ? "Los elementos enlazados serán desvinculados." : "Linked items will be detached."}
        />
      )}
    </div>
  );
}

// ─── Register View ────────────────────────────────────────────────────────────
function RegisterView({ projectId, canWrite, lang }: { projectId: number; canWrite: boolean; lang: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ specSection: "", description: "", trade: "", submittalType: "", requiredByDate: "", leadTimeDays: "", responsibleCompany: "", status: "pending" });

  const fetchRegister = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittal-register`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) setItems(await r.json() as RegisterItem[]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void fetchRegister(); }, [projectId]);

  const save = async () => {
    const body = { ...form, leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : undefined };
    const url = editId
      ? `/api/v1/projects/${projectId}/submittal-register/${editId}`
      : `/api/v1/projects/${projectId}/submittal-register`;
    const r = await fetch(url, {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      toast({ title: editId ? w("Item updated", "Ítem actualizado", lang) : w("Item added", "Ítem agregado", lang) });
      setShowForm(false); setEditId(null);
      setForm({ specSection: "", description: "", trade: "", submittalType: "", requiredByDate: "", leadTimeDays: "", responsibleCompany: "", status: "pending" });
      void fetchRegister();
    } else {
      toast({ title: w("Failed to save", "Error al guardar", lang), variant: "destructive" });
    }
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/v1/projects/${projectId}/submittal-register/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    void fetchRegister();
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
      let imported = 0;
      for (const row of rows) {
        const specSection = row["Spec Section"] || row["spec_section"] || row["SpecSection"] || "";
        const description = row["Description"] || row["description"] || "";
        if (!specSection || !description) continue;
        await fetch(`/api/v1/projects/${projectId}/submittal-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            specSection, description,
            trade: row["Trade"] || row["trade"] || "",
            submittalType: row["Type"] || row["type"] || row["submittal_type"] || "",
            requiredByDate: row["Required By"] || row["required_by_date"] || "",
            responsibleCompany: row["Responsible Company"] || row["responsible_company"] || "",
          }),
        });
        imported++;
      }
      toast({ title: `${imported} ${w("items imported", "ítems importados", lang)}` });
      void fetchRegister();
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // Group by spec section
  const grouped: Record<string, RegisterItem[]> = {};
  items.forEach(item => {
    const k = item.specSection;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1E3A5F" }}>
            {w("Required Submittal Register", "Registro de Entregables Requeridos", lang)}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            {items.length} {w("planned requirements from the spec book. Actual received packages live in Submittals; the Tracking Table combines them for control.", "requisitos planificados del libro de especificaciones. Los paquetes recibidos viven en Entregables; la Tabla de Seguimiento los combina para control.", lang)}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {canWrite && (
          <>
            <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleCSV} />
            <Button variant="outline" size="sm" style={{ fontSize: 11, gap: 5 }} onClick={() => csvRef.current?.click()}>
              <Download style={{ width: 12, height: 12 }} />
              {w("Import from Spec Book", "Importar desde Libro de Especificaciones", lang)}
            </Button>
            <Button size="sm" style={{ fontSize: 11, gap: 5 }} onClick={() => { setEditId(null); setShowForm(true); }}>
              <Plus style={{ width: 12, height: 12 }} />
              {w("New Item", "Nuevo Ítem", lang)}
            </Button>
          </>
        )}
      </div>

      {showForm && (
        <div style={{ border: "1.5px solid #C4B5FD", borderRadius: 10, padding: 16, marginBottom: 14, background: "#F5F3FF" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#4C1D95", marginBottom: 12 }}>
            {editId ? w("Edit Item", "Editar Ítem", lang) : w("New Register Item", "Nuevo Ítem de Registro", lang)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={w("Spec Section *", "Sección de Especificación *", lang)}>
              <FieldInput placeholder="23 00 00" value={form.specSection} onChange={e => setForm(f => ({ ...f, specSection: e.target.value }))} />
            </Field>
            <Field label={w("Trade", "Gremio", lang)}>
              <FieldInput value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} />
            </Field>
            <Field label={w("Description *", "Descripción *", lang)} >
              <FieldInput value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label={w("Submittal Type", "Tipo de Entregable", lang)}>
              <FieldSelect value={form.submittalType} onChange={e => setForm(f => ({ ...f, submittalType: e.target.value }))}>
                <option value="">-</option>
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </FieldSelect>
            </Field>
            <Field label={w("Required By", "Requerido Para", lang)}>
              <FieldInput type="date" value={form.requiredByDate} onChange={e => setForm(f => ({ ...f, requiredByDate: e.target.value }))} />
            </Field>
            <Field label={w("Lead Time (days)", "Tiempo de Entrega (días)", lang)}>
              <FieldInput type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} />
            </Field>
            <Field label={w("Responsible Company", "Empresa Responsable", lang)}>
              <FieldInput value={form.responsibleCompany} onChange={e => setForm(f => ({ ...f, responsibleCompany: e.target.value }))} />
            </Field>
            <Field label={w("Status", "Estado", lang)}>
              <FieldSelect value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {REGISTER_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </FieldSelect>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button size="sm" onClick={save} disabled={!form.specSection || !form.description} style={{ fontSize: 12 }}>
              {w("Save", "Guardar", lang)}
            </Button>
            <Button variant="outline" size="sm" style={{ fontSize: 12 }} onClick={() => { setShowForm(false); setEditId(null); }}>
              {w("Cancel", "Cancelar", lang)}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite", color: "#6B7280" }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF" }}>
          <BookOpen style={{ width: 28, height: 28, margin: "0 auto 10px" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{w("No register items yet", "Sin ítems de registro aún", lang)}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{w("Add items manually or import from a spec book CSV.", "Agregue ítems manualmente o importe desde un CSV.", lang)}</div>
        </div>
      ) : (
        Object.entries(grouped).map(([spec, rows]) => (
          <div key={spec} style={{ marginBottom: 18 }}>
            <div style={{ padding: "5px 10px", background: "#1E3A5F", borderRadius: "6px 6px 0 0", fontSize: 11, fontWeight: 700, color: "white" }}>
              {w("Section", "Sección", lang)} {spec}
            </div>
            <div className="table-card" style={{ borderRadius: "0 0 8px 8px", marginTop: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{w("Description", "Descripción", lang)}</th>
                    <th style={{ width: 90 }}>{w("Trade", "Gremio", lang)}</th>
                    <th style={{ width: 100 }}>{w("Type", "Tipo", lang)}</th>
                    <th style={{ width: 100 }}>{w("Required By", "Requerido Para", lang)}</th>
                    <th style={{ width: 60 }}>{w("Lead", "Plazo", lang)}</th>
                    <th style={{ width: 120 }}>{w("Responsible", "Responsable", lang)}</th>
                    <th style={{ width: 90 }}>{w("Status", "Estado", lang)}</th>
                    {canWrite && <th style={{ width: 60 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontSize: 12 }}>{item.description}</td>
                      <td style={{ fontSize: 11, color: "#6B7280" }}>{item.trade || "-"}</td>
                      <td style={{ fontSize: 11, color: "#6B7280" }}>{item.submittalType ? (CATEGORY_OPTIONS.find(o => o.value === item.submittalType)?.[lang === "es" ? "labelEs" : "label"] || item.submittalType) : "-"}</td>
                      <td style={{ fontSize: 11 }}>{item.requiredByDate ? format(new Date(item.requiredByDate), "MMM d, yyyy") : "-"}</td>
                      <td style={{ fontSize: 11 }}>{item.leadTimeDays ? `${item.leadTimeDays}d` : "-"}</td>
                      <td style={{ fontSize: 11 }}>{item.responsibleCompany || "-"}</td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "2px 7px", borderRadius: 10,
                          background: item.status === "approved" ? "#F0FDF4" : item.status === "rejected" ? "#FFF1F2" : "#F3F4F6",
                          color: item.status === "approved" ? "#15803D" : item.status === "rejected" ? "#DC2626" : "#6B7280",
                          fontSize: 10, fontWeight: 600,
                        }}>
                          {REGISTER_STATUS_OPTIONS.find(o => o.value === item.status)?.[lang === "es" ? "labelEs" : "label"] || item.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            onClick={() => {
                              setEditId(item.id);
                              setForm({
                                specSection: item.specSection || "",
                                description: item.description || "",
                                trade: item.trade || "",
                                submittalType: item.submittalType || "",
                                requiredByDate: item.requiredByDate ? item.requiredByDate.slice(0, 10) : "",
                                leadTimeDays: item.leadTimeDays ? String(item.leadTimeDays) : "",
                                responsibleCompany: item.responsibleCompany || "",
                                status: item.status || "pending",
                              });
                              setShowForm(true);
                            }}
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#1D4ED8", padding: 4 }}
                            title={w("Edit", "Editar", lang)}
                          >
                            <Pencil style={{ width: 12, height: 12 }} />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#DC2626", padding: 4 }}
                            title={w("Delete", "Eliminar", lang)}
                          >
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Submittals List ──────────────────────────────────────────────────────────
function SubmittalsList({ projectId, submittals, isLoading, lang, canWrite, onSelect, onRequestDelete }: {
  onRequestDelete: (s: Submittal) => void;
  projectId: number; submittals: Submittal[]; isLoading: boolean; lang: string; canWrite: boolean;
  onSelect: (s: Submittal) => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const handleExport = async (format: "pdf" | "excel") => {
    if (format === "excel") {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/export-excel`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) {
        toast({ title: w("Excel export failed", "Error al exportar Excel", lang), variant: "destructive" });
        return;
      }
      const blob = await r.blob();
      downloadBlob(blob, `Submittal-Log-Project${projectId}.xlsx`);
      toast({ title: w("Excel exported", "Excel exportado", lang) });
      return;
    }
    toast({ title: w("Generating PDF…", "Generando PDF…", lang) });
    const r = await fetch(`/api/v1/projects/${projectId}/submittals/export-all`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (r.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Submittal-Log-Project${projectId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } else {
      toast({ title: w("PDF export failed", "Error al exportar PDF", lang), variant: "destructive" });
    }
  };

  const handleRowExport = async (s: Submittal, fmt: "pdf" | "word") => {
    const endpoint = fmt === "pdf"
      ? `/api/v1/projects/${projectId}/submittals/${s.id}/export`
      : `/api/v1/projects/${projectId}/submittals/${s.id}/export-word`;
    const ext = fmt === "pdf" ? "pdf" : "doc";
    const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (r.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${s.number}-Submittal.${ext}`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filtered = submittals.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.title.toLowerCase().includes(q) || s.number.toLowerCase().includes(q) || (s.specSection || "").toLowerCase().includes(q) || (s.manufacturer || "").toLowerCase().includes(q);
    const matchStatus = !filterStatus || s.status === filterStatus;
    const matchType = !filterType || s.submittalCategory === filterType || s.submittalType === filterType;
    return matchQ && matchStatus && matchType;
  });

  if (isLoading) {
    return <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
    </div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#9CA3AF" }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={w("Search submittals…", "Buscar entregables…", lang)}
            style={{ paddingLeft: 28, height: 34, fontSize: 12 }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ height: 34, fontSize: 12, border: "1px solid #D1D5DB", borderRadius: 6, padding: "0 8px", background: "white" }}
        >
          <option value="">{w("All Statuses", "Todos los Estados", lang)}</option>
          {Object.entries(STATUS_BADGE).map(([k, v]) => (
            <option key={k} value={k}>{lang === "es" ? v.labelEs : v.label}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ height: 34, fontSize: 12, border: "1px solid #D1D5DB", borderRadius: 6, padding: "0 8px", background: "white" }}
        >
          <option value="">{w("All Types", "Todos los Tipos", lang)}</option>
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
        </select>
        <Button variant="outline" size="sm" style={{ fontSize: 11, gap: 5 }} onClick={() => handleExport("excel")}>
          <Download style={{ width: 12, height: 12 }} />
          {w("Export Excel", "Exportar Excel", lang)}
        </Button>
      </div>

      {submittals.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#9CA3AF" }}>
          <FileCheck style={{ width: 28, height: 28, margin: "0 auto 10px", color: "#D1D5DB" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>{w("No submittals yet", "Sin entregables aún", lang)}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{w("Create your first submittal using the New Submittal button.", "Cree su primer entregable con el botón Nuevo Entregable.", lang)}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 20px", color: "#9CA3AF", fontSize: 13 }}>
          {w("No submittals match your filters.", "Sin entregables que coincidan con los filtros.", lang)}
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{w("Number", "Número", lang)}</th>
                <th>{w("Title", "Título", lang)}</th>
                <th style={{ width: 110 }}>{w("Category", "Categoría", lang)}</th>
                <th style={{ width: 120 }}>{w("Status", "Estado", lang)}</th>
                <th style={{ width: 90 }}>{w("Spec Section", "Sección", lang)}</th>
                <th style={{ width: 110 }}>{w("Submitted By", "Enviado Por", lang)}</th>
                <th style={{ width: 110 }}>{w("Submitted To", "Enviado A", lang)}</th>
                <th style={{ width: 90 }}>{w("Date Req.", "Fecha Req.", lang)}</th>
                <th style={{ width: 60, textAlign: "center" }}>{w("Days", "Días", lang)}</th>
                <th style={{ width: 110 }}>{w("Ball in Court", "En Espera De", lang)}</th>
                <th style={{ width: 60, textAlign: "center" }}>AI</th>
                <th style={{ width: 90, textAlign: "center" }}>{w("Export", "Exportar", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => {
                const days = daysOut(sub.createdAt);
                const isUrgent = ["submitted", "under_review"].includes(sub.status) && days !== null && days > 14;
                const aiCheck = sub.aiCheckResult as AiCheckResult | null;
                return (
                  <tr key={sub.id} onClick={() => onSelect(sub)} style={{ cursor: "pointer" }}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "#6B7280" }}>
                        {sub.number}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isUrgent && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", flexShrink: 0 }} />}
                        {sub.rapidApprovalFlag && <TriangleAlert style={{ width: 11, height: 11, color: "#D97706", flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{sub.title}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 10, color: "#6B7280" }}>
                      {CATEGORY_OPTIONS.find(o => o.value === (sub.submittalCategory || sub.submittalType))?.[lang === "es" ? "labelEs" : "label"] || sub.submittalCategory || sub.submittalType}
                    </td>
                    <td><StatusBadge status={sub.status} lang={lang} /></td>
                    <td style={{ fontSize: 11, color: "#6B7280" }}>{sub.specSection || "-"}</td>
                    <td style={{ fontSize: 11 }}>{sub.submittedByCompany || sub.submittedByName || "-"}</td>
                    <td style={{ fontSize: 11 }}>{sub.submittedToCompany || "-"}</td>
                    <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(sub.dateRequired || sub.dueDate)}</td>
                    <td style={{ textAlign: "center" }}>
                      {days !== null && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: isUrgent ? "#DC2626" : days > 7 ? "#D97706" : "#15803D" }}>
                          {days}d
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: "#1E3A5F" }}>{sub.ballInCourt || "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      {sub.aiCheckRan && aiCheck && <AiBadge result={aiCheck.overall} />}
                    </td>
                    <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button
                          onClick={() => handleRowExport(sub, "pdf")}
                          title="Export PDF"
                          style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 10, color: "#DC2626" }}
                        >PDF</button>
                        <button
                          onClick={() => handleRowExport(sub, "word")}
                          title="Export Word"
                          style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 10, color: "#1D4ED8" }}
                        >DOC</button>
                        {canWrite && (
                          <button
                            onClick={() => onRequestDelete(sub)}
                            title="Delete submittal"
                            style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── New Submittal Form ───────────────────────────────────────────────────────
function NewSubmittalForm({ projectId, lang, onClose }: { projectId: number; lang: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [form, setForm] = useState({
    title: "", specSection: "", submittalCategory: "shop_drawing", submittalType: "shop_drawing",
    trade: "", floor: "", responsibleCompany: "",
    drawingNumber: "", drawingTitle: "",
    dateSubmitted: new Date().toISOString().slice(0, 10),
    dateRequired: "",
    submittedByCompany: "", submittedByPerson: "", submittedByEmail: "", submittedByPhone: "", submittedByAddress: "",
    submittedToCompany: "", submittedToPerson: "", submittedToEmail: "", submittedToExternal: false,
    manufacturer: "", modelNumber: "", description: "",
    procurementStatus: "not_ordered",
    ballInCourt: "",
    linkedRfiId: "",
    distributionList: "",
    attachmentsJson: [] as string[],
  });

  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiCheckLoading, setAiCheckLoading] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<AiCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [byEmailError, setByEmailError] = useState("");
  const [toEmailError, setToEmailError] = useState("");
  const attachFileRef = useRef<HTMLInputElement>(null);

  const validateEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const procureWarning = ["on_order", "delivered", "installed"].includes(form.procurementStatus);

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        submittedByPerson: user.fullName || "",
        submittedByEmail: user.email || "",
        distributionList: user.email || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    void fetch(`/api/v1/projects/${projectId}/rfis`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setRfis(data as RFI[]));
    void fetch(`/api/v1/projects/${projectId}/files`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setProjectFiles(data as ProjectFile[]));
    void fetch(`/api/v1/projects/${projectId}/directory`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setDirectory(data as DirectoryEntry[]));
  }, [projectId]);

  const companyOptions = uniqSorted([
    ...directory.map(d => d.companyName),
    form.responsibleCompany,
    form.submittedByCompany,
    form.submittedToCompany,
  ]);
  const contactOptions = uniqSorted([
    ...directory.map(d => d.fullName),
    form.submittedByPerson,
    form.submittedToPerson,
  ]);
  const emailOptions = uniqSorted([
    ...directory.map(d => d.email),
    form.submittedByEmail,
    form.submittedToEmail,
  ]);
  const responsibleOptions = uniqSorted([
    ...companyOptions,
    ...contactOptions,
    ...emailOptions,
    form.ballInCourt,
  ]);

  const addAttachmentName = (name: string) => {
    if (!name) return;
    setForm(f => {
      const next = [...f.attachmentsJson];
      if (!next.includes(name)) next.push(name);
      return { ...f, attachmentsJson: next };
    });
  };

  const uploadAndAttachFile = async (file: File) => {
    setUploadingAttachment(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upload = await fetch(`/api/v1/projects/${projectId}/submittals/attachments/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const body = await upload.json().catch(() => ({})) as { fileName?: string; downloadUrl?: string; error?: string };
      if (!upload.ok) throw new Error(body.error || "Upload failed");
      addAttachmentName(body.downloadUrl || body.fileName || file.name);
      toast({ title: w("Attachment uploaded", "Adjunto subido", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Upload failed", "Error al subir", lang), variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAiAssist = async () => {
    setAiAssistLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/ai-assist-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          userDescription: form.description,
          specSection: form.specSection,
          submittalCategory: form.submittalCategory,
          title: form.title,
          trade: form.trade,
          floor: form.floor,
          manufacturer: form.manufacturer,
          modelNumber: form.modelNumber,
        }),
      });
      if (r.ok) {
        const d = await r.json() as { suggestion: string };
        setForm(f => ({ ...f, description: d.suggestion }));
      }
    } catch { toast({ title: w("AI assist failed", "Error de asistencia IA", lang), variant: "destructive" }); }
    finally { setAiAssistLoading(false); }
  };

  const handleAiCheck = async () => {
    setAiCheckLoading(true);
    try {
      if (!savedId) {
        const r = await fetch(`/api/v1/projects/${projectId}/submittals/inline-ai-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            title: form.title,
            specSection: form.specSection,
            submittalCategory: form.submittalCategory,
            submittedByCompany: form.submittedByCompany,
            submittedToCompany: form.submittedToCompany,
            description: form.description,
            manufacturer: form.manufacturer,
            modelNumber: form.modelNumber,
          }),
        });
        if (r.ok) setAiCheckResult(await r.json() as AiCheckResult);
      } else {
        const r = await fetch(`/api/v1/projects/${projectId}/submittals/${savedId}/ai-check`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (r.ok) setAiCheckResult(await r.json() as AiCheckResult);
      }
    } catch { toast({ title: w("AI check failed", "Error de verificación IA", lang), variant: "destructive" }); }
    finally { setAiCheckLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.title) { toast({ title: w("Title is required", "El título es requerido", lang), variant: "destructive" }); return; }
    if (!validateEmail(form.submittedByEmail)) { setByEmailError(w("Invalid email address - please check before submitting.", "Correo inválido - verifique antes de enviar.", lang)); return; }
    if (!validateEmail(form.submittedToEmail)) { setToEmailError(w("Invalid email address - please check before submitting.", "Correo inválido - verifique antes de enviar.", lang)); return; }
    setSubmitting(true);
    try {
      const body = {
        ...form,
        linkedRfiId: form.linkedRfiId ? parseInt(form.linkedRfiId) : undefined,
        distributionList: form.distributionList ? form.distributionList.split(",").map(s => s.trim()).filter(Boolean) : [],
      };
      const r = await fetch(`/api/v1/projects/${projectId}/submittals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const created = await r.json() as { id: number };
        setSavedId(created.id);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
        toast({ title: w("Submittal created", "Entregable creado", lang) });
        onClose();
      } else {
        const err = await r.json() as { error: string };
        toast({ title: err.error || w("Failed to create", "Error al crear", lang), variant: "destructive" });
      }
    } finally { setSubmitting(false); }
  };

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ paddingTop: 4 }}>
      <input
        ref={attachFileRef}
        type="file"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void uploadAndAttachFile(file);
          e.currentTarget.value = "";
        }}
      />
      <datalist id="new-submittal-companies">
        {companyOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id="new-submittal-contacts">
        {contactOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id="new-submittal-emails">
        {emailOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id="new-submittal-responsible-parties">
        {responsibleOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      {/* Section 1: Header */}
      <PanelSection title={w("1. Submittal Header", "1. Encabezado del Entregable", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Date Submitted", "Fecha de Envío", lang)}>
          <FieldInput type="date" value={form.dateSubmitted} onChange={e => set("dateSubmitted", e.target.value)} />
        </Field>
        <Field label={w("Date Required", "Fecha Requerida", lang)}>
          <FieldInput type="date" value={form.dateRequired} onChange={e => set("dateRequired", e.target.value)} />
        </Field>
        <Field label={w("Spec Section", "Sección de Especificación", lang)}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <FieldInput placeholder="23 00 00" value={form.specSection} onChange={e => set("specSection", e.target.value)} />
            <FileSearchButton projectId={projectId} lang={lang} onSelect={v => set("specSection", v.replace(/\.[^.]+$/, ""))} />
          </div>
        </Field>
        <Field label={w("Submittal Category", "Categoría de Entregable", lang)}>
          <FieldSelect value={form.submittalCategory} onChange={e => set("submittalCategory", e.target.value)}>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
          </FieldSelect>
        </Field>
      </div>
      <Field label={w("Title *", "Título *", lang)}>
        <FieldInput value={form.title} onChange={e => set("title", e.target.value)} placeholder={w("Submittal title…", "Título del entregable…", lang)} />
      </Field>

      {/* Section 2: Submitted By */}
      <PanelSection title={w("2. Submitted By", "2. Enviado Por", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Company", "Empresa", lang)}>
          <FieldInput list="new-submittal-companies" placeholder={w("Pick an existing company or type a new one", "Seleccione una empresa o escriba una nueva", lang)} value={form.submittedByCompany} onChange={e => set("submittedByCompany", e.target.value)} />
        </Field>
        <Field label={w("Contact Person", "Persona de Contacto", lang)}>
          <FieldInput list="new-submittal-contacts" placeholder={w("Pick an existing contact or type a new one", "Seleccione un contacto o escriba uno nuevo", lang)} value={form.submittedByPerson} onChange={e => set("submittedByPerson", e.target.value)} />
        </Field>
        <Field label={w("Phone", "Teléfono", lang)}>
          <FieldInput value={form.submittedByPhone} onChange={e => set("submittedByPhone", e.target.value)} />
        </Field>
        <Field label={w("Email", "Correo", lang)}>
          <FieldInput
            type="email"
            list="new-submittal-emails"
            placeholder={w("Pick an existing email or type a new one", "Seleccione un correo o escriba uno nuevo", lang)}
            value={form.submittedByEmail}
            onChange={e => { set("submittedByEmail", e.target.value); if (byEmailError) setByEmailError(""); }}
            onBlur={() => !validateEmail(form.submittedByEmail) ? setByEmailError(w("Invalid email address - please check before submitting.", "Correo inválido - verifique antes de enviar.", lang)) : setByEmailError("")}
            style={byEmailError ? { border: "1.5px solid #DC2626" } : undefined}
          />
          {byEmailError && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>{byEmailError}</p>}
        </Field>
      </div>

      {/* Section 3: Submitted To */}
      <PanelSection title={w("3. Submitted To", "3. Enviado A", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Company", "Empresa", lang)}>
          <FieldInput list="new-submittal-companies" placeholder={w("Pick an existing company or type a new one", "Seleccione una empresa o escriba una nueva", lang)} value={form.submittedToCompany} onChange={e => set("submittedToCompany", e.target.value)} />
        </Field>
        <Field label={w("Contact Person", "Persona de Contacto", lang)}>
          <FieldInput list="new-submittal-contacts" placeholder={w("Pick an existing contact or type a new one", "Seleccione un contacto o escriba uno nuevo", lang)} value={form.submittedToPerson} onChange={e => set("submittedToPerson", e.target.value)} />
        </Field>
        <Field label={w("Email", "Correo", lang)}>
          <FieldInput
            type="email"
            list="new-submittal-emails"
            placeholder={w("Pick an existing email or type a new one", "Seleccione un correo o escriba uno nuevo", lang)}
            value={form.submittedToEmail}
            onChange={e => { set("submittedToEmail", e.target.value); if (toEmailError) setToEmailError(""); }}
            onBlur={() => !validateEmail(form.submittedToEmail) ? setToEmailError(w("Invalid email address - please check before submitting.", "Correo inválido - verifique antes de enviar.", lang)) : setToEmailError("")}
            style={toEmailError ? { border: "1.5px solid #DC2626" } : undefined}
          />
          {toEmailError && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>{toEmailError}</p>}
        </Field>
        <Field label={w("External Contact?", "¿Contacto Externo?", lang)}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 6 }}>
            <input type="checkbox" checked={form.submittedToExternal} onChange={e => set("submittedToExternal", e.target.checked)} />
            {w("Yes, external to project", "Sí, externo al proyecto", lang)}
          </label>
        </Field>
      </div>

      {/* Section 4: Product Info */}
      <PanelSection title={w("4. Product Information", "4. Información del Producto", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Manufacturer", "Fabricante", lang)}>
          <FieldInput value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} />
        </Field>
        <Field label={w("Model Number", "Número de Modelo", lang)}>
          <FieldInput value={form.modelNumber} onChange={e => set("modelNumber", e.target.value)} />
        </Field>
        <Field label={w("Responsible Company", "Empresa Responsable", lang)}>
          <FieldInput list="new-submittal-companies" placeholder={w("Pick an existing company or type a new one", "Seleccione una empresa o escriba una nueva", lang)} value={form.responsibleCompany} onChange={e => set("responsibleCompany", e.target.value)} />
        </Field>
        <Field label={w("Current Responsible Party (Ball in Court)", "Responsable Actual", lang)}>
          <FieldInput list="new-submittal-responsible-parties" placeholder={w("Pick the company, contact, or email that owns the next action", "Seleccione la empresa, contacto o correo responsable de la proxima accion", lang)} value={form.ballInCourt} onChange={e => set("ballInCourt", e.target.value)} />
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
            {w("This is not a free-form status. It identifies who owns the next action right now.", "No es un estado libre. Identifica quien tiene la proxima accion ahora.", lang)}
          </div>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Add Existing Project File", "Agregar Archivo Existente", lang)}>
          <FieldSelect value="" onChange={e => addAttachmentName(e.target.value)}>
            <option value="">{projectFiles.length ? w("Select file to attach", "Seleccione archivo", lang) : w("No project files uploaded", "Sin archivos del proyecto", lang)}</option>
            {projectFiles.map(file => (
              <option key={file.id} value={file.fileUrl || file.fileName}>{file.fileName}</option>
            ))}
          </FieldSelect>
        </Field>
        <Field label={w("Upload From Computer", "Subir Desde Computadora", lang)}>
          <Button type="button" variant="outline" size="sm" disabled={uploadingAttachment} onClick={() => attachFileRef.current?.click()} style={{ width: "100%", fontSize: 12, gap: 5 }}>
            {uploadingAttachment ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Paperclip style={{ width: 12, height: 12 }} />}
            {uploadingAttachment ? w("Uploading...", "Subiendo...", lang) : w("Attach file now", "Adjuntar archivo ahora", lang)}
          </Button>
        </Field>
      </div>
      {form.attachmentsJson.length > 0 && (
        <Field label={w("Attachments / Product Files", "Archivos / Producto", lang)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {form.attachmentsJson.map((name, idx) => (
              <div key={`${name}-${idx}`} style={{ fontSize: 11, color: "#374151", background: "white", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 7px" }}>
                {attachmentLabel(name)}
              </div>
            ))}
          </div>
        </Field>
      )}
      <Field label={w("Description of Submittal", "Descripción del Entregable", lang)}>
        <FieldTextarea
          rows={5}
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder={w("Describe what is being submitted and why…", "Describa qué se envía y por qué…", lang)}
        />
        <button
          onClick={handleAiAssist}
          disabled={aiAssistLoading}
          style={{
            marginTop: 6, display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 6, border: "none", background: "#7C3AED",
            color: "white", cursor: "pointer", fontSize: 11, fontWeight: 600,
          }}
        >
          {aiAssistLoading ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 11, height: 11 }} />}
          {w("AI Assist", "Asistencia IA", lang)}
        </button>
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
          {w("Text-only assist. It does not read attached files or images.", "Asistencia solo con texto. No lee archivos ni imagenes adjuntas.", lang)}
        </div>
      </Field>

      {/* Section 5: Reference Documents */}
      <PanelSection title={w("5. Reference Documents", "5. Documentos de Referencia", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Drawing Number", "Número de Plano", lang)}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <FieldInput value={form.drawingNumber} onChange={e => set("drawingNumber", e.target.value)} />
            <FileSearchButton projectId={projectId} lang={lang} onSelect={v => set("drawingNumber", v.replace(/\.[^.]+$/, ""))} />
          </div>
          <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{w("For reference only - enter the drawing number exactly as it appears on the project drawing set. This does not validate against uploaded files.", "Solo referencia - ingrese el número tal como aparece en el juego de planos. No valida contra archivos subidos.", lang)}</p>
        </Field>
        <Field label={w("Drawing Title", "Título de Plano", lang)}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <FieldInput value={form.drawingTitle} onChange={e => set("drawingTitle", e.target.value)} />
            <FileSearchButton projectId={projectId} lang={lang} onSelect={v => set("drawingTitle", v.replace(/\.[^.]+$/, ""))} />
          </div>
          <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{w("For reference only - enter the drawing number exactly as it appears on the project drawing set. This does not validate against uploaded files.", "Solo referencia - ingrese el número tal como aparece en el juego de planos. No valida contra archivos subidos.", lang)}</p>
        </Field>
        <Field label={w("Related RFI", "RFI Relacionado", lang)}>
          <FieldSelect value={form.linkedRfiId} onChange={e => set("linkedRfiId", e.target.value)}>
            <option value="">{rfis.length === 0 ? w("No RFIs on this project yet", "Sin RFIs en este proyecto aún", lang) : w("- None -", "- Ninguno -", lang)}</option>
            {rfis.map(rfi => (
              <option key={rfi.id} value={String(rfi.id)}>{rfi.number}: {rfi.subject}</option>
            ))}
          </FieldSelect>
        </Field>
      </div>

      {/* Section 6: Procurement Status */}
      <PanelSection title={w("6. Procurement Status", "6. Estado de Adquisición", lang)} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {PROCUREMENT_OPTIONS.map(o => (
          <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="procurement"
              value={o.value}
              checked={form.procurementStatus === o.value}
              onChange={() => set("procurementStatus", o.value)}
            />
            {lang === "es" ? o.labelEs : o.label}
          </label>
        ))}
      </div>
      {procureWarning && (
        <div style={{
          marginTop: 10, padding: "10px 14px", background: "#FEF3C7",
          border: "1.5px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#B45309",
          display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <TriangleAlert style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>{w("Warning - Procurement Before Approval:", "Advertencia - Adquisición Antes de Aprobación:", lang)}</strong>
            {" "}{w("Materials have been ordered or delivered before this submittal has been formally approved. This creates significant liability risk. Proceed only if you have written authorization from the responsible party.", "Los materiales han sido ordenados o entregados antes de que este entregable sea aprobado formalmente. Esto crea un riesgo de responsabilidad significativo. Proceda solo si tiene autorización escrita de la parte responsable.", lang)}
          </div>
        </div>
      )}

      {/* Section 7: AI Pre-Submission Check */}
      <PanelSection title={w("7. AI Pre-Submission Check", "7. Verificación IA Pre-Envío", lang)} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button
          onClick={handleAiCheck}
          disabled={aiCheckLoading}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
            borderRadius: 7, border: "none", background: aiCheckLoading ? "#A78BFA" : "#7C3AED",
            color: "white", cursor: aiCheckLoading ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 700,
          }}
        >
          {aiCheckLoading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Shield style={{ width: 13, height: 13 }} />}
          {w("Run AI Compliance Check", "Ejecutar Verificación IA", lang)}
        </button>
        {!savedId && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{w("AI will check the current form fields - save afterwards to persist the result.", "La IA verificará los campos actuales - guarde después para persistir el resultado.", lang)}</span>}
      </div>
      {aiCheckResult && <AiCheckDisplay result={aiCheckResult} lang={lang} />}

      {/* Section 8: Distribution */}
      <PanelSection title={w("8. Distribution", "8. Distribución", lang)} />
      <Field label={w("Distribution List (comma-separated emails)", "Lista de Distribución (correos separados por comas)", lang)}>
        <FieldInput
          value={form.distributionList}
          onChange={e => set("distributionList", e.target.value)}
          placeholder="user@example.com, user2@example.com"
        />
      </Field>

      {/* Submit */}
      <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
        <Button onClick={handleSubmit} disabled={submitting || !form.title} style={{ flex: 1, gap: 6 }}>
          {submitting ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ width: 13, height: 13 }} />}
          {w("Submit Submittal", "Enviar Entregable", lang)}
        </Button>
        <Button variant="outline" onClick={onClose} style={{ fontSize: 12 }}>
          {w("Cancel", "Cancelar", lang)}
        </Button>
      </div>
    </div>
  );
}

// ─── File Search Dropdown (Fix 7) ─────────────────────────────────────────────
function FileSearchButton({ projectId, onSelect, lang }: {
  projectId: number; onSelect: (fileName: string) => void; lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleOpen = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/files`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) setFiles((await r.json()) as ProjectFile[]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = files.filter(f => !search || f.fileName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={handleOpen}
        title={w("Search project files", "Buscar archivos del proyecto", lang)}
        style={{
          padding: "4px 7px", border: "1px solid #D1D5DB", borderRadius: 5,
          background: open ? "#EFF6FF" : "white", cursor: "pointer", display: "flex", alignItems: "center",
        }}
      >
        <Search style={{ width: 11, height: 11, color: "#6B7280" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", left: 0, zIndex: 100, background: "white",
          border: "1.5px solid #BFDBFE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          minWidth: 240, maxWidth: 320,
        }}>
          {loading ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 6 }}>
              <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
              {w("Loading files…", "Cargando archivos…", lang)}
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>
              {w("No files uploaded to this project yet - upload files in the Files tab to link them here.", "Sin archivos en este proyecto - suba archivos en la pestaña Archivos para enlazarlos aquí.", lang)}
            </div>
          ) : (
            <>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={w("Search files…", "Buscar archivos…", lang)}
                  style={{ height: 28, fontSize: 11 }}
                  autoFocus
                />
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "#9CA3AF" }}>
                    {w("No matching files", "Sin coincidencias", lang)}
                  </div>
                ) : filtered.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { onSelect(f.fileName); setOpen(false); setSearch(""); }}
                    style={{
                      width: "100%", textAlign: "left", padding: "7px 12px", background: "none",
                      border: "none", cursor: "pointer", fontSize: 11, color: "#1E293B",
                      borderBottom: "1px solid #F9FAFB",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    {f.fileName}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Check Display ─────────────────────────────────────────────────────────
const RISK_SCORE: Record<string, { label: string; labelEs: string; color: string; bg: string }> = {
  pass:           { label: "Low",    labelEs: "Bajo",   color: "#15803D", bg: "#F0FDF4" },
  possible_issue: { label: "Medium", labelEs: "Medio",  color: "#B45309", bg: "#FFFBEB" },
  fail:           { label: "High",   labelEs: "Alto",   color: "#DC2626", bg: "#FEF2F2" },
};
const ASPECT_ICON: Record<string, string> = { pass: "Pass", possible_issue: "Review", fail: "Fail" };

function AiCheckDisplay({ result, lang }: { result: AiCheckResult; lang: string }) {
  const risk = RISK_SCORE[result.overall] || RISK_SCORE.pass;
  return (
    <div style={{ border: "1.5px solid #C4B5FD", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <div style={{
        padding: "8px 12px", background: AI_BG[result.overall],
        borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <AiBadge result={result.overall} />
        <span style={{ fontSize: 12, fontWeight: 600, color: AI_COLOR[result.overall] }}>
          {result.overall === "pass" ? w("Likely to be approved", "Probable aprobación", lang) :
           result.overall === "fail" ? w("High rejection risk", "Alto riesgo de rechazo", lang) :
           w("Possible issues detected", "Posibles problemas detectados", lang)}
        </span>
        <span style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
          padding: "2px 10px", borderRadius: 6, background: risk.bg, border: `1.5px solid ${risk.color}`,
          fontSize: 11, fontWeight: 700, color: risk.color,
        }}>
          {w("Submission Risk:", "Riesgo de Envío:", lang)} {lang === "es" ? risk.labelEs : risk.label}
        </span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        {result.aspects.map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6,
            padding: "5px 8px", borderRadius: 5,
            background: a.result === "pass" ? "#F0FDF4" : a.result === "fail" ? "#FEF2F2" : "#FFFBEB",
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: AI_COLOR[a.result],
              width: 20, flexShrink: 0, marginTop: 0, textAlign: "center",
            }}>
              {ASPECT_ICON[a.result] || "?"}
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1E3A5F" }}>{a.label}</div>
              <div style={{ fontSize: 11, color: "#374151" }}>{a.note}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6, fontStyle: "italic" }}>{result.summary}</div>
      </div>
    </div>
  );
}

// ─── Submittal Detail ─────────────────────────────────────────────────────────
function SubmittalDetail({ projectId, submittal, lang, canWrite, onClose, onUpdated }: {
  projectId: number; submittal: Submittal; lang: string; canWrite: boolean;
  onClose: () => void; onUpdated: (s: Submittal) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewEvents, setViewEvents] = useState<ViewEvent[]>([]);
  const [aiCheckResult, setAiCheckResult] = useState<AiCheckResult | null>(
    submittal.aiCheckResult ? submittal.aiCheckResult as AiCheckResult : null
  );
  const [aiCheckLoading, setAiCheckLoading] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState("");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [respondLoading, setRespondLoading] = useState(false);
  const [aiRejectionLoading, setAiRejectionLoading] = useState(false);
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false);
  const [aiEmailLoading, setAiEmailLoading] = useState(false);
  const [aiEmailDraft, setAiEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(canWrite);
  const [editSaving, setEditSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const attachFileRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    title: submittal.title || "",
    status: submittal.status || "pending",
    specSection: submittal.specSection || "",
    submittalCategory: submittal.submittalCategory || submittal.submittalType || "shop_drawing",
    submittalType: submittal.submittalType || "shop_drawing",
    trade: submittal.trade || "",
    floor: submittal.floor || "",
    responsibleCompany: submittal.responsibleCompany || "",
    submittedByCompany: submittal.submittedByCompany || "",
    submittedByPerson: submittal.submittedByPerson || "",
    submittedByEmail: submittal.submittedByEmail || "",
    submittedByPhone: submittal.submittedByPhone || "",
    submittedToCompany: submittal.submittedToCompany || "",
    submittedToPerson: submittal.submittedToPerson || "",
    submittedToEmail: submittal.submittedToEmail || "",
    manufacturer: submittal.manufacturer || "",
    modelNumber: submittal.modelNumber || "",
    procurementStatus: submittal.procurementStatus || "not_ordered",
    ballInCourt: submittal.ballInCourt || "",
    drawingNumber: submittal.drawingNumber || "",
    drawingTitle: submittal.drawingTitle || "",
    dateSubmitted: submittal.dateSubmitted ? submittal.dateSubmitted.slice(0, 10) : "",
    dateRequired: submittal.dateRequired ? submittal.dateRequired.slice(0, 10) : "",
    linkedRfiId: submittal.linkedRfiId ? String(submittal.linkedRfiId) : "",
    description: submittal.description || "",
    attachmentsText: (submittal.attachmentsJson || []).join("\n"),
  });
  const respondRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditOpen(canWrite);
    setEditForm({
      title: submittal.title || "",
      status: submittal.status || "pending",
      specSection: submittal.specSection || "",
      submittalCategory: submittal.submittalCategory || submittal.submittalType || "shop_drawing",
      submittalType: submittal.submittalType || "shop_drawing",
      trade: submittal.trade || "",
      floor: submittal.floor || "",
      responsibleCompany: submittal.responsibleCompany || "",
      submittedByCompany: submittal.submittedByCompany || "",
      submittedByPerson: submittal.submittedByPerson || "",
      submittedByEmail: submittal.submittedByEmail || "",
      submittedByPhone: submittal.submittedByPhone || "",
      submittedToCompany: submittal.submittedToCompany || "",
      submittedToPerson: submittal.submittedToPerson || "",
      submittedToEmail: submittal.submittedToEmail || "",
      manufacturer: submittal.manufacturer || "",
      modelNumber: submittal.modelNumber || "",
      procurementStatus: submittal.procurementStatus || "not_ordered",
      ballInCourt: submittal.ballInCourt || "",
      drawingNumber: submittal.drawingNumber || "",
      drawingTitle: submittal.drawingTitle || "",
      dateSubmitted: submittal.dateSubmitted ? submittal.dateSubmitted.slice(0, 10) : "",
      dateRequired: submittal.dateRequired ? submittal.dateRequired.slice(0, 10) : "",
      linkedRfiId: submittal.linkedRfiId ? String(submittal.linkedRfiId) : "",
      description: submittal.description || "",
      attachmentsText: (submittal.attachmentsJson || []).join("\n"),
    });
  }, [submittal.id, canWrite]);

  useEffect(() => {
    if (respondOpen && respondRef.current) {
      setTimeout(() => respondRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [respondOpen]);
  const bic = (submittal.ballInCourtHistory || []) as Array<{ party: string; setAt: string; setBy: string }>;

  // Log view event on open
  useEffect(() => {
    void fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    void fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/viewed-by`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setViewEvents(data as ViewEvent[]));
    void fetch(`/api/v1/projects/${projectId}/rfis`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setRfis(data as RFI[]));
    void fetch(`/api/v1/projects/${projectId}/files`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setProjectFiles(data as ProjectFile[]));
    void fetch(`/api/v1/projects/${projectId}/directory`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.ok ? r.json() : []).then(data => setDirectory(data as DirectoryEntry[]));
  }, [submittal.id, projectId]);

  const setEdit = (key: string, value: string) => setEditForm(f => ({ ...f, [key]: value }));
  const companyOptions = uniqSorted([
    ...directory.map(d => d.companyName),
    submittal.responsibleCompany,
    submittal.submittedByCompany,
    submittal.submittedToCompany,
  ]);
  const contactOptions = uniqSorted([
    ...directory.map(d => d.fullName),
    submittal.submittedByPerson,
    submittal.submittedToPerson,
  ]);
  const emailOptions = uniqSorted([
    ...directory.map(d => d.email),
    submittal.submittedByEmail,
    submittal.submittedToEmail,
  ]);
  const responsibleOptions = uniqSorted([
    ...companyOptions,
    ...contactOptions,
    ...emailOptions,
    submittal.ballInCourt,
  ]);

  const addAttachmentName = (name: string) => {
    if (!name) return;
    setEditForm(f => {
      const current = f.attachmentsText.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
      if (!current.includes(name)) current.push(name);
      return { ...f, attachmentsText: current.join("\n") };
    });
  };

  const uploadAndAttachFile = async (file: File) => {
    setUploadingAttachment(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upload = await fetch(`/api/v1/projects/${projectId}/submittals/attachments/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!upload.ok) {
        const err = await upload.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || "Upload failed");
      }
      const { downloadUrl } = await upload.json() as { downloadUrl: string };
      const nextAttachments = [...(submittal.attachmentsJson || [])];
      if (!nextAttachments.includes(downloadUrl)) nextAttachments.push(downloadUrl);
      const save = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ attachmentsJson: nextAttachments }),
      });
      if (!save.ok) {
        const err = await save.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || "Attachment save failed");
      }
      const updated = await save.json() as Submittal;
      setEditForm(f => ({ ...f, attachmentsText: (updated.attachmentsJson || []).join("\n") }));
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
      onUpdated({ ...submittal, ...updated });
      toast({ title: w("File uploaded and attached", "Archivo subido y adjuntado", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Upload failed", "Error al subir", lang), variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      toast({ title: w("Title is required", "El titulo es requerido", lang), variant: "destructive" });
      return;
    }
    setEditSaving(true);
    try {
      const body = {
        title: editForm.title.trim(),
        status: editForm.status,
        specSection: editForm.specSection || null,
        submittalCategory: editForm.submittalCategory || null,
        submittalType: editForm.submittalType || editForm.submittalCategory || "shop_drawing",
        trade: editForm.trade || null,
        floor: editForm.floor || null,
        responsibleCompany: editForm.responsibleCompany || null,
        submittedByCompany: editForm.submittedByCompany || null,
        submittedByPerson: editForm.submittedByPerson || null,
        submittedByEmail: editForm.submittedByEmail || null,
        submittedByPhone: editForm.submittedByPhone || null,
        submittedToCompany: editForm.submittedToCompany || null,
        submittedToPerson: editForm.submittedToPerson || null,
        submittedToEmail: editForm.submittedToEmail || null,
        manufacturer: editForm.manufacturer || null,
        modelNumber: editForm.modelNumber || null,
        procurementStatus: editForm.procurementStatus || null,
        ballInCourt: editForm.ballInCourt || null,
        drawingNumber: editForm.drawingNumber || null,
        drawingTitle: editForm.drawingTitle || null,
        dateSubmitted: editForm.dateSubmitted || null,
        dateRequired: editForm.dateRequired || null,
        linkedRfiId: editForm.linkedRfiId ? parseInt(editForm.linkedRfiId) : null,
        description: editForm.description || null,
        attachmentsJson: attachmentValues(editForm.attachmentsText),
      };
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || "Save failed");
      }
      const updated = await r.json() as Submittal;
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
      onUpdated({ ...submittal, ...updated });
      setEditOpen(false);
      toast({ title: w("Submittal updated", "Entregable actualizado", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Failed to save", "Error al guardar", lang), variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const handleAiCheck = async () => {
    setAiCheckLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/ai-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) {
        const result = await r.json() as AiCheckResult;
        setAiCheckResult(result);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
      }
    } catch { toast({ title: w("AI check failed", "Error de verificación IA", lang), variant: "destructive" }); }
    finally { setAiCheckLoading(false); }
  };

  const handleAiRejectionAssist = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: w("Enter a rejection reason first, then click AI Draft Rejection to rewrite it professionally.", "Ingrese una razón de rechazo primero.", lang), variant: "destructive" });
      return;
    }
    setAiRejectionLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/ai-draft-rejection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          existingReason: rejectionReason,
          reviewDecision,
          complianceNotes,
          title: submittal.title,
          specSection: submittal.specSection,
        }),
      });
      if (r.ok) {
        const d = await r.json() as { suggestion: string };
        setRejectionReason(d.suggestion);
      } else {
        const d = await r.json() as { error?: string };
        toast({ title: d.error || w("AI assist failed", "Error de asistencia IA", lang), variant: "destructive" });
      }
    } catch { toast({ title: w("AI assist failed", "Error de asistencia IA", lang), variant: "destructive" }); }
    finally { setAiRejectionLoading(false); }
  };

  const handleAiDescriptionAssist = async () => {
    if (!editForm.title.trim() && !editForm.description.trim()) {
      toast({ title: w("Add a title or rough description first.", "Agregue un titulo o descripcion primero.", lang), variant: "destructive" });
      return;
    }
    setAiDescriptionLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/ai-assist-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          userDescription: editForm.description,
          title: editForm.title,
          specSection: editForm.specSection,
          submittalCategory: editForm.submittalCategory,
          trade: editForm.trade,
          floor: editForm.floor,
          manufacturer: editForm.manufacturer,
          modelNumber: editForm.modelNumber,
        }),
      });
      const d = await r.json().catch(() => ({})) as { suggestion?: string; error?: string };
      if (!r.ok) throw new Error(d.error || "AI description assist failed");
      setEdit("description", d.suggestion || "");
      toast({ title: w("Description drafted from text fields only", "Descripcion generada solo con campos de texto", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("AI description assist failed", "Error de asistencia IA", lang), variant: "destructive" });
    } finally {
      setAiDescriptionLoading(false);
    }
  };

  const handleAiEmailDraft = async () => {
    setAiEmailLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/ai-email-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          draft: {
            title: editForm.title,
            status: editForm.status,
            specSection: editForm.specSection,
            submittalCategory: editForm.submittalCategory,
            submittalType: editForm.submittalType,
            trade: editForm.trade,
            floor: editForm.floor,
            responsibleCompany: editForm.responsibleCompany,
            submittedByCompany: editForm.submittedByCompany,
            submittedByPerson: editForm.submittedByPerson,
            submittedByEmail: editForm.submittedByEmail,
            submittedToCompany: editForm.submittedToCompany,
            submittedToPerson: editForm.submittedToPerson,
            submittedToEmail: editForm.submittedToEmail,
            manufacturer: editForm.manufacturer,
            modelNumber: editForm.modelNumber,
            ballInCourt: editForm.ballInCourt,
            dateSubmitted: editForm.dateSubmitted,
            dateRequired: editForm.dateRequired,
            description: editForm.description,
            attachmentsJson: attachmentValues(editForm.attachmentsText),
          },
        }),
      });
      const d = await r.json().catch(() => ({})) as { subject?: string; body?: string; error?: string };
      if (!r.ok) throw new Error(d.error || "AI email draft failed");
      setAiEmailDraft({ subject: d.subject || "", body: d.body || "" });
      toast({ title: w("Email draft created from text fields only", "Correo generado solo con campos de texto", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("AI email draft failed", "Error al generar correo IA", lang), variant: "destructive" });
    } finally {
      setAiEmailLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!reviewDecision) { toast({ title: w("Select a review decision", "Seleccione una decisión de revisión", lang), variant: "destructive" }); return; }
    setRespondLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ reviewDecision, complianceNotes, rejectionReason }),
      });
      if (r.ok) {
        const updated = await r.json() as Submittal;
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
        toast({ title: w("Review saved", "Revisión guardada", lang) });
        onUpdated({ ...submittal, ...updated });
        setRespondOpen(false);
      }
    } catch { toast({ title: w("Failed to save review", "Error al guardar revisión", lang), variant: "destructive" }); }
    finally { setRespondLoading(false); }
  };

  const handleExportPdf = async () => {
    setExportLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${submittal.number}-Submittal.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setExportLoading(false); }
  };

  const handleAuditCert = async () => {
    setAuditLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${submittal.id}/audit-certificate`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${submittal.number}-AuditCert.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setAuditLoading(false); }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1E293B" }}>{value || "-"}</span>
    </div>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      <input
        ref={attachFileRef}
        type="file"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void uploadAndAttachFile(file);
          e.currentTarget.value = "";
        }}
      />
      <datalist id={`submittal-companies-${submittal.id}`}>
        {companyOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id={`submittal-contacts-${submittal.id}`}>
        {contactOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id={`submittal-emails-${submittal.id}`}>
        {emailOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      <datalist id={`submittal-responsible-parties-${submittal.id}`}>
        {responsibleOptions.map(value => <option key={value} value={value} />)}
      </datalist>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {canWrite && (
          <Button variant={editOpen ? "default" : "outline"} size="sm" style={{ fontSize: 11, gap: 5 }} onClick={() => setEditOpen(v => !v)}>
            <Pencil style={{ width: 12, height: 12 }} />
            {editOpen ? w("Close Edit", "Cerrar Edicion", lang) : w("Edit Submittal", "Editar Entregable", lang)}
          </Button>
        )}
        <Button variant="outline" size="sm" style={{ fontSize: 11, gap: 5 }} onClick={handleExportPdf} disabled={exportLoading}>
          {exportLoading ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 12, height: 12 }} />}
          {w("Export PDF", "Exportar PDF", lang)}
        </Button>
        <Button variant="outline" size="sm" style={{ fontSize: 11, gap: 5 }} onClick={handleAuditCert} disabled={auditLoading}>
          {auditLoading ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Shield style={{ width: 12, height: 12 }} />}
          {w("Audit Certificate", "Certificado de Auditoría", lang)}
        </Button>
        <button
          onClick={handleAiCheck}
          disabled={aiCheckLoading}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
            borderRadius: 6, border: "none", background: "#7C3AED", color: "white",
            cursor: "pointer", fontSize: 11, fontWeight: 600,
          }}
        >
          {aiCheckLoading ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 11, height: 11 }} />}
          {w("AI Compliance Check", "Verificacion IA", lang)}
        </button>
        <button
          onClick={handleAiEmailDraft}
          disabled={aiEmailLoading}
          title={w("Text-only draft. Does not read attachments. Uses configured AI credits.", "Borrador solo con texto. No lee adjuntos. Usa creditos IA configurados.", lang)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
            borderRadius: 6, border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8",
            cursor: "pointer", fontSize: 11, fontWeight: 700,
          }}
        >
          {aiEmailLoading ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 11, height: 11 }} />}
          {w("AI Email Draft", "Borrador Email IA", lang)}
        </button>
        {canWrite && !respondOpen && (
          <Button size="sm" style={{ fontSize: 11, gap: 5, marginLeft: "auto" }} onClick={() => setRespondOpen(true)}>
            <CheckCircle2 style={{ width: 12, height: 12 }} />
            {w("Add Review Response", "Agregar Revisión", lang)}
          </Button>
        )}
      </div>

      {aiEmailDraft && (
        <div style={{ border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF", padding: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A5F" }}>{w("AI Email Draft", "Borrador Email IA", lang)}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>
                {w("Draft only. Does not send email or read attached files. Uses configured AI credits.", "Solo borrador. No envia correo ni lee archivos adjuntos. Usa creditos IA configurados.", lang)}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              style={{ fontSize: 11, gap: 5 }}
              onClick={() => {
                const text = `Subject: ${aiEmailDraft.subject}\n\n${aiEmailDraft.body}`;
                void navigator.clipboard?.writeText(text);
                toast({ title: w("Email draft copied", "Borrador copiado", lang) });
              }}
            >
              <Copy style={{ width: 12, height: 12 }} />
              {w("Copy", "Copiar", lang)}
            </Button>
          </div>
          <Field label={w("Subject", "Asunto", lang)}>
            <FieldInput value={aiEmailDraft.subject} onChange={e => setAiEmailDraft(d => d ? { ...d, subject: e.target.value } : d)} />
          </Field>
          <Field label={w("Email Body", "Cuerpo del Email", lang)}>
            <FieldTextarea rows={7} value={aiEmailDraft.body} onChange={e => setAiEmailDraft(d => d ? { ...d, body: e.target.value } : d)} />
          </Field>
        </div>
      )}

      {editOpen && canWrite && (
        <div style={{ border: "1.5px solid #BFDBFE", borderRadius: 8, padding: 14, background: "#F8FAFC", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A5F" }}>
              {w("Edit Submittal", "Editar Entregable", lang)}
            </div>
            <Button size="sm" onClick={handleSaveEdit} disabled={editSaving || !editForm.title.trim()} style={{ fontSize: 11, gap: 5 }}>
              {editSaving ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 12, height: 12 }} />}
              {w("Save Changes", "Guardar Cambios", lang)}
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={w("Title *", "Titulo *", lang)}>
              <FieldInput value={editForm.title} onChange={e => setEdit("title", e.target.value)} />
            </Field>
            <Field label={w("Status", "Estado", lang)}>
              <FieldSelect value={editForm.status} onChange={e => setEdit("status", e.target.value)}>
                {Object.entries(STATUS_BADGE).map(([key, value]) => (
                  <option key={key} value={key}>{lang === "es" ? value.labelEs : value.label}</option>
                ))}
              </FieldSelect>
            </Field>
            <Field label={w("Spec Section", "Seccion", lang)}>
              <FieldInput value={editForm.specSection} onChange={e => setEdit("specSection", e.target.value)} />
            </Field>
            <Field label={w("Category", "Categoria", lang)}>
              <FieldSelect value={editForm.submittalCategory} onChange={e => { setEdit("submittalCategory", e.target.value); setEdit("submittalType", e.target.value); }}>
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </FieldSelect>
            </Field>
            <Field label={w("Trade", "Gremio", lang)}>
              <FieldInput value={editForm.trade} onChange={e => setEdit("trade", e.target.value)} />
            </Field>
            <Field label={w("Floor", "Piso", lang)}>
              <FieldInput value={editForm.floor} onChange={e => setEdit("floor", e.target.value)} />
            </Field>
            <Field label={w("Responsible Company", "Empresa Responsable", lang)}>
              <FieldInput list={`submittal-companies-${submittal.id}`} placeholder={w("Pick an existing company or type a new one", "Seleccione una empresa o escriba una nueva", lang)} value={editForm.responsibleCompany} onChange={e => setEdit("responsibleCompany", e.target.value)} />
            </Field>
            <Field label={w("Submitted To Company", "Empresa Destinataria", lang)}>
              <FieldInput list={`submittal-companies-${submittal.id}`} placeholder={w("Pick an existing company or type a new one", "Seleccione una empresa o escriba una nueva", lang)} value={editForm.submittedToCompany} onChange={e => setEdit("submittedToCompany", e.target.value)} />
            </Field>
            <Field label={w("Submitted To Contact", "Contacto Destinatario", lang)}>
              <FieldInput list={`submittal-contacts-${submittal.id}`} placeholder={w("Pick an existing contact or type a new one", "Seleccione un contacto o escriba uno nuevo", lang)} value={editForm.submittedToPerson} onChange={e => setEdit("submittedToPerson", e.target.value)} />
            </Field>
            <Field label={w("Submitted To Email", "Correo Destinatario", lang)}>
              <FieldInput type="email" list={`submittal-emails-${submittal.id}`} placeholder={w("Pick an existing email or type a new one", "Seleccione un correo o escriba uno nuevo", lang)} value={editForm.submittedToEmail} onChange={e => setEdit("submittedToEmail", e.target.value)} />
            </Field>
            <Field label={w("Submitted By Company", "Empresa Remitente", lang)}>
              <FieldInput list={`submittal-companies-${submittal.id}`} placeholder={w("Pick an existing company or type a new one", "Seleccione una empresa o escriba una nueva", lang)} value={editForm.submittedByCompany} onChange={e => setEdit("submittedByCompany", e.target.value)} />
            </Field>
            <Field label={w("Submitted By Contact", "Contacto Remitente", lang)}>
              <FieldInput list={`submittal-contacts-${submittal.id}`} placeholder={w("Pick an existing contact or type a new one", "Seleccione un contacto o escriba uno nuevo", lang)} value={editForm.submittedByPerson} onChange={e => setEdit("submittedByPerson", e.target.value)} />
            </Field>
            <Field label={w("Submitted By Email", "Correo Remitente", lang)}>
              <FieldInput type="email" list={`submittal-emails-${submittal.id}`} placeholder={w("Pick an existing email or type a new one", "Seleccione un correo o escriba uno nuevo", lang)} value={editForm.submittedByEmail} onChange={e => setEdit("submittedByEmail", e.target.value)} />
            </Field>
            <Field label={w("Manufacturer", "Fabricante", lang)}>
              <FieldInput value={editForm.manufacturer} onChange={e => setEdit("manufacturer", e.target.value)} />
            </Field>
            <Field label={w("Model Number", "Numero de Modelo", lang)}>
              <FieldInput value={editForm.modelNumber} onChange={e => setEdit("modelNumber", e.target.value)} />
            </Field>
            <Field label={w("Procurement", "Adquisicion", lang)}>
              <FieldSelect value={editForm.procurementStatus} onChange={e => setEdit("procurementStatus", e.target.value)}>
                {PROCUREMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </FieldSelect>
            </Field>
            <Field label={w("Current Responsible Party (Ball in Court)", "Responsable Actual", lang)}>
              <FieldInput list={`submittal-responsible-parties-${submittal.id}`} placeholder={w("Pick the company, contact, or email that owns the next action", "Seleccione la empresa, contacto o correo responsable de la proxima accion", lang)} value={editForm.ballInCourt} onChange={e => setEdit("ballInCourt", e.target.value)} />
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                {w("This is not a free-form status. It identifies who owns the next action right now.", "No es un estado libre. Identifica quien tiene la proxima accion ahora.", lang)}
              </div>
            </Field>
            <Field label={w("Date Submitted", "Fecha de Envio", lang)}>
              <FieldInput type="date" value={editForm.dateSubmitted} onChange={e => setEdit("dateSubmitted", e.target.value)} />
            </Field>
            <Field label={w("Date Required", "Fecha Requerida", lang)}>
              <FieldInput type="date" value={editForm.dateRequired} onChange={e => setEdit("dateRequired", e.target.value)} />
            </Field>
            <Field label={w("Drawing Number", "Numero de Plano", lang)}>
              <FieldInput value={editForm.drawingNumber} onChange={e => setEdit("drawingNumber", e.target.value)} />
            </Field>
            <Field label={w("Drawing Title", "Titulo de Plano", lang)}>
              <FieldInput value={editForm.drawingTitle} onChange={e => setEdit("drawingTitle", e.target.value)} />
            </Field>
            <Field label={w("Linked RFI", "RFI Relacionado", lang)}>
              <FieldSelect value={editForm.linkedRfiId} onChange={e => setEdit("linkedRfiId", e.target.value)}>
                <option value="">{w("No linked RFI", "Sin RFI relacionado", lang)}</option>
                {rfis.map(rfi => (
                  <option key={rfi.id} value={String(rfi.id)}>{rfi.number}: {rfi.subject}</option>
                ))}
              </FieldSelect>
            </Field>
            <Field label={w("Add Existing Project File", "Agregar Archivo Existente", lang)}>
              <FieldSelect value="" onChange={e => addAttachmentName(e.target.value)}>
                <option value="">{projectFiles.length ? w("Select file to attach", "Seleccione archivo", lang) : w("No project files uploaded", "Sin archivos del proyecto", lang)}</option>
                {projectFiles.map(file => (
                  <option key={file.id} value={file.fileUrl || file.fileName}>{file.fileName}</option>
                ))}
              </FieldSelect>
            </Field>
            <Field label={w("Upload From Computer", "Subir Desde Computadora", lang)}>
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" variant="outline" size="sm" disabled={uploadingAttachment} onClick={() => attachFileRef.current?.click()} style={{ width: "100%", fontSize: 12, gap: 5 }}>
                  {uploadingAttachment ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Paperclip style={{ width: 12, height: 12 }} />}
                  {uploadingAttachment ? w("Uploading...", "Subiendo...", lang) : w("Attach file now", "Adjuntar archivo ahora", lang)}
                </Button>
              </div>
            </Field>
          </div>
          <Field label={w("Attachments / Product Files", "Archivos / Producto", lang)}>
            <FieldTextarea
              rows={3}
              value={editForm.attachmentsText}
              onChange={e => setEdit("attachmentsText", e.target.value)}
              placeholder={w("One file name or URL per line", "Un archivo o URL por linea", lang)}
            />
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
              {w("Stored links are shown as clean file names in the detail view, PDF, and Excel exports.", "Los enlaces guardados se muestran como nombres limpios en detalle, PDF y Excel.", lang)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {attachmentValues(editForm.attachmentsText).map((name, idx) => (
                <div key={`${name}-${idx}`} style={{ fontSize: 11, color: "#374151", background: "white", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 7px" }}>
                  {attachmentLabel(name)}
                </div>
              ))}
            </div>
          </Field>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{w("Description", "Descripcion", lang)}</div>
              <button
                type="button"
                onClick={handleAiDescriptionAssist}
                disabled={aiDescriptionLoading}
                title={w("Text-only assist. Does not read attachments. Uses configured AI credits.", "Asistencia solo con texto. No lee adjuntos. Usa creditos IA configurados.", lang)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px",
                  borderRadius: 6, border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8",
                  cursor: "pointer", fontSize: 11, fontWeight: 700,
                }}
              >
                {aiDescriptionLoading ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 11, height: 11 }} />}
                {w("AI Draft Description", "Descripcion IA", lang)}
              </button>
            </div>
            <FieldTextarea rows={3} value={editForm.description} onChange={e => setEdit("description", e.target.value)} />
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
              {w("Text-only assist. It does not read attached files or images.", "Asistencia solo con texto. No lee archivos ni imagenes adjuntas.", lang)}
            </div>
          </div>
        </div>
      )}

      {/* Status + flags */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <StatusBadge status={submittal.status} lang={lang} />
        {submittal.rapidApprovalFlag && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10, background: "#FEF3C7", color: "#B45309", fontSize: 10, fontWeight: 700 }}>
            <TriangleAlert style={{ width: 11, height: 11 }} />
            {w("RAPID APPROVAL FLAG", "APROBACIÓN RÁPIDA", lang)}
          </span>
        )}
        {submittal.aiCheckRan && aiCheckResult && <AiBadge result={aiCheckResult.overall} />}
      </div>

      {/* Procurement warning */}
      {["on_order", "delivered", "installed"].includes(submittal.procurementStatus || "") && !["approved", "approved_as_noted"].includes(submittal.status) && (
        <div style={{
          padding: "10px 14px", background: "#FEF3C7", border: "1.5px solid #FDE68A",
          borderRadius: 8, fontSize: 12, color: "#B45309", marginBottom: 12,
          display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <TriangleAlert style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>{w("Warning - Procurement Before Approval:", "Advertencia - Adquisición Antes de Aprobación:", lang)}</strong>
            {" "}{w("Materials have been ordered or delivered before this submittal has been formally approved. This creates significant liability risk. Proceed only if you have written authorization from the responsible party.", "Los materiales han sido ordenados o entregados antes de que este entregable sea aprobado formalmente. Esto crea un riesgo de responsabilidad significativo. Proceda solo si tiene autorización escrita de la parte responsable.", lang)}
          </div>
        </div>
      )}

      {/* Linked Items */}
      <LinkedItemsPanel projectId={projectId} entityType="submittal" entityId={submittal.id} canWrite={canWrite} />

      {/* Submittal details */}
      <PanelSection title={w("Submittal Information", "Información del Entregable", lang)} />
      <InfoRow label={w("Number", "Número", lang)} value={submittal.number} />
      <InfoRow label={w("Title", "Título", lang)} value={submittal.title} />
      <InfoRow label={w("Spec Section", "Sección de Especificación", lang)} value={submittal.specSection} />
      <InfoRow label={w("Category", "Categoría", lang)} value={CATEGORY_OPTIONS.find(o => o.value === (submittal.submittalCategory || submittal.submittalType))?.[lang === "es" ? "labelEs" : "label"] || submittal.submittalCategory} />
      <InfoRow label={w("Drawing No.", "Número de Plano", lang)} value={submittal.drawingNumber} />
      <InfoRow label={w("Drawing Title", "Título de Plano", lang)} value={submittal.drawingTitle} />
      <InfoRow label={w("Date Submitted", "Fecha de Envío", lang)} value={fmtDate(submittal.dateSubmitted || submittal.createdAt)} />
      <InfoRow label={w("Date Required", "Fecha Requerida", lang)} value={fmtDate(submittal.dateRequired || submittal.dueDate)} />
      <InfoRow label={w("Linked RFI", "RFI Relacionado", lang)} value={submittal.linkedRfiId ? `RFI #${submittal.linkedRfiId}` : null} />
      {submittal.linkedRfiId && (
        <button
          onClick={() => window.location.href = `/projects/${projectId}/rfis?rfi=${submittal.linkedRfiId}`}
          style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 6, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          <LinkIcon style={{ width: 12, height: 12 }} />
          {w("Open linked RFI", "Abrir RFI relacionado", lang)}
        </button>
      )}
      {(submittal.attachmentsJson || []).length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5 }}>
            <Paperclip style={{ width: 12, height: 12 }} />
            {w("Attachments", "Archivos", lang)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(submittal.attachmentsJson || []).map((name, idx) => (
              <div key={`${name}-${idx}`} style={{ fontSize: 12, color: "#1E293B", background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 6, padding: "5px 8px" }}>
                {isAttachmentUrl(name) ? (
                  <a href={name} target="_blank" rel="noreferrer" style={{ color: "#1D4ED8", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <ExternalLink style={{ width: 12, height: 12 }} />
                    {attachmentLabel(name)}
                  </a>
                ) : attachmentLabel(name)}
              </div>
            ))}
          </div>
        </div>
      )}

      <PanelSection title={w("Submitted By", "Enviado Por", lang)} />
      <InfoRow label={w("Company", "Empresa", lang)} value={submittal.submittedByCompany} />
      <InfoRow label={w("Contact", "Contacto", lang)} value={submittal.submittedByPerson} />
      <InfoRow label={w("Email", "Correo", lang)} value={submittal.submittedByEmail} />
      <InfoRow label={w("Phone", "Teléfono", lang)} value={submittal.submittedByPhone} />

      <PanelSection title={w("Submitted To", "Enviado A", lang)} />
      <InfoRow label={w("Company", "Empresa", lang)} value={submittal.submittedToCompany} />
      <InfoRow label={w("Contact", "Contacto", lang)} value={submittal.submittedToPerson} />
      <InfoRow label={w("Email", "Correo", lang)} value={submittal.submittedToEmail} />

      <PanelSection title={w("Product Information", "Información del Producto", lang)} />
      <InfoRow label={w("Manufacturer", "Fabricante", lang)} value={submittal.manufacturer} />
      <InfoRow label={w("Model Number", "Número de Modelo", lang)} value={submittal.modelNumber} />
      <InfoRow label={w("Procurement", "Adquisición", lang)} value={PROCUREMENT_OPTIONS.find(o => o.value === submittal.procurementStatus)?.[lang === "es" ? "labelEs" : "label"] || submittal.procurementStatus} />
      <InfoRow label={w("Current Responsible Party", "Responsable Actual", lang)} value={submittal.ballInCourt} />
      {canWrite && (
        <div style={{ margin: "8px 0 4px" }}>
          <Button type="button" variant="outline" size="sm" disabled={uploadingAttachment} onClick={() => attachFileRef.current?.click()} style={{ fontSize: 11, gap: 5 }}>
            {uploadingAttachment ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Paperclip style={{ width: 12, height: 12 }} />}
            {uploadingAttachment ? w("Uploading...", "Subiendo...", lang) : w("Attach product PDF/image/file", "Adjuntar PDF/imagen/archivo de producto", lang)}
          </Button>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6, lineHeight: 1.4 }}>
            {w(
              "Attach product files here, then use Edit Submittal above to revise manufacturer, model, submitted-to, and product data.",
              "Adjunte archivos de producto aqui, luego use Editar Entregable arriba para corregir fabricante, modelo, destinatario e informacion de producto.",
              lang
            )}
          </div>
        </div>
      )}
      {submittal.description && (
        <div style={{ padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{w("Description", "Descripción", lang)}</div>
          <div style={{ fontSize: 12, color: "#1E293B", whiteSpace: "pre-wrap" }}>{submittal.description}</div>
        </div>
      )}

      {/* AI Check Results */}
      {aiCheckResult && (
        <>
          <PanelSection title={w("AI Compliance Check", "Verificación IA de Cumplimiento", lang)} />
          <AiCheckDisplay result={aiCheckResult} lang={lang} />
        </>
      )}

      {/* Review Response */}
      {submittal.reviewDecision && (
        <>
          <PanelSection title={w("Review Response", "Respuesta de Revisión", lang)} />
          <InfoRow label={w("Decision", "Decisión", lang)} value={REVIEW_DECISIONS.find(o => o.value === submittal.reviewDecision)?.[lang === "es" ? "labelEs" : "label"] || submittal.reviewDecision} />
          <InfoRow label={w("Reviewer", "Revisor", lang)} value={submittal.reviewerName} />
          <InfoRow label={w("Date Reviewed", "Fecha de Revisión", lang)} value={fmtDate(submittal.reviewedAt)} />
          {submittal.complianceNotes && (
            <div style={{ padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{w("Compliance Notes", "Notas de Cumplimiento", lang)}</div>
              <div style={{ fontSize: 12, color: "#1E293B", whiteSpace: "pre-wrap" }}>{submittal.complianceNotes}</div>
            </div>
          )}
          {submittal.rejectionReason && (
            <div style={{ padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", marginBottom: 4 }}>{w("Rejection Reason", "Razón de Rechazo", lang)}</div>
              <div style={{ fontSize: 12, color: "#1E293B", whiteSpace: "pre-wrap" }}>{submittal.rejectionReason}</div>
            </div>
          )}
        </>
      )}

      {/* Add Review Response form */}
      {respondOpen && canWrite && (
        <div ref={respondRef} style={{ marginTop: 12, border: "1.5px solid #1E3A5F", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: "#1E3A5F", color: "white", fontSize: 12, fontWeight: 700 }}>
            {w("Review Response", "Respuesta de Revisión", lang)}
          </div>
          <div style={{ padding: 14 }}>
            <Field label={w("Official Review Decision *", "Decisión Oficial de Revisión *", lang)}>
              <FieldSelect value={reviewDecision} onChange={e => setReviewDecision(e.target.value)}>
                <option value="">{w("Select decision…", "Seleccione decisión…", lang)}</option>
                {REVIEW_DECISIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </FieldSelect>
            </Field>
            <Field label={w("Compliance Notes", "Notas de Cumplimiento", lang)}>
              <FieldTextarea rows={3} value={complianceNotes} onChange={e => setComplianceNotes(e.target.value)} />
            </Field>
            {["revise_resubmit", "rejected"].includes(reviewDecision) && (
              <Field label={w("Rejection Reason *", "Razón de Rechazo *", lang)}>
                <FieldTextarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder={w("Explain why…", "Explique por qué…", lang)} />
                <button
                  onClick={handleAiRejectionAssist}
                  disabled={aiRejectionLoading}
                  style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, border: "none", background: "#7C3AED", color: "white", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                >
                  {aiRejectionLoading ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 11, height: 11 }} />}
                  {w("AI Draft Rejection", "Borrador IA de Rechazo", lang)}
                </button>
              </Field>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button size="sm" onClick={handleRespond} disabled={respondLoading || !reviewDecision} style={{ gap: 5 }}>
                {respondLoading ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ width: 12, height: 12 }} />}
                {w("Save Review", "Guardar Revisión", lang)}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRespondOpen(false)} style={{ fontSize: 12 }}>
                {w("Cancel", "Cancelar", lang)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ball in Court History */}
      {bic.length > 0 && (
        <>
          <PanelSection title={w("Ball in Court History", "Historial de Espera", lang)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {bic.map((entry, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 8px", background: "#F8FAFC", borderRadius: 6, fontSize: 11 }}>
                <span style={{ color: "#6B7280", width: 140, flexShrink: 0 }}>{fmtDate(entry.setAt)}</span>
                <span style={{ fontWeight: 600, color: "#1E3A5F" }}>{entry.party}</span>
                <span style={{ color: "#6B7280" }}>- {entry.setBy}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Version History */}
      {(submittal.revisionNumber || 0) > 0 && (
        <>
          <PanelSection title={w("Version History", "Historial de Versiones", lang)} />
          <div style={{ padding: "6px 8px", background: "#F8FAFC", borderRadius: 6, fontSize: 11, color: "#6B7280" }}>
            {w("Revision", "Revisión", lang)} {submittal.revisionNumber} - {w("Parent ID", "ID Padre", lang)}: {submittal.parentSubmittalId}
          </div>
        </>
      )}

      {/* Viewed By */}
      <PanelSection title={w("Viewed By", "Visto Por", lang)} />
      {viewEvents.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9CA3AF", padding: "8px 0" }}>{w("No views recorded yet.", "Sin visualizaciones registradas aún.", lang)}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {viewEvents.map(evt => (
            <div key={evt.id} style={{ display: "flex", gap: 8, padding: "5px 8px", background: "#F8FAFC", borderRadius: 6, fontSize: 11 }}>
              <Eye style={{ width: 12, height: 12, color: "#6B7280", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontWeight: 600, color: "#1E3A5F" }}>{evt.userFullName}</span>
              <span style={{ color: "#6B7280" }}>{evt.userCompanyName}</span>
              <span style={{ color: "#9CA3AF", marginLeft: "auto" }}>{format(new Date(evt.viewedAt), "MMM d, HH:mm")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
