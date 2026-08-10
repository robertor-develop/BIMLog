import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { SidebarUtilities } from "@/components/layout/SidebarUtilities";
import {
  FolderOpen, MessageSquare, FileCheck, Activity,
  Users, Settings2, Wand2, BarChart2, Puzzle, X, Download, Mail, FileBarChart2,
  BookOpen, Send, RefreshCw, CalendarDays, GitMerge, Gauge,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Menu, Calculator, ClipboardList, BriefcaseBusiness
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  { id: "command-center", label: "project.tabs.commandCenter", icon: Gauge, adminOnly: false },
  { id: "coordination", label: "project.tabs.coordination", icon: GitMerge, adminOnly: false },
  { id: "analytics", label: "project.tabs.analytics", icon: BarChart2, adminOnly: false },
  { id: "files", label: "project.tabs.files", icon: FolderOpen, adminOnly: false },
  { id: "rfis", label: "project.tabs.rfis", icon: MessageSquare, adminOnly: false },
  { id: "submittals", label: "project.tabs.submittals", icon: FileCheck, adminOnly: false },
  { id: "transmittals", label: "project.tabs.transmittals", icon: Send, adminOnly: false },
  { id: "change-orders", label: "project.tabs.changeOrders", icon: RefreshCw, adminOnly: false },
  { id: "meetings", label: "project.tabs.meetings", icon: BookOpen, adminOnly: false },
  { id: "schedule", label: "project.tabs.schedule", icon: CalendarDays, adminOnly: false },
  { id: "directory", label: "project.tabs.directory", icon: Users, adminOnly: false },
  { id: "activity", label: "project.tabs.activity", icon: Activity, adminOnly: false },
  { id: "team", label: "project.tabs.team", icon: Users, adminOnly: false },
  { id: "generator", label: "project.tabs.generator", icon: Wand2, adminOnly: false },
  { id: "convention", label: "project.tabs.convention", icon: Settings2, adminOnly: true },
  { id: "reports", label: "project.tabs.reports", icon: FileBarChart2, adminOnly: false },
  { id: "clash-reports", label: "project.tabs.clashReports", icon: BarChart2, adminOnly: false },
  { id: "integrations", label: "project.tabs.integrations", icon: Puzzle, adminOnly: false },
];

type NavItem = typeof NAV_ITEMS[number];

type NavAction = {
  id: string;
  labelEn: string;
  labelEs: string;
  icon?: LucideIcon;
  adminOnly?: boolean;
  superOnly?: boolean;
} & (
  | { kind: "link"; href: string }
  | { kind: "button"; onClick: () => void }
);

type NavGroup = {
  id: string;
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
  items: NavItem[];
  actions?: NavAction[];
};

