import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";
import { buildFeedbackFollowUpCsv, buildFeedbackFollowUpWorkbook, feedbackNextAction, feedbackReviewUrl } from "./feedback-follow-up-register";

const row = { stable_id: "FB-ED3259007843", status: "new", priority: "urgent", feedback_type: "bug", module: "RFI", project_code: "P1", project_name: "Tower", submitter_name: "Customer", submitter_email: "=unsafe@example.test", owner_user_id: null, target_release: "v1.60.35.10-F", disposition_reason: null, customer_visible: true, evidence_total: 2, evidence_clean: 1, evidence_quarantined: 1, evidence_rejected: 0, package_state: "awaiting-scan", reviewer_alert_state: "pending", telegram_delivery_state: "partial", telegram_delivery_outcomes:[{recipientUserId:7,artifactKind:"docx",state:"sent"},{recipientUserId:7,artifactKind:"xlsx",state:"missing"}], created_at: new Date("2026-08-21T00:00:00Z"), updated_at: new Date("2026-08-21T01:00:00Z"), resolved_at: null, last_event_type: "created", last_event_at: new Date("2026-08-21T00:00:01Z") };
assert.equal(feedbackReviewUrl("https://bimlog.test", row.stable_id), "https://bimlog.test/admin?tab=feedback&feedback=FB-ED3259007843"); assert.equal(feedbackNextAction(row), "Review scanner quarantine");
assert.equal(feedbackNextAction({...row,evidence_quarantined:0,reviewer_alert_state:"delivered"}),"Review Telegram delivery");
const csv = buildFeedbackFollowUpCsv([row], "https://bimlog.test"); assert.match(csv, /Evidence quarantined/); assert.match(csv, /admin\?tab=feedback&feedback=FB-ED3259007843/); assert.doesNotMatch(csv, /,"=unsafe/);
const bytes = buildFeedbackFollowUpWorkbook([row], "https://bimlog.test"), zip = new AdmZip(bytes); assert.ok(zip.getEntry("xl/workbook.xml")); assert.ok(zip.getEntry("xl/worksheets/sheet1.xml")); assert.ok(zip.getEntry("xl/worksheets/_rels/sheet1.xml.rels"));
const workbook = XLSX.read(bytes, { type: "buffer" }), sheet = workbook.Sheets["Feedback follow-up"]; assert.equal(sheet.AA2.l?.Target, "https://bimlog.test/admin?tab=feedback&feedback=FB-ED3259007843"); assert.equal(sheet.D2.v, "Review scanner quarantine"); assert.equal(sheet.P2.v, "1"); assert.match(String(sheet.U2.v),/7:docx=sent; 7:xlsx=missing/);
console.log("feedback follow-up register: 11/11 passed");
