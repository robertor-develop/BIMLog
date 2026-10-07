import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { intakeOrigin, intakeResumeTarget, intakeReturnActionHref, safeProjectReturnTarget, validatedReturn, withIntakeReturn, intakePrerequisiteReturn, parseIntakeResume, parseIntakeReturn } from "./return-context";
const link=withIntakeReturn("/projects/7/convention",7,"delivery","ji-assignment-2");
assert.equal(validatedReturn(link.split("?")[1],7),intakeOrigin(7,"delivery","ji-assignment-2"));
for(const bad of ["https://evil.test/projects/7/intake","//evil.test/projects/7/intake","/projects/8/intake?stage=scope","/projects/7/intake?stage=nope","/projects/7/intake?token=secret"]) assert.equal(validatedReturn("returnTo="+encodeURIComponent(bad),7),null);
console.log("UX017 exact same-project return context and unsafe-origin denial PASS");
assert.equal(intakePrerequisiteReturn("returnTo="+encodeURIComponent("/projects/7/intake?stage=delivery")), "/projects/7/intake?stage=delivery");
for (const bad of ["https://evil.test", "//evil.test/projects/7/intake", "/projects/0/intake", "/projects/7/intake?token=secret", "/projects/7/intake?stage=nope"]) assert.equal(intakePrerequisiteReturn("returnTo="+encodeURIComponent(bad)), null);
const parsed = parseIntakeReturn("returnTo=" + encodeURIComponent("/projects/7/intake?stage=contract&item=ji-contract-2"));
assert.deepEqual(parsed, { projectId: 7, stage: "contract", item: "ji-contract-2", href: "/projects/7/intake?stage=contract&item=ji-contract-2" });
assert.equal(intakeReturnActionHref(parsed!), "/projects/7/intake?stage=contract&item=ji-contract-2&resume=prerequisite");
assert.deepEqual(parseIntakeResume("stage=contract&item=ji-contract-2&resume=prerequisite", 7), parsed);
assert.equal(intakeResumeTarget(parsed!), "ji-contract-2");
assert.equal(intakeResumeTarget({ projectId: 7, stage: "delivery", href: "/projects/7/intake?stage=delivery" }), "ji-delivery");
for (const bad of ["stage=contract&resume=wrong", "stage=nope&resume=prerequisite", "stage=scope&resume=prerequisite&token=secret"]) assert.equal(parseIntakeResume(bad, 7), null);
assert.equal(parseIntakeReturn("returnTo=" + encodeURIComponent("/projects/7/intake?stage=scope#escape")), null);
assert.equal(safeProjectReturnTarget("/projects/7/files?resume=file-intake", 7), "/projects/7/files?resume=file-intake");
for (const bad of ["https://evil.test/projects/7/files", "//evil.test/projects/7/files", "/projects/8/files", "/projects/7/../8/files", "/projects/7/files#escape"]) assert.equal(safeProjectReturnTarget(bad, 7), null);

const banner = readFileSync(new URL("../components/layout/IntakeReturnBanner.tsx", import.meta.url), "utf8");
const financialShell = readFileSync(new URL("../components/layout/FinancialProjectShell.tsx", import.meta.url), "utf8");
const projectDetail = readFileSync(new URL("../pages/ProjectDetail.tsx", import.meta.url), "utf8");
const companyWorkflows = readFileSync(new URL("../pages/CompanyDeliveryWorkflows.tsx", import.meta.url), "utf8");
const contracts = readFileSync(new URL("../pages/FinancialContractWorkspace.tsx", import.meta.url), "utf8");
const intakeWorkspace = readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
assert.match(banner, /Complete this prerequisite, then continue the same saved Intake draft/);
assert.match(banner, /aria-label=\{tt\("Return to Job Intake"/);
assert.equal((financialShell.match(/<IntakeReturnBanner/g) ?? []).length, 1);
assert.equal((projectDetail.match(/<IntakeReturnBanner/g) ?? []).length, 1);
assert.equal((companyWorkflows.match(/<IntakeReturnBanner/g) ?? []).length, 1);
assert.match(contracts, /\.focus\(\{ preventScroll: false \}\)/);
assert.match(contracts, /Opened from Job Intake/);
assert.match(contracts, /fc-card-linked/);
assert.match(intakeWorkspace, /returnContext\?\.stage \?\? readJobIntakeActiveStage/);
assert.match(intakeWorkspace, /returnContext\?\.item \?\? readJobIntakeActiveItem/);
assert.match(intakeWorkspace, /data-intake-return-focus/);
assert.match(intakeWorkspace, /focus\(\{ preventScroll: true \}\)/);
console.log("UX return journey: one visible bilingual recovery path and exact linked-contract focus PASS");

import {projectHomeDestination} from "./project-home-destination";
assert.equal(projectHomeDestination(7,"project_admin",{status:"activated"}),"/projects/7/operations");
assert.equal(projectHomeDestination(7,"project_admin",{status:"draft"}),"/projects/7/intake");
assert.equal(projectHomeDestination(7,"project_admin",{intake:null}),"/projects/7/intake");
assert.equal(projectHomeDestination(7,"project_admin",{}),null);
assert.equal(projectHomeDestination(7,"read_only"),"/projects/7/analytics");
assert.equal(projectHomeDestination(7,"discipline_lead"),"/projects/7/coordination");
assert.equal(projectHomeDestination(7,"member"),"/projects/7/operations");
assert.equal(projectHomeDestination(7,"unknown"),"/projects/7/analytics");
console.log("UX019 verified-state role routing and malformed-state recovery PASS");

import {policyProjectOptions, initialPolicyProject} from "./policy-project-options";
const policyRows=policyProjectOptions([
 {id:1,name:"Legacy",active:true,bindingRequired:true,canConfigure:false},
 {id:1,name:"Legacy",active:true,bindingRequired:true,canConfigure:false},
 {id:2,name:"Bound",active:true,bindingRequired:false,canConfigure:true},
 {id:2,name:"Bound",active:true,bindingRequired:false,canConfigure:true},
]);
assert.equal(policyRows.length,2);
assert.equal(initialPolicyProject(policyRows),2);
assert.equal(initialPolicyProject(policyRows.slice(0,1)),null);
assert.equal(policyProjectOptions([{...policyRows[1],canConfigure:true},{...policyRows[1],canConfigure:false}])[0].canConfigure,false);
assert.equal(initialPolicyProject(policyProjectOptions([{...policyRows[1]},{...policyRows[1],bindingRequired:true}])),null);
console.log("Profile policy project options: duplicate identities collapsed, binding prerequisite explicit, conflicting authority never widened PASS");
