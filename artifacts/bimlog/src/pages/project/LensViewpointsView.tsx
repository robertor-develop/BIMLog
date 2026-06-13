import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Download, FileText, Link2, Crosshair, X, Copy, CheckCircle2, Trash2 } from "lucide-react";
import { LinkedItemsPanel } from "@/components/LinkedItemsPanel";
import * as XLSX from "xlsx";

const API = "/api/v1";
const PLUGIN_BASE = "http://localhost:8765";

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
  const [jumpTarget, setJumpTarget] = useState<LensViewpoint | null>(null);
  // null = still checking, true = plugin reachable, false = not reachable.
  const [pluginConnected, setPluginConnected] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  // Probe the local Navisworks plugin once on load. The platform runs on HTTPS
  // while the plugin is a plain HTTP server on localhost, so a regular (CORS)
  // fetch is rejected by the browser before we can read it (the plugin does not
  // emit CORS / Private Network Access headers). Use no-cors: the request still
  // reaches the plugin and an opaque response means it is reachable; an abort or
  // network error (connection refused / timeout) means not connected.
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1000);
    (async () => {
      try {
        await fetch(`${PLUGIN_BASE}/ping`, { mode: "no-cors", signal: ctrl.signal });
        if (!cancelled) setPluginConnected(true);
      } catch {
        if (!cancelled) setPluginConnected(false);
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); ctrl.abort(); };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(c => (c === msg ? null : c)), 2800);
  };

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

  const deleteViewpoint = async (id: number) => {
    if (!window.confirm(t("Delete this viewpoint? This cannot be undone.", "¿Eliminar esta vista? Esto no se puede deshacer."))) return;
    const prev = viewpoints;
    setViewpoints(p => p.filter(v => v.id !== id));
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!r.ok) {
        setViewpoints(prev);
        const d = await r.json().catch(() => ({}));
        setError(d.message || d.error || "Failed to delete viewpoint");
      }
    } catch (e) {
      setViewpoints(prev);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createRfi = (v: LensViewpoint) => {
    const params = new URLSearchParams();
    if (v.note) params.set("note", v.note);
    if (v.trade) params.set("trade", v.trade);
    if (v.floor) params.set("floor", v.floor);
    if (v.displayId) params.set("ref", v.displayId);
    setLoc(`/projects/${projectId}/rfis?${params.toString()}`);
  };

  // Try to drive Navisworks directly via the local plugin; if it does not
  // respond (not running / times out), fall back to the manual-search modal.
  // The platform is HTTPS and the plugin is a plain HTTP server on localhost
  // without CORS / Private Network Access headers, so a regular (CORS) fetch is
  // rejected by the browser before the request is even acted on. Use no-cors:
  // the GET still reaches the plugin and drives Navisworks; the opaque response
  // cannot be read, so a fetch that resolves means the plugin received it (jump
  // succeeded) and a thrown error means the plugin is not reachable.
  //
  // Viewpoints are matched by their display code (e.g. "1185RI-37D77A"), not the
  // Navisworks GUID: the plugin sends an all-zeros placeholder GUID for saved
  // viewpoints (normalized to null on sync), so a GUID jump can never resolve.
  // The display code is the stable unique key that prefixes every saved
  // viewpoint's name in Navisworks. The plugin's /jump handler must locate the
  // saved viewpoint whose name contains this code and apply it.
  const jumpToViewpoint = async (v: LensViewpoint) => {
    const code = v.displayId || v.viewpointId;
    if (code) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      try {
        await fetch(`${PLUGIN_BASE}/jump?code=${encodeURIComponent(code)}`, { mode: "no-cors", signal: ctrl.signal });
        clearTimeout(timer);
        setPluginConnected(true);
        showToast(t("Navigated to viewpoint in Navisworks", "Navegado a la vista en Navisworks"));
        return;
      } catch {
        clearTimeout(timer);
        setPluginConnected(false);
        /* plugin not running / timed out — fall through to the manual-search modal */
      }
    }
    setJumpTarget(v);
  };

  const copyJumpId = async (v: LensViewpoint) => {
    const id = v.displayId || v.viewpointId;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      /* clipboard unavailable — the ID is still shown in the modal to search for */
    }
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(c => (c === v.id ? null : c)), 2500);
  };

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((x): x is string => !!x))).sort();
  const trades = uniq(viewpoints.map(v => v.trade));
  const floors = uniq(viewpoints.map(v => v.floor));
  const reportTypes = uniq(viewpoints.map(v => v.reportType));

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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#6B7280" }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: pluginConnected === null ? "#D1D5DB" : pluginConnected ? "#16A34A" : "#9CA3AF",
            }} />
            {pluginConnected === null
              ? t("Checking plugin...", "Comprobando plugin...")
              : pluginConnected
                ? t("Plugin connected", "Plugin conectado")
                : t("Plugin not connected", "Plugin no conectado")}
          </div>
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
          {LENS_STATUS_ORDER.map(x => <option key={x} value={x}>{lensStatusLabel(x)}</option>)}
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
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto", overflowY: "scroll", maxHeight: "70vh" }}>
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
                        <button className="btn btn-sm btn-outline" onClick={() => jumpToViewpoint(v)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <Crosshair size={12} /> {t("Jump to Viewpoint", "Ir a Vista")}
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={() => createRfi(v)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <FileText size={12} /> {t("Create RFI", "Crear RFI")}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setLinksOpen(p => ({ ...p, [v.id]: !p[v.id] }))} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <Link2 size={12} /> {t("Linked Items", "Vinculados")}
                        </button>
                        {canWrite && (
                          <button className="btn btn-sm btn-outline" onClick={() => deleteViewpoint(v.id)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, color: "#DC2626", borderColor: "#FECACA" }}>
                            <Trash2 size={12} /> {t("Delete", "Eliminar")}
                          </button>
                        )}
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

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1100, display: "flex", alignItems: "center", gap: 8, background: "#16A34A", color: "white", fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {jumpTarget && (
        <div
          onClick={() => setJumpTarget(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 460, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", padding: 24 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                {t("Jump to Viewpoint in Navisworks", "Ir a la Vista en Navisworks")}
              </h3>
              <button
                onClick={() => setJumpTarget(null)}
                aria-label={t("Close", "Cerrar")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6B7280", lineHeight: 0, padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: "12px 0 14px", fontSize: 13, color: "#4B5563" }}>
              {t(
                "Open your Saved Viewpoints panel in Navisworks and search for:",
                "Abre el panel de Vistas Guardadas en Navisworks y busca:"
              )}
            </p>
            <div style={{ background: "#DBEAFE", border: "1px solid #BFDBFE", borderRadius: 10, padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1D4ED8", letterSpacing: 0.5, wordBreak: "break-all" }}>
                {jumpTarget.displayId || jumpTarget.viewpointId}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6, wordBreak: "break-all" }}>
                {jumpTarget.viewpointId}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setJumpTarget(null)}
                style={{ fontSize: 13, padding: "6px 14px" }}
              >
                {t("Close", "Cerrar")}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => copyJumpId(jumpTarget)}
                style={{ fontSize: 13, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Copy size={14} />
                {copiedId === jumpTarget.id ? t("Copied!", "¡Copiado!") : t("Copy", "Copiar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
