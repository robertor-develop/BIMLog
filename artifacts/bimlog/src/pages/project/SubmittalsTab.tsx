import { useState, useEffect, useRef } from "react";
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
  BookOpen, List, Loader2, Copy, TriangleAlert,
} from "lucide-react";
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
  if (!d) return "—";
  const dt = new Date(d);
  return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
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
  const labels: Record<string, string> = { pass: "AI ✓", possible_issue: "AI ⚠", fail: "AI ✗" };
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

// ─── Main SubmittalsTab ───────────────────────────────────────────────────────
export function SubmittalsTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { lang } = useI18n();
  const [view, setView] = useState<"register" | "submittals">("submittals");
  const [selectedSubmittal, setSelectedSubmittal] = useState<Submittal | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: submittals = [], isLoading } = useListSubmittals(projectId) as {
    data: Submittal[]; isLoading: boolean;
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
            {submittals.length} {w("total", "total", lang)} · {pendingCount} {w("pending", "pendiente", lang)} · {approvedCount} {w("approved", "aprobado", lang)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 7, padding: 3 }}>
            <button
              onClick={() => setView("submittals")}
              style={{
                padding: "5px 12px", borderRadius: 5, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: view === "submittals" ? "white" : "transparent",
                color: view === "submittals" ? "#1E3A5F" : "#6B7280",
                boxShadow: view === "submittals" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <List style={{ width: 12, height: 12 }} />
              {w("Submittals", "Entregables", lang)}
            </button>
            <button
              onClick={() => setView("register")}
              style={{
                padding: "5px 12px", borderRadius: 5, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: view === "register" ? "white" : "transparent",
                color: view === "register" ? "#1E3A5F" : "#6B7280",
                boxShadow: view === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <BookOpen style={{ width: 12, height: 12 }} />
              {w("Register", "Registro", lang)}
            </button>
          </div>
          {canWrite && view === "submittals" && (
            <Button size="sm" onClick={() => setShowNewForm(true)} style={{ gap: 5, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />
              {w("New Submittal", "Nuevo Entregable", lang)}
            </Button>
          )}
        </div>
      </div>

      {/* Action needed banner */}
      {actionNeeded > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
          padding: "9px 13px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#B45309",
        }}>
          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <strong>{actionNeeded}</strong>&nbsp;{w("submittal(s) under review for 14+ days — follow up required.", "entregable(s) en revisión por 14+ días — seguimiento requerido.", lang)}
        </div>
      )}

      {view === "register" ? (
        <RegisterView projectId={projectId} canWrite={canWrite} lang={lang} />
      ) : (
        <SubmittalsList
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
        title={selectedSubmittal ? `${selectedSubmittal.number} — ${selectedSubmittal.title}` : ""}
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
        <span style={{ fontSize: 12, color: "#6B7280" }}>{items.length} {w("items in register", "ítems en registro", lang)}</span>
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
                <option value="">—</option>
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
                      <td style={{ fontSize: 11, color: "#6B7280" }}>{item.trade || "—"}</td>
                      <td style={{ fontSize: 11, color: "#6B7280" }}>{item.submittalType ? (CATEGORY_OPTIONS.find(o => o.value === item.submittalType)?.[lang === "es" ? "labelEs" : "label"] || item.submittalType) : "—"}</td>
                      <td style={{ fontSize: 11 }}>{item.requiredByDate ? format(new Date(item.requiredByDate), "MMM d, yyyy") : "—"}</td>
                      <td style={{ fontSize: 11 }}>{item.leadTimeDays ? `${item.leadTimeDays}d` : "—"}</td>
                      <td style={{ fontSize: 11 }}>{item.responsibleCompany || "—"}</td>
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
                        <td style={{ textAlign: "right" }}>
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
function SubmittalsList({ projectId, submittals, isLoading, lang, canWrite, onSelect }: {
  projectId: number; submittals: Submittal[]; isLoading: boolean; lang: string; canWrite: boolean;
  onSelect: (s: Submittal) => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const handleExport = async (format: "pdf" | "excel") => {
    if (format === "excel") {
      const rows = submittals.map(s => ({
        "Number": s.number, "Title": s.title,
        "Status": s.status, "Category": s.submittalCategory || s.submittalType,
        "Spec Section": s.specSection || "", "Manufacturer": s.manufacturer || "",
        "Model No": s.modelNumber || "", "Submitted By": s.submittedByCompany || s.submittedByName || "",
        "Submitted To": s.submittedToCompany || "", "Date Submitted": fmtDate(s.dateSubmitted || s.createdAt),
        "Date Required": fmtDate(s.dateRequired || s.dueDate), "Ball in Court": s.ballInCourt || "",
        "AI Check": s.aiCheckResult ? (s.aiCheckResult as AiCheckResult).overall : "",
        "Review Decision": s.reviewDecision || "", "Reviewer": s.reviewerName || "",
        "Rapid Approval Flag": s.rapidApprovalFlag ? "YES" : "",
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Submittals");
      XLSX.writeFile(wb, `Submittals-Project${projectId}.xlsx`);
      toast({ title: w("Excel exported", "Excel exportado", lang) });
      return;
    }
    toast({ title: w("Generating PDF…", "Generando PDF…", lang) });
    const token = getToken();
    // Export each submittal as individual PDF
    for (const s of submittals) {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${s.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${s.number}-Submittal.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
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
          Excel
        </Button>
        <Button variant="outline" size="sm" style={{ fontSize: 11, gap: 5 }} onClick={() => handleExport("pdf")}>
          <FileText style={{ width: 12, height: 12 }} />
          PDF
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
                    <td style={{ fontSize: 11, color: "#6B7280" }}>{sub.specSection || "—"}</td>
                    <td style={{ fontSize: 11 }}>{sub.submittedByCompany || sub.submittedByName || "—"}</td>
                    <td style={{ fontSize: 11 }}>{sub.submittedToCompany || "—"}</td>
                    <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(sub.dateRequired || sub.dueDate)}</td>
                    <td style={{ textAlign: "center" }}>
                      {days !== null && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: isUrgent ? "#DC2626" : days > 7 ? "#D97706" : "#15803D" }}>
                          {days}d
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: "#1E3A5F" }}>{sub.ballInCourt || "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      {sub.aiCheckRan && aiCheck && <AiBadge result={aiCheck.overall} />}
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
    drawingNumber: "", drawingTitle: "",
    dateSubmitted: new Date().toISOString().slice(0, 10),
    dateRequired: "",
    submittedByCompany: "", submittedByPerson: "", submittedByEmail: "", submittedByPhone: "", submittedByAddress: "",
    submittedToCompany: "", submittedToPerson: "", submittedToEmail: "", submittedToExternal: false,
    manufacturer: "", modelNumber: "", description: "",
    procurementStatus: "not_ordered",
    linkedRfiId: "",
    distributionList: "",
  });

  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiCheckLoading, setAiCheckLoading] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<AiCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  const procureWarning = ["on_order", "delivered"].includes(form.procurementStatus);

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        submittedByPerson: user.fullName || "",
        submittedByEmail: user.email || "",
      }));
    }
  }, [user]);

  const handleAiAssist = async () => {
    setAiAssistLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/0/ai-assist-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ specSection: form.specSection, submittalCategory: form.submittalCategory, title: form.title }),
      });
      if (r.ok) {
        const d = await r.json() as { suggestion: string };
        setForm(f => ({ ...f, description: f.description ? f.description + "\n\n" + d.suggestion : d.suggestion }));
      }
    } catch { toast({ title: w("AI assist failed", "Error de asistencia IA", lang), variant: "destructive" }); }
    finally { setAiAssistLoading(false); }
  };

  const handleAiCheck = async () => {
    if (!savedId) {
      toast({ title: w("Save the submittal first, then run AI check.", "Guarda el entregable primero.", lang) });
      return;
    }
    setAiCheckLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/${savedId}/ai-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) setAiCheckResult(await r.json() as AiCheckResult);
    } catch { toast({ title: w("AI check failed", "Error de verificación IA", lang), variant: "destructive" }); }
    finally { setAiCheckLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.title) { toast({ title: w("Title is required", "El título es requerido", lang), variant: "destructive" }); return; }
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
          <FieldInput placeholder="23 00 00" value={form.specSection} onChange={e => set("specSection", e.target.value)} />
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
          <FieldInput value={form.submittedByCompany} onChange={e => set("submittedByCompany", e.target.value)} />
        </Field>
        <Field label={w("Contact Person", "Persona de Contacto", lang)}>
          <FieldInput value={form.submittedByPerson} onChange={e => set("submittedByPerson", e.target.value)} />
        </Field>
        <Field label={w("Phone", "Teléfono", lang)}>
          <FieldInput value={form.submittedByPhone} onChange={e => set("submittedByPhone", e.target.value)} />
        </Field>
        <Field label={w("Email", "Correo", lang)}>
          <FieldInput type="email" value={form.submittedByEmail} onChange={e => set("submittedByEmail", e.target.value)} />
        </Field>
      </div>

      {/* Section 3: Submitted To */}
      <PanelSection title={w("3. Submitted To", "3. Enviado A", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Company", "Empresa", lang)}>
          <FieldInput value={form.submittedToCompany} onChange={e => set("submittedToCompany", e.target.value)} />
        </Field>
        <Field label={w("Contact Person", "Persona de Contacto", lang)}>
          <FieldInput value={form.submittedToPerson} onChange={e => set("submittedToPerson", e.target.value)} />
        </Field>
        <Field label={w("Email", "Correo", lang)}>
          <FieldInput type="email" value={form.submittedToEmail} onChange={e => set("submittedToEmail", e.target.value)} />
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
      </div>
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
      </Field>

      {/* Section 5: Reference Documents */}
      <PanelSection title={w("5. Reference Documents", "5. Documentos de Referencia", lang)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={w("Drawing Number", "Número de Plano", lang)}>
          <FieldInput value={form.drawingNumber} onChange={e => set("drawingNumber", e.target.value)} />
        </Field>
        <Field label={w("Drawing Title", "Título de Plano", lang)}>
          <FieldInput value={form.drawingTitle} onChange={e => set("drawingTitle", e.target.value)} />
        </Field>
        <Field label={w("Related RFI ID", "ID de RFI Relacionado", lang)}>
          <FieldInput type="number" value={form.linkedRfiId} onChange={e => set("linkedRfiId", e.target.value)} placeholder="RFI ID" />
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
            <strong>{w("Warning: Procurement Before Approval", "Advertencia: Adquisición Antes de Aprobación", lang)}</strong>
            {" — "}{w("Materials were ordered or delivered before this submittal was formally approved. This creates liability risk.", "Los materiales fueron ordenados o entregados antes de que este entregable fuera aprobado formalmente. Esto crea riesgo de responsabilidad.", lang)}
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
        {!savedId && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{w("Save submittal first to enable AI check", "Guarde el entregable primero para habilitar la verificación", lang)}</span>}
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

// ─── AI Check Display ─────────────────────────────────────────────────────────
function AiCheckDisplay({ result, lang }: { result: AiCheckResult; lang: string }) {
  return (
    <div style={{ border: "1.5px solid #C4B5FD", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <div style={{
        padding: "8px 12px", background: AI_BG[result.overall],
        borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <AiBadge result={result.overall} />
        <span style={{ fontSize: 12, fontWeight: 600, color: AI_COLOR[result.overall] }}>
          {result.overall === "pass" ? w("Likely to be approved", "Probable aprobación", lang) :
           result.overall === "fail" ? w("High rejection risk", "Alto riesgo de rechazo", lang) :
           w("Possible issues detected", "Posibles problemas detectados", lang)}
        </span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        {result.aspects.map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6,
            padding: "5px 8px", borderRadius: 5,
            background: a.result === "pass" ? "#F0FDF4" : a.result === "fail" ? "#FEF2F2" : "#FFFBEB",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: AI_COLOR[a.result], width: 40, flexShrink: 0, marginTop: 1 }}>
              {a.result.toUpperCase().replace("_", " ")}
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
  const [exportLoading, setExportLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
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
  }, [submittal.id, projectId]);

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
    setAiRejectionLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/submittals/0/ai-assist-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          specSection: submittal.specSection,
          submittalCategory: submittal.submittalCategory || submittal.submittalType,
          title: `Rejection reason for: ${submittal.title}. Decision: ${reviewDecision}. Compliance notes: ${complianceNotes}`,
        }),
      });
      if (r.ok) {
        const d = await r.json() as { suggestion: string };
        setRejectionReason(d.suggestion);
      }
    } catch { toast({ title: w("AI assist failed", "Error de asistencia IA", lang), variant: "destructive" }); }
    finally { setAiRejectionLoading(false); }
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
      <span style={{ fontSize: 12, color: "#1E293B" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
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
          {w("Run AI Check", "Verificar con IA", lang)}
        </button>
        {canWrite && !respondOpen && (
          <Button size="sm" style={{ fontSize: 11, gap: 5, marginLeft: "auto" }} onClick={() => setRespondOpen(true)}>
            <CheckCircle2 style={{ width: 12, height: 12 }} />
            {w("Add Review Response", "Agregar Revisión", lang)}
          </Button>
        )}
      </div>

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
      {["on_order", "delivered"].includes(submittal.procurementStatus || "") && !["approved", "approved_as_noted"].includes(submittal.status) && (
        <div style={{
          padding: "10px 14px", background: "#FEF3C7", border: "1.5px solid #FDE68A",
          borderRadius: 8, fontSize: 12, color: "#B45309", marginBottom: 12,
          display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <TriangleAlert style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>{w("Procurement Before Approval", "Adquisición Antes de Aprobación", lang)}</strong>
            {" — "}{w("Materials ordered/delivered before formal approval. Liability risk.", "Materiales ordenados/entregados antes de aprobación formal. Riesgo de responsabilidad.", lang)}
          </div>
        </div>
      )}

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
      <InfoRow label={w("Ball in Court", "En Espera De", lang)} value={submittal.ballInCourt} />
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
        <div style={{ marginTop: 12, border: "1.5px solid #1E3A5F", borderRadius: 8, overflow: "hidden" }}>
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
                <span style={{ color: "#6B7280" }}>— {entry.setBy}</span>
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
            {w("Revision", "Revisión", lang)} {submittal.revisionNumber} · {w("Parent ID", "ID Padre", lang)}: {submittal.parentSubmittalId}
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
