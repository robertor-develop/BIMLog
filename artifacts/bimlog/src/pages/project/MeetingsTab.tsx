import { useState, useEffect, Fragment } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useListMembers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Search, ExternalLink, RefreshCw, X } from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { isDebug } from "@/lib/debug";
import { MeetingClashesPanel } from "./MeetingClashesPanel";
import {
  ClipboardList, CheckCircle2, Calendar, MapPin, Users,
  Sparkles, AlertTriangle, Plus, Download, ChevronDown,
  ChevronUp, UserPlus
} from "lucide-react";

const API = "/api/v1";

interface Meeting {
  id: number; title: string; meetingDate: string; location?: string;
  notes?: string; aiSummary?: string; attendeeCount: number;
  openActionItems: number; actionItemCount: number; createdAt: string;
  linkedRfis?: LinkedRfi[]; legacyRfis?: RFIRow[];
  linkedSubmittals?: LinkedSubmittal[]; legacyDeliverables?: LegacyDeliverableRow[];
  linkedClashes?: LinkedClash[]; legacyViewpoints?: LegacyViewpointRow[];
}

interface Attendee {
  id?: number; trade: string; company: string; fullName: string;
  role: string; email: string; phone: string;
}

interface RFIRow {
  rfiNumber: string; description: string; status: string; responsible: string;
}

interface LinkedRfi {
  id?: number; rfiId: number; rfiNumber: string; title: string;
  description?: string | null; status: string; responsible?: string | null;
}

interface RfiCandidate {
  id: number; number: string; title: string; description?: string | null;
  status: string; responsible?: string | null; alreadyAdded: boolean;
}

type DisciplineBucket = "plumbing" | "hvac" | "fireProtection" | "electrical" | "other" | null;

interface LinkedSubmittal {
  id?: number; submittalId: number; number: string; title: string;
  description?: string | null; floor?: string | null; discipline?: string | null;
  disciplineBucket: DisciplineBucket; status: string; responsible?: string | null;
  deadline?: string | null;
}

interface SubmittalCandidate extends Omit<LinkedSubmittal, "submittalId"> {
  id: number; alreadyAdded: boolean;
}

interface LegacyDeliverableRow { raw: string; }
interface LegacyViewpointRow { raw: string; }

interface LinkedClash {
  id: number; clashId: number; clashReportId: number; number?: string | null;
  description?: string | null; floor?: string | null; discipline?: string | null;
  responsible?: string | null; group?: string | null; status: string;
  deadline?: string | null; meetingNotes?: string | null;
  linkState: "active" | "removed_by_user" | "source_closed_or_excluded";
}

interface ClashSyncSummary {
  reviewed: number; added: number; updated: number; unchanged: number;
  sourceExcluded: number; userExcluded: number; failures: number; open: number; followUp: number;
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

const CELL_STYLE = {
  border: "1px solid #E5E7EB", padding: "6px 8px",
  fontSize: 12, verticalAlign: "middle" as const
};
const TH_STYLE = {
  ...CELL_STYLE, background: "#1E3A5F", color: "white",
  fontWeight: 700, fontSize: 11, textTransform: "uppercase" as const
};

const humanLabel = (value?: string | null) => value ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, character => character.toUpperCase()) : "—";

