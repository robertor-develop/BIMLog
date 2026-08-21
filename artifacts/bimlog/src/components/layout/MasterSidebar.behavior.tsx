import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./MasterSidebar.tsx", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["whole desktop navigation width is user controlled", /sidebarWidth.*Math\.min\(420.*Math\.max\(196/s],
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
];
for (const [name, pattern] of checks) assert.match(source, pattern, name);
console.log(`Master sidebar notification panel assertions: ${checks.length}/${checks.length} passed`);
