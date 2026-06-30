import { useState, useEffect, useRef, Fragment } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Download, FileText, Link2, Crosshair, X, Copy, CheckCircle2, Trash2, RefreshCw, FileDown, History, Pencil, ArrowLeftRight, Ban, Layers } from "lucide-react";
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
  tradeFloorSeq?: number | null;
  tradeFloorSeqCorrection?: number | null;
  issueGroupId?: string | null;
  lifecycleStatus?: string | null;
  supersedesId?: number | null;
  supersedesCode?: string | null;
  revisionNumber?: number | null;
}

// Platform display code matches the plugin's short code exactly: "{2-letter trade}-{seq:000}"
// e.g. "FI-001". Floor and revision have their own columns, so they are not crammed into this
// code. Falls back to the legacy display_id when no seq exists.
function viewpointCode(v: LensViewpoint): string {
  if (v.tradeFloorSeq == null) return v.displayId || v.viewpointId || "—";
  const t = v.trade || "";
  const abbr = ((t.length > 2 ? t.slice(0, 2) : t).toUpperCase()) || "??";
  return `${abbr}-${String(v.tradeFloorSeq).padStart(3, "0")}`;
}

// Short group token matching the plugin's GroupToken (first 4 hex chars of the group id),
// so the same group reads identically on the plugin name and this column.
function groupToken(id?: string | null): string {
  if (!id) return "";
  const clean = id.replace(/-/g, "");
  return (clean.length >= 4 ? clean.slice(0, 4) : clean).toUpperCase();
}

// Plain-language tooltips so the column headers explain themselves on hover.
const HEADER_TIPS: Record<string, string> = {
  "ID": "Viewpoint identifier. Toggle the format in the View bar (Display ID or Trade-Floor-Seq).",
  "Group": "Viewpoints sharing one physical location/issue across trades. Same token = same group.",
  "Lifecycle": "Position in the revision chain: Active (current), Superseded (replaced by an edit/reassign), or Voided (cancelled).",
  "Rev": "Revision number — increments each time the viewpoint is edited or reassigned.",
  "Status": "Workflow status: Open, Follow Up, Waiting Design, Approved, Resolved.",
};

const LIFECYCLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#D1FAE5", text: "#059669", label: "Active" },
  superseded: { bg: "#FEF3C7", text: "#92400E", label: "Superseded" },
  voided: { bg: "#F3F4F6", text: "#6B7280", label: "Voided" },
};

interface LensReport {
  id: number;
  reportNumber: string;
  generatedByName?: string | null;
  generatedAt?: string | null;
  reportDate?: string | null;
  viewpointCount?: number | null;
  healthScore?: number | null;
  watermarkType?: string | null;
  isExecutiveOnePager?: boolean | null;
  contentHash?: string | null;
}

