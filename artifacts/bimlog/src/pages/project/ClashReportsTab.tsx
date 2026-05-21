import { useState, useEffect, useRef, Fragment } from "react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Upload, ChevronLeft, AlertTriangle } from "lucide-react";
import { isDebug } from "@/lib/debug";

const API = "/api/v1";

interface ClashReport {
  id: number; fileName: string; format: string; totalClashes: number;
  p1Count: number; p2Count: number; p3Count: number; p4Count: number;
  status: string; aiSummary?: string; createdAt: string;
}

interface Clash {
  id: number; clashIdOriginal?: string; description?: string;
  element1?: string; element2?: string; discipline1?: string;
  discipline2?: string; gridLocation?: string; level?: string;
  priority?: string; priorityReason?: string; status: string;
  assignedToName?: string; resolutionNotes?: string;
}

const P_COLORS: Record<string, { bg: string; text: string }> = {
  P1: { bg: "#FEE2E2", text: "#DC2626" },
  P2: { bg: "#FEF3C7", text: "#D97706" },
  P3: { bg: "#FEF9C3", text: "#CA8A04" },
  P4: { bg: "#F3F4F6", text: "#6B7280" },
};

function PBadge({ p }: { p?: string }) {
  const c = P_COLORS[p ?? ""] ?? { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11,
      fontWeight: 700, background: c.bg, color: c.text }}>
      {p ?? "—"}
    </span>
  );
}

