import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock, ExternalLink, LayoutGrid,
  List, Loader2, Plus, Trash2,
} from "lucide-react";

interface ScheduleItem {
  id: number;
  source: "milestone" | "rfi" | "submittal";
  label: string;
  title: string;
  dueDate: string;
  status: string;
  priority?: string | null;
  company?: string | null;
  route?: string | null;
  linkedModule?: string | null;
  linkedId?: number | null;
  isOverdue?: boolean;
  createdAt?: string;
}

type LinkOption = {
  id: number;
  label: string;
  title: string;
  dueDate?: string | null;
  route: string;
};

const API = "/api/v1";

const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706",
  in_progress: "#2563EB",
  completed: "#16A34A",
  open: "#DC2626",
  follow_up: "#D97706",
  waiting_design: "#7C3AED",
  approved: "#16A34A",
  approved_as_noted: "#16A34A",
  resolved: "#16A34A",
  closed: "#16A34A",
  delayed: "#DC2626",
  cancelled: "#6B7280",
};

const MODULE_OPTIONS = [
  { value: "", label: "General Milestone", labelEs: "Hito General" },
  { value: "rfi", label: "Linked RFI", labelEs: "RFI Vinculado" },
  { value: "submittal", label: "Linked Submittal", labelEs: "Entregable Vinculado" },
  { value: "change_order", label: "Change Order Milestone", labelEs: "Hito de Orden de Cambio" },
  { value: "meeting", label: "Meeting Milestone", labelEs: "Hito de Reunión" },
];

