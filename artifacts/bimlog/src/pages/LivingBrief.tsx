import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactElement } from "react";
import { useLocation } from "wouter";
import { Lock, RefreshCw, KeyRound, Users, ShieldCheck, Copy, Download } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const BRIEF_TOKEN_KEY = "bimlog-brief-token";
type FreshnessStatus = "Current" | "Stale" | "Mismatch" | "Missing";
type Doc = {
  key: string;
  name: string;
  label: { en: string; es: string };
  scope: string;
  content: string;
  sourceCommit: string;
  contentSha256: string;
  reconciledThroughCommit: string;
  sourceChangedAt: string;
  semanticReviewedThroughCommit: string;
  semanticReviewTask: string;
  semanticReviewResult: "updated" | "reviewed_no_semantic_change";
  semanticReviewedAt: string;
  deployedSourceCommit: string;
  mirrorSyncedAt: string | null;
  mirrorContentSha256: string | null;
  status: FreshnessStatus;
};
type BriefPayload = { catalog: unknown[]; manifest: Record<string, unknown>; docs: Doc[] };
type AccessUser = {
  id: number;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  canAccessLivingBrief: boolean;
};

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
}

// Minimal markdown renderer (no external deps): headings, bold, inline code, hr,
// blockquotes, unordered lists, and paragraphs. Keeps output readable and plain.
function renderMarkdown(md: string): ReactElement[] {
  const lines = md.split("\n");
  const out: ReactElement[] = [];
  let list: string[] = [];
  const flushList = (key: number) => {
    if (list.length) {
      out.push(
        <ul key={`ul-${key}`} style={{ margin: "8px 0", paddingLeft: 22 }}>
          {list.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{renderInline(it)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  const renderInline = (s: string) => {
    const parts: (string | ReactElement)[] = [];
    let rest = s;
    let k = 0;
    const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      if (m[2] !== undefined) parts.push(<strong key={k++}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<code key={k++} style={{ background: "hsl(var(--secondary))", padding: "1px 5px", borderRadius: 4, fontSize: 12.5 }}>{m[3]}</code>);
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) parts.push(rest);
    return parts;
  };
  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("- ")) { list.push(line.slice(2)); return; }
    flushList(idx);
    if (line.startsWith("### ")) out.push(<h3 key={idx} style={{ fontSize: 15, fontWeight: 700, margin: "14px 0 6px" }}>{renderInline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) out.push(<h2 key={idx} style={{ fontSize: 18, fontWeight: 700, margin: "18px 0 8px" }}>{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) out.push(<h1 key={idx} style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 12px" }}>{renderInline(line.slice(2))}</h1>);
    else if (line.startsWith("> ")) out.push(<blockquote key={idx} style={{ borderLeft: "3px solid hsl(var(--border))", paddingLeft: 12, margin: "8px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>{renderInline(line.slice(2))}</blockquote>);
    else if (line === "---") out.push(<hr key={idx} style={{ border: 0, borderTop: "1px solid hsl(var(--border))", margin: "14px 0" }} />);
    else if (line.trim() === "") out.push(<div key={idx} style={{ height: 6 }} />);
    else out.push(<p key={idx} style={{ margin: "4px 0", lineHeight: 1.6, fontSize: 13.5 }}>{renderInline(line)}</p>);
  });
  flushList(lines.length);
  return out;
}

export function LivingBrief() {
  const { token } = useAuthStore();
  const { tt } = useI18n();
  const [, setLocation] = useLocation();

  const [eligible, setEligible] = useState<boolean | null>(null);
  const [eligibilityError, setEligibilityError] = useState(false);
  const [eligibilityRetry, setEligibilityRetry] = useState(0);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const unlockLock = useRef(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDoc, setActiveDoc] = useState(0);

  const [showAdmin, setShowAdmin] = useState(false);
  const [currentAccountPassword, setCurrentAccountPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [recoveryVersion, setRecoveryVersion] = useState<number | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryLock = useRef(false);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [docsBusy, setDocsBusy] = useState(false);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileNeedsReload, setReconcileNeedsReload] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState("");
  const reconcileLock = useRef(false);
  const docsRequest = useRef<AbortController | null>(null);
  const sessionEpoch = useRef(0);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [accessError, setAccessError] = useState("");
  const accessRequest = useRef(0);
  const accessLock = useRef(false);
  useEffect(() => {
    sessionEpoch.current += 1;
    docsRequest.current?.abort();
    setDocsBusy(false);
    setReconcileBusy(false);
    setReconcileNeedsReload(false);
    setReconcileMessage("");
    reconcileLock.current = false;
    setDocs([]);
    setActiveDoc(0);
    setUnlocked(false);
    setEligible(null);
    setEligibilityError(false);
    setUnlockBusy(false);
    unlockLock.current = false;
    setRecoveryVersion(null);
    setRecoveryStatus("");
    setRecoveryBusy(false);
    recoveryLock.current = false;
    setCurrentAccountPassword("");
    setNewPassword("");
    setResetReason("");
    setResetConfirmation("");
    accessRequest.current += 1;
    accessLock.current = false;
    setAccessBusy(false);
    setAccessUsers([]);
    setAccessMessage("");
    setAccessError("");
    setShowAdmin(false);
    setIsSuperAdmin(false);
    return () => { accessRequest.current += 1; sessionEpoch.current += 1; docsRequest.current?.abort(); };
  }, [token]);
  const [adminMsg, setAdminMsg] = useState("");

  const [toast, setToast] = useState("");
  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 1800); };

  const briefToken = () => sessionStorage.getItem(BRIEF_TOKEN_KEY) || "";

  const loadDocs = useCallback(async () => {
    if (!token) return;
    docsRequest.current?.abort();
    const controller = new AbortController();
    docsRequest.current = controller;
    setDocsBusy(true);
    setError("");
    try {
      const r = await apiFetch("/living-brief/docs", token, { signal: controller.signal, headers: { "X-Brief-Token": briefToken() } });
      if (controller.signal.aborted) return;
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) { sessionStorage.removeItem(BRIEF_TOKEN_KEY); setUnlocked(false); setDocs([]); }
        throw new Error("Living Brief documents could not be loaded. Retry to verify the current source.");
      }
      const d = await r.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(d.docs) || !d.docs.every((doc: Doc) => typeof doc.key === "string" && typeof doc.name === "string" && typeof doc.content === "string" && typeof doc.label?.en === "string" && typeof doc.label?.es === "string")) throw new Error("Invalid Living Brief documents response. Reload before using the documents.");
      setDocs(d.docs);
      setReconcileNeedsReload(false);
      setActiveDoc(index => Math.min(index, Math.max(0, d.docs.length - 1)));
      setUnlocked(true);
      setError("");
    } catch (error) {
      if (!controller.signal.aborted) { setDocs([]); setError(error instanceof Error ? error.message : "Living Brief connection interrupted. Retry."); }
    } finally {
      if (!controller.signal.aborted) setDocsBusy(false);
    }
  }, [token]);

  const unlock = useCallback(async () => {
    if (!token || unlockLock.current) return;
    const epoch = sessionEpoch.current;
    unlockLock.current = true;
    setUnlockBusy(true);
    setError("");
    try {
    const r = await apiFetch("/living-brief/unlock", token, { method: "POST" });
    if (epoch !== sessionEpoch.current) return;
    if (r.ok) {
      const d = await r.json();
      if (epoch !== sessionEpoch.current) return;
      if (typeof d.briefToken !== "string" || !d.briefToken) throw new Error("Invalid Living Brief session response. Retry.");
      sessionStorage.setItem(BRIEF_TOKEN_KEY, d.briefToken);
      await loadDocs();
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Living Brief access could not be opened.");
    }
    } catch (error) {
      if (epoch === sessionEpoch.current) setError(error instanceof Error ? error.message : "Living Brief connection interrupted. Retry.");
    } finally {
      if (epoch === sessionEpoch.current) { unlockLock.current = false; setUnlockBusy(false); }
    }
  }, [loadDocs, token]);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    let active = true;
    setEligibilityError(false);
    apiFetch("/living-brief/eligibility", token)
      .then((r) => { if (!r.ok) throw new Error("Eligibility request unavailable"); return r.json(); })
      .then((d) => {
        if (!active) return;
        if (typeof d.eligible !== "boolean" || typeof d.isSuperAdmin !== "boolean") throw new Error("Invalid eligibility response");
        setEligible(!!d.eligible);
        setIsSuperAdmin(!!d.isSuperAdmin);
        if (d.eligible) {
          if (briefToken()) loadDocs();
          else unlock();
        }
      })
      .catch(() => { if (active) { setEligible(null); setEligibilityError(true); } });
    return () => { active = false; };
  }, [token, loadDocs, setLocation, unlock, eligibilityRetry]);

  const loadAccess = async () => {
    if (!token || !isSuperAdmin || accessLock.current) return;
    const request = ++accessRequest.current;
    accessLock.current = true;
    setAccessBusy(true);
    setAccessError("");
    try {
      const r = await apiFetch("/living-brief/access", token);
      if (!r.ok) throw new Error(tt("Access list could not be loaded. Retry; no permissions were changed.", "No se pudo cargar la lista. Reintente; no se cambiaron permisos."));
      const data = await r.json();
      if (!Array.isArray(data.users) || !data.users.every((u: AccessUser) => Number.isInteger(u.id) && typeof u.email === "string" && typeof u.fullName === "string" && typeof u.isSuperAdmin === "boolean" && typeof u.canAccessLivingBrief === "boolean")) throw new Error(tt("Invalid access response. Reload before changing permissions.", "Respuesta de acceso inválida. Recargue antes de cambiar permisos."));
      if (request === accessRequest.current) setAccessUsers(data.users);
    } catch (error) {
      if (request === accessRequest.current) { setAccessUsers([]); setAccessError(error instanceof Error ? error.message : tt("Access request failed. Retry.", "Falló la solicitud. Reintente.")); }
    } finally {
      if (request === accessRequest.current) { accessLock.current = false; setAccessBusy(false); }
    }
  };

  const loadRecoveryStatus = async () => {
    if (!token || !isSuperAdmin || recoveryLock.current) return null;
    const epoch = sessionEpoch.current;
    recoveryLock.current = true;
    setRecoveryBusy(true);
    setRecoveryVersion(null);
    try {
      const r = await apiFetch("/living-brief/password/recovery", token);
      if (!r.ok) throw new Error(tt("Recovery status unavailable. Retry before resetting.", "Estado de recuperación no disponible. Reintente antes de restablecer."));
      const d = await r.json();
      if (typeof d.credentialConfigured !== "boolean" || (d.expectedCredentialVersion !== null && (!Number.isSafeInteger(d.expectedCredentialVersion) || d.expectedCredentialVersion < 1))) throw new Error(tt("Invalid recovery status. Reload before resetting.", "Estado de recuperación inválido. Recargue antes de restablecer."));
      if (epoch !== sessionEpoch.current) return null;
      setRecoveryVersion(d.expectedCredentialVersion);
      setRecoveryStatus(d.credentialConfigured ? tt(`Configured credential version: ${d.expectedCredentialVersion}`, `Versión de credencial configurada: ${d.expectedCredentialVersion}`) : tt("No gate credential configured. Contact the platform administrator.", "No hay credencial configurada. Contacte al administrador de la plataforma."));
      return d.expectedCredentialVersion as number | null;
    } catch (error) {
      if (epoch === sessionEpoch.current) setRecoveryStatus(error instanceof Error ? error.message : tt("Recovery status request interrupted. Retry.", "Solicitud de recuperación interrumpida. Reintente."));
      return null;
    } finally {
      if (epoch === sessionEpoch.current) { recoveryLock.current = false; setRecoveryBusy(false); }
    }
  };

  const toggleAccess = async (userId: number, grant: boolean) => {
    if (!token || !isSuperAdmin || accessLock.current) return;
    const request = ++accessRequest.current;
    accessLock.current = true;
    setAccessBusy(true);
    setAccessError("");
    setAccessMessage("");
    try {
      const r = await apiFetch("/living-brief/access", token, { method: "POST", body: JSON.stringify({ userId, grant }) });
      if (!r.ok) throw new Error(tt("Permission change was rejected. Reload the access list before retrying.", "El cambio fue rechazado. Recargue la lista antes de reintentar."));
      if (request !== accessRequest.current) return;
      setAccessMessage(tt(`Saved ${grant ? "grant" : "revocation"} for user #${userId}. Reloading saved permissions.`, `Se guardó ${grant ? "el permiso" : "la revocación"} del usuario #${userId}. Recargando permisos guardados.`));
      accessLock.current = false;
      await loadAccess();
    } catch (error) {
      if (request === accessRequest.current) { setAccessUsers([]); setAccessError(error instanceof Error ? error.message : tt("Connection interrupted. Reload to verify saved permissions before retrying.", "Conexión interrumpida. Recargue para verificar los permisos antes de reintentar.")); }
    } finally {
      if (request === accessRequest.current) { accessLock.current = false; setAccessBusy(false); }
    }
  };

  const reconcileMirror = async () => {
    if (!token || !isSuperAdmin || reconcileLock.current || docsBusy || reconcileNeedsReload || error || !docs.length) return;
    setReconcileMessage("");
    const expectedMirrorHashes = Object.fromEntries(
      docs.filter((document) => document.mirrorContentSha256).map((document) => [document.key, document.mirrorContentSha256]),
    );
    if (Object.keys(expectedMirrorHashes).length !== docs.length) {
      setReconcileMessage(tt("Reload after startup synchronization before reconciling.", "Recargue despu\u00e9s de la sincronizaci\u00f3n inicial antes de reconciliar."));
      return;
    }
    const epoch = sessionEpoch.current;
    reconcileLock.current = true;
    setReconcileBusy(true);
    try {
    const response = await apiFetch("/living-brief/reconcile", token, {
      method: "POST",
      body: JSON.stringify({ expectedMirrorHashes }),
    });
    if (epoch !== sessionEpoch.current) return;
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (epoch !== sessionEpoch.current) return;
      setReconcileNeedsReload(true);
      setReconcileMessage(body.error || tt("Reconciliation blocked; reload verified mirror status.", "Reconciliaci\u00f3n bloqueada; recargue el estado verificado del espejo."));
      return;
    }
    setReconcileMessage(tt("Verified source mirror reconciled. Reloading saved source evidence.", "Espejo de fuente verificada reconciliado. Recargando evidencia guardada."));
    await loadDocs();
    } catch (error) {
      if (epoch === sessionEpoch.current) { setReconcileNeedsReload(true); setReconcileMessage(tt("Connection interrupted. Reload source evidence to verify the outcome before retrying.", "Conexión interrumpida. Recargue la evidencia fuente para verificar el resultado antes de reintentar.")); }
    } finally {
      if (epoch === sessionEpoch.current) { reconcileLock.current = false; setReconcileBusy(false); }
    }
  };

  const copyFullBrief = async () => {
    if (!docs.length) return;
    const now = new Date();
    const day = now.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const time = now.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const stamp = `${day.replace(",", "")} at ${time}`;
    const header = `BIMLog Living Brief - Copied ${stamp}`;
    const full = header + "\n\n" + docs
      .map((d) => `===== ${d.name} =====\n\n${d.content.trim()}`)
      .join(`\n\n${"=".repeat(60)}\n\n`);
    try {
      await navigator.clipboard.writeText(full);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
  };

  // Export the complete verified source bundle and its deterministic metadata.
  const exportDocs = async () => {
    if (!token) return;
    const r = await apiFetch("/living-brief/docs", token, { headers: { "X-Brief-Token": briefToken() } });
    if (!r.ok) { showToast("Export failed"); return; }
    const data: BriefPayload = await r.json();
    const fresh: Doc[] = data.docs ?? [];
    setDocs(fresh);
    if (!fresh.length) { showToast(tt("Nothing to export", "No hay documentos para exportar")); return; }
    const body = JSON.stringify({
      exportedFormat: "bimlog-living-brief-v1",
      manifest: data.manifest,
      catalog: data.catalog,
      documents: fresh,
    }, null, 2);
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `living-brief-source-bundle-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(tt("Exported", "Exportado"));
  };

  const changePassword = async () => {
    if (!token || !isSuperAdmin || recoveryLock.current) return;
    if (recoveryVersion === null) { setAdminMsg(tt("Load the current recovery status before resetting.", "Cargue el estado actual de recuperación antes de restablecer.")); return; }
    const epoch = sessionEpoch.current;
    recoveryLock.current = true;
    setRecoveryBusy(true);
    setAdminMsg("");
    const observedVersion = recoveryVersion;
    try {
    const r = await apiFetch("/living-brief/password", token, {
      method: "POST",
      headers: briefToken() ? { "X-Brief-Token": briefToken() } : {},
      body: JSON.stringify({
        currentAccountPassword,
        newPassword,
        reason: resetReason,
        confirmation: resetConfirmation,
        ...(observedVersion === null ? {} : { expectedCredentialVersion: observedVersion }),
      }),
    });
    if (epoch !== sessionEpoch.current) return;
    if (r.ok) {
      sessionStorage.removeItem(BRIEF_TOKEN_KEY);
      setCurrentAccountPassword("");
      setNewPassword("");
      setResetReason("");
      setResetConfirmation("");
      setRecoveryVersion(null);
      setRecoveryStatus("");
      setAdminMsg(tt("Gate credential updated; existing Living Brief sessions were invalidated.", "Credencial de puerta actualizada; las sesiones existentes del Living Brief fueron invalidadas."));
      setUnlocked(false);
      await unlock();
    } else {
      const d = await r.json().catch(() => ({}));
      setAdminMsg(d.error || tt("Update failed", "Actualizacion fallida"));
      if (r.status === 409) setRecoveryVersion(null);
    }
    } catch (error) {
      if (epoch === sessionEpoch.current) { setRecoveryVersion(null); setAdminMsg(tt("Connection interrupted. Load recovery status to verify the current version before retrying.", "Conexión interrumpida. Cargue el estado de recuperación para verificar la versión actual antes de reintentar.")); }
    } finally {
      if (epoch === sessionEpoch.current) { setCurrentAccountPassword(""); setNewPassword(""); recoveryLock.current = false; setRecoveryBusy(false); }
    }
  };

  const card: React.CSSProperties = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: 20 };

  if (eligible === null) {
    return <div style={{ maxWidth: 900, margin: "60px auto", padding: 24, color: "hsl(var(--muted-foreground))" }}>{eligibilityError ? <><p role="alert">{tt("Your access could not be verified. Retry the connection; this does not mean access was denied.", "No se pudo verificar su acceso. Reintente la conexión; esto no significa que se denegó el acceso.")}</p><button onClick={() => setEligibilityRetry(value => value + 1)}>{tt("Retry access verification", "Reintentar verificación de acceso")}</button></> : <p role="status">{tt("Verifying authorized access…", "Verificando acceso autorizado…")}</p>}</div>;
  }

  if (!eligible) {
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "80px auto", padding: 24, boxSizing: "border-box" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Lock size={18} /> <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Living Brief</h1>
          </div>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 14, margin: 0 }}>
            {tt("You do not have access to the Living Brief. Ask the super administrator to grant access.", "No tiene acceso al Living Brief. Solicite acceso al superadministrador.")}
          </p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div style={{ width: "100%", maxWidth: 480, margin: "80px auto", padding: 24, boxSizing: "border-box" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Lock size={18} /> <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tt("Opening Living Brief", "Abriendo Living Brief")}</h1>
          </div>
          {error && <div role="alert" style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          {!error && <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Verifying your authorized access...</div>}
          <button disabled={unlockBusy || docsBusy} onClick={unlock} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {tt("Retry", "Reintentar")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="living-brief-page" style={{ width: "100%", maxWidth: 1100, minWidth: 0, boxSizing: "border-box", overflowX: "hidden", margin: "28px auto", padding: "0 16px 60px" }}>
      <style>{`@media (max-width:600px){.living-brief-header{align-items:flex-start!important}.living-brief-actions{width:100%;min-width:0;flex-direction:column}.living-brief-actions button{width:100%;justify-content:center}}`}</style>
      <div className="living-brief-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Living Brief</h1>
        <div className="living-brief-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "100%" }}>
          <button disabled={docsBusy || false} onClick={loadDocs} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={14} /> {tt("Reload", "Recargar")}
          </button>
          <button disabled={docsBusy || !!error || docs.length === 0} onClick={copyFullBrief} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Copy size={14} /> {tt("Copy Full Brief", "Copiar Brief completo")}
          </button>
          {isSuperAdmin && (
            <button disabled={docsBusy || !!error || docs.length === 0} onClick={exportDocs} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Download size={14} /> {tt("Export current docs", "Exportar documentos actuales")}
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={() => { setShowAdmin((s) => !s); if (!showAdmin) loadAccess(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ShieldCheck size={14} /> {tt("Admin", "Administrar")}
            </button>
          )}
        </div>
      </div>

      {showAdmin && isSuperAdmin && (
        <div style={{ ...card, marginBottom: 16, display: "grid", gap: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 700 }}><KeyRound size={15} /> {tt("Optional gate credential maintenance", "Mantenimiento opcional de credencial de puerta")}</div>
            <p>{tt("This administrator action resets the Living Brief gate credential and invalidates existing Brief sessions. Normal authorized document access does not require this reset or an email password.", "Esta acción administrativa restablece la credencial del Living Brief e invalida sus sesiones existentes. El acceso autorizado normal a documentos no requiere este restablecimiento ni una contraseña de correo.")}</p>
            <button disabled={recoveryBusy} onClick={loadRecoveryStatus}>{tt("Load recovery status", "Cargar estado de recuperación")}</button>
            {recoveryBusy && <p role="status">{tt("Processing credential request…", "Procesando solicitud de credencial…")}</p>}
            {recoveryStatus && <p role="status">{recoveryStatus}</p>}
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
              <input type="password" value={currentAccountPassword} onChange={(e) => setCurrentAccountPassword(e.target.value)} placeholder={tt("Confirm account password", "Confirme la contrasena de cuenta")} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }} />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={tt("New gate password (12+ chars)", "Nueva contrasena de puerta (12+ caracteres)")} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }} />
              <input value={resetReason} onChange={(e) => setResetReason(e.target.value)} placeholder={tt("Audit reason", "Motivo de auditoria")} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }} />
              <input value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} placeholder="RESET_LIVING_BRIEF_GATE" style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }} />
              <button disabled={recoveryBusy || recoveryVersion === null || !currentAccountPassword || newPassword.length < 12 || !resetReason.trim() || resetConfirmation !== "RESET_LIVING_BRIEF_GATE"} onClick={changePassword} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "8px 14px", borderRadius: 8, border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{tt("Reset gate credential", "Restablecer credencial de puerta")}</button>
            </div>
            <div style={{ fontSize: 12, marginTop: 6, color: "hsl(var(--muted-foreground))" }}>
              {tt(
                "Reset requires current Super Administrator account revalidation, explicit confirmation, and an immutable audit entry.",
                "El restablecimiento requiere revalidacion actual de cuenta de Super Administrador, confirmacion explicita y un registro de auditoria inmutable.",
              )}
            </div>
            {adminMsg && <div style={{ fontSize: 12.5, marginTop: 6, color: "hsl(var(--muted-foreground))" }}>{adminMsg}</div>}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 700 }}><Users size={15} /> {tt("Manage Living Brief access", "Administrar acceso al Living Brief")}</div>
            <p>{tt("Super administrators grant or revoke access here. Users then open Living Brief from All Tools. Super administrators always retain access.", "Los superadministradores conceden o revocan acceso aquí. Los usuarios abren Living Brief desde Todas las herramientas. Los superadministradores siempre conservan acceso.")}</p>
            <button disabled={accessBusy} onClick={loadAccess}>{tt("Reload saved permissions", "Recargar permisos guardados")}</button>
            {accessBusy && <p role="status">{tt("Loading saved permissions…", "Cargando permisos guardados…")}</p>}
            {accessError && <p role="alert">{accessError}</p>}
            {accessMessage && <p role="status">{accessMessage}</p>}
            {!accessBusy && !accessError && accessUsers.length === 0 && <p>{tt("No users returned.", "No se encontraron usuarios.")}</p>}
            <div style={{ display: "grid", gap: 6 }}>
              {accessUsers.map((u) => (
                <div key={u.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
                  <div style={{ fontSize: 13, minWidth: 0, overflowWrap: "anywhere" }}>
                    <span style={{ fontWeight: 600 }}>{u.fullName}</span>{" "}
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{u.email}</span>
                    {u.isSuperAdmin && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#16A34A" }}>SUPER ADMIN</span>}
                  </div>
                  {u.isSuperAdmin ? (
                    <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{tt("Always granted", "Siempre autorizado")}</span>
                  ) : (
                    <button disabled={accessBusy || !!accessError} aria-label={tt(`${u.canAccessLivingBrief ? "Revoke" : "Grant"} Living Brief access for ${u.email}`, `${u.canAccessLivingBrief ? "Revocar" : "Conceder"} acceso al Living Brief para ${u.email}`)} onClick={() => toggleAccess(u.id, !u.canAccessLivingBrief)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid hsl(var(--border))", background: u.canAccessLivingBrief ? "#16A34A" : "hsl(var(--card))", color: u.canAccessLivingBrief ? "white" : "hsl(var(--foreground))", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {u.canAccessLivingBrief ? tt("Revoke access", "Revocar acceso") : tt("Grant access", "Conceder acceso")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 700 }}><ShieldCheck size={15} /> {tt("Controlled mirror reconciliation", "Reconciliaci\u00f3n controlada del espejo")}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
              {tt(
                "Copies only the verified deployed source after checking every mirror hash observed on the last reload. It never accepts pasted or database-only doctrine.",
                "Copia \u00fanicamente la fuente desplegada verificada despu\u00e9s de comprobar cada hash del espejo observado en la \u00faltima recarga. Nunca acepta doctrina pegada o exclusiva de la base de datos.",
              )}
            </div>
            <p>{tt(`Observed documents: ${docs.length}; mirror hashes: ${docs.filter(d => d.mirrorContentSha256).length}.`, `Documentos observados: ${docs.length}; hashes del espejo: ${docs.filter(d => d.mirrorContentSha256).length}.`)}</p>
            {reconcileBusy && <p role="status">{tt("Reconciling exact observed source…", "Reconciliando fuente observada exacta…")}</p>}
            {reconcileMessage && <p role="status">{reconcileMessage}</p>}
            {reconcileNeedsReload && <p role="alert">{tt("Reload documents before retrying reconciliation.", "Recargue documentos antes de reintentar la reconciliación.")}</p>}
            <button disabled={reconcileBusy || docsBusy || reconcileNeedsReload || !!error || !docs.length || docs.some(d => !d.mirrorContentSha256)} onClick={reconcileMirror} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {tt("Reconcile verified source", "Reconciliar fuente verificada")}
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))", marginBottom: 12, lineHeight: 1.5 }}>
        {/* Mirror sync time is not document freshness; deployment and semantic review are separate facts. */}
        {tt(
          "Four facts are separate: source content changed, semantic authorities reviewed, source commit deployed, and database mirror synchronized. A source or mirror timestamp never proves deployment.",
          "Cuatro hechos son distintos: cambió el contenido fuente, se revisaron las autoridades semánticas, se desplegó el commit fuente y se sincronizó el espejo. Una fecha de fuente o espejo nunca prueba el despliegue.",
        )}
      </div>

      {/* The API returns documents in the authority order from living-brief/catalog.json. */}
      {docsBusy && <p role="status">{tt("Loading verified source documents…", "Cargando documentos de fuente verificada…")}</p>}
      {error && <div role="alert"><p>{tt("Documents are unavailable. Reload to verify the current source before copying or exporting.", "Los documentos no están disponibles. Recargue para verificar la fuente actual antes de copiar o exportar.")}</p><p>{error}</p></div>}
      {!docsBusy && !error && docs.length === 0 && <p role="status">{tt("No source documents returned. Reload or contact a super administrator.", "No se recibieron documentos fuente. Recargue o contacte a un superadministrador.")}</p>}
      <div role="tablist" aria-label={tt("Living Brief documents", "Documentos del Living Brief")} style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", maxWidth: "100%", paddingBottom: 6 }}>
        {docs.map((d, i) => (
          <button role="tab" aria-selected={i === activeDoc} data-testid={`living-brief-tab-${d.key}`} key={d.key} onClick={() => setActiveDoc(i)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: i === activeDoc ? "hsl(var(--primary))" : "hsl(var(--card))", color: i === activeDoc ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {tt(d.label.en, d.label.es)}
          </button>
        ))}
      </div>

      {docs[activeDoc] && (
        <div style={{ ...card, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
          <div style={{ display: "grid", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid hsl(var(--border))" }}>
            <div data-testid="living-brief-status" style={{ fontSize: 13, fontWeight: 800 }}>
              {tt("Status", "Estado")}: {{ Current: tt("Current", "Vigente"), Stale: tt("Stale", "Desactualizado"), Mismatch: tt("Mismatch", "No coincide"), Missing: tt("Missing", "Faltante") }[docs[activeDoc].status]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 6, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              <div><strong>{tt("Source commit", "Commit de origen")}:</strong> <code style={{ display: "block", wordBreak: "break-all" }}>{docs[activeDoc].sourceCommit}</code></div>
              <div><strong>SHA-256:</strong> <code style={{ display: "block", wordBreak: "break-all" }}>{docs[activeDoc].contentSha256}</code></div>
              <div><strong>{tt("Reconciled through", "Reconciliado hasta")}:</strong> <code style={{ display: "block", wordBreak: "break-all" }}>{docs[activeDoc].reconciledThroughCommit}</code></div>
              <div><strong>{tt("Semantically reviewed through", "Revisión semántica hasta")}:</strong> <code style={{ display: "block", wordBreak: "break-all" }}>{docs[activeDoc].semanticReviewedThroughCommit}</code></div>
              <div><strong>{tt("Semantic review", "Revisión semántica")}:</strong> {docs[activeDoc].semanticReviewResult === "updated" ? tt("Content updated", "Contenido actualizado") : tt("Reviewed - no semantic change", "Revisado - sin cambio semántico")}<br /><code style={{ wordBreak: "break-all" }}>{docs[activeDoc].semanticReviewTask}</code></div>
              <div><strong>{tt("Semantic review time", "Hora de revisión semántica")}:</strong> {new Date(docs[activeDoc].semanticReviewedAt).toLocaleString()}</div>
              <div><strong>{tt("Deployed source commit", "Commit fuente desplegado")}:</strong> <code style={{ display: "block", wordBreak: "break-all" }}>{docs[activeDoc].deployedSourceCommit}</code></div>
              <div><strong>{tt("Source last changed", "Último cambio de fuente")}:</strong> {new Date(docs[activeDoc].sourceChangedAt).toLocaleString()}</div>
              <div><strong>{tt("Database mirror synced", "Espejo de base sincronizado")}:</strong> {docs[activeDoc].mirrorSyncedAt ? new Date(docs[activeDoc].mirrorSyncedAt).toLocaleString() : tt("Missing", "Faltante")}</div>
            </div>
          </div>
          <div>{renderMarkdown(docs[activeDoc].content)}</div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "hsl(var(--foreground))", color: "hsl(var(--background))", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
