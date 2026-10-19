import assert from "node:assert/strict";
import { createLensNextApiClient } from "./lens-next-client";
import { conventionCompanyCodes, uniqueProjectCompanyLabels } from "@workspace/api-zod";
import { readSavedConventionFoundation } from "../../pages/project/convention-builder/convention-document-state";

assert.deepEqual(conventionCompanyCodes({ companyCode: "OLD", fields: [{ label: "Originator", allowedValues: [] }] }), []);
assert.deepEqual(conventionCompanyCodes({ companyCode: " BIM, DDS, bim " }), ["BIM", "DDS"]);
assert.deepEqual(uniqueProjectCompanyLabels([null, {}, " DDS ", "dds", "BIMTECH   CORP"]), ["BIMTECH CORP", "DDS"]);
assert.deepEqual(readSavedConventionFoundation({ fields: [
  { label: "Project Code", allowedValues: ["BUILDING-01"] },
  { label: "Originator", allowedValues: ["DDS", "WP"] },
] }).companyCodes, ["DDS", "WP"]);

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
      companyCode: "BIM, DDS, WP, RL, MEGA, DDS, ",
      companyAssignmentStatus: [
        { code: "ACM", hasUsers: true, companyName: "Acme MEP" },
        { code: "STR", hasUsers: true, companyName: "Strong Structures" },
        { code: "UNBOUND", hasUsers: false },
      ],
    });
    if (url.endsWith("/responsible-companies")) return Response.json({ companies: ["Directory Contractor", "Acme MEP", " "] });
    throw new Error(`Unexpected request: ${url}`);
  },
});

const referenceData = await client.loadReferenceData(29);
assert.deepEqual(calls, [
  "/api/v1/projects/29/levels",
  "/api/v1/projects/29/members",
  "/api/v1/projects/29/conventions",
  "/api/v1/projects/29/clash-reports/lens-viewpoints/responsible-companies",
]);
assert.deepEqual(referenceData.floors, ["L01", "L02"]);
assert.deepEqual(referenceData.responsibleCompanies, ["Acme MEP", "BIM", "DDS", "Directory Contractor", "MEGA", "RL", "Strong Structures", "WP"]);

const noFabrication = createLensNextApiClient({
  token: "block14-build066-empty",
  fetchImpl: async (input) => {
    const url = String(input);
    if (url.endsWith("/levels")) return Response.json({ levels: [] });
    if (url.endsWith("/members")) return Response.json([]);
    if (url.endsWith("/responsible-companies")) return Response.json({ companies: [] });
    if (url.endsWith("/conventions")) return Response.json({
      companyAssignmentStatus: [{ code: "CODE_ONLY", hasUsers: false }],
    });
    throw new Error(`Unexpected request: ${url}`);
  },
});
assert.deepEqual((await noFabrication.loadReferenceData(29)).responsibleCompanies, []);
await assert.rejects(() => client.loadReferenceData(0), /positive integer/i);

// A newly created project has originators but no invited contractor users yet.
const newProject = createLensNextApiClient({
  token: "synthetic-new-project",
  fetchImpl: async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith("/api/v1/projects/71/"));
    assert.ok(!init?.method || init.method === "GET");
    if (url.endsWith("/levels")) return Response.json({ levels: [] });
    if (url.endsWith("/members")) return Response.json([{ userCompanyName: "BIMTECH CORP" }]);
    if (url.endsWith("/conventions")) return Response.json({
      companyCode: "STALE",
      fields: [{ label: "Originator", allowedValues: ["BIM", "DDS", "WP", "RL", "MEGA"] }],
      companyAssignmentStatus: [{ code: "DDS", hasUsers: false }],
    });
    if (url.endsWith("/responsible-companies")) return Response.json({ companies: [] });
    throw new Error(`Unexpected request: ${url}`);
  },
});
assert.deepEqual((await newProject.loadReferenceData(71)).responsibleCompanies,
  ["BIM", "BIMTECH CORP", "DDS", "MEGA", "RL", "WP"]);

const deniedDirectory = createLensNextApiClient({
  token: "synthetic-denied-project",
  fetchImpl: async (input) => String(input).endsWith("/responsible-companies")
    ? Response.json({ error: "Forbidden" }, { status: 403 }) : Response.json({}),
});
await assert.rejects(() => deniedDirectory.loadReferenceData(71));

console.log("block 14 build 066 mockup reconciliation: PASS");
