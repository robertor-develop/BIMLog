import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Download, FileText, Link2, Crosshair } from "lucide-react";
import { LinkedItemsPanel } from "@/components/LinkedItemsPanel";
import * as XLSX from "xlsx";

const API = "/api/v1";

interface LensViewpoint {
  id: number;
  viewpointId: string;
  displayId?: string | null;
  navisworksGuid?: string | null;
  note?: string | null;
  trade?: string | null;
  reportType?: string | null;
  priority?: number | null;
  floor?: string | null;
  openItems?: string | null;
  capturedAt?: string | null;
  status: string;
  syncedAt?: string | null;
}

const LENS_P_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "#FEE2E2", text: "#DC2626" },
  2: { bg: "#FFEDD5", text: "#EA580C" },
  3: { bg: "#FEF9C3", text: "#CA8A04" },
  4: { bg: "#F3F4F6", text: "#6B7280" },
  5: { bg: "#EDE9FE", text: "#7C3AED" },
};

function LensPBadge({ p }: { p?: number | null }) {
  const c = LENS_P_COLORS[p ?? 0] ?? { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text }}>
      {p ? `P${p}` : "—"}
    </span>
  );
}

const LENS_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "#FEE2E2", text: "#DC2626", label: "Open" },
  follow_up: { bg: "#FEF3C7", text: "#D97706", label: "Follow Up" },
  waiting_design: { bg: "#EDE9FE", text: "#7C3AED", label: "Waiting Design" },
  approved: { bg: "#D1FAE5", text: "#059669", label: "Approved" },
  resolved: { bg: "#DCFCE7", text: "#16A34A", label: "Resolved" },
};
const LENS_STATUS_ORDER = ["open", "follow_up", "waiting_design", "approved", "resolved"];

function lensStatusLabel(s: string) {
  return LENS_STATUS[s]?.label ?? s;
}

function fmtCaptured(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime()) || String(v).startsWith("1970")) return "—";
  return d.toLocaleDateString();
}

