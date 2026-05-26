import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Trash2 } from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { isDebug } from "@/lib/debug";
import {
  ClipboardList, CheckCircle2, Calendar, MapPin, Users,
  Sparkles, AlertTriangle, Plus, Download, ChevronDown,
  ChevronUp
} from "lucide-react";

const API = "/api/v1";

interface Meeting {
  id: number; title: string; meetingDate: string; location?: string;
  notes?: string; aiSummary?: string; attendeeCount: number;
  openActionItems: number; actionItemCount: number; createdAt: string;
}

interface Attendee {
  id?: number; trade: string; company: string; fullName: string;
  role: string; email: string; phone: string;
}

interface RFIRow {
  rfiNumber: string; description: string; status: string; responsible: string;
}

interface DeliverableRow {
  floor: string; description: string; plumbing: string; hvac: string;
  fireProt: string; electrical: string; other: string; coordinator: string; deadline: string;
}

interface ViewpointRow {
  floor: string; responsible: string; holdUps: string;
  viewpoint: string; description: string; deadline: string;
}

interface ActionItem {
  id: number; description: string; assignedToName?: string;
  dueDate?: string; status: string; isOverdue?: boolean;
}

const STATUS_OPTIONS = ["PENDING", "COMPLETE", "N/A", ""];
const CELL_STYLE = {
  border: "1px solid #E5E7EB", padding: "6px 8px",
  fontSize: 12, verticalAlign: "middle" as const
};
const TH_STYLE = {
  ...CELL_STYLE, background: "#1E3A5F", color: "white",
  fontWeight: 700, fontSize: 11, textTransform: "uppercase" as const
};

function StatusCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const color = value === "COMPLETE" ? "#DCFCE7" : value === "PENDING" ? "#FEF3C7" : value === "N/A" ? "#F3F4F6" : "white";
  const textColor = value === "COMPLETE" ? "#16A34A" : value === "PENDING" ? "#D97706" : "#6B7280";
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: color, color: textColor, border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 11, fontWeight: 600, padding: "2px 4px", width: "100%" }}>
      {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o || "—"}</option>)}
    </select>
  );
}

