import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["legacy reviewer route remains valid", /Route path="\/admin\/feedback"/],
  ["customer feedback notification route remains valid", /Route path="\/feedback"/],
  ["feedback query opens the review tab only for a super-admin", /requested && isSuperAdmin\) setActiveTab\(9\)/],
  ["reviewer tab is hidden behind super-admin authority", /tab !== "Feedback" \|\| isSuperAdmin/],
  ["reviewer panel is never rendered without super-admin authority", /activeTab === 9 && isSuperAdmin && <FeedbackTab token=\{token\}/],
  ["stable ticket deep-link opens exact package", /URLSearchParams\(window\.location\.search\)\.get\("feedback"\).*openDetail\(match\.id\)/s],
  ["queue exposes evidence counts and quarantine", /clean.*awaiting scan.*rejected/s],
  ["queue exposes owner and explained assignment", /Owned by reviewer.*Assign to me/s],
  ["queue exposes the governed package", /downloadPackage.*Download complete ZIP/s],
  ["queue exposes customer follow-up", /sendCustomerUpdate.*Message customer/s],
  ["queue exposes PostgreSQL follow-up Excel register", /downloadFollowUpRegister\("xlsx"\).*Download master Excel follow-up/s],
  ["queue exposes current-authority PDF Word Excel and JSON", /Current PDF report.*Current Word report.*Current item Excel.*Current JSON record/s],
  ["queue exposes only legal next status transitions", /FEEDBACK_STATUS_TRANSITIONS.*filter\(\(option\).*includes\(option\.value\)/s],
  ["queue provides visible status settlement", /setSuccess\(t\(`Feedback.*Saving…/s],
  ["customer response provides pending and success settlement", /(?=[\s\S]*message:)(?=[\s\S]*Sending…)(?=[\s\S]*Customer update sent)/],
  ["package downloads provide pending and success settlement", /(?=[\s\S]*package:)(?=[\s\S]*Preparing ZIP…)(?=[\s\S]*Complete package downloaded)/],
  ["register downloads provide pending and success settlement", /(?=[\s\S]*register:)(?=[\s\S]*Preparing Excel…)(?=[\s\S]*follow-up register downloaded)/],
  ["queue has synchronized top and content horizontal scroll", /topScrollRef.*tableScrollRef.*Feedback table horizontal scroll/s],
  ["queue header and action columns remain visible", /position: "sticky".*Status \/ owner.*right: 0/s],
  ["reviewer command bar remains visible", /feedback-command-bar[\s\S]*position: sticky/],
  ["responsive reviewer card view replaces the table on mobile", /@media \(max-width: 720px\)[\s\S]*feedback-review-table \{ display: none; \}[\s\S]*feedback-review-cards \{ display: grid/s],
  ["reviewer actions explain claim package and customer visibility", /Assigns you as accountable reviewer.*Generated now from current authority.*Adds a customer-visible timeline response/s],
  ["scanner package owner and internal alert states are explained", /files remain safely quarantined and cannot be opened.*intake remains available in this queue.*Unassigned — claim before acting/s],
  ["feedback reviewer controls provide Spanish copy", /(?=[\s\S]*Revisión de comentarios)(?=[\s\S]*Asignarme)(?=[\s\S]*Responder al cliente)(?=[\s\S]*Escáner controlado)/],
  ["feedback action outcomes use accessible live regions", /aria-live="polite" aria-atomic="true"[\s\S]*role="alert"[\s\S]*role="status"/],
  ["queue and detail consume the Telegram delivery matrix", /TelegramDeliveryStatus value=\{item\.telegramDelivery\}.*TelegramDeliveryStatus value=\{selectedQueueItem\?\.telegramDelivery\}/s],
  ["overall sent requires both documents and every represented outcome", /representedArtifacts\.has\("docx"\) && representedArtifacts\.has\("xlsx"\) && outcomes\.every.*rawOverallState === "sent" && !allRequiredSent \? "incomplete"/s],
  ["partial failed skipped pending missing and inconsistent delivery states are actionable", /Action required — failed.*Action required — partial.*Pending delivery.*Not sent — configuration needed.*Not sent — inconsistent result.*Missing/s],
  ["delivery matrix identifies only reviewer and required document", /Telegram document delivery matrix.*artifactKind.*reviewer.*no eligible reviewer/s],
  ["detail renders projected scan failures against matching asset identity", /detail\.scanFailures.*find\(candidate => Number\(candidate\.id\) === assetId\).*Evidence asset/s],
  ["scan failure reason is control-stripped and bounded", /safeScanFailureReason.*replace\(\/\[\\u0000-\\u001f\\u007f\]\/g.*slice\(0, 320\)/s],
  ["scan failure shows retry state timestamp and governed next action", /(?=[\s\S]*failure\.retryable === true)(?=[\s\S]*failure\.createdAt)(?=[\s\S]*Keep quarantined; correct scanner or source authority)/],
  ["owned reviewer surface shows the requested release label", /v1\.60\.35\.10-F/],
  ["main sidebar already persists full-width resize and collapse", /bimlog-master-sidebar-width.*bimlog-master-sidebar-collapsed.*setSidebarResizing\(true\)/s],
  ["reported page uses a readable link label", /Open reported page ↗/],
  ["detail explains that reports are generated from current authority", /Current report.*Generated when downloaded/s],
  ["report links are consumed through the signed-in BIMLog UI", /downloadAsset.*Opened from a generated BIMLog feedback report.*Downloaded verified file/s],
  ["report download requires an explicit positive asset id", /requestedAsset = params\.get\("downloadAsset"\).*if \(!requestedAsset\).*assetId < 1/s],
  ["operations show the private byte store and PostgreSQL metadata authority", /operations\.storage\?\.location.*Metadata: PostgreSQL.*Access: private through BIMLog/s],
  ["detail is a clear modal review drawer and explains locked evidence", /aria-label="Feedback details".*The record is visible, but its bytes remain locked/s],
];
for (const [name, pattern] of checks) assert.match(`${app}\n${admin}\n${sidebar}`, pattern, name);
console.log(`Feedback admin operational assertions: ${checks.length}/${checks.length} passed`);
