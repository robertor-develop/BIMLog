import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import {
  FolderOpen, MessageSquare, FileCheck, Activity,
  Users, Settings2, Wand2, BarChart2, Puzzle
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
  { id: "analytics",    label: "Analytics",                  icon: BarChart2,  section: "Project" },
  { id: "files",        label: "project.tabs.files",          icon: FolderOpen, section: "Project" },
  { id: "rfis",         label: "project.tabs.rfis",           icon: MessageSquare, section: "Project" },
  { id: "submittals",   label: "project.tabs.submittals",     icon: FileCheck,  section: "Project" },
  { id: "activity",     label: "project.tabs.activity",       icon: Activity,   section: "Project" },
  { id: "team",         label: "project.tabs.team",           icon: Users,      section: "Project" },
  { id: "generator",    label: "project.tabs.generator",      icon: Wand2,      section: "Tools" },
  { id: "convention",   label: "project.tabs.convention",     icon: Settings2,  section: "Tools", adminOnly: true },
  { id: "integrations", label: "Integrations",                icon: Puzzle,     section: "Tools" },
];

const INTEGRATIONS = [
  { label: "Procore",     status: "live" },
  { label: "OneDrive",   status: "live" },
  { label: "Speckle",    status: "sync" },
  { label: "MS Project", status: "idle" },
];

export function ProjectSidebar({
  projectId, projectCode, projectName, projectDesc,
  activeTab, isAdmin, memberRole
}: SidebarProps) {
  const { t } = useI18n();
  const { user } = useAuthStore();

  const getLabel = (id: string, label: string) => {
    try { return t(label as Parameters<typeof t>[0]); } catch { return label; }
  };

  const sections = ["Project", "Tools"];
  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
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

        {/* Integration status */}
        <span className="sidebar-section-label" style={{ marginTop: 8 }}>Integrations</span>
        {INTEGRATIONS.map(int => (
          <div key={int.label} className="sidebar-nav-item" style={{ cursor: "default" }}>
            <div className={`sidebar-status-dot dot-${int.status}`} />
            <span style={{ flex: 1 }}>{int.label}</span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: int.status === "live" ? "#4ADE80" : int.status === "sync" ? "#FCD34D" : "#9CA3AF"
            }}>
              {int.status === "live" ? "LIVE" : int.status === "sync" ? "SYNC" : "IDLE"}
            </span>
          </div>
        ))}
      </div>

      {/* User footer */}
      {user && (
        <div className="sidebar-footer">
          <div className="avatar avatar-sm av-blue">
            {user.fullName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{user.fullName}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{user.companyName}</div>
          </div>
        </div>
      )}
    </div>
  );
}
