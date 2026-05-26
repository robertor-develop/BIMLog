import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { ClipboardList, DollarSign, Calendar, Sparkles } from "lucide-react";

interface ChangeOrder {
  id: number; number: string; title: string; description?: string;
  status: string; contractValueImpact?: string; scheduleImpactDays?: number;
  createdAt: string; approvedAt?: string;
}

const API = "/api/v1";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", pending_approval: "#D97706", approved: "#16A34A",
  rejected: "#DC2626",
};

export function ChangeOrdersTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", contract_value_impact: "", schedule_impact_days: "" });
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
  const [filter, setFilter] = useState("all");

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
      const body: Record<string, unknown> = { title: form.title, description: form.description || undefined, contract_value_impact: form.contract_value_impact || undefined };
      if (form.schedule_impact_days) body.schedule_impact_days = Number(form.schedule_impact_days);
      const r = await fetch(`${API}/projects/${projectId}/change-orders`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ title: "", description: "", contract_value_impact: "", schedule_impact_days: "" });
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

  const exportPdf = (id: number) => {
    window.open(`${API}/projects/${projectId}/change-orders/${id}/export?token=${token}`, "_blank");
  };

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);

  const statusBadge = (s: string) => (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: `${STATUS_COLORS[s] ?? "#6B7280"}20`, color: STATUS_COLORS[s] ?? "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
      {s.replace(/_/g, " ")}
    </span>
  );

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Change Orders", "Órdenes de Cambio")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>{t("Track contract changes with full audit trail", "Rastrea cambios de contrato con historial completo")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "draft", "pending_approval", "approved", "rejected"].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(s)}>
            {t(s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
              s === "all" ? "Todos" : s === "draft" ? "Borrador" : s === "pending_approval" ? "Pendiente" : s === "approved" ? "Aprobado" : "Rechazado")}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("New Change Order", "Nueva Orden de Cambio")}</h3>
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
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…", "Guardando…") : t("Create", "Crear")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading…", "Cargando…")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><ClipboardList size={40} color="#D1D5DB" /></div>
          <div style={{ fontWeight: 600 }}>{t("No change orders yet", "Sin órdenes de cambio aún")}</div>
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
                  <button className="btn btn-sm btn-outline" onClick={() => exportPdf(co.id)}>PDF</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
