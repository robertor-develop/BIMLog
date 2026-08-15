import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const adapter=read("plugins/BIMLogLensNext/native/AutodeskReadOnlyAdapter.cs");
const project2021=read("plugins/BIMLogLensNext/native/2021/BIMLogLensNext.Native2021.csproj");
const project2025=read("plugins/BIMLogLensNext/native/2025/BIMLogLensNext.Native2025.csproj");
const core=read("plugins/BIMLogLensNext/BIMLogLensNext.csproj");
const receipt=JSON.parse(read("evidence/lens-next/20260815/readonly-autodesk-adapter/adapter-sandbox-receipt.json"));

assert.match(adapter,/class AutodeskLensNextReadOnlyAdapter : ILensNextReadOnlyNavisworksAdapter/);
assert.match(adapter,/SavedViewpoints\.ResolveGuid\(nativeGuid\)/);
assert.match(adapter,/SavedViewpoints\.CurrentSavedViewpoint = currentObject/);
assert.match(adapter,/Thread\.CurrentThread\.ManagedThreadId != _ownerThreadId/);
assert.match(adapter,/The active Navisworks document changed/);
assert.doesNotMatch(adapter,/\.Value|RootItem|DisplayName\s*==|Comments|AddCopy|InsertCopy|Replace|Remove|Move\(|EditDisplayName|EditComments|AddComment|CaptureRuntimeOverrides|CopyFrom|CreateCopy/);
assert.doesNotMatch(adapter,/BIMLogNavisPlugin|BIMLogLens\.IgniteSmart|localhost:8765|%APPDATA%|phase2-|Http|File\.Write|Directory\.Create|Registry/);
for(const project of [project2021,project2025]){
  assert.match(project,/AutodeskReadOnlyAdapter\.cs/);
  assert.match(project,/ProjectReference Include="\.\.\\\.\.\\BIMLogLensNext\.csproj"/);
  assert.match(project,/NavisworksReferenceGate\.targets/);
}
assert.match(core,/<Compile Remove="native\\\*\*\\\*\.cs"/);
assert.equal(receipt.status,"LOCAL_SANDBOX_PACKAGES_HELD_NO_INSTALL");
assert.equal(receipt.packages.length,2);
assert.deepEqual(receipt.packages.map(item=>item.productYear),[2021,2025]);
assert.equal(receipt.boundaries.install,false);assert.equal(receipt.boundaries.legacyIo,false);assert.equal(receipt.boundaries.phase2,false);assert.equal(receipt.boundaries.autodeskRuntime,false);
console.log(JSON.stringify({status:"PASS",checks:22,mode:"exact-guid-read-only",runtimeNavisworks:false,phase2:false,legacyIo:false}));
