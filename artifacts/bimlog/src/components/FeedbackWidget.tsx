import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, MessageSquare, Send, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/data-retention",
  "/pricing",
  "/features",
  "/about",
  "/contact",
]);

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "workflow", label: "Workflow issue" },
  { value: "idea", label: "Idea" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "low", label: "Low" },
];

function getProjectId(path: string) {
  const match = path.match(/^\/projects\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getModule(path: string) {
  if (path.startsWith("/admin")) return "Admin";
  if (path.startsWith("/dashboard")) return "Dashboard";
  if (path.startsWith("/pending")) return "Pending Items";
  if (path.startsWith("/living-brief")) return "Living Brief";
  const projectMatch = path.match(/^\/projects\/\d+\/([^/?#]+)/);
  if (!projectMatch) return "Project";
  return projectMatch[1]
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function FeedbackWidget() {
  const [location] = useLocation();
  const { token, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("bug");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const projectId = useMemo(() => getProjectId(location), [location]);
  const moduleName = useMemo(() => getModule(location), [location]);

  if (!token || PUBLIC_PATHS.has(location)) return null;

  async function submitFeedback() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Describe what happened or what should improve.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          feedbackType,
          priority,
          message: trimmed,
          module: moduleName,
          projectId,
          pageUrl: window.location.href,
          metadata: {
            path: location,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            userEmail: user?.email ?? null,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Feedback was not submitted.");
      setMessage("");
      setSuccess("Sent to BIMLog support.");
      setTimeout(() => setOpen(false), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback was not submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectStyle: CSSProperties = {
    width: "100%",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    background: "hsl(var(--background))",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send BIMLog feedback"
        title="Send BIMLog feedback"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 70,
          width: 48,
          height: 48,
          borderRadius: 8,
          border: "1px solid #1d4ed8",
          background: "#1d4ed8",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.24)",
          cursor: "pointer",
        }}
      >
        <MessageSquare size={21} />
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15, 23, 42, 0.28)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="BIMLog feedback"
            style={{
              width: "min(420px, calc(100vw - 40px))",
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ background: "#1e3a5f", color: "white", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>BIMLog Feedback</div>
                <div style={{ fontSize: 11, opacity: 0.82 }}>{moduleName} - {location}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Type
                  <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
                    {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Priority
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              <label style={{ fontSize: 12, fontWeight: 700 }}>
                What should we know?
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  spellCheck
                  rows={6}
                  placeholder="Describe the bug, workflow issue, or improvement."
                  style={{
                    width: "100%",
                    marginTop: 5,
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 13,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <div style={{ marginTop: 10, padding: "8px 10px", border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 6, fontSize: 11, color: "#1d4ed8", display: "flex", gap: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>BIMLog will include this page, module, and browser context so support can reproduce the issue.</span>
              </div>

              {error && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 10 }}>{error}</div>}
              {success && <div style={{ color: "#15803d", fontSize: 12, marginTop: 10 }}>{success}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid hsl(var(--border))", background: "white", borderRadius: 6, padding: "8px 12px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={submitting}
                  style={{ border: "1px solid #1d4ed8", background: "#1d4ed8", color: "white", borderRadius: 6, padding: "8px 12px", cursor: submitting ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700 }}
                >
                  <Send size={14} />
                  {submitting ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
