import assert from "node:assert/strict";
import fs from "node:fs";

const quick = fs.readFileSync(new URL("./QuickJobIntake.tsx", import.meta.url), "utf8");
const advanced = fs.readFileSync(new URL("../../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const packages = fs.readFileSync(new URL("./WorkPackageBuilder.tsx", import.meta.url), "utf8");

assert.match(quick, /clientCompanyId: selected\?\.id/);
assert.match(quick, /counterpartyName: company/);
assert.match(quick, /Floors are locations for work packages and tasks/);
assert.match(advanced, /no se asigna un cliente por piso/);
assert.match(packages, /"floor"/);
assert.doesNotMatch(packages, /clientCompanyId|clientCompany:/);
console.log("Client and floor authority: project-contract client, package-task floor PASS");
