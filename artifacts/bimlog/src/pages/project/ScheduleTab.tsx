import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { AlertTriangle, Calendar } from "lucide-react";

interface ScheduleItem {
  id: number; source: "milestone" | "rfi" | "submittal"; label: string;
  title: string; dueDate: string; status: string; priority?: string | null;
  company?: string | null; route?: string | null; linkedModule?: string | null;
  isOverdue?: boolean; createdAt?: string;
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

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "", linked_module: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "board">("calendar");

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
      const r = await fetch(`${API}/projects/${projectId}/schedule/live`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setItems(await r.json());
    } finally { setLoading(false); setLoaded(true); }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [projectId, token]);

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

  const sourceBadge = (item: ScheduleItem) => {
    const color = item.source === "rfi" ? "#7C3AED" : item.source === "submittal" ? "#2563EB" : "#16A34A";
    return (
      <span style={{ padding: "2px 7px", borderRadius: 20, background: `${color}16`, color, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
        {item.label}
      </span>
    );
  };

  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(calendarStart);
    d.setDate(calendarStart.getDate() + i);
    return d;
  });
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = filtered.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const key = dayKey(new Date(item.dueDate));
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const now = new Date();
  const inDays = (item: ScheduleItem) => Math.ceil((new Date(item.dueDate).getTime() - now.getTime()) / 86400000);
  const boardBuckets = [
    { key: "overdue", label: t("Overdue", "Vencidos"), rows: filtered.filter(i => i.isOverdue && i.status !== "completed") },
    { key: "this-week", label: t("This Week", "Esta Semana"), rows: filtered.filter(i => !i.isOverdue && inDays(i) <= 7 && i.status !== "completed") },
    { key: "next-week", label: t("Next Week", "Próxima Semana"), rows: filtered.filter(i => !i.isOverdue && inDays(i) > 7 && inDays(i) <= 14 && i.status !== "completed") },
    { key: "later", label: t("Later", "Después"), rows: filtered.filter(i => !i.isOverdue && inDays(i) > 14 && i.status !== "completed") },
    { key: "done", label: t("Completed", "Completados"), rows: filtered.filter(i => i.status === "completed" || ["closed", "resolved", "approved", "approved_as_noted"].includes(i.status)) },
  ];

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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          ["calendar", t("Calendar", "Calendario")],
          ["board", t("Board", "Tablero")],
          ["list", t("List", "Lista")],
        ].map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${viewMode === key ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode(key as "list" | "calendar" | "board")}>
            {label}
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

      {!loading && filtered.length > 0 && viewMode === "calendar" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontWeight: 800, color: "#1E3A5F" }}>
            {thisMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", background: "#E5E7EB", gap: 1 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} style={{ background: "#F8FAFC", padding: "8px 10px", fontSize: 11, fontWeight: 800, color: "#64748B" }}>{day}</div>
            ))}
            {calendarDays.map((day) => {
              const events = byDay[dayKey(day)] || [];
              const inMonth = day.getMonth() === thisMonth.getMonth();
              return (
                <div key={dayKey(day)} style={{ minHeight: 112, background: "white", padding: 8, opacity: inMonth ? 1 : 0.45 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>{day.getDate()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {events.slice(0, 4).map(item => (
                      <button key={`${item.source}-${item.id}`} onClick={() => item.route && (window.location.href = item.route)}
                        style={{ textAlign: "left", border: "1px solid #DBEAFE", background: item.isOverdue ? "#FEF2F2" : "#EFF6FF", color: "#1E3A5F", borderRadius: 5, padding: "4px 5px", fontSize: 10, cursor: item.route ? "pointer" : "default" }}>
                        <strong>{item.label}</strong> {item.title}
                      </button>
                    ))}
                    {events.length > 4 && <div style={{ fontSize: 10, color: "#64748B" }}>+{events.length - 4} {t("more", "mas")}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 12, alignItems: "start" }}>
          {boardBuckets.map(bucket => (
            <div key={bucket.key} className="card" style={{ padding: 10, minHeight: 180 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A5F" }}>{bucket.label}</div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B" }}>{bucket.rows.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bucket.rows.map(item => (
                  <div key={`${item.source}-${item.id}`} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 9, background: item.isOverdue ? "#FEF2F2" : "white" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>{sourceBadge(item)}{statusBadge(item.status, item.isOverdue)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 5 }}>{new Date(item.dueDate).toLocaleDateString()}{item.company ? ` - ${item.company}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(ms => (
            <div key={`${ms.source}-${ms.id}`} className="card" style={{ padding: "12px 16px", borderLeft: `3px solid ${ms.isOverdue && ms.status !== "completed" ? "#DC2626" : STATUS_COLORS[ms.status] ?? "#6B7280"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    {sourceBadge(ms)}
                    <div style={{ fontWeight: 600 }}>{ms.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    <Calendar size={11} style={{ marginRight: 3 }} />{new Date(ms.dueDate).toLocaleDateString()}
                    {ms.company && <span> - {ms.company}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {statusBadge(ms.status, ms.isOverdue)}
                  {canWrite && ms.source === "milestone" && ms.status !== "completed" && (
                    <button className="btn btn-sm btn-outline" onClick={() => updateStatus(ms.id, "completed")}>Done</button>
                  )}
                  {canWrite && ms.source === "milestone" && ms.status !== "in_progress" && ms.status !== "completed" && (
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
