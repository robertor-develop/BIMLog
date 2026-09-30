import assert from "node:assert/strict";
import { projectPlanToLibraryDefinition } from "./apu-library-reuse";

const definition = projectPlanToLibraryDefinition({ currency:"USD",name:"Private Project",fixedCompanyCost:"100.00",allocations:{labor:"700.00",bonus:"100.00",taskEarnings:"100.00"},productionPhases:[{id:"L1",name:"Shop drawings",amount:"500.00"}],administrativeLines:[{id:"PM",name:"Coordination",amount:"200.00"}] },"Reusable BIM APU");
assert.equal(definition.name,"Reusable BIM APU");
assert.equal(definition.currency,"USD");
assert.deepEqual(definition.nodes.map(node => node.label),["Fixed company cost","Shop drawings","Coordination","Project incentive reserve","Project earnings"]);
assert.doesNotMatch(JSON.stringify(definition),/Private Project/);
console.log("apu-library-reuse.behavior: PASS authorized project plan converts to a scoped reusable draft without project leakage");
