import { createRoot } from "react-dom/client";
import { I18nProvider } from "./lib/i18n";
import { useAuthStore } from "./store/auth";
import "./index.css";

const catalog = [
  ["ecosystem_doctrine", "ECOSYSTEM_DOCTRINE.md", "Ecosystem Doctrine", "Doctrina del Ecosistema"],
  ["claude", "CLAUDE.md", "AI Development", "Desarrollo con IA"],
  ["quality", "QUALITY.md", "Quality", "Calidad"],
  ["vision", "VISION.md", "Vision", "Visi\u00f3n"],
  ["platform", "PLATFORM.md", "Platform", "Plataforma"],
  ["plugin", "PLUGIN.md", "Plugin", "Plugin"],
  ["report_design_system", "REPORT_DESIGN_SYSTEM.md", "Report Design", "Dise\u00f1o de Informes"],
  ["standards_register", "STANDARDS_REGISTER.md", "Standards Register", "Registro de Normas"],
  ["status", "STATUS.md", "Status", "Estado"],
  ["open_loop", "OPEN_LOOP.md", "Open Loop", "Pendientes"],
  ["audit", "AUDIT.md", "Audit", "Auditor\u00eda"],
].map(([key, file, en, es]) => ({ key, file, label: { en, es }, scope: "fixture" }));
const commit = "a6d3b1916319bfd0f473d9ec9e1978f166f407dc";
const docs = catalog.map((entry, index) => ({
  key: entry.key,
  name: entry.file,
  label: entry.label,
  scope: entry.scope,
  content: `# ${entry.file}\n\nVerified production-component fixture ${index + 1}.`,
  sourceCommit: commit,
  contentSha256: String(index + 1).padStart(64, "0"),
  reconciledThroughCommit: commit,
  sourceChangedAt: "2026-07-20T20:20:00-04:00",
  mirrorSyncedAt: "2026-07-20T20:21:00-04:00",
  mirrorContentSha256: String(index + 1).padStart(64, "0"),
  status: "Current",
}));

let consoleErrors = 0;
let copiedText = "";
let exportedText = "";
const originalError = console.error;
console.error = (...args) => { consoleErrors += 1; originalError(...args); };
window.addEventListener("error", () => { consoleErrors += 1; });
window.addEventListener("unhandledrejection", () => { consoleErrors += 1; });
Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { copiedText = value; } } });
URL.createObjectURL = (value: Blob) => { void value.text().then((text) => { exportedText = text; }); return "blob:living-brief-fixture"; };
URL.revokeObjectURL = () => undefined;
HTMLAnchorElement.prototype.click = function fixtureClick() {};
const fixtureLanguage = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "es";
localStorage.setItem("bimlog-lang", fixtureLanguage);
sessionStorage.setItem("bimlog-brief-token", "fixture-brief-token");
useAuthStore.setState({ token: "fixture-auth-token" });

const payload = { catalog, manifest: { schemaVersion: 1, reconciledThroughCommit: commit }, docs };
window.fetch = async (input) => {
  const url = String(input);
  if (url.includes("/living-brief/eligibility")) return new Response(JSON.stringify({ eligible: true, isSuperAdmin: true }), { status: 200 });
  if (url.includes("/living-brief/docs")) return new Response(JSON.stringify(payload), { status: 200 });
  return new Response(JSON.stringify({ error: "Unexpected fixture request" }), { status: 404 });
};

const { LivingBrief } = await import("./pages/LivingBrief");
createRoot(document.getElementById("root")!).render(<I18nProvider><LivingBrief /></I18nProvider>);

window.setTimeout(async () => {
  const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
  for (const tab of tabs) tab.click();
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
  buttons.find((button) => /Copy Full Brief|Copiar Brief completo/.test(button.textContent ?? ""))?.click();
  buttons.find((button) => /Export current docs|Exportar documentos actuales/.test(button.textContent ?? ""))?.click();
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  const copyDocCount = (copiedText.match(/^===== .*\.md =====$/gm) ?? []).length;
  const exported = exportedText ? JSON.parse(exportedText) : null;
  const overflow = document.documentElement.scrollWidth > window.innerWidth;
  document.body.dataset.tabCount = String(tabs.length);
  document.body.dataset.horizontalOverflow = String(overflow);
  document.body.dataset.consoleErrors = String(consoleErrors);
  document.body.dataset.copyDocCount = String(copyDocCount);
  document.body.dataset.exportDocCount = String(exported?.documents?.length ?? 0);
  document.body.dataset.exportHasManifest = String(!!exported?.manifest);
  const result = document.createElement("div");
  result.id = "living-brief-harness-result";
  result.textContent = `tabs=${tabs.length}; copy=${copyDocCount}; export=${exported?.documents?.length ?? 0}; manifest=${!!exported?.manifest}; overflow=${overflow}; consoleErrors=${consoleErrors}; lang=${document.documentElement.lang}`;
  document.body.appendChild(result);
}, 1000);
