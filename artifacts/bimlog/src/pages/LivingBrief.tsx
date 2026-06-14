import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Lock, RefreshCw, KeyRound, Users, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const BRIEF_TOKEN_KEY = "bimlog-brief-token";

type Doc = { name: string; content: string; updatedAt: string };
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
function renderMarkdown(md: string): JSX.Element[] {
  const lines = md.split("\n");
  const out: JSX.Element[] = [];
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
    const parts: (string | JSX.Element)[] = [];
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
  const [, setLocation] = useLocation();

  const [eligible, setEligible] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDoc, setActiveDoc] = useState(0);

  const [showAdmin, setShowAdmin] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [adminMsg, setAdminMsg] = useState("");

  const briefToken = () => sessionStorage.getItem(BRIEF_TOKEN_KEY) || "";

  const loadDocs = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch("/living-brief/docs", token, { headers: { "X-Brief-Token": briefToken() } });
    if (r.ok) {
      const d = await r.json();
      setDocs(d.docs ?? []);
      setUnlocked(true);
      setError("");
    } else {
      sessionStorage.removeItem(BRIEF_TOKEN_KEY);
      setUnlocked(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    let active = true;
    apiFetch("/living-brief/eligibility", token)
      .then((r) => (r.ok ? r.json() : { eligible: false, isSuperAdmin: false }))
      .then((d) => {
        if (!active) return;
        setEligible(!!d.eligible);
        setIsSuperAdmin(!!d.isSuperAdmin);
        if (d.eligible && briefToken()) loadDocs();
      })
      .catch(() => { if (active) setEligible(false); });
    return () => { active = false; };
  }, [token, loadDocs, setLocation]);

  const unlock = async () => {
    if (!token) return;
    setError("");
    const r = await apiFetch("/living-brief/unlock", token, { method: "POST", body: JSON.stringify({ password }) });
    if (r.ok) {
      const d = await r.json();
      sessionStorage.setItem(BRIEF_TOKEN_KEY, d.briefToken);
      setPassword("");
      await loadDocs();
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Unlock failed");
    }
  };

  const loadAccess = async () => {
    if (!token) return;
    const r = await apiFetch("/living-brief/access", token);
    if (r.ok) setAccessUsers((await r.json()).users ?? []);
  };

  const toggleAccess = async (userId: number, grant: boolean) => {
    if (!token) return;
    const r = await apiFetch("/living-brief/access", token, { method: "POST", body: JSON.stringify({ userId, grant }) });
    if (r.ok) loadAccess();
  };

  const changePassword = async () => {
    if (!token) return;
    setAdminMsg("");
    const r = await apiFetch("/living-brief/password", token, { method: "POST", body: JSON.stringify({ newPassword }) });
    if (r.ok) { setNewPassword(""); setAdminMsg("Password updated."); }
    else { const d = await r.json().catch(() => ({})); setAdminMsg(d.error || "Update failed"); }
  };

  const card: React.CSSProperties = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: 20 };

  if (eligible === null) {
    return <div style={{ maxWidth: 900, margin: "60px auto", padding: 24, color: "hsl(var(--muted-foreground))" }}>Loading…</div>;
  }

  if (!eligible) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Lock size={18} /> <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Living Brief</h1>
          </div>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 14, margin: 0 }}>
            You do not have access to the Living Brief. Ask the super admin to grant access.
          </p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Lock size={18} /> <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Living Brief — Locked</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") unlock(); }}
            placeholder="Enter password"
            autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 14, marginBottom: 10 }}
          />
          {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button onClick={unlock} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "28px auto", padding: "0 20px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Living Brief</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadDocs} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={14} /> Reload
          </button>
          {isSuperAdmin && (
            <button onClick={() => { setShowAdmin((s) => !s); if (!showAdmin) loadAccess(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ShieldCheck size={14} /> Admin
            </button>
          )}
        </div>
      </div>

      {showAdmin && isSuperAdmin && (
        <div style={{ ...card, marginBottom: 16, display: "grid", gap: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 700 }}><KeyRound size={15} /> Change gate password</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" style={{ flex: 1, minWidth: 200, padding: "8px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }} />
              <button onClick={changePassword} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Update</button>
            </div>
            {adminMsg && <div style={{ fontSize: 12.5, marginTop: 6, color: "hsl(var(--muted-foreground))" }}>{adminMsg}</div>}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 700 }}><Users size={15} /> Manage access</div>
            <div style={{ display: "grid", gap: 6 }}>
              {accessUsers.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 10px", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{u.fullName}</span>{" "}
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{u.email}</span>
                    {u.isSuperAdmin && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#16A34A" }}>SUPER ADMIN</span>}
                  </div>
                  {u.isSuperAdmin ? (
                    <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>Always</span>
                  ) : (
                    <button onClick={() => toggleAccess(u.id, !u.canAccessLivingBrief)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid hsl(var(--border))", background: u.canAccessLivingBrief ? "#16A34A" : "hsl(var(--card))", color: u.canAccessLivingBrief ? "white" : "hsl(var(--foreground))", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {u.canAccessLivingBrief ? "Granted" : "Grant"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {docs.map((d, i) => (
          <button key={d.name} onClick={() => setActiveDoc(i)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: i === activeDoc ? "hsl(var(--primary))" : "hsl(var(--card))", color: i === activeDoc ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {d.name.replace(".md", "")}
          </button>
        ))}
      </div>

      {docs[activeDoc] && (
        <div style={card}>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
            Updated {new Date(docs[activeDoc].updatedAt).toLocaleString()}
          </div>
          <div>{renderMarkdown(docs[activeDoc].content)}</div>
        </div>
      )}
    </div>
  );
}
