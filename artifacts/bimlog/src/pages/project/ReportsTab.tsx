import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { AlertCircle, CheckCircle2, Clock, FileText, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight, Activity, Award, BarChart2, RefreshCw, Send, Search, ClipboardList, AlertTriangle, GitBranch, Layers, Plus, Minus, History } from "lucide-react";
import { format } from "date-fns";

interface CvrIssue {
  id: number;
  fileName: string;
  contentVerificationResult: string;
  cvrWorkflowStatus: string;
  cvrUserReason?: string | null;
  cvrAdminAction?: string | null;
  cvrAdminActionAt?: string | null;
  hashComparisonNote?: string | null;
  createdAt: string;
  uploadedByName?: string | null;
}

interface ConventionIntelligence {
  separator: string;
  companyCodes: string;
  enforceUppercase: boolean;
  isActive: boolean;
  conventionVersion: number;
  totalVersions: number;
  userGuidance: string | null;
  acceptedDisciplines: Array<{ code: string; label: string }>;
  acceptedDocTypes: Array<{ code: string; label: string }>;
  acceptedSystems: Array<{ code: string; label: string }>;
  latestChangeSummary: string | null;
  latestAnalysisSummary: string | null;
}

interface CvrReport {
  projectId: number;
  generatedAt: string;
  totalFilesProcessed: number;
  totalFlagged: number;
  totalPendingReview: number;
  totalAdminApproved: number;
  totalAdminRejected: number;
  issues: CvrIssue[];
  conventionIntelligence?: ConventionIntelligence | null;
}

interface IntelCodeLabel { code: string; label: string }
interface IntelKeyLabel { key: string; label: string }

interface VersionDelta {
  disciplinesAdded: string[];
  disciplinesRemoved: string[];
  docTypesAdded: string[];
  docTypesRemoved: string[];
  systemsAdded: string[];
  systemsRemoved: string[];
  extraFieldsAdded: string[];
  extraFieldsRemoved: string[];
  ambiguitiesAdded: string[];
  ambiguitiesResolved: string[];
}

interface VersionSnapshot {
  version: number;
  createdAt: string;
  actorName: string | null;
  changeSummary: string | null;
  analysisSummary: string | null;
  disciplines: IntelCodeLabel[];
  docTypes: IntelCodeLabel[];
  systems: IntelCodeLabel[];
  extraFields: IntelKeyLabel[];
  ambiguities: string[];
  counts: { disciplines: number; docTypes: number; systems: number; extraFields: number; ambiguities: number };
  delta: VersionDelta | null;
}

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  severity: "high" | "medium" | "low";
  actor: string | null;
  title: string;
  summary: string;
  version: number | null;
}

interface SignificantEvent {
  eventType: string;
  severity: "high" | "medium" | "low";
  version: number | null;
  title: string;
  summary: string;
}

interface IntelligencePayload {
  project: { id: number; name: string; code: string; status: string; createdAt: string };
  currentState: {
    conventionVersion: number;
    separator: string | null;
    companyCodes: string;
    disciplines: IntelCodeLabel[];
    docTypes: IntelCodeLabel[];
    systems: IntelCodeLabel[];
    unresolvedAmbiguityCount: number;
    unresolvedAmbiguities: string[];
    fileCount: number;
    totalVersions: number;
    fieldOrder: string[];
    userGuidance: string | null;
    lastChangeDate: string | null;
  };
  intelligenceSummary: { narrative: string; stateLabel: string; conventionConfigured: boolean; hasFiles: boolean; hasAmbiguities: boolean; validationStatus: string };
  mostSignificantEvent: SignificantEvent | null;
  timeline: TimelineEvent[];
  conventionEvolution: (VersionSnapshot & { classifiedEventType: string; severity: "high" | "medium" | "low" })[];
}

