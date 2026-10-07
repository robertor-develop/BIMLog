import { ProjectPartyPicker } from "@/components/ProjectPartyPicker";
import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Download, Search, Trash2 } from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { downloadAuthenticatedPdf, PrintPdfButton } from "@/components/PrintPdfButton";
import { ClipboardList, DollarSign, Calendar, Sparkles } from "lucide-react";
import { OptionalSharePanel } from "@/components/OptionalSharePanel";
import { parseChangeOriginContext, type ChangeOriginContext } from "@/lib/project-record-return";

interface ChangeOrder {
  id: number; number: string; title: string; description?: string;
  status: string; contractValueImpact?: string; scheduleImpactDays?: number;
  createdAt: string; approvedAt?: string; initiatedByCompany?: string | null;
}

const API = "/api/v1";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", pending_approval: "#D97706", approved: "#16A34A",
  rejected: "#DC2626",
};

const STATUS_FILTERS = ["all", "draft", "pending_approval", "approved", "rejected"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];
type SortKey = "created_desc" | "created_asc" | "number_asc" | "number_desc" | "status_asc";

const safePdfFileNameFromTitle = (title: string) => {
  const base = title.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "change-orders-current-view";
  return `${base}.pdf`;
};

const sanitizePdfFileName = (value: string | null) => {
  if (!value) return null;
  const leaf = value.trim().split(/[\\/]/).pop() ?? "";
  const safe = leaf
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!safe || safe === ".pdf") return null;
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
};

