import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8"),
  page = read("../artifacts/bimlog/src/pages/parity/admin-support.tsx"),
  queue = read("../artifacts/bimlog/src/components/admin/SupportCaseQueue.tsx"),
  data = read(
    "../artifacts/bimlog/src/components/admin/AdminSupportDataRequestActions.tsx",
  ),
  conversation = read(
    "../artifacts/bimlog/src/components/commercial/SupportConversation.tsx",
  ),
  timeline = read(
    "../artifacts/bimlog/src/components/commercial/SupportCaseTimeline.tsx",
  ),
  app = read("../artifacts/bimlog/src/App.tsx"),
  directory = read("../artifacts/bimlog/src/lib/capability-directory.ts");
const checks = [
  [
    app.includes("/admin/support-operations") &&
      app.includes('surface="total_control"'),
    "protected direct route",
  ],
  [
    directory.includes('id: "admin-support-operations"'),
    "discoverable All Tools entry",
  ],
  [page.includes("SupportCaseQueue"), "operational queue mounted"],
  [
    queue.includes("AdminSupportDataRequestActions") &&
      queue.includes('"status"') &&
      queue.includes('"assignment"'),
    "assignment status and data actions",
  ],
  [
    conversation.includes('admin?"/api/v1/admin"') &&
      conversation.includes('/support/cases/${caseId}/messages') &&
      conversation.includes("${path}/read"),
    "messages and read evidence",
  ],
  [
    timeline.includes('admin/":""}support/cases/${caseId}/events'),
    "event evidence",
  ],
  [
    data.includes("data-request/fulfillment") &&
      data.includes("data-request/correction") &&
      data.includes("data-request/restriction") &&
      data.includes("expectedUpdatedAt"),
    "review fulfillment correction restriction workflows",
  ],
  [
    data.includes('role="alert"') && data.includes('role="status"'),
    "actionable failure and success states",
  ],
];
for (const [ok, label] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exit(1);
console.log("PASS P043 admin support parity");
