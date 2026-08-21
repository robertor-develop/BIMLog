import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["legacy reviewer route remains valid", /Route path="\/admin\/feedback"/],
  ["customer feedback notification route remains valid", /Route path="\/feedback"/],
  ["feedback query opens the review tab only for a super-admin", /requested && isSuperAdmin\) setActiveTab\(9\)/],
  ["reviewer tab is hidden behind super-admin authority", /tab !== "Feedback" \|\| isSuperAdmin/],
  ["reviewer panel is never rendered without super-admin authority", /activeTab === 9 && isSuperAdmin && <FeedbackTab token=\{token\}/],
  ["stable ticket deep-link opens exact package", /URLSearchParams\(window\.location\.search\)\.get\("feedback"\).*openDetail\(match\.id\)/s],
  ["queue exposes evidence counts and quarantine", /clean.*awaiting scan.*rejected/s],
  ["queue exposes owner and explained claim", /Owned by reviewer.*Claim as my item/s],
  ["queue exposes the governed package", /downloadPackage.*Download complete ZIP/s],
  ["queue exposes customer follow-up", /sendCustomerUpdate.*Message customer/s],
  ["queue exposes PostgreSQL follow-up Excel register", /downloadFollowUpRegister\("xlsx"\).*Download master Excel follow-up/s],
  ["queue exposes retained automatic PDF Word Excel and JSON", /Download PDF report.*Download Word report.*Download item Excel.*Download JSON record/s],
  ["queue exposes only legal next status transitions", /FEEDBACK_STATUS_TRANSITIONS.*filter\(\(option\).*includes\(option\.value\)/s],
  ["queue provides visible mutation settlement", /setSuccess\(`Feedback.*Saving…/s],
  ["queue has synchronized top and content horizontal scroll", /topScrollRef.*tableScrollRef.*Feedback table horizontal scroll/s],
  ["queue header and action columns remain visible", /position: "sticky".*Status \/ owner.*right: 0/s],
  ["reported page uses a readable link label", /Open reported page ↗/],
  ["detail exposes automatic snapshot state", /Automatic snapshot:.*packageSnapshot/s],
  ["detail is a visible review drawer and explains locked evidence", /Complete feedback review.*Bytes locked|File is recorded but its bytes stay locked/s],
];
for (const [name, pattern] of checks) assert.match(`${app}\n${admin}`, pattern, name);
console.log(`Feedback admin operational assertions: ${checks.length}/${checks.length} passed`);
