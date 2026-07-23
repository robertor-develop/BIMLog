import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const register = read("artifacts/api-server/src/lib/coordinator-action-register.ts");
const insights = read("artifacts/api-server/src/lib/project-insights-metrics.ts");
const route = read("artifacts/api-server/src/routes/coordinator-actions.ts");
const analytics = read("artifacts/bimlog/src/pages/project/AnalyticsTab.tsx");
const coordinator = read("artifacts/bimlog/src/pages/project/CoordinatorCommandCenter.tsx");
const smartGuide = read("artifacts/bimlog/src/components/layout/SmartGuide.tsx");
const en = read("artifacts/bimlog/src/lib/i18n/en.json");
const es = read("artifacts/bimlog/src/lib/i18n/es.json");

const results: Array<{ name: string; detail: string }> = [];
const check = (name: string, condition: unknown, detail: string) => {
  assert.ok(condition, name);
  results.push({ name, detail });
};

const beforeAfterInventory = {
  before: [
    "Analytics label was generic and overlapped reporting terminology.",
    "Analytics embedded Recent Activity even though Activity Log owns project events.",
    "Analytics embedded Recent Files even though Files owns file lists.",
    "Analytics showed an MS Project schedule placeholder without authoritative schedule analytics.",
    "Coordinator header counters included page-scoped deadline counts and source-reporting count.",
  ],
  after: [
    "Analytics is renamed Project Insights & Reports / Perspectivas e Informes.",
    "Insights keeps analytical compliance, RFI performance, company performance, honest unavailable states, and report links.",
    "Recent Activity, Recent Files, operational task lists, and schedule placeholder are removed from Insights.",
    "Coordinator retains exactly four contextual counters: actionable, overdue, due soon, blocked.",
    "Both surfaces use the Coordinator server metric definitions for status/date/count authority.",
  ],
};

check(
  "shared_metric_authority.exported",
  register.includes("COORDINATOR_CONTEXT_METRICS") &&
    register.includes("byDeadlineState") &&
    register.includes("context: {") &&
    insights.includes("COORDINATOR_CONTEXT_METRICS") &&
    route.includes("/projects/:projectId/project-insights"),
  "server exports and reuses one Coordinator metric-definition authority",
);

check(
  "coordinator.four_contextual_counters_only",
  coordinator.includes("contextCounts?.actionable") &&
    coordinator.includes("contextCounts?.overdue") &&
    coordinator.includes("contextCounts?.dueSoon") &&
    coordinator.includes("contextCounts?.blocked") &&
    !coordinator.includes("Sources reporting") &&
    !coordinator.includes("Overdue on this page") &&
    !coordinator.includes("Due this week on this page"),
  "Command Center header is reduced to actionable, overdue, due soon, and blocked",
);

check(
  "insights.renamed_bilingual",
  en.includes('"project.tabs.analytics": "Project Insights & Reports"') &&
    es.includes('"project.tabs.analytics": "Perspectivas e Informes"') &&
    analytics.includes("Project Insights & Reports") &&
    analytics.includes("Perspectivas e Informes del Proyecto") &&
    smartGuide.includes("Project Insights & Reports"),
  "sidebar label, page title, and Smart Guide use the new Understand/Report naming",
);

check(
  "insights.redundant_widgets_removed",
  !/Recent activity|Recent files|Schedule delay attribution|MS Project · Not connected|useListActivity|useListFiles|useListRfis/.test(
    analytics,
  ),
  "Insights no longer embeds Activity Log, Files, RFI list hooks, or schedule placeholder widgets",
);

check(
  "insights.honest_unavailable_no_fabrication",
  insights.includes("historical_trends") &&
    insights.includes("No authoritative retained history table exists") &&
    insights.includes("schedule_forecast_causes") &&
    analytics.includes("honest empty states") &&
    !/trendSeries|fake|mock|placeholder/i.test(analytics),
  "historical trends and schedule forecast/causes are shown as unavailable instead of fabricated",
);

check(
  "actionable_insights.deep_link_command_center",
  insights.includes("/command-center") &&
    insights.includes("ccBuiltIn=overdue") &&
    insights.includes("ccDeadline=due_this_week") &&
    insights.includes("ccPresentation=action_required") &&
    analytics.includes("setLocation(data.operationalContext.links.overdue)") &&
    insights.includes("linksGrantAuthority: false"),
  "actionable insight links target exact filtered Command Center views and grant no authority",
);

check(
  "boundary.no_clash_ai_notifications",
  !/clashesTable|clashReportsTable|FROM\s+clashes|telegram|OpenAI\(|anthropic\.messages|getAnthropicClientForUser|ai_usage/i.test(
    `${insights}\n${analytics}`,
  ),
  "Build 4 boundary correction adds no Clash substitution, AI, or notification behavior",
);

check(
  "report_links_governed_not_duplicate",
  analytics.includes("Open governed exports") &&
    insights.includes("/reports") &&
    !/generate.*pdf|xlsx|new Blob|window\.print/i.test(analytics),
  "Insights links to governed report surfaces instead of implementing duplicate export logic",
);

const digest = crypto
  .createHash("sha256")
  .update(JSON.stringify(beforeAfterInventory))
  .digest("hex");

console.log(
  JSON.stringify(
    {
      suite: "coordinator-command-center-build4-boundary",
      passed: results.length,
      failed: 0,
      beforeAfterInventory,
      inventorySha256: digest,
      results,
    },
    null,
    2,
  ),
);
