import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { AlertTriangle, Calendar } from "lucide-react";

interface Milestone {
  id: number; title: string; dueDate: string; status: string;
  linkedModule?: string; isOverdue?: boolean; createdAt: string;
}

const API = "/api/v1";

const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706", in_progress: "#2563EB", completed: "#16A34A",
  delayed: "#DC2626", cancelled: "#6B7280",
};

export function ScheduleTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "", linked_module: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/projects/${projectId}/schedule/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImportMsg(`${data.imported ?? 0} milestones imported successfully`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setImportMsg("Import failed — please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/milestones`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setItems(await r.json());
    } finally { setLoading(false); setLoaded(true); }
  };

  if (!loaded && !loading) { load(); }

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/milestones`, {
        method: "POST", headers, body: JSON.stringify({ title: form.title, due_date: form.due_date, linked_module: form.linked_module || undefined }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ title: "", due_date: "", linked_module: "" });
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`${API}/projects/${projectId}/milestones/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status }),
    });
    await load();
  };

  const filtered = filter === "all" ? items : filter === "overdue" ? items.filter(i => i.isOverdue) : items.filter(i => i.status === filter);

  const total = items.length;
  const completed = items.filter(m => m.status === "completed").length;
  const overdue = items.filter(m => m.isOverdue).length;
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;

  const statusBadge = (s: string, overdue?: boolean) => (
    <span style={{ padding: "2px 8px", borderRadius: 20, background: `${STATUS_COLORS[s] ?? "#6B7280"}20`, color: overdue && s !== "completed" ? "#DC2626" : STATUS_COLORS[s] ?? "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
      {overdue && s !== "completed" ? t("OVERDUE", "VENCIDO") : s.replace(/_/g, " ")}
    </span>
  );

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Schedule & Milestones", "Cronograma e Hitos")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>{t("Track project milestones and key dates", "Rastrea hitos y fechas clave del proyecto")}</p>
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
              + {t("Add Milestone", "Agregar Hito")}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{t("Overall Progress", "Progreso General")}</div>
            <div style={{ fontWeight: 700, color: "#1D4ED8" }}>{pct}%</div>
          </div>
          <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#2563EB", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#6B7280" }}>
            <span>{t("Completed", "Completados")}: {completed}/{total}</span>
            {overdue > 0 && <span style={{ color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={13} /> {overdue} {t("overdue", "vencidos")}</span>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "pending", "in_progress", "completed", "overdue"].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(s)}>
            {t(s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1),
              s === "all" ? "Todos" : s === "pending" ? "Pendiente" : s === "in_progress" ? "En Progreso" : s === "completed" ? "Completado" : "Vencidos")}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("Add Milestone", "Agregar Hito")}</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Title", "Título")} *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Due Date", "Fecha Límite")} *</label>
              <input className="input" type="date" required value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Linked Module", "Módulo Vinculado")}</label>
              <select className="input" value={form.linked_module} onChange={e => setForm(f => ({ ...f, linked_module: e.target.value }))}>
                <option value="">{t("None", "Ninguno")}</option>
                <option value="rfi">RFI</option>
                <option value="submittal">{t("Submittal", "Submittal")}</option>
                <option value="change_order">{t("Change Order", "Orden de Cambio")}</option>
                <option value="meeting">{t("Meeting", "Reunión")}</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…", "Guardando…") : t("Add", "Agregar")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading…", "Cargando…")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Calendar size={40} color="#D1D5DB" /></div>
          <div style={{ fontWeight: 600 }}>{t("No milestones yet", "Sin hitos aún")}</div>
          <div style={{ fontSize: 13 }}>{t("Add key dates and deliverables to track project progress", "Agrega fechas clave para rastrear el avance del proyecto")}</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(ms => (
            <div key={ms.id} className="card" style={{ padding: "12px 16px", borderLeft: `3px solid ${ms.isOverdue && ms.status !== "completed" ? "#DC2626" : STATUS_COLORS[ms.status] ?? "#6B7280"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{ms.title}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    <Calendar size={11} style={{ marginRight: 3 }} />{new Date(ms.dueDate).toLocaleDateString()}
                    {ms.linkedModule && <span> · {ms.linkedModule}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {statusBadge(ms.status, ms.isOverdue)}
                  {canWrite && ms.status !== "completed" && (
                    <button className="btn btn-sm btn-outline" onClick={() => updateStatus(ms.id, "completed")}>✓</button>
                  )}
                  {canWrite && ms.status !== "in_progress" && ms.status !== "completed" && (
                    <button className="btn btn-sm btn-outline" onClick={() => updateStatus(ms.id, "in_progress")}>{t("Start", "Iniciar")}</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
