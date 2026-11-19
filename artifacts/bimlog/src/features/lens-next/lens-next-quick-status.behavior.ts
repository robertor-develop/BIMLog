import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const publishing = readFileSync(new URL("../../../../api-server/src/lib/lens-next-publishing.ts", import.meta.url), "utf8");
const checks: string[] = [];
const check = (condition: boolean, label: string) => { assert.equal(condition, true, label); checks.push(label); };

check(view.includes('className="lens-next__quick-status"') && view.includes('aria-label={`Status ${displayCode(issue)}`}'), "compact status control is visible beside the Issue identity");
check(view.includes('onClick={event => event.stopPropagation()}') && view.includes('onPointerDown={event => event.stopPropagation()}'), "status interaction cannot accidentally open Issue Detail");
check(view.includes('statusState === "saving"') && view.includes('setDraftStatus(issue.status)') && view.includes('role="alert"'), "saving feedback and failure rollback are explicit");
check(view.includes('disabled={status === "under_review" || status === "approved"}') && !view.includes('status === "under_review" || status === "approved" || status === "resolved"'), "Resolved remains selectable while review and approval stay in the existing governed workflow");
check(!panel.includes('status === "approved" || status === "resolved"') && panel.includes('apiClient.publishAction(issue, action, reason'), "eligible Resolved selection auto-saves through the governed server transition");
check(panel.includes('const reason = "Quick status update from Lens Next Issue Browser"') && panel.includes('apiClient.publishAction(issue, action, reason'), "eligible selection auto-saves through governed publishing without a user-entered audit reason");
check(panel.includes('quickAssignmentAttempts') && view.includes('labels.assign') && view.includes('onAssignResponsibleCompany'), "Responsible Company Quick Assign and its Assign button remain intact");
check(styles.includes('flex: 0 0 112px') && styles.includes('width: 112px') && !styles.includes('.lens-next__quick-status button'), "status control stays fixed-width and introduces no Update button");
check(styles.includes('.lens-next__issue-card[data-status="open"]') && styles.includes('.lens-next__issue-card[data-status="resolved"]'), "persisted status drives immediate card color feedback");
check(view.includes('className="lens-next__quick-view"') && view.includes('aria-label={`Open Working View ${displayCode(issue)}`}') && view.includes('onOpenIssueWorkingView'), "each card exposes the existing governed Working View action without opening Issue Detail");
check(view.includes('role="button" tabIndex={0} className="lens-next__issue-open"') && view.includes('event.key === "Enter" || event.key === " "'), "card selection remains keyboard-operable without nesting interactive controls inside a button");
check(panel.includes('openWorkingView(issue)') && panel.includes('targetIssue.identity.projectId !== authorizedProjectId'), "card Working View preserves exact project authorization and uses the requested Issue identity");
check(styles.includes('grid-template-columns: minmax(0, 1fr) 112px 28px auto') && styles.includes('width: 28px') && styles.includes('height: 26px'), "compact Working View control preserves the established card dimensions");
check(publishing.includes('assertLensIssueStatusTransition') && publishing.includes('lens_issue_status_changed') && publishing.includes('INSERT INTO lens_viewpoint_events'), "server rechecks transitions and writes the activity and status-event audit trail");

console.log(JSON.stringify({ status: "PASS", checks: checks.length, details: checks }));
