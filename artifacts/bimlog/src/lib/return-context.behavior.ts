import assert from "node:assert/strict";
import { intakeOrigin, validatedReturn, withIntakeReturn } from "./return-context";
const link=withIntakeReturn("/projects/7/convention",7,"delivery","ji-assignment-2");
assert.equal(validatedReturn(link.split("?")[1],7),intakeOrigin(7,"delivery","ji-assignment-2"));
for(const bad of ["https://evil.test/projects/7/intake","//evil.test/projects/7/intake","/projects/8/intake?stage=scope","/projects/7/intake?stage=nope","/projects/7/intake?token=secret"]) assert.equal(validatedReturn("returnTo="+encodeURIComponent(bad),7),null);
console.log("UX017 exact same-project return context and unsafe-origin denial PASS");

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
