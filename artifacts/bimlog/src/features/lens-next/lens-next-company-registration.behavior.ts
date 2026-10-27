import assert from "node:assert/strict";
import { createLensNextApiClient } from "./lens-next-client";

let observedUrl = "";
let observedBody: Record<string, unknown> | null = null;
const client = createLensNextApiClient({
  token: "ruben-authorized-token",
  apiBaseUrl: "/api/v1",
  fetchImpl: async (input, init) => {
    observedUrl = String(input);
    observedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return Response.json({ id: 44, name: "Mainline Pools", reused: true, directoryEntryReused: false }, { status: 201 });
  },
});

const receipt = await client.registerProjectCompany(26, "  Mainline   Pools  ");
assert.equal(observedUrl, "/api/v1/projects/26/directory/companies");
assert.deepEqual(observedBody, { company_name: "Mainline Pools", source_application: "Lens Next" });
assert.deepEqual(receipt, { id: 44, name: "Mainline Pools", reused: true, directoryEntryReused: false });
await assert.rejects(() => client.registerProjectCompany(26, " "), /2 to 160/);

console.log("Lens governed project-company registration and durable source attribution: PASS");
