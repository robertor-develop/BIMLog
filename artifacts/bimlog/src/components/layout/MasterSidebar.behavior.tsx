import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./MasterSidebar.tsx", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["whole desktop navigation width is user controlled", /sidebarWidth.*Math\.min\(420.*Math\.max\(196/s],
  ["desktop resize handle matches the Operations boundary control", /className="master-sidebar-resizer".*Drag or use arrow keys to resize navigation/s],
  ["desktop resize handle supports keyboard sizing", /aria-keyshortcuts="ArrowLeft ArrowRight Home End".*event\.key === "ArrowLeft".*event\.key === "ArrowRight".*event\.key === "Home".*event\.key === "End"/s],
  ["whole navigation width persists", /bimlog-master-sidebar-width/],
  ["whole navigation collapse persists", /bimlog-master-sidebar-collapsed/],
  ["whole navigation has its own resize handle", /Resize main navigation.*setSidebarResizing\(true\)/s],
  ["whole navigation becomes a compact icon rail", /master-sidebar-collapsed.*sidebarCollapsed \? 58 : sidebarWidth/s],
  ["utility collapse controls the whole navigation", /SidebarUtilities.*collapsed=.*sidebarCollapsed.*onToggleCollapse/s],
  ["notification inbox is a fixed side panel", /aria-label=\{t\("Notification inbox".*position: "fixed"/s],
  ["desktop panel width is user controlled", /notificationPanelWidth.*Math\.min\(720.*Math\.max\(300/s],
  ["resize uses a pointer drag and column cursor", /onPointerDown=.*setNotificationPanelResizing\(true\).*col-resize/s],
  ["width persists for later sessions", /bimlog-notification-panel-width/],
  ["collapsed state persists for later sessions", /bimlog-notification-panel-collapsed/],
  ["panel collapses to an icon rail", /Collapse to icons.*notificationPanelCollapsed.*ChevronRight/s],
  ["collapsed rail retains unread count and close action", /unreadCount > 0.*Close notifications/s],
  ["notification list uses full available panel height", /height: "calc\(100% - 44px\)".*overflowY: "auto"/s],
  ["notification rows are native keyboard buttons", /<button type="button" aria-label=\{`\$\{n\.title\}\. \$\{n\.message\}`\}.*void markRead\(n\.id\)/s],
  ["notification deletion has a localized accessible label", /aria-label=\{t\(`Delete notification \$\{n\.title\}`.*Eliminar notificación/s],
  ["administration is an explicit disclosure", /aria-expanded=\{showAdministrationNavigation\}.*aria-controls="headquarters-administration-navigation".*Administration.*Administración/s],
  ["project and company destinations have separate subgroups", /Projects & oversight.*Proyectos y supervisión.*Company setup.*Configuración de empresa/s],
  ["active project and company paths remain identified", /data-active=\{location === "\/admin".*data-active=\{\["\/company-catalogs"/s],
  ["active route changes reopen every owning disclosure", /projectManagementActive.*companySetupActive.*settingsActive.*setShowAdministrationNavigation\(true\).*setShowProjectManagementNavigation\(true\).*setShowCompanySetupNavigation\(true\).*setShowSettingsNavigation\(true\)/s],
  ["disclosure choices persist without hiding the active route", /bimlog-nav-administration-open.*bimlog-nav-project-management-open.*bimlog-nav-company-setup-open.*bimlog-nav-settings-open/s],
  ["mobile and desktop share the same role-filtered hierarchy", /\(!sidebarCollapsed \|\| isMobile\).*headquarters-project-management-navigation.*\(!sidebarCollapsed \|\| isMobile\).*headquarters-company-setup-navigation/s],
];
for (const [name, pattern] of checks) assert.match(source, pattern, name);
console.log(`Master sidebar hierarchy and panel assertions: ${checks.length}/${checks.length} passed`);