const WATERMARK_LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued for Coordination",
  superseded: "Superseded",
};

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
  // Drives the refresh banner. Only true when a background poll detects the
  // server's viewpoint set differs from what is currently displayed — never shown
  // speculatively. Reset to false whenever we (re)load the displayed list.
  const [updatesAvailable, setUpdatesAvailable] = useState(false);
  const [fTrade, setFTrade] = useState("all");
  const [fFloor, setFFloor] = useState("all");
  const [fReportType, setFReportType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  // Per-user, per-project view options: which lifecycle/chain columns are shown,
  // how the ID renders, and which lifecycle states are listed. Persisted to
  // localStorage so the chosen view sticks between visits.
  const VIEW_OPTS_KEY = `bimlog.lensViewOpts.${projectId}`;
  const VIEW_OPTS_DEFAULTS = { showGroupCol: true, showLifecycleCol: true, showRevisionCol: true, idFormatView: "displayId", lifecycleScope: "active" };
  const [viewOpts, setViewOpts] = useState<{ showGroupCol: boolean; showLifecycleCol: boolean; showRevisionCol: boolean; idFormatView: string; lifecycleScope: string }>(() => {
    try {
      const raw = localStorage.getItem(VIEW_OPTS_KEY);
      if (raw) return { ...VIEW_OPTS_DEFAULTS, ...JSON.parse(raw) };
    } catch { /* malformed/blocked storage — fall back to defaults */ }
    return VIEW_OPTS_DEFAULTS;
  });
  useEffect(() => {
    try { localStorage.setItem(VIEW_OPTS_KEY, JSON.stringify(viewOpts)); } catch { /* storage blocked — view simply won't persist */ }
  }, [VIEW_OPTS_KEY, viewOpts]);
  const { showGroupCol, showLifecycleCol, showRevisionCol, idFormatView, lifecycleScope } = viewOpts;
  const [linksOpen, setLinksOpen] = useState<Record<number, boolean>>({});
  const [groupOpen, setGroupOpen] = useState<Record<number, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<number, boolean>>({});
  const [historyData, setHistoryData] = useState<Record<number, { chain: any[]; events: any[] } | "loading" | "error">>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [jumpTarget, setJumpTarget] = useState<LensViewpoint | null>(null);
  const [actionModal, setActionModal] = useState<
    | { type: "edit"; v: LensViewpoint; note: string; reason: string }
    | { type: "reassign"; v: LensViewpoint; trade: string; reason: string }
    | { type: "void"; v: LensViewpoint; reason: string }
    | null
  >(null);
  const [actionPhase, setActionPhase] = useState<"input" | "submitting">("input");
  const [actionError, setActionError] = useState("");
  // null = still checking, true = plugin reachable, false = not reachable.
  const [pluginConnected, setPluginConnected] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [history, setHistory] = useState<LensReport[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [members, setMembers] = useState<{ userFullName: string; userCompanyName: string }[]>([]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    companyName: "",
    logoDataUrl: "",
    preparedByName: "",
    preparedByTitle: "",
    reportDate: todayIso,
    submittedTo: "",
    watermarkType: "draft",
    showHealthScore: true,
    isExecutiveOnePager: false,
    fPriority: "all",
    fStatus: "all",
    fFloor: "all",
    fTrade: "all",
    fReportType: "all",
    idFormat: "code",
    includeNonActive: false,
    includeResolved: true,
    showGroupIds: true,
    includeRevisionHistory: true,
  });

  // Pre-populate the report modal from the authenticated user's profile and load
  // the project directory for the "Submitted To" dropdown. Only fills fields the
  // user has not already typed into, so manual edits are never clobbered.
  const openReportModal = async () => {
    // Seed the export from the live on-screen view so the PDF defaults to exactly
    // what the user is currently looking at (row filters + ID format + lifecycle
    // scope). The PDF keeps its fixed register columns by design.
    setForm(f => ({ ...f, fTrade, fStatus, fFloor, fReportType, idFormat: idFormatView, includeNonActive: lifecycleScope !== "active" }));
    setReportModalOpen(true);
    try {
      const [meRes, memRes] = await Promise.all([
        fetch(`${API}/auth/me`, { headers }),
        fetch(`${API}/projects/${projectId}/members`, { headers }),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        const companyLogo: string = me?.company?.companyLogoUrl || "";
        setForm(f => ({
          ...f,
          companyName: f.companyName || me?.companyName || "",
          preparedByName: f.preparedByName || me?.fullName || "",
          preparedByTitle: f.preparedByTitle || me?.jobTitle || "",
          logoDataUrl: f.logoDataUrl || (companyLogo.startsWith("data:image") ? companyLogo : ""),
        }));
      }
      if (memRes.ok) {
        const list = await memRes.json();
        if (Array.isArray(list)) setMembers(list);
      }
    } catch {
      /* prefill is best-effort — the user can still type everything manually */
    }
  };

  const loadViewpoints = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-pull`, { headers });
      if (r.ok) {
        const d = await r.json();
        setViewpoints(d.viewpoints ?? []);
        setUpdatesAvailable(false);
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

  // Silently refetch the viewpoint list (no loading spinner) so the table can
  // be refreshed on demand (manual refresh banner) without a loading flicker.
  const refreshViewpoints = async () => {
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-pull`, { headers });
      if (r.ok) {
        const d = await r.json();
        setViewpoints(d.viewpoints ?? []);
        setUpdatesAvailable(false);
      }
    } catch {
      /* transient network error — keep the current list, the user can retry */
    }
  };

  // Mirror the currently displayed viewpoint ids so the background poll can compare
  // server state against them without re-running on every render.
  const viewpointIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => { viewpointIdsRef.current = new Set(viewpoints.map(v => v.id)); }, [viewpoints]);

  // Honest signal for the refresh banner: poll lens-pull in the background and flag
  // updates only when the server's id set actually differs from what is displayed
  // (new viewpoints, new revision rows, or removals). No difference => no banner.
  useEffect(() => {
    let cancelled = false;
    const checkForUpdates = async () => {
      try {
        const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-pull`, { headers });
        if (!r.ok) return;
        const d = await r.json();
        const serverIds: number[] = (d.viewpoints ?? []).map((v: LensViewpoint) => v.id);
        const local = viewpointIdsRef.current;
        const changed = serverIds.length !== local.size || serverIds.some(id => !local.has(id));
        if (!cancelled && changed) setUpdatesAvailable(true);
      } catch {
        /* transient — try again on the next tick */
      }
    };
    const iv = setInterval(checkForUpdates, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  const deleteReport = async (id: number) => {
    if (!window.confirm(t("Delete this report record? This cannot be undone.", "¿Eliminar este reporte del historial? Esto no se puede deshacer."))) return;
    const prev = history;
    setHistory(p => p.filter(rp => rp.id !== id));
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/reports/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!r.ok) {
        setHistory(prev);
        const d = await r.json().catch(() => ({}));
        setError(d.message || d.error || "Failed to delete report");
      }
    } catch (e) {
      setHistory(prev);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const resetTestData = async () => {
    const c = window.prompt(t(
      "DANGER - permanently delete ALL Lens viewpoints, sequence counters, report history and revision history for THIS project (testing reset). Type RESET to confirm.",
      "PELIGRO - eliminar permanentemente TODAS las vistas Lens, contadores, historial de reportes e historial de revisiones de ESTE proyecto (reinicio de prueba). Escriba RESET para confirmar."
    ));
    if (c !== "RESET") return;
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/reset-test-data`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || d.error || "Reset failed"); return; }
      setViewpoints([]);
      setHistory([]);
      await loadViewpoints();
      await loadHistory();
      const msg = t("Lens test data reset", "Datos de prueba Lens reiniciados");
      setToast(msg);
      setTimeout(() => setToast(cur => (cur === msg ? null : cur)), 2800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Edit/Reassign/Void open a real modal (no native prompt/confirm). The modal
  // collects input, then submitAction drives a visible submitting -> success/error
  // state so a click never silently no-ops the way window.prompt could.
  const editViewpoint = (v: LensViewpoint) => {
    setActionError("");
    setActionPhase("input");
    setActionModal({ type: "edit", v, note: v.note || "", reason: "" });
  };

  const reassignViewpoint = (v: LensViewpoint) => {
    const list = trades.filter(x => x !== v.trade);
    if (list.length === 0) { setError(t("No other trade available to reassign to.", "No hay otra disciplina disponible para reasignar.")); return; }
    setActionError("");
    setActionPhase("input");
    setActionModal({ type: "reassign", v, trade: list[0], reason: "" });
  };

  const voidViewpoint = (v: LensViewpoint) => {
    setActionError("");
    setActionPhase("input");
    setActionModal({ type: "void", v, reason: "" });
  };

  // Single submit path for Edit/Reassign/Void: always shows a submitting state,
  // then either a success toast + reload or an inline error inside the modal.
  // No native dialogs and no silent success — every click ends in a visible result.
  const submitAction = async () => {
    if (!actionModal) return;
    const m = actionModal;
    if (m.type === "edit" && m.note.trim() === "") { setActionError(t("A note is required.", "La nota es requerida.")); return; }
    if (m.type === "reassign" && !trades.includes(m.trade)) { setActionError(t("Select a valid trade.", "Seleccione una disciplina válida.")); return; }
    setActionError("");
    setActionPhase("submitting");
    try {
      const base = `${API}/projects/${projectId}/clash-reports/lens-viewpoints/${m.v.id}`;
      const call =
        m.type === "edit" ? { url: `${base}/edit`, method: "PATCH", body: { note: m.note, reason: m.reason } as Record<string, unknown> }
        : m.type === "reassign" ? { url: `${base}/reassign`, method: "POST", body: { trade: m.trade, reason: m.reason } as Record<string, unknown> }
        : { url: `${base}/void`, method: "POST", body: { reason: m.reason } as Record<string, unknown> };
      const r = await fetch(call.url, {
        method: call.method,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(call.body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setActionPhase("input");
        setActionError(d.message || d.error || t("The action failed. Please try again.", "La acción falló. Inténtelo de nuevo."));
        return;
      }
      setActionModal(null);
      setActionPhase("input");
      showToast(
        m.type === "edit" ? t("Viewpoint updated", "Vista actualizada")
        : m.type === "reassign" ? t("Viewpoint reassigned", "Vista reasignada")
        : t("Viewpoint voided", "Vista anulada")
      );
      await loadViewpoints();
    } catch (e) {
      setActionPhase("input");
      setActionError(e instanceof Error ? e.message : String(e));
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

  // Lazily fetch the revision chain + activity events the first time a row's
  // history panel is opened; cached thereafter for the life of the view.
  const toggleHistory = async (id: number) => {
    const willOpen = !historyOpen[id];
    setHistoryOpen(p => ({ ...p, [id]: willOpen }));
    if (willOpen && !historyData[id]) {
      setHistoryData(p => ({ ...p, [id]: "loading" }));
      try {
        const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/${id}/history`, { headers });
        if (r.ok) {
          const d = await r.json();
          setHistoryData(p => ({ ...p, [id]: { chain: d.chain ?? [], events: d.events ?? [] } }));
        } else {
          setHistoryData(p => ({ ...p, [id]: "error" }));
        }
      } catch {
        setHistoryData(p => ({ ...p, [id]: "error" }));
      }
    }
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
    .filter(v => fStatus === "all" || v.status === fStatus)
    .filter(v => lifecycleScope === "all" || (v.lifecycleStatus ?? "active") === "active");

  // Summary counts respect the trade/floor/report-type filters but ignore the lifecycle
  // scope so the strip can show the full Active/Superseded/Voided breakdown at once.
  const statsBase = viewpoints
    .filter(v => fTrade === "all" || v.trade === fTrade)
    .filter(v => fFloor === "all" || v.floor === fFloor)
    .filter(v => fReportType === "all" || v.reportType === fReportType);
  const lc = (s: string) => statsBase.filter(v => (v.lifecycleStatus ?? "active") === s).length;
  const activeStats = statsBase.filter(v => (v.lifecycleStatus ?? "active") === "active");
  const st = (s: string) => activeStats.filter(v => v.status === s).length;

  // Column count for the full-width expansion rows — keep in lockstep with the
  // dynamic columns rendered in the table header/body below (9 base + toggles).
  const colCount = 9 + (showGroupCol ? 1 : 0) + (showLifecycleCol ? 1 : 0) + (showRevisionCol ? 1 : 0);

  const lastSynced = viewpoints.reduce<string | null>((max, v) => {
    if (!v.capturedAt) return max;
    if (!max || new Date(v.capturedAt) > new Date(max)) return v.capturedAt;
    return max;
  }, null);

  const exportExcel = () => {
    // Mirror the live on-screen view: `filtered` already applies the trade/floor/
    // report-type/status filters AND the lifecycle scope, so the export reflects
    // exactly what the user is looking at rather than dumping every row.
    const header = ["Date", "Code", "FileName", "Floor", "Trade", "ReportType", "Priority", "Lifecycle", "Rev", "Note", "OpenItems", "Status"];
    const data = filtered.map(v => [
      fmtCaptured(v.capturedAt),
      viewpointCode(v),
      v.viewpointId,
      v.floor || "",
      v.trade || "",
      v.reportType || "",
      v.priority ? `P${v.priority}` : "",
      LIFECYCLE_BADGE[v.lifecycleStatus || "active"]?.label || v.lifecycleStatus || "Active",
      (v.revisionNumber ?? 1) > 1 ? `R${v.revisionNumber}` : "",
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
    ws["!cols"] = header.map((_, i) => ({ wch: i === 9 ? 40 : i === 2 ? 24 : 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lens Viewpoints");
    XLSX.writeFile(wb, `Lens-Viewpoints-${projectId}.xlsx`);
  };

  const loadHistory = async () => {
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/reports`, { headers });
      if (r.ok) {
        const d = await r.json();
        setHistory(d.reports ?? []);
      }
    } catch {
      /* transient — the history list simply stays as-is */
    }
  };
  useEffect(() => { loadHistory(); }, [projectId]);

  const onLogoFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const exportPdf = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/clash-reports/lens-viewpoints/report`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          logoDataUrl: form.logoDataUrl || undefined,
          preparedByName: form.preparedByName,
          preparedByTitle: form.preparedByTitle,
          reportDate: form.reportDate,
          submittedTo: form.submittedTo,
          watermarkType: form.watermarkType,
          showHealthScore: form.showHealthScore,
          isExecutiveOnePager: form.isExecutiveOnePager,
          idFormat: form.idFormat,
          includeNonActive: form.includeNonActive,
          includeResolved: form.includeResolved,
          showGroupIds: form.showGroupIds,
          includeRevisionHistory: form.includeRevisionHistory,
          filters: { priority: form.fPriority, status: form.fStatus, floor: form.fFloor, trade: form.fTrade, reportType: form.fReportType },
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        showToast(d.message || d.error || t("Failed to generate report", "No se pudo generar el reporte"));
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const fname = m ? m[1] : `Lens-Report-${projectId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setReportModalOpen(false);
      showToast(t("Report generated", "Reporte generado"));
      loadHistory();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-outline" onClick={exportExcel}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> {t("Export", "Exportar")}
          </button>
          <button className="btn btn-sm btn-primary" onClick={openReportModal} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileDown size={14} /> {t("Export PDF", "Exportar PDF")}
          </button>
          {canWrite && (
            <button
              className="btn btn-sm btn-outline"
              onClick={resetTestData}
              title={t("Testing only: clears Lens viewpoints, counters, reports, and revision history for this project", "Solo pruebas: borra vistas Lens, contadores, reportes e historial de revisiones de este proyecto")}
              style={{ display: "flex", alignItems: "center", gap: 6, color: "#B45309", borderColor: "#F59E0B" }}
            >
              <RefreshCw size={14} /> {t("Reset Test Data", "Reiniciar Pruebas")}
            </button>
          )}
        </div>
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

      <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap", alignItems: "center", background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>{t("View", "Vista")}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
          {t("Show", "Mostrar")}
          <select value={lifecycleScope} onChange={e => setViewOpts(o => ({ ...o, lifecycleScope: e.target.value }))} style={selStyle}>
            <option value="active">{t("Active only", "Solo activas")}</option>
            <option value="all">{t("All revisions", "Todas las revisiones")}</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
          {t("ID", "ID")}
          <select value={idFormatView} onChange={e => setViewOpts(o => ({ ...o, idFormatView: e.target.value }))} style={selStyle}>
            <option value="displayId">{t("Display ID", "ID de visualización")}</option>
            <option value="code">{t("Trade-Floor-Seq", "Disciplina-Piso-Sec")}</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={showGroupCol} onChange={e => setViewOpts(o => ({ ...o, showGroupCol: e.target.checked }))} />
          {t("Group", "Grupo")}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={showLifecycleCol} onChange={e => setViewOpts(o => ({ ...o, showLifecycleCol: e.target.checked }))} />
          {t("Lifecycle", "Ciclo de vida")}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={showRevisionCol} onChange={e => setViewOpts(o => ({ ...o, showRevisionCol: e.target.checked }))} />
          {t("Revision", "Revisión")}
        </label>
      </div>

      {updatesAvailable && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 14px", marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: "#92400E" }}>
            {t("New viewpoints are available — Click to refresh", "Hay nuevas vistas disponibles — Haga clic para actualizar")}
          </span>
          <button onClick={refreshViewpoints}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#F59E0B", border: "none", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer", flexShrink: 0 }}>
            <RefreshCw size={14} /> {t("Refresh", "Actualizar")}
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!loading && viewpoints.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 14, padding: "8px 14px", background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, color: "#374151" }}>
          <span style={{ fontWeight: 700, color: "#1E3A5F" }}>{activeStats.length} {t("active", "activas")}</span>
          <span style={{ color: "#6B7280" }}>
            {t("Open", "Abiertas")} {st("open")} · {t("Follow Up", "Seguimiento")} {st("follow_up")} · {t("Waiting", "Esperando")} {st("waiting_design")} · {t("Approved", "Aprobadas")} {st("approved")} · {t("Resolved", "Resueltas")} {st("resolved")}
          </span>
          <span style={{ marginLeft: "auto", color: "#92400E" }}>{t("Superseded", "Reemplazadas")} {lc("superseded")}</span>
          <span style={{ color: "#6B7280" }}>{t("Voided", "Anuladas")} {lc("voided")}</span>
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
        <div className="lens-table-scroll" style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto", overflowY: "scroll", maxHeight: "70vh" }}>
          <style>{`
            .lens-table-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
            .lens-table-scroll::-webkit-scrollbar-track { background: #F1F1F1; border-radius: 8px; }
            .lens-table-scroll::-webkit-scrollbar-thumb { background: #9CA3AF; border-radius: 8px; border: 2px solid #F1F1F1; }
            .lens-table-scroll::-webkit-scrollbar-thumb:hover { background: #6B7280; }
            .lens-table-scroll::-webkit-scrollbar-corner { background: #F1F1F1; }
            .lens-table-scroll { scrollbar-color: #9CA3AF #F1F1F1; scrollbar-width: thin; }
          `}</style>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1E3A5F" }}>
                {[
                  "ID",
                  ...(showGroupCol ? ["Group"] : []),
                  ...(showLifecycleCol ? ["Lifecycle"] : []),
                  ...(showRevisionCol ? ["Rev"] : []),
                  "Priority", "Trade", "Report Type", "Floor", "Note", "Status", "Captured", "Actions",
                ].map(h => (
                  <th key={h} title={HEADER_TIPS[h] || undefined} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "white", textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap", cursor: HEADER_TIPS[h] ? "help" : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <Fragment key={v.id}>
                  <tr style={{ borderTop: "1px solid #F3F4F6", verticalAlign: "top" }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#DBEAFE", color: "#1D4ED8" }}>
                        {idFormatView === "code" ? viewpointCode(v) : (v.displayId || v.viewpointId || "—")}
                      </span>
                      {v.supersedesCode && (
                        <div style={{ marginTop: 3, fontSize: 10, color: "#6B7280", whiteSpace: "nowrap" }}
                          title={t("This viewpoint supersedes (replaced) an earlier one", "Esta vista reemplaza a una anterior")}>
                          ← {t("supersedes", "reemplaza a")} {v.supersedesCode}
                        </div>
                      )}
                    </td>
                    {showGroupCol && (
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {v.issueGroupId ? (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setGroupOpen(p => ({ ...p, [v.id]: !p[v.id] }))}
                            title={t("Show related viewpoints in this issue group", "Mostrar vistas relacionadas de este grupo")}
                            style={{ fontSize: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Layers size={11} /> G:{groupToken(v.issueGroupId)}
                          </button>
                        ) : <span style={{ color: "#9CA3AF" }}>—</span>}
                      </td>
                    )}
                    {showLifecycleCol && (
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {(() => {
                          // Shared field-set contract: "active" is the unmarked default
                          // state — only superseded/voided get a visible marker, matching
                          // how the plugin should surface lifecycle in its own UI.
                          const ls = v.lifecycleStatus || "active";
                          if (ls === "active") return <span style={{ color: "#9CA3AF" }}>—</span>;
                          const b = LIFECYCLE_BADGE[ls];
                          return b
                            ? <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: b.bg, color: b.text }}>{b.label}</span>
                            : <span style={{ fontSize: 12, color: "#6B7280" }}>{ls}</span>;
                        })()}
                      </td>
                    )}
                    {showRevisionCol && (
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: "#1E3A5F" }}>
                        {(v.revisionNumber ?? 1) > 1 ? `${t("Rev", "Rev")} ${v.revisionNumber}` : <span style={{ fontWeight: 400, color: "#9CA3AF" }}>—</span>}
                      </td>
                    )}
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
                        <button className="btn btn-sm btn-outline" onClick={() => toggleHistory(v.id)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <History size={12} /> {t("History", "Historial")}
                        </button>
                        {canWrite && (
                          <>
                            <button className="btn btn-sm btn-outline" onClick={() => editViewpoint(v)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                              <Pencil size={12} /> {t("Edit", "Editar")}
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => reassignViewpoint(v)} disabled={v.lifecycleStatus != null && v.lifecycleStatus !== "active"} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                              <ArrowLeftRight size={12} /> {t("Reassign", "Reasignar")}
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => voidViewpoint(v)} disabled={v.lifecycleStatus === "voided"} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, color: "#92400E", borderColor: "#FDE68A" }}>
                              <Ban size={12} /> {t("Void", "Anular")}
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => deleteViewpoint(v.id)} style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, color: "#DC2626", borderColor: "#FECACA" }}>
                              <Trash2 size={12} /> {t("Delete", "Eliminar")}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {groupOpen[v.id] && v.issueGroupId && (
                    <tr style={{ background: "#F8FAFC", borderTop: "1px solid #F3F4F6" }}>
                      <td colSpan={colCount} style={{ padding: "8px 16px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1E3A5F", marginBottom: 6 }}>
                          {t("Issue group", "Grupo de incidencia")}: {v.issueGroupId}
                        </div>
                        {(() => {
                          const peers = viewpoints.filter(o => o.issueGroupId === v.issueGroupId && o.id !== v.id);
                          if (peers.length === 0) return <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("No other viewpoints in this group.", "No hay otras vistas en este grupo.")}</div>;
                          return (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ color: "#6B7280", textAlign: "left" }}>
                                  <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Code", "Código")}</th>
                                  <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Lifecycle", "Ciclo")}</th>
                                  <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Trade", "Disciplina")}</th>
                                  <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Note", "Nota")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {peers.map(o => (
                                  <tr key={o.id} style={{ borderTop: "1px solid #EEF2F7" }}>
                                    <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{viewpointCode(o)}</td>
                                    <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{o.lifecycleStatus || "active"}</td>
                                    <td style={{ padding: "4px 8px" }}>{o.trade || "—"}</td>
                                    <td style={{ padding: "4px 8px" }}>{o.note || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                  {linksOpen[v.id] && (
                    <tr style={{ background: "#FAFAFA", borderTop: "1px solid #F3F4F6" }}>
                      <td colSpan={colCount} style={{ padding: "4px 16px 14px" }}>
                        <LinkedItemsPanel projectId={projectId} entityType="lens_viewpoint" entityId={v.id} canWrite={canWrite} />
                      </td>
                    </tr>
                  )}
                  {historyOpen[v.id] && (
                    <tr style={{ background: "#F8FAFC", borderTop: "1px solid #F3F4F6" }}>
                      <td colSpan={colCount} style={{ padding: "8px 16px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1E3A5F", marginBottom: 6 }}>
                          {t("Revision history", "Historial de revisiones")}
                        </div>
                        {historyData[v.id] === "loading" && (
                          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("Loading…", "Cargando…")}</div>
                        )}
                        {historyData[v.id] === "error" && (
                          <div style={{ fontSize: 12, color: "#DC2626" }}>{t("Failed to load history.", "No se pudo cargar el historial.")}</div>
                        )}
                        {historyData[v.id] && historyData[v.id] !== "loading" && historyData[v.id] !== "error" && (() => {
                          const h = historyData[v.id] as { chain: any[]; events: any[] };
                          const ACTION_LABEL: Record<string, string> = { edit: t("Edited", "Editado"), reassign: t("Reassigned", "Reasignado"), voided: t("Voided", "Anulado") };
                          return (
                            <>
                              {h.chain.length > 1 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>{t("Revisions", "Revisiones")}</div>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ color: "#6B7280", textAlign: "left" }}>
                                        <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Rev", "Rev")}</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Note", "Nota")}</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Trade", "Disciplina")}</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Floor", "Piso")}</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Lifecycle", "Ciclo")}</th>
                                        <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Updated", "Actualizado")}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {h.chain.map((c: any) => (
                                        <tr key={c.id} style={{ borderTop: "1px solid #EEF2F7" }}>
                                          <td style={{ padding: "4px 8px", whiteSpace: "nowrap", fontWeight: 700, color: "#1E3A5F" }}>{c.revisionNumber ?? 1}</td>
                                          <td style={{ padding: "4px 8px" }}>{c.note || "—"}</td>
                                          <td style={{ padding: "4px 8px" }}>{c.trade || "—"}</td>
                                          <td style={{ padding: "4px 8px" }}>{c.floor || "—"}</td>
                                          <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{c.lifecycleStatus || "active"}</td>
                                          <td style={{ padding: "4px 8px", whiteSpace: "nowrap", color: "#6B7280" }}>{fmtCaptured(c.updatedAt || c.createdAt)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {h.events.length === 0 ? (
                                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("No revisions yet — this is the original version.", "Sin revisiones — esta es la versión original.")}</div>
                              ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ color: "#6B7280", textAlign: "left" }}>
                                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("When", "Cuándo")}</th>
                                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Action", "Acción")}</th>
                                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("From", "De")}</th>
                                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("To", "A")}</th>
                                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("Reason", "Motivo")}</th>
                                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>{t("By", "Por")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {h.events.map((e: any) => (
                                      <tr key={e.id} style={{ borderTop: "1px solid #EEF2F7" }}>
                                        <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{fmtCaptured(e.createdAt)}</td>
                                        <td style={{ padding: "4px 8px", whiteSpace: "nowrap", fontWeight: 700 }}>{ACTION_LABEL[e.actionType] || e.actionType}</td>
                                        <td style={{ padding: "4px 8px" }}>{e.fileNameBefore || "—"}</td>
                                        <td style={{ padding: "4px 8px" }}>{e.fileNameAfter || "—"}</td>
                                        <td style={{ padding: "4px 8px" }}>{e.details || "—"}</td>
                                        <td style={{ padding: "4px 8px", color: "#6B7280" }}>{e.userCompanyName ? `${e.userFullName} (${e.userCompanyName})` : e.userFullName}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </>
                          );
                        })()}
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

      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <History size={16} color="#1E3A5F" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
              {t("Report History", "Historial de Reportes")}
            </h3>
          </div>
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  {[
                    t("Report No.", "No. de Reporte"),
                    t("Generated", "Generado"),
                    t("By", "Por"),
                    t("Viewpoints", "Vistas"),
                    t("Health", "Salud"),
                    t("Watermark", "Marca de Agua"),
                    t("Type", "Tipo"),
                  ].map(h => (
                    <th key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "#374151", textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  <th style={{ padding: "8px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {history.map(rp => {
                  const hs = rp.healthScore ?? null;
                  const hc = hs === null ? "#6B7280" : hs >= 80 ? "#16A34A" : hs >= 50 ? "#CA8A04" : "#DC2626";
                  return (
                    <tr key={rp.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#1D4ED8", whiteSpace: "nowrap" }}>{rp.reportNumber}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{fmtCaptured(rp.generatedAt)}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#111827" }}>{rp.generatedByName || "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#111827" }}>{rp.viewpointCount ?? "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: hc }}>{hs === null ? "—" : hs}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#6B7280" }}>{WATERMARK_LABEL[rp.watermarkType ?? ""] ?? "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{rp.isExecutiveOnePager ? t("Executive", "Ejecutivo") : t("Full", "Completo")}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-sm btn-outline" onClick={() => deleteReport(rp.id)}
                          title={t("Delete this report record", "Eliminar este reporte")}
                          style={{ fontSize: 11, padding: "4px 8px", color: "#DC2626", borderColor: "#FECACA", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Trash2 size={12} /> {t("Delete", "Eliminar")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1100, display: "flex", alignItems: "center", gap: 8, background: "#16A34A", color: "white", fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {actionModal && (
        <div
          onClick={() => actionPhase !== "submitting" && setActionModal(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 460, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", padding: 24 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                {actionModal.type === "edit" ? <><Pencil size={16} /> {t("Edit Viewpoint", "Editar Vista")}</>
                  : actionModal.type === "reassign" ? <><ArrowLeftRight size={16} /> {t("Reassign Viewpoint", "Reasignar Vista")}</>
                  : <><Ban size={16} /> {t("Void Viewpoint", "Anular Vista")}</>}
              </h3>
              <button
                onClick={() => actionPhase !== "submitting" && setActionModal(null)}
                aria-label={t("Close", "Cerrar")}
                disabled={actionPhase === "submitting"}
                style={{ background: "transparent", border: "none", cursor: actionPhase === "submitting" ? "not-allowed" : "pointer", color: "#6B7280", lineHeight: 0, padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {actionModal.type === "edit" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {t("Note", "Nota")}
                  <textarea
                    value={actionModal.note}
                    onChange={e => setActionModal({ ...actionModal, note: e.target.value })}
                    rows={3}
                    style={{ fontSize: 13, padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, resize: "vertical", fontWeight: 400 }}
                  />
                </label>
              )}
              {actionModal.type === "reassign" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {t("Reassign to trade", "Reasignar a disciplina")}
                  <select
                    value={actionModal.trade}
                    onChange={e => setActionModal({ ...actionModal, trade: e.target.value })}
                    style={{ fontSize: 13, padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontWeight: 400, background: "white" }}
                  >
                    {trades.filter(x => x !== actionModal.v.trade).map(tr => (
                      <option key={tr} value={tr}>{tr}</option>
                    ))}
                  </select>
                </label>
              )}
              {actionModal.type === "void" && (
                <p style={{ margin: 0, fontSize: 13, color: "#4B5563" }}>
                  {t("This viewpoint will stay visible but be marked voided. You can review this in its history.", "Esta vista permanecerá visible pero se marcará como anulada. Puede revisarlo en su historial.")}
                </p>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                {t("Reason (optional)", "Motivo (opcional)")}
                <input
                  value={actionModal.reason}
                  onChange={e => setActionModal({ ...actionModal, reason: e.target.value })}
                  style={{ fontSize: 13, padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontWeight: 400 }}
                />
              </label>
            </div>

            {actionError && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12.5, fontWeight: 600, padding: "8px 12px", borderRadius: 8 }}>
                {actionError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setActionModal(null)}
                disabled={actionPhase === "submitting"}
                style={{ fontSize: 13, padding: "6px 14px" }}
              >
                {t("Cancel", "Cancelar")}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={submitAction}
                disabled={actionPhase === "submitting"}
                style={{ fontSize: 13, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
              >
                {actionPhase === "submitting"
                  ? <><RefreshCw size={14} /> {t("Saving…", "Guardando…")}</>
                  : actionModal.type === "void"
                    ? <><Ban size={14} /> {t("Void", "Anular")}</>
                    : <><CheckCircle2 size={14} /> {t("Save", "Guardar")}</>}
              </button>
            </div>
          </div>
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

      {reportModalOpen && (
        <div
          onClick={() => !generating && setReportModalOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 560, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", padding: 24, margin: "24px 0" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                {t("Generate Lens Viewpoints Report", "Generar Reporte de Vistas Lens")}
              </h3>
              <button
                onClick={() => !generating && setReportModalOpen(false)}
                aria-label={t("Close", "Cerrar")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6B7280", lineHeight: 0, padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={lblStyle}>
                {t("Company Name", "Nombre de Empresa")}
                <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder={t("Defaults to your company", "Usa tu empresa por defecto")} style={inpStyle} />
              </label>
              <label style={lblStyle}>
                {t("Report Date", "Fecha del Reporte")}
                <input type="date" value={form.reportDate} onChange={e => setForm(f => ({ ...f, reportDate: e.target.value }))} style={inpStyle} />
              </label>
              <label style={lblStyle}>
                {t("Prepared By (Name)", "Preparado Por (Nombre)")}
                <input value={form.preparedByName} onChange={e => setForm(f => ({ ...f, preparedByName: e.target.value }))}
                  placeholder={t("Defaults to your name", "Usa tu nombre por defecto")} style={inpStyle} />
              </label>
              <label style={lblStyle}>
                {t("Prepared By (Title)", "Preparado Por (Cargo)")}
                <input value={form.preparedByTitle} onChange={e => setForm(f => ({ ...f, preparedByTitle: e.target.value }))}
                  placeholder={t("e.g. BIM Coordinator", "ej. Coordinador BIM")} style={inpStyle} />
              </label>
              <label style={lblStyle}>
                {t("Submitted To", "Enviado A")}
                <input value={form.submittedTo} onChange={e => setForm(f => ({ ...f, submittedTo: e.target.value }))}
                  list="lens-submitted-to" placeholder={t("Select or type a recipient", "Selecciona o escribe un destinatario")} style={inpStyle} />
                <datalist id="lens-submitted-to">
                  {members.map((m, i) => {
                    const v = m.userCompanyName ? `${m.userFullName} — ${m.userCompanyName}` : m.userFullName;
                    return v ? <option key={i} value={v} /> : null;
                  })}
                </datalist>
              </label>
              <label style={lblStyle}>
                {t("Watermark", "Marca de Agua")}
                <select value={form.watermarkType} onChange={e => setForm(f => ({ ...f, watermarkType: e.target.value }))} style={inpStyle}>
                  <option value="draft">{t("Draft", "Borrador")}</option>
                  <option value="issued">{t("Issued for Coordination", "Emitido para Coordinación")}</option>
                  <option value="superseded">{t("Superseded", "Reemplazado")}</option>
                </select>
              </label>
            </div>

            <label style={{ ...lblStyle, marginTop: 12 }}>
              {t("Company Logo (optional)", "Logo de Empresa (opcional)")}
              <input type="file" accept="image/png,image/jpeg" onChange={e => onLogoFile(e.target.files?.[0])} style={{ ...inpStyle, padding: 6 }} />
              {form.logoDataUrl && (
                <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <img src={form.logoDataUrl} alt="logo" style={{ height: 28, border: "1px solid #E5E7EB", borderRadius: 4 }} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, logoDataUrl: "" }))}
                    style={{ background: "transparent", border: "none", color: "#DC2626", fontSize: 12, cursor: "pointer" }}>
                    {t("Remove", "Quitar")}
                  </button>
                </span>
              )}
            </label>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>{t("Filters", "Filtros")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <label style={lblStyle}>
                  {t("Priority", "Prioridad")}
                  <select value={form.fPriority} onChange={e => setForm(f => ({ ...f, fPriority: e.target.value }))} style={inpStyle}>
                    <option value="all">{t("All", "Todas")}</option>
                    {[1, 2, 3, 4, 5].map(p => <option key={p} value={String(p)}>P{p}</option>)}
                  </select>
                </label>
                <label style={lblStyle}>
                  {t("Status", "Estado")}
                  <select value={form.fStatus} onChange={e => setForm(f => ({ ...f, fStatus: e.target.value }))} style={inpStyle}>
                    <option value="all">{t("All", "Todos")}</option>
                    {LENS_STATUS_ORDER.map(s => <option key={s} value={s}>{lensStatusLabel(s)}</option>)}
                  </select>
                </label>
                <label style={lblStyle}>
                  {t("Floor", "Piso")}
                  <select value={form.fFloor} onChange={e => setForm(f => ({ ...f, fFloor: e.target.value }))} style={inpStyle}>
                    <option value="all">{t("All", "Todos")}</option>
                    {floors.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label style={lblStyle}>
                  {t("Trade", "Disciplina")}
                  <select value={form.fTrade} onChange={e => setForm(f => ({ ...f, fTrade: e.target.value }))} style={inpStyle}>
                    <option value="all">{t("All", "Todas")}</option>
                    {trades.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label style={lblStyle}>
                  {t("Report Type", "Tipo de Reporte")}
                  <select value={form.fReportType} onChange={e => setForm(f => ({ ...f, fReportType: e.target.value }))} style={inpStyle}>
                    <option value="all">{t("All", "Todos")}</option>
                    {reportTypes.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.showHealthScore}
                onChange={e => setForm(f => ({ ...f, showHealthScore: e.target.checked }))} />
              {t("Show Coordination Health Score on the report", "Mostrar Puntaje de Salud de Coordinación en el reporte")}
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isExecutiveOnePager}
                onChange={e => setForm(f => ({ ...f, isExecutiveOnePager: e.target.checked }))} />
              {t("Executive one-pager (summary only, no full register)", "Resumen ejecutivo (solo resumen, sin registro completo)")}
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.includeNonActive}
                onChange={e => setForm(f => ({ ...f, includeNonActive: e.target.checked }))} />
              {t("Include superseded and voided revisions", "Incluir revisiones reemplazadas y anuladas")}
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.includeResolved}
                onChange={e => setForm(f => ({ ...f, includeResolved: e.target.checked }))} />
              {t("Include resolved viewpoints", "Incluir vistas resueltas")}
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.showGroupIds}
                onChange={e => setForm(f => ({ ...f, showGroupIds: e.target.checked }))} />
              {t("Show group IDs in register", "Mostrar IDs de grupo en el registro")}
            </label>



            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.includeRevisionHistory}
                onChange={e => setForm(f => ({ ...f, includeRevisionHistory: e.target.checked }))} />
              {t("Include revision history appendix", "Incluir anexo de historial de revisiones")}
            </label>

            <label style={{ display: "block", marginTop: 14, fontSize: 13, color: "#374151" }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>{t("ID column format", "Formato de columna ID")}</div>
              <select
                value={form.idFormat}
                onChange={e => setForm(f => ({ ...f, idFormat: e.target.value }))}
                style={{ border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, padding: "6px 10px", minWidth: 240 }}
              >
                <option value="displayId">{t("Display ID (plugin code)", "ID de visualización (código del plugin)")}</option>
                <option value="code">{t("Viewpoint code (Trade-Floor-Seq)", "Código de vista (Disciplina-Piso-Sec)")}</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-sm btn-outline" disabled={generating} onClick={() => setReportModalOpen(false)}
                style={{ fontSize: 13, padding: "8px 16px" }}>
                {t("Cancel", "Cancelar")}
              </button>
              <button className="btn btn-sm btn-primary" disabled={generating} onClick={exportPdf}
                style={{ fontSize: 13, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                <FileDown size={14} />
                {generating ? t("Generating...", "Generando...") : t("Generate PDF", "Generar PDF")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lblStyle = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#374151" } as const;
const inpStyle = { border: "1px solid #D1D5DB", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontWeight: 400 } as const;
