import { useState, useMemo, useRef, useEffect } from "react";
import {
  useListRfis, useCreateRfi, useUpdateRfi, useReviseRfi, useGenerateRfiQuestion,
  useListMembers, useListFiles,
} from "@workspace/api-client-react";
import type { Rfi, ProjectFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import { LinkedItemsPanel } from "@/components/LinkedItemsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Plus, X, FileText, Download,
  LayoutList, Table2, Sparkles, Clock, AlertTriangle, CheckCircle2,
  RefreshCw, ExternalLink, User, Building2, Mail, Phone, MapPin, Loader2,
  Search, UserPlus, Shield, Eye, DollarSign, Calendar, Trash2,
  Send, Copy, Check, PenLine, Navigation, ChevronLeft, FolderOpen,
  Upload, Camera, Clipboard, RotateCcw, ArrowUp, ArrowDown,
} from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { logClientError } from "@/lib/client-log";
import { format, differenceInDays, isValid, parseISO } from "date-fns";

// ─── helpers ─────────────────────────────────────────────────────────────────
function w(en: string, es: string, lang: string) { return lang === "es" ? es : en; }
function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? parseISO(d) : d;
  return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
}

const STATUS_BADGE: Record<string, string> = {
  open: "badge-blue", in_review: "badge-amber", responded: "badge-purple", closed: "badge-green",
};
const PRIORITY_BADGE: Record<string, string> = {
  low: "badge-gray", medium: "badge-amber", high: "badge-red", critical: "badge-red",
};

const DEFAULT_RFI_TYPES = ["Coordination", "General", "Drawing", "Spec", "Submittal", "Safety Data Sheet", "Change", "Other"];
const FILE_SOURCE_PROVIDERS = [
  { key: "google_drive", param: "google-drive", label: "Google Drive" },
  { key: "dropbox", param: "dropbox", label: "Dropbox" },
  { key: "bim360", param: "bim360", label: "BIM 360" },
  { key: "procore", param: "procore", label: "Procore" },
] as const;
type FileSourceProvider = typeof FILE_SOURCE_PROVIDERS[number];