function ProjectIntelligenceView({ projectId, lang }: { projectId: number; lang: string }) {
  const tl = (en: string, es: string) => lang === "es" ? es : en;
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [verFrom, setVerFrom] = useState("");
  const [verTo, setVerTo] = useState("");
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  async function fetchIntelWithParams(df: string, dt: string, vf: string, vt: string) {
    setLoading(true);
    setError(null);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const params = new URLSearchParams();
      if (df) params.set("from", df);
      if (dt) params.set("to", dt);
      if (vf) params.set("versionFrom", vf);
      if (vt) params.set("versionTo", vt);
      const resp = await fetch(`/api/v1/projects/${projectId}/intelligence-summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to load intelligence");
      setData(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const fetchIntel = () => fetchIntelWithParams(dateFrom, dateTo, verFrom, verTo);

  useEffect(() => { fetchIntelWithParams("", "", "", ""); }, [projectId]);

  if (loading) return <div style={{ textAlign: "center", padding: "30px 0", color: "#6B7280", fontSize: 13 }}>{tl("Loading project intelligence...", "Cargando inteligencia del proyecto...")}</div>;
  if (error) return <div style={{ padding: "12px 16px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13 }}>{error}</div>;
  if (!data) return null;

  const cs = data.currentState;
  const hasDelta = (d: VersionDelta | null) => {
    if (!d) return false;
    return d.disciplinesAdded.length > 0 || d.disciplinesRemoved.length > 0 || d.docTypesAdded.length > 0 || d.docTypesRemoved.length > 0 || d.systemsAdded.length > 0 || d.systemsRemoved.length > 0 || d.extraFieldsAdded.length > 0 || d.extraFieldsRemoved.length > 0 || d.ambiguitiesAdded.length > 0 || d.ambiguitiesResolved.length > 0;
  };

  const sectionHead = (icon: React.ReactNode, title: string): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, color: "#1D4ED8", marginBottom: 12 });

  const severityColor = (s: string) => s === "high" ? "#DC2626" : s === "medium" ? "#D97706" : "#16A34A";
  const severityBg = (s: string) => s === "high" ? "#FEF2F2" : s === "medium" ? "#FFFBEB" : "#F0FDF4";
  const severityBorder = (s: string) => s === "high" ? "#FECACA" : s === "medium" ? "#FDE68A" : "#BBF7D0";
  const stateLabelColor: Record<string, { color: string; bg: string }> = {
    stable: { color: "#166534", bg: "#F0FDF4" },
    unstable: { color: "#DC2626", bg: "#FEF2F2" },
    incomplete: { color: "#D97706", bg: "#FFFBEB" },
    untested: { color: "#6B7280", bg: "#F3F4F6" },
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 3 }}>{tl("From", "Desde")}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #D1D5DB", fontSize: 11, background: "#fff", color: "#111" }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 3 }}>{tl("To", "Hasta")}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #D1D5DB", fontSize: 11, background: "#fff", color: "#111" }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 3 }}>{tl("Version From", "Versión desde")}</label>
          <input type="number" min={1} value={verFrom} onChange={e => setVerFrom(e.target.value)} placeholder="1" style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #D1D5DB", fontSize: 11, width: 60, background: "#fff", color: "#111" }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 3 }}>{tl("Version To", "Versión hasta")}</label>
          <input type="number" min={1} value={verTo} onChange={e => setVerTo(e.target.value)} placeholder={String(cs.totalVersions)} style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #D1D5DB", fontSize: 11, width: 60, background: "#fff", color: "#111" }} />
        </div>
        <button onClick={() => fetchIntel()} style={{ padding: "6px 14px", borderRadius: 5, background: "#1D4ED8", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{tl("Apply Filters", "Aplicar filtros")}</button>
        <button
          onClick={() => { setDateFrom(""); setDateTo(""); setVerFrom(""); setVerTo(""); fetchIntelWithParams("", "", "", ""); }}
          disabled={!dateFrom && !dateTo && !verFrom && !verTo}
          style={{ padding: "6px 12px", borderRadius: 5, background: "transparent", color: (dateFrom || dateTo || verFrom || verTo) ? "#DC2626" : "#9CA3AF", border: `1px solid ${(dateFrom || dateTo || verFrom || verTo) ? "#FECACA" : "#E5E7EB"}`, fontSize: 11, fontWeight: 600, cursor: (dateFrom || dateTo || verFrom || verTo) ? "pointer" : "default", opacity: (dateFrom || dateTo || verFrom || verTo) ? 1 : 0.5 }}
        >{tl("Clear Filters", "Limpiar filtros")}</button>
      </div>
      {(dateFrom || dateTo || verFrom || verTo) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", alignSelf: "center" }}>{tl("Active filters:", "Filtros activos:")}</span>
          {dateFrom && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#DBEAFE", color: "#1E40AF", fontWeight: 600 }}>{tl("From", "Desde")}: {dateFrom}</span>}
          {dateTo && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#DBEAFE", color: "#1E40AF", fontWeight: 600 }}>{tl("To", "Hasta")}: {dateTo}</span>}
          {verFrom && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>{tl("Version", "Version")} {">="} {verFrom}</span>}
          {verTo && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>{tl("Version", "Version")} {"<="} {verTo}</span>}
        </div>
      )}

      {/* MOST SIGNIFICANT EVENT */}
      {data.mostSignificantEvent && (
        <button
          type="button"
          onClick={() => {
            if (data.mostSignificantEvent?.version != null) {
              setExpandedVersion(data.mostSignificantEvent.version);
              setTimeout(() => {
                document.getElementById(`evo-version-${data.mostSignificantEvent!.version}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 60);
            }
          }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 8, border: `1px solid ${severityBorder(data.mostSignificantEvent.severity)}`, background: severityBg(data.mostSignificantEvent.severity), marginBottom: 16, cursor: data.mostSignificantEvent.version != null ? "pointer" : "default" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <AlertTriangle style={{ width: 14, height: 14, color: severityColor(data.mostSignificantEvent.severity) }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: severityColor(data.mostSignificantEvent.severity) }}>{data.mostSignificantEvent.title}</span>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: severityColor(data.mostSignificantEvent.severity) + "18", color: severityColor(data.mostSignificantEvent.severity), fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{data.mostSignificantEvent.eventType.replace(/_/g, " ")}</span>
            {data.mostSignificantEvent.version != null && <span style={{ fontSize: 9, color: "#6B7280", marginLeft: "auto" }}>{tl("Click to view version", "Clic para ver version")} v{data.mostSignificantEvent.version}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>{data.mostSignificantEvent.summary}</div>
        </button>
      )}

      {/* A. PROJECT INTELLIGENCE SUMMARY */}
      <div style={{ padding: "16px 20px", borderRadius: 10, border: "1px solid #BFDBFE", background: "#EFF6FF", marginBottom: 20 }}>
        <div style={sectionHead(null, "")}>
          <Layers style={{ width: 16, height: 16 }} />
          {tl("Project Intelligence Summary", "Resumen de Inteligencia del Proyecto")}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "#1E3A5F" }}>{data.intelligenceSummary.narrative}</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          {data.intelligenceSummary.stateLabel && (() => {
            const sc = stateLabelColor[data.intelligenceSummary.stateLabel] || stateLabelColor.untested;
            return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: sc.bg, color: sc.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{data.intelligenceSummary.stateLabel}</span>;
          })()}
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#DBEAFE", color: "#1E40AF", fontWeight: 600 }}>v{cs.conventionVersion} ({cs.totalVersions} {tl("versions", "versiones")})</span>
          {cs.disciplines.length > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>{cs.disciplines.length} {tl("disciplines", "disciplinas")}</span>}
          {cs.docTypes.length > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#F0FDF4", color: "#166534", fontWeight: 600 }}>{cs.docTypes.length} {tl("doc types", "tipos doc")}</span>}
          {cs.systems.length > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>{cs.systems.length} {tl("systems", "sistemas")}</span>}
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: cs.fileCount > 0 ? "#F0FDF4" : "#F3F4F6", color: cs.fileCount > 0 ? "#166534" : "#6B7280", fontWeight: 600 }}>{cs.fileCount} {tl("files", "archivos")}</span>
          {cs.unresolvedAmbiguityCount > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#FEF2F2", color: "#DC2626", fontWeight: 600 }}>{cs.unresolvedAmbiguityCount} {tl("unresolved", "sin resolver")}</span>}
        </div>
        {cs.unresolvedAmbiguityCount > 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
              <AlertTriangle style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {tl("Unresolved Ambiguities", "Ambiguedades sin resolver")}
            </div>
            {cs.unresolvedAmbiguities.map((a, i) => (
              <div key={i} style={{ fontSize: 11, color: "#7F1D1D", padding: "2px 0", borderBottom: i < cs.unresolvedAmbiguities.length - 1 ? "1px solid #FECACA" : "none" }}>{a}</div>
            ))}
          </div>
        )}
      </div>

      {/* B. PROJECT TIMELINE */}
      <div style={{ padding: "16px 20px", borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", marginBottom: 20 }}>
        <div style={sectionHead(null, "")}>
          <History style={{ width: 16, height: 16 }} />
          {tl("Project Timeline", "Cronología del Proyecto")}
        </div>
        {data.timeline.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center", padding: 16 }}>{tl("No events in selected range.", "Sin eventos en el rango seleccionado.")}</div>
        ) : (
          <div style={{ position: "relative", paddingLeft: 20 }}>
            <div style={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 2, background: "#D1D5DB" }} />
            {data.timeline.map((ev, i) => {
              const dotColor = severityColor(ev.severity);
              const isClassified = ev.eventType === "STRUCTURAL_RESET" || ev.eventType === "MAJOR_EXPANSION" || ev.eventType === "AMBIGUITY_INCREASE" || ev.eventType === "STABILIZATION";
              const isClickable = ev.version != null;
              const handleTimelineClick = () => {
                if (ev.version != null) {
                  setExpandedVersion(ev.version);
                  setTimeout(() => {
                    document.getElementById(`evo-version-${ev.version}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 60);
                }
              };
              return (
              <div
                key={i}
                onClick={handleTimelineClick}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === "Enter") handleTimelineClick(); } : undefined}
                style={{ position: "relative", paddingBottom: 14, paddingLeft: 16, cursor: isClickable ? "pointer" : "default", borderRadius: 6, transition: "background 0.15s" }}
                onMouseEnter={isClickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9FAFB"; } : undefined}
                onMouseLeave={isClickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; } : undefined}
              >
                <div style={{ position: "absolute", left: -2, top: 4, width: 10, height: 10, borderRadius: "50%", background: dotColor, border: "2px solid #fff", zIndex: 1 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{ev.title}</span>
                    {isClassified && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: severityBg(ev.severity), color: severityColor(ev.severity), fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, border: `1px solid ${severityBorder(ev.severity)}` }}>{ev.eventType.replace(/_/g, " ")}</span>}
                    {isClickable && <span style={{ fontSize: 8, color: "#9CA3AF" }}>v{ev.version}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#6B7280", flexShrink: 0 }}>{format(new Date(ev.timestamp), "MMM d, yyyy HH:mm")}</div>
                </div>
                <div style={{ fontSize: 11, color: "#374151", marginTop: 2, lineHeight: 1.5 }}>{ev.summary.length > 200 ? ev.summary.slice(0, 200) + "..." : ev.summary}</div>
                {ev.actor && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{ev.actor}</div>}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* C. CONVENTION EVOLUTION */}
      <div style={{ padding: "16px 20px", borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", marginBottom: 20 }}>
        <div style={sectionHead(null, "")}>
          <GitBranch style={{ width: 16, height: 16 }} />
          {tl("Convention Evolution", "Evolución de la Convención")}
        </div>
        {data.conventionEvolution.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center", padding: 16 }}>{tl("No versions in selected range.", "Sin versiones en el rango seleccionado.")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.conventionEvolution.map(v => {
              const isExpanded = expandedVersion === v.version;
              const hasDeltas = hasDelta(v.delta);
              return (
                <div key={v.version} id={`evo-version-${v.version}`} style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", transition: "box-shadow 0.3s", boxShadow: expandedVersion === v.version ? "0 0 0 2px #3B82F6" : "none" }}>
                  <button onClick={() => setExpandedVersion(isExpanded ? null : v.version)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isExpanded ? "#F9FAFB" : "#fff", border: "none", cursor: "pointer", textAlign: "left" }}>
                    {isExpanded ? <ChevronDown style={{ width: 14, height: 14, color: "#6B7280", flexShrink: 0 }} /> : <ChevronRight style={{ width: 14, height: 14, color: "#6B7280", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>v{v.version}</span>
                        <span style={{ fontSize: 10, color: "#6B7280" }}>{format(new Date(v.createdAt), "MMM d, yyyy HH:mm")}</span>
                        {v.actorName && <span style={{ fontSize: 10, color: "#6B7280" }}>{v.actorName}</span>}
                      </div>
                      {v.changeSummary && <div style={{ fontSize: 11, color: "#374151", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.changeSummary}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                      {v.classifiedEventType && v.classifiedEventType !== "convention_version" && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: severityBg(v.severity), color: severityColor(v.severity), fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, border: `1px solid ${severityBorder(v.severity)}` }}>{v.classifiedEventType.replace(/_/g, " ")}</span>}
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>{v.counts.disciplines}D</span>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#F0FDF4", color: "#166534", fontWeight: 600 }}>{v.counts.docTypes}T</span>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>{v.counts.systems}S</span>
                      {v.counts.ambiguities > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#FEF2F2", color: "#DC2626", fontWeight: 600 }}>{v.counts.ambiguities}?</span>}
                    </div>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "12px 14px", borderTop: "1px solid #E5E7EB", background: "#FAFAFA" }}>
                      {hasDeltas && v.delta && (
                        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", marginBottom: 4 }}>{tl("Changes from previous version", "Cambios respecto a la versión anterior")}</div>
                          {v.delta.disciplinesAdded.length > 0 && <div style={{ fontSize: 11, color: "#166534" }}><Plus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Disciplines added", "Disciplinas agregadas")}: {v.delta.disciplinesAdded.join(", ")}</div>}
                          {v.delta.disciplinesRemoved.length > 0 && <div style={{ fontSize: 11, color: "#DC2626" }}><Minus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Disciplines removed", "Disciplinas eliminadas")}: {v.delta.disciplinesRemoved.join(", ")}</div>}
                          {v.delta.docTypesAdded.length > 0 && <div style={{ fontSize: 11, color: "#166534" }}><Plus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Doc types added", "Tipos doc agregados")}: {v.delta.docTypesAdded.join(", ")}</div>}
                          {v.delta.docTypesRemoved.length > 0 && <div style={{ fontSize: 11, color: "#DC2626" }}><Minus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Doc types removed", "Tipos doc eliminados")}: {v.delta.docTypesRemoved.join(", ")}</div>}
                          {v.delta.systemsAdded.length > 0 && <div style={{ fontSize: 11, color: "#166534" }}><Plus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Systems added", "Sistemas agregados")}: {v.delta.systemsAdded.join(", ")}</div>}
                          {v.delta.systemsRemoved.length > 0 && <div style={{ fontSize: 11, color: "#DC2626" }}><Minus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Systems removed", "Sistemas eliminados")}: {v.delta.systemsRemoved.join(", ")}</div>}
                          {v.delta.extraFieldsAdded.length > 0 && <div style={{ fontSize: 11, color: "#166534" }}><Plus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Fields added", "Campos agregados")}: {v.delta.extraFieldsAdded.join(", ")}</div>}
                          {v.delta.extraFieldsRemoved.length > 0 && <div style={{ fontSize: 11, color: "#DC2626" }}><Minus style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Fields removed", "Campos eliminados")}: {v.delta.extraFieldsRemoved.join(", ")}</div>}
                          {v.delta.ambiguitiesAdded.length > 0 && <div style={{ fontSize: 11, color: "#D97706" }}><AlertTriangle style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("New ambiguities", "Nuevas ambiguedades")}: {v.delta.ambiguitiesAdded.length}</div>}
                          {v.delta.ambiguitiesResolved.length > 0 && <div style={{ fontSize: 11, color: "#16A34A" }}><CheckCircle2 style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} /> {tl("Ambiguities resolved", "Ambiguedades resueltas")}: {v.delta.ambiguitiesResolved.length}</div>}
                        </div>
                      )}
                      {v.disciplines.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>{tl("Disciplines", "Disciplinas")}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {v.disciplines.map(d => <span key={d.code} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>{d.code}{d.label !== d.code ? ` - ${d.label}` : ""}</span>)}
                          </div>
                        </div>
                      )}
                      {v.docTypes.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>{tl("Document Types", "Tipos de Documento")}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {v.docTypes.map(d => <span key={d.code} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "#F0FDF4", color: "#166534", fontWeight: 600 }}>{d.code}{d.label !== d.code ? ` - ${d.label}` : ""}</span>)}
                          </div>
                        </div>
                      )}
                      {v.systems.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>{tl("Systems", "Sistemas")}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {v.systems.map(s => <span key={s.code} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>{s.code} - {s.label}</span>)}
                          </div>
                        </div>
                      )}
                      {v.analysisSummary && (
                        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>{tl("Analysis Summary", "Resumen de Análisis")}</div>
                          <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>{v.analysisSummary}</div>
                        </div>
                      )}
                      {v.ambiguities.length > 0 && (
                        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FECACA" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#991B1B", marginBottom: 3 }}>{tl("Ambiguities", "Ambiguedades")} ({v.ambiguities.length})</div>
                          {v.ambiguities.map((a, i) => <div key={i} style={{ fontSize: 11, color: "#7F1D1D", padding: "2px 0" }}>{a}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending_admin_review: { label: "Pending Review", color: "#7C3AED", bg: "#F5F3FF", icon: <Clock style={{ width: 10, height: 10 }} /> },
    admin_approved: { label: "Approved", color: "#16A34A", bg: "#F0FDF4", icon: <ThumbsUp style={{ width: 10, height: 10 }} /> },
    admin_rejected: { label: "Rejected", color: "#DC2626", bg: "#FEF2F2", icon: <ThumbsDown style={{ width: 10, height: 10 }} /> },
    clean: { label: "Clean", color: "#64748B", bg: "#F8FAFC", icon: <CheckCircle2 style={{ width: 10, height: 10 }} /> },
  };
  const s = map[status] ?? { label: status, color: "#64748B", bg: "#F8FAFC", icon: null };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
      borderRadius: 999, fontSize: 10, fontWeight: 700,
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
    }}>
      {s.icon}
      {s.label}
    </span>
  );
}

function CvrBadge({ result }: { result: string }) {
  const isClear = result === "clear_mismatch";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
      borderRadius: 999, fontSize: 10, fontWeight: 700,
      color: isClear ? "#DC2626" : "#D97706",
      background: isClear ? "#FEF2F2" : "#FFFBEB",
      border: `1px solid ${isClear ? "#DC262630" : "#D9770630"}`,
    }}>
      <AlertCircle style={{ width: 10, height: 10 }} />
      {isClear ? "Clear Mismatch" : "Possible Mismatch"}
    </span>
  );
}

const PDF_REPORTS: { key: string; labelEn: string; labelEs: string; icon: React.ReactNode }[] = [
  { key: "project-health",    labelEn: "Project Health",       labelEs: "Salud del Proyecto",      icon: <Activity size={20} /> },
  { key: "compliance",        labelEn: "Compliance Report",    labelEs: "Cumplimiento",             icon: <CheckCircle2 size={20} /> },
  { key: "rfi-aging",         labelEn: "RFI Aging",            labelEs: "Antigüedad de RFIs",       icon: <Clock size={20} /> },
  { key: "submittal-status",  labelEn: "Submittal Status",     labelEs: "Estado de Submittals",     icon: <ClipboardList size={20} /> },
  { key: "performance",       labelEn: "Team Performance",     labelEs: "Rendimiento del Equipo",   icon: <BarChart2 size={20} /> },
  { key: "audit-certificate", labelEn: "Audit Certificate",    labelEs: "Certificado de Auditoría", icon: <Award size={20} /> },
  { key: "meeting-minutes",   labelEn: "Meeting Minutes Log",  labelEs: "Log de Actas",             icon: <FileText size={20} /> },
  { key: "change-order-log",  labelEn: "Change Order Log",     labelEs: "Log de Órdenes de Cambio", icon: <RefreshCw size={20} /> },
  { key: "transmittal-log",   labelEn: "Transmittal Log",      labelEs: "Log de Transmisiones",     icon: <Send size={20} /> },
  { key: "cvr",               labelEn: "CVR Full Report",      labelEs: "Reporte CVR Completo",     icon: <Search size={20} /> },
];

export function ReportsTab({ projectId, isAdmin }: { projectId: number; isAdmin: boolean }) {
  const { t, lang } = useI18n();
  const tl = (en: string, es: string) => lang === "es" ? es : en;
  const [report, setReport] = useState<CvrReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approvalLoading, setApprovalLoading] = useState<number | null>(null);
  const [approvalReason, setApprovalReason] = useState<Record<number, string>>({});

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const resp = await fetch(`/api/v1/projects/${projectId}/cvr-report?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to load report");
      const data = await resp.json() as CvrReport;
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdminAction = async (fileId: number, action: "approve" | "reject") => {
    const reason = approvalReason[fileId] || "";
    if (action === "reject" && !reason.trim()) {
      alert("A reason is required to reject a file.");
      return;
    }
    setApprovalLoading(fileId);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      await fetch(`/api/v1/projects/${projectId}/files/${fileId}/cvr-${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      await fetchReport();
      setApprovalReason(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    } finally {
      setApprovalLoading(null);
    }
  };

  const statStyle: React.CSSProperties = {
    flex: 1, minWidth: 120, padding: "14px 18px",
    borderRadius: 10, border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
  };

  const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;

  return (
    <div>
      {/* Project Intelligence Layer */}
      <ProjectIntelligenceView projectId={projectId} lang={lang} />

      {/* PDF Reports section */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))" }}>
            {tl("Project PDF Reports", "Reportes PDF del Proyecto")}
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
            {tl("Download any report as a professionally formatted PDF", "Descarga cualquier reporte como PDF con formato profesional")}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {PDF_REPORTS.map(r => (
            <button
              key={r.key}
              title={tl(`Download ${r.labelEn} PDF`, `Descargar PDF: ${r.labelEs}`)}
              onClick={() => window.open(`/api/v1/projects/${projectId}/reports/${r.key}/pdf?token=${token}`, "_blank")}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                border: "1px solid hsl(var(--border))", borderRadius: 9,
                background: "hsl(var(--card))", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))",
                textAlign: "left", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#2563EB")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{r.icon}</span>
              <div>
                <div>{tl(r.labelEn, r.labelEs)}</div>
                <div style={{ fontSize: 10, fontWeight: 400, color: "hsl(var(--muted-foreground))", marginTop: 1 }}>PDF</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>CVR Reports</div>
          <div className="section-sub">Content Verification Results — flagged files and admin review workflow</div>
        </div>
      </div>

      {/* Date filter */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 4 }}>From</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 6, border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))", fontSize: 12, color: "hsl(var(--foreground))",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 4 }}>To</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 6, border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))", fontSize: 12, color: "hsl(var(--foreground))",
            }}
          />
        </div>
        <button
          onClick={fetchReport}
          style={{
            padding: "7px 16px", borderRadius: 6, background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))", border: "none", fontSize: 12,
            fontWeight: 600, cursor: "pointer",
          }}
        >
          Apply Filter
        </button>
        {(from || to) && (
          <button
            onClick={() => { setFrom(""); setTo(""); setTimeout(fetchReport, 0); }}
            style={{
              padding: "7px 14px", borderRadius: 6, background: "transparent",
              color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
          Loading report…
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "hsl(var(--destructive) / 0.08)", border: "1px solid hsl(var(--destructive) / 0.2)", color: "hsl(var(--destructive))", fontSize: 13 }}>
          {error}
        </div>
      )}

      {report && !loading && (
        <>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={statStyle}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "hsl(var(--foreground))" }}>{report.totalFilesProcessed}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>Total Files</div>
            </div>
            <div style={{ ...statStyle, borderColor: "#D97706", background: "#FFFBEB" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#D97706" }}>{report.totalFlagged}</div>
              <div style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>Flagged by AI</div>
            </div>
            <div style={{ ...statStyle, borderColor: "#7C3AED", background: "#F5F3FF" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#7C3AED" }}>{report.totalPendingReview}</div>
              <div style={{ fontSize: 11, color: "#5B21B6", marginTop: 2 }}>Pending Review</div>
            </div>
            <div style={{ ...statStyle, borderColor: "#16A34A", background: "#F0FDF4" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#16A34A" }}>{report.totalAdminApproved}</div>
              <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>Admin Approved</div>
            </div>
            <div style={{ ...statStyle, borderColor: "#DC2626", background: "#FEF2F2" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#DC2626" }}>{report.totalAdminRejected}</div>
              <div style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>Admin Rejected</div>
            </div>
          </div>

          {/* Convention Intelligence */}
          {report.conventionIntelligence && (
            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))", marginBottom: 12 }}>
                {tl("Convention Intelligence", "Inteligencia de Convención")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>{tl("Version", "Versión")}: </span>
                  <span style={{ fontWeight: 600 }}>v{report.conventionIntelligence.conventionVersion}</span>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}> ({report.conventionIntelligence.totalVersions} {tl("total", "total")})</span>
                </div>
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>{tl("Separator", "Separador")}: </span>
                  <span style={{ fontWeight: 600 }}>{report.conventionIntelligence.separator === "-" ? "Dash (-)" : report.conventionIntelligence.separator === "_" ? "Underscore (_)" : report.conventionIntelligence.separator}</span>
                </div>
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>{tl("Companies", "Empresas")}: </span>
                  <span style={{ fontWeight: 600 }}>{report.conventionIntelligence.companyCodes || "—"}</span>
                </div>
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>{tl("Status", "Estado")}: </span>
                  <span style={{ fontWeight: 600, color: report.conventionIntelligence.isActive ? "#16A34A" : "#DC2626" }}>
                    {report.conventionIntelligence.isActive ? tl("Active", "Activa") : tl("Inactive", "Inactiva")}
                  </span>
                </div>
              </div>
              {report.conventionIntelligence.acceptedDisciplines.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{tl("Disciplines", "Disciplinas")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {report.conventionIntelligence.acceptedDisciplines.map(d => (
                      <span key={d.code} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>{d.code}</span>
                    ))}
                  </div>
                </div>
              )}
              {report.conventionIntelligence.acceptedDocTypes.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{tl("Document Types", "Tipos de Documento")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {report.conventionIntelligence.acceptedDocTypes.map(d => (
                      <span key={d.code} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#F0FDF4", color: "#166534", fontWeight: 600 }}>{d.code}</span>
                    ))}
                  </div>
                </div>
              )}
              {report.conventionIntelligence.acceptedSystems.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{tl("Systems", "Sistemas")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {report.conventionIntelligence.acceptedSystems.slice(0, 20).map(s => (
                      <span key={s.code} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>{s.code}</span>
                    ))}
                    {report.conventionIntelligence.acceptedSystems.length > 20 && (
                      <span style={{ fontSize: 10, padding: "2px 8px", color: "hsl(var(--muted-foreground))" }}>+{report.conventionIntelligence.acceptedSystems.length - 20} more</span>
                    )}
                  </div>
                </div>
              )}
              {report.conventionIntelligence.userGuidance && (
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", padding: "6px 10px", background: "hsl(var(--muted) / 0.3)", borderRadius: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>{tl("Guidance", "Guía")}: </span>{report.conventionIntelligence.userGuidance}
                </div>
              )}
            </div>
          )}

          {/* Issues list */}
          {report.issues.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <CheckCircle2 style={{ width: 22, height: 22, color: report.totalFilesProcessed === 0 ? "#9CA3AF" : "#16A34A" }} />
              </div>
              <div className="empty-title" style={{ color: report.totalFilesProcessed === 0 ? "#6B7280" : "#16A34A" }}>
                {report.totalFilesProcessed === 0
                  ? "No files uploaded yet"
                  : (from || to)
                    ? "No CVR flags in selected date range"
                    : report.totalFlagged === 0
                      ? "No CVR flags found"
                      : "No pending issues"}
              </div>
              <div className="empty-desc">
                {report.totalFilesProcessed === 0
                  ? "No files have been uploaded to this project. CVR analysis runs automatically when files are submitted."
                  : (from || to)
                    ? "No content verification flags were raised in the selected date range."
                    : report.totalFlagged === 0
                      ? "All uploaded files passed content verification. No mismatches were detected."
                      : "All flagged files have been resolved — no items pending admin review."}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {report.issues.map(issue => {
                const isExpanded = expandedId === issue.id;
                return (
                  <div key={issue.id} style={{
                    border: "1px solid hsl(var(--border))", borderRadius: 10,
                    background: "hsl(var(--card))", overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {isExpanded
                        ? <ChevronDown style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                        : <ChevronRight style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />}
                      <FileText style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {issue.fileName}
                        </div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                          Uploaded {format(new Date(issue.createdAt), "MMM d, yyyy")}
                          {issue.uploadedByName ? ` by ${issue.uploadedByName}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <CvrBadge result={issue.contentVerificationResult} />
                        <StatusBadge status={issue.cvrWorkflowStatus || "clean"} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid hsl(var(--border))" }}>
                        {issue.hashComparisonNote && (
                          <div style={{
                            margin: "12px 0 0", padding: "10px 12px", borderRadius: 6,
                            background: issue.contentVerificationResult === "clear_mismatch" ? "#FEF2F2" : "#FFFBEB",
                            border: `1px solid ${issue.contentVerificationResult === "clear_mismatch" ? "#DC262630" : "#D9770630"}`,
                            fontSize: 12, color: "hsl(var(--foreground))", lineHeight: 1.6,
                          }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: issue.contentVerificationResult === "clear_mismatch" ? "#DC2626" : "#D97706" }}>
                              AI Assessment
                            </div>
                            {issue.hashComparisonNote}
                          </div>
                        )}

                        {issue.cvrUserReason && (
                          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "hsl(var(--muted) / 0.5)", fontSize: 12 }}>
                            <span style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>User explanation: </span>
                            <span style={{ color: "hsl(var(--muted-foreground))" }}>{issue.cvrUserReason}</span>
                          </div>
                        )}

                        {issue.cvrAdminAction && (
                          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "hsl(var(--muted) / 0.5)", fontSize: 12 }}>
                            <span style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>Admin decision: </span>
                            <span style={{ color: "hsl(var(--muted-foreground))" }}>{issue.cvrAdminAction}</span>
                            {issue.cvrAdminActionAt && (
                              <span style={{ color: "hsl(var(--muted-foreground))" }}> · {format(new Date(issue.cvrAdminActionAt), "MMM d, yyyy HH:mm")}</span>
                            )}
                          </div>
                        )}

                        {isAdmin && issue.cvrWorkflowStatus === "pending_admin_review" && (
                          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 8 }}>Admin Decision</div>
                            <textarea
                              value={approvalReason[issue.id] || ""}
                              onChange={e => setApprovalReason(prev => ({ ...prev, [issue.id]: e.target.value }))}
                              placeholder="Notes or reason (required to reject)…"
                              style={{
                                width: "100%", minHeight: 60, padding: "8px 10px",
                                borderRadius: 6, border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--background))", fontSize: 12,
                                color: "hsl(var(--foreground))", resize: "vertical",
                                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                              }}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button
                                disabled={approvalLoading === issue.id}
                                onClick={() => handleAdminAction(issue.id, "approve")}
                                style={{
                                  padding: "7px 16px", borderRadius: 6, border: "none",
                                  background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 600,
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                  opacity: approvalLoading === issue.id ? 0.6 : 1,
                                }}
                              >
                                <ThumbsUp style={{ width: 12, height: 12 }} />
                                Approve
                              </button>
                              <button
                                disabled={approvalLoading === issue.id}
                                onClick={() => handleAdminAction(issue.id, "reject")}
                                style={{
                                  padding: "7px 16px", borderRadius: 6, border: "none",
                                  background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 600,
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                  opacity: approvalLoading === issue.id ? 0.6 : 1,
                                }}
                              >
                                <ThumbsDown style={{ width: 12, height: 12 }} />
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
            Report generated {format(new Date(report.generatedAt), "MMM d, yyyy HH:mm")} ·{" "}
            {from || to ? "Filtered date range" : "Showing pending issues only (use date filter to view all)"}
          </div>
        </>
      )}
    </div>
  );
}
