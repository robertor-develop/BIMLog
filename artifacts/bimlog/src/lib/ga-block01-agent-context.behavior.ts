import assert from "node:assert/strict";
import { resolvedContextStatus } from "./page-assistant-context-state";
const base={route:"/projects/64/rfis",page:"RFIs",section:"",projectId:64,language:"en" as const,focusedControl:null,controls:[],pageText:[]};
assert.equal(resolvedContextStatus(base),"ready");
assert.equal(resolvedContextStatus({...base,page:"Verifying project context / Verificando contexto del proyecto"}),"verifying");
assert.equal(resolvedContextStatus({...base,page:"Access denied"}),"unauthorized");
assert.equal(resolvedContextStatus({...base,page:"Project unavailable"}),"unavailable");
console.log("GA Block 1 build 4 agent context state machine: PASS");
