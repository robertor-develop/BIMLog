import { useState, useMemo, useRef } from "react";
import {
  useListRfis, useCreateRfi, useUpdateRfi, useReviseRfi, useGenerateRfiQuestion,
  useListMembers,
} from "@workspace/api-client-react";
import type { Rfi } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Plus, X, ChevronDown, ChevronUp, FileText, Download,
  LayoutList, Table2, Sparkles, Clock, AlertTriangle, CheckCircle2,
  RefreshCw, ExternalLink, User, Building2, Mail, Phone, MapPin, Loader2,
} from "lucide-react";
import { format, differenceInDays, isValid, parseISO } from "date-fns";

// ─── helpers ────────────────────────────────────────────────────────────────
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

function getBallInCourt(rfi: Rfi): { label: string; color: string } | null {
  if (rfi.status === "closed") return null;
  if (rfi.status === "responded") {
    return {
      label: rfi.submittedByCompany || rfi.createdByName || "Submitter",
      color: "#7C3AED",
    };
  }
  return {
    label: rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer",
    color: "#0369A1",
  };
}

function daysColor(days: number, isOverdue: boolean) {
  if (isOverdue) return "#DC2626";
  if (days > 7) return "#D97706";
  return "#16A34A";
}

// ─── main export ─────────────────────────────────────────────────────────────
export function RfisTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { lang } = useI18n();
  const { getLabel, getOptions } = useConfig();
  const { user } = useAuthStore();
  const { data: rfis, isLoading } = useListRfis(projectId);
  const { data: members } = useListMembers(projectId);
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "log">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRfi, setSelectedRfi] = useState<Rfi | null>(null);
  const [revising, setRevising] = useState<Rfi | null>(null);

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

  const handleExportCsv = () => {
    if (!rfis || rfis.length === 0) return;
    const headers = [
      "RFI #", "Subject", "Status", "Priority", "Date Requested", "Date Required",
      "Submitted By Company", "Submitted By Contact", "Submitted To Company", "Submitted To Person",
      "Drawing #", "Spec Section", "Cost Impact", "Schedule Impact", "Schedule Impact Days",
      "Ball In Court", "Days Outstanding", "Answer"
    ];
    const rows = rfis.map(r => {
      const bic = getBallInCourt(r);
      const days = differenceInDays(new Date(), new Date(r.createdAt));
      return [
        r.number, r.subject, r.status, r.priority,
        fmt(r.dateRequested || r.createdAt), fmt(r.dateRequired || r.dueDate),
        r.submittedByCompany || "", r.submittedByContact || "",
        r.submittedToCompany || "", r.submittedToPerson || "",
        r.drawingNumber || "", r.specSection || "",
        r.costImpact || "", r.scheduleImpact || "",
        r.scheduleImpactDays != null ? String(r.scheduleImpactDays) : "",
        bic?.label || "", String(days), r.answer || r.response || "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `RFI-Log-Project-${projectId}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: w("RFI log exported", "Log de RFI exportado", lang) });
  };

  const handleExportPdf = async (rfi: Rfi) => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusOptions = getOptions("rfi_status");

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
          {/* View toggle */}
          <div style={{ display: "flex", border: "1px solid hsl(var(--border))", borderRadius: 6, overflow: "hidden" }}>
            <button onClick={() => setView("list")} style={{ padding: "5px 10px", background: view === "list" ? "hsl(var(--primary))" : "transparent", color: view === "list" ? "white" : "hsl(var(--muted-foreground))", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <LayoutList style={{ width: 13, height: 13 }} />{w("List", "Lista", lang)}
            </button>
            <button onClick={() => setView("log")} style={{ padding: "5px 10px", background: view === "log" ? "hsl(var(--primary))" : "transparent", color: view === "log" ? "white" : "hsl(var(--muted-foreground))", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <Table2 style={{ width: 13, height: 13 }} />{w("Log", "Registro", lang)}
            </button>
          </div>

          {rfis && rfis.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv} style={{ gap: 5, fontSize: 11 }}>
              <Download style={{ width: 12, height: 12 }} />{w("Export All", "Exportar Todo", lang)}
            </Button>
          )}
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />{w("New RFI", "Nuevo RFI", lang)}
            </Button>
          )}
        </div>
      </div>

      {/* Overdue warning */}
      {overdueCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 12px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, fontSize: 12, color: "#BE123C" }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span><strong>{overdueCount}</strong> RFI{overdueCount !== 1 ? "s" : ""} {w("overdue — response required.", "vencido(s) — se requiere respuesta.", lang)}</span>
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <Input
          placeholder={w("Search RFIs…", "Buscar RFIs…", lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280, fontSize: 12 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", ...statusOptions.map(o => o.value)].map(s => (
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

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
        </div>
      )}

      {/* Empty state */}
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
                {canWrite && <th style={{ width: 80, textAlign: "right" }}></th>}
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
                        <span style={{ fontSize: 11, color: "#16A34A" }}>✓ {w("Closed", "Cerrado", lang)}</span>
                      )}
                    </td>
                    <td><span style={{ fontSize: 12 }}>{rfi.submittedByCompany || rfi.createdByName || "—"}</span></td>
                    <td style={{ fontSize: 11, color: isOverdue ? "#DC2626" : "hsl(var(--muted-foreground))", fontWeight: isOverdue ? 700 : 400, whiteSpace: "nowrap" }}>
                      {fmt(due)}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: daysColor(days, isOverdue) }}>{days}d</span>
                      {rfi.scheduleImpact && rfi.scheduleImpact !== "No Schedule Impact" && (
                        <span style={{ display: "block", fontSize: 9, color: "#D97706" }}>⚠ {w("Sched.", "Prog.", lang)}</span>
                      )}
                    </td>
                    {canWrite && (
                      <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <button
                          style={{ padding: "4px 8px", fontSize: 11, border: "1px solid hsl(var(--border))", borderRadius: 5, background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
                          onClick={e => { e.stopPropagation(); setSelectedRfi(rfi); }}
                        >
                          {w("View", "Ver", lang)}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* LOG VIEW */}
      {!isLoading && filtered.length > 0 && view === "log" && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{w("RFI #", "RFI #", lang)}</th>
                <th>{w("Description", "Descripción", lang)}</th>
                <th>{w("Req. By Co.", "Empresa Solic.", lang)}</th>
                <th>{w("Req. By Person", "Persona Solic.", lang)}</th>
                <th>{w("Sent To Co.", "Empresa Destino", lang)}</th>
                <th>{w("Sent To Person", "Persona Destino", lang)}</th>
                <th style={{ width: 90 }}>{w("Forwarded", "Enviado", lang)}</th>
                <th style={{ width: 90 }}>{w("Answered", "Respondido", lang)}</th>
                <th style={{ width: 95 }}>{w("Status", "Estado", lang)}</th>
                <th>{w("Sched. Impact", "Impacto Prog.", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rfi => (
                <tr key={rfi.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRfi(rfi)}>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{rfi.number}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.subject}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedByCompany || "—"}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedByContact || rfi.createdByName || "—"}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedToCompany || "—"}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedToPerson || "—"}</span></td>
                  <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{fmt(rfi.dateRequested || rfi.createdAt)}</td>
                  <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{fmt(rfi.dateAnswered || rfi.respondedAt)}</td>
                  <td><span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span></td>
                  <td>
                    {rfi.scheduleImpact && rfi.scheduleImpact !== "No Schedule Impact"
                      ? <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>{rfi.scheduleImpact}{rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays}d)` : ""}</span>
                      : <span style={{ fontSize: 11, color: "#16A34A" }}>{w("None", "Ninguno", lang)}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-out Create Panel */}
      {(showCreate || revising) && (
        <RfiCreatePanel
          projectId={projectId}
          preload={revising ?? undefined}
          members={members || []}
          user={user}
          lang={lang}
          onClose={() => { setShowCreate(false); setRevising(null); }}
        />
      )}

      {/* Detail Panel */}
      {selectedRfi && (
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
          onUpdate={(updated) => setSelectedRfi(updated)}
        />
      )}
    </div>
  );
}

// ─── RFI Create Panel (slide-out) ────────────────────────────────────────────
function RfiCreatePanel({ projectId, preload, members, user, lang, onClose }: {
  projectId: number;
  preload?: Rfi;
  members: { userFullName: string; userCompanyName?: string; userEmail: string }[];
  user: { fullName: string; companyName: string; email: string } | null;
  lang: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getOptions } = useConfig();
  const priorityOptions = getOptions("rfi_priority");

  const isRevision = !!preload;

  const [subject, setSubject] = useState(preload?.subject || "");
  const [priority, setPriority] = useState(preload?.priority || priorityOptions[0]?.value || "medium");
  const [dateRequested, setDateRequested] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateRequired, setDateRequired] = useState(preload?.dateRequired ? format(parseISO(preload.dateRequired), "yyyy-MM-dd") : "");
  const [projectAddress, setProjectAddress] = useState(preload?.projectAddress || "");

  const [sByCompany, setsByCompany] = useState(preload?.submittedByCompany || user?.companyName || "");
  const [sByContact, setsByContact] = useState(preload?.submittedByContact || user?.fullName || "");
  const [sByAddress, setsByAddress] = useState(preload?.submittedByAddress || "");
  const [sByPhone, setsByPhone] = useState(preload?.submittedByPhone || "");
  const [sByEmail, setsByEmail] = useState(preload?.submittedByEmail || user?.email || "");

  const [sToCompany, setsToCompany] = useState(preload?.submittedToCompany || "");
  const [sToPerson, setsToPerson] = useState(preload?.submittedToPerson || "");
  const [sToEmail, setsToEmail] = useState(preload?.submittedToEmail || "");

  const [drawingNum, setDrawingNum] = useState(preload?.drawingNumber || "");
  const [drawingTitle, setDrawingTitle] = useState(preload?.drawingTitle || "");
  const [specSection, setSpecSection] = useState(preload?.specSection || "");
  const [detailNum, setDetailNum] = useState(preload?.detailNumber || "");
  const [noteNum, setNoteNum] = useState(preload?.noteNumber || "");
  const [location, setLocation] = useState(preload?.locationDescription || "");

  const [question, setQuestion] = useState(preload?.question || "");
  const [attachments, setAttachments] = useState<string[]>(preload?.attachmentsJson || []);
  const [attachInput, setAttachInput] = useState("");

  const [costImpact, setCostImpact] = useState(preload?.costImpact || "No Cost Impact");
  const [costAmount, setCostAmount] = useState(preload?.costImpactAmount || "");
  const [schedImpact, setSchedImpact] = useState(preload?.scheduleImpact || "No Schedule Impact");
  const [schedDays, setSchedDays] = useState(preload?.scheduleImpactDays != null ? String(preload.scheduleImpactDays) : "");

  const [distList, setDistList] = useState<string[]>(preload?.distributionList || []);

  const [aiDesc, setAiDesc] = useState("");
  const [showAi, setShowAi] = useState(false);

  const uniqueCompanies = [...new Set(members.map(m => m.userCompanyName).filter(Boolean) as string[])];
  const companyPeople = (company: string) => members.filter(m => m.userCompanyName === company);

  const { mutate: createRfi, isPending } = useCreateRfi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w(isRevision ? "RFI revision created" : "RFI created", isRevision ? "Revisión de RFI creada" : "RFI creado", lang) });
        onClose();
      },
      onError: () => toast({ title: w("Error creating RFI", "Error al crear RFI", lang), variant: "destructive" }),
    },
  });

  const { mutate: generateQ, isPending: isGenerating } = useGenerateRfiQuestion({
    mutation: {
      onSuccess: (data) => {
        setQuestion(data.question);
        setShowAi(false);
        setAiDesc("");
      },
      onError: () => toast({ title: w("AI generation failed", "Generación IA falló", lang), variant: "destructive" }),
    },
  });

  const handleSubmit = () => {
    if (!subject.trim()) {
      toast({ title: w("Subject is required", "El asunto es requerido", lang), variant: "destructive" }); return;
    }
    createRfi({
      projectId,
      data: {
        subject, priority,
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
        costImpactAmount: costImpact === "Cost Increase Known" ? costAmount : undefined,
        scheduleImpact: schedImpact || undefined,
        scheduleImpactDays: schedDays ? parseInt(schedDays) : undefined,
        distributionList: distList.length > 0 ? distList : undefined,
        attachmentsJson: attachments.length > 0 ? attachments : undefined,
      },
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{
        width: 680, maxWidth: "95vw", background: "hsl(var(--background))",
        boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Panel header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{w(isRevision ? "Revise RFI" : "New RFI", isRevision ? "Revisar RFI" : "Nuevo RFI", lang)}</div>
            {isRevision && <div style={{ fontSize: 12, color: "#7C3AED", marginTop: 2 }}>Revision of {preload?.number}</div>}
          </div>
          <button onClick={onClose} style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 6 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0 24px 24px" }}>
          {/* Section 1 — Header Info */}
          <SectionHeader title={w("1. Header Information", "1. Información del Encabezado", lang)} />
          <FormGrid>
            <FormField label={w("Date Requested", "Fecha Solicitada", lang)} full>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Date Requested", "Fecha Solicitada", lang)}</label>
                  <Input type="date" value={dateRequested} onChange={e => setDateRequested(e.target.value)} style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Date Required (response by)", "Fecha Requerida (respuesta antes de)", lang)}</label>
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
            <FormField label={w("Project Address", "Dirección del Proyecto", lang)}>
              <Input value={projectAddress} onChange={e => setProjectAddress(e.target.value)} placeholder={w("Project site address", "Dirección del sitio del proyecto", lang)} style={{ fontSize: 12 }} />
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
                setsToPerson("");
                setsToEmail("");
              }} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                <option value="">{w("— Select company —", "— Seleccionar empresa —", lang)}</option>
                {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label={w("Contact Person", "Persona de Contacto", lang)}>
              <select value={sToPerson} onChange={e => {
                const sel = companyPeople(sToCompany).find(m => m.userFullName === e.target.value);
                setsToPerson(e.target.value);
                if (sel) setsToEmail(sel.userEmail);
              }} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "0 8px" }}>
                <option value="">{w("— Select person —", "— Seleccionar persona —", lang)}</option>
                {companyPeople(sToCompany).map(m => <option key={m.userEmail} value={m.userFullName}>{m.userFullName}</option>)}
              </select>
            </FormField>
            <FormField label={w("Email", "Correo", lang)}>
              <Input value={sToEmail} onChange={e => setsToEmail(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
          </FormGrid>

          {/* Section 4 — Reference Info */}
          <SectionHeader title={w("4. Reference Information", "4. Información de Referencia", lang)} />
          <FormGrid>
            <FormField label={w("Drawing Number", "Número de Plano", lang)}>
              <Input value={drawingNum} onChange={e => setDrawingNum(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Drawing Title", "Título del Plano", lang)}>
              <Input value={drawingTitle} onChange={e => setDrawingTitle(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Spec Section", "Sección de Especificación", lang)}>
              <Input value={specSection} onChange={e => setSpecSection(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Detail Number", "Número de Detalle", lang)}>
              <Input value={detailNum} onChange={e => setDetailNum(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Note Number", "Número de Nota", lang)}>
              <Input value={noteNum} onChange={e => setNoteNum(e.target.value)} style={{ fontSize: 12 }} />
            </FormField>
            <FormField label={w("Location Description", "Descripción de Ubicación", lang)} full>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={w("Where on the project does this apply?", "¿Dónde aplica en el proyecto?", lang)} style={{ fontSize: 12 }} />
            </FormField>
          </FormGrid>

          {/* Section 5 — Question */}
          <SectionHeader title={w("5. Description of Question", "5. Descripción de la Pregunta", lang)} />
          <div style={{ marginTop: 10 }}>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={w("Provide a clear, detailed description of the information requested…", "Proporcione una descripción clara y detallada de la información solicitada…", lang)}
              style={{ width: "100%", minHeight: 100, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "8px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />

            {/* AI Assistant */}
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
                    {w("Describe your issue in plain language and AI will generate a formal RFI question:", "Describe tu problema en lenguaje simple y la IA generará una pregunta formal de RFI:", lang)}
                  </p>
                  <textarea
                    value={aiDesc}
                    onChange={e => setAiDesc(e.target.value)}
                    placeholder={w("e.g. The drawing shows a beam but the spec says something different…", "ej. El plano muestra una viga pero la especificación dice algo diferente…", lang)}
                    style={{ width: "100%", minHeight: 60, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "6px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <Button
                    size="sm"
                    disabled={!aiDesc.trim() || isGenerating}
                    onClick={() => generateQ({ data: { description: aiDesc, subject, projectName: undefined } })}
                    style={{ marginTop: 8, fontSize: 12, background: "#7C3AED", gap: 5 }}
                  >
                    {isGenerating ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />{w("Generating…", "Generando…", lang)}</> : <><Sparkles style={{ width: 12, height: 12 }} />{w("Generate", "Generar", lang)}</>}
                  </Button>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>{w("Attachments / References", "Adjuntos / Referencias", lang)}</label>
              <div style={{ display: "flex", gap: 6 }}>
                <Input value={attachInput} onChange={e => setAttachInput(e.target.value)} placeholder={w("Paste file name or URL…", "Pegar nombre de archivo o URL…", lang)} style={{ fontSize: 12, flex: 1 }} onKeyDown={e => { if (e.key === "Enter" && attachInput.trim()) { setAttachments(prev => [...prev, attachInput.trim()]); setAttachInput(""); e.preventDefault(); } }} />
                <Button size="sm" variant="outline" onClick={() => { if (attachInput.trim()) { setAttachments(prev => [...prev, attachInput.trim()]); setAttachInput(""); } }} style={{ fontSize: 11 }}>{w("Add", "Agregar", lang)}</Button>
              </div>
              {attachments.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12 }}>
                  <ExternalLink style={{ width: 12, height: 12, color: "#1D4ED8" }} />
                  <span style={{ flex: 1 }}>{a}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 11, height: 11 }} /></button>
                </div>
              ))}
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
              {costImpact === "Cost Increase Known" && (
                <Input value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="$ Amount" style={{ fontSize: 12, marginTop: 4 }} />
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
              {(schedImpact === "Increase in Calendar Days" || schedImpact === "Decrease in Calendar Days") && (
                <Input type="number" value={schedDays} onChange={e => setSchedDays(e.target.value)} placeholder={w("Number of days", "Número de días", lang)} style={{ fontSize: 12, marginTop: 4 }} />
              )}
            </div>
          </div>

          {/* Section 7 — Distribution */}
          <SectionHeader title={w("7. Distribution List", "7. Lista de Distribución", lang)} />
          <div style={{ marginTop: 10 }}>
            {members.map(m => (
              <label key={m.userEmail} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={distList.includes(m.userEmail)}
                  onChange={e => {
                    if (e.target.checked) setDistList(prev => [...prev, m.userEmail]);
                    else setDistList(prev => prev.filter(x => x !== m.userEmail));
                  }}
                />
                <span>{m.userFullName}</span>
                {m.userCompanyName && <span style={{ color: "hsl(var(--muted-foreground))" }}>· {m.userCompanyName}</span>}
                <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}>{m.userEmail}</span>
              </label>
            ))}
            {members.length === 0 && <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No team members found.", "No se encontraron miembros del equipo.", lang)}</p>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <Button variant="outline" onClick={onClose} style={{ fontSize: 12 }}>{w("Cancel", "Cancelar", lang)}</Button>
          <Button onClick={handleSubmit} disabled={isPending} style={{ fontSize: 12, gap: 5 }}>
            {isPending ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />{w("Submitting…", "Enviando…", lang)}</> : w(isRevision ? "Submit Revision" : "Submit RFI", isRevision ? "Enviar Revisión" : "Enviar RFI", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── RFI Detail Panel ─────────────────────────────────────────────────────────
function RfiDetailPanel({ projectId, rfi, canWrite, lang, members, user, onClose, onRevise, onExportPdf, onUpdate }: {
  projectId: number;
  rfi: Rfi;
  canWrite: boolean;
  lang: string;
  members: { userFullName: string; userCompanyName?: string; userEmail: string }[];
  user: { fullName: string; companyName: string; email: string } | null;
  onClose: () => void;
  onRevise: (rfi: Rfi) => void;
  onExportPdf: (rfi: Rfi) => void;
  onUpdate: (rfi: Rfi) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getLabel, getOptions } = useConfig();
  const { data: activity } = useListRfis(projectId);

  const [answer, setAnswer] = useState(rfi.answer || rfi.response || "");
  const [answeredBy, setAnsweredBy] = useState(rfi.answeredBy || user?.fullName || "");
  const [closingStatus, setClosingStatus] = useState(rfi.status);
  const [costImpact, setCostImpact] = useState(rfi.costImpact || "No Cost Impact");
  const [costAmount, setCostAmount] = useState(rfi.costImpactAmount || "");
  const [schedImpact, setSchedImpact] = useState(rfi.scheduleImpact || "No Schedule Impact");
  const [schedDays, setSchedDays] = useState(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : "");

  const statusOptions = getOptions("rfi_status");

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

  const { mutate: reviseRfi, isPending: isRevising } = useReviseRfi({
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

  const handleSaveResponse = () => {
    updateRfi({
      projectId,
      rfiId: rfi.id,
      data: {
        answer: answer || undefined,
        answeredBy: answeredBy || undefined,
        status: closingStatus,
        costImpact: costImpact || undefined,
        costImpactAmount: costImpact === "Cost Increase Known" ? costAmount : undefined,
        scheduleImpact: schedImpact || undefined,
        scheduleImpactDays: schedDays ? parseInt(schedDays) : undefined,
      },
    });
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    value ? (
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, paddingBottom: 6, borderBottom: "1px solid hsl(var(--border) / 0.4)", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 2 }}>{label}</span>
        <span style={{ fontSize: 13 }}>{value}</span>
      </div>
    ) : null
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{ width: 760, maxWidth: "95vw", background: "hsl(var(--background))", boxShadow: "-4px 0 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>{rfi.number}</span>
              <span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span>
              <span className={`badge ${PRIORITY_BADGE[rfi.priority] ?? "badge-gray"}`}>{getLabel("rfi_priority", rfi.priority)}</span>
              {(rfi.revisionNumber ?? 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", padding: "2px 6px", borderRadius: 4, background: "#EDE9FE" }}>Rev {rfi.revisionNumber}</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{rfi.subject}</div>
            {bic && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "4px 10px", borderRadius: 20, background: bic.color + "15", border: `1px solid ${bic.color}44`, width: "fit-content" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: bic.color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: bic.color }}>{w("Ball in court:", "Responsable:", lang)} {bic.label}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button variant="outline" size="sm" onClick={() => onExportPdf(rfi)} style={{ gap: 5, fontSize: 11 }}>
              <FileText style={{ width: 12, height: 12 }} />{w("Export PDF", "Exportar PDF", lang)}
            </Button>
            {rfi.status === "closed" && canWrite && (
              <Button variant="outline" size="sm" onClick={() => { onRevise(rfi); onClose(); }} style={{ gap: 5, fontSize: 11, color: "#7C3AED", borderColor: "#7C3AED" }}>
                <RefreshCw style={{ width: 12, height: 12 }} />{w("Revise RFI", "Revisar RFI", lang)}
              </Button>
            )}
            <button onClick={onClose} style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 6 }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 24px" }}>

          {/* Overdue warning */}
          {isOverdue && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, fontSize: 12, color: "#BE123C" }}>
              <AlertTriangle style={{ width: 14, height: 14 }} />
              {w("This RFI is overdue. Response was required by", "Este RFI está vencido. La respuesta era requerida el", lang)} {fmt(due)}.
            </div>
          )}

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              [w("Date Requested", "Fecha Solicitada", lang), fmt(rfi.dateRequested || rfi.createdAt)],
              [w("Date Required", "Fecha Requerida", lang), fmt(rfi.dateRequired || rfi.dueDate)],
              [w("Days Outstanding", "Días en Espera", lang), `${days}d`],
              [w("Date Answered", "Fecha Respondido", lang), fmt(rfi.dateAnswered || rfi.respondedAt)],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "8px 12px", background: "hsl(var(--secondary) / 0.4)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: label === w("Days Outstanding", "Días en Espera", lang) ? daysColor(days, isOverdue) : "hsl(var(--foreground))" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Submitted By / To */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 8 }}>{w("Submitted By", "Enviado Por", lang)}</div>
              {rfi.submittedByCompany && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Building2 style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>{rfi.submittedByCompany}</span></div>}
              {(rfi.submittedByContact || rfi.createdByName) && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><User style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByContact || rfi.createdByName}</span></div>}
              {rfi.submittedByEmail && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Mail style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByEmail}</span></div>}
              {rfi.submittedByPhone && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByPhone}</span></div>}
              {rfi.submittedByAddress && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><MapPin style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedByAddress}</span></div>}
            </div>
            <div style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 8 }}>{w("Submitted To", "Enviado A", lang)}</div>
              {rfi.submittedToCompany && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Building2 style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>{rfi.submittedToCompany}</span></div>}
              {rfi.submittedToPerson && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><User style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedToPerson}</span></div>}
              {rfi.submittedToEmail && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} /><span style={{ fontSize: 12 }}>{rfi.submittedToEmail}</span></div>}
              {!rfi.submittedToCompany && !rfi.submittedToPerson && <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>—</span>}
            </div>
          </div>

          {/* Reference info */}
          {(rfi.drawingNumber || rfi.drawingTitle || rfi.specSection || rfi.detailNumber || rfi.noteNumber || rfi.locationDescription) && (
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
            </div>
          )}

          {/* Question */}
          <div style={{ marginBottom: 16, padding: "14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 8 }}>{w("Description of Question", "Descripción de la Pregunta", lang)}</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{rfi.question || rfi.description || <span style={{ color: "hsl(var(--muted-foreground))" }}>—</span>}</p>

            {(rfi.attachmentsJson as string[] | null)?.length ? (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border) / 0.4)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{w("Attachments", "Adjuntos", lang)}</div>
                {(rfi.attachmentsJson as string[]).map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1D4ED8", marginBottom: 2 }}>
                    <ExternalLink style={{ width: 12, height: 12 }} />{a}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Impact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 6 }}>{w("Cost Impact", "Impacto en Costo", lang)}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{rfi.costImpact || "—"}</div>
              {rfi.costImpact === "Cost Increase Known" && rfi.costImpactAmount && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>{rfi.costImpactAmount}</div>}
            </div>
            <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 6 }}>{w("Schedule Impact", "Impacto en Programa", lang)}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{rfi.scheduleImpact || "—"}</div>
              {rfi.scheduleImpactDays != null && <div style={{ fontSize: 12, color: "#D97706", marginTop: 2 }}>{rfi.scheduleImpactDays} {w("calendar days", "días calendario", lang)}</div>}
            </div>
          </div>

          {/* Response section */}
          <div style={{ marginBottom: 16, padding: "14px", border: `2px solid ${rfi.answer || rfi.response ? "#16A34A" : "hsl(var(--border))"}`, borderRadius: 8, background: rfi.answer || rfi.response ? "#F0FDF4" : "transparent" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              {rfi.answer || rfi.response ? <CheckCircle2 style={{ width: 15, height: 15, color: "#16A34A" }} /> : <MessageSquare style={{ width: 15, height: 15 }} />}
              {w("Response", "Respuesta", lang)}
            </div>

            {(rfi.answer || rfi.response) && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{rfi.answer || rfi.response}</p>
                {rfi.answeredBy && <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>{w("Answered by:", "Respondido por:", lang)} <strong>{rfi.answeredBy}</strong> {rfi.dateAnswered ? `· ${fmt(rfi.dateAnswered)}` : ""}</p>}
              </div>
            )}

            {canWrite && rfi.status !== "closed" && (
              <div style={{ borderTop: rfi.answer || rfi.response ? "1px solid #BBF7D0" : undefined, paddingTop: rfi.answer || rfi.response ? 12 : 0 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>{w("Add / Update Response", "Agregar / Actualizar Respuesta", lang)}</label>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder={w("Enter your response here…", "Ingrese su respuesta aquí…", lang)}
                  style={{ width: "100%", minHeight: 80, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "8px 10px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />
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
                {/* Response impact update */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{w("Cost Impact", "Impacto Costo", lang)}</label>
                    {["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"].map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: "pointer", fontSize: 11 }}>
                        <input type="radio" name="resp_cost" checked={costImpact === opt} onChange={() => setCostImpact(opt)} />
                        {opt}
                      </label>
                    ))}
                    {costImpact === "Cost Increase Known" && (
                      <Input value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="$ Amount" style={{ fontSize: 11, marginTop: 3 }} />
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
                    {(schedImpact === "Increase in Calendar Days" || schedImpact === "Decrease in Calendar Days") && (
                      <Input type="number" value={schedDays} onChange={e => setSchedDays(e.target.value)} placeholder={w("Days", "Días", lang)} style={{ fontSize: 11, marginTop: 3 }} />
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <Button onClick={handleSaveResponse} disabled={isUpdating} style={{ fontSize: 12, gap: 5 }}>
                    {isUpdating ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : null}
                    {w("Save Response", "Guardar Respuesta", lang)}
                  </Button>
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

          {/* Distribution list */}
          {(rfi.distributionList as string[] | null)?.length ? (
            <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 6 }}>{w("Distribution List", "Lista de Distribución", lang)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(rfi.distributionList as string[]).map(e => (
                  <span key={e} style={{ fontSize: 11, padding: "3px 8px", background: "hsl(var(--secondary))", borderRadius: 12, display: "flex", alignItems: "center", gap: 4 }}>
                    <Mail style={{ width: 10, height: 10 }} />{e}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
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
