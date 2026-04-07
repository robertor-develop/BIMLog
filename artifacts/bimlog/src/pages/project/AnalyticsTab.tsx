import { useGetProject, useListFiles, useListRfis, useListActivity, useListMembers } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Shield, TrendingUp, AlertTriangle, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface AnalyticsTabProps { projectId: number; }

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { data: project } = useGetProject(projectId);
  const { data: files = [] } = useListFiles(projectId);
  const { data: rfis = [] } = useListRfis(projectId);
  const { data: activity = [] } = useListActivity(projectId);
  const { data: members = [] } = useListMembers(projectId);

  const validFiles   = files.filter(f => f.status !== "rejected").length;
  const rejectedFiles = files.filter(f => f.status === "rejected").length;
  const totalFiles   = files.length;
  const complianceRate = totalFiles > 0 ? Math.round((validFiles / totalFiles) * 100) : 100;

  const openRfis    = rfis.filter(r => r.status !== "closed").length;
  const overdueRfis = rfis.filter(r => {
    if (r.status === "closed") return false;
    const created = new Date(r.createdAt);
    const days = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return days > 7;
  }).length;

  const recentActivity = [...activity].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 6);

  const violationsByCompany: Record<string, number> = {};
  files.filter(f => f.status === "rejected").forEach(f => {
    const company = f.uploadedByCompany || "Unknown";
    violationsByCompany[company] = (violationsByCompany[company] || 0) + 1;
  });

  const violationEntries = Object.entries(violationsByCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxViolations = violationEntries.length > 0 ? violationEntries[0][1] : 1;

  const complianceColor = complianceRate >= 90 ? "#16A34A" : complianceRate >= 70 ? "#D97706" : "#DC2626";
  const complianceFillClass = complianceRate >= 90 ? "compliance-fill-high" : complianceRate >= 70 ? "compliance-fill-medium" : "compliance-fill-low";

  const actionColors: Record<string, string> = {
    upload:        "#2563EB",
    rename:        "#D97706",
    delete:        "#DC2626",
    status_change: "#7C3AED",
    reject:        "#DC2626",
  };

  const actionBadgeClass: Record<string, string> = {
    upload:        "badge-blue",
    rename:        "badge-amber",
    delete:        "badge-red",
    status_change: "badge-purple",
    reject:        "badge-red",
  };

  return (
    <div>
      {/* KPI row */}
      <div className="kpi-grid-5" style={{ marginBottom: 18 }}>
        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/files`)}>
          <div className="kpi-label">Compliance Rate</div>
          <div className="kpi-value" style={{ color: complianceColor }}>{complianceRate}<span style={{ fontSize: 16 }}>%</span></div>
          <div className="kpi-bar" style={{ marginTop: 8 }}>
            <div className={complianceFillClass} style={{ width: `${complianceRate}%` }} />
          </div>
          <div className={`pill ${complianceRate >= 90 ? "pill-green" : complianceRate >= 70 ? "pill-amber" : "pill-red"}`}>
            {complianceRate >= 90 ? "On target" : complianceRate >= 70 ? "Needs attention" : "Critical"}
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/files`)}>
          <div className="kpi-label">Total Files</div>
          <div className="kpi-value">{totalFiles}</div>
          <div className="kpi-sub">{validFiles} valid · {rejectedFiles} rejected</div>
          <div className="pill pill-blue">{members.length} contributors</div>
        </div>

        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/rfis`)}>
          <div className="kpi-label">Open RFIs</div>
          <div className="kpi-value" style={{ color: openRfis > 0 ? "#C2410C" : "#16A34A" }}>{openRfis}</div>
          <div className="kpi-sub">{overdueRfis} overdue · {rfis.length} total</div>
          <div className={`pill ${overdueRfis > 0 ? "pill-red" : "pill-green"}`}>
            {overdueRfis > 0 ? `${overdueRfis} need action` : "All on track"}
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/files`)}>
          <div className="kpi-label">Naming Violations</div>
          <div className="kpi-value" style={{ color: rejectedFiles > 0 ? "#B45309" : "#16A34A" }}>{rejectedFiles}</div>
          <div className="kpi-sub">{violationEntries.length} companies affected</div>
          <div className={`pill ${rejectedFiles === 0 ? "pill-green" : "pill-amber"}`}>
            {rejectedFiles === 0 ? "Clean" : "Review needed"}
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/team`)}>
          <div className="kpi-label">Team Members</div>
          <div className="kpi-value">{members.length}</div>
          <div className="kpi-sub">Across {new Set(members.map(m => m.userCompanyName)).size} companies</div>
          <div className="pill pill-blue">Active project</div>
        </div>
      </div>

      {/* Row 2 — Charts */}
      <div className="col-3" style={{ marginBottom: 18 }}>

        {/* Compliance ring */}
        <div className="card-padded" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/files`)}>
          <div className="section-header">
            <div>
              <div className="section-title">File compliance</div>
              <div className="section-sub">Valid vs rejected uploads</div>
            </div>
            <TrendingUp style={{ width: 16, height: 16, color: complianceColor }} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 16px" }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--secondary))" strokeWidth="14" />
              <circle
                cx="60" cy="60" r="50"
                fill="none"
                stroke={complianceColor}
                strokeWidth="14"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - complianceRate / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill={complianceColor} fontFamily="var(--font-display)">{complianceRate}%</text>
              <text x="60" y="72" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="var(--font-sans)">compliance</text>
            </svg>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ textAlign: "center", padding: "10px 8px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#15803D", fontFamily: "var(--font-display)" }}>{validFiles}</div>
              <div style={{ fontSize: 10, color: "#15803D", fontWeight: 600 }}>Valid</div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 8px", background: "#FFF1F2", borderRadius: 8, border: "1px solid #FECDD3" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#BE123C", fontFamily: "var(--font-display)" }}>{rejectedFiles}</div>
              <div style={{ fontSize: 10, color: "#BE123C", fontWeight: 600 }}>Rejected</div>
            </div>
          </div>
        </div>

        {/* Violations by company */}
        <div className="card-padded" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/files`)}>
          <div className="section-header">
            <div>
              <div className="section-title">Violations by company</div>
              <div className="section-sub">Naming non-compliance</div>
            </div>
            <AlertTriangle style={{ width: 16, height: 16, color: "#D97706" }} />
          </div>

          {violationEntries.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              {violationEntries.map(([company, count]) => (
                <div key={company} className="bar-chart-row">
                  <div className="bar-chart-label" title={company}>{company}</div>
                  <div className="bar-chart-track">
                    <div
                      className="bar-chart-fill"
                      style={{
                        width: `${(count / maxViolations) * 100}%`,
                        background: count >= 5 ? "#DC2626" : count >= 3 ? "#D97706" : "#2563EB"
                      }}
                    />
                  </div>
                  <div className="bar-chart-val" style={{ color: count >= 5 ? "#DC2626" : count >= 3 ? "#D97706" : "#2563EB" }}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "hsl(var(--muted-foreground))" }}>
              <Shield style={{ width: 32, height: 32, margin: "0 auto 8px", color: "#16A34A" }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: "#15803D" }}>No violations recorded</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>All teams are compliant</div>
            </div>
          )}
        </div>

        {/* RFI status breakdown */}
        <div className="card-padded" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/rfis`)}>
          <div className="section-header">
            <div>
              <div className="section-title">RFI status</div>
              <div className="section-sub">{rfis.length} total requests</div>
            </div>
            <Clock style={{ width: 16, height: 16, color: "#6B7280" }} />
          </div>

          {rfis.length > 0 ? (() => {
            const statuses = ["open", "in_review", "responded", "closed"];
            const colors: Record<string, string> = {
              open: "#2563EB", in_review: "#D97706",
              responded: "#7C3AED", closed: "#16A34A"
            };
            const labels: Record<string, string> = {
              open: "Open", in_review: "In Review",
              responded: "Responded", closed: "Closed"
            };
            return (
              <div style={{ marginTop: 4 }}>
                {statuses.map(s => {
                  const count = rfis.filter(r => r.status === s).length;
                  const pct = rfis.length > 0 ? Math.round((count / rfis.length) * 100) : 0;
                  return (
                    <div key={s} className="bar-chart-row">
                      <div className="bar-chart-label">{labels[s]}</div>
                      <div className="bar-chart-track">
                        <div className="bar-chart-fill" style={{ width: `${pct}%`, background: colors[s] }} />
                      </div>
                      <div className="bar-chart-val" style={{ color: colors[s] }}>{count}</div>
                    </div>
                  );
                })}
                {overdueRfis > 0 && (
                  <div style={{ marginTop: 12, padding: "8px 10px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 6, fontSize: 11, color: "#BE123C", fontWeight: 600 }}>
                    {overdueRfis} RFI{overdueRfis !== 1 ? "s" : ""} overdue — escalation required
                  </div>
                )}
              </div>
            );
          })() : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "hsl(var(--muted-foreground))" }}>
              <div style={{ fontSize: 12 }}>No RFIs created yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Activity log + file list */}
      <div className="col-2" style={{ marginBottom: 18 }}>

        {/* Recent activity */}
        <div className="card-padded">
          <div className="section-header">
            <div>
              <div className="section-title">Recent activity</div>
              <div className="section-sub">{activity.length} total events recorded</div>
            </div>
            <div className="locked-badge">
              <Shield style={{ width: 11, height: 11 }} />
              Immutable
            </div>
          </div>

          {recentActivity.length > 0 ? (
            <div>
              {recentActivity.map((act) => (
                <div key={act.id} className="timeline-item" style={{ cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/activity`)}>
                  <div className="timeline-time">{format(new Date(act.createdAt), "HH:mm:ss")}</div>
                  <div
                    className="timeline-dot"
                    style={{ background: actionColors[act.actionType] || "#6B7280" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span className={`badge ${actionBadgeClass[act.actionType] || "badge-gray"}`} style={{ fontSize: 9 }}>
                        {act.actionType.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                        {act.userFullName}
                      </span>
                      <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>· {act.userCompanyName}</span>
                    </div>
                    {act.fileNameAfter && (
                      <div className="file-name" style={{ fontSize: 10 }}>{act.fileNameAfter}</div>
                    )}
                    {!act.fileNameAfter && act.details && (
                      <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{act.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "24px 16px" }}>
              <div className="empty-desc">No activity recorded yet. Upload a file to get started.</div>
            </div>
          )}
        </div>

        {/* Recent files */}
        <div className="card-padded">
          <div className="section-header">
            <div>
              <div className="section-title">Recent files</div>
              <div className="section-sub">{files.length} total · sorted by upload time</div>
            </div>
            <FileText style={{ width: 15, height: 15, color: "hsl(var(--muted-foreground))" }} />
          </div>

          {files.length > 0 ? (
            <div>
              {[...files]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 6)
                .map((file) => {
                  const ext = file.fileName.split(".").pop()?.toLowerCase() || "doc";
                  const iconClass = ext === "rvt" ? "icon-rvt" : ext === "nwd" || ext === "nwf" ? "icon-nwd" : ext === "dwg" || ext === "dxf" ? "icon-dwg" : ext === "pdf" ? "icon-pdf" : ext === "ifc" ? "icon-ifc" : "icon-rvt";
                  const isRejected = file.status === "rejected";

                  return (
                    <div key={file.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid hsl(var(--border))", cursor: "pointer" }} onClick={() => setLocation(`/projects/${projectId}/files`)}>
                      <div className={`file-icon ${iconClass}`}>{ext.toUpperCase().slice(0, 3)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={isRejected ? "file-name-rejected" : "file-name"} style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {file.fileName}
                        </div>
                        <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 1 }}>
                          {file.uploadedByName} · {format(new Date(file.createdAt), "MMM d, HH:mm")}
                        </div>
                      </div>
                      <span className={`badge ${isRejected ? "badge-red" : "badge-green"}`}>
                        {isRejected ? "Rejected" : "Valid"}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "24px 16px" }}>
              <div className="empty-icon"><FileText style={{ width: 20, height: 20, color: "hsl(var(--muted-foreground))" }} /></div>
              <div className="empty-title">No files yet</div>
              <div className="empty-desc">Upload your first file to see analytics here.</div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule placeholder — ready for MS Project data */}
      <div className="card-padded" style={{ marginBottom: 18 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Schedule delay attribution</div>
            <div className="section-sub">Import an MS Project file to activate delay tracking</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "hsl(var(--muted-foreground))", background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", padding: "4px 10px", borderRadius: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9CA3AF", flexShrink: 0, display: "inline-block" }} />
            MS Project · Not connected
          </div>
        </div>

        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
            No real delay attribution data yet for this project.
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
            Connect an MS Project file to begin tracking schedule delay by trade and company.
          </div>
        </div>
      </div>

    </div>
  );
}
