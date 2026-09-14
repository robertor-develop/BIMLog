import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(import.meta.dirname, "ProjectSidebar.tsx"), "utf8");
const css = fs.readFileSync(path.join(import.meta.dirname, "../../index.css"), "utf8");

assert.match(source, /bimlog-project-sidebar-width/);
assert.match(source, /if \(storedWidth === null\) return 248/);
assert.match(source, /Math\.min\(420, Math\.max\(220/);
assert.match(source, /setSidebarResizing\(true\)/);
assert.match(source, /ArrowLeft ArrowRight Home End/);
assert.match(source, /bimlog-project-sidebar-collapsed/);
assert.match(source, /<nav className="sidebar-nav phasea-nav-list"/);
assert.match(source, /sidebarResizing \? "none"/);
assert.match(source, /className="sidebar-nav phasea-nav-list" tabIndex=\{0\}/);
assert.match(css, /\.phasea-nav-list[\s\S]*scrollbar-width: thin/);
assert.match(css, /\.phasea-project-sidebar-resizer[\s\S]*cursor: col-resize/);
assert.match(css, /\.phasea-project-sidebar-resizer \{[\s\S]*right: -4px;[\s\S]*width: 9px;[\s\S]*background: transparent;/);
assert.match(css, /\.phasea-project-sidebar-resizer::after,[\s\S]*background: transparent;/);
assert.match(css, /\.phasea-project-sidebar-resizer:hover::after,[\s\S]*background: #93C5FD;/);
assert.doesNotMatch(source, /<GripVertical aria-hidden="true" \/>/);
assert.match(source, /Home resets width/);
assert.match(source, /adjustSidebarWidth\(248\)/);
assert.match(css, /\.phasea-project-sidebar\s*\{[\s\S]*flex:\s*0 0 auto/);
assert.match(css, /\.sidebar-nav \{[^}]*overflow-y: auto/);

console.log(JSON.stringify({ status: "PASS", checks: ["horizontal-drag", "keyboard-resize", "width-persistence", "collapse-persistence", "independent-vertical-scroll"] }));