// Attachments are plain strings (a URL, a file name, or an uploaded-file
// download URL carrying ?name=). These render them nicely + clickably.
const isUrlAttach = (v: string) => /^https?:\/\//.test(v) || v.startsWith("/api/");
const attachLabel = (v: string) => {
  const m = v.match(/[?&]name=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  try {
    if (/^https?:\/\//i.test(v) || v.startsWith("/api/")) {
      const path = new URL(v, window.location.origin).pathname;
      return decodeURIComponent(path.split("/").filter(Boolean).pop() || v);
    }
  } catch {
    return v;
  }
  return v;
};

type RfiPackageItem = {
  key: string;
  label: string;
  fileId?: number | null;
  attachment?: string | null;
  source?: string | null;
  include: boolean;
  order: number;
};

type RfiImagePresentation = {
  sourceFileId?: number | null;
  replacementFileId?: number | null;
  includeInCompletePdf?: boolean;
  crop?: { x: number; y: number; width: number; height: number } | null;
} | null;

type PendingImage = {
  file: File;
  url: string;
  mode: "source" | "replacement";
};

type RfiUiMode = "create" | "view" | "edit";
type RfiRecordState = "new" | "draft" | "sent" | "closed" | "reopened" | "revised";

type RfiActionKey =
  | "submit"
  | "cancel"
  | "save-rfi"
  | "export-pdf"
  | "export-complete-pdf"
  | "export-docx"
  | "export-audit-pdf"
  | "viewed-by"
  | "edit"
  | "close"
  | "reopen"
  | "raise-change-order"
  | "jump-viewpoint"
  | "save-response";

type RfiActionDefinition = {
  key: RfiActionKey;
  label: string;
  variant: "primary" | "secondary" | "danger";
};

type RfiCanonicalValues = {
  number?: string;
  projectName?: string;
  subject: string;
  status: string;
  priority: string;
  rfiType: string;
  dateRequested?: string;
  dateRequired?: string;
  daysOutstanding?: string;
  dateAnswered?: string;
  submittedByCompany: string;
  submittedByContact: string;
  submittedByAddress: string;
  submittedByPhone: string;
  submittedByEmail: string;
  submittedToCompany: string;
  submittedToPerson: string;
  submittedToAddress?: string;
  submittedToPhone?: string;
  submittedToEmail: string;
  drawingNumber: string;
  drawingTitle: string;
  specSection: string;
  detailNumber: string;
  noteNumber: string;
  locationDescription: string;
  referenceInput?: string;
  question: string;
  costImpact: string;
  costImpactAmount: string;
  costImpactReason: string;
  scheduleImpact: string;
  scheduleImpactDays: string;
  scheduleImpactReason: string;
  distributionList: string[];
  emailDescription?: string;
  emailDraft?: string;
  responseText?: string;
  answeredBy?: string;
};

type RfiCanonicalPermissions = {
  canEdit: boolean;
  canRespond: boolean;
  canClose: boolean;
  canReopen: boolean;
  canExport: boolean;
  canRaiseChangeOrder: boolean;
  canJumpViewpoint: boolean;
};

type RfiCanonicalActions = Partial<Record<RfiActionKey, () => void>>;

type RfiCanonicalFormProps = {
  lang: string;
  mode: RfiUiMode;
  recordState: RfiRecordState;
  values: RfiCanonicalValues;
  permissions: RfiCanonicalPermissions;
  validation?: Record<string, string | undefined>;
  references: string[];
  attachments: string[];
  imagePresentation: RfiImagePresentation;
  packageItems: RfiPackageItem[];
  responses: Array<{ id?: number; text: string; by?: string; date?: string }>;
  loading?: Partial<Record<"saving" | "uploading" | "questionAi" | "emailAi" | "response", boolean>>;
  actions: RfiCanonicalActions;
  onChange: (field: keyof RfiCanonicalValues, value: string) => void;
  onAddReference: () => void;
  onRemoveReference: (index: number) => void;
  onUploadFile: () => void;
  onGenerateQuestionAi: () => void;
  onGenerateEmailAi: () => void;
  onCopyEmail: () => void;
  actionMatrix?: RfiActionDefinition[];
};

function getCreateRfiActionMatrix(params: { hasViewpoint: boolean; lang: string }): RfiActionDefinition[] {
  const { hasViewpoint, lang } = params;
  const actions: RfiActionDefinition[] = [
    { key: "submit", label: w("Submit RFI", "Enviar RFI", lang), variant: "primary" },
    { key: "cancel", label: w("Cancel", "Cancelar", lang), variant: "secondary" },
  ];
  if (hasViewpoint) actions.push({ key: "jump-viewpoint", label: w("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  return actions;
}

export function getRfiCanonicalActionMatrix(params: {
  mode: RfiUiMode;
  recordState: RfiRecordState;
  permissions: RfiCanonicalPermissions;
  lang: string;
}): RfiActionDefinition[] {
  const { mode, recordState, permissions, lang } = params;
  if (recordState === "new") return getCreateRfiActionMatrix({ hasViewpoint: permissions.canJumpViewpoint, lang });
  if (mode === "edit") {
    const editActions: RfiActionDefinition[] = [
      { key: "save-rfi", label: w("Save RFI", "Guardar RFI", lang), variant: "primary" },
      { key: "cancel", label: w("Cancel", "Cancelar", lang), variant: "secondary" },
    ];
    if (permissions.canRespond) editActions.push({ key: "save-response", label: w("Save Response", "Guardar Respuesta", lang), variant: "primary" });
    if (recordState === "closed" && permissions.canReopen) editActions.push({ key: "reopen", label: w("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
    return editActions;
  }
  const actions: RfiActionDefinition[] = [];
  if (permissions.canEdit) actions.push({ key: "edit", label: w("Edit RFI", "Editar RFI", lang), variant: "secondary" });
  if (permissions.canExport) {
    actions.push(
      { key: "export-pdf", label: w("RFI PDF", "RFI PDF", lang), variant: "secondary" },
      { key: "export-complete-pdf", label: w("Complete RFI PDF", "PDF Completo RFI", lang), variant: "secondary" },
      { key: "export-docx", label: w("RFI DOCX", "RFI DOCX", lang), variant: "secondary" },
      { key: "export-audit-pdf", label: w("RFI Audit PDF", "PDF Auditoria RFI", lang), variant: "secondary" },
    );
  }
  if (recordState === "closed") {
    if (permissions.canReopen) actions.push({ key: "reopen", label: w("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
  } else if (permissions.canClose) {
    actions.push({ key: "close", label: w("Close RFI", "Cerrar RFI", lang), variant: "danger" });
  }
  if (permissions.canRespond) actions.push({ key: "save-response", label: w("Save Response", "Guardar Respuesta", lang), variant: "primary" });
  if (permissions.canJumpViewpoint) actions.push({ key: "jump-viewpoint", label: w("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  if (permissions.canRaiseChangeOrder) actions.push({ key: "raise-change-order", label: w("Raise Change Order", "Crear Orden de Cambio", lang), variant: "secondary" });
  return actions;
}

function getSavedRfiActionMatrix(params: {
  rfi: Rfi;
  canWrite: boolean;
  isProjectAdmin: boolean;
  hasViewpoint: boolean;
  isEditing: boolean;
  lang: string;
}): RfiActionDefinition[] {
  const { rfi, canWrite, isProjectAdmin, hasViewpoint, isEditing, lang } = params;
  const actions: RfiActionDefinition[] = [
    { key: "export-pdf", label: w("RFI PDF", "RFI PDF", lang), variant: "secondary" },
    { key: "export-complete-pdf", label: w("Complete RFI PDF", "PDF Completo RFI", lang), variant: "secondary" },
    { key: "export-docx", label: w("RFI DOCX", "RFI DOCX", lang), variant: "secondary" },
    { key: "export-audit-pdf", label: w("RFI Audit PDF", "PDF Auditoria RFI", lang), variant: "secondary" },
    { key: "viewed-by", label: w("Viewed By", "Visto Por", lang), variant: "secondary" },
  ];
  if (canWrite && !isEditing) actions.push({ key: "edit", label: w("Edit RFI", "Editar RFI", lang), variant: "secondary" });
  if (rfi.status === "closed") {
    if (canWrite) actions.push({ key: "reopen", label: w("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
  } else if (isProjectAdmin) {
    actions.push({ key: "close", label: w("Close RFI", "Cerrar RFI", lang), variant: "danger" });
  }
  if (canWrite) actions.push({ key: "raise-change-order", label: w("Raise Change Order", "Crear Orden de Cambio", lang), variant: "secondary" });
  if (hasViewpoint) actions.push({ key: "jump-viewpoint", label: w("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  return actions;
}

function fileIdFromAttachment(value: string): number | null {
  const match = value.match(/\/files\/(\d+)\/download\b/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function attachmentExt(label: string) {
  const ext = label.split(".").pop();
  return ext && ext !== label ? ext.toUpperCase() : "REF";
}

function packageItemsFromAttachments(attachments: string[], files: ProjectFile[] = []): RfiPackageItem[] {
  return attachments.map((attachment, order) => {
    const fileId = fileIdFromAttachment(attachment);
    const file = fileId ? files.find(f => f.id === fileId) : files.find(f => f.fileName === attachment);
    const label = file?.fileName || attachLabel(attachment);
    return {
      key: file ? `file:${file.id}` : `ref:${order}:${label}`,
      label,
      fileId: file?.id ?? fileId,
      attachment,
      source: file?.source || null,
      include: true,
      order,
    };
  });
}

function normalizePackageItems(value: unknown, attachments: string[], files: ProjectFile[] = []): RfiPackageItem[] {
  if (!Array.isArray(value) || value.length === 0) return packageItemsFromAttachments(attachments, files);
  return value.map((raw, order) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const fileId = typeof item.fileId === "number" ? item.fileId : null;
    const attachment = typeof item.attachment === "string" ? item.attachment : null;
    const file = fileId ? files.find(f => f.id === fileId) : attachment ? files.find(f => f.fileName === attachment) : undefined;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : file?.fileName || (attachment ? attachLabel(attachment) : `Package item ${order + 1}`);
    return {
      key: typeof item.key === "string" && item.key.trim() ? item.key.trim() : file ? `file:${file.id}` : `ref:${order}:${label}`,
      label,
      fileId: file?.id ?? fileId,
      attachment,
      source: typeof item.source === "string" ? item.source : file?.source || null,
      include: item.include !== false,
      order: typeof item.order === "number" ? item.order : order,
    };
  }).sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }));
}

function getBallInCourt(rfi: Rfi): { label: string; color: string } | null {
  if (rfi.status === "closed") return null;
  // Not sent yet: the author still holds it — nobody is "responding" to a draft.
  if (rfi.sendStatus !== "sent" && !rfi.sentAt) {
    return { label: `${rfi.submittedByCompany || rfi.createdByName || "Author"} — to send`, color: "#B45309" };
  }
  if (rfi.status === "responded") {
    return { label: rfi.submittedByCompany || rfi.createdByName || "Submitter", color: "#7C3AED" };
  }
  return { label: rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer", color: "#0369A1" };
}

function daysColor(days: number, isOverdue: boolean) {
  if (isOverdue) return "#DC2626";
  if (days > 7) return "#D97706";
  return "#16A34A";
}

// Parse distribution entry - "EXT:name:email:phone" or plain email
function parseDistEntry(entry: string): { display: string; isExternal: boolean; email: string } {
  if (entry.startsWith("EXT:")) {
    const parts = entry.slice(4).split(":");
    const name = parts[0] || "";
    const email = parts[1] || "";
    return { display: `${name} <${email}> (ext.)`, isExternal: true, email };
  }
  return { display: entry, isExternal: false, email: entry };
}

// ─── FileSearchDropdown ───────────────────────────────────────────────────────
function FileSearchDropdown({ files, onSelect, onClose }: {
  files: ProjectFile[];
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = files.filter(f => !q || f.fileName.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  return (
    <div style={{
      position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0,
      background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
      borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 8,
    }}>
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search files…" style={{ fontSize: 11, marginBottom: 6 }} autoFocus />
      {filtered.length === 0 && <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", padding: "4px 6px" }}>No files found</p>}
      {filtered.map(f => (
        <button key={f.id} onClick={() => { onSelect(f.fileName); onClose(); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 8px", fontSize: 11, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--foreground))" }}
          onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--secondary))")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <FileText style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
          {f.fileName}
        </button>
      ))}
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────
const RefFieldWithSearch = ({ label, value, onChange, placeholder, fieldKey, fileSearch, setFileSearch, files, lang }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; fieldKey: string;
  fileSearch: string | null; setFileSearch: (v: string | null) => void; files: any[]; lang: string;
}) => (
  <FormField label={label}>
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ fontSize: 12, flex: 1 }} />
        <button
          type="button"
          title={w("Search project files", "Buscar archivos del proyecto", lang)}
          onClick={() => setFileSearch(fileSearch === fieldKey ? null : fieldKey)}
          style={{ padding: "0 8px", border: "1px solid hsl(var(--border))", borderRadius: 6, background: fileSearch === fieldKey ? "hsl(var(--primary))" : "transparent", cursor: "pointer", color: fileSearch === fieldKey ? "white" : "hsl(var(--muted-foreground))" }}
        >
          <Search style={{ width: 12, height: 12 }} />
        </button>
      </div>
      {fileSearch === fieldKey && (
        <FileSearchDropdown
          files={files || []}
          onSelect={(name) => { onChange(name); setFileSearch(null); }}
          onClose={() => setFileSearch(null)}
        />
      )}
    </div>
  </FormField>
);

export function RfisTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { lang } = useI18n();
  const { getLabel, getOptions } = useConfig();
  const { user, token } = useAuthStore();
  const { data: rfis, isLoading } = useListRfis(projectId);
  const { data: members } = useListMembers(projectId);
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "log">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRfi, setSelectedRfi] = useState<Rfi | null>(null);
  const [revising, setRevising] = useState<Rfi | null>(null);
  const [createPreload, setCreatePreload] = useState<{ subject?: string; question?: string; location?: string } | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [deleteRfi, setDeleteRfi] = useState<{ id: number; label: string; projectId: number } | null>(null);
  const rfisQueryClient = useQueryClient();

  // Prefill a new RFI from query params (e.g. navigated from a Lens viewpoint).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const note = sp.get("note");
    const trade = sp.get("trade");
    const floor = sp.get("floor");
    const ref = sp.get("ref");
    const rfiParam = sp.get("rfi");

    // Deep-link straight to an existing RFI's detail panel (the plugin opens the
    // browser after creating an RFI from a viewpoint). Fetch by id rather than
    // relying on the list, since a brand-new draft may not be loaded/filtered in yet.
    if (rfiParam) {
      const rfiId = Number(rfiParam);
      window.history.replaceState({}, "", `/projects/${projectId}/rfis`);
      if (Number.isFinite(rfiId)) {
        (async () => {
          const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfiId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.ok) {
            setSelectedRfi(await r.json() as Rfi);
          } else {
            toast({ title: w("Could not open that RFI.", "No se pudo abrir ese RFI.", lang), variant: "destructive" });
          }
        })();
      }
      return;
    }

    if (note || trade || floor || ref) {
      const base = trade
        ? `${trade}${floor ? ` — ${floor}` : ""}`
        : (note || "").slice(0, 80);
      const subject = ref ? `${ref}${base ? ` — ${base}` : ""}` : base;
      setCreatePreload({ subject, question: note || "", location: floor || "" });
      setShowCreate(true);
      window.history.replaceState({}, "", `/projects/${projectId}/rfis`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/projects/${projectId}/rfis/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requiresConfirmation) {
          const warningText = data.warnings.slice(0,3).map((w: any) => `${w.message}`).join("\n");
          const proceed = confirm(`AI found potential issues:\n\n${warningText}\n\n${data.safeCount ?? 0} records are safe to import.\n\nProceed with safe records only?`);
          if (proceed) {
            const fd2 = new FormData();
            fd2.append("file", e.target.files![0]);
            fd2.append("forceImport", "true");
            const r2 = await fetch(`/api/v1/projects/${projectId}/rfis/import`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd2,
            });
            const d2 = await r2.json();
            setImportMsg(`${d2.imported ?? 0} RFIs imported (duplicates skipped)`);
          } else {
            setImportMsg("Import cancelled.");
          }
        } else {
          let msg = `${data.imported ?? 0} RFIs imported successfully`;
          if (data.renameCount > 0) {
            msg += `. ${data.renameCount} duplicate(s) renamed: ${data.renamed.slice(0,3).map((r: any) => `${r.original} → ${r.renamed}`).join(", ")}`;
          }
          setImportMsg(msg);
          setTimeout(() => window.location.reload(), 2500);
        }
        setTimeout(() => setImportMsg(""), 8000);
      } else {
        setImportMsg("Import failed — please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const handleExportAllExcel = async () => {
    if (!rfis) return;
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const params = new URLSearchParams({ view, status: statusFilter, search });
      const response = await fetch(`/api/v1/projects/${projectId}/rfis/export-excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Excel export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RFI-${view === "log" ? "Log" : "Summary"}-${projectId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: w("Excel exported", "Excel exportado", lang) });
    } catch (error) {
      logClientError("RFI Excel export", error);
      toast({ title: w("Excel export failed", "Error al exportar Excel", lang), variant: "destructive" });
    }
  };
  const filtered = useMemo(() => {
    if (!rfis) return [];
    return rfis
      .filter(r => statusFilter === "all" || r.status === statusFilter)
      .filter(r => {
        if (!search) return true;
        const s = search.toLowerCase();
        return r.number.toLowerCase().includes(s) ||
          r.subject.toLowerCase().includes(s) ||
          (r.submittedByCompany || "").toLowerCase().includes(s) ||
          (r.submittedToCompany || "").toLowerCase().includes(s);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [rfis, statusFilter, search]);

  const stats = useMemo(() => ({
    total: rfis?.length ?? 0,
    open: rfis?.filter(r => r.status === "open").length ?? 0,
    inReview: rfis?.filter(r => r.status === "in_review").length ?? 0,
    responded: rfis?.filter(r => r.status === "responded").length ?? 0,
    closed: rfis?.filter(r => r.status === "closed").length ?? 0,
  }), [rfis]);

  const overdueCount = useMemo(() =>
    rfis?.filter(r => {
      if (r.status === "closed") return false;
      const due = r.dateRequired || r.dueDate;
      if (due) return new Date(due) < new Date();
      return differenceInDays(new Date(), new Date(r.createdAt)) > 14;
    }).length ?? 0
  , [rfis]);

  const handleExportPdf = async (rfi: Rfi) => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}-Request-for-Information.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCompletePdf = async (rfi: Rfi) => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export-complete`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({})) as { error?: string; details?: string[] };
      toast({
        title: data.error || "Complete RFI PDF failed",
        description: data.details?.join("; "),
        variant: "destructive",
      });
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}-Complete-RFI-Package.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWordRfi = async (rfi: Rfi) => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export-word`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${rfi.number} exported as Word (.docx)` });
    } catch {
      toast({ title: w("Word export failed", "Error al exportar Word", lang), variant: "destructive" });
    }
  };

  // Config can contain duplicate rfi_status entries; dedupe by value so the stats
  // strip, filter tabs, and status <select> each show a status only once.
  const statusOptions = [...new Map(getOptions("rfi_status").map(o => [o.value, o])).values()];

  // Full-page RFI detail (not a modal): when a row is selected, render only the detail page
  // with a Back button — matching Change Orders / Lens Viewpoints. No overlay, no pop-up.
  if (selectedRfi) {
    return (
      <RfiDetailPanel
        projectId={projectId}
        rfi={selectedRfi}
        canWrite={canWrite}
        lang={lang}
        members={members || []}
        user={user}
        onClose={() => setSelectedRfi(null)}
        onRevise={(rfi) => { setSelectedRfi(null); setRevising(rfi); }}
        onExportPdf={handleExportPdf}
        onExportCompletePdf={handleExportCompletePdf}
        onUpdate={(updated) => setSelectedRfi(updated)}
      />
    );
  }

  // Create / edit RFI as a full page too (not a modal).
  if (showCreate || revising) {
    return (
      <RfiCreatePanel
        projectId={projectId}
        preload={revising ?? undefined}
        prefill={createPreload}
        existingRfis={rfis || []}
        members={members || []}
        user={user}
        lang={lang}
        onClose={() => { setShowCreate(false); setRevising(null); setCreatePreload(undefined); }}
      />
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{w("RFIs", "Solicitudes de Información", lang)}</div>
          <div className="section-sub">
            {stats.total} {w("total", "total", lang)} · {stats.open} {w("open", "abierto", lang)} · {stats.inReview} {w("in review", "en revisión", lang)} · {stats.responded} {w("responded", "respondido", lang)} · {stats.closed} {w("closed", "cerrado", lang)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid hsl(var(--border))", borderRadius: 6, overflow: "hidden" }}>
            <button onClick={() => setView("list")} style={{ padding: "5px 10px", background: view === "list" ? "hsl(var(--primary))" : "transparent", color: view === "list" ? "white" : "hsl(var(--muted-foreground))", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <LayoutList style={{ width: 13, height: 13 }} />{w("List", "Lista", lang)}
            </button>
            <button onClick={() => setView("log")} style={{ padding: "5px 10px", background: view === "log" ? "hsl(var(--primary))" : "transparent", color: view === "log" ? "white" : "hsl(var(--muted-foreground))", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <Table2 style={{ width: 13, height: 13 }} />{w("Log", "Registro", lang)}
            </button>
          </div>
          {rfis && rfis.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportAllExcel} style={{ gap: 5, fontSize: 11 }}>
              <Download style={{ width: 12, height: 12 }} />{w("Export All", "Exportar Todo", lang)}
            </Button>
          )}
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <span className="btn btn-outline btn-sm" style={{ fontSize: 12, opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? w("Importing...","Importando...",lang) : w("Import","Importar",lang)}
              </span>
            </label>
          )}
          {importMsg && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", color: "#1D4ED8", fontSize: 13, marginTop: 10 }}>
              {importMsg}
            </div>
          )}
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />{w("New RFI", "Nuevo RFI", lang)}
            </Button>
          )}
        </div>
      </div>

      {overdueCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 12px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, fontSize: 12, color: "#BE123C" }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span><strong>{overdueCount}</strong> RFI{overdueCount !== 1 ? "s" : ""} {w("overdue — response required.", "vencido(s) — se requiere respuesta.", lang)}</span>
        </div>
      )}

      {/* Stats strip — Lens-style, clickable to filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--secondary) / 0.3)" }}>
        <button onClick={() => setStatusFilter("all")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: statusFilter === "all" ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
          {stats.total} {w("total", "total", lang)}
        </button>
        {statusOptions.map(o => {
          const n = (rfis || []).filter(r => r.status === o.value).length;
          return (
            <button key={o.value} onClick={() => setStatusFilter(o.value)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: statusFilter === o.value ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {getLabel("rfi_status", o.value)} <span style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>{n}</span>
            </button>
          );
        })}
        {overdueCount > 0 && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#BE123C" }}>{overdueCount} {w("overdue", "vencido(s)", lang)}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <Input placeholder={w("Search RFIs…", "Buscar RFIs…", lang)} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280, fontSize: 12 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", ...([...new Set(statusOptions.map(o => o.value))])].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: statusFilter === s ? "1.5px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
              background: statusFilter === s ? "hsl(var(--primary) / 0.08)" : "transparent",
              color: statusFilter === s ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}>
              {s === "all" ? w("All", "Todos", lang) : getLabel("rfi_status", s)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><MessageSquare style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} /></div>
          <div className="empty-title">{rfis?.length === 0 ? w("No RFIs yet", "Sin RFIs aún", lang) : w("No matching RFIs", "No hay RFIs que coincidan", lang)}</div>
          <div className="empty-desc">{rfis?.length === 0 ? w("Create your first RFI to begin tracking information requests.", "Crea tu primer RFI para comenzar a rastrear solicitudes de información.", lang) : w("Try adjusting your search or filter.", "Intenta ajustar tu búsqueda o filtro.", lang)}</div>
        </div>
      )}

      {/* LIST VIEW */}
      {!isLoading && filtered.length > 0 && view === "list" && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>{w("RFI #", "RFI #", lang)}</th>
                <th>{w("Subject", "Asunto", lang)}</th>
                <th style={{ width: 100 }}>{w("Status", "Estado", lang)}</th>
                <th style={{ width: 85 }}>{w("Priority", "Prioridad", lang)}</th>
                <th>{w("Ball in Court", "Responsable", lang)}</th>
                <th>{w("Submitted By", "Enviado por", lang)}</th>
                <th style={{ width: 100 }}>{w("Date Req.", "Fecha Req.", lang)}</th>
                <th style={{ width: 80 }}>{w("Days Out", "Días", lang)}</th>
                <th style={{ width: 110, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rfi => {
                const due = rfi.dateRequired || rfi.dueDate;
                const isOverdue = rfi.status !== "closed" && due ? new Date(due) < new Date() : false;
                const days = differenceInDays(new Date(), new Date(rfi.createdAt));
                const bic = getBallInCourt(rfi);
                return (
                  <tr key={rfi.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRfi(rfi)}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>
                        {rfi.number}{(rfi.revisionNumber ?? 0) > 0 && <span style={{ color: "#7C3AED", marginLeft: 2 }}>R{rfi.revisionNumber}</span>}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isOverdue && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626", flexShrink: 0, display: "inline-block" }} />}
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{rfi.subject}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span></td>
                    <td><span className={`badge ${PRIORITY_BADGE[rfi.priority] ?? "badge-gray"}`}>{getLabel("rfi_priority", rfi.priority)}</span></td>
                    <td>
                      {bic ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: bic.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: bic.color }}>{bic.label}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#16A34A" }}>{w("Closed", "Cerrado", lang)}</span>
                      )}
                    </td>
                    <td><span style={{ fontSize: 12 }}>{rfi.submittedByCompany || rfi.createdByName || "—"}</span></td>
                    <td style={{ fontSize: 11, color: isOverdue ? "#DC2626" : "hsl(var(--muted-foreground))", fontWeight: isOverdue ? 700 : 400, whiteSpace: "nowrap" }}>{fmt(due)}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: daysColor(days, isOverdue) }}>{days}d</span>
                      {rfi.scheduleImpact && rfi.scheduleImpact !== "No Schedule Impact" && (
                        <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, color: "#D97706" }}><AlertTriangle size={8} /> {w("Sched.", "Prog.", lang)}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button title="Export RFI PDF"
                          style={{ padding: "3px 6px", fontSize: 10, border: "1px solid hsl(var(--border))", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#2563EB", display: "flex", alignItems: "center", gap: 3 }}
                          onClick={e => { e.stopPropagation(); handleExportPdf(rfi); }}
                        >
                          <FileText style={{ width: 10, height: 10 }} />RFI PDF
                        </button>
                        <button title="Export RFI DOCX"
                          style={{ padding: "3px 6px", fontSize: 10, border: "1px solid #C4B5FD", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#7C3AED", display: "flex", alignItems: "center", gap: 3 }}
                          onClick={e => { e.stopPropagation(); handleExportWordRfi(rfi); }}
                        >
                          <FileText style={{ width: 10, height: 10 }} />RFI DOCX
                        </button>
                        {canWrite && (
                          <button
                            style={{ padding: "3px 7px", fontSize: 10, border: "1px solid hsl(var(--border))", borderRadius: 4, background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
                            onClick={e => { e.stopPropagation(); setSelectedRfi(rfi); }}
                          >
                            {w("View", "Ver", lang)}
                          </button>
                        )}
                        {canWrite && (
                          <button
                            title={w("Delete RFI", "Eliminar RFI", lang)}
                            style={{ padding: "3px 6px", fontSize: 10, border: "1px solid #FECACA", borderRadius: 4, background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center" }}
                            onClick={e => { e.stopPropagation(); setDeleteRfi({ id: rfi.id, label: rfi.number, projectId }); }}
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

      {/* LOG VIEW */}
      {!isLoading && filtered.length > 0 && view === "log" && (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
          <table className="data-table" style={{ minWidth: 980, borderRadius: 0, border: "none" }}>
            <thead>
              <tr>
                <th style={{ width: 80, whiteSpace: "nowrap" }}>{w("RFI #", "RFI #", lang)}</th>
                <th style={{ minWidth: 160 }}>{w("Description", "Descripción", lang)}</th>
                <th style={{ minWidth: 110 }}>{w("Req. By Co.", "Empresa Solic.", lang)}</th>
                <th style={{ minWidth: 110 }}>{w("Sent To Co.", "Empresa Destino", lang)}</th>
                <th style={{ width: 88, whiteSpace: "nowrap" }}>{w("Forwarded", "Enviado", lang)}</th>
                <th style={{ width: 88, whiteSpace: "nowrap" }}>{w("Answered", "Respondido", lang)}</th>
                <th style={{ width: 90, whiteSpace: "nowrap" }}>{w("Status", "Estado", lang)}</th>
                <th style={{ minWidth: 120 }}>{w("Sched. Impact", "Impacto Prog.", lang)}</th>
                <th style={{ width: 110, textAlign: "right", position: "sticky", right: 0, background: "hsl(var(--card))", zIndex: 2, boxShadow: "-2px 0 4px rgba(0,0,0,0.05)" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rfi => (
                <tr key={rfi.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRfi(rfi)}>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{rfi.number}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.subject}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedByCompany || "—"}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedToCompany || rfi.submittedToPerson || "—"}</span></td>
                  <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{fmt(rfi.dateRequested || rfi.createdAt)}</td>
                  <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{fmt(rfi.dateAnswered || rfi.respondedAt)}</td>
                  <td><span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span></td>
                  <td>
                    {rfi.scheduleImpact && rfi.scheduleImpact !== "No Schedule Impact"
                      ? <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>{rfi.scheduleImpact}{rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays}d)` : ""}</span>
                      : <span style={{ fontSize: 11, color: "#16A34A" }}>{w("None", "Ninguno", lang)}</span>
                    }
                  </td>
                  <td style={{ textAlign: "right", position: "sticky", right: 0, background: "hsl(var(--card))", zIndex: 1, boxShadow: "-2px 0 4px rgba(0,0,0,0.05)" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button title="Export RFI PDF"
                        style={{ padding: "3px 7px", fontSize: 10, border: "1px solid hsl(var(--border))", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#2563EB", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}
                        onClick={e => { e.stopPropagation(); handleExportPdf(rfi); }}
                      >
                        <FileText style={{ width: 10, height: 10 }} />RFI PDF
                      </button>
                      <button title="Export RFI DOCX"
                        style={{ padding: "3px 7px", fontSize: 10, border: "1px solid #C4B5FD", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#7C3AED", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}
                        onClick={e => { e.stopPropagation(); handleExportWordRfi(rfi); }}
                      >
                        <FileText style={{ width: 10, height: 10 }} />RFI DOCX
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteRfi && (
        <DeleteConfirmModal
          open
          onClose={() => setDeleteRfi(null)}
          onDeleted={() => {
            rfisQueryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
            setDeleteRfi(null);
          }}
          endpoint={`/api/v1/projects/${deleteRfi.projectId}/rfis/${deleteRfi.id}`}
          entityLabel={`RFI ${deleteRfi.label}`}
          warning={w("Linked items will be detached.", "Los elementos enlazados serán desvinculados.", lang)}
        />
      )}

      {/* Create/edit and detail both render as full pages via the early returns above — no modals. */}
    </div>
  );
}

// ─── RFI Create Panel ─────────────────────────────────────────────────────────
function RfiCreatePanel({ projectId, preload, prefill, existingRfis, members, user, lang, onClose }: {
  projectId: number;
  preload?: Rfi;
  prefill?: { subject?: string; question?: string; location?: string };
  existingRfis: Rfi[];
  members: { userFullName: string; userCompanyName?: string; userEmail: string }[];
  user: { fullName: string; companyName: string; email: string } | null;
  lang: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getOptions } = useConfig();
  const priorityOptions = getOptions("rfi_priority");
  const configuredRfiTypes = getOptions("rfi_type");
  const rfiTypeOptions = configuredRfiTypes.length
    ? configuredRfiTypes.map(o => ({ value: o.value, label: lang === "es" ? o.labelEs : o.label }))
    : DEFAULT_RFI_TYPES.map(t => ({ value: t, label: t }));
  const { data: files } = useListFiles(projectId);

  const isRevision = !!preload;

  // Fix 1 — auto-populate project address from last RFI that has one
  const lastAddress = useMemo(() => {
    if (preload?.projectAddress) return preload.projectAddress;
    const withAddr = [...existingRfis].reverse().find(r => r.projectAddress);
    return withAddr?.projectAddress || "";
  }, [existingRfis, preload]);

  const [subject, setSubject] = useState(preload?.subject || prefill?.subject || "");
  const [rfiType, setRfiType] = useState(preload?.rfiType || rfiTypeOptions[0]?.value || "");
  const [priority, setPriority] = useState(preload?.priority || priorityOptions[0]?.value || "medium");
  const [dateRequested, setDateRequested] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateRequired, setDateRequired] = useState(preload?.dateRequired ? format(parseISO(preload.dateRequired), "yyyy-MM-dd") : "");
  const [projectAddress, setProjectAddress] = useState(lastAddress);

  const [sByCompany, setsByCompany] = useState(preload?.submittedByCompany || user?.companyName || "");
  const [sByContact, setsByContact] = useState(preload?.submittedByContact || user?.fullName || "");
  const [sByAddress, setsByAddress] = useState(preload?.submittedByAddress || "");
  const [sByPhone, setsByPhone] = useState(preload?.submittedByPhone || "");
  const [sByEmail, setsByEmail] = useState(preload?.submittedByEmail || user?.email || "");

  const [sToCompany, setsToCompany] = useState(preload?.submittedToCompany || "");
  const [sToPerson, setsToPerson] = useState(preload?.submittedToPerson || "");
  const [sToEmail, setsToEmail] = useState(preload?.submittedToEmail || "");

  // Fix 2 — add external person to submitted to
  const [showAddExtPerson, setShowAddExtPerson] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [extPersonName, setExtPersonName] = useState("");
  const [extPersonEmail, setExtPersonEmail] = useState("");
  const [extPersonPhone, setExtPersonPhone] = useState("");

  const [drawingNum, setDrawingNum] = useState(preload?.drawingNumber || "");
  const [drawingTitle, setDrawingTitle] = useState(preload?.drawingTitle || "");
  const [specSection, setSpecSection] = useState(preload?.specSection || "");
  const [detailNum, setDetailNum] = useState(preload?.detailNumber || "");
  const [noteNum, setNoteNum] = useState(preload?.noteNumber || "");
  const [location, setLocation] = useState(preload?.locationDescription || prefill?.location || "");

  // Fix 3 — file search state per reference field
  const [fileSearch, setFileSearch] = useState<string | null>(null);

  const [question, setQuestion] = useState(preload?.question || prefill?.question || "");
  const [attachments, setAttachments] = useState<string[]>(preload?.attachmentsJson || []);
  const [packageItems, setPackageItems] = useState<RfiPackageItem[]>(() => normalizePackageItems((preload as Rfi & { attachmentPackageJson?: unknown })?.attachmentPackageJson, preload?.attachmentsJson || [], []));
  const [imagePresentation, setImagePresentation] = useState<RfiImagePresentation>(() => (preload as Rfi & { imagePresentationJson?: RfiImagePresentation })?.imagePresentationJson || null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [attachInput, setAttachInput] = useState("");

  const [costImpact, setCostImpact] = useState(preload?.costImpact || "No Cost Impact");
  const [costAmount, setCostAmount] = useState(preload?.costImpactAmount || "");
  const [costReason, setCostReason] = useState((preload as Rfi & { costImpactReason?: string })?.costImpactReason || "");
  const [schedImpact, setSchedImpact] = useState(preload?.scheduleImpact || "No Schedule Impact");
  const [schedDays, setSchedDays] = useState(preload?.scheduleImpactDays != null ? String(preload.scheduleImpactDays) : "");
  const [schedReason, setSchedReason] = useState((preload as Rfi & { scheduleImpactReason?: string })?.scheduleImpactReason || "");

  const [distList, setDistList] = useState<string[]>(preload?.distributionList || []);

  // Fix 4 — external contact form state
  const [showAddExtContact, setShowAddExtContact] = useState(false);
  const [extContactName, setExtContactName] = useState("");
  const [extContactEmail, setExtContactEmail] = useState("");
  const [extContactPhone, setExtContactPhone] = useState("");

  const [aiDesc, setAiDesc] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [emailDescription, setEmailDescription] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);
  const [emailDraftError, setEmailDraftError] = useState("");
  const [emailCopied, setEmailCopied] = useState(false);
  const costReasonRequired = costImpact === "Cost Increase TBD" || costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const costAmountRequired = costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const scheduleDaysRequired = schedImpact === "Increase in Calendar Days" || schedImpact === "Decrease in Calendar Days";
  const addReference = () => {
    const value = attachInput.trim();
    if (!value) return;
    setAttachments(prev => prev.includes(value) ? prev : [...prev, value]);
    setPackageItems(prev => prev.some(item => item.attachment === value) ? prev : [...prev, ...packageItemsFromAttachments([value], files || []).map(item => ({ ...item, order: prev.length }))]);
    setAttachInput("");
  };
  useEffect(() => {
    setPackageItems(prev => {
      const next = [...prev];
      for (const item of packageItemsFromAttachments(attachments, files || [])) {
        if (!next.some(existing => existing.attachment === item.attachment || (existing.fileId && existing.fileId === item.fileId))) {
          next.push({ ...item, order: next.length });
        }
      }
      return next.filter(item => !item.attachment || attachments.includes(item.attachment)).map((item, order) => ({ ...item, order }));
    });
  }, [attachments, files]);

  // AI document import: read an existing PDF/Word/Excel and prefill this form.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const handleImportPrefill = async (file: File) => {
    setImporting(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/import-prefill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Import failed"); }
      const { fields } = await resp.json() as { fields: Record<string, string | null> };
      const s = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string).trim() : "");
      if (s("subject")) setSubject(s("subject"));
      if (s("question")) setQuestion(s("question"));
      if (s("submittedToCompany")) setsToCompany(s("submittedToCompany"));
      if (s("submittedToPerson")) setsToPerson(s("submittedToPerson"));
      if (s("submittedToEmail")) setsToEmail(s("submittedToEmail"));
      if (s("submittedByCompany")) setsByCompany(s("submittedByCompany"));
      if (s("submittedByContact")) setsByContact(s("submittedByContact"));
      if (s("submittedByEmail")) setsByEmail(s("submittedByEmail"));
      if (s("drawingNumber")) setDrawingNum(s("drawingNumber"));
      if (s("specSection")) setSpecSection(s("specSection"));
      if (s("locationDescription")) setLocation(s("locationDescription"));
      if (["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"].includes(s("costImpact"))) setCostImpact(s("costImpact"));
      if (["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"].includes(s("scheduleImpact"))) setSchedImpact(s("scheduleImpact"));
      if (["low", "medium", "high"].includes(s("priority"))) setPriority(s("priority"));
      if (/^\d{4}-\d{2}-\d{2}$/.test(s("dateRequired"))) setDateRequired(s("dateRequired"));
      setImportedFrom(file.name);
      toast({ title: w("Fields filled from document — review before creating", "Campos completados del documento — revise antes de crear", lang) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Could not read document", "No se pudo leer el documento", lang), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Upload an attachment from the user's computer, then add its download URL.
  const attachFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const uploadAttachment = async (file: File, imageCrop?: { x: number; y: number; width: number; height: number } | null) => {
    setUploadingAtt(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { downloadUrl, fileId, fileName } = await resp.json() as { downloadUrl: string; fileId: number; fileName: string };
      setAttachments(prev => [...prev, downloadUrl]);
      if (file.type.startsWith("image/")) {
        setImagePresentation({ sourceFileId: fileId, includeInCompletePdf: true, crop: imageCrop || null });
        setPackageItems(prev => [...prev, { key: `file:${fileId}`, label: fileName, fileId, attachment: downloadUrl, source: "rfi-attachment", include: true, order: prev.length }]);
      }
      toast({ title: w("File uploaded and attached", "Archivo subido y adjuntado", lang) });
    } catch {
      toast({ title: w("Upload failed", "Error al subir", lang), variant: "destructive" });
    } finally {
      setUploadingAtt(false);
    }
  };

  const beginPendingImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: w("Select an image file.", "Seleccione un archivo de imagen.", lang), variant: "destructive" });
      return;
    }
    setPendingImage(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file), mode: "source" };
    });
  };

  const pasteCreateImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          beginPendingImage(new File([blob], "clipboard-rfi-image.png", { type }));
          return;
        }
      }
      toast({ title: w("Clipboard does not contain an image.", "El portapapeles no contiene una imagen.", lang), variant: "destructive" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Clipboard image access was denied.", "Acceso a imagen del portapapeles denegado.", lang), variant: "destructive" });
    }
  };

  const captureCreateImage = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast({ title: w("Screen capture is not supported in this browser.", "La captura de pantalla no es compatible con este navegador.", lang), variant: "destructive" });
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      stream.getTracks().forEach(track => track.stop());
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not capture image");
      beginPendingImage(new File([blob], "screen-capture-rfi-image.png", { type: "image/png" }));
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Screen capture unavailable or denied.", "Captura de pantalla no disponible o denegada.", lang), variant: "destructive" });
    }
  };

  const [connectedFileSourcesCreate, setConnectedFileSourcesCreate] = useState<FileSourceProvider[]>([]);
  const [cloudPickerCreate, setCloudPickerCreate] = useState<FileSourceProvider | null>(null);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/me/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d) => {
        const list = Array.isArray(d) ? d as { provider: string; status: string }[] : [];
        setConnectedFileSourcesCreate(FILE_SOURCE_PROVIDERS.filter(p => list.some(c => c.provider === p.key && c.status === "connected")));
      })
      .catch((error) => logClientError("RFI create file source connection load", error));
  }, []);

  const uniqueCompanies = [...new Set(members.map(m => m.userCompanyName).filter(Boolean) as string[])];
  const companyPeople = (company: string) => members.filter(m => m.userCompanyName === company);

  const lastRfiData = useRef<any>(null);

  const { mutate: createRfi, isPending } = useCreateRfi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w(isRevision ? "RFI revision created" : "RFI created", isRevision ? "Revisión de RFI creada" : "RFI creado", lang) });
        onClose();
      },
      onError: (error: any) => {
        const data = error?.response?.data ?? error?.data ?? {};
        if (data.error === "duplicate_number" && data.suggestedNumber) {
          const msg = `${data.message}\n\nSuggested number: ${data.suggestedNumber}\n\nUse suggested number?`;
          if (confirm(msg)) {
            createRfi({
              projectId,
              data: {
                ...(lastRfiData.current ?? {}),
                number: data.suggestedNumber,
                forceNumber: true,
              } as any,
            });
          }
        } else {
          toast({ title: w("Error creating RFI", "Error al crear RFI", lang), variant: "destructive" });
        }
      },
    },
  });

  const { mutate: generateQ, isPending: isGenerating } = useGenerateRfiQuestion({
    mutation: {
      onSuccess: (data) => { setQuestion(data.question); setShowAi(false); setAiDesc(""); },
      onError: () => toast({ title: w("AI generation failed", "Generación IA falló", lang), variant: "destructive" }),
    },
  });

  const generateCreateEmailDraft = async () => {
    setEmailDraftLoading(true);
    setEmailDraftError("");
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/generate-email-draft`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          question,
          userContext: emailDescription.trim() || undefined,
          submittedToPerson: sToPerson,
          submittedToCompany: sToCompany,
          submittedByContact: sByContact,
          submittedByCompany: sByCompany,
          dateRequired,
        }),
      });
      const data = await resp.json().catch(() => ({})) as { email?: string; error?: string };
      if (!resp.ok || !data.email?.trim()) throw new Error(data.error || "AI email draft failed");
      setEmailDraft(data.email);
      toast({ title: w("Email draft created from text fields only", "Borrador de correo creado solo con campos de texto", lang) });
    } catch (error) {
      const message = error instanceof Error ? error.message : w("AI email draft failed", "Falló el borrador de email IA", lang);
      setEmailDraftError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setEmailDraftLoading(false);
    }
  };

  const copyCreateEmailDraft = async () => {
    try {
      await navigator.clipboard.writeText(emailDraft);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
      toast({ title: w("Email copied to clipboard", "Email copiado al portapapeles", lang) });
    } catch {
      toast({ title: w("Copy failed", "Error al copiar", lang), variant: "destructive" });
    }
  };

  // Fix 2 — save external person
  const handleAddExtPerson = () => {
    if (!extPersonName.trim() || !extPersonEmail.trim()) return;
    setsToPerson(extPersonName.trim());
    setsToEmail(extPersonEmail.trim());
    // Also add to distribution list
    const entry = `EXT:${extPersonName.trim()}:${extPersonEmail.trim()}:${extPersonPhone.trim()}`;
    setDistList(prev => prev.includes(entry) ? prev : [...prev, entry]);
    setShowAddExtPerson(false);
    setExtPersonName(""); setExtPersonEmail(""); setExtPersonPhone("");
  };

  // Fix 4 — save external contact
  const handleAddExtContact = () => {
    if (!extContactName.trim() || !extContactEmail.trim()) return;
    const entry = `EXT:${extContactName.trim()}:${extContactEmail.trim()}:${extContactPhone.trim()}`;
    setDistList(prev => prev.includes(entry) ? prev : [...prev, entry]);
    setShowAddExtContact(false);
    setExtContactName(""); setExtContactEmail(""); setExtContactPhone("");
  };

  const handleSubmit = () => {
    if (!subject.trim()) {
      toast({ title: w("Subject is required", "El asunto es requerido", lang), variant: "destructive" }); return;
    }
    lastRfiData.current = {
      subject, priority,
      rfiType: rfiType || undefined,
      dateRequested: dateRequested ? new Date(dateRequested).toISOString() : undefined,
      dateRequired: dateRequired ? new Date(dateRequired).toISOString() : undefined,
      projectAddress: projectAddress || undefined,
      submittedByCompany: sByCompany || undefined,
      submittedByContact: sByContact || undefined,
      submittedByAddress: sByAddress || undefined,
      submittedByPhone: sByPhone || undefined,
      submittedByEmail: sByEmail || undefined,
      submittedToCompany: sToCompany || undefined,
      submittedToPerson: sToPerson || undefined,
      submittedToEmail: sToEmail || undefined,
      drawingNumber: drawingNum || undefined,
      drawingTitle: drawingTitle || undefined,
      specSection: specSection || undefined,
      detailNumber: detailNum || undefined,
      noteNumber: noteNum || undefined,
      locationDescription: location || undefined,
      question: question || undefined,
      costImpact: costImpact || undefined,
      costImpactAmount: costAmountRequired ? costAmount : undefined,
      costImpactReason: costReasonRequired ? costReason : undefined,
      scheduleImpact: schedImpact || undefined,
      scheduleImpactDays: scheduleDaysRequired && schedDays ? parseInt(schedDays) : undefined,
      scheduleImpactReason: scheduleDaysRequired ? schedReason : undefined,
      distributionList: distList.length > 0 ? distList : undefined,
      attachmentsJson: attachments.length > 0 ? attachments : undefined,
      attachmentPackageJson: packageItems.length > 0 ? packageItems : undefined,
      imagePresentationJson: imagePresentation,
    };
    createRfi({
      projectId,
      data: {
        subject, priority,
        rfiType: rfiType || undefined,
        dateRequested: dateRequested ? new Date(dateRequested).toISOString() : undefined,
        dateRequired: dateRequired ? new Date(dateRequired).toISOString() : undefined,
        projectAddress: projectAddress || undefined,
        submittedByCompany: sByCompany || undefined,
        submittedByContact: sByContact || undefined,
        submittedByAddress: sByAddress || undefined,
        submittedByPhone: sByPhone || undefined,
        submittedByEmail: sByEmail || undefined,
        submittedToCompany: sToCompany || undefined,
        submittedToPerson: sToPerson || undefined,
        submittedToEmail: sToEmail || undefined,
        drawingNumber: drawingNum || undefined,
        drawingTitle: drawingTitle || undefined,
        specSection: specSection || undefined,
        detailNumber: detailNum || undefined,
        noteNumber: noteNum || undefined,
        locationDescription: location || undefined,
        question: question || undefined,
        costImpact: costImpact || undefined,
        costImpactAmount: costAmountRequired ? costAmount : undefined,
        costImpactReason: costReasonRequired ? costReason : undefined,
        scheduleImpact: schedImpact || undefined,
        scheduleImpactDays: scheduleDaysRequired && schedDays ? parseInt(schedDays) : undefined,
        scheduleImpactReason: scheduleDaysRequired ? schedReason : undefined,
        distributionList: distList.length > 0 ? distList : undefined,
        attachmentsJson: attachments.length > 0 ? attachments : undefined,
        attachmentPackageJson: packageItems.length > 0 ? packageItems : undefined,
        imagePresentationJson: imagePresentation,
      },
    });
  };

  const handleCanonicalCreateChange = (field: keyof RfiCanonicalValues, value: string) => {
    switch (field) {
      case "subject": setSubject(value); break;
      case "priority": setPriority(value); break;
      case "rfiType": setRfiType(value); break;
      case "dateRequested": setDateRequested(value); break;
      case "dateRequired": setDateRequired(value); break;
      case "submittedByCompany": setsByCompany(value); break;
      case "submittedByContact": setsByContact(value); break;
      case "submittedByAddress": setsByAddress(value); break;
      case "submittedByPhone": setsByPhone(value); break;
      case "submittedByEmail": setsByEmail(value); break;
      case "submittedToCompany": setsToCompany(value); break;
      case "submittedToPerson": setsToPerson(value); break;
      case "submittedToEmail": setsToEmail(value); break;
      case "drawingNumber": setDrawingNum(value); break;
      case "drawingTitle": setDrawingTitle(value); break;
      case "specSection": setSpecSection(value); break;
      case "detailNumber": setDetailNum(value); break;
      case "noteNumber": setNoteNum(value); break;
      case "locationDescription": setLocation(value); break;
      case "referenceInput": setAttachInput(value); break;
      case "question": setQuestion(value); break;
      case "costImpact": setCostImpact(value); break;
      case "costImpactAmount": setCostAmount(value); break;
      case "costImpactReason": setCostReason(value); break;
      case "scheduleImpact": setSchedImpact(value); break;
      case "scheduleImpactDays": setSchedDays(value); break;
      case "scheduleImpactReason": setSchedReason(value); break;
      case "distributionList": setDistList(value.split(",").map(v => v.trim()).filter(Boolean)); break;
      case "emailDescription": setEmailDescription(value); break;
      default: break;
    }
  };

  if (Date.now() >= 0) return (
    <RfiCanonicalForm
      lang={lang}
      mode="create"
      recordState="new"
      values={{
        projectName: "",
        subject,
        status: "draft",
        priority,
        rfiType,
        dateRequested,
        dateRequired,
        submittedByCompany: sByCompany,
        submittedByContact: sByContact,
        submittedByAddress: sByAddress,
        submittedByPhone: sByPhone,
        submittedByEmail: sByEmail,
        submittedToCompany: sToCompany,
        submittedToPerson: sToPerson,
        submittedToEmail: sToEmail,
        drawingNumber: drawingNum,
        drawingTitle,
        specSection,
        detailNumber: detailNum,
        noteNumber: noteNum,
        locationDescription: location,
        referenceInput: attachInput,
        question,
        costImpact,
        costImpactAmount: costAmount,
        costImpactReason: costReason,
        scheduleImpact: schedImpact,
        scheduleImpactDays: schedDays,
        scheduleImpactReason: schedReason,
        distributionList: distList,
        emailDescription,
        emailDraft,
      }}
      permissions={{ canEdit: true, canRespond: false, canClose: false, canReopen: false, canExport: false, canRaiseChangeOrder: false, canJumpViewpoint: !!(preload as { sourceViewpointId?: string | null } | undefined)?.sourceViewpointId }}
      references={[]}
      attachments={attachments}
      imagePresentation={imagePresentation}
      packageItems={packageItems}
      responses={[]}
      loading={{ saving: isPending, uploading: uploadingAtt, questionAi: isGenerating, emailAi: emailDraftLoading }}
      actions={{ submit: handleSubmit, cancel: onClose }}
      onChange={handleCanonicalCreateChange}
      onAddReference={addReference}
      onRemoveReference={index => setAttachments(prev => prev.filter((_, i) => i !== index))}
      onUploadFile={() => attachFileRef.current?.click()}
      onGenerateQuestionAi={() => setShowAi(true)}
      onGenerateEmailAi={generateCreateEmailDraft}
      onCopyEmail={copyCreateEmailDraft}
    />
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "hsl(var(--muted-foreground))", background: "transparent", border: "none", cursor: "pointer", padding: "4px 0 14px" }}>
        <ChevronLeft style={{ width: 16, height: 16 }} />{w("Back to RFIs", "Volver a RFIs", lang)}
      </button>
      <div style={{ background: "hsl(var(--background))", borderRadius: 12, border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{w(isRevision ? "Revise RFI" : "New RFI", isRevision ? "Revisar RFI" : "Nuevo RFI", lang)}</div>
            {isRevision && <div style={{ fontSize: 12, color: "#7C3AED", marginTop: 2 }}>Revision of {preload?.number}</div>}
          </div>
          <button onClick={onClose} style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 6 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          {!isRevision && (
            <div style={{ margin: "16px 0 4px", padding: "12px 14px", border: "1px dashed #C4B5FD", borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Sparkles style={{ width: 16, height: 16, color: "#7C3AED", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9" }}>{w("Start from an existing document", "Comenzar desde un documento existente", lang)}</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                  {importedFrom
                    ? w(`Filled from ${importedFrom} — review the fields below.`, `Completado desde ${importedFrom} — revise los campos abajo.`, lang)
                    : w("Upload a PDF, Word, Excel or image — AI reads it and fills the fields for you to review.", "Suba un PDF, Word, Excel o imagen — la IA lo lee y completa los campos para su revisión.", lang)}
                </div>
              </div>
              <input ref={importInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportPrefill(f); e.target.value = ""; }} />
              <Button size="sm" variant="outline" disabled={importing} onClick={() => importInputRef.current?.click()} style={{ gap: 5, fontSize: 11, flexShrink: 0 }}>
                {importing ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <FileText style={{ width: 12, height: 12 }} />}
                {importing ? w("Reading…", "Leyendo…", lang) : w("Import document", "Importar documento", lang)}
              </Button>
            </div>
          )}
          {/* Section 1 — Header */}
          <SectionHeader title={w("1. Header Information", "1. Información del Encabezado", lang)} />
          <FormGrid>
            <FormField label={w("Date Requested", "Fecha Solicitada", lang)} full>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Date Requested", "Fecha Solicitada", lang)}</label>
                  <Input type="date" value={dateRequested} onChange={e => setDateRequested(e.target.value)} style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Date Required (response by)", "Fecha Requerida", lang)}</label>
                  <Input type="date" value={dateRequired} onChange={e => setDateRequired(e.target.value)} style={{ fontSize: 12 }} />
                </div>
              </div>
            </FormField>
            <FormField label={w("Subject *", "Asunto *", lang)} full>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={w("Brief subject of this RFI", "Asunto breve de este RFI", lang)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Priority", "Prioridad", lang)}>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                {priorityOptions.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </select>
            </FormField>
            <FormField label={w("RFI Type", "Tipo de RFI", lang)}>
              <select value={rfiType} onChange={e => setRfiType(e.target.value)} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                {rfiTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField label={w("Project Address", "Dirección del Proyecto", lang)}>
              <Input value={projectAddress} onChange={e => setProjectAddress(e.target.value)} placeholder={w("Auto-filled from project history", "Auto-llenado del historial del proyecto", lang)} style={{ fontSize: 12 }} />
            </FormField>
          </FormGrid>

          {/* Section 2 — Submitted By */}
          <SectionHeader title={w("2. Submitted By", "2. Enviado Por", lang)} />
          <FormGrid>
            <FormField label={w("Company Name", "Nombre de Empresa", lang)}>
              <Input value={sByCompany} onChange={e => setsByCompany(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Contact Person", "Persona de Contacto", lang)}>
              <Input value={sByContact} onChange={e => setsByContact(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Address", "Dirección", lang)} full>
              <Input value={sByAddress} onChange={e => setsByAddress(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Phone", "Teléfono", lang)}>
              <Input value={sByPhone} onChange={e => setsByPhone(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Email", "Correo", lang)}>
              <Input value={sByEmail} onChange={e => setsByEmail(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
          </FormGrid>

          {/* Section 3 — Submitted To */}
          <SectionHeader title={w("3. Submitted To", "3. Enviado A", lang)} />
          <FormGrid>
            <FormField label={w("Company Name", "Nombre de Empresa", lang)}>
              <select value={sToCompany} onChange={e => {
                setsToCompany(e.target.value);
                setsToPerson(""); setsToEmail("");
                setShowAddExtPerson(false);
              }} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                <option value="">{w("— Select company —", "— Seleccionar empresa —", lang)}</option>
                {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setShowAddCompany(!showAddCompany)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px dashed #2563EB", background: showAddCompany ? "#EFF6FF" : "transparent", cursor: "pointer", color: "#2563EB", width: "fit-content", marginTop: 4 }}>
                <Plus style={{ width: 12, height: 12 }} />
                {w("Add company not in list", "Agregar empresa fuera de lista", lang)}
              </button>
              {showAddCompany && (
                <div style={{ marginTop: 6, padding: "12px 14px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 10 }}>
                    {w("New Company Details", "Detalles de Nueva Empresa", lang)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{w("Company Name *", "Nombre *", lang)}</div>
                      <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                        placeholder={w("e.g. VOREA Group", "ej. VOREA Group", lang)}
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{w("Contact Person", "Persona de Contacto", lang)}</div>
                      <input value={newContactPerson} onChange={e => setNewContactPerson(e.target.value)}
                        placeholder={w("e.g. John Smith", "ej. Juan García", lang)}
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{w("Email", "Correo", lang)}</div>
                      <input value={newCompanyEmail} onChange={e => setNewCompanyEmail(e.target.value)}
                        placeholder="email@company.com"
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{w("Phone", "Teléfono", lang)}</div>
                      <input value={newCompanyPhone} onChange={e => setNewCompanyPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{w("Address", "Dirección", lang)}</div>
                      <input value={newCompanyAddress} onChange={e => setNewCompanyAddress(e.target.value)}
                        placeholder={w("Street address, City, State", "Calle, Ciudad, Estado", lang)}
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => { setShowAddCompany(false); setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyPhone(""); setNewCompanyAddress(""); setNewContactPerson(""); }}
                      style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer" }}>
                      {w("Cancel", "Cancelar", lang)}
                    </button>
                    <button type="button"
                      onClick={async () => {
                        if (!newCompanyName.trim()) return;
                        const tok = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
                        await fetch(`/api/v1/projects/${projectId}/directory`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
                          body: JSON.stringify({
                            full_name: newContactPerson.trim() || newCompanyName.trim(),
                            email: newCompanyEmail.trim() || `contact@bimlog.io`,
                            company_name: newCompanyName.trim(),
                            role: "External Company",
                            notes: `Phone: ${newCompanyPhone} | Address: ${newCompanyAddress}`,
                          }),
                        });
                        setsToCompany(newCompanyName.trim());
                        setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyPhone(""); setNewCompanyAddress(""); setNewContactPerson("");
                        setShowAddCompany(false);
                      }}
                      style={{ padding: "5px 14px", fontSize: 11, borderRadius: 6, background: "#2563EB", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>
                      {w("Add Company", "Agregar Empresa", lang)}
                    </button>
                  </div>
                </div>
              )}
            </FormField>
            <FormField label={w("Contact Person", "Persona de Contacto", lang)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <select value={sToPerson} onChange={e => {
                  const sel = companyPeople(sToCompany).find(m => m.userFullName === e.target.value);
                  setsToPerson(e.target.value);
                  if (sel) setsToEmail(sel.userEmail);
                }} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                  <option value="">{w("— Select person —", "— Seleccionar persona —", lang)}</option>
                  {companyPeople(sToCompany).map(m => <option key={m.userEmail} value={m.userFullName}>{m.userFullName}</option>)}
                </select>
                {/* Fix 2 — Add person button */}
                {sToCompany && (
                  <button type="button" onClick={() => setShowAddExtPerson(!showAddExtPerson)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px dashed #2563EB", background: showAddExtPerson ? "#EFF6FF" : "transparent", cursor: "pointer", color: "#2563EB", width: "fit-content" }}>
                    <UserPlus style={{ width: 12, height: 12 }} />
                    {w("Add person not in list", "Agregar persona fuera de lista", lang)}
                  </button>
                )}
              </div>
            </FormField>
            {/* Fix 2 — Inline add external person form */}
            {showAddExtPerson && (
              <div style={{ gridColumn: "span 2", padding: "10px 12px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 8 }}>
                  {w("Add external person (RFI only — not added as project member)", "Agregar persona externa (solo RFI — no se agrega como miembro)", lang)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Name *</label>
                    <Input value={extPersonName} onChange={e => setExtPersonName(e.target.value)} placeholder="John Smith" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Email *</label>
                    <Input value={extPersonEmail} onChange={e => setExtPersonEmail(e.target.value)} placeholder="j.smith@firm.com" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Phone</label>
                    <Input value={extPersonPhone} onChange={e => setExtPersonPhone(e.target.value)} placeholder="+1 555 0100" style={{ fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <Button size="sm" onClick={handleAddExtPerson} disabled={!extPersonName.trim() || !extPersonEmail.trim()} style={{ fontSize: 11 }}>
                    {w("Add & Select", "Agregar y Seleccionar", lang)}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddExtPerson(false)} style={{ fontSize: 11 }}>
                    {w("Cancel", "Cancelar", lang)}
                  </Button>
                </div>
              </div>
            )}
            <FormField label={w("Email", "Correo", lang)}>
              <Input value={sToEmail} onChange={e => setsToEmail(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
          </FormGrid>

          {/* Section 4 — Reference Information */}
          {/* Fix 3 — meaningful placeholders + file search buttons */}
          <SectionHeader title={w("4. Reference Information", "4. Información de Referencia", lang)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginTop: 10 }}>
            <RefFieldWithSearch label={w("Drawing Number", "Número de Plano", lang)} value={drawingNum} onChange={setDrawingNum} placeholder="e.g. A-101" fieldKey="drawingNum" fileSearch={fileSearch} setFileSearch={setFileSearch} files={files || []} lang={lang} />
            <RefFieldWithSearch label={w("Drawing Title", "Título del Plano", lang)} value={drawingTitle} onChange={setDrawingTitle} placeholder="e.g. Floor Plan Level 3" fieldKey="drawingTitle" fileSearch={fileSearch} setFileSearch={setFileSearch} files={files || []} lang={lang} />
            <RefFieldWithSearch label={w("Spec Section", "Sección de Especificación", lang)} value={specSection} onChange={setSpecSection} placeholder="e.g. 23 00 00" fieldKey="specSection" fileSearch={fileSearch} setFileSearch={setFileSearch} files={files || []} lang={lang} />
            <RefFieldWithSearch label={w("Detail Number", "Número de Detalle", lang)} value={detailNum} onChange={setDetailNum} placeholder="e.g. 5/A-301" fieldKey="detailNum" fileSearch={fileSearch} setFileSearch={setFileSearch} files={files || []} lang={lang} />
            <RefFieldWithSearch label={w("Note Number", "Número de Nota", lang)} value={noteNum} onChange={setNoteNum} placeholder="e.g. NOTE 3" fieldKey="noteNum" fileSearch={fileSearch} setFileSearch={setFileSearch} files={files || []} lang={lang} />
            <FormField label={w("Location Description", "Descripción de Ubicación", lang)} full>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={w("e.g. Level 2 North Wing, Grid B-C/3-4", "ej. Nivel 2 Ala Norte, Cuadrícula B-C/3-4", lang)} style={{ fontSize: 12 }} />
            </FormField>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>{w("Attachments / References", "Adjuntos / Referencias", lang)}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Input value={attachInput} onChange={e => setAttachInput(e.target.value)} placeholder={w("Paste file name or URL...", "Pegar nombre de archivo o URL...", lang)} style={{ fontSize: 12, flex: "1 1 260px" }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addReference(); } }} />
              <Button type="button" size="sm" variant="outline" onClick={addReference} disabled={!attachInput.trim()} style={{ fontSize: 11 }}>{w("Add Reference", "Agregar Referencia", lang)}</Button>
              <input ref={attachFileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = ""; }} />
              <Button size="sm" variant="outline" disabled={uploadingAtt} onClick={() => attachFileRef.current?.click()} style={{ fontSize: 11, gap: 4 }}>
                {uploadingAtt ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <FileText style={{ width: 11, height: 11 }} />}{uploadingAtt ? w("Uploading...", "Subiendo...", lang) : w("Upload File", "Subir Archivo", lang)}
              </Button>
              <input ref={imageFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) beginPendingImage(f); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" onClick={() => imageFileRef.current?.click()} style={{ fontSize: 11, gap: 4 }}>
                <Upload style={{ width: 11, height: 11 }} />{w("Upload Image", "Subir Imagen", lang)}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={pasteCreateImage} style={{ fontSize: 11, gap: 4 }}>
                <Clipboard style={{ width: 11, height: 11 }} />{w("Paste Image", "Pegar Imagen", lang)}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={captureCreateImage} style={{ fontSize: 11, gap: 4 }}>
                <Camera style={{ width: 11, height: 11 }} />{w("Capture Screen", "Capturar Pantalla", lang)}
              </Button>
              {connectedFileSourcesCreate.map(provider => (
                <Button key={provider.key} size="sm" variant="outline" onClick={() => setCloudPickerCreate(provider)} style={{ fontSize: 11, gap: 4 }}>
                  <FolderOpen style={{ width: 11, height: 11 }} />{w(`From ${provider.label}`, `Desde ${provider.label}`, lang)}
                </Button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 5 }}>
              {w("Files, images, PDFs, and project references attached here are saved with the RFI question.", "Los archivos, imagenes, PDFs y referencias del proyecto adjuntos aqui se guardan con la pregunta del RFI.", lang)}
            </div>
            {attachments.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12 }}>
                <ExternalLink style={{ width: 12, height: 12, color: "#1D4ED8" }} />
                {isUrlAttach(a) ? <a href={a} target="_blank" rel="noreferrer" style={{ flex: 1, color: "#1D4ED8" }}>{attachLabel(a)}</a> : <span style={{ flex: 1 }}>{attachLabel(a)}</span>}
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 11, height: 11 }} /></button>
              </div>
            ))}
            {pendingImage && (
              <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--muted) / 0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{w("Review image before attaching", "Revise la imagen antes de adjuntar", lang)}</div>
                <img src={pendingImage.url} alt={w("Pending RFI image", "Imagen RFI pendiente", lang)} style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 6, border: "1px solid hsl(var(--border))", display: "block", marginBottom: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Visual crop tooling is not enabled in this build. Existing saved crop metadata is preserved until the dedicated crop tool ships.", "La herramienta visual de recorte no esta habilitada en esta version. Los datos de recorte guardados se conservan hasta la herramienta dedicada.", lang)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <Button type="button" size="sm" onClick={async () => { await uploadAttachment(pendingImage.file, null); URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }} disabled={uploadingAtt} style={{ fontSize: 11, gap: 4 }}><Upload style={{ width: 11, height: 11 }} />{w("Attach Image", "Adjuntar Imagen", lang)}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }} style={{ fontSize: 11 }}>{w("Cancel", "Cancelar", lang)}</Button>
                </div>
              </div>
            )}
            {packageItems.length > 0 && (
              <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--muted) / 0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{w("Complete RFI PDF Package Order", "Orden del Paquete PDF Completo RFI", lang)}</div>
                {packageItems.map((item, i) => (
                  <div key={item.key} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto", gap: 6, alignItems: "center", fontSize: 11, padding: "4px 0", borderTop: i === 0 ? "none" : "1px solid hsl(var(--border) / 0.5)" }}>
                    <input type="checkbox" checked={item.include} onChange={e => setPackageItems(prev => prev.map(p => p.key === item.key ? { ...p, include: e.target.checked } : p))} />
                    <span><FileText style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />{item.label} <span style={{ color: "hsl(var(--muted-foreground))" }}>({attachmentExt(item.label)})</span></span>
                    <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => setPackageItems(prev => { const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next.map((p, order) => ({ ...p, order })); })} style={{ fontSize: 10, padding: "2px 6px" }}><ArrowUp style={{ width: 10, height: 10 }} /></Button>
                    <Button type="button" size="sm" variant="outline" disabled={i === packageItems.length - 1} onClick={() => setPackageItems(prev => { const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next.map((p, order) => ({ ...p, order })); })} style={{ fontSize: 10, padding: "2px 6px" }}><ArrowDown style={{ width: 10, height: 10 }} /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5 — Question */}
          <SectionHeader title={w("5. Description of Question", "5. Descripción de la Pregunta", lang)} />
          <div style={{ marginTop: 10 }}>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={w("Provide a clear, detailed description of the information requested…", "Proporcione una descripción clara y detallada de la información solicitada…", lang)}
              style={{ width: "100%", minHeight: 100, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "8px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowAi(!showAi)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: "1px solid #7C3AED", background: showAi ? "#7C3AED" : "transparent", color: showAi ? "white" : "#7C3AED", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                <Sparkles style={{ width: 13, height: 13 }} />
                {w("Generate question with AI", "Generar pregunta con IA", lang)}
              </button>
              {showAi && (
                <div style={{ marginTop: 8, padding: 12, background: "hsl(var(--secondary) / 0.5)", borderRadius: 8, border: "1px solid #7C3AED44" }}>
                  <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
                    {w("Text-only AI assist uses AI credits. It does not read attached files unless you explicitly use file-reading AI.", "La asistencia IA solo de texto usa creditos IA. No lee archivos adjuntos salvo que use explicitamente IA de lectura de archivos.", lang)}
                  </p>
                  <textarea
                    value={aiDesc}
                    onChange={e => setAiDesc(e.target.value)}
                    placeholder={w("e.g. The drawing shows a beam but the spec says something different…", "ej. El plano muestra una viga pero la especificación dice algo diferente…", lang)}
                    style={{ width: "100%", minHeight: 60, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "6px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <Button size="sm" disabled={!aiDesc.trim() || isGenerating}
                    onClick={() => generateQ({ data: { description: aiDesc, subject, projectName: undefined } })}
                    style={{ marginTop: 8, fontSize: 12, background: "#7C3AED", gap: 5 }}>
                    {isGenerating ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />{w("Generating…", "Generando…", lang)}</> : <><Sparkles style={{ width: 12, height: 12 }} />{w("Generate", "Generar", lang)}</>}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Section 6 — Impact */}
          <SectionHeader title={w("6. Impact Assessment", "6. Evaluación de Impacto", lang)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>{w("Cost Impact", "Impacto en Costo", lang)}</label>
              {["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"].map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer", fontSize: 12 }}>
                  <input type="radio" name="cost_impact" checked={costImpact === opt} onChange={() => setCostImpact(opt)} />
                  {opt}
                </label>
              ))}
              {costReasonRequired && (
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {costAmountRequired && <Input value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder={w("Cost Amount", "Monto de Costo", lang)} style={{ fontSize: 12 }} />}
                  <textarea value={costReason} onChange={e => setCostReason(e.target.value)} placeholder={w("Cost Reason / Explanation", "Razon / Explicacion de Costo", lang)} style={{ width: "100%", minHeight: 64, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "7px 9px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>{w("Schedule Impact", "Impacto en Programa", lang)}</label>
              {["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"].map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer", fontSize: 12 }}>
                  <input type="radio" name="sched_impact" checked={schedImpact === opt} onChange={() => setSchedImpact(opt)} />
                  {opt}
                </label>
              ))}
              {scheduleDaysRequired && (
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <Input type="number" value={schedDays} onChange={e => setSchedDays(e.target.value)} placeholder={w("Calendar Days", "Dias Calendario", lang)} style={{ fontSize: 12 }} />
                  <textarea value={schedReason} onChange={e => setSchedReason(e.target.value)} placeholder={w("Schedule Reason / Explanation", "Razon / Explicacion de Programa", lang)} style={{ width: "100%", minHeight: 64, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "7px 9px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              )}
            </div>
          </div>

          {/* Section 7 — Distribution */}
          {/* Fix 4 — external contacts */}
          <SectionHeader title={w("7. Distribution and Email", "7. Distribución y Email", lang)} />
          <div style={{ marginTop: 10 }}>
            {members.map(m => (
              <label key={m.userEmail} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={distList.includes(m.userEmail)}
                  onChange={e => {
                    if (e.target.checked) setDistList(prev => [...prev, m.userEmail]);
                    else setDistList(prev => prev.filter(x => x !== m.userEmail));
                  }} />
                <span>{m.userFullName}</span>
                {m.userCompanyName && <span style={{ color: "hsl(var(--muted-foreground))" }}>· {m.userCompanyName}</span>}
                <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}>{m.userEmail}</span>
              </label>
            ))}
            {/* Show external contacts already added */}
            {distList.filter(e => e.startsWith("EXT:")).map((entry, i) => {
              const parsed = parseDistEntry(entry);
              return (
                <div key={entry} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12, padding: "3px 6px", background: "#F0F9FF", borderRadius: 5, border: "1px solid #BAE6FD" }}>
                  <UserPlus style={{ width: 12, height: 12, color: "#0369A1", flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{parsed.display}</span>
                  <button onClick={() => setDistList(prev => prev.filter(x => x !== entry))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 2 }}><X style={{ width: 11, height: 11 }} /></button>
                </div>
              );
            })}
            {members.length === 0 && distList.filter(e => !e.startsWith("EXT:")).length === 0 && (
              <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>{w("No team members found.", "No se encontraron miembros del equipo.", lang)}</p>
            )}

            {/* Fix 4 — Add external contact */}
            <button type="button" onClick={() => setShowAddExtContact(!showAddExtContact)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, borderRadius: 5, border: "1px dashed #0369A1", background: showAddExtContact ? "#E0F2FE" : "transparent", cursor: "pointer", color: "#0369A1", marginTop: 8 }}>
              <UserPlus style={{ width: 12, height: 12 }} />
              {w("Add external contact", "Agregar contacto externo", lang)}
            </button>
            {showAddExtContact && (
              <div style={{ marginTop: 8, padding: "10px 12px", background: "#E0F2FE", borderRadius: 8, border: "1px solid #BAE6FD" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", marginBottom: 8 }}>
                  {w("External contact (RFI notifications only — not a project member)", "Contacto externo (solo notificaciones RFI — no es miembro del proyecto)", lang)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Name *</label>
                    <Input value={extContactName} onChange={e => setExtContactName(e.target.value)} placeholder="Jane Doe" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Email *</label>
                    <Input value={extContactEmail} onChange={e => setExtContactEmail(e.target.value)} placeholder="jane@company.com" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Phone (optional)</label>
                    <Input value={extContactPhone} onChange={e => setExtContactPhone(e.target.value)} placeholder="+1 555 0200" style={{ fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <Button size="sm" onClick={handleAddExtContact} disabled={!extContactName.trim() || !extContactEmail.trim()} style={{ fontSize: 11 }}>
                    {w("Add to Distribution", "Agregar a Distribución", lang)}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddExtContact(false)} style={{ fontSize: 11 }}>{w("Cancel", "Cancelar", lang)}</Button>
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid hsl(var(--border) / 0.5)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{w("Email / Question Description", "Email / Descripción de la Pregunta", lang)}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
                {w("Draft the cover email here. This text-only AI assist uses AI credits and does not read attached files unless you explicitly use a file-reading AI tool.", "Redacte aqui el correo de portada. Esta asistencia IA solo usa texto, consume creditos IA y no lee archivos adjuntos salvo que use explicitamente una herramienta IA de lectura de archivos.", lang)}
              </div>
              <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{w("Description of Email", "Descripción de Email", lang)}</label>
              <textarea
                value={emailDescription}
                onChange={e => setEmailDescription(e.target.value)}
                placeholder={w("Describe the message you want to send with this RFI...", "Describa el mensaje que desea enviar con este RFI...", lang)}
                style={{ width: "100%", minHeight: 72, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "8px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <Button size="sm" variant="outline" onClick={generateCreateEmailDraft} disabled={emailDraftLoading || (!question.trim() && !emailDescription.trim())} title={w("Text-only draft. Does not read attachments. Uses configured AI credits.", "Borrador solo con texto. No lee adjuntos. Usa creditos IA configurados.", lang)} style={{ fontSize: 11, gap: 5 }}>
                  {emailDraftLoading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Sparkles style={{ width: 12, height: 12 }} />}
                  {w("Generate Email with AI", "Generar Email con IA", lang)}
                </Button>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Click-driven only. No AI runs automatically.", "Solo por clic. La IA no se ejecuta automaticamente.", lang)}</span>
              </div>
              {emailDraftError && <div style={{ fontSize: 11, color: "#B45309", marginTop: 6 }}>{emailDraftError}</div>}
              {emailDraft && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                    <Button type="button" size="sm" variant="outline" onClick={copyCreateEmailDraft} style={{ fontSize: 11, gap: 5 }}>
                      {emailCopied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      {emailCopied ? w("Copied", "Copiado", lang) : w("Copy Email", "Copiar Email", lang)}
                    </Button>
                  </div>
                  <textarea
                    value={emailDraft}
                    onChange={e => setEmailDraft(e.target.value)}
                    style={{ width: "100%", minHeight: 120, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "8px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <Button variant="outline" onClick={onClose} style={{ fontSize: 12 }}>{w("Cancel", "Cancelar", lang)}</Button>
          <Button onClick={handleSubmit} disabled={isPending} style={{ fontSize: 12, gap: 5 }}>
            {isPending ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />{w("Submitting…", "Enviando…", lang)}</> : w(isRevision ? "Submit Revision" : "Submit RFI", isRevision ? "Enviar Revisión" : "Enviar RFI", lang)}
          </Button>
        </div>
      </div>
      {cloudPickerCreate && (
        <CloudPicker
          provider={cloudPickerCreate}
          projectId={projectId}
          lang={lang}
          onAttached={url => setAttachments(prev => [...prev, url])}
          onClose={() => setCloudPickerCreate(null)}
        />
      )}
    </div>
  );
}

// ─── RFI Detail Panel ─────────────────────────────────────────────────────────
function RfiDetailPanel({ projectId, rfi, canWrite, lang, members, user, onClose, onRevise, onExportPdf, onExportCompletePdf, onUpdate }: {
  projectId: number;
  rfi: Rfi;
  canWrite: boolean;
  lang: string;
  members: { userFullName: string; userCompanyName?: string; userEmail: string; role?: string }[];
  user: { fullName: string; companyName: string; email: string } | null;
  onClose: () => void;
  onRevise: (rfi: Rfi) => void;
  onExportPdf: (rfi: Rfi) => void;
  onExportCompletePdf: (rfi: Rfi) => void;
  onUpdate: (rfi: Rfi) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getLabel, getOptions } = useConfig();
  const { data: files } = useListFiles(projectId);
  const configuredRfiTypes = getOptions("rfi_type");
  const rfiTypeOptions = configuredRfiTypes.length
    ? configuredRfiTypes.map(o => ({ value: o.value, label: lang === "es" ? o.labelEs : o.label }))
    : DEFAULT_RFI_TYPES.map(t => ({ value: t, label: t }));

  const [answer, setAnswer] = useState(rfi.answer || rfi.response || "");
  const [answeredBy, setAnsweredBy] = useState(rfi.answeredBy || user?.fullName || "");
  const [closingStatus, setClosingStatus] = useState(rfi.status);
  const [costImpact, setCostImpact] = useState(rfi.costImpact || "No Cost Impact");
  const [costAmount, setCostAmount] = useState(rfi.costImpactAmount || "");
  const [costReason, setCostReason] = useState((rfi as Rfi & { costImpactReason?: string }).costImpactReason || "");
  const [schedImpact, setSchedImpact] = useState(rfi.scheduleImpact || "No Schedule Impact");
  const [schedDays, setSchedDays] = useState(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : "");
  const [schedReason, setSchedReason] = useState((rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason || "");

  // Inline edit of the RFI's OWN details (question + cost/schedule impact), separate from the
  // Response fields above — so editing happens right in the detail, no separate form to hunt for.
  // Cost/schedule are free text plus an amount/days field, so "GC to determine" or "3 days @ $75"
  // both fit.
  const [infoEdit, setInfoEdit] = useState(false);
  const [infoQuestion, setInfoQuestion] = useState("");
  const [infoCost, setInfoCost] = useState("");
  const [infoCostAmt, setInfoCostAmt] = useState("");
  const [infoCostReason, setInfoCostReason] = useState("");
  const [infoSched, setInfoSched] = useState("");
  const [infoSchedDays, setInfoSchedDays] = useState("");
  const [infoSchedReason, setInfoSchedReason] = useState("");
  const [infoToCompany, setInfoToCompany] = useState("");
  const [infoToPerson, setInfoToPerson] = useState("");
  const [infoToEmail, setInfoToEmail] = useState("");
  const [infoFromCompany, setInfoFromCompany] = useState("");
  const [infoFromContact, setInfoFromContact] = useState("");
  const [infoFromAddress, setInfoFromAddress] = useState("");
  const [infoFromPhone, setInfoFromPhone] = useState("");
  const [infoFromEmail, setInfoFromEmail] = useState("");
  const [infoDateRequired, setInfoDateRequired] = useState("");
  const [questionDocs, setQuestionDocs] = useState<string[]>((rfi.attachmentsJson as string[] | null) || []);
  const [packageItems, setPackageItems] = useState<RfiPackageItem[]>(() => normalizePackageItems((rfi as Rfi & { attachmentPackageJson?: unknown }).attachmentPackageJson, (rfi.attachmentsJson as string[] | null) || [], []));
  const [imagePresentation, setImagePresentation] = useState<RfiImagePresentation>(() => ((rfi as Rfi & { imagePresentationJson?: RfiImagePresentation }).imagePresentationJson || null));
  const [questionDocInput, setQuestionDocInput] = useState("");
  const [infoSubject, setInfoSubject] = useState("");
  const [infoType, setInfoType] = useState("");
  const [infoVpLabel, setInfoVpLabel] = useState("");
  const [infoDist, setInfoDist] = useState<string[]>((rfi.distributionList as string[] | null) || []);
  const [distInput, setDistInput] = useState("");
  const startInfoEdit = () => {
    setQuestionDocs((rfi.attachmentsJson as string[] | null) || []);
    setPackageItems(normalizePackageItems((rfi as Rfi & { attachmentPackageJson?: unknown }).attachmentPackageJson, (rfi.attachmentsJson as string[] | null) || [], files || []));
    setImagePresentation((rfi as Rfi & { imagePresentationJson?: RfiImagePresentation }).imagePresentationJson || null);
    setQuestionDocInput("");
    setInfoSubject(rfi.subject || "");
    setInfoType(rfi.rfiType || "");
    setInfoVpLabel((rfi as { sourceViewpointLabel?: string | null }).sourceViewpointLabel || "");
    setInfoDateRequired(rfi.dateRequired ? format(parseISO(String(rfi.dateRequired)), "yyyy-MM-dd") : "");
    setInfoDist((rfi.distributionList as string[] | null) || []);
    setDistInput("");
    setInfoQuestion(rfi.question || rfi.description || "");
    setInfoCost(rfi.costImpact || "No Cost Impact");
    setInfoCostAmt(rfi.costImpactAmount || "");
    setInfoCostReason((rfi as Rfi & { costImpactReason?: string }).costImpactReason || "");
    setInfoSched(rfi.scheduleImpact || "No Schedule Impact");
    setInfoSchedDays(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : "");
    setInfoSchedReason((rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason || "");
    setInfoToCompany(rfi.submittedToCompany || "");
    setInfoToPerson(rfi.submittedToPerson || "");
    setInfoToEmail(rfi.submittedToEmail || "");
    setInfoFromCompany(rfi.submittedByCompany || "");
    setInfoFromContact(rfi.submittedByContact || rfi.createdByName || "");
    setInfoFromAddress(rfi.submittedByAddress || "");
    setInfoFromPhone(rfi.submittedByPhone || "");
    setInfoFromEmail(rfi.submittedByEmail || "");
    setInfoEdit(true);
  };

  const infoInput = { width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid hsl(var(--border))", borderRadius: 6, fontFamily: "inherit", background: "transparent", color: "inherit" } as const;

  // Project Directory for the recipient picker: pick an existing company/person (auto-fills
  // their email) or just type a new one.
  const [rfiDirectory, setRfiDirectory] = useState<{ fullName: string; email: string; companyName: string | null }[]>([]);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/projects/${projectId}/directory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d) => { if (Array.isArray(d)) setRfiDirectory(d); })
      .catch((error) => logClientError("RFI directory load", error));
  }, [projectId]);

  const viewpointFile = useMemo(() => (files || []).find(f => f.source === "lens-viewpoint" && f.linkedRfiId === rfi.id), [files, rfi.id]);

  // Load the source viewpoint screenshot (stored as a lens-viewpoint file) for inline display.
  const [vpImageUrl, setVpImageUrl] = useState<string | null>(null);
  useEffect(() => {
    const vpFile = viewpointFile;
    if (!vpFile) { setVpImageUrl(null); return; }
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    let url: string | null = null;
    fetch(`/api/v1/projects/${projectId}/files/${vpFile.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) { url = URL.createObjectURL(b); setVpImageUrl(url); } })
      .catch((error) => logClientError("RFI viewpoint image load", error));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [viewpointFile, rfi.id, projectId]);

  useEffect(() => {
    setPackageItems(prev => {
      const base = normalizePackageItems(prev.length ? prev : (rfi as Rfi & { attachmentPackageJson?: unknown }).attachmentPackageJson, questionDocs, files || []);
      const next = [...base];
      for (const docItem of packageItemsFromAttachments(questionDocs, files || [])) {
        if (!next.some(item => item.attachment === docItem.attachment || (item.fileId && item.fileId === docItem.fileId))) {
          next.push({ ...docItem, order: next.length });
        }
      }
      for (const file of (files || []).filter(f => f.linkedRfiId === rfi.id && f.source !== "system-generated")) {
        if (!next.some(item => item.fileId === file.id)) {
          next.push({ key: `file:${file.id}`, label: file.fileName, fileId: file.id, attachment: `/api/v1/projects/${projectId}/files/${file.id}/download?name=${encodeURIComponent(file.fileName)}`, source: file.source || null, include: true, order: next.length });
        }
      }
      return next.filter(item => !item.attachment || questionDocs.includes(item.attachment) || item.fileId).map((item, order) => ({ ...item, order }));
    });
    if (viewpointFile && !imagePresentation?.sourceFileId) {
      setImagePresentation({ sourceFileId: viewpointFile.id, includeInCompletePdf: true, crop: null });
    }
  }, [files, questionDocs, rfi.id, projectId, viewpointFile, imagePresentation?.sourceFileId]);
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [rfiResponses, setRfiResponses] = useState<Array<{
    id: number; responseText: string; answeredBy: string | null; answeredByEmail: string | null;
    answeredByCompany: string | null; costImpact: string | null; costImpactAmount: string | null; costImpactReason: string | null;
    scheduleImpact: string | null; scheduleImpactDays: number | null; scheduleImpactReason: string | null;
    isConflictOfInterest: boolean | null; createdAt: string;
  }>>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Conflict of interest detection
  const isCoi = !!(
    user && (
      (user.email && rfi.submittedByEmail && user.email.toLowerCase() === rfi.submittedByEmail.toLowerCase()) ||
      (user.companyName && rfi.submittedByCompany && user.companyName.toLowerCase() === rfi.submittedByCompany.toLowerCase())
    )
  );

  // view tracking
  const [viewEvents, setViewEvents] = useState<{ id: number; userFullName: string; userCompanyName: string; viewedAt: string }[]>([]);
  const [showViewedBy, setShowViewedBy] = useState(false);
  const [ballHistory, setBallHistory] = useState<Array<{ id: number; heldBy: string; heldByCompany: string; fromDate: string; toDate: string | null; daysHeld: number | null }>>([]);

  // Track view event on panel open, and load viewed-by list
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch((error) => logClientError("RFI view event log", error));
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/viewed-by`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: { id: number; userFullName: string; userCompanyName: string; viewedAt: string }[]) => {
        if (Array.isArray(data)) setViewEvents(data);
      })
      .catch((error) => logClientError("RFI viewed-by load", error));
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/ball-in-court-history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setBallHistory(data); })
      .catch((error) => logClientError("RFI ball-in-court history load", error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load all responses for this RFI
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    setResponsesLoading(true);
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/responses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setRfiResponses(data); })
      .catch((error) => logClientError("RFI responses load", error))
      .finally(() => setResponsesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfi.id]);

  // response documents
  const [responseDocInput, setResponseDocInput] = useState("");
  const [responseDocs, setResponseDocs] = useState<string[]>(rfi.responseAttachmentsJson || []);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [showAddResponse, setShowAddResponse] = useState(false);

  // ── RFI sending (manual, self-reported — no platform delivery) ───────────
  const [marking, setMarking] = useState(false);
  const [showSendPreview, setShowSendPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [showContextInput, setShowContextInput] = useState(false);

  const sendPreviewText = [
    `To: ${rfi.submittedToEmail || rfi.submittedToPerson || rfi.submittedToCompany || ""}`,
    `Subject: ${rfi.number} — ${rfi.subject}`,
    ``,
    `${rfi.submittedToPerson || rfi.submittedToCompany || "Hello"},`,
    ``,
    `Please find RFI ${rfi.number} below for your review and response.`,
    rfi.dateRequired ? `Response required by: ${fmt(rfi.dateRequired)}.` : null,
    ``,
    `Subject: ${rfi.subject}`,
    `Question:`,
    `${rfi.question || rfi.description || ""}`,
    ``,
    `Submitted by ${rfi.submittedByContact || rfi.createdByName || ""}${rfi.submittedByCompany ? `, ${rfi.submittedByCompany}` : ""}.`,
  ].filter((l) => l !== null).join("\n");

  // AI-drafted email body; falls back to the static template above on failure.
  const previewText = aiPreview ?? sendPreviewText;

  const generatePreview = async () => {
    setPreviewLoading(true);
    setPreviewFailed(false);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/generate-email-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userContext: userContext.trim() || undefined }),
      });
      const data = await resp.json().catch(() => ({})) as { email?: string; error?: string };
      if (!resp.ok) throw new Error(data.error || "generate failed");
      if (!data.email || !data.email.trim()) throw new Error("empty draft");
      setAiPreview(data.email);
      toast({ title: w("Email draft created from text fields only", "Borrador de correo creado solo con campos de texto", lang) });
    } catch (error) {
      setAiPreview(null);
      setPreviewFailed(true);
      toast({ title: error instanceof Error ? error.message : w("AI draft unavailable", "Borrador IA no disponible", lang), variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleMarkSent = async () => {
    setMarking(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/mark-sent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to mark as sent");
      }
      const data = await resp.json() as Rfi;
      onUpdate(data);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI marked as sent — ball is now with the recipient", "RFI marcado como enviado — la pelota está con el destinatario", lang) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Failed to mark as sent", "Error al marcar como enviado", lang), variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  // Does THIS user have their own SendGrid connected? Drives the real Send
  // button vs. the copy-paste + "connect" nudge.
  const [sgConnected, setSgConnected] = useState<boolean | null>(null);
  const [connectedFileSources, setConnectedFileSources] = useState<FileSourceProvider[]>([]);
  const [cloudPickerTarget, setCloudPickerTarget] = useState<null | { target: "question" | "response"; provider: FileSourceProvider }>(null);
  const [hideSgNudge, setHideSgNudge] = useState(() => localStorage.getItem("bimlog-hide-sendgrid-nudge") === "1");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/me/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d) => {
        const list = Array.isArray(d) ? d as { provider: string; status: string }[] : [];
        const sg = list.find(c => c.provider === "sendgrid");
        setSgConnected(!!sg && sg.status === "connected");
        setConnectedFileSources(FILE_SOURCE_PROVIDERS.filter(p => list.some(c => c.provider === p.key && c.status === "connected")));
      })
      .catch(() => setSgConnected(false));
  }, []);

  const handleSendReal = async () => {
    setSending(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const to = rfi.submittedToEmail || "";
      const cc = ((rfi.distributionList as string[] | null) || [])
        .map(e => (e.match(/[^\s<>]+@[^\s<>]+/) || [])[0])
        .filter((e): e is string => !!e);
      const subject = `${rfi.number} — ${rfi.subject}`;
      // Strip any leading To:/Subject: header lines so the body is clean.
      const body = previewText.replace(/^(To:.*\n|Subject:.*\n|\s*\n)+/i, "").trim();
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, body }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Send failed");
      }
      const data = await resp.json() as Rfi;
      onUpdate(data);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI sent via your SendGrid — ball is now with the recipient", "RFI enviado por tu SendGrid — la pelota está con el destinatario", lang) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Send failed", "Error al enviar", lang), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Upload attachments from the user's computer (question + response docs).
  const qAttachFileRef = useRef<HTMLInputElement>(null);
  const rAttachFileRef = useRef<HTMLInputElement>(null);
  const imageEvidenceInputRef = useRef<HTMLInputElement>(null);
  const imageReplacementInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const uploadDoc = async (file: File, onUploaded: (url: string) => void) => {
    setUploadingDoc(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("rfiId", String(rfi.id));
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { downloadUrl } = await resp.json() as { downloadUrl: string };
      onUploaded(downloadUrl);
      toast({ title: w("File uploaded and attached", "Archivo subido y adjuntado", lang) });
    } catch {
      toast({ title: w("Upload failed", "Error al subir", lang), variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: w("Copied to clipboard", "Copiado al portapapeles", lang) });
    } catch {
      toast({ title: w("Copy failed", "Error al copiar", lang), variant: "destructive" });
    }
  };

  const [qAiLoading, setQAiLoading] = useState(false);
  const handleQuestionAi = async (extraDesc?: string) => {
    const seed = (extraDesc || infoQuestion || rfi.question || rfi.description || "").trim();
    setQAiLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const vpCode = (rfi as { sourceViewpointId?: string | null }).sourceViewpointId || undefined;
      const atts = questionDocs.length ? questionDocs : ((rfi.attachmentsJson as string[] | null) || undefined);
      const resp = await fetch(`/api/v1/rfis/generate-question`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          description: seed,
          subject: rfi.subject,
          viewpointCode: vpCode,
          drawingRef: rfi.drawingNumber || undefined,
          specRef: rfi.specSection || undefined,
          location: rfi.locationDescription || undefined,
          attachments: atts,
          costImpact: rfi.costImpact || undefined,
          scheduleImpact: rfi.scheduleImpact || undefined,
        }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const data = await resp.json() as { question: string };
      const q = (data.question || "").trim();
      if (q.toUpperCase().startsWith("NEED_MORE_INFO:")) {
        const ask = q.replace(/^NEED_MORE_INFO:\s*/i, "");
        const more = window.prompt(w("The AI needs a bit more to write a specific question:", "La IA necesita un poco más para escribir una pregunta específica:", lang) + "\n\n" + ask, "");
        if (more && more.trim()) {
          await handleQuestionAi(`${seed}\nCoordinator clarification (${ask}): ${more.trim()}`);
        } else {
          toast({ title: w("Add a brief description and try AI Assist again.", "Agregue una breve descripción e intente Asistencia IA de nuevo.", lang) });
        }
        return;
      }
      setInfoQuestion(q);
      toast({ title: w("AI drafted the question — review before saving", "IA redactó la pregunta — revise antes de guardar", lang) });
    } catch {
      toast({ title: w("AI assist failed", "Asistencia IA falló", lang), variant: "destructive" });
    } finally {
      setQAiLoading(false);
    }
  };

  const handleAiAssist = async () => {
    setAiAssistLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const userDraft = answer.trim();
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/generate-response`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userDraft }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const data = await resp.json() as { response: string };
      setAnswer(data.response);
      const msg = userDraft.length > 0
        ? w("AI rewrote your draft — review before saving", "IA reescribió tu borrador — revise antes de guardar", lang)
        : w("AI draft ready — review before saving", "Borrador listo — revise antes de guardar", lang);
      toast({ title: msg });
    } catch {
      toast({ title: w("AI assist failed", "Asistencia IA falló", lang), variant: "destructive" });
    } finally {
      setAiAssistLoading(false);
    }
  };

  const [, setPage] = useLocation();
  const [raisingCo, setRaisingCo] = useState(false);
  const handleRaiseChangeOrder = async () => {
    setRaisingCo(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${rfi.number} — ${rfi.subject}`,
          description: rfi.question || rfi.description || "",
          contract_value_impact: rfi.costImpactAmount || rfi.costImpact || null,
          schedule_impact_days: rfi.scheduleImpactDays ?? null,
          linked_rfi_ids: [rfi.id],
        }),
      });
      if (!resp.ok) throw new Error("Create failed");
      toast({ title: w("Change Order raised from RFI", "Orden de Cambio creada desde RFI", lang) });
      setPage(`/projects/${projectId}/change-orders`);
    } catch {
      toast({ title: w("Could not raise Change Order", "No se pudo crear la Orden de Cambio", lang), variant: "destructive" });
    } finally {
      setRaisingCo(false);
    }
  };

  const handleExportWord = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export-word`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: w("Word document exported", "Documento Word exportado", lang) });
    } catch {
      toast({ title: w("Word export failed", "Error al exportar Word", lang), variant: "destructive" });
    }
  };

  const _handleExportWordLegacy = () => {
    const fmtW = (d: string | Date | null | undefined) => {
      if (!d) return "—";
      const dt = typeof d === "string" ? new Date(d) : d;
      return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    };
    const hasResp = !!(rfi.answer || rfi.response);
    const respText = rfi.answer || rfi.response || "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1E293B;margin:36pt;}
h1{color:#1E3A5F;font-size:16pt;border-bottom:2pt solid #2563EB;padding-bottom:4pt;}
h2{color:#1E3A5F;font-size:10pt;margin:14pt 0 4pt;}
table{width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:10pt;}
td{padding:4pt 6pt;vertical-align:top;}
.lbl{background:#F1F5F9;font-weight:bold;width:25%;}
.resp-hdr{background:#0F4C75;color:white;font-weight:bold;padding:4pt 6pt;font-size:9pt;text-transform:uppercase;}
.resp-box{border:1pt solid #CBD5E1;padding:8pt;min-height:60pt;font-size:10pt;line-height:1.5;white-space:pre-wrap;}
.blank-box{border:1pt solid #CBD5E1;min-height:60pt;}
.sig-row td{border-top:1pt solid #CBD5E1;padding-top:4pt;font-size:9pt;color:#64748B;}
</style></head><body>
<h1>REQUEST FOR INFORMATION — ${rfi.number}</h1>
<table>
  <tr><td class="lbl">Project</td><td colspan="3">${rfi.subject}</td></tr>
  <tr><td class="lbl">Subject</td><td colspan="3">${rfi.subject}</td></tr>
  <tr><td class="lbl">Status</td><td>${(rfi.status || "").replace("_", " ")}</td><td class="lbl">Priority</td><td>${rfi.priority || "—"}</td></tr>
  <tr><td class="lbl">Date Requested</td><td>${fmtW(rfi.dateRequested || rfi.createdAt)}</td><td class="lbl">Date Required</td><td>${fmtW(rfi.dateRequired || rfi.dueDate)}</td></tr>
  <tr><td class="lbl">Submitted By</td><td>${rfi.submittedByCompany || "—"} / ${rfi.submittedByContact || rfi.createdByName || "—"}</td><td class="lbl">Submitted To</td><td>${rfi.submittedToCompany || "—"} / ${rfi.submittedToPerson || "—"}</td></tr>
  <tr><td class="lbl">Drawing #</td><td>${rfi.drawingNumber || "—"}</td><td class="lbl">Spec Section</td><td>${rfi.specSection || "—"}</td></tr>
  <tr><td class="lbl">Cost Impact</td><td>${rfi.costImpact || "—"}${rfi.costImpactAmount ? ` — ${rfi.costImpactAmount}` : ""}</td><td class="lbl">Schedule Impact</td><td>${rfi.scheduleImpact || "—"}${rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays} days)` : ""}</td></tr>
</table>
<h2>Description of Question</h2>
<div style="border:1pt solid #CBD5E1;padding:8pt;font-size:10pt;line-height:1.5;white-space:pre-wrap;">${rfi.question || rfi.description || "—"}</div>
<br/>
<table><tr><td class="resp-hdr" colspan="4">OFFICIAL RESPONSE</td></tr></table>
${hasResp ? `
<div class="resp-box">${respText}</div>
<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-top:4pt;">
  <tr>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:30%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">ANSWERED BY (Name &amp; Company)</div>
      <div style="font-size:10pt;">${rfi.answeredBy || "—"}</div>
    </td>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:20%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">DATE OF RESPONSE</div>
      <div style="font-size:10pt;">${fmtW(rfi.dateAnswered || rfi.respondedAt)}</div>
    </td>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:25%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">COST IMPACT</div>
      <div style="font-size:9pt;">
        ${'No Cost Impact,Cost Increase TBD,Cost Increase Known,Cost Decrease'.split(',').map(opt => 
          `${rfi.costImpact === opt ? '&#9745;' : '&#9633;'} ${opt}${opt === 'Cost Increase Known' && rfi.costImpactAmount ? `: ${rfi.costImpactAmount}` : ''}`
        ).join('<br/>')}
      </div>
    </td>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:25%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">SCHEDULE IMPACT</div>
      <div style="font-size:9pt;">
        ${'No Schedule Impact,Increase in Calendar Days,Decrease in Calendar Days'.split(',').map(opt => 
          `${rfi.scheduleImpact === opt ? '&#9745;' : '&#9633;'} ${opt}${opt !== 'No Schedule Impact' && rfi.scheduleImpactDays != null ? `: ${rfi.scheduleImpactDays}d` : ''}`
        ).join('<br/>')}
      </div>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="border:1pt solid #CBD5E1;padding:4pt 6pt;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">ATTACHMENTS</div>
      <div style="font-size:9pt;">
        &#9633; See marked up drawings<br/>&#9633; See attached specifications<br/>&#9633; See attached schedules<br/>&#9633; None
      </div>
    </td>
    <td colspan="2" style="border:1pt solid #CBD5E1;padding:4pt 6pt;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">SIGNATURE</div>
      <div style="margin-bottom:6pt;"><span style="font-size:8pt;color:#64748B;">Name:</span> ${rfi.answeredBy || "—"}</div>
      <div style="border-bottom:1pt solid #CBD5E1;min-height:24pt;margin-top:4pt;"></div>
    </td>
  </tr>
</table>
` : `
<div class="blank-box" style="min-height:288pt;"></div>
<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-top:4pt;">
  <tr>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:30%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:12pt;">ANSWERED BY (Name &amp; Company)</div>
      <div style="border-bottom:1pt solid #CBD5E1;min-height:18pt;"></div>
    </td>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:20%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:12pt;">DATE OF RESPONSE</div>
      <div style="border-bottom:1pt solid #CBD5E1;min-height:18pt;"></div>
    </td>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:25%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">COST IMPACT</div>
      &#9633; No Cost Impact<br/>&#9633; Cost Increase TBD<br/>&#9633; Cost Increase Known: $__________<br/>&#9633; Cost Decrease
    </td>
    <td style="border:1pt solid #CBD5E1;padding:4pt 6pt;width:25%;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">SCHEDULE IMPACT</div>
      &#9633; No Schedule Impact<br/>&#9633; Increase in Calendar Days: _______<br/>&#9633; Decrease in Calendar Days: _______
    </td>
  </tr>
  <tr>
    <td colspan="2" style="border:1pt solid #CBD5E1;padding:4pt 6pt;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">ATTACHMENTS</div>
      &#9633; See marked up drawings &nbsp; &#9633; See attached specifications &nbsp; &#9633; See attached schedules &nbsp; &#9633; None
    </td>
    <td colspan="2" style="border:1pt solid #CBD5E1;padding:4pt 6pt;vertical-align:top;">
      <div style="font-size:8pt;font-weight:bold;color:#64748B;margin-bottom:4pt;">SIGNATURE</div>
      <div style='display:grid;grid-template-columns:1fr 1fr;gap:8pt;margin-bottom:4pt;font-size:8pt;'>
        <div>Name: <div style="border-bottom:1pt solid #CBD5E1;min-height:16pt;"></div></div>
        <div>Title: <div style="border-bottom:1pt solid #CBD5E1;min-height:16pt;"></div></div>
      </div>
      <div style='display:grid;grid-template-columns:1fr 1fr;gap:8pt;font-size:8pt;'>
        <div>Company: <div style="border-bottom:1pt solid #CBD5E1;min-height:16pt;"></div></div>
        <div>Date: <div style="border-bottom:1pt solid #CBD5E1;min-height:16pt;"></div></div>
      </div>
    </td>
  </tr>
</table>
`}
<p style="font-size:8pt;color:#94A3B8;margin-top:24pt;">Generated by BIMLog by IgniteSmart | ${rfi.number} | ${new Date().toLocaleDateString()}</p>
</body></html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}.doc`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: w("Word document exported", "Documento Word exportado", lang) });
  };

  const handleDownloadAuditCert = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/audit-certificate`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to generate audit certificate");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}-RFI-Audit-Report.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: w("Audit certificate downloaded", "Certificado de auditoría descargado", lang) });
    } catch {
      toast({ title: w("Download failed", "Descarga fallida", lang), variant: "destructive" });
    }
  };

  const handleCloseRfi = async () => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "closed" }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error || "Failed"); }
      const updated = await r.json() as typeof rfi;
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI closed.", "RFI cerrado.", lang) });
      onUpdate(updated);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : w("Close failed", "Error al cerrar", lang), variant: "destructive" });
    }
  };

  const uploadImageEvidence = async (file: File, mode: "source" | "replacement") => {
    if (!file.type.startsWith("image/")) {
      toast({ title: w("Select an image file.", "Seleccione un archivo de imagen.", lang), variant: "destructive" });
      return;
    }
    setUploadingDoc(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("rfiId", String(rfi.id));
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const data = await resp.json() as { fileId: number; fileName: string; downloadUrl: string };
      setQuestionDocs(prev => prev.includes(data.downloadUrl) ? prev : [...prev, data.downloadUrl]);
      setPackageItems(prev => {
        const sourceId = imagePresentation?.sourceFileId ?? viewpointFile?.id ?? null;
        const adjusted = mode === "replacement" && sourceId
          ? prev.map(item => item.fileId === sourceId ? { ...item, include: false } : item)
          : prev;
        return [...adjusted, { key: `file:${data.fileId}`, label: data.fileName, fileId: data.fileId, attachment: data.downloadUrl, source: "rfi-attachment", include: true, order: adjusted.length }];
      });
      setImagePresentation(prev => ({
        sourceFileId: mode === "source" ? data.fileId : prev?.sourceFileId ?? viewpointFile?.id ?? data.fileId,
        replacementFileId: mode === "replacement" ? data.fileId : prev?.replacementFileId ?? null,
        includeInCompletePdf: prev?.includeInCompletePdf !== false,
        crop: prev?.crop ?? null,
      }));
      toast({ title: mode === "replacement" ? w("Replacement image attached. Original evidence preserved.", "Imagen de reemplazo adjuntada. Evidencia original preservada.", lang) : w("Image attached.", "Imagen adjuntada.", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Image upload failed", "Error al subir imagen", lang), variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const beginPendingImage = (file: File, mode: "source" | "replacement") => {
    if (!file.type.startsWith("image/")) {
      toast({ title: w("Select an image file.", "Seleccione un archivo de imagen.", lang), variant: "destructive" });
      return;
    }
    setPendingImage(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file), mode };
    });
  };

  const pasteImageEvidence = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          beginPendingImage(new File([blob], `clipboard-rfi-${rfi.id}.png`, { type }), "replacement");
          return;
        }
      }
      toast({ title: w("Clipboard does not contain an image.", "El portapapeles no contiene una imagen.", lang), variant: "destructive" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Clipboard image access was denied.", "Acceso a imagen del portapapeles denegado.", lang), variant: "destructive" });
    }
  };

  const captureScreenImage = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast({ title: w("Screen capture is not supported in this browser.", "La captura de pantalla no es compatible con este navegador.", lang), variant: "destructive" });
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      stream.getTracks().forEach(track => track.stop());
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not capture image");
      beginPendingImage(new File([blob], `screen-capture-rfi-${rfi.id}.png`, { type: "image/png" }), "replacement");
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Screen capture unavailable or denied.", "Captura de pantalla no disponible o denegada.", lang), variant: "destructive" });
    }
  };

  const handleReopenRfi = async () => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "open" }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})) as { error?: string }; throw new Error(d.error || "Failed"); }
      const updated = await r.json() as typeof rfi;
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI reopened.", "RFI reabierto.", lang) });
      onUpdate(updated);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : w("Reopen failed", "Error al reabrir", lang), variant: "destructive" });
    }
  };

  const allStatusOptions = [...new Map(getOptions("rfi_status").map(o => [o.value, o])).values()];
  // Only project_admin can close an RFI
  const currentMember = members.find(m => m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase());
  const isProjectAdmin = currentMember?.role === "project_admin" || Boolean((user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin);
  const statusOptions = isProjectAdmin
    ? allStatusOptions
    : allStatusOptions.filter(o => o.value !== "closed");

  const { mutate: updateRfi, isPending: isUpdating } = useUpdateRfi({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w("RFI updated", "RFI actualizado", lang) });
        onUpdate(updated);
      },
      onError: () => toast({ title: w("Update failed", "Actualización falló", lang), variant: "destructive" }),
    },
  });

  const { mutate: reviseRfi } = useReviseRfi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w("Revision created", "Revisión creada", lang) });
        onClose();
      },
    },
  });

  const bic = getBallInCourt(rfi);
  const due = rfi.dateRequired || rfi.dueDate;
  const isOverdue = rfi.status !== "closed" && due ? new Date(due) < new Date() : false;
  const days = differenceInDays(new Date(), new Date(rfi.createdAt));
  // The response form is open (drafting an answer). The single Save Response
  // action for it lives at the very bottom of the page, below the email.
  const responseFormOpen = canWrite && rfi.status !== "closed" && ((rfiResponses.length === 0 && !rfi.answer && !rfi.response) || showAddResponse);
  // The single impact block shows what the asker flagged plus what the latest response confirmed.
  const confirmedCost = [...rfiResponses].reverse().find(r => r.costImpact);
  const confirmedSched = [...rfiResponses].reverse().find(r => r.scheduleImpact);
  const storedQuestionDocs = (rfi.attachmentsJson as string[] | null) || [];
  const responseCostReasonRequired = costImpact === "Cost Increase TBD" || costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const responseCostAmountRequired = costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const responseScheduleDaysRequired = schedImpact === "Increase in Calendar Days" || schedImpact === "Decrease in Calendar Days";
  const infoCostReasonRequired = infoCost === "Cost Increase TBD" || infoCost === "Cost Increase Known" || infoCost === "Cost Decrease";
  const infoCostAmountRequired = infoCost === "Cost Increase Known" || infoCost === "Cost Decrease";
  const infoScheduleDaysRequired = infoSched === "Increase in Calendar Days" || infoSched === "Decrease in Calendar Days";
  const timeline = [
    { label: w("Created", "Creado", lang), date: rfi.createdAt as string | Date | null, by: rfi.createdByName || undefined },
    ...(rfi.sentAt ? [{ label: w("Sent to reviewer", "Enviado al revisor", lang), date: rfi.sentAt as string | Date | null, by: undefined as string | undefined }] : []),
    ...rfiResponses.map(r => ({ label: w("Response", "Respuesta", lang), date: r.createdAt as string | Date | null, by: r.answeredBy || undefined })),
    ...(rfi.dateAnswered ? [{ label: w("Answered", "Respondido", lang), date: rfi.dateAnswered as string | Date | null, by: undefined as string | undefined }] : []),
  ].filter(e => !!e.date).sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());

  const handleSaveResponse = async () => {
    if (!answer.trim()) {
      toast({ title: w("Official response text is required.", "Se requiere texto de respuesta oficial.", lang), variant: "destructive" });
      return;
    }
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          responseText: answer,
          answeredBy: answeredBy || undefined,
          costImpact: costImpact || undefined,
          costImpactAmount: responseCostAmountRequired ? costAmount : undefined,
          costImpactReason: responseCostReasonRequired ? costReason : undefined,
          scheduleImpact: schedImpact || undefined,
          scheduleImpactDays: responseScheduleDaysRequired && schedDays ? parseInt(schedDays) : undefined,
          scheduleImpactReason: responseScheduleDaysRequired ? schedReason : undefined,
          closingStatus,
          responseAttachmentsJson: responseDocs.length > 0 ? responseDocs : [],
        }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error || "Failed"); }
      const newResp = await r.json() as typeof rfiResponses[0];
      setRfiResponses(prev => [...prev, newResp]);
      setShowAddResponse(false);
      if (newResp.isConflictOfInterest) {
        toast({ title: w("Conflict of interest flagged in audit trail.", "Conflicto de interés marcado en la auditoría.", lang), variant: "destructive" });
      } else {
        toast({ title: w("Response saved.", "Respuesta guardada.", lang) });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      onUpdate({ ...rfi, answer, answeredBy, status: closingStatus });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : w("Save failed", "Error al guardar", lang), variant: "destructive" });
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    value ? (
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, paddingBottom: 6, borderBottom: "1px solid hsl(var(--border) / 0.4)", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 2 }}>{label}</span>
        <span style={{ fontSize: 13 }}>{value}</span>
      </div>
    ) : null
  );

  const savedRfiActions = getSavedRfiActionMatrix({
    rfi,
    canWrite,
    isProjectAdmin,
    hasViewpoint: !!(rfi as { sourceViewpointId?: string | null }).sourceViewpointId,
    isEditing: infoEdit,
    lang,
  });

  const recordState: RfiRecordState = rfi.status === "closed"
    ? "closed"
    : rfi.revisionNumber && rfi.revisionNumber > 0
      ? "revised"
      : rfi.sendStatus === "sent" || rfi.sentAt
        ? "sent"
        : "draft";
  const detailPermissions: RfiCanonicalPermissions = {
    canEdit: canWrite,
    canRespond: responseFormOpen,
    canClose: isProjectAdmin && rfi.status !== "closed",
    canReopen: canWrite && rfi.status === "closed",
    canExport: true,
    canRaiseChangeOrder: canWrite,
    canJumpViewpoint: !!(rfi as { sourceViewpointId?: string | null }).sourceViewpointId,
  };
  const saveCanonicalRfi = () => {
    updateRfi({
      projectId,
      rfiId: rfi.id,
      data: {
        subject: infoSubject,
        rfiType: infoType,
        sourceViewpointLabel: infoVpLabel,
        dateRequired: infoDateRequired ? new Date(infoDateRequired).toISOString() : undefined,
        question: infoQuestion,
        costImpact: infoCost,
        costImpactAmount: infoCostAmountRequired ? infoCostAmt : null,
        costImpactReason: infoCostReasonRequired ? infoCostReason : null,
        scheduleImpact: infoSched,
        scheduleImpactDays: infoScheduleDaysRequired && infoSchedDays.trim() && !Number.isNaN(Number(infoSchedDays)) ? Number(infoSchedDays) : null,
        scheduleImpactReason: infoScheduleDaysRequired ? infoSchedReason : null,
        distributionList: infoDist,
        submittedByCompany: infoFromCompany,
        submittedByContact: infoFromContact,
        submittedByAddress: infoFromAddress,
        submittedByPhone: infoFromPhone,
        submittedByEmail: infoFromEmail,
        submittedToCompany: infoToCompany,
        submittedToPerson: infoToPerson,
        submittedToEmail: infoToEmail,
        attachmentsJson: questionDocs,
        attachmentPackageJson: packageItems,
        imagePresentationJson: imagePresentation,
      },
    });
    setInfoEdit(false);
  };
  const handleCanonicalDetailChange = (field: keyof RfiCanonicalValues, value: string) => {
    switch (field) {
      case "subject": setInfoSubject(value); break;
      case "priority": break;
      case "rfiType": setInfoType(value); break;
      case "dateRequired": setInfoDateRequired(value); break;
      case "submittedByCompany": setInfoFromCompany(value); break;
      case "submittedByContact": setInfoFromContact(value); break;
      case "submittedByAddress": setInfoFromAddress(value); break;
      case "submittedByPhone": setInfoFromPhone(value); break;
      case "submittedByEmail": setInfoFromEmail(value); break;
      case "submittedToCompany": setInfoToCompany(value); break;
      case "submittedToPerson": setInfoToPerson(value); break;
      case "submittedToEmail": setInfoToEmail(value); break;
      case "drawingNumber": break;
      case "drawingTitle": break;
      case "specSection": break;
      case "detailNumber": break;
      case "noteNumber": break;
      case "locationDescription": break;
      case "referenceInput": setQuestionDocInput(value); break;
      case "question": setInfoQuestion(value); break;
      case "costImpact": setInfoCost(value); break;
      case "costImpactAmount": setInfoCostAmt(value); break;
      case "costImpactReason": setInfoCostReason(value); break;
      case "scheduleImpact": setInfoSched(value); break;
      case "scheduleImpactDays": setInfoSchedDays(value.replace(/[^0-9]/g, "")); break;
      case "scheduleImpactReason": setInfoSchedReason(value); break;
      case "distributionList": setInfoDist(value.split(",").map(v => v.trim()).filter(Boolean)); break;
      case "responseText": setAnswer(value); break;
      default: break;
    }
  };

  if (Date.now() >= 0) return (
    <RfiCanonicalForm
      lang={lang}
      mode={infoEdit ? "edit" : "view"}
      recordState={recordState}
      values={{
        number: rfi.number,
        projectName: "",
        subject: infoEdit ? infoSubject : rfi.subject,
        status: rfi.status,
        priority: rfi.priority,
        rfiType: infoEdit ? infoType : (rfi.rfiType || ""),
        dateRequested: fmt(rfi.dateRequested || rfi.createdAt),
        dateRequired: infoEdit ? infoDateRequired : fmt(rfi.dateRequired || rfi.dueDate),
        daysOutstanding: `${days}d`,
        dateAnswered: fmt(rfi.dateAnswered || rfi.respondedAt),
        submittedByCompany: infoEdit ? infoFromCompany : (rfi.submittedByCompany || ""),
        submittedByContact: infoEdit ? infoFromContact : (rfi.submittedByContact || rfi.createdByName || ""),
        submittedByAddress: infoEdit ? infoFromAddress : (rfi.submittedByAddress || ""),
        submittedByPhone: infoEdit ? infoFromPhone : (rfi.submittedByPhone || ""),
        submittedByEmail: infoEdit ? infoFromEmail : (rfi.submittedByEmail || ""),
        submittedToCompany: infoEdit ? infoToCompany : (rfi.submittedToCompany || ""),
        submittedToPerson: infoEdit ? infoToPerson : (rfi.submittedToPerson || ""),
        submittedToEmail: infoEdit ? infoToEmail : (rfi.submittedToEmail || ""),
        drawingNumber: rfi.drawingNumber || "",
        drawingTitle: rfi.drawingTitle || "",
        specSection: rfi.specSection || "",
        detailNumber: rfi.detailNumber || "",
        noteNumber: rfi.noteNumber || "",
        locationDescription: rfi.locationDescription || "",
        referenceInput: questionDocInput,
        question: infoEdit ? infoQuestion : (rfi.question || rfi.description || ""),
        costImpact: infoEdit ? infoCost : (rfi.costImpact || ""),
        costImpactAmount: infoEdit ? infoCostAmt : (rfi.costImpactAmount || ""),
        costImpactReason: infoEdit ? infoCostReason : ((rfi as Rfi & { costImpactReason?: string }).costImpactReason || ""),
        scheduleImpact: infoEdit ? infoSched : (rfi.scheduleImpact || ""),
        scheduleImpactDays: infoEdit ? infoSchedDays : (rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : ""),
        scheduleImpactReason: infoEdit ? infoSchedReason : ((rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason || ""),
        distributionList: infoEdit ? infoDist : ((rfi.distributionList as string[] | null) || []),
        responseText: answer,
      }}
      permissions={detailPermissions}
      references={questionDocs}
      attachments={[]}
      imagePresentation={imagePresentation}
      packageItems={packageItems}
      responses={rfiResponses.map(resp => ({ id: resp.id, text: resp.responseText, by: resp.answeredBy || undefined, date: resp.createdAt }))}
      loading={{ saving: isUpdating, uploading: uploadingDoc, response: isUpdating }}
      actions={{
        "export-pdf": () => onExportPdf(rfi),
        "export-complete-pdf": () => onExportCompletePdf(rfi),
        "export-docx": handleExportWord,
        "export-audit-pdf": handleDownloadAuditCert,
        "viewed-by": () => setShowViewedBy(!showViewedBy),
        edit: startInfoEdit,
        close: handleCloseRfi,
        reopen: handleReopenRfi,
        "raise-change-order": handleRaiseChangeOrder,
        "jump-viewpoint": () => { void fetch(`http://localhost:8765/jump?code=${encodeURIComponent((rfi as { sourceViewpointId?: string | null }).sourceViewpointId || "")}`, { mode: "no-cors" }); },
        "save-rfi": saveCanonicalRfi,
        cancel: () => setInfoEdit(false),
        "save-response": handleSaveResponse,
      }}
      onChange={handleCanonicalDetailChange}
      onAddReference={() => { if (questionDocInput.trim()) { setQuestionDocs(prev => [...prev, questionDocInput.trim()]); setQuestionDocInput(""); } }}
      onRemoveReference={index => setQuestionDocs(prev => prev.filter((_, i) => i !== index))}
      onUploadFile={() => qAttachFileRef.current?.click()}
      onGenerateQuestionAi={handleQuestionAi}
      onGenerateEmailAi={() => void generatePreview()}
      onCopyEmail={handleCopyPreview}
    />
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "hsl(var(--muted-foreground))", background: "transparent", border: "none", cursor: "pointer", padding: "4px 0 14px" }}>
        <ChevronLeft style={{ width: 16, height: 16 }} />{w("Back to RFIs", "Volver a RFIs", lang)}
      </button>
      <div style={{ background: "hsl(var(--background))", borderRadius: 12, border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {w(rfi.sendStatus === "sent" || rfi.sentAt ? "1. Header / RFI Status - Existing RFI / Sent RFI" : "1. Header / RFI Status - Existing RFI / Not Sent", rfi.sendStatus === "sent" || rfi.sentAt ? "1. Encabezado / Estado RFI - RFI Existente / Enviado" : "1. Encabezado / Estado RFI - RFI Existente / No Enviado", lang)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>{rfi.number}</span>
              <span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span>
              <span className={`badge ${PRIORITY_BADGE[rfi.priority] ?? "badge-gray"}`}>{getLabel("rfi_priority", rfi.priority)}</span>
              {infoEdit ? (
                <select value={infoType} onChange={e => setInfoType(e.target.value)} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "transparent", color: "inherit" }}>
                  <option value="">{w("Type…", "Tipo…", lang)}</option>
                  {rfiTypeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              ) : rfi.rfiType ? (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#EEF2FF", color: "#4338CA" }}>{rfi.rfiType}</span>
              ) : null}
              {(rfi.revisionNumber ?? 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", padding: "2px 6px", borderRadius: 4, background: "#EDE9FE" }}>Rev {rfi.revisionNumber}</span>}
            </div>
            {infoEdit ? (
              <input value={infoSubject} onChange={e => setInfoSubject(e.target.value)} placeholder={w("RFI title / subject", "Título / asunto del RFI", lang)} style={{ ...infoInput, fontSize: 16, fontWeight: 700, marginTop: 4 }} />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{rfi.subject}</div>
            )}
            {bic && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "4px 10px", borderRadius: 20, background: bic.color + "15", border: `1px solid ${bic.color}44`, width: "fit-content" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: bic.color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: bic.color }}>{w("Ball in court:", "Responsable:", lang)} {bic.label}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="outline" size="sm" onClick={() => onExportPdf(rfi)} style={{ gap: 5, fontSize: 11 }}>
              <FileText style={{ width: 12, height: 12 }} />{w("RFI PDF", "RFI PDF", lang)}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExportCompletePdf(rfi)} style={{ gap: 5, fontSize: 11 }}>
              <FileText style={{ width: 12, height: 12 }} />{w("Complete RFI PDF", "PDF Completo RFI", lang)}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportWord} style={{ gap: 5, fontSize: 11 }}>
              <FileText style={{ width: 12, height: 12 }} />{w("RFI DOCX", "RFI DOCX", lang)}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadAuditCert} style={{ gap: 5, fontSize: 11 }}>
              <Shield style={{ width: 12, height: 12 }} />{w("RFI Audit PDF", "PDF Auditoria RFI", lang)}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowViewedBy(!showViewedBy)} title={w("Show who viewed this RFI", "Mostrar quien vio este RFI", lang)} style={{ gap: 5, fontSize: 11 }}>
              <Eye style={{ width: 12, height: 12 }} />{viewEvents.length}
            </Button>
            {savedRfiActions.some(action => action.key === "close") && (
              <Button variant="outline" size="sm" onClick={handleCloseRfi} style={{ gap: 5, fontSize: 11, color: "#DC2626", borderColor: "#FCA5A5" }}>
                <X style={{ width: 12, height: 12 }} />{w("Close RFI", "Cerrar RFI", lang)}
              </Button>
            )}
            {savedRfiActions.some(action => action.key === "reopen") && (
              <Button variant="outline" size="sm" onClick={handleReopenRfi} style={{ gap: 5, fontSize: 11 }}>
                <RefreshCw style={{ width: 12, height: 12 }} />{w("Reopen RFI", "Reabrir RFI", lang)}
              </Button>
            )}
            {savedRfiActions.some(action => action.key === "edit") && (
              <Button variant="outline" size="sm" onClick={startInfoEdit} style={{ gap: 5, fontSize: 11 }}>
                <PenLine style={{ width: 12, height: 12 }} />{w("Edit RFI", "Editar RFI", lang)}
              </Button>
            )}
            {savedRfiActions.some(action => action.key === "raise-change-order") && (
              <Button variant="outline" size="sm" disabled={raisingCo} onClick={handleRaiseChangeOrder} style={{ gap: 5, fontSize: 11, opacity: raisingCo ? 0.6 : 1 }}>
                <FileText style={{ width: 12, height: 12 }} />{w("Raise Change Order", "Crear Orden de Cambio", lang)}
              </Button>
            )}
            {savedRfiActions.some(action => action.key === "jump-viewpoint") && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const code = (rfi as { sourceViewpointId?: string | null }).sourceViewpointId!;
                  const ctrl = new AbortController();
                  const timer = setTimeout(() => ctrl.abort(), 2000);
                  try {
                    await fetch(`http://localhost:8765/jump?code=${encodeURIComponent(code)}`, { mode: "no-cors", signal: ctrl.signal });
                    clearTimeout(timer);
                    toast({ title: w("Navigated to viewpoint in Navisworks", "Navegado a la vista en Navisworks", lang) });
                  } catch {
                    clearTimeout(timer);
                    toast({ title: w("Navisworks plugin not reachable — open the model in Navisworks and try again.", "Plugin de Navisworks no disponible — abra el modelo en Navisworks e intente de nuevo.", lang), variant: "destructive" });
                  }
                }}
                style={{ gap: 5, fontSize: 11 }}
              >
                <Navigation style={{ width: 12, height: 12 }} />{w("Jump to Viewpoint", "Ir al Punto de Vista", lang)}
              </Button>
            )}
            <button onClick={onClose} style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 6 }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px 24px" }}>
          {isOverdue && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, fontSize: 12, color: "#BE123C" }}>
              <AlertTriangle style={{ width: 14, height: 14 }} />
              {w("This RFI is overdue. Response was required by", "Este RFI está vencido. La respuesta era requerida el", lang)} {fmt(due)}.
            </div>
          )}

          {/* Viewed-by dropdown */}
          {showViewedBy && (
            <div style={{ marginBottom: 14, padding: "10px 14px", border: "1px solid #BAE6FD", borderRadius: 8, background: "#F0F9FF" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0369A1", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Eye style={{ width: 13, height: 13 }} />
                {w("View History", "Historial de Visualización", lang)} ({viewEvents.length})
              </div>
              {viewEvents.length === 0 ? (
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("No view events yet.", "Sin eventos de visualización.", lang)}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {viewEvents.slice().reverse().map((evt) => (
                    <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: "1px solid #E0F2FE" }}>
                      <span style={{ fontWeight: 600 }}>{evt.userFullName} <span style={{ fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>· {evt.userCompanyName}</span></span>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>{new Date(evt.viewedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 14, padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--muted) / 0.25)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Clock style={{ width: 13, height: 13 }} />
              {w("Ball-in-Court History", "Historial de Responsable", lang)}
            </div>
            {ballHistory.length === 0 ? (
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {rfi.sendStatus === "sent"
                  ? w("No custody rows have been logged yet.", "Aun no hay filas de custodia registradas.", lang)
                  : w("Not sent yet. The author holds the RFI until it is sent.", "Aun no enviado. El autor conserva el RFI hasta enviarlo.", lang)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ballHistory.map(row => (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, fontSize: 11, padding: "4px 0", borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
                    <span style={{ fontWeight: 600 }}>{row.heldBy} <span style={{ fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>- {row.heldByCompany}</span></span>
                    <span>{fmt(row.fromDate)} - {row.toDate ? fmt(row.toDate) : w("Current", "Actual", lang)}</span>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{row.toDate ? `${row.daysHeld ?? differenceInDays(new Date(row.toDate), new Date(row.fromDate))} ${w("days", "dias", lang)}` : w("Open", "Abierto", lang)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generated Response Documents */}
          {files && files.filter(f => f.source === "system-generated" && f.linkedRfiId === rfi.id).length > 0 && (
            <div style={{ marginBottom: 14, padding: "10px 14px", border: "1px solid #BBF7D0", borderRadius: 8, background: "#F0FDF4" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 style={{ width: 13, height: 13, color: "#16A34A" }} />
                {w("Auto-Generated Response Documents", "Documentos de Respuesta Generados", lang)}
                <span style={{ fontSize: 9, fontWeight: 700, background: "#1E3A5F", color: "white", padding: "1px 6px", borderRadius: 10, marginLeft: 4 }}>BIMLog Auto</span>
              </div>
              {files.filter(f => f.source === "system-generated" && f.linkedRfiId === rfi.id).map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 4 }}>
                  <FileText style={{ width: 12, height: 12, color: "#16A34A" }} />
                  <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11 }}>{f.fileName}</span>
                  <button
                    onClick={async () => {
                      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
                      const resp = await fetch(`/api/v1/projects/${projectId}/files/${f.id}/download`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (resp.ok) {
                        const blob = await resp.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = f.fileName; a.click();
                        URL.revokeObjectURL(url);
                      } else {
                        toast({ title: w("Download failed", "Descarga fallida", lang), variant: "destructive" });
                      }
                    }}
                    style={{ padding: "2px 8px", fontSize: 10, border: "1px solid #86EFAC", borderRadius: 4, background: "white", color: "#166534", cursor: "pointer" }}
                  >
                    {w("Download", "Descargar", lang)}
                  </button>
                </div>
              ))}
            </div>
          )}

          <SectionHeader title={w("1. Header / RFI Status", "1. Encabezado / Estado RFI", lang)} />
          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              [w("Date Requested", "Fecha Solicitada", lang), fmt(rfi.dateRequested || rfi.createdAt)],
              [w("Date Required", "Fecha Requerida", lang), infoEdit ? <input type="date" value={infoDateRequired} onChange={e => setInfoDateRequired(e.target.value)} style={{ ...infoInput, textAlign: "center", fontWeight: 700 }} /> : fmt(rfi.dateRequired || rfi.dueDate)],
              [w("Days Outstanding", "Días en Espera", lang), `${days}d`],
              [w("Date Answered", "Fecha Respondido", lang), fmt(rfi.dateAnswered || rfi.respondedAt)],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ padding: "8px 12px", background: "hsl(var(--secondary) / 0.4)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: label === w("Days Outstanding", "Días en Espera", lang) ? daysColor(days, isOverdue) : "hsl(var(--foreground))" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Activity timeline */}
          {timeline.length > 0 && (
            <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 8 }}>{w("Activity", "Actividad", lang)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {timeline.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D4ED8", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{e.label}</span>
                    {e.by && <span style={{ color: "hsl(var(--muted-foreground))" }}>· {e.by}</span>}
                    <span style={{ marginLeft: "auto", color: "hsl(var(--muted-foreground))", fontSize: 11 }}>{fmt(e.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SectionHeader title={w("2. Submitted By", "2. Enviado Por", lang)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>{w("Submitted By", "Enviado Por", lang)}</div>
                {canWrite && !infoEdit && (
                  <button onClick={startInfoEdit} style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>{w("Edit", "Editar", lang)}</button>
                )}
              </div>
              {infoEdit ? (
                <>
                  <input value={infoFromCompany} onChange={e => setInfoFromCompany(e.target.value)} placeholder={w("Company (you / asker)", "Empresa (usted / solicitante)", lang)} style={infoInput} />
                  <input value={infoFromContact} onChange={e => setInfoFromContact(e.target.value)} placeholder={w("Contact name", "Nombre de contacto", lang)} style={{ ...infoInput, marginTop: 6 }} />
                  <input value={infoFromAddress} onChange={e => setInfoFromAddress(e.target.value)} placeholder={w("Address", "Direccion", lang)} style={{ ...infoInput, marginTop: 6 }} />
                  <input value={infoFromPhone} onChange={e => setInfoFromPhone(e.target.value)} placeholder={w("Phone", "Telefono", lang)} style={{ ...infoInput, marginTop: 6 }} />
                  <input value={infoFromEmail} onChange={e => setInfoFromEmail(e.target.value)} placeholder={w("Email", "Correo", lang)} style={{ ...infoInput, marginTop: 6 }} />
                </>
              ) : (
                <>
                  {rfi.submittedByCompany && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Building2 style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>{rfi.submittedByCompany}</span></div>}
                  {(rfi.submittedByContact || rfi.createdByName) && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><User style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByContact || rfi.createdByName}</span></div>}
                  {rfi.submittedByEmail && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Mail style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByEmail}</span></div>}
                  {rfi.submittedByPhone && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByPhone}</span></div>}
                  {rfi.submittedByAddress && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><MapPin style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByAddress}</span></div>}
                </>
              )}
            </div>
            <SectionHeader title={w("3. Submitted To", "3. Enviado A", lang)} />
            <div style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>{w("Submitted To", "Enviado A", lang)}</div>
                {canWrite && !infoEdit && (
                  <button onClick={startInfoEdit} style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>{w("Edit", "Editar", lang)}</button>
                )}
              </div>
              {infoEdit ? (
                <>
                  <input list="rfi-dir-companies" value={infoToCompany} onChange={e => {
                    const v = e.target.value; setInfoToCompany(v);
                    const m = rfiDirectory.find(d => (d.companyName || "") === v);
                    if (m && !infoToEmail) { if (m.fullName) setInfoToPerson(m.fullName); if (m.email) setInfoToEmail(m.email); }
                  }} placeholder={w("Company — pick from directory or type new", "Empresa — elija del directorio o escriba nueva", lang)} style={infoInput} />
                  <input list="rfi-dir-people" value={infoToPerson} onChange={e => {
                    const v = e.target.value; setInfoToPerson(v);
                    const m = rfiDirectory.find(d => d.fullName === v);
                    if (m) { if (m.companyName) setInfoToCompany(m.companyName); if (m.email) setInfoToEmail(m.email); }
                  }} placeholder={w("Person — pick or type new", "Persona — elija o escriba nueva", lang)} style={{ ...infoInput, marginTop: 6 }} />
                  <input value={infoToEmail} onChange={e => setInfoToEmail(e.target.value)} placeholder={w("Email", "Correo", lang)} style={{ ...infoInput, marginTop: 6 }} />
                  <datalist id="rfi-dir-companies">{[...new Set(rfiDirectory.map(d => d.companyName).filter((c): c is string => !!c))].map((c, i) => <option key={i} value={c} />)}</datalist>
                  <datalist id="rfi-dir-people">{rfiDirectory.map((d, i) => <option key={i} value={d.fullName}>{d.companyName ? `${d.fullName} — ${d.companyName}` : d.fullName}</option>)}</datalist>
                </>
              ) : (
                <>
                  {rfi.submittedToCompany && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Building2 style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>{rfi.submittedToCompany}</span></div>}
                  {rfi.submittedToPerson && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><User style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedToPerson}</span></div>}
                  {rfi.submittedToEmail && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedToEmail}</span></div>}
                  {!rfi.submittedToCompany && !rfi.submittedToPerson && <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>—</span>}
                </>
              )}
            </div>
          </div>

          <SectionHeader title={w("4. Reference Information / Attachments", "4. Informacion de Referencia / Adjuntos", lang)} />

          {/* Reference info */}
          {(infoEdit || rfi.drawingNumber || rfi.drawingTitle || rfi.specSection || rfi.detailNumber || rfi.noteNumber || rfi.locationDescription || storedQuestionDocs.length > 0) && (
            <div style={{ marginBottom: 16, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 10 }}>{w("Reference Information", "Información de Referencia", lang)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <InfoRow label={w("Drawing #", "Plano #", lang)} value={rfi.drawingNumber} />
                <InfoRow label={w("Drawing Title", "Título Plano", lang)} value={rfi.drawingTitle} />
                <InfoRow label={w("Spec Section", "Sección Esp.", lang)} value={rfi.specSection} />
                <InfoRow label={w("Detail #", "Detalle #", lang)} value={rfi.detailNumber} />
                <InfoRow label={w("Note #", "Nota #", lang)} value={rfi.noteNumber} />
                <InfoRow label={w("Location", "Ubicación", lang)} value={rfi.locationDescription} />
              </div>
              {infoEdit ? (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border) / 0.4)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{w("Attachments / References", "Adjuntos / Referencias", lang)}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <input value={questionDocInput} onChange={e => setQuestionDocInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && questionDocInput.trim()) { setQuestionDocs(prev => [...prev, questionDocInput.trim()]); setQuestionDocInput(""); e.preventDefault(); } }} placeholder={w("Paste a URL or file name, e.g. SK-105 Rev2.pdf", "Pegue URL o nombre de archivo, ej. SK-105 Rev2.pdf", lang)} style={{ ...infoInput, flex: "1 1 260px" }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => { if (questionDocInput.trim()) { setQuestionDocs(prev => [...prev, questionDocInput.trim()]); setQuestionDocInput(""); } }} style={{ fontSize: 11 }}>{w("Add Reference", "Agregar Referencia", lang)}</Button>
                    <input ref={qAttachFileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f, url => setQuestionDocs(prev => [...prev, url])); e.target.value = ""; }} />
                    <Button type="button" size="sm" variant="outline" disabled={uploadingDoc} onClick={() => qAttachFileRef.current?.click()} style={{ fontSize: 11, gap: 4 }}>
                      {uploadingDoc ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <FileText style={{ width: 11, height: 11 }} />}{uploadingDoc ? w("Uploading...", "Subiendo...", lang) : w("Upload File", "Subir Archivo", lang)}
                    </Button>
                    {connectedFileSources.map(provider => (
                      <Button key={provider.key} type="button" size="sm" variant="outline" onClick={() => setCloudPickerTarget({ target: "question", provider })} style={{ fontSize: 11, gap: 4 }}>
                        <FolderOpen style={{ width: 11, height: 11 }} />{w(`From ${provider.label}`, `Desde ${provider.label}`, lang)}
                      </Button>
                    ))}
                  </div>
                  {questionDocs.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12, color: "#1D4ED8" }}>
                      <ExternalLink style={{ width: 12, height: 12 }} />
                      {isUrlAttach(a) ? <a href={a} target="_blank" rel="noreferrer" style={{ flex: 1, color: "#1D4ED8" }}>{attachLabel(a)}</a> : <span style={{ flex: 1 }}>{attachLabel(a)}</span>}
                      <button type="button" onClick={() => setQuestionDocs(prev => prev.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 12, height: 12 }} /></button>
                    </div>
                  ))}
                </div>
              ) : storedQuestionDocs.length > 0 ? (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border) / 0.4)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{w("Attachments / References", "Adjuntos / Referencias", lang)}</div>
                  {storedQuestionDocs.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1D4ED8", marginBottom: 2 }}>
                      <ExternalLink style={{ width: 12, height: 12 }} />{isUrlAttach(a) ? <a href={a} target="_blank" rel="noreferrer" style={{ color: "#1D4ED8" }}>{attachLabel(a)}</a> : attachLabel(a)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Linked Items */}
          <div style={{ marginBottom: 16, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
            {(rfi as { sourceViewpointId?: string | null }).sourceViewpointId && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid hsl(var(--border) / 0.4)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#F0FDFA", color: "#0F766E", border: "1px solid #5EEAD4" }}>
                  <Navigation style={{ width: 12, height: 12 }} />{w("Viewpoint", "Punto de Vista", lang)} {(rfi as { sourceViewpointLabel?: string | null }).sourceViewpointLabel || (rfi as { sourceViewpointId?: string | null }).sourceViewpointId}
                </span>
                {infoEdit ? (
                  <input
                    value={infoVpLabel}
                    onChange={(e) => setInfoVpLabel(e.target.value)}
                    placeholder={(rfi as { sourceViewpointId?: string | null }).sourceViewpointId || w("custom label", "etiqueta personalizada", lang)}
                    style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", minWidth: 180 }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("linked automatically — this RFI came from this viewpoint", "vinculado automáticamente — este RFI proviene de este punto de vista", lang)}</span>
                )}
              </div>
            )}
            {vpImageUrl && (
              <div style={{ marginBottom: 10 }}>
                <img src={vpImageUrl} alt={w("Viewpoint screenshot", "Captura del punto de vista", lang)} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid hsl(var(--border))", display: "block" }} />
              </div>
            )}
            {infoEdit && (
              <div style={{ marginBottom: 12, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--muted) / 0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{w("Image Presentation", "Presentacion de Imagen", lang)}</div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 8 }}>
                  <input type="checkbox" checked={imagePresentation?.includeInCompletePdf !== false} onChange={e => {
                    const include = e.target.checked;
                    const sourceId = imagePresentation?.replacementFileId ?? imagePresentation?.sourceFileId ?? viewpointFile?.id ?? null;
                    setImagePresentation(prev => ({ ...(prev || {}), sourceFileId: prev?.sourceFileId ?? viewpointFile?.id ?? null, includeInCompletePdf: include }));
                    if (sourceId) setPackageItems(prev => prev.map(item => item.fileId === sourceId ? { ...item, include } : item));
                  }} />
                  {w("Show image in Complete RFI PDF", "Mostrar imagen en PDF Completo RFI", lang)}
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <input ref={imageEvidenceInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) beginPendingImage(f, "source"); e.target.value = ""; }} />
                  <input ref={imageReplacementInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) beginPendingImage(f, "replacement"); e.target.value = ""; }} />
                  <Button type="button" size="sm" variant="outline" onClick={() => imageEvidenceInputRef.current?.click()} style={{ fontSize: 11, gap: 4 }}><Upload style={{ width: 11, height: 11 }} />{w("Upload Image", "Subir Imagen", lang)}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => imageReplacementInputRef.current?.click()} style={{ fontSize: 11, gap: 4 }}><RefreshCw style={{ width: 11, height: 11 }} />{w("Replace Image", "Reemplazar Imagen", lang)}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={pasteImageEvidence} style={{ fontSize: 11, gap: 4 }}><Clipboard style={{ width: 11, height: 11 }} />{w("Paste Image", "Pegar Imagen", lang)}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={captureScreenImage} style={{ fontSize: 11, gap: 4 }}><Camera style={{ width: 11, height: 11 }} />{w("Capture Screen", "Capturar Pantalla", lang)}</Button>
                  {imagePresentation?.crop && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setImagePresentation(prev => ({ ...(prev || {}), sourceFileId: prev?.sourceFileId ?? viewpointFile?.id ?? null, includeInCompletePdf: prev?.includeInCompletePdf !== false, crop: null }))} style={{ fontSize: 11, gap: 4 }}><RotateCcw style={{ width: 11, height: 11 }} />{w("Clear Saved Crop", "Borrar Recorte Guardado", lang)}</Button>
                  )}
                </div>
                {imagePresentation?.crop && (
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                    {w("This RFI has saved crop metadata. It will be preserved for exports until you clear it or the dedicated visual crop tool ships.", "Este RFI tiene datos de recorte guardados. Se conservaran para exportaciones hasta que los borre o se publique la herramienta visual dedicada.", lang)}
                  </div>
                )}
                {pendingImage && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border) / 0.5)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{w("Review image before attaching", "Revise la imagen antes de adjuntar", lang)}</div>
                    <img src={pendingImage.url} alt={w("Pending RFI image", "Imagen RFI pendiente", lang)} style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 6, border: "1px solid hsl(var(--border))", display: "block", marginBottom: 8 }} />
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Visual crop tooling is not enabled in this build. Existing saved crop metadata is preserved until the dedicated crop tool ships.", "La herramienta visual de recorte no esta habilitada en esta version. Los datos de recorte guardados se conservan hasta la herramienta dedicada.", lang)}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <Button type="button" size="sm" onClick={async () => { await uploadImageEvidence(pendingImage.file, pendingImage.mode); URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }} disabled={uploadingDoc} style={{ fontSize: 11, gap: 4 }}><Upload style={{ width: 11, height: 11 }} />{w("Attach Image", "Adjuntar Imagen", lang)}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }} style={{ fontSize: 11 }}>{w("Cancel", "Cancelar", lang)}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {infoEdit && packageItems.length > 0 && (
              <div style={{ marginBottom: 12, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--muted) / 0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{w("Complete RFI PDF Package Order", "Orden del Paquete PDF Completo RFI", lang)}</div>
                {packageItems.map((item, i) => (
                  <div key={item.key} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto", gap: 6, alignItems: "center", fontSize: 11, padding: "4px 0", borderTop: i === 0 ? "none" : "1px solid hsl(var(--border) / 0.5)" }}>
                    <input type="checkbox" checked={item.include} onChange={e => setPackageItems(prev => prev.map(p => p.key === item.key ? { ...p, include: e.target.checked } : p))} />
                    <span><FileText style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />{item.label} <span style={{ color: "hsl(var(--muted-foreground))" }}>({attachmentExt(item.label)})</span></span>
                    <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => setPackageItems(prev => { const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next.map((p, order) => ({ ...p, order })); })} style={{ fontSize: 10, padding: "2px 6px" }}><ArrowUp style={{ width: 10, height: 10 }} /></Button>
                    <Button type="button" size="sm" variant="outline" disabled={i === packageItems.length - 1} onClick={() => setPackageItems(prev => { const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next.map((p, order) => ({ ...p, order })); })} style={{ fontSize: 10, padding: "2px 6px" }}><ArrowDown style={{ width: 10, height: 10 }} /></Button>
                  </div>
                ))}
              </div>
            )}
            <LinkedItemsPanel projectId={projectId} entityType="rfi" entityId={rfi.id} canWrite={canWrite} />
          </div>

          <SectionHeader title={w("5. Description of Question", "5. Descripcion de la Pregunta", lang)} />

          {/* Question */}
          <div style={{ marginBottom: 16, padding: "14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>{w("Description of Question", "Descripción de la Pregunta", lang)}</div>
              {canWrite && !infoEdit && (
                <button onClick={startInfoEdit} style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>{w("Edit", "Editar", lang)}</button>
              )}
              {infoEdit && (
                <button onClick={() => handleQuestionAi()} disabled={qAiLoading} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#7C3AED", background: "transparent", border: "1px solid #C4B5FD", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                  {qAiLoading ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <Sparkles style={{ width: 11, height: 11 }} />}
                  {w("AI Assist", "Asistencia IA", lang)}
                </button>
              )}
            </div>
            {infoEdit ? (
              <textarea value={infoQuestion} onChange={e => setInfoQuestion(e.target.value)} rows={4} placeholder={w("Type the question or issue...", "Escriba la pregunta o el problema...", lang)} style={{ ...infoInput, lineHeight: 1.6, resize: "vertical" }} />
            ) : (
              <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{rfi.question || rfi.description || <span style={{ color: "hsl(var(--muted-foreground))" }}>—</span>}</p>
            )}
          </div>

          <SectionHeader title={w("6. Impact Assessment", "6. Evaluacion de Impacto", lang)} />
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{w("Flagged by asker and confirmed in response.", "Senalado por el solicitante y confirmado en la respuesta.", lang)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: infoEdit ? 8 : 16 }}>
            <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 6 }}>{w("Cost Impact", "Impacto en Costo", lang)}</div>
              {infoEdit ? (
                <>
                  {["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"].map(opt => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: "pointer", fontSize: 11 }}>
                      <input type="radio" name="info_cost" checked={infoCost === opt} onChange={() => setInfoCost(opt)} />
                      {opt}
                    </label>
                  ))}
                  {infoCostReasonRequired && (
                    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                      {infoCostAmountRequired && <input value={infoCostAmt} onChange={e => setInfoCostAmt(e.target.value)} placeholder={w("Cost Amount", "Monto de Costo", lang)} style={infoInput} />}
                      <textarea value={infoCostReason} onChange={e => setInfoCostReason(e.target.value)} placeholder={w("Cost Reason / Explanation", "Razon / Explicacion de Costo", lang)} style={{ ...infoInput, minHeight: 64, resize: "vertical" }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{rfi.costImpact || "—"}</div>
                  {rfi.costImpactAmount && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>{rfi.costImpactAmount}</div>}
                  {(rfi as Rfi & { costImpactReason?: string }).costImpactReason && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{(rfi as Rfi & { costImpactReason?: string }).costImpactReason}</div>}
                  {confirmedCost?.costImpact && <div style={{ fontSize: 11, color: "#166534", marginTop: 4 }}>{w("Confirmed:", "Confirmado:", lang)} {confirmedCost.costImpact}{confirmedCost.costImpactAmount ? ` (${confirmedCost.costImpactAmount})` : ""}{confirmedCost.costImpactReason ? ` - ${confirmedCost.costImpactReason}` : ""}</div>}
                </>
              )}
            </div>
            <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 6 }}>{w("Schedule Impact", "Impacto en Programa", lang)}</div>
              {infoEdit ? (
                <>
                  {["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"].map(opt => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: "pointer", fontSize: 11 }}>
                      <input type="radio" name="info_sched" checked={infoSched === opt} onChange={() => setInfoSched(opt)} />
                      {opt}
                    </label>
                  ))}
                  {infoScheduleDaysRequired && (
                    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                      <input value={infoSchedDays} onChange={e => setInfoSchedDays(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={w("Calendar Days", "Dias Calendario", lang)} style={infoInput} />
                      <textarea value={infoSchedReason} onChange={e => setInfoSchedReason(e.target.value)} placeholder={w("Schedule Reason / Explanation", "Razon / Explicacion de Programa", lang)} style={{ ...infoInput, minHeight: 64, resize: "vertical" }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{rfi.scheduleImpact || "—"}</div>
                  {rfi.scheduleImpactDays != null && <div style={{ fontSize: 12, color: "#D97706", marginTop: 2 }}>{rfi.scheduleImpactDays} {w("calendar days", "días calendario", lang)}</div>}
                  {(rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{(rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason}</div>}
                  {confirmedSched?.scheduleImpact && <div style={{ fontSize: 11, color: "#166534", marginTop: 4 }}>{w("Confirmed:", "Confirmado:", lang)} {confirmedSched.scheduleImpact}{confirmedSched.scheduleImpactDays != null ? ` (${confirmedSched.scheduleImpactDays}d)` : ""}{confirmedSched.scheduleImpactReason ? ` - ${confirmedSched.scheduleImpactReason}` : ""}</div>}
                </>
              )}
            </div>
          </div>
          {infoEdit && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={() => setInfoEdit(false)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "transparent", color: "inherit", cursor: "pointer" }}>{w("Cancel", "Cancelar", lang)}</button>
              <button disabled={isUpdating} onClick={() => { updateRfi({ projectId, rfiId: rfi.id, data: {
                subject: infoSubject,
                rfiType: infoType,
                sourceViewpointLabel: infoVpLabel,
                dateRequired: infoDateRequired ? new Date(infoDateRequired).toISOString() : undefined,
                question: infoQuestion,
                costImpact: infoCost,
                costImpactAmount: infoCostAmountRequired ? infoCostAmt : null,
                costImpactReason: infoCostReasonRequired ? infoCostReason : null,
                scheduleImpact: infoSched,
                scheduleImpactDays: infoScheduleDaysRequired && infoSchedDays.trim() && !Number.isNaN(Number(infoSchedDays)) ? Number(infoSchedDays) : null,
                scheduleImpactReason: infoScheduleDaysRequired ? infoSchedReason : null,
                distributionList: infoDist,
                submittedByCompany: infoFromCompany,
                submittedByContact: infoFromContact,
                submittedByAddress: infoFromAddress,
                submittedByPhone: infoFromPhone,
                submittedByEmail: infoFromEmail,
                submittedToCompany: infoToCompany,
                submittedToPerson: infoToPerson,
                submittedToEmail: infoToEmail,
                attachmentsJson: questionDocs,
                attachmentPackageJson: packageItems,
                imagePresentationJson: imagePresentation,
              } }); setInfoEdit(false); }} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 6, border: "none", background: "#1E3A5F", color: "white", cursor: "pointer", opacity: isUpdating ? 0.6 : 1 }}>{isUpdating ? w("Saving...", "Guardando...", lang) : w("Save RFI", "Guardar RFI", lang)}</button>
            </div>
          )}

          {/* Response section */}
          <div style={{ marginBottom: 16, padding: "14px", border: `2px solid ${rfi.answer || rfi.response ? "#16A34A" : "hsl(var(--border))"}`, borderRadius: 8, background: rfi.answer || rfi.response ? "#F0FDF4" : "transparent" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              {rfi.answer || rfi.response ? <CheckCircle2 style={{ width: 15, height: 15, color: "#16A34A" }} /> : <MessageSquare style={{ width: 15, height: 15 }} />}
              {w("Response", "Respuesta", lang)}
              {rfiResponses.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, background: "#DBEAFE", color: "#1D4ED8", padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{rfiResponses.length} {w("response(s)", "respuesta(s)", lang)}</span>}
            </div>

            {/* Responses history list */}
            {!responsesLoading && rfiResponses.length > 0 && (
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {rfiResponses.map((resp, i) => (
                  <div key={resp.id} style={{ background: resp.isConflictOfInterest ? "#FEF3C7" : "#F8FAFC", border: `1px solid ${resp.isConflictOfInterest ? "#F59E0B" : "#E2E8F0"}`, borderRadius: 7, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#1E3A5F" }}>
                        {w("Response", "Respuesta", lang)} {i + 1}
                        {resp.answeredBy && ` — ${resp.answeredBy}`}
                        {resp.answeredByCompany && ` (${resp.answeredByCompany})`}
                      </span>
                      <span style={{ fontSize: 10, color: "#64748B" }}>{fmt(resp.createdAt)}</span>
                    </div>
                    {resp.isConflictOfInterest && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 5, marginBottom: 6, fontSize: 11, color: "#92400E", fontWeight: 600 }}>
                        <AlertTriangle size={12} style={{ flexShrink: 0 }} /> {w("Conflict of interest — logged in audit trail", "Conflicto de interés — registrado en auditoría", lang)}
                      </div>
                    )}
                    <p style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#1E293B" }}>{resp.responseText}</p>
                    {(resp.costImpact || resp.scheduleImpact) && (
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#64748B", flexWrap: "wrap" }}>
                        {resp.costImpact && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><DollarSign size={11} /> {resp.costImpact}{resp.costImpactAmount ? ` (${resp.costImpactAmount})` : ""}{resp.costImpactReason ? ` - ${resp.costImpactReason}` : ""}</span>}
                        {resp.scheduleImpact && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Calendar size={11} /> {resp.scheduleImpact}{resp.scheduleImpactDays != null ? ` (${resp.scheduleImpactDays}d)` : ""}{resp.scheduleImpactReason ? ` - ${resp.scheduleImpactReason}` : ""}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legacy response (before new table) — only show if no new responses but old data exists */}
            {rfiResponses.length === 0 && (rfi.answer || rfi.response) && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{rfi.answer || rfi.response}</p>
                {rfi.answeredBy && <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>{w("Answered by:", "Respondido por:", lang)} <strong>{rfi.answeredBy}</strong> {rfi.dateAnswered ? `· ${fmt(rfi.dateAnswered)}` : ""}</p>}
                {(rfi.responseAttachmentsJson as string[] | null)?.length ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #BBF7D0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 4 }}>{w("Response Documents", "Documentos de Respuesta", lang)}</div>
                    {(rfi.responseAttachmentsJson as string[]).map((doc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1D4ED8", marginBottom: 2 }}>
                        <ExternalLink style={{ width: 12, height: 12 }} />{isUrlAttach(doc) ? <a href={doc} target="_blank" rel="noreferrer" style={{ color: "#1D4ED8" }}>{attachLabel(doc)}</a> : attachLabel(doc)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Add Response button — visible when responses exist and form is hidden */}
            {canWrite && rfi.status !== "closed" && (rfiResponses.length > 0 || rfi.answer || rfi.response) && !showAddResponse && (
              <button
                type="button"
                onClick={() => setShowAddResponse(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px 0", marginTop: 4, fontSize: 13, fontWeight: 600, color: "#1D4ED8", background: "transparent", border: "1.5px dashed #93C5FD", borderRadius: 8, cursor: "pointer" }}
              >
                <Plus style={{ width: 14, height: 14 }} />{w("Add Response", "Agregar Respuesta", lang)}
              </button>
            )}

            {responseFormOpen && (
              <div style={{ borderTop: rfiResponses.length > 0 || rfi.answer || rfi.response ? "1px solid #BBF7D0" : undefined, paddingTop: rfiResponses.length > 0 || rfi.answer || rfi.response ? 12 : 0 }}>
                {isCoi && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "#FFFBEB", border: "1.5px solid #F59E0B", borderRadius: 7, marginBottom: 12 }}>
                    <AlertTriangle size={16} style={{ color: "#92400E", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
                        {w("Warning: You are responding to your own RFI.", "Advertencia: Está respondiendo a su propio RFI.", lang)}
                      </div>
                      <div style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>
                        {w("This has been flagged in the audit trail as a potential conflict of interest.", "Esto se marcará en la auditoría como un posible conflicto de interés.", lang)}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    {w("Official Response / Reason", "Respuesta Oficial / Razón", lang)}
                    <span style={{ fontSize: 10, color: "#DC2626", marginLeft: 4 }}>*</span>
                    <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 400, marginLeft: 6 }}>{w("Required to set status to Responded", "Requerido para marcar como Respondido", lang)}</span>
                  </label>
                  <Button size="sm" variant="outline" onClick={handleAiAssist} disabled={aiAssistLoading}
                    style={{ gap: 5, fontSize: 11, borderColor: "#7C3AED", color: "#7C3AED", flexShrink: 0 }}>
                    {aiAssistLoading ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <Sparkles style={{ width: 11, height: 11 }} />}
                    {w("AI Assist", "Asistencia IA", lang)}
                  </Button>
                </div>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder={w("Type the official response here, or click AI Assist to draft one…", "Escriba la respuesta oficial aquí, o use Asistencia IA para redactar…", lang)}
                  style={{ width: "100%", minHeight: 120, fontSize: 12, borderRadius: 6, border: `1px solid ${!answer.trim() && closingStatus === "responded" ? "#DC2626" : "hsl(var(--border))"}`, padding: "8px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />
                {!answer.trim() && closingStatus === "responded" && (
                  <p style={{ fontSize: 11, color: "#DC2626", marginTop: 3 }}>{w("Official response text is required before setting status to Responded.", "Se requiere texto de respuesta oficial antes de establecer el estado como Respondido.", lang)}</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 3 }}>{w("Answered by", "Respondido por", lang)}</label>
                    <Input value={answeredBy} onChange={e => setAnsweredBy(e.target.value)} style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 3 }}>{w("Update status", "Actualizar estado", lang)}</label>
                    <select value={closingStatus} onChange={e => setClosingStatus(e.target.value)} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                      {statusOptions.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fix 5 — Response documents */}
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{w("Attach Response Documents", "Adjuntar Documentos de Respuesta", lang)}</label>
                  <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
                    {w("Paste a URL, file name from BIMLog, or search project files below.", "Pegue una URL, nombre de archivo de BIMLog o busque archivos del proyecto.", lang)}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Input value={responseDocInput} onChange={e => setResponseDocInput(e.target.value)}
                      placeholder={w("e.g. SK-105 Rev2.pdf or https://docs.example.com/response", "ej. SK-105 Rev2.pdf o https://docs.example.com/respuesta", lang)}
                      style={{ fontSize: 12, flex: 1 }}
                      onKeyDown={e => { if (e.key === "Enter" && responseDocInput.trim()) { setResponseDocs(prev => [...prev, responseDocInput.trim()]); setResponseDocInput(""); e.preventDefault(); } }} />
                    <button type="button" title={w("Search project files", "Buscar archivos del proyecto", lang)}
                      onClick={() => setShowFileSearch(!showFileSearch)}
                      style={{ padding: "0 8px", border: "1px solid hsl(var(--border))", borderRadius: 6, background: showFileSearch ? "hsl(var(--primary))" : "transparent", cursor: "pointer", color: showFileSearch ? "white" : "hsl(var(--muted-foreground))" }}>
                      <Search style={{ width: 13, height: 13 }} />
                    </button>
                    <Button size="sm" variant="outline" onClick={() => { if (responseDocInput.trim()) { setResponseDocs(prev => [...prev, responseDocInput.trim()]); setResponseDocInput(""); } }} style={{ fontSize: 11 }}>
                      {w("Add", "Agregar", lang)}
                    </Button>
                    <input ref={rAttachFileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f, url => setResponseDocs(prev => [...prev, url])); e.target.value = ""; }} />
                    <Button size="sm" variant="outline" disabled={uploadingDoc} onClick={() => rAttachFileRef.current?.click()} style={{ fontSize: 11, gap: 4 }}>
                      {uploadingDoc ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <FileText style={{ width: 11, height: 11 }} />}{w("Upload", "Subir", lang)}
                    </Button>
                    {connectedFileSources.map(provider => (
                      <Button key={provider.key} size="sm" variant="outline" onClick={() => setCloudPickerTarget({ target: "response", provider })} style={{ fontSize: 11, gap: 4 }}>
                        <FolderOpen style={{ width: 11, height: 11 }} />{w(`From ${provider.label}`, `Desde ${provider.label}`, lang)}
                      </Button>
                    ))}
                  </div>
                  {showFileSearch && (
                    <div style={{ position: "relative" }}>
                      <FileSearchDropdown
                        files={files || []}
                        onSelect={(name) => { setResponseDocs(prev => [...prev, name]); setShowFileSearch(false); }}
                        onClose={() => setShowFileSearch(false)}
                      />
                    </div>
                  )}
                  {responseDocs.map((doc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12 }}>
                      <ExternalLink style={{ width: 12, height: 12, color: "#1D4ED8" }} />
                      {isUrlAttach(doc) ? <a href={doc} target="_blank" rel="noreferrer" style={{ flex: 1, color: "#1D4ED8" }}>{attachLabel(doc)}</a> : <span style={{ flex: 1 }}>{attachLabel(doc)}</span>}
                      <button onClick={() => setResponseDocs(prev => prev.filter((_, j) => j !== i))} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 11, height: 11 }} /></button>
                    </div>
                  ))}
                </div>

                {/* Impact update */}
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 12, marginBottom: 2 }}>{w("This response confirms the Impact shown above.", "Esta respuesta confirma el Impacto mostrado arriba.", lang)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{w("Cost Impact", "Impacto Costo", lang)}</label>
                    {["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"].map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: "pointer", fontSize: 11 }}>
                        <input type="radio" name="resp_cost" checked={costImpact === opt} onChange={() => setCostImpact(opt)} />
                        {opt}
                      </label>
                    ))}
                    {responseCostReasonRequired && (
                      <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                        {responseCostAmountRequired && <Input value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder={w("Cost Amount", "Monto de Costo", lang)} style={{ fontSize: 11 }} />}
                        <textarea value={costReason} onChange={e => setCostReason(e.target.value)} placeholder={w("Cost Reason / Explanation", "Razon / Explicacion de Costo", lang)} style={{ width: "100%", minHeight: 60, fontSize: 11, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "6px 8px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{w("Schedule Impact", "Impacto Programa", lang)}</label>
                    {["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"].map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: "pointer", fontSize: 11 }}>
                        <input type="radio" name="resp_sched" checked={schedImpact === opt} onChange={() => setSchedImpact(opt)} />
                        {opt}
                      </label>
                    ))}
                    {responseScheduleDaysRequired && (
                      <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                        <Input type="number" value={schedDays} onChange={e => setSchedDays(e.target.value)} placeholder={w("Calendar Days", "Dias Calendario", lang)} style={{ fontSize: 11 }} />
                        <textarea value={schedReason} onChange={e => setSchedReason(e.target.value)} placeholder={w("Schedule Reason / Explanation", "Razon / Explicacion de Programa", lang)} style={{ width: "100%", minHeight: 60, fontSize: 11, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "6px 8px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Revision history */}
          {rfi.parentRfiId && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#EDE9FE", borderRadius: 8, border: "1px solid #C4B5FD" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>
                {w("This is a revision.", "Esta es una revisión.", lang)} {w("Parent RFI ID:", "ID del RFI original:", lang)} #{rfi.parentRfiId} · {w("Revision #", "Revisión #", lang)}{rfi.revisionNumber}
              </div>
            </div>
          )}

          <SectionHeader title={w("7. Distribution and Email", "7. Distribución y Email", lang)} />

          {/* Distribution list (CC) */}
          {(infoEdit || (rfi.distributionList as string[] | null)?.length) ? (
            <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 6 }}>{w("Distribution List (CC)", "Lista de Distribución (CC)", lang)}</div>
              {infoEdit ? (
                <>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={distInput} onChange={e => setDistInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && distInput.trim()) { setInfoDist(prev => [...prev, distInput.trim()]); setDistInput(""); e.preventDefault(); } }} placeholder={w("Email or name to copy…", "Correo o nombre a copiar…", lang)} style={{ ...infoInput, flex: 1 }} />
                    <button type="button" onClick={() => { if (distInput.trim()) { setInfoDist(prev => [...prev, distInput.trim()]); setDistInput(""); } }} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "transparent", color: "inherit", cursor: "pointer" }}>{w("Add", "Agregar", lang)}</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {infoDist.map((e, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 8px", background: "hsl(var(--secondary))", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Mail style={{ width: 10, height: 10 }} />{parseDistEntry(e).display}
                        <button type="button" onClick={() => setInfoDist(prev => prev.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 0, marginLeft: 2 }}>×</button>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(rfi.distributionList as string[]).map(e => {
                    const parsed = parseDistEntry(e);
                    return (
                      <span key={e} style={{ fontSize: 11, padding: "3px 8px", background: parsed.isExternal ? "#E0F2FE" : "hsl(var(--secondary))", borderRadius: 12, display: "flex", alignItems: "center", gap: 4, border: parsed.isExternal ? "1px solid #BAE6FD" : "none" }}>
                        {parsed.isExternal ? <UserPlus style={{ width: 10, height: 10, color: "#0369A1" }} /> : <Mail style={{ width: 10, height: 10 }} />}
                        {parsed.display}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
          {/* Email sending and accountability */}
          <div style={{ marginBottom: 16, padding: "14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Send style={{ width: 12, height: 12 }} />{w("Email / Sending", "Email / Envío", lang)}
            </div>

            {rfi.sendStatus === "sent" ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
                <PenLine style={{ width: 14, height: 14, color: "#B45309", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "#92400E" }}>
                  <span style={{ fontWeight: 700 }}>{w("Manually marked as sent", "Marcado manualmente como enviado", lang)}</span>
                  {rfi.sentAt && <span> · {fmt(rfi.sentAt)}</span>}
                  <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>{w("Self-reported by the author. BIMLog did not send this email.", "Auto-reportado por el autor. BIMLog no envió este correo.", lang)}</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
                  {w("Not sent yet. Compose the email here, then send through your connected SendGrid account or copy it into your email client and mark it as sent to start the response clock.", "Aún no enviado. Redacte el correo aqui, luego envielo con su cuenta SendGrid conectada o copielo a su cliente de correo y marquelo como enviado para iniciar el reloj de respuesta.", lang)}
                  <div style={{ marginTop: 4, fontSize: 11, color: "#B45309" }}>
                    {w("AI text assist uses AI credits and does not read attached files unless you explicitly use file AI.", "La asistencia IA de texto usa creditos IA y no lee adjuntos salvo que use explicitamente IA de archivos.", lang)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: showSendPreview ? 10 : 0 }}>
                  <Button size="sm" onClick={() => { const next = !showSendPreview; setShowSendPreview(next); if (next) setShowContextInput(true); }} style={{ gap: 5, fontSize: 11 }}>
                    <Mail style={{ width: 12, height: 12 }} />{showSendPreview ? w("Hide email", "Ocultar correo", lang) : w("Compose email", "Redactar correo", lang)}
                  </Button>
                  {canWrite && rfi.status !== "closed" && sgConnected === true && (
                    <Button size="sm" onClick={handleSendReal} disabled={sending || !rfi.submittedToEmail}
                      title={!rfi.submittedToEmail ? w("Set the Submitted To email first", "Defina el correo del destinatario primero", lang) : undefined}
                      style={{ gap: 5, fontSize: 11 }}>
                      {sending ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Send style={{ width: 12, height: 12 }} />}
                      {w("Send via SendGrid", "Enviar por SendGrid", lang)}
                    </Button>
                  )}
                  {canWrite && rfi.status !== "closed" && (
                    <Button size="sm" variant={sgConnected === true ? "outline" : "default"} onClick={handleMarkSent} disabled={marking} style={{ gap: 5, fontSize: 11 }}>
                      {marking ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Send style={{ width: 12, height: 12 }} />}
                      {w("Mark as Sent", "Marcar como Enviado", lang)}
                    </Button>
                  )}
                  {sgConnected === false && (
                    <button type="button" onClick={() => setPage("/profile")} style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                      {w("Set up email sending", "Configurar envío de correo", lang)}
                    </button>
                  )}
                </div>
                {sgConnected === false && !hideSgNudge && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "8px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
                    <Mail style={{ width: 14, height: 14, color: "#1D4ED8", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#1E3A5F", flex: 1 }}>
                      {w("Connect your own SendGrid account to send RFIs directly from BIMLog — no copy-paste.", "Conecte su cuenta de SendGrid para enviar RFIs directamente desde BIMLog — sin copiar y pegar.", lang)}
                    </span>
                    <Button size="sm" onClick={() => setPage("/profile")} style={{ fontSize: 11, gap: 4, flexShrink: 0 }}>{w("Connect", "Conectar", lang)}</Button>
                    <button type="button" title={w("Don't remind me", "No recordarme", lang)} onClick={() => { localStorage.setItem("bimlog-hide-sendgrid-nudge", "1"); setHideSgNudge(true); }}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B", flexShrink: 0, padding: 2 }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )}
                {showSendPreview && (
                  <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", background: "hsl(var(--muted) / 0.4)", borderBottom: "1px solid hsl(var(--border))" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: 5 }}>
                        {aiPreview
                          ? <><Sparkles style={{ width: 12, height: 12, color: "#7C3AED" }} />{w("AI-drafted email — copy-paste into your client", "Correo redactado por IA — copie en su cliente", lang)}</>
                          : <><Mail style={{ width: 12, height: 12 }} />{w("Draft email — type your description, then Generate Email with AI", "Borrador de correo — escriba su descripcion, luego Generar Email con IA", lang)}</>}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button variant="outline" size="sm" onClick={() => setShowContextInput(v => !v)} style={{ gap: 5, fontSize: 11, height: 26 }}>
                          <Plus style={{ width: 12, height: 12 }} />{showContextInput ? w("Hide Email Description", "Ocultar Descripción", lang) : w("Description of Email", "Descripción de Email", lang)}
                        </Button>
                        <Button size="sm" onClick={() => void generatePreview()} disabled={previewLoading} style={{ gap: 5, fontSize: 11, height: 26 }}>
                          {previewLoading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Sparkles style={{ width: 12, height: 12 }} />}
                          {aiPreview ? w("Regenerate Email with AI", "Regenerar Email con IA", lang) : w("Generate Email with AI", "Generar Email con IA", lang)}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopyPreview} disabled={previewLoading} style={{ gap: 5, fontSize: 11, height: 26 }}>
                          {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                          {copied ? w("Copied", "Copiado", lang) : w("Copy", "Copiar", lang)}
                        </Button>
                      </div>
                    </div>
                    {showContextInput && (
                      <div style={{ padding: "8px 10px", borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted) / 0.2)" }}>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{w("Description of Email", "Descripción de Email", lang)}</label>
                        <textarea
                          value={userContext}
                          onChange={e => setUserContext(e.target.value)}
                          placeholder={w("Type your message or context here, then click Generate Email with AI...", "Escriba su mensaje o contexto aqui, luego pulse Generar Email con IA...", lang)}
                          style={{ width: "100%", minHeight: 72, fontSize: 11, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "6px 8px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </div>
                    )}
                    {previewFailed && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 11, color: "#B45309", background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
                        <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0 }} />{w("AI draft unavailable — using basic template.", "Borrador de IA no disponible — usando plantilla básica.", lang)}
                      </div>
                    )}
                    {previewLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 12px", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                        <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />{w("Drafting email…", "Redactando correo…", lang)}
                      </div>
                    ) : (
                      <>
                        {!aiPreview && (
                          <div style={{ padding: "6px 12px", fontSize: 11, color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted) / 0.2)", borderBottom: "1px solid hsl(var(--border))" }}>
                            {w("Basic template shown below. Type your email description above and click Generate Email with AI to improve it.", "Plantilla basica abajo. Escriba la descripcion del email arriba y pulse Generar Email con IA para mejorarla.", lang)}
                          </div>
                        )}
                        <pre style={{ margin: 0, padding: "12px", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "hsl(var(--foreground))" }}>{previewText}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save Response — the final action for the whole page, below the email */}
          {responseFormOpen && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 14, borderTop: "1px solid hsl(var(--border))" }}>
              {(rfiResponses.length > 0 || rfi.answer || rfi.response) && (
                <Button variant="outline" size="sm" onClick={() => setShowAddResponse(false)} style={{ fontSize: 12 }}>
                  {w("Cancel", "Cancelar", lang)}
                </Button>
              )}
              <Button onClick={handleSaveResponse} disabled={isUpdating} style={{ fontSize: 13, gap: 6, padding: "8px 22px" }}>
                {isUpdating ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <CheckCircle2 style={{ width: 15, height: 15 }} />}
                {w("Save Response", "Guardar Respuesta", lang)}
              </Button>
            </div>
          )}
        </div>
      </div>
      {cloudPickerTarget && (
        <CloudPicker
          provider={cloudPickerTarget.provider}
          projectId={projectId}
          rfiId={rfi.id}
          lang={lang}
          onAttached={url => { if (cloudPickerTarget.target === "question") setQuestionDocs(prev => [...prev, url]); else setResponseDocs(prev => [...prev, url]); }}
          onClose={() => setCloudPickerTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
export function RfiActionBar({ actions, handlers, loading }: { actions: RfiActionDefinition[]; handlers: RfiCanonicalActions; loading?: boolean }) {
  const seen = new Set<RfiActionKey>();
  const uniqueActions = actions.filter(action => {
    if (seen.has(action.key)) return false;
    seen.add(action.key);
    return true;
  });
  return (
    <div className="rfi-actions" style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      {uniqueActions.map(action => (
        <Button
          key={action.key}
          type="button"
          size="sm"
          variant={action.variant === "primary" ? "default" : "outline"}
          disabled={loading}
          onClick={handlers[action.key]}
          style={{ gap: 5, fontSize: 11, color: action.variant === "danger" ? "#DC2626" : undefined, borderColor: action.variant === "danger" ? "#FCA5A5" : undefined }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function CanonicalField({ label, value, editable, onChange, full, multiline, type = "text" }: {
  label: string;
  value: string;
  editable: boolean;
  onChange?: (value: string) => void;
  full?: boolean;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <div className={full ? "rfi-field full" : "rfi-field"} style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{label}</label>
      {editable ? (
        multiline ? (
          <textarea value={value} onChange={e => onChange?.(e.target.value)} style={{ width: "100%", minHeight: 76, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "7px 9px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        ) : (
          <Input type={type} value={value} onChange={e => onChange?.(e.target.value)} style={{ fontSize: 12 }} />
        )
      ) : (
        <div style={{ minHeight: 28, display: "flex", alignItems: "center", fontSize: 13, color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>{value || "—"}</div>
      )}
    </div>
  );
}

function CanonicalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-rfi-canonical-section={title}>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

export function RfiCanonicalForm({
  lang, mode, recordState, values, permissions, references, attachments, imagePresentation, packageItems, responses,
  loading, actions, onChange, onAddReference, onRemoveReference, onUploadFile, onGenerateQuestionAi, onGenerateEmailAi,
  onCopyEmail, actionMatrix,
}: RfiCanonicalFormProps) {
  const editable = mode === "create" || mode === "edit";
  const matrix = actionMatrix ?? getRfiCanonicalActionMatrix({ mode, recordState, permissions, lang });
  const costNeedsReason = values.costImpact === "Cost Increase TBD" || values.costImpact === "Cost Increase Known" || values.costImpact === "Cost Decrease";
  const costNeedsAmount = values.costImpact === "Cost Increase Known" || values.costImpact === "Cost Decrease";
  const scheduleNeedsFields = values.scheduleImpact === "Increase in Calendar Days" || values.scheduleImpact === "Decrease in Calendar Days";
  const allReferences = [...references, ...attachments];
  return (
    <div className="rfi-canonical-form" style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ background: "hsl(var(--background))", borderRadius: 12, border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>{recordState === "new" ? w("New RFI", "Nuevo RFI", lang) : w("Existing RFI", "RFI Existente", lang)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {values.number && <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{values.number}</span>}
              <span className={`badge ${STATUS_BADGE[values.status] ?? "badge-gray"}`}>{values.status || w("Draft", "Borrador", lang)}</span>
              <span className={`badge ${PRIORITY_BADGE[values.priority] ?? "badge-gray"}`}>{values.priority || "medium"}</span>
              {values.rfiType && <span className="badge badge-blue">{values.rfiType}</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{values.subject || w("Untitled RFI", "RFI sin titulo", lang)}</div>
          </div>
          <RfiActionBar actions={matrix} handlers={actions} loading={!!loading?.saving} />
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <CanonicalSection title={w("1. Header / RFI Status", "1. Encabezado / Estado RFI", lang)}>
            <FormGrid>
              <CanonicalField label={w("RFI number", "Numero RFI", lang)} value={values.number || w("Assigned after save", "Asignado al guardar", lang)} editable={false} />
              <CanonicalField label={w("Project", "Proyecto", lang)} value={values.projectName || ""} editable={false} />
              <CanonicalField label={w("Subject/title", "Asunto/titulo", lang)} value={values.subject} editable={editable} onChange={v => onChange("subject", v)} full />
              <CanonicalField label={w("Status", "Estado", lang)} value={values.status} editable={false} />
              <CanonicalField label={w("Priority", "Prioridad", lang)} value={values.priority} editable={editable} onChange={v => onChange("priority", v)} />
              <CanonicalField label={w("Type", "Tipo", lang)} value={values.rfiType} editable={editable} onChange={v => onChange("rfiType", v)} />
              <CanonicalField label={w("Date Requested", "Fecha Solicitada", lang)} value={values.dateRequested || ""} editable={editable} onChange={v => onChange("dateRequested", v)} type="date" />
              <CanonicalField label={w("Date Required", "Fecha Requerida", lang)} value={values.dateRequired || ""} editable={editable} onChange={v => onChange("dateRequired", v)} type="date" />
              <CanonicalField label={w("Days Outstanding", "Dias Pendientes", lang)} value={values.daysOutstanding || ""} editable={false} />
              <CanonicalField label={w("Date Answered", "Fecha Respondido", lang)} value={values.dateAnswered || ""} editable={false} />
            </FormGrid>
          </CanonicalSection>
          <CanonicalSection title={w("2. Submitted By", "2. Enviado Por", lang)}>
            <FormGrid>
              <CanonicalField label={w("Company", "Empresa", lang)} value={values.submittedByCompany} editable={editable} onChange={v => onChange("submittedByCompany", v)} />
              <CanonicalField label={w("Contact/person", "Contacto/persona", lang)} value={values.submittedByContact} editable={editable} onChange={v => onChange("submittedByContact", v)} />
              <CanonicalField label={w("Address", "Direccion", lang)} value={values.submittedByAddress} editable={editable} onChange={v => onChange("submittedByAddress", v)} full />
              <CanonicalField label={w("Phone", "Telefono", lang)} value={values.submittedByPhone} editable={editable} onChange={v => onChange("submittedByPhone", v)} />
              <CanonicalField label={w("Email", "Correo", lang)} value={values.submittedByEmail} editable={editable} onChange={v => onChange("submittedByEmail", v)} />
            </FormGrid>
          </CanonicalSection>
          <CanonicalSection title={w("3. Submitted To", "3. Enviado A", lang)}>
            <FormGrid>
              <CanonicalField label={w("Company", "Empresa", lang)} value={values.submittedToCompany} editable={editable} onChange={v => onChange("submittedToCompany", v)} />
              <CanonicalField label={w("Contact/person", "Contacto/persona", lang)} value={values.submittedToPerson} editable={editable} onChange={v => onChange("submittedToPerson", v)} />
              <CanonicalField label={w("Address", "Direccion", lang)} value={values.submittedToAddress || ""} editable={editable} onChange={v => onChange("submittedToAddress", v)} full />
              <CanonicalField label={w("Phone", "Telefono", lang)} value={values.submittedToPhone || ""} editable={editable} onChange={v => onChange("submittedToPhone", v)} />
              <CanonicalField label={w("Email", "Correo", lang)} value={values.submittedToEmail} editable={editable} onChange={v => onChange("submittedToEmail", v)} />
            </FormGrid>
          </CanonicalSection>
          <CanonicalSection title={w("4. Reference Information / Attachments", "4. Informacion de Referencia / Adjuntos", lang)}>
            <FormGrid>
              <CanonicalField label={w("Drawing number", "Numero de Plano", lang)} value={values.drawingNumber} editable={editable} onChange={v => onChange("drawingNumber", v)} />
              <CanonicalField label={w("Drawing title", "Titulo del Plano", lang)} value={values.drawingTitle} editable={editable} onChange={v => onChange("drawingTitle", v)} />
              <CanonicalField label={w("Spec section", "Seccion de Especificacion", lang)} value={values.specSection} editable={editable} onChange={v => onChange("specSection", v)} />
              <CanonicalField label={w("Detail number", "Numero de Detalle", lang)} value={values.detailNumber} editable={editable} onChange={v => onChange("detailNumber", v)} />
              <CanonicalField label={w("Note number", "Numero de Nota", lang)} value={values.noteNumber} editable={editable} onChange={v => onChange("noteNumber", v)} />
              <CanonicalField label={w("Location", "Ubicacion", lang)} value={values.locationDescription} editable={editable} onChange={v => onChange("locationDescription", v)} full />
            </FormGrid>
            {editable && <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}><Input value={values.referenceInput || ""} onChange={e => onChange("referenceInput", e.target.value)} placeholder={w("Reference/file name/URL", "Referencia/nombre/URL", lang)} style={{ flex: "1 1 260px", fontSize: 12 }} /><Button type="button" size="sm" variant="outline" onClick={onAddReference}>{w("Add Reference", "Agregar Referencia", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={onUploadFile}>{loading?.uploading ? w("Uploading...", "Subiendo...", lang) : w("Upload File", "Subir Archivo", lang)}</Button></div>}
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>{allReferences.length === 0 ? <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No references or attachments.", "Sin referencias o adjuntos.", lang)}</span> : allReferences.map((item, index) => <div key={`${item}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><FileText style={{ width: 12, height: 12 }} /><span style={{ flex: 1 }}>{attachLabel(item)}</span>{editable && <Button type="button" size="sm" variant="outline" onClick={() => onRemoveReference(index)} style={{ color: "#DC2626", borderColor: "#FCA5A5" }}>{w("Remove", "Quitar", lang)}</Button>}</div>)}</div>
            {(imagePresentation || packageItems.length > 0) && <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}>{imagePresentation && <div>{w("Viewpoint image is included in the RFI package.", "Imagen de punto de vista incluida en el paquete RFI.", lang)}</div>}{packageItems.length > 0 && <div>{w("Package order:", "Orden del paquete:", lang)} {packageItems.map(item => item.label).join(", ")}</div>}</div>}
          </CanonicalSection>
          <CanonicalSection title={w("5. Description of Question", "5. Descripcion de la Pregunta", lang)}>
            <CanonicalField label={w("Question", "Pregunta", lang)} value={values.question} editable={editable} onChange={v => onChange("question", v)} full multiline />
            {editable && <Button type="button" size="sm" variant="outline" onClick={onGenerateQuestionAi} style={{ marginTop: 8, gap: 5 }}><Sparkles style={{ width: 12, height: 12 }} />{w("Generate Question with AI", "Generar Pregunta con IA", lang)}</Button>}
            <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>{w("Text assist uses AI credits and does not read attached files unless file-reading AI is explicitly used.", "La asistencia de texto usa creditos IA y no lee adjuntos salvo que se use IA de lectura de archivos explicitamente.", lang)}</p>
          </CanonicalSection>
          <CanonicalSection title={w("6. Impact Assessment", "6. Evaluacion de Impacto", lang)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
                <CanonicalField label={w("Cost Impact", "Impacto en Costo", lang)} value={values.costImpact} editable={editable} onChange={v => onChange("costImpact", v)} />
                {costNeedsAmount && <CanonicalField label={w("Cost Amount", "Monto de Costo", lang)} value={values.costImpactAmount} editable={editable} onChange={v => onChange("costImpactAmount", v)} />}
                {costNeedsReason && <CanonicalField label={w("Cost Reason / Explanation", "Razon / Explicacion de Costo", lang)} value={values.costImpactReason} editable={editable} onChange={v => onChange("costImpactReason", v)} multiline />}
              </div>
              <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
                <CanonicalField label={w("Schedule Impact", "Impacto en Programa", lang)} value={values.scheduleImpact} editable={editable} onChange={v => onChange("scheduleImpact", v)} />
                {scheduleNeedsFields && <CanonicalField label={w("Calendar Days", "Dias Calendario", lang)} value={values.scheduleImpactDays} editable={editable} onChange={v => onChange("scheduleImpactDays", v)} />}
                {scheduleNeedsFields && <CanonicalField label={w("Schedule Reason / Explanation", "Razon / Explicacion de Programa", lang)} value={values.scheduleImpactReason} editable={editable} onChange={v => onChange("scheduleImpactReason", v)} multiline />}
              </div>
            </div>
          </CanonicalSection>
          <CanonicalSection title={w("7. Distribution / Email / Responses", "7. Distribucion / Email / Respuestas", lang)}>
            <CanonicalField label={w("Distribution", "Distribucion", lang)} value={values.distributionList.join(", ")} editable={editable} onChange={v => onChange("distributionList", v)} full />
            <CanonicalField label={w("Description of Email", "Descripcion de Email", lang)} value={values.emailDescription || ""} editable={editable} onChange={v => onChange("emailDescription", v)} full multiline />
            {editable && <Button type="button" size="sm" variant="outline" onClick={onGenerateEmailAi} style={{ marginTop: 8, gap: 5 }}><Sparkles style={{ width: 12, height: 12 }} />{w("Generate Email with AI", "Generar Email con IA", lang)}</Button>}
            {values.emailDraft && <div style={{ marginTop: 8 }}><Button type="button" size="sm" variant="outline" onClick={onCopyEmail} style={{ marginBottom: 6, gap: 5 }}><Copy style={{ width: 12, height: 12 }} />{w("Copy Email", "Copiar Email", lang)}</Button><pre style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12 }}>{values.emailDraft}</pre></div>}
            {responses.length > 0 && <div style={{ marginTop: 10, display: "grid", gap: 8 }}>{responses.map((response, index) => <div key={response.id ?? index} style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}><strong>{w("Response", "Respuesta", lang)} {index + 1}</strong>{response.by && <span> - {response.by}</span>}<p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{response.text}</p></div>)}</div>}
            {permissions.canRespond && <div style={{ marginTop: 10 }}><CanonicalField label={w("Official Response", "Respuesta Oficial", lang)} value={values.responseText || ""} editable={editable} onChange={v => onChange("responseText", v)} full multiline />{matrix.some(action => action.key === "save-response") && <RfiActionBar actions={matrix.filter(action => action.key === "save-response")} handlers={actions} loading={!!loading?.response} />}</div>}
          </CanonicalSection>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 2, paddingBottom: 6, borderBottom: "2px solid hsl(var(--primary) / 0.15)", display: "flex", alignItems: "center" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginTop: 10 }}>
      {children}
    </div>
  );
}

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "span 2" : undefined, display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{label}</label>
      {children}
    </div>
  );
}

// Google Drive file picker — browse the user's connected Drive and import a file
// as an RFI attachment. A transient modal (the RFI itself stays a full page).
type CloudItem = { name: string; type: "file" | "folder"; ref: string; mimeType?: string; size?: number };

function CloudPicker({ provider, projectId, rfiId, lang, onAttached, onClose }: {
  provider: FileSourceProvider; projectId: number; rfiId?: number; lang: string;
  onAttached: (url: string) => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CloudItem[]>([]);
  const [crumbs, setCrumbs] = useState<Array<{ name: string; ref: string }>>([{ name: provider.label, ref: "" }]);
  const [loading, setLoading] = useState(false);
  const [importingRef, setImportingRef] = useState<string | null>(null);
  const tok = () => JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
  const current = crumbs[crumbs.length - 1];

  const load = async (ref = current.ref, query = q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ref, q: query });
      const r = await fetch(`/api/v1/me/connections/${provider.param}/browse?${params.toString()}`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Failed to load files"); }
      const d = await r.json() as { items?: CloudItem[] };
      setItems(d.items || []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Failed to load files", "Error al cargar archivos", lang), variant: "destructive" });
      setItems([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load("", ""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [provider.param]);

  const openFolder = async (item: CloudItem) => {
    const next = [...crumbs, { name: item.name, ref: item.ref }];
    setCrumbs(next);
    setQ("");
    await load(item.ref, "");
  };

  const pick = async (item: CloudItem) => {
    setImportingRef(item.ref);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/from-cloud`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ provider: provider.param, ref: item.ref, fileName: item.name, mimeType: item.mimeType, rfiId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Import failed"); }
      const { downloadUrl } = await r.json() as { downloadUrl: string };
      onAttached(downloadUrl);
      toast({ title: w(`Attached from ${provider.label}`, `Adjuntado desde ${provider.label}`, lang) });
      onClose();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Import failed", "Error al importar", lang), variant: "destructive" });
    } finally { setImportingRef(null); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "hsl(var(--background))", borderRadius: 12, border: "1px solid hsl(var(--border))", width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{w(`Attach from ${provider.label}`, `Adjuntar desde ${provider.label}`, lang)}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: "8px 18px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {crumbs.map((c, i) => (
            <button key={`${c.ref}-${i}`} type="button" onClick={() => { const next = crumbs.slice(0, i + 1); setCrumbs(next); setQ(""); void load(c.ref, ""); }}
              style={{ border: "none", background: "transparent", color: i === crumbs.length - 1 ? "hsl(var(--foreground))" : "#1D4ED8", fontSize: 11, fontWeight: i === crumbs.length - 1 ? 700 : 600, cursor: "pointer", padding: 0 }}>
              {i > 0 ? " / " : ""}{c.name}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 6 }}>
          <Input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") load(current.ref, q); }} placeholder={w("Search files...", "Buscar archivos...", lang)} style={{ fontSize: 12, flex: 1 }} />
          <Button size="sm" onClick={() => load(current.ref, q)} disabled={loading} style={{ fontSize: 11, gap: 4 }}>
            {loading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Search style={{ width: 12, height: 12 }} />}{w("Search", "Buscar", lang)}
          </Button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 10px" }}>
          {loading && items.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("Loading...", "Cargando...", lang)}</div>}
          {!loading && items.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No files found.", "No se encontraron archivos.", lang)}</div>}
          {items.map(item => (
            <button key={item.ref} onClick={() => item.type === "folder" ? void openFolder(item) : void pick(item)} disabled={!!importingRef} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--muted) / 0.5)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {item.type === "folder" ? <FolderOpen style={{ width: 14, height: 14, color: "#1D4ED8", flexShrink: 0 }} /> : <FileText style={{ width: 14, height: 14, color: "#1D4ED8", flexShrink: 0 }} />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
              {importingRef === item.ref && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