const parseContentDispositionFileName = (header: string | null) => {
  if (!header) return null;
  const encodedMatch = header.match(/(?:^|;)\s*filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  const encoded = (encodedMatch?.[1] ?? encodedMatch?.[2])?.trim();
  if (encoded) {
    const encodedValue = encoded.replace(/^UTF-8''/i, "");
    try {
      const decoded = decodeURIComponent(encodedValue);
      const safe = sanitizePdfFileName(decoded);
      if (safe) return safe;
    } catch {
      const safe = sanitizePdfFileName(encodedValue);
      if (safe) return safe;
    }
  }
  const quotedMatch = header.match(/(?:^|;)\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i);
  const rawMatch = quotedMatch ? null : header.match(/(?:^|;)\s*filename\s*=\s*([^;]*)/i);
  const value = quotedMatch?.[1]?.replace(/\\(["\\])/g, "$1") ?? rawMatch?.[1]?.trim() ?? null;
  return sanitizePdfFileName(value);
};

export function ChangeOrdersTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const searchParams = useSearch();
  const origin = useMemo(() => parseChangeOriginContext(searchParams, projectId), [searchParams, projectId]);
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<ChangeOrder[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", contract_value_impact: "", schedule_impact_days: "", initiated_by_company: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/projects/${projectId}/change-orders/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        let msg = `${data.imported ?? 0} change orders imported successfully`;
        if (data.renameCount > 0) msg += `. ${data.renameCount} duplicate(s) renamed with DRF suffix`;
        setImportMsg(msg);
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setImportMsg("Import failed — please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeAi, setActiveAi] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created_desc");
  const [includeFinancial, setIncludeFinancial] = useState(true);
  const [includeSchedule, setIncludeSchedule] = useState(true);
  const [includeCompany, setIncludeCompany] = useState(true);
  const [includeDates, setIncludeDates] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/change-orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setItems(await r.json());
    } finally { setLoading(false); setLoaded(true); }
  };

  if (!loaded && !loading) { load(); }

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const originLine = origin ? `[Origin: ${origin.type} #${origin.id} — ${origin.label}]` : "";
      const description = [originLine, form.description.trim()].filter(Boolean).join("\n\n");
      const body: Record<string, unknown> = { title: form.title, description: description || undefined, contract_value_impact: form.contract_value_impact || undefined };
      if (form.schedule_impact_days) body.schedule_impact_days = Number(form.schedule_impact_days);
      if (form.initiated_by_company.trim()) body.initiated_by_company = form.initiated_by_company.trim();
      const r = await fetch(`${API}/projects/${projectId}/change-orders`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ title: "", description: "", contract_value_impact: "", schedule_impact_days: "", initiated_by_company: "" });
    } finally { setSaving(false); }
  };

  const action = async (id: number, act: "submit" | "approve" | "reject") => {
    const msgs: Record<string, [string, string]> = {
      submit: [t("Submit for approval?", "¿Enviar para aprobación?"), ""],
      approve: [t("Approve this change order?", "¿Aprobar esta orden?"), ""],
      reject: [t("Reject this change order?", "¿Rechazar esta orden?"), ""],
    };
    if (!confirm(msgs[act][0])) return;
    const r = await fetch(`${API}/projects/${projectId}/change-orders/${id}/${act}`, { method: "POST", headers });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Request failed"); return; }
    await load();
  };

  const aiDraft = async (id: number) => {
    setAiLoading(true); setActiveAi(id);
    try {
      const r = await fetch(`${API}/projects/${projectId}/change-orders/${id}/ai-draft`, { method: "POST", headers });
      if (r.ok) {
        const d = await r.json();
        setItems(prev => prev.map(co => co.id === id ? { ...co, description: d.description, contractValueImpact: d.suggested_cost_impact } : co));
      }
    } finally { setAiLoading(false); setActiveAi(null); }
  };

  const exportPdf = async (id: number) => {
    if (!token) return;
    try {
      await downloadAuthenticatedPdf(
        `${API}/projects/${projectId}/change-orders/${id}/export`,
        token,
        `change-order-${id}.pdf`,
      );
    } catch {
      setError(t("Could not prepare the Change Order PDF.", "No se pudo preparar el PDF de la Orden de Cambio."));
    }
  };

  const statusLabel = (s: string) =>
    t(s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      s === "all" ? "Todos" : s === "draft" ? "Borrador" : s === "pending_approval" ? "Pendiente" : s === "approved" ? "Aprobado" : "Rechazado");

  const filtered = [...items]
    .filter(i => filter === "all" || i.status === filter)
    .filter(i => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [
        i.number,
        i.title,
        i.description,
        i.status,
        i.contractValueImpact,
        i.scheduleImpactDays == null ? "" : String(i.scheduleImpactDays),
        i.initiatedByCompany,
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "number_asc") return a.number.localeCompare(b.number);
      if (sort === "number_desc") return b.number.localeCompare(a.number);
      if (sort === "status_asc") return a.status.localeCompare(b.status) || a.number.localeCompare(b.number);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const exportCurrentViewPdf = async () => {
    setExportError("");
    setExportingPdf(true);
    const params = new URLSearchParams({
      lang,
      status: filter,
      search: search.trim(),
      sort,
      include_financial: String(includeFinancial),
      include_schedule: String(includeSchedule),
      include_company: String(includeCompany),
      include_dates: String(includeDates),
    });
    try {
      const res = await fetch(`${API}/projects/${projectId}/change-orders/current-view/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let message = t("Change Orders PDF export failed.", "Fallo la exportacion PDF de ordenes de cambio.");
        try {
          const body = await res.json();
          message = body?.error || message;
        } catch {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = parseContentDispositionFileName(res.headers.get("Content-Disposition"))
        || safePdfFileNameFromTitle(t("Change Orders — Current View", "Ordenes de Cambio — Vista actual"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("Change Orders PDF export failed.", "Fallo la exportacion PDF de ordenes de cambio."));
    } finally {
      setExportingPdf(false);
    }
  };

  const activeSummary = [
    `${t("Status", "Estado")}: ${statusLabel(filter)}`,
    search.trim() ? `${t("Search", "Busqueda")}: ${search.trim()}` : `${t("Search", "Busqueda")}: ${t("None", "Ninguna")}`,
    `${t("Sort", "Orden")}: ${sort === "created_desc" ? t("Newest first", "Mas recientes") : sort === "created_asc" ? t("Oldest first", "Mas antiguos") : sort === "number_asc" ? t("Number A-Z", "Numero A-Z") : sort === "number_desc" ? t("Number Z-A", "Numero Z-A") : t("Status", "Estado")}`,
    `${t("Rows", "Filas")}: ${filtered.length}/${items.length}`,
    `${t("Columns", "Columnas")}: ${[
      includeFinancial ? t("Financial", "Financiero") : "",
      includeSchedule ? t("Schedule", "Cronograma") : "",
      includeCompany ? t("Company", "Empresa") : "",
      includeDates ? t("Dates", "Fechas") : "",
    ].filter(Boolean).join(", ") || t("Standard", "Estandar")}`,
  ];

  const statusBadge = (s: string) => (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: `${STATUS_COLORS[s] ?? "#6B7280"}20`, color: STATUS_COLORS[s] ?? "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
      {s.replace(/_/g, " ")}
    </span>
  );

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Change Orders", "Órdenes de Cambio")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>{t("Track contract changes with full audit trail", "Rastrea cambios de contrato con historial completo")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <PrintPdfButton
            lang={lang}
            onClick={exportCurrentViewPdf}
            loading={exportingPdf}
            disabled={loading || importing}
            currentViewSummary={activeSummary.slice(0, 3)}
            options={<div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={includeFinancial} onChange={event => setIncludeFinancial(event.target.checked)} />{t("Financial columns", "Columnas financieras")}</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={includeSchedule} onChange={event => setIncludeSchedule(event.target.checked)} />{t("Schedule columns", "Columnas de cronograma")}</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={includeCompany} onChange={event => setIncludeCompany(event.target.checked)} />{t("Company column", "Columna empresa")}</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={includeDates} onChange={event => setIncludeDates(event.target.checked)} />{t("Date columns", "Columnas de fechas")}</label>
            </div>}
          />
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <span className="btn btn-outline" style={{ opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? t("Importing...","Importando...") : t("Import","Importar")}
              </span>
            </label>
          )}
          {importMsg && <span style={{ fontSize: 12, color: "#1D4ED8" }}>{importMsg}</span>}
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + {t("New Change Order", "Nueva Orden")}
            </button>
          )}
        </div>
      </div>

      {exportError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{exportError}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(s)}>
            {statusLabel(s)}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", background: "white", minWidth: 0 }}>
          <Search size={14} color="#6B7280" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("Search number, title, company, impact...", "Buscar numero, titulo, empresa, impacto...")}
            style={{ border: "none", outline: "none", fontSize: 13, width: "100%", minWidth: 0 }}
          />
        </label>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <option value="created_desc">{t("Newest first", "Mas recientes")}</option>
          <option value="created_asc">{t("Oldest first", "Mas antiguos")}</option>
          <option value="number_asc">{t("Number A-Z", "Numero A-Z")}</option>
          <option value="number_desc">{t("Number Z-A", "Numero Z-A")}</option>
          <option value="status_asc">{t("Status", "Estado")}</option>
        </select>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {activeSummary.map(part => (
          <span key={part} style={{ display: "inline-flex", border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1E3A5F", borderRadius: 6, padding: "4px 7px", fontSize: 11, fontWeight: 800 }}>
            {part}
          </span>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("New Change Order", "Nueva Orden de Cambio")}</h3>
          <div style={{ marginBottom: 14, padding: 12, border: "1px solid #FCD34D", borderRadius: 8, background: "#FFFBEB", color: "#78350F" }}>
            <strong>{t("Draft change — no approval is created here.", "Cambio en borrador — aquí no se crea ninguna aprobación.")}</strong>
            <div style={{ marginTop: 4, fontSize: 12 }}>{t("Record the cost and schedule impact for review before using the approval action.", "Registre el impacto de costo y cronograma para revisión antes de usar la acción de aprobación.")}</div>
          </div>
          {origin && (
            <div style={{ marginBottom: 14, padding: 12, border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF" }}>
              <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#1E3A5F" }}>{t("Supporting origin", "Origen de soporte")}</div>
              <div style={{ marginTop: 4, fontWeight: 800 }}>{origin.label}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{origin.type} · ID {origin.id}</div>
              <a href={origin.returnTo} style={{ display: "inline-block", marginTop: 6, fontSize: 12, fontWeight: 800 }}>{t("Return to source", "Volver al origen")}</a>
            </div>
          )}
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Title", "Título")} *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Description", "Descripción")}</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div>
              <label className="label">{t("Contract Value Impact", "Impacto Económico")}</label>
              <input className="input" placeholder="+$50,000" value={form.contract_value_impact} onChange={e => setForm(f => ({ ...f, contract_value_impact: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Schedule Impact (days)", "Impacto en Cronograma (días)")}</label>
              <input className="input" type="number" min={0} value={form.schedule_impact_days} onChange={e => setForm(f => ({ ...f, schedule_impact_days: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}><ProjectPartyPicker projectId={projectId} company={form.initiated_by_company} contacts={false} canCreate={canWrite} tt={t} onSelect={company => setForm(f => ({ ...f, initiated_by_company: company }))} /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…", "Guardando…") : t("Create draft change", "Crear cambio en borrador")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading…", "Cargando…")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><ClipboardList size={40} color="#D1D5DB" /></div>
          <div style={{ fontWeight: 600 }}>
            {items.length === 0 ? t("No change orders yet", "Sin ordenes de cambio aun") : t("No change orders match the current view", "Ninguna orden coincide con la vista actual")}
          </div>
          {items.length > 0 && <div style={{ fontSize: 12, marginTop: 4 }}>{t("Adjust the status filter or search text.", "Ajusta el filtro de estado o busqueda.")}</div>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(co => (
            <div key={co.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1D4ED8" }}>{co.number}</span>
                    {statusBadge(co.status)}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{co.title}</div>
                  {co.description && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{co.description}</div>}
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B7280" }}>
                    {co.contractValueImpact && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><DollarSign size={11} /> {co.contractValueImpact}</span>}
                    {co.scheduleImpactDays && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Calendar size={11} /> {co.scheduleImpactDays} {t("days", "días")}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", marginLeft: 12 }}>
                  {canWrite && co.status === "draft" && (
                    <>
                      <button className="btn btn-sm btn-outline" onClick={() => aiDraft(co.id)} disabled={aiLoading && activeAi === co.id}>
                        {aiLoading && activeAi === co.id ? "…" : <><Sparkles size={12} style={{ marginRight: 4 }} />AI</>}
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={() => action(co.id, "submit")}>{t("Submit", "Enviar")}</button>
                    </>
                  )}
                  {canWrite && co.status === "pending_approval" && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => action(co.id, "approve")}>{t("Approve", "Aprobar")}</button>
                      <button className="btn btn-sm btn-danger-outline" onClick={() => action(co.id, "reject")}>{t("Reject", "Rechazar")}</button>
                    </>
                  )}
                  <button className="btn btn-sm btn-outline" title={t("Download this change order report as PDF", "Descargar este reporte de orden de cambio en PDF")} onClick={() => exportPdf(co.id)}>{t("Change Order PDF", "PDF de orden de cambio")}</button>
                  <OptionalSharePanel
                    language={lang === "es" ? "es" : "en"}
                    artifactLabel={`${co.number}-Change-Order.pdf`}
                    downloadUrl={`/api/v1/projects/${projectId}/change-orders/${co.id}/export`}
                    telegramDelivery={{ projectId, artifactType: "change_order_pdf", entityId: co.id }}
                  />
                  {canWrite && (
                    <button
                      title={t("Delete", "Eliminar")}
                      onClick={() => setDeleteTarget({ id: co.id, label: co.number })}
                      style={{ padding: "4px 8px", border: "1px solid #FECACA", borderRadius: 4, background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          open
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setItems(prev => prev.filter(x => x.id !== deleteTarget.id));
            setDeleteTarget(null);
          }}
          endpoint={`/api/v1/projects/${projectId}/change-orders/${deleteTarget.id}`}
          entityLabel={`Change Order ${deleteTarget.label}`}
          warning={t("Linked RFIs/submittals will be detached.", "Los RFIs/entregables enlazados serán desvinculados.")}
        />
      )}
    </div>
  );
}