export function ScheduleTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [rfis, setRfis] = useState<LinkOption[]>([]);
  const [submittals, setSubmittals] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"calendar" | "board" | "list">("board");
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState({ title: "", due_date: "", linked_module: "", linked_id: "" });

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [scheduleRes, rfiRes, submittalRes] = await Promise.all([
        fetch(`${API}/projects/${projectId}/schedule/live`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/projects/${projectId}/rfis`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/projects/${projectId}/submittals`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (scheduleRes.ok) setItems(await scheduleRes.json());
      if (rfiRes.ok) {
        const rows = await rfiRes.json();
        setRfis(rows.map((r: any) => ({
          id: r.id,
          label: r.number || `RFI-${r.id}`,
          title: r.subject || "Untitled RFI",
          dueDate: r.dateRequired || r.dueDate || null,
          route: `/projects/${projectId}/rfis?rfi=${r.id}`,
        })));
      }
      if (submittalRes.ok) {
        const rows = await submittalRes.json();
        setSubmittals(rows.map((s: any) => ({
          id: s.id,
          label: s.number || `SUB-${s.id}`,
          title: s.title || "Untitled submittal",
          dueDate: s.dateRequired || s.dueDate || null,
          route: `/projects/${projectId}/submittals`,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void load();
  }, [projectId, token]);

  const linkOptions = form.linked_module === "rfi" ? rfis : form.linked_module === "submittal" ? submittals : [];

  const applyLinkedItem = (id: string) => {
    const picked = linkOptions.find(o => String(o.id) === id);
    setForm(f => ({
      ...f,
      linked_id: id,
      title: picked && !f.title ? `${picked.label}: ${picked.title}` : f.title,
      due_date: picked?.dueDate ? String(picked.dueDate).slice(0, 10) : f.due_date,
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        title: form.title.trim(),
        due_date: form.due_date,
        linked_module: form.linked_module || undefined,
        linked_id: form.linked_id ? Number(form.linked_id) : undefined,
      };
      const r = await fetch(`${API}/projects/${projectId}/milestones`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Could not add milestone");
        return;
      }
      setShowForm(false);
      setForm({ title: "", due_date: "", linked_module: "", linked_id: "" });
      await load();
      setViewMode("board");
      toast({ title: t("Schedule item added", "Fecha agregada al cronograma") });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    const r = await fetch(`${API}/projects/${projectId}/milestones/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      toast({ title: t("Could not update schedule item", "No se pudo actualizar la fecha"), variant: "destructive" });
      return;
    }
    setSelected(prev => prev && prev.source === "milestone" && prev.id === id ? { ...prev, status } : prev);
    await load();
  };

  const deleteMilestone = async (id: number) => {
    if (!window.confirm(t("Delete this milestone?", "¿Eliminar este hito?"))) return;
    await fetch(`${API}/projects/${projectId}/milestones/${id}`, { method: "DELETE", headers });
    setSelected(null);
    await load();
  };

  const openItem = (item: ScheduleItem) => {
    setSelected(item);
  };

  const openNewForDate = (date: Date) => {
    if (!canWrite) return;
    setForm(f => ({ ...f, due_date: dayKey(date) }));
    setError("");
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "overdue") return items.filter(i => i.isOverdue && i.status !== "completed");
    if (filter === "action") return items.filter(i => i.status === "pending" || i.status === "open" || i.isOverdue);
    return items.filter(i => i.status === filter);
  }, [filter, items]);

  const total = items.length;
  const completed = items.filter(m => isDone(m.status)).length;
  const overdue = items.filter(m => m.isOverdue && !isDone(m.status)).length;
  const actionNeeded = items.filter(m => m.status === "pending" || m.status === "open" || (m.isOverdue && !isDone(m.status))).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  function isDone(status: string | null | undefined) {
    return ["completed", "closed", "resolved", "approved", "approved_as_noted"].includes((status || "").toLowerCase());
  }

  const statusBadge = (s: string, itemOverdue?: boolean) => {
    const color = itemOverdue && !isDone(s) ? "#DC2626" : STATUS_COLORS[s] ?? "#6B7280";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999,
        background: `${color}16`, color, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
      }}>
        {itemOverdue && !isDone(s) ? t("Overdue", "Vencido") : s.replace(/_/g, " ")}
      </span>
    );
  };

  const sourceBadge = (item: ScheduleItem) => {
    const color = item.source === "rfi" ? "#7C3AED" : item.source === "submittal" ? "#2563EB" : "#16A34A";
    return (
      <span style={{
        display: "inline-flex", padding: "3px 8px", borderRadius: 999,
        background: `${color}16`, color, fontSize: 10, fontWeight: 900, textTransform: "uppercase",
      }}>
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
  const dayKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const byDay = filtered.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const key = dayKey(new Date(item.dueDate));
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  const now = new Date();
  const inDays = (item: ScheduleItem) => Math.ceil((new Date(item.dueDate).getTime() - now.getTime()) / 86400000);
  const boardBuckets = [
    { key: "overdue", label: t("Overdue", "Vencidos"), rows: filtered.filter(i => i.isOverdue && !isDone(i.status)) },
    { key: "this-week", label: t("This Week", "Esta Semana"), rows: filtered.filter(i => !i.isOverdue && inDays(i) <= 7 && !isDone(i.status)) },
    { key: "next-week", label: t("Next Week", "Próxima Semana"), rows: filtered.filter(i => !i.isOverdue && inDays(i) > 7 && inDays(i) <= 14 && !isDone(i.status)) },
    { key: "later", label: t("Later", "Después"), rows: filtered.filter(i => !i.isOverdue && inDays(i) > 14 && !isDone(i.status)) },
    { key: "done", label: t("Completed", "Completados"), rows: filtered.filter(i => isDone(i.status)) },
  ];

  const smallButtonStyle = {
    border: "1px solid #D1D5DB",
    background: "white",
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  } as const;

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 22, margin: 0, color: "#0F172A" }}>{t("Coordination Schedule", "Cronograma de Coordinación")}</h2>
          <p style={{ margin: "5px 0 0", color: "#64748B", fontSize: 13 }}>
            {t("One live schedule for RFI due dates, submittal due dates, and manual project milestones.",
              "Un cronograma vivo para fechas de RFIs, entregables e hitos manuales del proyecto.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} />
              {t("Add Schedule Item", "Agregar Fecha")}
            </button>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 8, padding: "10px 12px", marginBottom: 14, color: "#1E3A5F", fontSize: 12 }}>
        <strong>{t("How this works:", "Cómo funciona:")}</strong>{" "}
        {t("RFIs and submittals appear automatically when they have a due date. Add Schedule Item is only for extra milestones or for linking a specific date to an RFI/submittal.",
          "Los RFIs y entregables aparecen automáticamente cuando tienen fecha requerida. Agregar Fecha es solo para hitos adicionales o para vincular una fecha específica a un RFI/entregable.")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        {[
          [t("Total Dates", "Fechas Totales"), total, "#1E3A5F"],
          [t("Action Needed", "Requiere Acción"), actionNeeded, actionNeeded ? "#D97706" : "#16A34A"],
          [t("Overdue", "Vencidos"), overdue, overdue ? "#DC2626" : "#16A34A"],
          [t("Completed", "Completados"), `${completed}/${total}`, "#2563EB"],
        ].map(([label, value, color]) => (
          <div key={String(label)} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 900, color: "#64748B" }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: String(color), marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>{t("Overall Progress", "Progreso General")}</div>
          <div style={{ fontWeight: 900, color: "#1D4ED8" }}>{pct}%</div>
        </div>
        <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#2563EB", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["all", t("All", "Todos")],
            ["action", t("Action Needed", "Requiere Acción")],
            ["pending", t("Pending", "Pendiente")],
            ["in_progress", t("In Progress", "En Progreso")],
            ["completed", t("Completed", "Completado")],
            ["overdue", t("Overdue", "Vencidos")],
          ].map(([key, label]) => (
            <button key={key} className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["board", t("Board", "Tablero"), LayoutGrid],
            ["calendar", t("Calendar", "Calendario"), Calendar],
            ["list", t("List", "Lista"), List],
          ].map(([key, label, Icon]) => (
            <button key={String(key)} className={`btn btn-sm ${viewMode === key ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode(key as "calendar" | "board" | "list")}>
              <Icon size={13} style={{ marginRight: 4 }} />
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 18, padding: 18, border: "1.5px solid #BFDBFE" }}>
          <h3 style={{ fontWeight: 800, margin: "0 0 4px", color: "#1E3A5F" }}>{t("Add Schedule Item", "Agregar Fecha")}</h3>
          <p style={{ margin: "0 0 14px", color: "#64748B", fontSize: 12 }}>
            {t("Use this for project milestones, or choose an RFI/Submittal and BIMLog will fill the title/date when available.",
              "Usa esto para hitos del proyecto, o escoge un RFI/entregable y BIMLog llenará título/fecha si existe.")}
          </p>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">{t("Item Type", "Tipo")}</label>
              <select className="input" value={form.linked_module} onChange={e => setForm(f => ({ ...f, linked_module: e.target.value, linked_id: "" }))}>
                {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </select>
            </div>
            {(form.linked_module === "rfi" || form.linked_module === "submittal") && (
              <div>
                <label className="label">{form.linked_module === "rfi" ? "RFI" : t("Submittal", "Entregable")}</label>
                <select className="input" value={form.linked_id} onChange={e => applyLinkedItem(e.target.value)}>
                  <option value="">{t("Select item", "Seleccionar item")}</option>
                  {linkOptions.map(o => <option key={o.id} value={String(o.id)}>{o.label}: {o.title}</option>)}
                </select>
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Title", "Título")} *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Due Date", "Fecha Límite")} *</label>
              <input className="input" type="date" required value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <Loader2 size={13} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> : null}
                {saving ? t("Saving...", "Guardando...") : t("Add to Schedule", "Agregar al Cronograma")}
              </button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>
                {t("Cancel", "Cancelar")}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading schedule...", "Cargando cronograma...")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF", background: "white", border: "1px solid #E5E7EB", borderRadius: 8 }}>
          <Calendar size={42} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 700 }}>{t("No schedule dates found", "No hay fechas en el cronograma")}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t("Add a date required to an RFI/submittal, or create a manual schedule item.", "Agrega fecha requerida a un RFI/entregable, o crea una fecha manual.")}</div>
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(190px, 1fr))", gap: 12, alignItems: "start" }}>
          {boardBuckets.map(bucket => (
            <div key={bucket.key} className="card" style={{ padding: 10, minHeight: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#1E3A5F" }}>{bucket.label}</div>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#64748B" }}>{bucket.rows.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bucket.rows.map(item => (
                  <ScheduleCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    canWrite={canWrite}
                    onOpen={() => openItem(item)}
                    onStart={() => updateStatus(item.id, "in_progress")}
                    onDone={() => updateStatus(item.id, "completed")}
                    sourceBadge={sourceBadge}
                    statusBadge={statusBadge}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "calendar" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontWeight: 900, color: "#1E3A5F" }}>
            {thisMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", background: "#E5E7EB", gap: 1 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} style={{ background: "#F8FAFC", padding: "8px 10px", fontSize: 11, fontWeight: 900, color: "#64748B" }}>{day}</div>
            ))}
            {calendarDays.map(day => {
              const events = byDay[dayKey(day)] || [];
              const inMonth = day.getMonth() === thisMonth.getMonth();
              return (
                <div
                  key={dayKey(day)}
                  onClick={() => openNewForDate(day)}
                  title={canWrite ? t("Click to add a schedule item on this date", "Clic para agregar una fecha en este dia") : undefined}
                  style={{
                    minHeight: 118,
                    background: "white",
                    padding: 8,
                    opacity: inMonth ? 1 : 0.45,
                    cursor: canWrite ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>{day.getDate()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {events.slice(0, 4).map(item => (
                      <button key={`${item.source}-${item.id}`} onClick={(e) => { e.stopPropagation(); openItem(item); }}
                        style={{ textAlign: "left", border: "1px solid #DBEAFE", background: item.isOverdue ? "#FEF2F2" : "#EFF6FF", color: "#1E3A5F", borderRadius: 5, padding: "4px 5px", fontSize: 10, cursor: "pointer" }}>
                        <strong>{item.label}</strong> {item.title}
                      </button>
                    ))}
                    {events.length > 4 && <div style={{ fontSize: 10, color: "#64748B" }}>+{events.length - 4} {t("more", "más")}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "list" && (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1E3A5F", color: "white" }}>
                {["Source", "Title", "Due Date", "Company", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "9px 10px", fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={`${item.source}-${item.id}`} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <td style={{ padding: 10 }}>{sourceBadge(item)}</td>
                  <td style={{ padding: 10, fontSize: 12, fontWeight: 700 }}>{item.title}</td>
                  <td style={{ padding: 10, fontSize: 12, whiteSpace: "nowrap" }}>{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{item.company || "-"}</td>
                  <td style={{ padding: 10 }}>{statusBadge(item.status, item.isOverdue)}</td>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                    <button style={smallButtonStyle} onClick={() => openItem(item)}>
                      <ExternalLink size={12} /> {t("Details", "Detalle")}
                    </button>
                    {canWrite && item.source === "milestone" && !isDone(item.status) && (
                      <button style={{ ...smallButtonStyle, marginLeft: 6 }} onClick={() => updateStatus(item.id, "completed")}>
                        <CheckCircle2 size={12} /> {t("Done", "Listo")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 1000 }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 460, background: "white", boxShadow: "-8px 0 28px rgba(15,23,42,0.18)", padding: 20, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>{selected.label}</div>
                <h3 style={{ margin: "4px 0 0", color: "#0F172A" }}>{selected.title}</h3>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <Detail label={t("Due Date", "Fecha Límite")} value={new Date(selected.dueDate).toLocaleDateString()} />
              <Detail label={t("Status", "Estado")} value={selected.isOverdue && !isDone(selected.status) ? t("Overdue", "Vencido") : selected.status.replace(/_/g, " ")} />
              <Detail label={t("Company", "Empresa")} value={selected.company || "-"} />
              <Detail label={t("Linked Module", "Módulo Vinculado")} value={selected.linkedModule || selected.source} />
            </div>
            {selected.route && (
              <div style={{ marginTop: 16, padding: 12, border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#1E3A5F", marginBottom: 10 }}>
                  {selected.source === "milestone"
                    ? t("This manual schedule item is linked to another BIMLog record.", "Esta fecha manual esta vinculada a otro registro de BIMLog.")
                    : t("This date comes from the linked record. Edit the source record to change its date or status.", "Esta fecha viene del registro vinculado. Edita el registro fuente para cambiar fecha o estado.")}
                </div>
                <button className="btn btn-primary" onClick={() => { window.location.href = selected.route!; }}>
                  <ExternalLink size={13} style={{ marginRight: 4 }} />{t("Open Linked Record", "Abrir Registro Vinculado")}
                </button>
              </div>
            )}
            {canWrite && selected.source === "milestone" && (
              <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                {!isDone(selected.status) && (
                  <>
                    <button className="btn btn-outline" onClick={() => updateStatus(selected.id, "in_progress")}>
                      <Clock size={13} style={{ marginRight: 4 }} />{t("Mark In Progress", "Marcar En Progreso")}
                    </button>
                    <button className="btn btn-primary" onClick={() => updateStatus(selected.id, "completed")}>
                      <CheckCircle2 size={13} style={{ marginRight: 4 }} />{t("Mark Done", "Marcar Listo")}
                    </button>
                  </>
                )}
                <button className="btn btn-outline" style={{ color: "#DC2626", borderColor: "#FECACA" }} onClick={() => deleteMilestone(selected.id)}>
                  <Trash2 size={13} style={{ marginRight: 4 }} />{t("Delete", "Eliminar")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderBottom: "1px solid #E5E7EB", paddingBottom: 8 }}>
      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#0F172A", marginTop: 3 }}>{value}</div>
    </div>
  );
}

function ScheduleCard({
  item,
  canWrite,
  onOpen,
  onStart,
  onDone,
  sourceBadge,
  statusBadge,
  t,
}: {
  item: ScheduleItem;
  canWrite: boolean;
  onOpen: () => void;
  onStart: () => void;
  onDone: () => void;
  sourceBadge: (item: ScheduleItem) => ReactNode;
  statusBadge: (status: string, overdue?: boolean) => ReactNode;
  t: (en: string, es: string) => string;
}) {
  const done = ["completed", "closed", "resolved", "approved", "approved_as_noted"].includes((item.status || "").toLowerCase());
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, background: item.isOverdue && !done ? "#FEF2F2" : "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
        {sourceBadge(item)}
        {statusBadge(item.status, item.isOverdue)}
      </div>
      <button onClick={onOpen} style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", lineHeight: 1.35 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
          {new Date(item.dueDate).toLocaleDateString()}{item.company ? ` - ${item.company}` : ""}
        </div>
      </button>
      <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
        <button className="btn btn-sm btn-outline" onClick={onOpen}>
          <ExternalLink size={11} style={{ marginRight: 3 }} />{t("Details", "Detalle")}
        </button>
        {canWrite && item.source === "milestone" && !done && (
          <>
            {item.status !== "in_progress" && (
              <button className="btn btn-sm btn-outline" onClick={onStart}>{t("Start", "Iniciar")}</button>
            )}
            <button className="btn btn-sm btn-outline" onClick={onDone}>{t("Done", "Listo")}</button>
          </>
        )}
      </div>
    </div>
  );
}
