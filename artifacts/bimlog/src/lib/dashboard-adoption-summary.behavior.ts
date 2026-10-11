import assert from "node:assert/strict";
import { EMPTY_DASHBOARD_ADOPTION_SUMMARY, loadDashboardAdoptionSummary } from "./dashboard-adoption-summary";

assert.deepEqual(EMPTY_DASHBOARD_ADOPTION_SUMMARY, { attention: [], assigned: [], recentActivity: [], namingCompanies: [] });
const originalFetch = globalThis.fetch;
let requested = "";
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  requested = String(input);
  assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer token");
  return new Response(JSON.stringify(EMPTY_DASHBOARD_ADOPTION_SUMMARY), { status: 200, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;
try {
  assert.deepEqual(await loadDashboardAdoptionSummary("https://bimlog.test", "token"), EMPTY_DASHBOARD_ADOPTION_SUMMARY);
  assert.equal(requested, "https://bimlog.test/api/v1/dashboard/adoption-summary");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Simplification and guided adoption build 028 Headquarters summary client: PASS");
