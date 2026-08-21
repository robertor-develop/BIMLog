import * as XLSX from "xlsx";

export const FEEDBACK_FOLLOW_UP_HEADERS = [
  "Feedback ID", "Status", "Priority", "Next action", "Type", "Module", "Project", "Submitter", "Submitter email",
  "Owner user ID", "Target release", "Decision reason", "Customer visible", "Evidence total", "Evidence clean",
  "Evidence quarantined", "Evidence rejected", "Package state", "Reviewer alert", "Telegram delivery", "Created", "Updated",
  "Resolved", "Last event", "Last event at", "Review link",
] as const;

export type FeedbackFollowUpRecord = Record<string, unknown> & { stable_id: string; status: string };
const safeCell = (value: unknown) => { const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " "); return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; };
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value;
export const feedbackReviewUrl = (baseUrl: string, stableId: string) => `${baseUrl}/admin?tab=feedback&feedback=${encodeURIComponent(stableId)}`;
export const feedbackNextAction = (row: FeedbackFollowUpRecord) => {
  if (Number(row.evidence_quarantined) > 0) return "Review scanner quarantine";
  if (Number(row.evidence_rejected) > 0) return "Review rejected evidence";
  if (String(row.reviewer_alert_state || "") !== "delivered") return "Restore reviewer alert";
  if (!row.owner_user_id) return "Claim for review";
  if (["new", "triaged", "accepted", "in_progress", "blocked", "fixed"].includes(row.status)) return "Advance review status";
  return "No open action";
};
export function feedbackFollowUpValues(row: FeedbackFollowUpRecord, baseUrl: string) {
  return [row.stable_id, row.status, row.priority, feedbackNextAction(row), row.feedback_type, row.module,
    [row.project_code, row.project_name].filter(Boolean).join(" "), row.submitter_name, row.submitter_email, row.owner_user_id,
    row.target_release, row.disposition_reason, row.customer_visible, row.evidence_total, row.evidence_clean,
    row.evidence_quarantined, row.evidence_rejected, row.package_state || "not-generated", row.reviewer_alert_state || "pending",
    row.telegram_delivery_state || "not-requested", iso(row.created_at), iso(row.updated_at), iso(row.resolved_at), row.last_event_type,
    iso(row.last_event_at), feedbackReviewUrl(baseUrl, row.stable_id)].map(safeCell);
}
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export function buildFeedbackFollowUpCsv(rows: FeedbackFollowUpRecord[], baseUrl: string) {
  return `\uFEFF${[FEEDBACK_FOLLOW_UP_HEADERS.map(csvCell).join(","), ...rows.map(row => feedbackFollowUpValues(row, baseUrl).map(csvCell).join(","))].join("\r\n")}\r\n`;
}
export function buildFeedbackFollowUpWorkbook(rows: FeedbackFollowUpRecord[], baseUrl: string) {
  const values = rows.map(row => feedbackFollowUpValues(row, baseUrl));
  const workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([[...FEEDBACK_FOLLOW_UP_HEADERS], ...values]);
  sheet["!cols"] = FEEDBACK_FOLLOW_UP_HEADERS.map((header, index) => ({ wch: index === 11 ? 60 : index === 25 ? 72 : Math.max(14, Math.min(34, header.length + 5)) }));
  sheet["!autofilter"] = { ref: `A1:Z${values.length + 1}` }; sheet["!freeze"] = { xSplit: 1, ySplit: 1 } as any;
  for (let row = 2; row <= values.length + 1; row++) { const link = sheet[`Z${row}`]; if (link?.v) link.l = { Target: String(link.v), Tooltip: "Open feedback in BIMLog" }; }
  XLSX.utils.book_append_sheet(workbook, sheet, "Feedback follow-up");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true, bookSST: true }));
}