export function LensViewpointsView({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const headers = { Authorization: `Bearer ${token}` };
  const [, setLoc] = useLocation();

  const [viewpoints, setViewpoints] = useState<LensViewpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fTrade, setFTrade] = useState("all");
  const [fFloor, setFFloor] = useState("all");
  const [fReportType, setFReportType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [linksOpen, setLinksOpen] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadViewpoints = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-pull`, { headers });
      if (r.ok) {
        const d = await r.json();
        setViewpoints(d.viewpoints ?? []);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.message || d.error || "Failed to load viewpoints");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadViewpoints(); }, [projectId]);

  const updateStatus = async (id: number, status: string) => {
    const prev = viewpoints;
    setViewpoints(p => p.map(v => (v.id === id ? { ...v, status } : v)));
    const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) setViewpoints(prev);
  };

  const createRfi = (v: LensViewpoint) => {
    const params = new URLSearchParams();
    if (v.note) params.set("note", v.note);
    if (v.trade) params.set("trade", v.trade);
    if (v.floor) params.set("floor", v.floor);
    if (v.displayId) params.set("ref", v.displayId);
    setLoc(`/projects/${projectId}/rfis?${params.toString()}`);
  };

  const jumpToViewpoint = async (v: LensViewpoint) => {
    const id = v.displayId || v.viewpointId;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      /* clipboard unavailable — tooltip still shows the ID to search for */
    }
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(c => (c === v.id ? null : c)), 2500);
  };

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((x): x is string => !!x))).sort();
  const trades = uniq(viewpoints.map(v => v.trade));
  const floors = uniq(viewpoints.map(v => v.floor));
  const reportTypes = uniq(viewpoints.map(v => v.reportType));
  const statuses = uniq(viewpoints.map(v => v.status));

  const filtered = viewpoints
    .filter(v => fTrade === "all" || v.trade === fTrade)
    .filter(v => fFloor === "all" || v.floor === fFloor)
    .filter(v => fReportType === "all" || v.reportType === fReportType)
    .filter(v => fStatus === "all" || v.status === fStatus);

  const lastSynced = viewpoints.reduce<string | null>((max, v) => {
    if (!v.capturedAt) return max;
    if (!max || new Date(v.capturedAt) > new Date(max)) return v.capturedAt;
    return max;
  }, null);

  const exportExcel = () => {
    const header = ["Date", "FileName", "Floor", "Trade", "ReportType", "Priority", "Note", "OpenItems", "Status"];
    const data = viewpoints.map(v => [
      fmtCaptured(v.capturedAt),
      v.viewpointId,
      v.floor || "",
      v.trade || "",
      v.reportType || "",
      v.priority ? `P${v.priority}` : "",
      v.note || "",
      v.openItems || "",
      lensStatusLabel(v.status),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ["BIMLog by IgniteSmart — Lens Viewpoints"],
      [`Exported: ${new Date().toLocaleDateString()}`],
      [],
      header,
      ...data,
    ]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
    ws["!cols"] = header.map((_, i) => ({ wch: i === 6 ? 40 : i === 1 ? 24 : 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lens Viewpoints");
    XLSX.writeFile(wb, `Lens-Viewpoints-${projectId}.xlsx`);
  };

  const selStyle = { border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 13 } as const;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Lens Viewpoints", "Vistas Lens")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Last synced", "Última sincronización")}: {fmtCaptured(lastSynced)}
          </p>
        </div>
        <button className="btn btn-sm btn-outline" onClick={exportExcel}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={14} /> {t("Export", "Exportar")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={fTrade} onChange={e => setFTrade(e.target.value)} style={selStyle}>
          <option value="all">{t("All Trades", "Todas las Disciplinas")}</option>
          {trades.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={fFloor} onChange={e => setFFloor(e.target.value)} style={selStyle}>
          <option value="all">{t("All Floors", "Todos los Pisos")}</option>
          {floors.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={fReportType} onChange={e => setFReportType(e.target.value)} style={selStyle}>
          <option value="all">{t("All Report Types", "Todos los Tipos")}</option>
          {reportTypes.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={selStyle}>
          <option value="all">{t("All Statuses", "Todos los Estados")}</option>
          {statuses.map(x => <option key={x} value={x}>{lensStatusLabel(x)}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>{t("Loading...", "Cargando...")}</div>
      ) : viewpoints.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <FileText size={40} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, maxWidth: 460, margin: "0 auto" }}>
            {t(
              "No Lens Viewpoints synced yet. Use BIMLog Lens plugin in Navisworks to capture and sync viewpoints.",
              "Aún no hay Vistas Lens sincronizadas. Usa el plugin BIMLog Lens en Navisworks para capturar y sincronizar vistas."
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1E3A5F" }}>
                {["ID", "Priority", "Trade", "Report Type", "Floor", "Note", "Status", "Captured", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "white", textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <Fragment key={v.id}>
                  <tr style={{ borderTop: "1px solid #F3F4F6", verticalAlign: "top" }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {v.displayId ? (
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#DBEAFE", color: "#1D4ED8" }}>
                          {v.displayId}
                        </span>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}><LensPBadge p={v.priority} /></td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{v.trade || "—"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{v.reportType || "—"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{v.floor || "—"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, minWidth: 240, maxWidth: 420 }}>
                      <div style={{ color: "#111827" }}>{v.note || "—"}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{v.viewpointId}</div>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <select
                        value={LENS_STATUS[v.status] ? v.status : "open"}
                        onChange={e => updateStatus(v.id, e.target.value)}
                        disabled={!canWrite}
                        style={{
                          border: "1px solid #D1D5DB", borderRadius: 20, fontSize: 11, padding: "2px 8px", fontWeight: 700,
                          cursor: canWrite ? "pointer" : "default",
                          background: (LENS_STATUS[v.status] ?? LENS_STATUS.open).bg,
                          color: (LENS_STATUS[v.status] ?? LENS_STATUS.open).text,
                        }}
                      >
                        {LENS_STATUS_ORDER.map(s => <option key={s} value={s}>{LENS_STATUS[s].label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{fmtCaptured(v.capturedAt)}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div style={{ position: "relative" }}>
                          <button className="btn btn-sm btn-outline" onClick={() => jumpToViewpoint(v)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                            <Crosshair size={12} /> {t("Jump to Viewpoint", "Ir a Vista")}
                          </button>
                          {copiedId === v.id && (
                            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10, background: "#111827", color: "white", fontSize: 11, padding: "6px 10px", borderRadius: 6, whiteSpace: "normal", width: 220, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                              {t("Copied! Search for this ID in Navisworks Saved Viewpoints", "¡Copiado! Busca este ID en las Vistas Guardadas de Navisworks")}
                            </div>
                          )}
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={() => createRfi(v)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <FileText size={12} /> {t("Create RFI", "Crear RFI")}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setLinksOpen(p => ({ ...p, [v.id]: !p[v.id] }))} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <Link2 size={12} /> {t("Linked Items", "Vinculados")}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {linksOpen[v.id] && (
                    <tr style={{ background: "#FAFAFA", borderTop: "1px solid #F3F4F6" }}>
                      <td colSpan={9} style={{ padding: "4px 16px 14px" }}>
                        <LinkedItemsPanel projectId={projectId} entityType="lens_viewpoint" entityId={v.id} canWrite={canWrite} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
              {t("No viewpoints match your filters", "Ninguna vista coincide con los filtros")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
