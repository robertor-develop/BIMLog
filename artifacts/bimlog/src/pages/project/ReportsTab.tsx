import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { AlertCircle, CheckCircle2, Clock, FileText, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight } from "lucide-react";
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

interface CvrReport {
  projectId: number;
  generatedAt: string;
  totalFilesProcessed: number;
  totalFlagged: number;
  totalPendingReview: number;
  totalAdminApproved: number;
  totalAdminRejected: number;
  issues: CvrIssue[];
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

const PDF_REPORTS = [
  { key: "project-health",    labelEn: "Project Health",       labelEs: "Salud del Proyecto",      icon: "💚" },
  { key: "compliance",        labelEn: "Compliance Report",    labelEs: "Cumplimiento",             icon: "✅" },
  { key: "rfi-aging",         labelEn: "RFI Aging",            labelEs: "Antigüedad de RFIs",       icon: "⏳" },
  { key: "submittal-status",  labelEn: "Submittal Status",     labelEs: "Estado de Submittals",     icon: "📋" },
  { key: "performance",       labelEn: "Team Performance",     labelEs: "Rendimiento del Equipo",   icon: "📊" },
  { key: "audit-certificate", labelEn: "Audit Certificate",    labelEs: "Certificado de Auditoría", icon: "🏅" },
  { key: "meeting-minutes",   labelEn: "Meeting Minutes Log",  labelEs: "Log de Actas",             icon: "📝" },
  { key: "change-order-log",  labelEn: "Change Order Log",     labelEs: "Log de Órdenes de Cambio", icon: "🔄" },
  { key: "transmittal-log",   labelEn: "Transmittal Log",      labelEs: "Log de Transmisiones",     icon: "📨" },
  { key: "cvr",               labelEn: "CVR Full Report",      labelEs: "Reporte CVR Completo",     icon: "🔍" },
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
              <span style={{ fontSize: 20 }}>{r.icon}</span>
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

          {/* Issues list */}
          {report.issues.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <CheckCircle2 style={{ width: 22, height: 22, color: "#16A34A" }} />
              </div>
              <div className="empty-title" style={{ color: "#16A34A" }}>
                {from || to ? "No issues in selected date range" : "No pending issues"}
              </div>
              <div className="empty-desc">All flagged files have been resolved or there are no CVR flags.</div>
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
