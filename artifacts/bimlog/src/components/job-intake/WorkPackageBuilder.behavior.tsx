import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkPackageBuilder } from "./WorkPackageBuilder";
const data={apuDrafts:[{id:"A1",title:"HVAC drafting"}],workPackages:[{id:"W1",apuDraftId:"A1",title:"Level 10 east",floor:"10",zone:"East",task:"Draft ductwork",deliverable:"Shop drawings"}]};
const html=renderToStaticMarkup(<WorkPackageBuilder data={data} setData={()=>undefined as never} tt={(en)=>en}/>);
assert.match(html,/From APU to work packages/);assert.match(html,/HVAC drafting/);assert.match(html,/Level 10 east/);assert.match(html,/One source of truth/);assert.match(html,/does not create a second schedule/);console.log("Work Package Builder UI behavior: PASS");
