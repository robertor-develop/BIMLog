import assert from "node:assert/strict";
import crypto from "node:crypto";
import {BIMTECH_SETUP_MODULES,BimtechSetupPackageError,setupPackageSha,validateBimtechSetupPackage} from "./bimtech-setup-package";
const sourceProject="6de708ac-ce9c-4f1f-a666-c8da89c8a050",organization="e2e0a000-0000-4000-8000-00000000000a";
function fixture(){
 const modules:any={project:{record:{id:sourceProject,name:"Synthetic"}},client:{record:{display_name:"Client"}},contract:{record:{id:"contract"}},scope:{workItems:[{id:"work-1"}]},estimate:{versions:[]},controlReference:{deliveryAssignments:[]},executionPlan:{nodes:[],relations:[]},financialBaseline:{workPackages:[]},team:{assignments:[{user_id:"e2e00000-0000-4000-8000-000000000001"}]},folderRouting:{routingStatus:"NOT_CONFIGURED"}};
 const entries=BIMTECH_SETUP_MODULES.map(key=>({key,status:"INCLUDED",reason:null,redacted:false,sourceRefs:{},recordCounts:{},sha256:setupPackageSha(modules[key])}));
 return {format:"bimtech.setup-package",formatVersion:1,manifest:{exportId:crypto.randomUUID(),generatedAt:new Date().toISOString(),generator:{application:"bimtech-project-setup"},project:{id:sourceProject,organizationId:organization,code:"BT-1",name:"Synthetic",lifecycleStatus:"ACTIVE",revision:2},exporterAccess:{intake:true,financial:true,routing:true,team:true},businessReadiness:"NOT_EVALUATED",modules:entries,consistency:{status:"STABLE"},integrity:{status:"PASS",findings:[]},contentSha256:setupPackageSha(modules)},modules};
}
const valid=fixture(),result=validateBimtechSetupPackage(valid);assert.equal(result.preview.modules.length,10);assert.equal(result.preview.requiresUserMapping,true);assert.equal(result.preview.canStage,true);
const tampered=structuredClone(valid);tampered.modules.project.record.name="Changed";assert.throws(()=>validateBimtechSetupPackage(tampered),(error:any)=>error instanceof BimtechSetupPackageError&&error.code==="BIMTECH_PACKAGE_CONTENT_HASH");
const unstable=fixture();unstable.manifest.consistency.status="CHANGED";assert.throws(()=>validateBimtechSetupPackage(unstable),(error:any)=>error.code==="BIMTECH_PACKAGE_UNSTABLE");
const denied=fixture();delete denied.modules.financialBaseline;const entry=denied.manifest.modules.find((row:any)=>row.key==="financialBaseline")!;Object.assign(entry,{status:"UNAVAILABLE",reason:"ACCESS_DENIED",sha256:null});denied.manifest.contentSha256=setupPackageSha(denied.modules);const limited=validateBimtechSetupPackage(denied);assert.ok(limited.preview.blockingReasons.includes("financialBaseline:ACCESS_DENIED"));
const unsafe=fixture();Object.defineProperty(unsafe.modules.project.record,"__proto__",{value:{polluted:true},enumerable:true});unsafe.manifest.contentSha256=setupPackageSha(unsafe.modules);assert.throws(()=>validateBimtechSetupPackage(unsafe),(error:any)=>error.code==="BIMTECH_PACKAGE_UNSAFE_KEY");
console.log("BIMTECH_SETUP_PACKAGE_VALIDATION=PASS cases=5");
