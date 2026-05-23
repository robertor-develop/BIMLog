import { useState, useEffect, Fragment } from "react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Upload, ChevronLeft, Download, Plus } from "lucide-react";

const API = "/api/v1";

interface SubmittalReport {
  id: number; fileName: string; format: string; totalItems: number;
  status: string; aiSummary?: string; createdAt: string; reportNumber?: string;
}

interface SubmittalItem {
  id: number; reportId: number; projectId: number;
  trade?: string; submittalType?: string; floor?: string;
  fileName?: string; revision?: string; version?: string;
  submittalStatus?: string; date?: string; description?: string;
  openItems?: string; rfiOpen?: string; rfiClose?: string;
  rfiDescription?: string; pdfUrl?: string; notes?: string; status?: string;
}

const CELL = { border: "1px solid #E5E7EB", padding: "4px 6px", fontSize: 11, verticalAlign: "middle" as const };
const TH = { ...CELL, background: "#1E3A5F", color: "white", fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const };

export function SubmittalTrackerTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const headers = { Authorization: `Bearer ${token}` };

  const [reports, setReports] = useState<SubmittalReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error, setError] = useState("");
  const [selectedReport, setSelectedReport] = useState<SubmittalReport | null>(null);
  const [items, setItems] = useState<SubmittalItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [filterTrade, setFilterTrade] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const loadReports = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/submittal-reports`, { headers });
      if (r.ok) setReports(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { loadReports(); }, [projectId]);

  const loadItems = async (report: SubmittalReport) => {
    setSelectedReport(report);
    setItemsLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/submittal-reports/${report.id}`, { headers });
      if (r.ok) { const data = await r.json(); setItems(data.items ?? []); }
    } finally { setItemsLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx","xls","csv"].includes(ext ?? "")) { setError("Use Excel (.xlsx, .xls) or CSV"); return; }
    setUploading(true); setError(""); setUploadMsg("Uploading and mapping columns with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch(`${API}/projects/${projectId}/submittal-reports/upload`, { method: "POST", headers, body: formData });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Upload failed"); return; }
      const data = await r.json();
      setUploadMsg(`${data.total_parsed} items imported successfully.`);
      await loadReports();
      setTimeout(() => setUploadMsg(""), 5000);
    } finally { setUploading(false); e.target.value = ""; }
  };

  const updateItem = async (itemId: number, updates: Partial<SubmittalItem>) => {
    if (!selectedReport) return;
    await fetch(`${API}/projects/${projectId}/submittal-reports/${selectedReport.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setItems(prev => prev.map(x => x.id === itemId ? { ...x, ...updates } : x));
  };

  const addItem = async () => {
    if (!selectedReport) return;
    const r = await fetch(`${API}/projects/${projectId}/submittal-reports/${selectedReport.id}/items`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (r.ok) loadItems(selectedReport);
  };

  const deleteReport = async (reportId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    const r = await fetch(`${API}/projects/${projectId}/submittal-reports/${reportId}`, { method: "DELETE", headers });
    if (r.ok) { setSelectedReport(null); loadReports(); }
  };

  const trades = ["all", ...Array.from(new Set(items.map(i => i.trade).filter(Boolean)))] as string[];
  const types = ["all", ...Array.from(new Set(items.map(i => i.submittalType).filter(Boolean)))] as string[];

  const filteredItems = items
    .filter(i => filterTrade === "all" || i.trade === filterTrade)
    .filter(i => filterType === "all" || i.submittalType === filterType)
    .filter(i => !search || [i.fileName, i.description, i.trade, i.floor].some(f => f?.toLowerCase().includes(search.toLowerCase())));

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    "approved": { bg: "#DCFCE7", text: "#16A34A" },
    "approved as noted": { bg: "#FEF3C7", text: "#D97706" },
    "rejected": { bg: "#FEE2E2", text: "#DC2626" },
    "for record": { bg: "#DBEAFE", text: "#1D4ED8" },
    "sent": { bg: "#F3E8FF", text: "#7C3AED" },
    "pending": { bg: "#F3F4F6", text: "#6B7280" },
  };

  const getStatusStyle = (status?: string) => {
    if (!status) return { bg: "#F3F4F6", text: "#6B7280" };
    const key = status.toLowerCase();
    return STATUS_COLORS[key] ?? { bg: "#F3F4F6", text: "#6B7280" };
  };

  if (selectedReport) return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={() => { setSelectedReport(null); setItems([]); }}
          style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={14} /> {t("Back", "Volver")}
        </button>
        <div style={{ flex: 1 }}>
          <input value={selectedReport.fileName}
            onChange={e => setSelectedReport(prev => prev ? { ...prev, fileName: e.target.value } : prev)}
            onBlur={async e => {
              await fetch(`${API}/projects/${projectId}/submittal-reports/${selectedReport.id}/rename`, {
                method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: e.target.value }),
              });
            }}
            style={{ fontWeight: 700, fontSize: 18, border: "none", borderBottom: "1px dashed #D1D5DB",
              background: "transparent", outline: "none", width: "100%" }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
            <input
              value={selectedReport.reportNumber || ""}
              onChange={e => setSelectedReport(prev => prev ? { ...prev, reportNumber: e.target.value } : prev)}
              onBlur={async e => {
                await fetch(`${API}/projects/${projectId}/submittal-reports/${selectedReport.id}/rename`, {
                  method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ reportNumber: e.target.value }),
                });
              }}
              placeholder="Report No. (e.g. ELA01-ST-001)"
              style={{ fontSize: 12, border: "none", borderBottom: "1px dashed #D1D5DB",
                background: "transparent", outline: "none", color: "#1D4ED8", fontWeight: 600, width: 200 }}
            />
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              {new Date(selectedReport.createdAt).toLocaleDateString()} · {selectedReport.totalItems} {t("items","ítems")}
            </span>
          </div>
        </div>
        <a href={`${API}/projects/${projectId}/submittal-reports/${selectedReport.id}/pdf?token=${token}`}
          target="_blank" rel="noreferrer" className="btn btn-primary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <Download size={13} /> Export PDF
        </a>
        <button className="btn btn-sm" onClick={() => deleteReport(selectedReport.id, selectedReport.fileName)}
          style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 12px", fontWeight: 600, cursor: "pointer" }}>
          Delete
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
          {trades.map(tr => <option key={tr} value={tr}>{tr === "all" ? "All Trades" : tr}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
          {types.map(tp => <option key={tp} value={tp}>{tp === "all" ? "All Types" : tp}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("Search...","Buscar...")}
          style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13, flex: 1, minWidth: 200 }} />
        {canWrite && (
          <button className="btn btn-sm btn-primary" onClick={addItem}
            style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={13} /> Add Row
          </button>
        )}
      </div>

      {itemsLoading
        ? <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>Loading...</div>
        : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  {[
                    { label: "Trade", w: 70 },
                    { label: "Type", w: 70 },
                    { label: "Floor", w: 80 },
                    { label: "File Name", w: 160 },
                    { label: "Revision", w: 70 },
                    { label: "Version", w: 70 },
                    { label: "Status", w: 120 },
                    { label: "Date", w: 90 },
                    { label: "Open Items", w: 120 },
                    { label: "RFI Open", w: 80 },
                    { label: "RFI Close", w: 80 },
                    { label: "Notes", w: 70 },
                  ].map(h => (
                    <th key={h.label} style={{ ...TH, width: h.w, minWidth: h.w }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <Fragment key={item.id}>
                    <tr style={{ borderBottom: "1px solid #F3F4F6", background: idx % 2 === 0 ? "white" : "#FAFAFA" }}>
                      <td style={CELL}>
                        <input value={item.trade || ""} placeholder="Trade"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, trade: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { trade: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent", fontWeight: 600 }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.submittalType || ""} placeholder="Type"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, submittalType: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { submittalType: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.floor || ""} placeholder="Floor"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, floor: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { floor: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.fileName || ""} placeholder="File name"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, fileName: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { fileName: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: !item.fileName ? "#FFFBEB" : "transparent", fontFamily: "monospace" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.revision || ""} placeholder="R-0"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, revision: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { revision: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent", textAlign: "center" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.version || ""} placeholder="V-0"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, version: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { version: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent", textAlign: "center" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.submittalStatus || ""} placeholder="Status"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, submittalStatus: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { submittalStatus: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, fontWeight: 600,
                            background: getStatusStyle(item.submittalStatus).bg,
                            color: getStatusStyle(item.submittalStatus).text }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.date || ""} placeholder="Date"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, date: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { date: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.openItems || ""} placeholder="Open items"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, openItems: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { openItems: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: item.openItems ? "#FEF3C7" : "transparent" }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.rfiOpen || ""} placeholder="RFI #"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, rfiOpen: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { rfiOpen: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent", color: item.rfiOpen && item.rfiOpen !== "NO" ? "#1D4ED8" : "inherit", fontWeight: item.rfiOpen && item.rfiOpen !== "NO" ? 700 : 400 }} />
                      </td>
                      <td style={CELL}>
                        <input value={item.rfiClose || ""} placeholder="RFI #"
                          onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, rfiClose: e.target.value } : x))}
                          onBlur={e => updateItem(item.id, { rfiClose: e.target.value })}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 11, background: "transparent" }} />
                      </td>
                      <td style={CELL}>
                        <button className="btn btn-sm btn-outline"
                          onClick={() => setExpandedRows(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                          {expandedRows[item.id] ? "Done" : "Edit"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows[item.id] && (
                      <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}>
                        <td colSpan={12} style={{ padding: "14px 16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Description</label>
                              <textarea value={item.description || ""} rows={2}
                                onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, description: e.target.value } : x))}
                                onBlur={e => updateItem(item.id, { description: e.target.value })}
                                style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "vertical" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>RFI Description</label>
                              <textarea value={item.rfiDescription || ""} rows={2}
                                onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, rfiDescription: e.target.value } : x))}
                                onBlur={e => updateItem(item.id, { rfiDescription: e.target.value })}
                                style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "vertical" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>PDF / SharePoint URL</label>
                              <div style={{ display: "flex", gap: 6 }}>
                                <input value={item.pdfUrl || ""} placeholder="https://..."
                                  onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, pdfUrl: e.target.value } : x))}
                                  onBlur={e => updateItem(item.id, { pdfUrl: e.target.value })}
                                  style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
                                {item.pdfUrl && (
                                  <a href={item.pdfUrl} target="_blank" rel="noreferrer"
                                    style={{ padding: "6px 10px", background: "#1D4ED8", color: "white", borderRadius: 6, fontSize: 12, textDecoration: "none" }}>
                                    Open
                                  </a>
                                )}
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Notes</label>
                              <textarea value={item.notes || ""} rows={2}
                                onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, notes: e.target.value } : x))}
                                onBlur={e => updateItem(item.id, { notes: e.target.value })}
                                style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "vertical" }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {item.pdfUrl && (
                              <a href={item.pdfUrl} target="_blank" rel="noreferrer"
                                style={{ fontSize: 12, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 4 }}>
                                View Document
                              </a>
                            )}
                            <button className="btn btn-sm"
                              onClick={async () => {
                                if (!confirm("Delete this row?")) return;
                                await fetch(`${API}/projects/${projectId}/submittal-reports/${selectedReport.id}/items/${item.id}`, { method: "DELETE", headers });
                                loadItems(selectedReport);
                              }}
                              style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                              Delete Row
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                {t("No items match your filters","Ningún ítem coincide")}
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
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Submittal Tracker", "Registro de Submittals")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Upload any submittal log — AI maps columns automatically", "Sube cualquier registro — IA mapea columnas automáticamente")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canWrite && (
            <button className="btn btn-sm btn-outline"
              onClick={async () => {
                const r = await fetch(`${API}/projects/${projectId}/submittal-reports`, {
                  method: "POST", headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ fileName: "New Submittal Tracker" }),
                });
                if (r.ok) { const report = await r.json(); setSelectedReport(report); setItems([]); }
              }}>
              + New Tracker
            </button>
          )}
          {canWrite && (
            <label style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
              <div className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}>
                <Upload size={13} /> {uploading ? t("Processing...","Procesando...") : t("Upload Submittal Log","Subir Registro")}
              </div>
            </label>
          )}
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {uploadMsg && <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", color: "#1D4ED8", fontSize: 13, marginBottom: 14 }}>{uploadMsg}</div>}

      {loading
        ? <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>Loading...</div>
        : reports.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <Upload size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("No submittal trackers yet","Sin registros aún")}</div>
              <div style={{ fontSize: 13 }}>{t("Upload a submittal log Excel or create a new tracker","Sube un Excel o crea un nuevo registro")}</div>
            </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reports.map(r => (
                <div key={r.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <input value={r.fileName}
                      onChange={e => setReports(prev => prev.map(x => x.id === r.id ? { ...x, fileName: e.target.value } : x))}
                      onBlur={async e => {
                        await fetch(`${API}/projects/${projectId}/submittal-reports/${r.id}/rename`, {
                          method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
                          body: JSON.stringify({ fileName: e.target.value }),
                        });
                      }}
                      style={{ fontWeight: 700, fontSize: 14, border: "none", borderBottom: "1px dashed #D1D5DB", background: "transparent", outline: "none", width: "100%" }} />
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                      {r.reportNumber && <span style={{ color: "#1D4ED8", fontWeight: 700, marginRight: 8 }}>{r.reportNumber}</span>}
                      {new Date(r.createdAt).toLocaleDateString()} · {r.totalItems} {t("items","ítems")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                    <button className="btn btn-sm btn-outline" onClick={() => loadItems(r)}>View Items</button>
                    <button onClick={() => deleteReport(r.id, r.fileName)}
                      style={{ fontSize: 12, padding: "4px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  );
}