export function MeetingsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [view, setView] = useState<"list" | "new" | "detail" | "actions">("list");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    agenda: true, attendees: true, rfis: true, deliverables: true, viewpoints: true
  });

  const [meetingNumber, setMeetingNumber] = useState("");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [agendaItems, setAgendaItems] = useState<string[]>(["", "", "", ""]);
  const [attendees, setAttendees] = useState<Attendee[]>([
    { trade: "", company: "", fullName: "", role: "", email: "", phone: "" }
  ]);
  const [rfis, setRfis] = useState<RFIRow[]>([
    { rfiNumber: "", description: "", status: "PENDING", responsible: "" }
  ]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([
    { floor: "UNDERGROUND", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
    { floor: "CELLAR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
    { floor: "1ST FLOOR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
  ]);
  const [viewpoints, setViewpoints] = useState<ViewpointRow[]>([
    { floor: "", responsible: "", holdUps: "", viewpoint: "", description: "", deadline: "" }
  ]);
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [audioUploading, setAudioUploading] = useState(false);
  const [showNoKeyModal, setShowNoKeyModal] = useState(false);
  const [audioProgress, setAudioProgress] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/projects/${projectId}/meetings/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setImportMsg(d.message || "Import failed");
        return;
      }
      const data = await res.json();
      setImportMsg(`Meeting imported successfully — ${data.title || "untitled"}`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setImportMsg("Import failed — please try again");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // import message display handled inline
  const loadMeetings = async () => {
    setLoading(true);
    try {
      const [mr, ar] = await Promise.all([
        fetch(`${API}/projects/${projectId}/meetings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/projects/${projectId}/action-items`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (mr.ok) setMeetings(await mr.json());
      if (ar.ok) setActionItems(await ar.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { loadMeetings(); }, [projectId]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = [".mp3",".mp4",".m4a",".wav",".webm",".ogg"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Unsupported format. Use MP3, MP4, M4A, WAV, WebM, or OGG.");
      return;
    }
    setAudioUploading(true);
    const fileSizeMB = Math.round(file.size / 1024 / 1024);
    if (fileSizeMB > 100) {
      setAudioProgress(`Large file (${fileSizeMB}MB) — compressing and splitting into parts. This may take a few minutes...`);
    } else if (fileSizeMB > 25) {
      setAudioProgress(`File is ${fileSizeMB}MB — compressing before upload...`);
    } else {
      setAudioProgress(`Uploading (${fileSizeMB}MB)...`);
    }
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const r = await fetch(`${API}/projects/${projectId}/meetings/transcribe-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: "parse_failed", message: "Could not read server response" }));
        if (d.error === "no_openai_key") {
          setShowNoKeyModal(true);
        } else {
          setError(`Error: ${d.message || d.error || "Unknown — check API server logs"}`);
        }
        return;
      }
      setAudioProgress("Extracting meeting data with AI...");
      const data = await r.json();
      if (data.title) setTitle(data.title);
      if (data.agenda?.length) setAgendaItems(data.agenda);
      if (data.attendees?.length) setAttendees(data.attendees);
      if (data.rfis?.length) setRfis(data.rfis);
      if (data.deliverables?.length) setDeliverables(data.deliverables);
      if (data.viewpoints?.length) setViewpoints(data.viewpoints);
      if (data.aiSummary) setAiSummaryText(data.aiSummary);
      setAudioProgress("");
    } catch (err) {
      setError(`Audio upload failed: ${err instanceof Error ? err.message : String(err)}${isDebug() ? " (debug: check console)" : ""}`);
    } finally {
      setAudioUploading(false);
      setAudioProgress("");
      e.target.value = "";
    }
  };

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const resetForm = () => {
    const nextNum = String(meetings.length + 1).padStart(2, "0");
    setMeetingNumber(nextNum);
    setTitle(""); setMeetingDate(""); setMeetingTime("10:00"); setLocation("");
    setAgendaItems(["", "", "", ""]);
    setAttendees([{ trade: "", company: "", fullName: "", role: "", email: "", phone: "" }]);
    setRfis([{ rfiNumber: "", description: "", status: "PENDING", responsible: "" }]);
    setDeliverables([
      { floor: "UNDERGROUND", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
      { floor: "CELLAR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
      { floor: "1ST FLOOR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
    ]);
    setViewpoints([{ floor: "", responsible: "", holdUps: "", viewpoint: "", description: "", deadline: "" }]);
    setAiSummaryText("");
    setError("");
  };

  const openNew = () => { resetForm(); setView("new"); };

  const buildNotes = () => {
    const parts: string[] = [];
    const agenda = agendaItems.filter(Boolean);
    if (agenda.length) parts.push("AGENDA:\n" + agenda.map((a, i) => `${i + 1}. ${a}`).join("\n"));
    const att = attendees.filter(a => a.fullName);
    if (att.length) parts.push("ATTENDEES:\n" + att.map(a => `${a.trade} | ${a.company} | ${a.fullName} | ${a.role} | ${a.email} | ${a.phone}`).join("\n"));
    const rfiRows = rfis.filter(r => r.description);
    if (rfiRows.length) parts.push("RFIS:\n" + rfiRows.map(r => `${r.rfiNumber} | ${r.description} | ${r.status} | ${r.responsible}`).join("\n"));
    const delRows = deliverables.filter(d => d.description || d.plumbing || d.hvac);
    if (delRows.length) parts.push("DELIVERABLES:\n" + delRows.map(d => `${d.floor} | ${d.description} | PL:${d.plumbing} | HVAC:${d.hvac} | FP:${d.fireProt} | ELE:${d.electrical} | DEADLINE:${d.deadline}`).join("\n"));
    const vpRows = viewpoints.filter(v => v.description);
    if (vpRows.length) parts.push("VIEWPOINTS:\n" + vpRows.map(v => `${v.floor} | ${v.responsible} | ${v.viewpoint} | ${v.description} | ${v.deadline}`).join("\n"));
    return parts.join("\n\n");
  };

  const saveMeeting = async () => {
    if (!title || !meetingDate) { setError("Title and date are required"); return; }
    setSaving(true); setError("");
    try {
      const dateTime = `${meetingDate}T${meetingTime}:00`;
      const notes = buildNotes();
      const body = {
        title,
        meeting_date: dateTime,
        location,
        notes,
        attendees: attendees.filter(a => a.fullName).map(a => ({
          full_name: a.fullName, company: a.company,
          role: a.role, external_email: a.email || undefined,
        })),
      };
      const r = await fetch(`${API}/projects/${projectId}/meetings`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error saving"); return; }
      await loadMeetings();
      setView("list");
    } finally { setSaving(false); }
  };

  const generateAISummary = async () => {
    if (!title || !meetingDate) { setError("Enter title and date before generating summary"); return; }
    setAiLoading(true);
    try {
      const notes = buildNotes();
      const tempSave = await fetch(`${API}/projects/${projectId}/meetings`, {
        method: "POST", headers,
        body: JSON.stringify({ title: title || "Draft", meeting_date: `${meetingDate}T${meetingTime}:00`, notes }),
      });
      if (!tempSave.ok) return;
      const meeting = await tempSave.json();
      const r = await fetch(`${API}/projects/${projectId}/meetings/${meeting.id}/ai-summary`, { method: "POST", headers });
      if (r.ok) {
        const d = await r.json();
        setAiSummaryText(d.summary || "");
      }
      await loadMeetings();
    } finally { setAiLoading(false); }
  };

  const exportPDF = (meeting: Meeting) => {
    window.open(`${API}/projects/${projectId}/meetings/${meeting.id}/export-pdf?token=${token}`, "_blank");
  };

  const updateActionItem = async (id: number, status: string) => {
    await fetch(`${API}/projects/${projectId}/action-items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status }),
    });
    await loadMeetings();
  };

  const openActions = actionItems.filter(a => a.status !== "completed" && a.status !== "cancelled");
  const overdueActions = actionItems.filter(a => a.isOverdue);

  const SectionHeader = ({ label, sectionKey }: { label: string; sectionKey: string }) => (
    <div onClick={() => toggleSection(sectionKey)}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#1E3A5F", color: "white", padding: "8px 14px",
        borderRadius: expandedSections[sectionKey] ? "8px 8px 0 0" : 8,
        cursor: "pointer", marginBottom: expandedSections[sectionKey] ? 0 : 8, userSelect: "none" }}>
      <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      {expandedSections[sectionKey] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </div>
  );

  if (view === "list" || view === "actions") return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Meeting Minutes", "Actas de Reunión")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Record meetings, track deliverables, and manage action items", "Registra reuniones, entregables y acción items")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <div className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6, opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                <Download size={14} /> {importing ? t("Importing...","Importando...") : t("Import Minutes","Importar Acta")}
              </div>
            </label>
          )}
          {canWrite && (
            <button className="btn btn-primary" onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> {t("New Meeting", "Nueva Reunión")}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: t("Total Meetings", "Total Reuniones"), value: meetings.length, color: "#1D4ED8" },
          { label: t("Open Actions", "Acciones Abiertas"), value: openActions.length, color: "#D97706" },
          { label: t("Overdue", "Vencidas"), value: overdueActions.length, color: overdueActions.length > 0 ? "#DC2626" : "#16A34A" },
          { label: t("Completed", "Completadas"), value: actionItems.filter(a => a.status === "completed").length, color: "#16A34A" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${view === "list" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("list")}>
          <ClipboardList size={13} style={{ marginRight: 4 }} />{t("Meetings", "Reuniones")}
        </button>
        <button className={`btn btn-sm ${view === "actions" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("actions")}>
          <CheckCircle2 size={13} style={{ marginRight: 4 }} />{t("Action Items", "Acciones")} {openActions.length > 0 && `(${openActions.length})`}
        </button>
      </div>

      {loading && <div style={{ color: "#6B7280", padding: 40, textAlign: "center" }}>{t("Loading…", "Cargando…")}</div>}

      {!loading && view === "list" && (
        meetings.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <ClipboardList size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600 }}>{t("No meetings recorded yet", "Sin reuniones registradas aún")}</div>
            </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {meetings.map(m => (
                <div key={m.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 16,
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 12 }}>
                      <span><Calendar size={11} style={{ marginRight: 3 }} />{new Date(m.meetingDate).toLocaleDateString()} {new Date(m.meetingDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {m.location && <span><MapPin size={11} style={{ marginRight: 3 }} />{m.location}</span>}
                      <span><Users size={11} style={{ marginRight: 3 }} />{m.attendeeCount} {t("attendees", "asistentes")}</span>
                      <span><CheckCircle2 size={11} style={{ marginRight: 3 }} />{m.openActionItems} {t("open", "abiertas")}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm btn-outline" onClick={() => exportPDF(m)}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Download size={12} /> PDF
                    </button>
                    {canWrite && (
                      <button
                        title={t("Delete meeting", "Eliminar reunión")}
                        onClick={() => setDeleteTarget({ id: m.id, label: m.title })}
                        style={{ padding: "5px 9px", border: "1px solid #FECACA", borderRadius: 6, background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
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
            setMeetings(prev => prev.filter(x => x.id !== deleteTarget.id));
            setDeleteTarget(null);
          }}
          endpoint={`${API}/projects/${projectId}/meetings/${deleteTarget.id}`}
          entityLabel={`Meeting "${deleteTarget.label}"`}
          warning={t("Attendees and linked items will be removed.", "Asistentes y elementos enlazados serán eliminados.")}
        />
      )}

      {!loading && view === "actions" && (
        actionItems.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <CheckCircle2 size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600 }}>{t("No action items yet", "Sin acciones aún")}</div>
            </div>
          : <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    {[t("Description","Descripción"), t("Assigned To","Asignado"), t("Due Date","Fecha"), t("Status","Estado"), ""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left", color: "#6B7280", borderBottom: "1px solid #E5E7EB", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map(ai => (
                    <tr key={ai.id} style={{ background: ai.isOverdue ? "#FEF2F2" : "white", borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{ai.description}</div>
                        {ai.isOverdue && <div style={{ fontSize: 11, color: "#DC2626", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}><AlertTriangle size={10} /> {t("Overdue","Vencido")}</div>}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>{ai.assignedToName || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#6B7280" }}>{ai.dueDate ? new Date(ai.dueDate).toLocaleDateString() : "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: ai.status === "completed" ? "#DCFCE7" : ai.isOverdue ? "#FEE2E2" : "#FEF3C7",
                          color: ai.status === "completed" ? "#16A34A" : ai.isOverdue ? "#DC2626" : "#D97706" }}>
                          {ai.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {canWrite && ai.status !== "completed" && (
                          <button className="btn btn-sm btn-outline" onClick={() => updateActionItem(ai.id, "completed")}>✓ {t("Done","Listo")}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      )}
    </div>
  );

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("New Meeting", "Nueva Reunión")}
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0, color: "#111827" }}>
            {title || t("Meeting Minutes", "Actas de Reunión")}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setView("list")}>{t("Cancel", "Cancelar")}</button>
          <button className="btn btn-primary" onClick={saveMeeting} disabled={saving}>
            {saving ? t("Saving…", "Guardando…") : t("Save Meeting", "Guardar Reunión")}
          </button>
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {importMsg && <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", color: "#1D4ED8", fontSize: 13, marginBottom: 14 }}>{importMsg}</div>}

      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 90, flexShrink: 0 }}>
            <label style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 4, display: "block" }}>{t("Meeting #", "Reunión #")}</label>
            <input className="input" value={meetingNumber} onChange={e => setMeetingNumber(e.target.value)} placeholder="01" style={{ marginTop: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 4, display: "block" }}>{t("Title", "Título")} *</label>
            <input className="input" required value={title} onChange={e => setTitle(e.target.value)} placeholder={t("e.g. Underground Coordination", "ej. Coordinación Subterránea")} style={{ marginTop: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 150, flexShrink: 0 }}>
            <label style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 4, display: "block" }}>{t("Date", "Fecha")} *</label>
            <input className="input" type="date" required value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={{ marginTop: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 120, flexShrink: 0 }}>
            <label style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 4, display: "block" }}>{t("Time", "Hora")}</label>
            <input className="input" type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} style={{ marginTop: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 4, display: "block" }}>{t("Location", "Lugar")}</label>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder={t("Conference Room / Zoom / Site", "Sala / Zoom / Obra")} style={{ marginTop: 0 }} />
          </div>
        </div>
      </div>

      <div style={{ background: "#F9FAFB", border: "1px dashed #D1D5DB",
        borderRadius: 10, padding: 16, marginBottom: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#6B7280", marginBottom: 2 }}>
            Upload Meeting Recording — Coming Soon
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
            Upload an audio or video file and AI will auto-fill this form. Available in the next update.
          </div>
        </div>
        <div style={{ fontSize: 11, background: "#F3F4F6", border: "1px solid #E5E7EB",
          borderRadius: 6, padding: "4px 10px", color: "#9CA3AF", fontWeight: 600 }}>
          COMING SOON
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <SectionHeader label={t("Agenda", "Agenda")} sectionKey="agenda" />
        {expandedSections.agenda && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 14 }}>
            {agendaItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#6B7280", width: 20, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
                <input className="input" value={item} onChange={e => { const a = [...agendaItems]; a[i] = e.target.value; setAgendaItems(a); }}
                  placeholder={t(`Agenda item ${i + 1}`, `Punto ${i + 1}`)} style={{ flex: 1 }} />
                <button onClick={() => setAgendaItems(agendaItems.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn btn-sm btn-outline" onClick={() => setAgendaItems([...agendaItems, ""])} style={{ marginTop: 4 }}>
              <Plus size={12} style={{ marginRight: 4 }} />{t("Add Item", "Agregar Punto")}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <SectionHeader label={t("Attendees", "Asistentes")} sectionKey="attendees" />
        {expandedSections.attendees && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[t("Trade","Trade"), t("Company","Empresa"), t("Name","Nombre"), t("Role","Rol"), t("Email","Email"), t("Phone","Teléfono"), ""].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendees.map((a, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    {(["trade","company","fullName","role","email","phone"] as (keyof Attendee)[]).map(field => (
                      <td key={field} style={CELL_STYLE}>
                        <input value={a[field]} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], [field]: e.target.value }; setAttendees(arr); }}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                      </td>
                    ))}
                    <td style={CELL_STYLE}>
                      <button onClick={() => setAttendees(attendees.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setAttendees([...attendees, { trade: "", company: "", fullName: "", role: "", email: "", phone: "" }])}>
                <Plus size={12} style={{ marginRight: 4 }} />{t("Add Attendee", "Agregar Asistente")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <SectionHeader label="RFIs" sectionKey="rfis" />
        {expandedSections.rfis && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["RFI #", t("Description","Descripción"), t("Status","Estado"), t("Responsible","Responsable"), ""].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rfis.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ ...CELL_STYLE, width: 100 }}>
                      <input value={r.rfiNumber} onChange={e => { const arr = [...rfis]; arr[i].rfiNumber = e.target.value; setRfis(arr); }}
                        placeholder="EAST-15" style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    <td style={CELL_STYLE}>
                      <input value={r.description} onChange={e => { const arr = [...rfis]; arr[i].description = e.target.value; setRfis(arr); }}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    <td style={{ ...CELL_STYLE, width: 120 }}>
                      <select value={r.status} onChange={e => { const arr = [...rfis]; arr[i].status = e.target.value; setRfis(arr); }}
                        style={{ border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 11, padding: "2px 4px",
                          background: r.status === "COMPLETE" ? "#DCFCE7" : r.status === "SUBMITTED" ? "#DBEAFE" : "#FEF3C7",
                          color: r.status === "COMPLETE" ? "#16A34A" : r.status === "SUBMITTED" ? "#1D4ED8" : "#D97706",
                          fontWeight: 600, width: "100%" }}>
                        <option value="PENDING">PENDING</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="COMPLETE">COMPLETE</option>
                        <option value="IN REVIEW">IN REVIEW</option>
                      </select>
                    </td>
                    <td style={CELL_STYLE}>
                      <input value={r.responsible} onChange={e => { const arr = [...rfis]; arr[i].responsible = e.target.value; setRfis(arr); }}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    <td style={CELL_STYLE}>
                      <button onClick={() => setRfis(rfis.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setRfis([...rfis, { rfiNumber: "", description: "", status: "PENDING", responsible: "" }])}>
                <Plus size={12} style={{ marginRight: 4 }} />Add RFI
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <SectionHeader label={t("Deliverables", "Entregables")} sectionKey="deliverables" />
        {expandedSections.deliverables && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[t("Floor/Area","Piso/Área"), t("Description","Descripción"), "PLUMBING", "HVAC", "FIRE PROT.", "ELECTRICAL", "OTHER", "COORDINATOR", t("Deadline","Fecha Límite"), ""].map(h => (
                    <th key={h} style={{ ...TH_STYLE, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={CELL_STYLE}>
                      <input value={d.floor} onChange={e => { const arr = [...deliverables]; arr[i].floor = e.target.value; setDeliverables(arr); }}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, fontWeight: 600, background: "transparent" }} />
                    </td>
                    <td style={CELL_STYLE}>
                      <input value={d.description} onChange={e => { const arr = [...deliverables]; arr[i].description = e.target.value; setDeliverables(arr); }}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    {(["plumbing","hvac","fireProt","electrical","other","coordinator"] as (keyof DeliverableRow)[]).map(field => (
                      <td key={field} style={{ ...CELL_STYLE, width: 90 }}>
                        <StatusCell value={d[field]} onChange={v => { const arr = [...deliverables]; (arr[i] as any)[field] = v; setDeliverables(arr); }} />
                      </td>
                    ))}
                    <td style={{ ...CELL_STYLE, width: 100 }}>
                      <input type="date" value={d.deadline} onChange={e => { const arr = [...deliverables]; arr[i].deadline = e.target.value; setDeliverables(arr); }}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent" }} />
                    </td>
                    <td style={CELL_STYLE}>
                      <button onClick={() => setDeliverables(deliverables.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setDeliverables([...deliverables, { floor: "", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" }])}>
                <Plus size={12} style={{ marginRight: 4 }} />{t("Add Row", "Agregar Fila")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <SectionHeader label={t("Viewpoints / Clashes", "Viewpoints / Choques")} sectionKey="viewpoints" />
        {expandedSections.viewpoints && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[t("Floor","Piso"), t("Responsible","Responsable"), t("Hold Ups","Pendientes"), t("Viewpoint","Viewpoint"), t("Description","Descripción"), t("Deadline","Fecha"), ""].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewpoints.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    {(["floor","responsible","holdUps","viewpoint","description","deadline"] as (keyof ViewpointRow)[]).map(field => (
                      <td key={field} style={CELL_STYLE}>
                        <input value={v[field]} onChange={e => { const arr = [...viewpoints]; (arr[i] as any)[field] = e.target.value; setViewpoints(arr); }}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                      </td>
                    ))}
                    <td style={CELL_STYLE}>
                      <button onClick={() => setViewpoints(viewpoints.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setViewpoints([...viewpoints, { floor: "", responsible: "", holdUps: "", viewpoint: "", description: "", deadline: "" }])}>
                <Plus size={12} style={{ marginRight: 4 }} />{t("Add Row", "Agregar Fila")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSummaryText ? 12 : 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color="#2563EB" /> {t("AI Summary", "Resumen IA")}
          </div>
          <button className="btn btn-sm btn-outline" onClick={generateAISummary} disabled={aiLoading}
            style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Sparkles size={12} />{aiLoading ? t("Generating…", "Generando…") : t("Generate Summary", "Generar Resumen")}
          </button>
        </div>
        {aiSummaryText && (
          <div style={{ background: "#EFF6FF", borderRadius: 8, padding: 12, borderLeft: "3px solid #2563EB", fontSize: 13, color: "#1E40AF", lineHeight: 1.6 }}>
            {aiSummaryText}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
        <button className="btn btn-outline" onClick={() => setView("list")}>{t("Cancel", "Cancelar")}</button>
        <button className="btn btn-primary" onClick={saveMeeting} disabled={saving}>
          {saving ? t("Saving…", "Guardando…") : t("Save Meeting", "Guardar Reunión")}
        </button>
      </div>

      {showNoKeyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 28,
            maxWidth: 480, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: "#111827" }}>
              OpenAI API Key Required
            </div>
            <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
              Audio transcription uses OpenAI Whisper. You need to add your own
              OpenAI API key in your Profile to use this feature.
              <br /><br />
              <strong>Cost:</strong> ~$0.006 per minute of audio (~$0.36 per hour).
              You pay OpenAI directly — BIMLog never charges for transcription.
              <br /><br />
              <strong>How to get a key:</strong> Go to{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank"
                rel="noreferrer" style={{ color: "#2563EB" }}>
                platform.openai.com/api-keys
              </a>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={() => { setShowNoKeyModal(false); window.location.href = "/profile"; }}>
                Go to Profile → Add Key
              </button>
              <button className="btn btn-outline" onClick={() => setShowNoKeyModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
