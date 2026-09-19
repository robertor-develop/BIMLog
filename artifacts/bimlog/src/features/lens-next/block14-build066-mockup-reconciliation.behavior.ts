import assert from "node:assert/strict";
import { createLensNextApiClient } from "./lens-next-client";

const calls: string[] = [];
const client = createLensNextApiClient({
  token: "block14-build066",
  fetchImpl: async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/levels")) return Response.json({ levels: ["L02", "L01", "L02"] });
    if (url.endsWith("/members")) return Response.json([
      { userCompanyName: "Acme MEP" },
      { userCompanyName: "" },
    ]);
    if (url.endsWith("/conventions")) return Response.json({
      companyAssignmentStatus: [
        { code: "ACM", hasUsers: true, companyName: "Acme MEP" },
        { code: "STR", hasUsers: true, companyName: "Strong Structures" },
        { code: "UNBOUND", hasUsers: false },
      ],
    });
    throw new Error(`Unexpected request: ${url}`);
  },
});

const referenceData = await client.loadReferenceData(29);
assert.deepEqual(calls, [
  "/api/v1/projects/29/levels",
  "/api/v1/projects/29/members",
  "/api/v1/projects/29/conventions",
]);
assert.deepEqual(referenceData.floors, ["L01", "L02"]);
assert.deepEqual(referenceData.responsibleCompanies, ["Acme MEP", "Strong Structures"]);

const noFabrication = createLensNextApiClient({
  token: "block14-build066-empty",
  fetchImpl: async (input) => {
    const url = String(input);
    if (url.endsWith("/levels")) return Response.json({ levels: [] });
    if (url.endsWith("/members")) return Response.json([]);
    if (url.endsWith("/conventions")) return Response.json({
      companyAssignmentStatus: [{ code: "CODE_ONLY", hasUsers: false }],
    });
    throw new Error(`Unexpected request: ${url}`);
  },
});
assert.deepEqual((await noFabrication.loadReferenceData(29)).responsibleCompanies, []);
await assert.rejects(() => client.loadReferenceData(0), /positive integer/i);

console.log("block 14 build 066 mockup reconciliation: PASS");