function SidebarModal({
  onClose,
  titleId,
  descriptionId,
  closeLabel,
  children,
}: {
  onClose: () => void;
  titleId: string;
  descriptionId: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} style={{ background: "white", borderRadius: 12, padding: "28px 28px 24px", maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", position: "relative" }} onClick={e => e.stopPropagation()}>
        <button ref={closeButtonRef} type="button" aria-label={closeLabel} onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 4, borderRadius: 4 }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function ProjectSidebar({ projectId, projectCode, projectName, projectDesc, activeTab, isAdmin, memberRole }: SidebarProps) {
  const { t, lang } = useI18n();
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      project_admin: tr("Project Admin", "Administrador de Proyecto"),
      convention_manager: tr("Convention Manager", "Gerente de Convención"),
      discipline_lead: tr("Discipline Lead", "Líder de Disciplina"),
      member: tr("Member", "Miembro"),
      sub_trade: tr("Sub-trade", "Subcontratista"),
      read_only: tr("Read Only", "Solo lectura"),
    };
    return labels[role] ?? role.replace(/_/g, " ");
  };
  const { user } = useAuthStore();
  const entitledUser = user as (typeof user & { commercialAccess?: boolean; commercialFeatures?: Record<string, boolean>; isSuperAdmin?: boolean; is_super_admin?: boolean });
  const superAdmin = entitledUser?.isSuperAdmin === true || entitledUser?.is_super_admin === true;
  const legacyCommercialSession = entitledUser?.commercialAccess === true && entitledUser?.commercialFeatures == null;
  const packageEnabled = legacyCommercialSession || entitledUser?.commercialFeatures?.package === true;
  const canUseBudget = superAdmin || packageEnabled || entitledUser?.commercialFeatures?.budget === true;
  const canUseContracts = superAdmin || packageEnabled || entitledUser?.commercialFeatures?.contracts === true;
  const canUsePlanner = superAdmin || packageEnabled || entitledUser?.commercialFeatures?.cost_value_planner === true;
  const canUseCommercial = entitledUser?.commercialAccess === true || canUseBudget || canUseContracts || canUsePlanner;
  const [, navigate] = useLocation();
  const [showSyncAgent, setShowSyncAgent] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const getLabel = (label: string) => {
    try { return t(label as Parameters<typeof t>[0]); } catch { return label; }
  };

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const byId = (ids: string[]) => ids.map(id => visibleItems.find(item => item.id === id)).filter(Boolean) as NavItem[];
  const allNavGroups: NavGroup[] = [
    {
      id: "command",
      labelEn: "Command",
      labelEs: "Comando",
      descriptionEn: "Daily project command surfaces and activity.",
      descriptionEs: "Superficies diarias de comando y actividad del proyecto.",
      items: byId(["command-center", "coordination", "activity"]),
      actions: [
        { id: "intake", kind: "link", labelEn: "Job Intake & Setup", labelEs: "Ingreso y Configuración del Trabajo", href: `/projects/${projectId}/intake`, icon: ClipboardList },
        { id: "operations", kind: "link", labelEn: "Job Operations", labelEs: "Operaciones del Trabajo", href: `/projects/${projectId}/operations`, icon: BriefcaseBusiness },
      ],
    },
    {
      id: "documents",
      labelEn: "Documents & Workflows",
      labelEs: "Documentos y flujos",
      descriptionEn: "Operational records, logs, and document control.",
      descriptionEs: "Registros operativos, bitacoras y control documental.",
      items: byId(["files", "rfis", "submittals", "transmittals", "change-orders", "meetings"]),
    },
    {
      id: "planning",
      labelEn: "Planning",
      labelEs: "Planificación",
      descriptionEn: "Schedule and model coordination views.",
      descriptionEs: "Cronograma y coordinacion de modelo.",
      items: byId(["schedule", "clash-reports"]),
    },
    {
      id: "commercial",
      labelEn: "Commercial",
      labelEs: "Comercial",
      descriptionEn: "Budget, contracts, and financial controls.",
      descriptionEs: "Presupuesto, contratos y controles financieros.",
      items: [],
      actions: [
        ...(canUseBudget ? [{ id: "budget", kind: "button" as const, labelEn: "Project Budget", labelEs: "Presupuesto del Proyecto", onClick: () => navigate(`/projects/${projectId}/financial/budget`) }] : []),
        ...(canUseContracts ? [{ id: "contracts", kind: "button" as const, labelEn: "Contracts & Commitments", labelEs: "Contratos y Compromisos", onClick: () => navigate(`/projects/${projectId}/financial/contracts`) }] : []),
        ...(canUsePlanner ? [{
          id: "apu",
          kind: "link" as const,
          labelEn: "Cost & Value Planner", labelEs: "Planificador de Costos y Valor",
          href: `/projects/${projectId}/financial/apu`,
          icon: Calculator,
        }] : []),
      ],
    },
    {
      id: "insights",
      labelEn: "Insights & Reports",
      labelEs: "Informes e inteligencia",
      descriptionEn: "Analytics, governed reports, and project intelligence.",
      descriptionEs: "Analítica, reportes gobernados e inteligencia del proyecto.",
      items: byId(["analytics", "reports"]),
    },
    {
      id: "admin",
      labelEn: "Directory & Admin",
      labelEs: "Directorio y administración",
      descriptionEn: "People, project administration, and naming tools.",
      descriptionEs: "Personas, administración del proyecto y herramientas de nombres.",
      items: byId(["directory", "team", "generator", "convention"]),
    },
    {
      id: "integrations",
      labelEn: "Integrations",
      labelEs: "Integraciones",
      descriptionEn: "Approved integrations and BIMLog Sync Agent.",
      descriptionEs: "Integraciones aprobadas y BIMLog Sync Agent.",
      items: byId(["integrations"]),
      actions: [
        { id: "sync-agent", kind: "button", labelEn: "BIMLog Sync Agent", labelEs: "BIMLog Sync Agent", onClick: () => setShowSyncAgent(true) },
      ],
    },
  ];
  const navGroups = allNavGroups.filter(group => {
    if (group.id === "commercial" && !canUseCommercial) return false;
    return group.items.length || group.actions?.length;
  });

  const activeGroup = navGroups.find(
    group =>
      group.items.some(item => item.id === activeTab) ||
      group.actions?.some(action => action.id === activeTab),
  )?.id ?? navGroups[0]?.id ?? "command";
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => ({ [activeGroup]: true }));

  useEffect(() => {
    setExpandedGroups(prev => ({ ...prev, [activeGroup]: true }));
  }, [activeGroup]);

  const closeMobile = () => setMobileOpen(false);
  const toggleGroup = (id: string) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const renderNavGroup = (group: NavGroup, variant: "desktop" | "mobile" = "desktop") => {
    const isActiveParent = group.id === activeGroup;
    const isOpen = variant === "mobile" ? true : !!expandedGroups[group.id];
    const bodyId = `project-nav-${variant}-${group.id}`;
    const label = tr(group.labelEn, group.labelEs);
    const description = tr(group.descriptionEn, group.descriptionEs);

    return (
      <section key={group.id} className={`phasea-nav-group${isActiveParent ? " active-parent" : ""}`}>
        <button
          type="button"
          className="phasea-nav-group-trigger"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          title={`${label} - ${description}`}
          onClick={() => { if (variant === "desktop") toggleGroup(group.id); }}
        >
          <span className="phasea-nav-group-label">{label}</span>
          {isOpen ? <ChevronDown className="phasea-nav-chevron" /> : <ChevronRight className="phasea-nav-chevron" />}
        </button>
        <div id={bodyId} className={`phasea-nav-group-body${isOpen ? " open" : ""}`}>
          {group.items.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const itemLabel = getLabel(item.label);
            return (
              <Link
                key={item.id}
                href={`/projects/${projectId}/${item.id}`}
                className={`sidebar-nav-item phasea-nav-item${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                title={itemLabel}
                onClick={closeMobile}
              >
                <div className="nav-dot" />
                <Icon className="phasea-nav-icon" />
                <span className="phasea-nav-text">{itemLabel}</span>
              </Link>
            );
          })}
          {group.actions?.map(action => {
            const isActive = activeTab === action.id;
            const ActionIcon = action.icon;
            if (action.kind === "link") {
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className={`sidebar-nav-item phasea-nav-item${isActive ? " active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  title={tr(action.labelEn, action.labelEs)}
                  onClick={closeMobile}
                >
                  <div className="nav-dot" />
                  {ActionIcon && <ActionIcon className="phasea-nav-icon" />}
                  <span className="phasea-nav-text">{tr(action.labelEn, action.labelEs)}</span>
                </Link>
              );
            }
            return (
              <button
                key={action.id}
                type="button"
                className={`sidebar-nav-item phasea-nav-item phasea-nav-button${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                title={tr(action.labelEn, action.labelEs)}
                onClick={() => { action.onClick(); closeMobile(); }}
              >
                <div className="nav-dot" />
                {ActionIcon && <ActionIcon className="phasea-nav-icon" />}
                <span className="phasea-nav-text">{tr(action.labelEn, action.labelEs)}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <>
      {showSyncAgent && (
        <SidebarModal
          onClose={() => setShowSyncAgent(false)}
          titleId={`sync-agent-dialog-title-${projectId}`}
          descriptionId={`sync-agent-dialog-description-${projectId}`}
          closeLabel={tr("Close Sync Agent dialog", "Cerrar diálogo de Sync Agent")}
        >
          <div style={{ marginBottom: 16 }}>
            <div id={`sync-agent-dialog-title-${projectId}`} style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>BIMLog Sync Agent</div>
            <div id={`sync-agent-dialog-description-${projectId}`} style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              {tr("BIMLog Sync Agent is available on", "BIMLog Sync Agent está disponible en")} <strong>{tr("Professional plans and up", "planes Profesionales y superiores")}</strong>. {tr("Download the installer or upgrade your plan.", "Descarga el instalador o mejora tu plan.")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/api/v1/downloads/sync-agent-windows" download="BIMLog Sync Agent Setup 1.0.0.exe" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, background: "#1D4ED8", color: "white", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              <Download style={{ width: 13, height: 13 }} />
              {tr("Download for Windows", "Descargar para Windows")}
            </a>
            <a href="mailto:info@ignitesmart.ai" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, border: "1.5px solid #E2E8F0", color: "#374151", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              <Mail style={{ width: 13, height: 13 }} />
              {tr("Contact Us", "Contáctanos")}
            </a>
          </div>
        </SidebarModal>
      )}

      <button
        type="button"
        className="phasea-mobile-nav-trigger"
        aria-expanded={mobileOpen}
        aria-controls="phasea-mobile-project-nav"
        onClick={() => setMobileOpen(true)}
      >
        <Menu style={{ width: 15, height: 15 }} />
        {tr("Open project navigation", "Abrir navegación del proyecto")}
      </button>

      {mobileOpen && (
        <div className="phasea-mobile-nav-backdrop" role="presentation" onClick={closeMobile}>
          <aside
            id="phasea-mobile-project-nav"
            className="phasea-mobile-nav-panel"
            aria-label={tr("Project navigation", "Navegación del proyecto")}
            onClick={event => event.stopPropagation()}
          >
            <button type="button" className="phasea-mobile-nav-close" onClick={closeMobile}>
              <X style={{ width: 14, height: 14 }} />
              {tr("Close", "Cerrar")}
            </button>
            <div className="sidebar-project phasea-mobile-project-card">
              <div className="sidebar-project-code">{projectCode}</div>
              <div className="sidebar-project-name">{projectName}</div>
            </div>
            <div className="sidebar-nav phasea-nav-mobile-list">
              {navGroups.map(group => renderNavGroup(group, "mobile"))}
            </div>
          </aside>
        </div>
      )}

      <div className={`sidebar phasea-project-sidebar${collapsed ? " collapsed" : ""}`}>
        <SidebarUtilities
          activeTab={activeTab}
          helpHref={`/help?context=${encodeURIComponent(activeTab)}&view=manual&from=${encodeURIComponent(
            typeof window === "undefined" ? `/projects/${projectId}` : `${window.location.pathname}${window.location.search}`,
          )}`}
        />
        <button
          type="button"
          className="phasea-sidebar-collapse"
          aria-pressed={collapsed}
          title={collapsed ? tr("Expand navigation", "Expandir navegación") : tr("Collapse navigation", "Contraer navegación")}
          onClick={() => setCollapsed(prev => !prev)}
        >
          {collapsed ? <PanelLeftOpen style={{ width: 14, height: 14 }} /> : <PanelLeftClose style={{ width: 14, height: 14 }} />}
          <span>{collapsed ? tr("Expand", "Expandir") : tr("Collapse", "Contraer")}</span>
        </button>

        <div style={{ padding: "10px 10px 0" }}>
          <div className="sidebar-project">
            <div className="sidebar-project-code">{projectCode}</div>
            <div className="sidebar-project-name">{projectName}</div>
            {projectDesc && <div className="sidebar-project-desc">{projectDesc}</div>}
          </div>
          {memberRole && (
            <div style={{ padding: "8px 2px 0" }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>{roleLabel(memberRole)}</span>
            </div>
          )}
        </div>

        <div className="sidebar-nav phasea-nav-list">
          {navGroups.map(group => renderNavGroup(group))}
        </div>

        {user && (
          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/profile`} className="sidebar-footer" style={{ textDecoration: "none", cursor: "pointer" }} title="My Profile">
            <div className="avatar avatar-sm av-blue">{user.fullName?.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.fullName}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{user.companyName}</div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{tr("Profile ->", "Perfil ->")}</div>
          </a>
        )}
      </div>
    </>
  );
}