export function MeetingsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const queryClient = useQueryClient();
  const { data: members } = useListMembers(projectId);
  const memberList = members ?? [];
  const uniqueCompanies = [...new Set(memberList.map(m => m.userCompanyName).filter(Boolean) as string[])];
  const companyPeople = (company: string) => memberList.filter(m => m.userCompanyName === company);

  const [addCompanyIndex, setAddCompanyIndex] = useState<number | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [freeTextPersons, setFreeTextPersons] = useState<number[]>([]);

  const resetAddCompanyForm = () => {
    setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyPhone("");
    setNewCompanyAddress(""); setNewContactPerson(""); setAddCompanyIndex(null);
  };

  const handleAddCompany = async (index: number) => {
    if (!newCompanyName.trim()) return;
    const tok = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const companyName = newCompanyName.trim();
    let res: Response;
    try {
      res = await fetch(`/api/v1/projects/${projectId}/directory`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newContactPerson.trim() || companyName,
          email: newCompanyEmail.trim() || "contact@bimlog.io",
          company_name: companyName,
          role: "External Company",
          notes: `Phone: ${newCompanyPhone} | Address: ${newCompanyAddress}`,
        }),
      });
    } catch (err) {
      setError(t("Failed to add company. Check your connection and try again.", "No se pudo agregar la empresa. Verifique su conexión e intente de nuevo."));
      return;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      setError(t(`Failed to add company (${res.status}). ${body}`, `No se pudo agregar la empresa (${res.status}). ${body}`));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
    setAttendees(prev => {
      const arr = [...prev];
      arr[index] = { ...arr[index], company: companyName };
      return arr;
    });
    resetAddCompanyForm();
  };

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
  // Manual rows remain only for imported legacy text; canonical selections
  // persist through meeting_rfi_links.
  const [rfis, setRfis] = useState<RFIRow[]>([]);
  const [selectedRfis, setSelectedRfis] = useState<LinkedRfi[]>([]);
  const [selectorMeetingId, setSelectorMeetingId] = useState<number | null | undefined>(undefined);
  const [selectorQuery, setSelectorQuery] = useState("");
  const [selectorCandidates, setSelectorCandidates] = useState<RfiCandidate[]>([]);
  const [selectorCandidateCache, setSelectorCandidateCache] = useState<Map<number, RfiCandidate>>(new Map());
  const [selectorSelectedIds, setSelectorSelectedIds] = useState<Set<number>>(new Set());
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorError, setSelectorError] = useState("");
  const [selectorSaving, setSelectorSaving] = useState(false);
  const [selectedSubmittals, setSelectedSubmittals] = useState<LinkedSubmittal[]>([]);
  const [submittalSelectorMeetingId, setSubmittalSelectorMeetingId] = useState<number | null | undefined>(undefined);
  const [submittalQuery, setSubmittalQuery] = useState("");
  const [submittalFloor, setSubmittalFloor] = useState("");
  const [submittalDiscipline, setSubmittalDiscipline] = useState("");
  const [submittalStatus, setSubmittalStatus] = useState("");
  const [submittalResponsible, setSubmittalResponsible] = useState("");
  const [submittalCandidates, setSubmittalCandidates] = useState<SubmittalCandidate[]>([]);
  const [submittalCandidateCache, setSubmittalCandidateCache] = useState<Map<number, SubmittalCandidate>>(new Map());
  const [submittalSelectedIds, setSubmittalSelectedIds] = useState<Set<number>>(new Set());
  const [submittalLoading, setSubmittalLoading] = useState(false);
  const [submittalError, setSubmittalError] = useState("");
  const [submittalSaving, setSubmittalSaving] = useState(false);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([
    { floor: "UNDERGROUND", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
    { floor: "CELLAR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
    { floor: "1ST FLOOR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
  ]);
  // Only imported/manual legacy rows enter this buffer. New Clash discussion
  // records are loaded from the canonical Clash Log after the Meeting is saved.
  const [viewpoints, setViewpoints] = useState<ViewpointRow[]>([]);
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
    setRfis([]); setSelectedRfis([]); setSelectedSubmittals([]);
    setDeliverables([
      { floor: "UNDERGROUND", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
      { floor: "CELLAR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
      { floor: "1ST FLOOR", description: "", plumbing: "", hvac: "", fireProt: "", electrical: "", other: "", coordinator: "", deadline: "" },
    ]);
    setViewpoints([]);
    setAiSummaryText("");
    setError("");
  };

  const openNew = () => { resetForm(); setView("new"); };

  const loadRfiCandidates = async () => {
    if (selectorMeetingId === undefined) return;
    setSelectorLoading(true); setSelectorError("");
    try {
      const params = new URLSearchParams();
      if (selectorQuery.trim()) params.set("q", selectorQuery.trim());
      if (selectorMeetingId !== null) params.set("meeting_id", String(selectorMeetingId));
      const response = await fetch(`${API}/projects/${projectId}/meetings/rfi-candidates?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(t("Could not load project RFIs.", "No se pudieron cargar los RFI del proyecto."));
      const rows = await response.json() as RfiCandidate[];
      const locallySelected = new Set(selectedRfis.map(rfi => rfi.rfiId));
      const normalizedRows = rows.map(row => ({ ...row, alreadyAdded: row.alreadyAdded || (selectorMeetingId === null && locallySelected.has(row.id)) }));
      setSelectorCandidates(normalizedRows);
      setSelectorCandidateCache(previous => {
        const next = new Map(previous);
        normalizedRows.forEach(row => next.set(row.id, row));
        return next;
      });
    } catch (err) {
      setSelectorError(err instanceof Error ? err.message : t("Could not load project RFIs.", "No se pudieron cargar los RFI del proyecto."));
    } finally { setSelectorLoading(false); }
  };

  useEffect(() => {
    if (selectorMeetingId === undefined) return;
    const timer = window.setTimeout(() => { void loadRfiCandidates(); }, 200);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectorMeetingId, selectorQuery, projectId]);

  const openRfiSelector = (meetingId: number | null) => {
    setSelectorQuery(""); setSelectorSelectedIds(new Set()); setSelectorCandidates([]); setSelectorCandidateCache(new Map()); setSelectorError("");
    setSelectorMeetingId(meetingId);
  };

  const closeRfiSelector = () => { if (!selectorSaving) setSelectorMeetingId(undefined); };

  const addSelectedExistingRfis = async () => {
    const ids = [...selectorSelectedIds];
    if (!ids.length) return;
    setSelectorSaving(true); setSelectorError("");
    try {
      if (selectorMeetingId === null) {
        const byId = selectorCandidateCache;
        setSelectedRfis(prev => {
          const existing = new Set(prev.map(row => row.rfiId));
          return [...prev, ...ids.filter(id => !existing.has(id)).map(id => {
            const row = byId.get(id)!;
            return { rfiId: row.id, rfiNumber: row.number, title: row.title, description: row.description, status: row.status, responsible: row.responsible };
          })];
        });
      } else if (selectorMeetingId !== undefined) {
        const response = await fetch(`${API}/projects/${projectId}/meetings/${selectorMeetingId}/rfis`, {
          method: "POST", headers, body: JSON.stringify({ rfi_ids: ids }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || t("Could not add the selected RFIs.", "No se pudieron añadir los RFI seleccionados."));
        }
        await loadMeetings();
      }
      setSelectorMeetingId(undefined);
    } catch (err) {
      setSelectorError(err instanceof Error ? err.message : t("Could not add the selected RFIs.", "No se pudieron añadir los RFI seleccionados."));
    } finally { setSelectorSaving(false); }
  };

  const removeMeetingRfi = async (meetingId: number, rfiId: number) => {
    const response = await fetch(`${API}/projects/${projectId}/meetings/${meetingId}/rfis/${rfiId}`, { method: "DELETE", headers });
    if (!response.ok) { setError(t("Could not remove the meeting link.", "No se pudo quitar el enlace del acta.")); return; }
    await loadMeetings();
  };

  const openOriginalRfi = (rfiId: number) => window.location.assign(`/projects/${projectId}/rfis?rfi=${rfiId}`);

  const RfiSelectorModal = () => selectorMeetingId !== undefined ? (
    <div role="dialog" aria-modal="true" aria-label={t("Add Existing RFI", "Añadir RFI existente")}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "white", borderRadius: 12, width: "min(720px, calc(100vw - 24px))", maxHeight: "calc(100vh - 24px)", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{t("Add Existing RFI", "Añadir RFI existente")}</div><div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{t("Select one or more RFIs from this project.", "Seleccione uno o más RFI de este proyecto.")}</div></div>
          <button aria-label={t("Close", "Cerrar")} onClick={closeRfiSelector} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "0 16px 12px", position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 28, top: 11, color: "#6B7280" }} />
          <input autoFocus className="input" value={selectorQuery} onChange={e => setSelectorQuery(e.target.value)} placeholder={t("Search RFI number, title, or description", "Buscar número, título o descripción del RFI")} style={{ width: "100%", paddingLeft: 34, margin: 0 }} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 16px", minHeight: 160 }}>
          {selectorLoading && <div style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>{t("Loading RFIs…", "Cargando RFI…")}</div>}
          {!selectorLoading && selectorError && <div style={{ padding: 24, textAlign: "center", color: "#B91C1C" }}><div>{selectorError}</div><button className="btn btn-sm btn-outline" onClick={() => void loadRfiCandidates()} style={{ marginTop: 10 }}><RefreshCw size={12} style={{ marginRight: 5 }} />{t("Retry", "Reintentar")}</button></div>}
          {!selectorLoading && !selectorError && selectorCandidates.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>{selectorQuery ? t("No matching RFIs.", "No hay RFI coincidentes.") : t("No RFIs exist in this project.", "No existen RFI en este proyecto.")}</div>}
          {!selectorLoading && !selectorError && selectorCandidates.map(rfi => {
            const checked = selectorSelectedIds.has(rfi.id);
            return <label key={rfi.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 4px", borderBottom: "1px solid #E5E7EB", cursor: rfi.alreadyAdded ? "default" : "pointer", opacity: rfi.alreadyAdded ? .65 : 1 }}>
              <input type="checkbox" checked={checked || rfi.alreadyAdded} disabled={rfi.alreadyAdded} onChange={() => setSelectorSelectedIds(prev => { const next = new Set(prev); checked ? next.delete(rfi.id) : next.add(rfi.id); return next; })} style={{ marginTop: 3 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}><strong style={{ fontSize: 13 }}>{rfi.number}</strong><span style={{ fontSize: 13 }}>{rfi.title}</span>{rfi.alreadyAdded && <span style={{ fontSize: 10, color: "#166534", background: "#DCFCE7", padding: "2px 6px", borderRadius: 10 }}>{t("Already added", "Ya añadido")}</span>}</div>
                {rfi.description && rfi.description !== rfi.title && <div style={{ fontSize: 12, color: "#4B5563", marginTop: 3, overflowWrap: "anywhere" }}>{rfi.description}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#6B7280", marginTop: 5 }}><span>{t("Status", "Estado")}: {rfi.status}</span><span>{t("Responsible", "Responsable")}: {rfi.responsible || "—"}</span></div>
              </div>
            </label>;
          })}
        </div>
        <div style={{ padding: 16, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #E5E7EB" }}>
          <button className="btn btn-outline" onClick={closeRfiSelector}>{t("Cancel", "Cancelar")}</button>
          <button className="btn btn-primary" onClick={() => void addSelectedExistingRfis()} disabled={!selectorSelectedIds.size || selectorSaving}>{selectorSaving ? t("Adding…", "Añadiendo…") : t(`Add Selected (${selectorSelectedIds.size})`, `Añadir seleccionados (${selectorSelectedIds.size})`)}</button>
        </div>
      </div>
    </div>
  ) : null;

  const loadSubmittalCandidates = async () => {
    if (submittalSelectorMeetingId === undefined) return;
    setSubmittalLoading(true); setSubmittalError("");
    try {
      const params = new URLSearchParams();
      if (submittalQuery.trim()) params.set("q", submittalQuery.trim());
      if (submittalFloor.trim()) params.set("floor", submittalFloor.trim());
      if (submittalDiscipline.trim()) params.set("discipline", submittalDiscipline.trim());
      if (submittalStatus.trim()) params.set("status", submittalStatus.trim());
      if (submittalResponsible.trim()) params.set("responsible", submittalResponsible.trim());
      if (submittalSelectorMeetingId !== null) params.set("meeting_id", String(submittalSelectorMeetingId));
      const response = await fetch(`${API}/projects/${projectId}/meetings/submittal-candidates?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(t("Could not load project Submittals.", "No se pudieron cargar los Submittals del proyecto."));
      const rows = await response.json() as SubmittalCandidate[];
      const locallySelected = new Set(selectedSubmittals.map(row => row.submittalId));
      const normalized = rows.map(row => ({ ...row, alreadyAdded: row.alreadyAdded || (submittalSelectorMeetingId === null && locallySelected.has(row.id)) }));
      setSubmittalCandidates(normalized);
      setSubmittalCandidateCache(previous => {
        const next = new Map(previous);
        normalized.forEach(row => next.set(row.id, row));
        return next;
      });
    } catch (err) {
      setSubmittalError(err instanceof Error ? err.message : t("Could not load project Submittals.", "No se pudieron cargar los Submittals del proyecto."));
    } finally { setSubmittalLoading(false); }
  };

  useEffect(() => {
    if (submittalSelectorMeetingId === undefined) return;
    const timer = window.setTimeout(() => { void loadSubmittalCandidates(); }, 200);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittalSelectorMeetingId, submittalQuery, submittalFloor, submittalDiscipline, submittalStatus, submittalResponsible, projectId]);

  const openSubmittalSelector = (meetingId: number | null) => {
    setSubmittalQuery(""); setSubmittalFloor(""); setSubmittalDiscipline(""); setSubmittalStatus(""); setSubmittalResponsible("");
    setSubmittalSelectedIds(new Set()); setSubmittalCandidates([]); setSubmittalCandidateCache(new Map()); setSubmittalError("");
    setSubmittalSelectorMeetingId(meetingId);
  };

  const closeSubmittalSelector = () => { if (!submittalSaving) setSubmittalSelectorMeetingId(undefined); };

  const addSelectedSubmittals = async () => {
    const ids = [...submittalSelectedIds];
    if (!ids.length) return;
    setSubmittalSaving(true); setSubmittalError("");
    try {
      if (submittalSelectorMeetingId === null) {
        setSelectedSubmittals(previous => {
          const existing = new Set(previous.map(row => row.submittalId));
          return [...previous, ...ids.filter(id => !existing.has(id)).map(id => {
            const row = submittalCandidateCache.get(id)!;
            return { submittalId: row.id, number: row.number, title: row.title, description: row.description, floor: row.floor, discipline: row.discipline, disciplineBucket: row.disciplineBucket, status: row.status, responsible: row.responsible, deadline: row.deadline };
          })];
        });
      } else if (submittalSelectorMeetingId !== undefined) {
        const response = await fetch(`${API}/projects/${projectId}/meetings/${submittalSelectorMeetingId}/submittals`, {
          method: "POST", headers, body: JSON.stringify({ submittal_ids: ids }),
        });
        if (!response.ok) {
          throw new Error(t("Could not add the selected Submittals.", "No se pudieron añadir los Submittals seleccionados."));
        }
        await loadMeetings();
      }
      setSubmittalSelectorMeetingId(undefined);
    } catch (err) {
      setSubmittalError(err instanceof Error ? err.message : t("Could not add the selected Submittals.", "No se pudieron añadir los Submittals seleccionados."));
    } finally { setSubmittalSaving(false); }
  };

  const removeMeetingSubmittal = async (meetingId: number, submittalId: number) => {
    const response = await fetch(`${API}/projects/${projectId}/meetings/${meetingId}/submittals/${submittalId}`, { method: "DELETE", headers });
    if (!response.ok) { setError(t("Could not remove the meeting link.", "No se pudo quitar el enlace del acta.")); return; }
    await loadMeetings();
  };

  const openOriginalSubmittal = (submittalId: number) => window.location.assign(`/projects/${projectId}/submittals?submittal=${submittalId}`);

  const SubmittalSelectorModal = () => submittalSelectorMeetingId !== undefined ? (
    <div role="dialog" aria-modal="true" aria-label={t("Add from Submittal Log", "Añadir desde el Registro de Submittals")}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "white", borderRadius: 12, width: "min(880px, calc(100vw - 24px))", maxHeight: "calc(100vh - 24px)", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,.25)", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{t("Add from Submittal Log", "Añadir desde el Registro de Submittals")}</div><div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{t("Select one or more existing Submittals from this project.", "Seleccione uno o más Submittals existentes de este proyecto.")}</div></div>
          <button aria-label={t("Close", "Cerrar")} onClick={closeSubmittalSelector} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "0 16px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8 }}>
          <div style={{ position: "relative", gridColumn: "1 / -1" }}><Search size={15} style={{ position: "absolute", left: 12, top: 11, color: "#6B7280" }} /><input autoFocus className="input" value={submittalQuery} onChange={event => setSubmittalQuery(event.target.value)} placeholder={t("Search number, title, or description", "Buscar número, título o descripción")} style={{ width: "100%", paddingLeft: 34, margin: 0 }} /></div>
          <input className="input" value={submittalFloor} onChange={event => setSubmittalFloor(event.target.value)} placeholder={t("Floor / area", "Piso / área")} style={{ margin: 0, minWidth: 0 }} />
          <input className="input" value={submittalDiscipline} onChange={event => setSubmittalDiscipline(event.target.value)} placeholder={t("Discipline / trade", "Disciplina / oficio")} style={{ margin: 0, minWidth: 0 }} />
          <input className="input" value={submittalStatus} onChange={event => setSubmittalStatus(event.target.value)} placeholder={t("Status", "Estado")} style={{ margin: 0, minWidth: 0 }} />
          <input className="input" value={submittalResponsible} onChange={event => setSubmittalResponsible(event.target.value)} placeholder={t("Responsible person / company", "Persona / empresa responsable")} style={{ margin: 0, minWidth: 0 }} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 16px", minHeight: 160 }}>
          {submittalLoading && <div style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>{t("Loading Submittals…", "Cargando Submittals…")}</div>}
          {!submittalLoading && submittalError && <div style={{ padding: 24, textAlign: "center", color: "#B91C1C" }}><div>{submittalError}</div><button className="btn btn-sm btn-outline" onClick={() => void loadSubmittalCandidates()} style={{ marginTop: 10 }}><RefreshCw size={12} style={{ marginRight: 5 }} />{t("Retry", "Reintentar")}</button></div>}
          {!submittalLoading && !submittalError && submittalCandidates.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>{submittalQuery || submittalFloor || submittalDiscipline || submittalStatus || submittalResponsible ? t("No Submittals match these filters.", "Ningún Submittal coincide con estos filtros.") : t("No Submittals exist in this project.", "No existen Submittals en este proyecto.")}</div>}
          {!submittalLoading && !submittalError && submittalCandidates.map(submittal => {
            const checked = submittalSelectedIds.has(submittal.id);
            return <label key={submittal.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 4px", borderBottom: "1px solid #E5E7EB", cursor: submittal.alreadyAdded ? "default" : "pointer", opacity: submittal.alreadyAdded ? .65 : 1 }}>
              <input type="checkbox" checked={checked || submittal.alreadyAdded} disabled={submittal.alreadyAdded} onChange={() => setSubmittalSelectedIds(previous => { const next = new Set(previous); checked ? next.delete(submittal.id) : next.add(submittal.id); return next; })} style={{ marginTop: 3 }} />
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}><strong style={{ fontSize: 13 }}>{submittal.number}</strong><span style={{ fontSize: 13 }}>{submittal.title}</span>{submittal.alreadyAdded && <span style={{ fontSize: 10, color: "#166534", background: "#DCFCE7", padding: "2px 6px", borderRadius: 10 }}>{t("Already added", "Ya añadido")}</span>}</div>
                {submittal.description && submittal.description !== submittal.title && <div style={{ fontSize: 12, color: "#4B5563", marginTop: 3, overflowWrap: "anywhere" }}>{submittal.description}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#6B7280", marginTop: 5 }}><span>{t("Floor / area", "Piso / área")}: {submittal.floor || "—"}</span><span>{t("Discipline", "Disciplina")}: {submittal.discipline || "—"}</span><span>{t("Status", "Estado")}: {humanLabel(submittal.status)}</span><span>{t("Responsible", "Responsable")}: {submittal.responsible || "—"}</span><span>{t("Deadline", "Fecha límite")}: {submittal.deadline ? new Date(submittal.deadline).toLocaleDateString() : "—"}</span></div>
              </div>
            </label>;
          })}
        </div>
        <div style={{ padding: 16, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #E5E7EB" }}><button className="btn btn-outline" onClick={closeSubmittalSelector}>{t("Cancel", "Cancelar")}</button><button className="btn btn-primary" onClick={() => void addSelectedSubmittals()} disabled={!submittalSelectedIds.size || submittalSaving}>{submittalSaving ? t("Adding…", "Añadiendo…") : t(`Add Selected (${submittalSelectedIds.size})`, `Añadir seleccionados (${submittalSelectedIds.size})`)}</button></div>
      </div>
    </div>
  ) : null;

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
        rfi_ids: selectedRfis.map(rfi => rfi.rfiId),
        submittal_ids: selectedSubmittals.map(submittal => submittal.submittalId),
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
                  display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: "1 1 260px" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", display: "flex", flexWrap: "wrap", gap: 12 }}>
                      <span><Calendar size={11} style={{ marginRight: 3 }} />{new Date(m.meetingDate).toLocaleDateString()} {new Date(m.meetingDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {m.location && <span><MapPin size={11} style={{ marginRight: 3 }} />{m.location}</span>}
                      <span><Users size={11} style={{ marginRight: 3 }} />{m.attendeeCount} {t("attendees", "asistentes")}</span>
                      <span><CheckCircle2 size={11} style={{ marginRight: 3 }} />{m.openActionItems} {t("open", "abiertas")}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {canWrite && <button className="btn btn-sm btn-outline" onClick={() => openRfiSelector(m.id)}><Plus size={12} style={{ marginRight: 4 }} />{t("Add Existing RFI", "Añadir RFI existente")}</button>}
                    {canWrite && <button className="btn btn-sm btn-outline" onClick={() => openSubmittalSelector(m.id)}><Plus size={12} style={{ marginRight: 4 }} />{t("Add from Submittal Log", "Añadir desde el Registro de Submittals")}</button>}
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
                  {!!m.linkedRfis?.length && <div style={{ flexBasis: "100%", display: "grid", gap: 8 }}>{m.linkedRfis.map(rfi => <div key={rfi.rfiId} style={{ border: "1px solid #DBEAFE", background: "#F8FAFC", borderRadius: 8, padding: 10, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}><div style={{ flex: "1 1 220px", minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{rfi.rfiNumber} · {rfi.title}</div>{rfi.description && rfi.description !== rfi.title && <div style={{ fontSize: 12, color: "#4B5563", marginTop: 2 }}>{rfi.description}</div>}<div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{t("Status", "Estado")}: {rfi.status} · {t("Responsible", "Responsable")}: {rfi.responsible || "—"}</div></div><button className="btn btn-sm btn-outline" onClick={() => openOriginalRfi(rfi.rfiId)}><ExternalLink size={12} style={{ marginRight: 4 }} />{t("Open Original RFI", "Abrir RFI original")}</button>{canWrite && <button className="btn btn-sm btn-outline" onClick={() => void removeMeetingRfi(m.id, rfi.rfiId)}>{t("Remove link", "Quitar enlace")}</button>}</div>)}</div>}
                  {!!m.linkedSubmittals?.length && <div style={{ flexBasis: "100%", display: "grid", gap: 8 }}>{m.linkedSubmittals.map(submittal => <div key={submittal.submittalId} style={{ border: "1px solid #C7D2FE", background: "#F8FAFC", borderRadius: 8, padding: 10, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}><div style={{ flex: "1 1 240px", minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{submittal.number} · {submittal.title}</div>{submittal.description && submittal.description !== submittal.title && <div style={{ fontSize: 12, color: "#4B5563", marginTop: 2 }}>{submittal.description}</div>}<div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{[submittal.floor, submittal.discipline, humanLabel(submittal.status), submittal.responsible, submittal.deadline ? new Date(submittal.deadline).toLocaleDateString() : null].filter(Boolean).join(" · ")}</div></div><button className="btn btn-sm btn-outline" onClick={() => openOriginalSubmittal(submittal.submittalId)}><ExternalLink size={12} style={{ marginRight: 4 }} />{t("Open Original Submittal", "Abrir Submittal original")}</button>{canWrite && <button className="btn btn-sm btn-outline" onClick={() => void removeMeetingSubmittal(m.id, submittal.submittalId)}>{t("Remove link", "Quitar enlace")}</button>}</div>)}</div>}
                  {!!m.legacyRfis?.length && <div style={{ flexBasis: "100%", padding: 10, border: "1px dashed #D1D5DB", borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5 }}>{t("Legacy manual RFI notes", "Notas RFI manuales anteriores")}</div>{m.legacyRfis.map((row, index) => <div key={`${row.rfiNumber}-${index}`} style={{ fontSize: 12 }}>{[row.rfiNumber, row.description, row.status, row.responsible].filter(Boolean).join(" · ")}</div>)}</div>}
                  {!!m.legacyDeliverables?.length && <div style={{ flexBasis: "100%", padding: 10, border: "1px dashed #D1D5DB", borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5 }}>{t("Legacy manual Deliverable notes", "Notas manuales anteriores de Entregables")}</div>{m.legacyDeliverables.map((row, index) => <div key={`${row.raw}-${index}`} style={{ fontSize: 12, overflowWrap: "anywhere" }}>{row.raw}</div>)}</div>}
                  <MeetingClashesPanel projectId={projectId} meetingId={m.id} links={m.linkedClashes ?? []} canWrite={canWrite} reload={loadMeetings} />
                  {!!m.legacyViewpoints?.length && <div style={{ flexBasis: "100%", padding: 10, border: "1px dashed #D1D5DB", borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5 }}>{t("Legacy manual Viewpoint / Clash rows", "Filas manuales anteriores de Viewpoints / Clashes")}</div>{m.legacyViewpoints.map((row, index) => <div key={`${row.raw}-${index}`} style={{ fontSize: 12, overflowWrap: "anywhere" }}>{row.raw}</div>)}</div>}
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
                          <button className="btn btn-sm btn-outline" onClick={() => updateActionItem(ai.id, "completed")}>{t("Done","Listo")}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      )}
      <RfiSelectorModal />
      <SubmittalSelectorModal />
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
                {attendees.map((a, i) => {
                  const people = companyPeople(a.company);
                  const isFreeTextPerson = freeTextPersons.includes(i) || (a.company !== "" && people.length === 0);
                  const selectStyle = { border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 12, padding: "2px 4px", width: "100%", background: "white" } as const;
                  const inputStyle = { border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" } as const;
                  return (
                    <Fragment key={i}>
                      <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={CELL_STYLE}>
                          <input value={a.trade} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], trade: e.target.value }; setAttendees(arr); }}
                            style={inputStyle} />
                        </td>
                        <td style={CELL_STYLE}>
                          <select value={a.company} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], company: e.target.value, fullName: "", email: "" }; setAttendees(arr); }}
                            style={selectStyle}>
                            <option value="">{t("— Select —", "— Seleccionar —")}</option>
                            {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                            {a.company && !uniqueCompanies.includes(a.company) && <option value={a.company}>{a.company}</option>}
                          </select>
                          <button type="button"
                            onClick={() => { setAddCompanyIndex(addCompanyIndex === i ? null : i); }}
                            style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 6px", fontSize: 10, borderRadius: 4, border: "1px dashed #2563EB", background: addCompanyIndex === i ? "#EFF6FF" : "transparent", cursor: "pointer", color: "#2563EB" }}>
                            <Plus size={11} />{t("Add company not in list", "Agregar empresa fuera de lista")}
                          </button>
                        </td>
                        <td style={CELL_STYLE}>
                          {isFreeTextPerson ? (
                            <input value={a.fullName} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], fullName: e.target.value }; setAttendees(arr); }}
                              placeholder={t("Name", "Nombre")} style={inputStyle} />
                          ) : (
                            <select value={a.fullName} onChange={e => {
                              const sel = people.find(m => m.userFullName === e.target.value);
                              const arr = [...attendees];
                              arr[i] = { ...arr[i], fullName: e.target.value, email: sel ? sel.userEmail : arr[i].email };
                              setAttendees(arr);
                            }} style={selectStyle}>
                              <option value="">{t("— Select —", "— Seleccionar —")}</option>
                              {people.map(m => <option key={m.userEmail} value={m.userFullName}>{m.userFullName}</option>)}
                              {a.fullName && !people.some(m => m.userFullName === a.fullName) && <option value={a.fullName}>{a.fullName}</option>}
                            </select>
                          )}
                          {a.company && people.length > 0 && (
                            <button type="button"
                              onClick={() => setFreeTextPersons(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                              style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 6px", fontSize: 10, borderRadius: 4, border: "1px dashed #2563EB", background: freeTextPersons.includes(i) ? "#EFF6FF" : "transparent", cursor: "pointer", color: "#2563EB" }}>
                              <UserPlus size={11} />{freeTextPersons.includes(i) ? t("Select from list", "Seleccionar de lista") : t("Add person not in list", "Agregar persona fuera de lista")}
                            </button>
                          )}
                        </td>
                        <td style={CELL_STYLE}>
                          <input value={a.role} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], role: e.target.value }; setAttendees(arr); }}
                            style={inputStyle} />
                        </td>
                        <td style={CELL_STYLE}>
                          <input value={a.email} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], email: e.target.value }; setAttendees(arr); }}
                            style={inputStyle} />
                        </td>
                        <td style={CELL_STYLE}>
                          <input value={a.phone} onChange={e => { const arr = [...attendees]; arr[i] = { ...arr[i], phone: e.target.value }; setAttendees(arr); }}
                            style={inputStyle} />
                        </td>
                        <td style={CELL_STYLE}>
                          <button onClick={() => {
                            setAttendees(attendees.filter((_, j) => j !== i));
                            if (addCompanyIndex === i) resetAddCompanyForm();
                            else if (addCompanyIndex !== null && addCompanyIndex > i) setAddCompanyIndex(addCompanyIndex - 1);
                            setFreeTextPersons(prev => prev.filter(j => j !== i).map(j => j > i ? j - 1 : j));
                          }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                      {addCompanyIndex === i && (
                        <tr>
                          <td colSpan={7} style={{ ...CELL_STYLE, padding: 0 }}>
                            <div style={{ margin: 10, padding: "12px 14px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 10 }}>
                                {t("New Company Details", "Detalles de Nueva Empresa")}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Company Name *", "Nombre *")}</div>
                                  <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                                    placeholder={t("e.g. VOREA Group", "ej. VOREA Group")}
                                    style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Contact Person", "Persona de Contacto")}</div>
                                  <input value={newContactPerson} onChange={e => setNewContactPerson(e.target.value)}
                                    placeholder={t("e.g. John Smith", "ej. Juan García")}
                                    style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Email", "Correo")}</div>
                                  <input value={newCompanyEmail} onChange={e => setNewCompanyEmail(e.target.value)}
                                    placeholder="email@company.com"
                                    style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Phone", "Teléfono")}</div>
                                  <input value={newCompanyPhone} onChange={e => setNewCompanyPhone(e.target.value)}
                                    placeholder="+1 (555) 000-0000"
                                    style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                                </div>
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Address", "Dirección")}</div>
                                  <input value={newCompanyAddress} onChange={e => setNewCompanyAddress(e.target.value)}
                                    placeholder={t("Street address, City, State", "Calle, Ciudad, Estado")}
                                    style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button type="button" onClick={resetAddCompanyForm}
                                  style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer" }}>
                                  {t("Cancel", "Cancelar")}
                                </button>
                                <button type="button" onClick={() => handleAddCompany(i)}
                                  style={{ padding: "5px 14px", fontSize: 11, borderRadius: 6, background: "#2563EB", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>
                                  {t("Add Company", "Agregar Empresa")}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
            {selectedRfis.map(rfi => <div key={rfi.rfiId} style={{ padding: 10, borderBottom: "1px solid #E5E7EB", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}><div style={{ flex: "1 1 220px" }}><div style={{ fontSize: 13, fontWeight: 700 }}>{rfi.rfiNumber} · {rfi.title}</div>{rfi.description && rfi.description !== rfi.title && <div style={{ fontSize: 12, color: "#4B5563" }}>{rfi.description}</div>}<div style={{ fontSize: 11, color: "#6B7280" }}>{rfi.status} · {rfi.responsible || "—"}</div></div><button className="btn btn-sm btn-outline" onClick={() => setSelectedRfis(prev => prev.filter(item => item.rfiId !== rfi.rfiId))}>{t("Remove", "Quitar")}</button></div>)}
            {rfis.length > 0 && <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#6B7280", background: "#F9FAFB" }}>{t("Imported manual RFI notes (preserved as legacy text)", "Notas RFI manuales importadas (conservadas como texto anterior)")}</div>}
            {rfis.length > 0 && <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                      <input readOnly value={r.rfiNumber}
                        placeholder="EAST-15" style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    <td style={CELL_STYLE}>
                      <input readOnly value={r.description}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    <td style={{ ...CELL_STYLE, width: 120 }}>
                      <select disabled value={r.status}
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
                      <input readOnly value={r.responsible}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
                    </td>
                    <td style={CELL_STYLE}>
                      <span aria-hidden="true">—</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
            <div style={{ padding: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => openRfiSelector(null)}>
                <Plus size={12} style={{ marginRight: 4 }} />{t("Add Existing RFI", "Añadir RFI existente")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <SectionHeader label={t("Submittals / Deliverables", "Submittals / Entregables")} sectionKey="deliverables" />
        {expandedSections.deliverables && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[t("Floor/Area","Piso/Área"), t("Description","Descripción"), "PLUMBING", "HVAC", "FIRE PROT.", "ELECTRICAL", "OTHER", "COORDINATOR", t("Deadline","Fecha Límite"), ""].map(h => (
                    <th key={h} style={{ ...TH_STYLE, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedSubmittals.map(submittal => <tr key={submittal.submittalId} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={CELL_STYLE}>{submittal.floor || "—"}</td>
                  <td style={CELL_STYLE}><div style={{ fontWeight: 700 }}>{submittal.number} · {submittal.title}</div>{submittal.description && submittal.description !== submittal.title && <div style={{ color: "#6B7280", marginTop: 2 }}>{submittal.description}</div>}<div style={{ color: "#6B7280", marginTop: 2, fontSize: 10 }}>{submittal.discipline || t("No discipline assigned", "Sin disciplina asignada")}</div></td>
                  {(["plumbing", "hvac", "fireProtection", "electrical", "other"] as const).map(bucket => <td key={bucket} style={{ ...CELL_STYLE, width: 90, fontWeight: submittal.disciplineBucket === bucket ? 700 : 400 }}>{submittal.disciplineBucket === bucket ? humanLabel(submittal.status) : "—"}</td>)}
                  <td style={{ ...CELL_STYLE, width: 110 }}>{submittal.responsible || "—"}</td>
                  <td style={{ ...CELL_STYLE, width: 100 }}>{submittal.deadline ? new Date(submittal.deadline).toLocaleDateString() : "—"}</td>
                  <td style={CELL_STYLE}><div style={{ display: "flex", gap: 4 }}><button aria-label={t("Open Original Submittal", "Abrir Submittal original")} title={t("Open Original Submittal", "Abrir Submittal original")} onClick={() => openOriginalSubmittal(submittal.submittalId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563EB" }}><ExternalLink size={12} /></button><button aria-label={t("Remove Submittal", "Quitar Submittal")} onClick={() => setSelectedSubmittals(previous => previous.filter(row => row.submittalId !== submittal.submittalId))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><Trash2 size={12} /></button></div></td>
                </tr>)}
              </tbody>
            </table></div>
            {!!deliverables.some(row => row.description || row.plumbing || row.hvac || row.fireProt || row.electrical || row.other) && <div style={{ margin: 10, padding: 10, border: "1px dashed #D1D5DB", borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5 }}>{t("Legacy manual Deliverable rows (preserved)", "Filas manuales anteriores de Entregables (conservadas)")}</div>{deliverables.filter(row => row.description || row.plumbing || row.hvac || row.fireProt || row.electrical || row.other).map((row, index) => <div key={index} style={{ fontSize: 12 }}>{[row.floor, row.description, row.plumbing && `PL:${row.plumbing}`, row.hvac && `HVAC:${row.hvac}`, row.fireProt && `FP:${row.fireProt}`, row.electrical && `ELE:${row.electrical}`, row.other && `OTHER:${row.other}`, row.deadline].filter(Boolean).join(" · ")}</div>)}</div>}
            <div style={{ padding: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => openSubmittalSelector(null)}>
                <Plus size={12} style={{ marginRight: 4 }} />{t("Add from Submittal Log", "Añadir desde el Registro de Submittals")}
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
            <div style={{ padding: 10, color: "#6B7280", fontSize: 11 }}>{t("Imported legacy rows remain here. Save the Meeting, then use Load Open & Follow-Up Clashes for canonical records.", "Las filas anteriores importadas permanecen aquí. Guarde la reunión y luego use Cargar Clashes Abiertos y de Seguimiento para registros canónicos.")}</div>
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
      <RfiSelectorModal />
      <SubmittalSelectorModal />
    </div>
  );
}
