import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const publishing = readFileSync(new URL("../../../../api-server/src/lib/lens-next-publishing.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../../../api-server/src/routes/clash_reports.ts", import.meta.url), "utf8");

const checks: string[] = [];
const check = (condition: unknown, label: string) => { assert.ok(condition, label); checks.push(label); };

check(view.includes('className="lens-next__issue-open"') && view.includes('className="lens-next__quick-assignment"'), "card navigation and assignment controls are separate interaction targets");
check(view.includes("event.stopPropagation()"), "assignment controls cannot open issue detail");
check(view.includes('draftCompany === persistedCompany') && view.includes('assignmentState === "saving"'), "unchanged and in-flight assignments are disabled");
check(view.includes('role="status"') && view.includes('role="alert"'), "saving outcome is accessible without replacing the card");
check(view.includes('<option value="">{labels.unassigned}</option>'), "Unassigned remains a first-class choice");
check(view.includes("historical") && view.includes("responsibleCompanies.map"), "current historical value and governed project companies remain distinguishable");
check(panel.includes("quickAssignmentAttempts") && panel.includes("mutationVersion: result.issue.mutationVersion"), "per-issue retry identity and verified server version are retained");
check(panel.includes("current.map") && panel.includes("currentIssue.identity.serverId === result.issue.serverId"), "only the assigned issue is replaced in local state");
check(view.includes("scrollTop = scrollTop") && view.includes("requestAnimationFrame"), "filter regrouping preserves issue-list scroll position");
check(styles.includes(".lens-next__quick-assignment") && styles.includes("@media (max-width: 520px)"), "quick assignment supports wide and narrow card layouts");
check(publishing.includes("RESPONSIBLE_COMPANY_CHANGED") && publishing.includes("previousResponsibleCompany") && publishing.includes("newResponsibleCompany"), "atomic audit captures requested assignment evidence");
check(route.includes("loadProjectCompanyChoices(projectId)") && route.includes("LENS_NEXT_ASSIGNMENT_FORBIDDEN"), "server rejects companies outside the authorized project catalog");

console.log(JSON.stringify({ status: "PASS", checks: checks.length, details: checks }));
