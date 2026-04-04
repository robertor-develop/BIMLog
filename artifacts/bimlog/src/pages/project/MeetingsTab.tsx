import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { ClipboardList, CheckCircle2, BookOpen, Calendar, MapPin, Users, Sparkles, AlertTriangle } from "lucide-react";

interface Meeting {
  id: number; title: string; meetingDate: string; location?: string;
  notes?: string; aiSummary?: string; attendeeCount: number;
  openActionItems: number; actionItemCount: number; createdAt: string;
}

interface ActionItem {
  id: number; description: string; assignedToName?: string;
  dueDate?: string; status: string; isOverdue?: boolean;
}

const API = "/api/v1";

export function MeetingsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"meetings" | "actions">("meetings");
  const [form, setForm] = useState({ title: "", meeting_date: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [mr, ar] = await Promise.all([
        fetch(`${API}/projects/${projectId}/meetings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/projects/${projectId}/action-items`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (mr.ok) setMeetings(await mr.json());
      if (ar.ok) setActionItems(await ar.json());
    } finally { setLoading(false); setLoaded(true); }
  };

  if (!loaded && !loading) { load(); }

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/meetings`, {
        method: "POST", headers, body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ title: "", meeting_date: "", location: "", notes: "" });
    } finally { setSaving(false); }
  };

  const aiSummary = async (id: number) => {
    setAiLoading(true); setActiveMeeting(id);
    try {
      const r = await fetch(`${API}/projects/${projectId}/meetings/${id}/ai-summary`, { method: "POST", headers });
      if (r.ok) {
        const d = await r.json();
        setMeetings(prev => prev.map(m => m.id === id ? { ...m, aiSummary: d.summary } : m));
        if (d.action_items?.length) {
          const ar = await fetch(`${API}/projects/${projectId}/meetings/${id}/action-items`, {
            method: "POST", headers,
            body: JSON.stringify({ items: d.action_items.map((ai: { description: string; assigned_to_name?: string; assigned_to_email?: string; due_date?: string }) => ({
              description: ai.description,
              assigned_to_name: ai.assigned_to_name ?? null,
              assigned_to_email: ai.assigned_to_email ?? null,
              due_date: ai.due_date ?? null,
            })) }),
          });
          if (!ar.ok) { const dd = await ar.json().catch(() => ({})); setError(dd.error || "Request failed"); return; }
          await load();
        }
      }
    } finally { setAiLoading(false); setActiveMeeting(null); }
  };

  const updateActionItem = async (id: number, status: string) => {
    await fetch(`${API}/projects/${projectId}/action-items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status }),
    });
    await load();
  };

  const openActions = actionItems.filter(a => a.status !== "completed" && a.status !== "cancelled");
  const overdueActions = actionItems.filter(a => a.isOverdue);

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Meeting Minutes", "Actas de Reunión")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>{t("Record meetings and track action items with AI summaries", "Registra reuniones y acción items con resúmenes IA")}</p>
        </div>
        {canWrite && view === "meetings" && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + {t("New Meeting", "Nueva Reunión")}
          </button>
        )}
      </div>

      {/* Stats banner */}
      {actionItems.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: "10px 16px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{actionItems.length}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{t("Total Actions", "Total Acciones")}</div>
          </div>
          <div className="card" style={{ padding: "10px 16px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#D97706" }}>{openActions.length}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{t("Open", "Abiertas")}</div>
          </div>
          <div className="card" style={{ padding: "10px 16px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: overdueActions.length > 0 ? "#DC2626" : "#16A34A" }}>{overdueActions.length}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{t("Overdue", "Vencidas")}</div>
          </div>
          <div className="card" style={{ padding: "10px 16px", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#16A34A" }}>{actionItems.filter(a => a.status === "completed").length}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{t("Completed", "Completadas")}</div>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${view === "meetings" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("meetings")}>
          <ClipboardList size={14} style={{ marginRight: 4 }} />{t("Meetings", "Reuniones")}
        </button>
        <button className={`btn btn-sm ${view === "actions" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("actions")}>
          <CheckCircle2 size={14} style={{ marginRight: 4 }} />{t("Action Items", "Ítems de Acción")} {openActions.length > 0 && `(${openActions.length})`}
        </button>
      </div>

      {showForm && view === "meetings" && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("New Meeting", "Nueva Reunión")}</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Meeting Title", "Título de Reunión")} *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Date & Time", "Fecha y Hora")} *</label>
              <input className="input" type="datetime-local" required value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Location", "Lugar")}</label>
              <input className="input" placeholder={t("Conference Room / Zoom / Site", "Sala / Zoom / Obra")} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Notes / Agenda", "Notas / Agenda")}</label>
              <textarea className="input" rows={5} placeholder={t("Paste or type meeting notes here…", "Pega o escribe las notas aquí…")} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…", "Guardando…") : t("Create", "Crear")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading…", "Cargando…")}</div>}

      {/* Meetings view */}
      {!loading && view === "meetings" && (
        <>
          {meetings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><BookOpen size={40} color="#D1D5DB" /></div>
              <div style={{ fontWeight: 600 }}>{t("No meetings recorded yet", "Sin reuniones registradas aún")}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {meetings.map(m => (
                <div key={m.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                        <Calendar size={11} style={{ marginRight: 3 }} />{new Date(m.meetingDate).toLocaleDateString()} {new Date(m.meetingDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {m.location && <span style={{ display: "inline-flex", alignItems: "center" }}> · <MapPin size={11} style={{ margin: "0 3px" }} />{m.location}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Users size={11} /> {m.attendeeCount} {t("attendees", "asistentes")}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={11} /> {m.openActionItems}/{m.actionItemCount} {t("open actions", "acciones abiertas")}</span>
                      </div>
                      {m.aiSummary && (
                        <div style={{ marginTop: 10, padding: 10, background: "#EFF6FF", borderRadius: 8, borderLeft: "3px solid #2563EB" }}>
                          <div style={{ fontSize: 11, color: "#1D4ED8", fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><Sparkles size={11} /> AI Summary</div>
                          <div style={{ fontSize: 12, color: "#374151" }}>{m.aiSummary}</div>
                        </div>
                      )}
                    </div>
                    {canWrite && !m.aiSummary && (
                      <button className="btn btn-sm btn-outline" onClick={() => aiSummary(m.id)} disabled={aiLoading && activeMeeting === m.id} style={{ marginLeft: 12 }}>
                        {aiLoading && activeMeeting === m.id ? "…" : <><Sparkles size={12} style={{ marginRight: 4 }} />{t("AI Summary", "Resumen IA")}</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Action items view */}
      {!loading && view === "actions" && (
        <>
          {actionItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><CheckCircle2 size={40} color="#D1D5DB" /></div>
              <div style={{ fontWeight: 600 }}>{t("No action items yet", "Sin ítems de acción aún")}</div>
            </div>
          ) : (
            <div className="card">
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>{t("Description", "Descripción")}</th>
                    <th>{t("Assigned To", "Asignado a")}</th>
                    <th>{t("Due Date", "Fecha Límite")}</th>
                    <th>{t("Status", "Estado")}</th>
                    {canWrite && <th style={{ textAlign: "right" }}>{t("Action", "Acción")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map(ai => (
                    <tr key={ai.id} style={{ background: ai.isOverdue ? "#FEF2F2" : undefined }}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{ai.description}</div>
                        {ai.isOverdue && <div style={{ fontSize: 11, color: "#DC2626", display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={11} /> {t("Overdue", "Vencido")}</div>}
                      </td>
                      <td>{ai.assignedToName || "—"}</td>
                      <td style={{ fontSize: 12 }}>{ai.dueDate ? new Date(ai.dueDate).toLocaleDateString() : "—"}</td>
                      <td>
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: ai.status === "completed" ? "#DCFCE7" : ai.isOverdue ? "#FEE2E2" : "#FEF3C7", color: ai.status === "completed" ? "#16A34A" : ai.isOverdue ? "#DC2626" : "#D97706" }}>
                          {ai.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: "right" }}>
                          {ai.status !== "completed" && (
                            <button className="btn btn-sm btn-outline" onClick={() => updateActionItem(ai.id, "completed")}>✓ {t("Done", "Listo")}</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
