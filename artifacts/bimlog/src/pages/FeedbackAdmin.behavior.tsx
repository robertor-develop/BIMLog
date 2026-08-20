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
  ["queue exposes owner and claim", /Owner #.*claimFeedback/s],
  ["queue exposes the governed package", /downloadPackage.*Download ZIP/s],
  ["queue exposes customer follow-up", /sendCustomerUpdate.*Send update/s],
  ["queue exposes PostgreSQL follow-up register", /downloadFollowUpRegister.*Follow-up register/s],
  ["detail shows scanner disposition and history", /Feedback package review.*scannerAdapter.*Activity/s],
];
for (const [name, pattern] of checks) assert.match(`${app}\n${admin}`, pattern, name);
console.log(`Feedback admin operational assertions: ${checks.length}/${checks.length} passed`);
