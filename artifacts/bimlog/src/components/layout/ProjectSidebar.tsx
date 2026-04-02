import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { getMe } from "@workspace/api-client-react";
import {
  FolderOpen, MessageSquare, FileCheck, Activity,
  Users, Settings2, Wand2, BarChart2, Puzzle, X, Download, Mail, FileBarChart2,
  BookOpen, Send, RefreshCw, CalendarDays
} from "lucide-react";

interface SidebarProps {
  projectId: number;
  projectCode: string;
  projectName: string;
  projectDesc?: string;
  activeTab: string;
  isAdmin: boolean;
  memberRole: string;
}

const NAV_ITEMS = [
  { id: "analytics",     label: "Analytics",                  icon: BarChart2,     section: "Project" },
  { id: "files",         label: "project.tabs.files",          icon: FolderOpen,    section: "Project" },
  { id: "rfis",          label: "project.tabs.rfis",           icon: MessageSquare, section: "Project" },
  { id: "submittals",    label: "project.tabs.submittals",     icon: FileCheck,     section: "Project" },
  { id: "transmittals",  label: "Transmittals",                icon: Send,          section: "Project" },
  { id: "change-orders", label: "Change Orders",               icon: RefreshCw,     section: "Project" },
  { id: "meetings",      label: "Meetings",                    icon: BookOpen,      section: "Project" },
  { id: "schedule",      label: "Schedule",                    icon: CalendarDays,  section: "Project" },
  { id: "directory",     label: "Directory",                   icon: Users,         section: "Project" },
  { id: "activity",      label: "project.tabs.activity",       icon: Activity,      section: "Project" },
  { id: "team",          label: "project.tabs.team",           icon: Users,         section: "Admin" },
  { id: "generator",     label: "project.tabs.generator",      icon: Wand2,         section: "Tools" },
  { id: "convention",    label: "project.tabs.convention",     icon: Settings2,     section: "Tools", adminOnly: true },
  { id: "reports",       label: "Reports & PDF",               icon: FileBarChart2, section: "Tools" },
  { id: "integrations",  label: "Integrations",                icon: Puzzle,        section: "Tools" },
];

const PLATFORM_ITEMS = [
  { name: "Procore",       logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "PC" },
  { name: "Autodesk BIM 360", logoBg: "#FEF3C7", logoColor: "#92400E", logoText: "B360" },
  { name: "OneDrive",      logoBg: "#EFF6FF", logoColor: "#0067B8", logoText: "OD" },
];

function SidebarModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: 12, padding: "28px 28px 24px",
          maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          position: "relative",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "none", border: "none", cursor: "pointer",
            color: "#6B7280", padding: 4, borderRadius: 4,
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function ProjectSidebar({
  projectId, projectCode, projectName, projectDesc,
  activeTab, isAdmin, memberRole
}: SidebarProps) {
  const { t } = useI18n();
  const { user, token } = useAuthStore();
  const [, navigate] = useLocation();
  const [showSyncAgent, setShowSyncAgent] = useState(false);
  const [showManaged, setShowManaged] = useState(false);
  const [showOAuth, setShowOAuth] = useState(false);
  const [isSuperAdminState, setIsSuperAdminState] = useState(false);

  useEffect(() => {
    if (!token) return;
    getMe().then((data) => { if (data.isSuperAdmin) setIsSuperAdminState(true); }).catch(() => {});
  }, [token]);

  const getLabel = (id: string, label: string) => {
    try { return t(label as Parameters<typeof t>[0]); } catch { return label; }
  };

  const sections = ["Project", "Admin", "Tools"];
  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const sidebarBtnStyle: React.CSSProperties = {
    cursor: "pointer", background: "none", border: "none",
    width: "100%", textAlign: "left",
  };

  return (
    <>
      {showSyncAgent && (
        <SidebarModal onClose={() => setShowSyncAgent(false)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>BIMLog Sync Agent</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              BIMLog Sync Agent is available on <strong>Professional plans and up</strong>. Download the installer or upgrade your plan.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href="/api/v1/downloads/sync-agent-windows"
              download="BIMLog Sync Agent Setup 1.0.0.exe"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 7,
                background: "#1D4ED8", color: "white",
                fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}
            >
              <Download style={{ width: 13, height: 13 }} />
              Download for Windows
            </a>
            <a
              href="mailto:info@ignitesmart.ai"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 7,
                border: "1.5px solid #E2E8F0",
                color: "#374151", fontSize: 12, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <Mail style={{ width: 13, height: 13 }} />
              Contact Us
            </a>
          </div>
        </SidebarModal>
      )}

      {showManaged && (
        <SidebarModal onClose={() => setShowManaged(false)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Managed Connection</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              Managed Connection is available on <strong>Team plans and up</strong>. Our team logs in on your behalf and configures everything. Contact us to get started.
            </div>
          </div>
          <a
            href="mailto:info@ignitesmart.ai?subject=BIMLog%20Managed%20Connection%20Request"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 7,
              background: "#1D4ED8", color: "white",
              fontSize: 12, fontWeight: 600, textDecoration: "none",
            }}
          >
            <Mail style={{ width: 13, height: 13 }} />
            Get Started
          </a>
        </SidebarModal>
      )}

      {showOAuth && (
        <SidebarModal onClose={() => setShowOAuth(false)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>OAuth Connection</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              OAuth Connection is available on <strong>Business plans and up</strong>. Secure token-based direct integration. No API tokens to manage.
            </div>
          </div>
          <a
            href="mailto:info@ignitesmart.ai?subject=BIMLog%20OAuth%20Connection%20Request"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 7,
              background: "#1D4ED8", color: "white",
              fontSize: 12, fontWeight: 600, textDecoration: "none",
            }}
          >
            <Mail style={{ width: 13, height: 13 }} />
            Contact Us
          </a>
        </SidebarModal>
      )}

      <div className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">B</div>
          <div>
            <div className="sidebar-logo-name">BIMLog</div>
            <div className="sidebar-logo-by">by IgniteSmart</div>
          </div>
        </div>

        {/* Project context */}
        <div style={{ padding: "10px 10px 0" }}>
          <div className="sidebar-project">
            <div className="sidebar-project-code">{projectCode}</div>
            <div className="sidebar-project-name">{projectName}</div>
            {projectDesc && <div className="sidebar-project-desc">{projectDesc}</div>}
          </div>

          {memberRole && (
            <div style={{ padding: "8px 2px 0" }}>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "2px 8px", borderRadius: 4
              }}>{memberRole.replace("_", " ")}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          {sections.map(section => {
            const items = visibleItems.filter(i => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section}>
                <span className="sidebar-section-label">{section}</span>
                {items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <Link
                      key={item.id}
                      href={`/projects/${projectId}/${item.id}`}
                      className={`sidebar-nav-item${isActive ? " active" : ""}`}
                    >
                      <div className="nav-dot" />
                      <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                      {getLabel(item.id, item.label)}
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {/* INTEGRATIONS section */}
          <span className="sidebar-section-label" style={{ marginTop: 8 }}>Integrations</span>

          {/* Item 1: Validate and Download */}
          <button
            className="sidebar-nav-item"
            style={sidebarBtnStyle}
            onClick={() => navigate(`/projects/${projectId}/files`)}
          >
            <div className="nav-dot" />
            Validate and Download
          </button>

          {/* Item 2: BIMLog Sync Agent */}
          <button
            className="sidebar-nav-item"
            style={sidebarBtnStyle}
            onClick={() => setShowSyncAgent(true)}
          >
            <div className="nav-dot" />
            BIMLog Sync Agent
          </button>

          {/* Item 3: Managed Connection */}
          <button
            className="sidebar-nav-item"
            style={sidebarBtnStyle}
            onClick={() => setShowManaged(true)}
          >
            <div className="nav-dot" />
            Managed Connection
          </button>

          {/* Item 4: OAuth Connection */}
          <button
            className="sidebar-nav-item"
            style={sidebarBtnStyle}
            onClick={() => setShowOAuth(true)}
          >
            <div className="nav-dot" />
            OAuth Connection
          </button>

          {/* Item 5: API Platform Integrations — sub-header */}
          <div style={{
            paddingLeft: 20, paddingTop: 10, paddingBottom: 4,
            fontSize: 9, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.07em", color: "rgba(255,255,255,0.3)",
          }}>
            API Platform Integrations
          </div>

          {/* Items 6–8: Procore, Autodesk ACC, OneDrive */}
          {PLATFORM_ITEMS.map(p => (
            <button
              key={p.name}
              className="sidebar-nav-item"
              style={{ ...sidebarBtnStyle, paddingLeft: 24 }}
              onClick={() => navigate(`/projects/${projectId}/integrations`)}
            >
              <div className="nav-dot" />
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                background: p.logoBg, color: p.logoColor,
                fontSize: 7, fontWeight: 800, fontFamily: "var(--font-mono)",
              }}>
                {p.logoText}
              </span>
              {p.name}
            </button>
          ))}
        </div>

        {/* Admin links */}
        {(isAdmin || isSuperAdminState) && (
          <div style={{ padding: "8px 0 0" }}>
            {isAdmin && (
              <button
                className="sidebar-nav-item"
                style={{ cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left" }}
                onClick={() => navigate("/admin")}
              >
                <div className="nav-dot" />
                Admin Panel
              </button>
            )}
            {isSuperAdminState && (
              <button
                className="sidebar-nav-item"
                style={{ cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left" }}
                onClick={() => navigate("/total-control")}
              >
                <div className="nav-dot" />
                Total Control
              </button>
            )}
          </div>
        )}

        {/* User footer */}
        {user && (
          <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/profile`}
            className="sidebar-footer"
            style={{ textDecoration: "none", cursor: "pointer" }}
            title="My Profile"
          >
            <div className="avatar avatar-sm av-blue">
              {user.fullName?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.fullName}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{user.companyName}</div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>Profile →</div>
          </a>
        )}
      </div>
    </>
  );
}
