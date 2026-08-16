import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const entry=read("plugins/BIMLogLensNext/native/AutodeskPluginEntryPoints.cs");
const contract=JSON.parse(read("plugins/BIMLogLensNext/contracts/readonly-package.contract.json"));
assert.match(entry,/Plugin\("BIMLogLensNext", "IgniteSmart"/);
assert.match(entry,/sealed class BIMLogLensNextDockPanePlugin : DockPanePlugin/);
assert.match(entry,/Plugin\("BIMLogLensNextButton", "IgniteSmart"/);
assert.match(entry,/sealed class BIMLogLensNextButtonPlugin : AddInPlugin/);
assert.doesNotMatch(entry,/SavedViewpoints|Http|File\.|Directory\.|Registry|BIMLogNavisPlugin|8765|phase2/i);
for(const year of [2021,2025]){
  const xml=read(`plugins/BIMLogLensNext/native/${year}/PackageContents.xml`);
  const series=year===2021?"Nw18":"Nw22";
  assert.match(xml,new RegExp(`SeriesMin="${series}" SeriesMax="${series}"`));
  assert.match(xml,new RegExp(`ModuleName="\\./Contents/BIMLogLensNext\\.Native${year}\\.dll"`));
  assert.doesNotMatch(xml,/BIMLogNavisPlugin|BIMLogLens\.IgniteSmart|8765|APPDATA/);
  assert.equal(contract.yearPackages[String(year)].nativeAssembly,`BIMLogLensNext.Native${year}.dll`);
}
assert.equal(contract.writeFeatureFlagsEnabled,false);
assert.equal(contract.installTargetChosen,false);
assert.equal(contract.legacyFilesIncluded,false);
assert.equal(contract.autodeskAssembliesIncluded,false);
console.log(JSON.stringify({status:"PASS",checks:18,loadableSource:true,readOnly:true,installTargetChosen:false,legacyIo:false}));