export function ClashReportsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const headers = { Authorization: `Bearer ${token}` };
  const fileRef = useRef<HTMLInputElement>(null);

  const [reports, setReports] = useState<ClashReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error, setError] = useState("");
  const [selectedReport, setSelectedReport] = useState<ClashReport | null>(null);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [clashLoading, setClashLoading] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

  const loadReports = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports`, { headers });
      if (r.ok) setReports(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { loadReports(); }, [projectId]);

  const loadClashes = async (report: ClashReport) => {
    setSelectedReport(report);
    setClashLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/${report.id}`, { headers });
      if (r.ok) {
        const data = await r.json();
        setClashes(data.clashes ?? []);
      }
    } finally { setClashLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx","xls","csv"].includes(ext ?? "")) {
      setError("Unsupported format. Use Excel (.xlsx, .xls) or CSV.");
      return;
    }
    setUploading(true);
    setError("");
    setUploadMsg("Uploading clash register...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/upload`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        const debugMsg = isDebug() ? ` | Raw: ${JSON.stringify(d)}` : "";
        setError((d.message || d.error || "Upload failed") + debugMsg);
        return;
      }
      const data = await r.json();
      setUploadMsg(`${data.total_parsed} clashes imported. AI is ranking by priority...`);
      await loadReports();
      setTimeout(() => loadReports(), 5000);
      setTimeout(() => { loadReports(); setUploadMsg(""); }, 12000);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const updateClash = async (clashId: number, updates: Partial<Clash>) => {
    if (!selectedReport) return;
    await fetch(`${API}/projects/${projectId}/clash-reports/${selectedReport.id}/clashes/${clashId}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setClashes(prev => prev.map(c => c.id === clashId ? { ...c, ...updates } : c));
  };

  const filteredClashes = clashes
    .filter(c => filterPriority === "all" || c.priority === filterPriority)
    .filter(c => filterStatus === "all" || c.status === filterStatus)
    .filter(c => !search || (c.description ?? "").toLowerCase().includes(search.toLowerCase()) || (c.element1 ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const order = { P1: 0, P2: 1, P3: 2, P4: 3 };
      return (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
    });

  if (selectedReport) return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setSelectedReport(null)}
          style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={14} /> {t("Back", "Volver")}
        </button>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{selectedReport.fileName}</h2>
          <p style={{ margin: "2px 0 0", color: "#6B7280", fontSize: 12 }}>
            {new Date(selectedReport.createdAt).toLocaleDateString()} · {selectedReport.totalClashes} {t("clashes","choques")}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: t("Total","Total"), value: selectedReport.totalClashes, color: "#1D4ED8" },
          { label: "P1 Critical", value: selectedReport.p1Count, color: "#DC2626" },
          { label: "P2 This Week", value: selectedReport.p2Count, color: "#D97706" },
          { label: "P3 Monitor", value: selectedReport.p3Count, color: "#CA8A04" },
          { label: "P4 Low", value: selectedReport.p4Count, color: "#6B7280" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {selectedReport.aiSummary && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8,
          padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1E40AF" }}>
          {selectedReport.aiSummary}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
          <option value="all">{t("All Priorities","Todas las Prioridades")}</option>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 This Week</option>
          <option value="P3">P3 Monitor</option>
          <option value="P4">P4 Low</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
          <option value="all">{t("All Statuses","Todos los Estados")}</option>
          <option value="open">{t("Open","Abierto")}</option>
          <option value="in_progress">{t("In Progress","En Progreso")}</option>
          <option value="resolved">{t("Resolved","Resuelto")}</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("Search clashes...","Buscar choques...")}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, flex: 1, minWidth: 200 }} />
      </div>

      {clashLoading
        ? <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>{t("Loading clashes...","Cargando choques...")}</div>
        : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1E3A5F" }}>
                  {["Priority","ID","Description","Element 1","Element 2","Discipline","Level","Status","Assigned To","Notes"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700,
                      color: "white", textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClashes.map(c => (
                  <Fragment key={c.id}>
                    <tr style={{ borderBottom: "1px solid #F3F4F6",
                      background: c.status === "resolved" ? "#F0FDF4" : "white" }}>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}><PBadge p={c.priority} /></td>
                      <td style={{ padding: "8px 10px", fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>{c.clashIdOriginal || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, maxWidth: 200 }}>{c.description || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11 }}>{c.element1 || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11 }}>{c.element2 || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11 }}>{c.discipline1 || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11, whiteSpace: "nowrap" }}>{c.level || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <select value={c.status}
                          onChange={e => updateClash(c.id, { status: e.target.value })}
                          style={{ border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 11,
                            padding: "2px 4px", fontWeight: 600,
                            background: c.status === "resolved" ? "#DCFCE7" : c.status === "in_progress" ? "#DBEAFE" : "#FEF3C7",
                            color: c.status === "resolved" ? "#16A34A" : c.status === "in_progress" ? "#1D4ED8" : "#D97706" }}>
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="wont_fix">Won't Fix</option>
                        </select>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <input value={c.assignedToName || ""}
                          onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, assignedToName: e.target.value } : x))}
                          onBlur={e => updateClash(c.id, { assignedToName: e.target.value })}
                          style={{ border: "1px solid #E5E7EB", borderRadius: 4, padding: "2px 6px",
                            fontSize: 11, width: 100 }} />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <button className="btn btn-sm btn-outline"
                          onClick={() => setExpandedNotes(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
                          {expandedNotes[c.id] ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>
                    {expandedNotes[c.id] && (
                      <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                        <td colSpan={10} style={{ padding: "8px 16px" }}>
                          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>
                            {c.priorityReason && <div style={{ marginBottom: 6, fontStyle: "italic" }}>AI: {c.priorityReason}</div>}
                            Resolution Notes:
                          </div>
                          <textarea value={c.resolutionNotes || ""}
                            onChange={e => setClashes(prev => prev.map(x => x.id === c.id ? { ...x, resolutionNotes: e.target.value } : x))}
                            onBlur={e => updateClash(c.id, { resolutionNotes: e.target.value })}
                            rows={2} style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6,
                              padding: "6px 8px", fontSize: 12, resize: "vertical" }} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {filteredClashes.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                {t("No clashes match your filters","Ningún choque coincide con los filtros")}
              </div>
            )}
          </div>
        )
      }
    </div>
  );

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Clash Reports","Reportes de Choques")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Upload clash register from Navisworks, Revit, or Excel — AI ranks every clash by priority","Sube el registro de choques — IA clasifica por prioridad")}
          </p>
        </div>
        {canWrite && (
          <label style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
            <div className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6,
              opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}>
              <Upload size={14} />
              {uploading ? t("Processing...","Procesando...") : t("Upload Clash Register","Subir Registro de Choques")}
            </div>
          </label>
        )}
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
          padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {uploadMsg && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8,
          padding: "10px 14px", color: "#1D4ED8", fontSize: 13, marginBottom: 14,
          display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {uploadMsg}
        </div>
      )}

      {loading
        ? <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>{t("Loading...","Cargando...")}</div>
        : reports.length === 0
          ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <Upload size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {t("No clash reports yet","Sin reportes de choques aún")}
              </div>
              <div style={{ fontSize: 13 }}>
                {t("Upload your clash register Excel file to get started","Sube tu archivo Excel de choques para comenzar")}
              </div>
            </div>
          )
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reports.map(r => (
                <div key={r.id} style={{ background: "white", border: "1px solid #E5E7EB",
                  borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{r.fileName}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                      {new Date(r.createdAt).toLocaleDateString()} · {r.totalClashes} {t("clashes","choques")}
                      {r.aiSummary && <span> · {r.aiSummary}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: r.status === "complete" ? "#DCFCE7" : "#FEF3C7",
                        color: r.status === "complete" ? "#16A34A" : "#D97706" }}>
                        {r.status === "complete" ? t("Complete","Completo") : t("Processing","Procesando")}
                      </span>
                      {r.p1Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEE2E2", color: "#DC2626" }}>P1: {r.p1Count}</span>}
                      {r.p2Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>P2: {r.p2Count}</span>}
                      {r.p3Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEF9C3", color: "#CA8A04" }}>P3: {r.p3Count}</span>}
                      {r.p4Count > 0 && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#F3F4F6", color: "#6B7280" }}>P4: {r.p4Count}</span>}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={() => loadClashes(r)}
                    style={{ marginLeft: 16 }}>
                    {t("View Clashes","Ver Choques")}
                  </button>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
